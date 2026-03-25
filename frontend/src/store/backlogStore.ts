import { create } from 'zustand';
import { api } from '../api/client';
import type { BacklogItem, BacklogBucket, BacklogShare, SharedBacklog } from '../types';

interface BacklogState {
  items:          BacklogItem[];
  buckets:        BacklogBucket[];
  sharedBacklogs: SharedBacklog[];   // buckets shared with me (accepted)
  pendingInvites: BacklogShare[];    // invitations waiting for my response
  loading: boolean;
  error:   string | null;

  fetchAll:            () => Promise<void>;
  fetchPendingInvites: () => Promise<void>;

  createItem:  (body: { title: string; description?: string; category?: string; effort?: number | null; bucket_id?: string | null }) => Promise<void>;
  updateItem:  (id: string, patch: Partial<BacklogItem>) => Promise<void>;
  deleteItem:  (id: string) => Promise<void>;

  createBucket: (name: string) => Promise<BacklogBucket>;
  updateBucket: (id: string, name: string) => Promise<void>;
  deleteBucket: (id: string) => Promise<void>;

  // Sharing (bucket level)
  invite:          (bucketId: string, email: string) => Promise<void>;
  revokeShare:     (shareId: string, bucketId: string) => Promise<void>;
  respondToInvite: (id: string, accept: boolean) => Promise<void>;

  // Shared bucket item actions
  createSharedItem:   (sharedBucketId: string, body: { title: string; description?: string; category?: string; effort?: number | null }) => Promise<void>;
  activateSharedItem: (itemId: string, sharedBucketId: string) => Promise<BacklogItem>;
}

export const useBacklogStore = create<BacklogState>((set, get) => ({
  items:          [],
  buckets:        [],
  sharedBacklogs: [],
  pendingInvites: [],
  loading: false,
  error:   null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [items, buckets, sharedBacklogs] = await Promise.all([
        api.backlog.listItems(),
        api.backlog.listBuckets(),
        api.backlog.listShared(),
      ]);
      set({ items, buckets, sharedBacklogs });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Failed to load backlog' });
    } finally {
      set({ loading: false });
    }
  },

  fetchPendingInvites: async () => {
    try {
      const pendingInvites = await api.backlog.pendingInvites();
      set({ pendingInvites });
    } catch {
      // silently ignore — non-critical
    }
  },

  createItem: async (body) => {
    const item = await api.backlog.createItem(body);
    set((s) => ({ items: [item, ...s.items] }));
  },

  updateItem: async (id, patch) => {
    const updated = await api.backlog.updateItem(id, patch);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...updated } : i)) }));
  },

  deleteItem: async (id) => {
    await api.backlog.deleteItem(id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  createBucket: async (name) => {
    const bucket = await api.backlog.createBucket(name);
    set((s) => ({ buckets: [...s.buckets, bucket] }));
    return bucket;
  },

  updateBucket: async (id, name) => {
    const updated = await api.backlog.updateBucket(id, name);
    set((s) => ({ buckets: s.buckets.map((b) => (b.id === id ? { ...b, ...updated } : b)) }));
  },

  deleteBucket: async (id) => {
    await api.backlog.deleteBucket(id);
    set((s) => ({
      buckets: s.buckets.filter((b) => b.id !== id),
      items:   s.items.map((i) => i.bucket_id === id ? { ...i, bucket_id: null, bucket_name: null } : i),
    }));
  },

  // ── Sharing ───────────────────────────────────────────────────────────────

  invite: async (bucketId, email) => {
    const share = await api.backlog.invite(bucketId, email);
    // Optimistically add the share to the relevant bucket's shares list
    set((s) => ({
      buckets: s.buckets.map((b) =>
        b.id === bucketId
          ? { ...b, shares: [...(b.shares ?? []).filter((sh) => sh.id !== share.id), { id: share.id, invitee_email: share.invitee_email, status: share.status, invitee_workspace_id: share.invitee_workspace_id }] }
          : b,
      ),
    }));
  },

  revokeShare: async (shareId, bucketId) => {
    await api.backlog.revokeShare(shareId);
    set((s) => ({
      buckets: s.buckets.map((b) =>
        b.id === bucketId
          ? { ...b, shares: (b.shares ?? []).filter((sh) => sh.id !== shareId) }
          : b,
      ),
    }));
  },

  respondToInvite: async (id, accept) => {
    await api.backlog.respondToInvite(id, accept);
    set((s) => ({ pendingInvites: s.pendingInvites.filter((inv) => inv.id !== id) }));
    if (accept) {
      await get().fetchAll();
    }
  },

  // ── Shared bucket item actions ────────────────────────────────────────────

  createSharedItem: async (sharedBucketId, body) => {
    const item = await api.backlog.createSharedItem(sharedBucketId, body);
    set((s) => ({
      sharedBacklogs: s.sharedBacklogs.map((sb) =>
        sb.share.bucket_id === sharedBucketId
          ? { ...sb, items: [item, ...sb.items] }
          : sb,
      ),
    }));
  },

  activateSharedItem: async (itemId, sharedBucketId) => {
    const sb   = get().sharedBacklogs.find((b) => b.share.bucket_id === sharedBucketId);
    const item = sb?.items.find((i) => i.id === itemId);
    if (!item) throw new Error('Item not found');

    await api.backlog.deleteSharedItem(itemId);

    set((s) => ({
      sharedBacklogs: s.sharedBacklogs.map((b) =>
        b.share.bucket_id === sharedBucketId
          ? { ...b, items: b.items.filter((i) => i.id !== itemId) }
          : b,
      ),
    }));

    return item;
  },
}));
