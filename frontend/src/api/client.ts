import type { Project, Phase, Task, TodayTask, SlippedTask, DayProfile, LoadEntry, Routine, BacklogItem, BacklogBucket, BacklogShare, SharedBacklog } from '../types';

// In production VITE_API_URL points to Railway (e.g. https://xxx.up.railway.app)
// In local dev it's empty and we fall back to /api (proxied by Vite)
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; workspaceName: string }) =>
      request<{ token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  },

  projects: {
    list: () => request<Project[]>('/projects'),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (body: Partial<Project>) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Project>) =>
      request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  },

  phases: {
    list: (projectId: string) => request<Phase[]>(`/phases?project_id=${projectId}`),
    create: (body: Partial<Phase>) =>
      request<Phase>('/phases', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Phase>) =>
      request<Phase>(`/phases/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/phases/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    listByPhase: (phaseId: string) => request<Task[]>(`/tasks?phase_id=${phaseId}`),
    listByDate: (date: string) => request<TodayTask[]>(`/tasks?date=${date}`),
    create: (body: Partial<Task> & { phase_id: string }) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  },

  dayProfiles: {
    list: () => request<DayProfile[]>('/day-profiles'),
    upsert: (dayType: string, body: Omit<DayProfile, 'id' | 'workspace_id' | 'day_type'>) =>
      request<DayProfile>(`/day-profiles/${dayType}`, { method: 'PUT', body: JSON.stringify(body) }),
  },

  schedule: {
    apply: (taskId: string, patch: Partial<Task>) =>
      request<{ task: Task; cascade: Task[]; loadEntries: LoadEntry[] }>(
        '/schedule/apply',
        { method: 'POST', body: JSON.stringify({ taskId, patch }) },
      ),
  },

  routines: {
    list: () => request<Routine[]>('/routines'),
    create: (body: { name: string; category: string; effort_hours: number }) =>
      request<Routine>('/routines', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/routines/${id}`, { method: 'DELETE' }),
    toggleOccurrence: (id: string, date: string) =>
      request<{ date: string; active: boolean }>(`/routines/${id}/occurrences`, {
        method: 'POST', body: JSON.stringify({ date }),
      }),
  },

  backlog: {
    listItems: () => request<BacklogItem[]>('/backlog'),
    createItem: (body: { title: string; description?: string; category?: string; effort?: number | null; bucket_id?: string | null }) =>
      request<BacklogItem>('/backlog', { method: 'POST', body: JSON.stringify(body) }),
    updateItem: (id: string, body: Partial<BacklogItem>) =>
      request<BacklogItem>(`/backlog/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteItem: (id: string) => request<void>(`/backlog/${id}`, { method: 'DELETE' }),

    listBuckets: () => request<BacklogBucket[]>('/backlog/buckets'),
    createBucket: (name: string) =>
      request<BacklogBucket>('/backlog/buckets', { method: 'POST', body: JSON.stringify({ name }) }),
    updateBucket: (id: string, name: string) =>
      request<BacklogBucket>(`/backlog/buckets/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deleteBucket: (id: string) => request<void>(`/backlog/buckets/${id}`, { method: 'DELETE' }),

    // Sharing
    invite: (email: string) =>
      request<BacklogShare>('/backlog/shares', { method: 'POST', body: JSON.stringify({ email }) }),
    pendingInvites: () => request<BacklogShare[]>('/backlog/shares/pending'),
    myShares: () => request<BacklogShare[]>('/backlog/shares/mine'),
    respondToInvite: (id: string, accept: boolean) =>
      request<BacklogShare>(`/backlog/shares/${id}/respond`, { method: 'PUT', body: JSON.stringify({ accept }) }),
    revokeShare: (id: string) => request<void>(`/backlog/shares/${id}`, { method: 'DELETE' }),
    listShared: () => request<SharedBacklog[]>('/backlog/shared'),
    createSharedItem: (sharedWorkspaceId: string, body: { title: string; description?: string; category?: string; effort?: number | null; bucket_id?: string | null }) =>
      request<BacklogItem>('/backlog', { method: 'POST', body: JSON.stringify({ ...body, shared_workspace_id: sharedWorkspaceId }) }),
    deleteSharedItem: (itemId: string) => request<void>(`/backlog/shared-item/${itemId}`, { method: 'DELETE' }),
  },

  assistant: {
    standup: (body: { messages: unknown[]; date?: string }) =>
      request<{ reply: string; slippedTasks: SlippedTask[] }>('/assistant/standup', { method: 'POST', body: JSON.stringify(body) }),
    query: (body: { question: string }) =>
      request<{ reply: string }>('/assistant/query', { method: 'POST', body: JSON.stringify(body) }),
  },
};
