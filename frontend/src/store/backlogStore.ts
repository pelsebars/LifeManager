import { create } from 'zustand';
import { api } from '../api/client';
import type { BacklogItem, BacklogBucket } from '../types';

interface BacklogState {
  items:   BacklogItem[];
  buckets: BacklogBucket[];
  loading: boolean;
  error:   string | null;

  fetchAll:      () => Promise<void>;
  createItem:    (body: { title: string; description?: string; category?: string; effort?: number | null; bucket_id?: string | null }) => Promise<void>;
  updateItem:    (id: string, patch: Partial<BacklogItem>) => Promise<void>;
  deleteItem:    (id: string) => Promise<void>;

  createBucket:  (name: string) => Promise<BacklogBucket>;
  updateBucket:  (id: string, name: string) => Promise<void>;
  deleteBucket:  (id: string) => Promise<void>;
}

export const useBacklogStore = create<BacklogState>((set) => ({
  items:   [],
  buckets: [],
  loading: false,
  error:   null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [items, buckets] = await Promise.all([
        api.backlog.listItems(),
        api.backlog.listBuckets(),
      ]);
      set({ items, buckets });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Failed to load backlog' });
    } finally {
      set({ loading: false });
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
      // items in that bucket lose their bucket affiliation locally
      items: s.items.map((i) => i.bucket_id === id ? { ...i, bucket_id: null, bucket_name: null } : i),
    }));
  },
}));
