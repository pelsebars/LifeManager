import type { Project, Phase, Task, TodayTask, SlippedTask, DayProfile, LoadEntry, Routine } from '../types';

const BASE = '/api';

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

  assistant: {
    standup: (body: { messages: unknown[]; date?: string }) =>
      request<{ reply: string; slippedTasks: SlippedTask[] }>('/assistant/standup', { method: 'POST', body: JSON.stringify(body) }),
    query: (body: { question: string }) =>
      request<{ reply: string }>('/assistant/query', { method: 'POST', body: JSON.stringify(body) }),
  },
};
