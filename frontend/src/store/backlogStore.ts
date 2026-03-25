import { create } from 'zustand';
import { api } from '../api/client';
import type { BacklogItem, BacklogBucket, BacklogShare, SharedBacklog } from '../types';

interface BacklogState {
  items:          BacklogItem[];
  buckets:        BacklogBucket[];
  sharedBacklogs: SharedBacklog[];   // backlogs shared with me (accepted)
  myShares:       BacklogShare[];    // shares I have sent
  pendingInvites: BacklogShare[];    // invitations waiting for my response
  loading: boolean;
  error:   string | null;

  fetchAll:           () => Promise<void>;
  fetchPendingInvites: () => Promise<void>;

  createItem:    (body: { title: string; description?: string; category?: string; effort?: number | null; bucket_id?: string | null }) => Promise<void>;
  updateItem:    (id: string, patch: Partial<BacklogItem>) => Promise<void>;
  deleteItem:    (id: string) => Promise<void>;

  createBucket:  (name: string) => Promise<BacklogBucket>;
  updateBucket:  (id: string, name: string) => Promise<void>;
  deleteBucket:  (id: string) => Promise<void>;

  // Sharing
  invite:          (email: string) => Promise<void>;
  revokeShare:     (id: string) => Promise<void>;
  respondToInvite: (id: string, accept: boolean) => Promise<void>;

  // Shared backlog actions
  createSharedItem:   (sharedWorkspaceId: string, body: { title: string; description?: string; category?: string; effort?: number | null; bucket_id?: string | null }) => Promise<void>;
  activateSharedItem: (itemId: string, sharedWorkspaceId: string) => Promise<BacklogItem>;
}

export const useBacklogStore = create<BacklogState>((set, get) => ({
  items:          [],
  buckets:        [],
  sharedBacklogs: [],
  myShares:       [],
  pendingInvites: [],
  loading: false,
  error:   null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [items, buckets, sharedBacklogs, myShares] = await Promise.all([
        api.backlog.listItems(),
        api.backlog.listBuckets(),
        api.backlog.listShared(),
        api.backlog.myShares(),
      ]);
      set({ items, buckets, sharedBacklogs, myShares });
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
    set((s) => ({ buckets: s.buckets.map((b) => (b.id === id ? updated : b)) }));
  },

  deleteBucket: async (id) => {
    await api.backlog.deleteBucket(id);
    set((s) => ({
      buckets: s.buckets.filter((b) => b.id !== id),
      items: s.items.map((i) => i.bucket_id === id ? { ...i, bucket_id: null, bucket_name: null } : i),
    }));
  },

  // ── Sharing ───────────────────────────────────────────────────────────────

  invite: async (email) => {
    const share = await api.backlog.invite(email);
    set((s) => ({ myShares: [share, ...s.myShares.filter((sh) => sh.id !== share.id)] }));
  },

  revokeShare: async (id) => {
    await api.backlog.revokeShare(id);
    set((s) => ({ myShares: s.myShares.filter((sh) => sh.id !== id) }));
  },

  respondToInvite: async (id, accept) => {
    await api.backlog.respondToInvite(id, accept);
    set((s) => ({ pendingInvites: s.pendingInvites.filter((inv) => inv.id !== id) }));
    if (accept) {
      // Refresh to pull in the newly shared backlog
      await get().fetchAll();
    }
  },

  // ── Shared backlog item actions ───────────────────────────────────────────

  createSharedItem: async (sharedWorkspaceId, body) => {
    const item = await api.backlog.createSharedItem(sharedWorkspaceId, body);
    set((s) => ({
      sharedBacklogs: s.sharedBacklogs.map((sb) =>
        sb.share.owner_workspace_id === sharedWorkspaceId
          ? { ...sb, items: [item, ...sb.items] }
          : sb,
      ),
    }));
  },

  // Returns item data for pre-filling the task create modal, then deletes it from shared backlog
  activateSharedItem: async (itemId, sharedWorkspaceId) => {
    const sb = get().sharedBacklogs.find((b) => b.share.owner_workspace_id === sharedWorkspaceId);
    const item = sb?.items.find((i) => i.id === itemId);
    if (!item) throw new Error('Item not found');

    await api.backlog.deleteSharedItem(itemId);

    set((s) => ({
      sharedBacklogs: s.sharedBacklogs.map((b) =>
        b.share.owner_workspace_id === sharedWorkspaceId
          ? { ...b, items: b.items.filter((i) => i.id !== itemId) }
          : b,
      ),
    }));

    return item;
  },
}));
