const BASE = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => req<{ ok: boolean; ts: string }>("/api/health"),
  aiUsers: {
    list: () => req<any[]>("/api/ai-users"),
    create: (display_name: string) =>
      req<any>("/api/ai-users", { method: "POST", body: JSON.stringify({ display_name }) }),
    remove: (id: string) => req<any>(`/api/ai-users/${id}`, { method: "DELETE" }),
  },
  accounts: {
    list: (ai_user_id?: string) =>
      req<any[]>(`/api/accounts${ai_user_id ? `?ai_user_id=${ai_user_id}` : ""}`),
    remove: (id: string) => req<any>(`/api/accounts/${id}`, { method: "DELETE" }),
  },
  posts: {
    list: (params: { ai_user_id?: string; from?: string; to?: string } = {}) => {
      const qs = new URLSearchParams(params as any).toString();
      return req<any[]>(`/api/posts${qs ? `?${qs}` : ""}`);
    },
    create: (payload: any) => req<any>("/api/posts", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: any) =>
      req<any>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    remove: (id: string) => req<any>(`/api/posts/${id}`, { method: "DELETE" }),
  },
  media: {
    upload: async (file: File, ai_user_id: string) => {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`${BASE}/api/media?ai_user_id=${encodeURIComponent(ai_user_id)}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return (await res.json()) as { path: string; url: string; mime: string; size: number | null };
    },
  },
};
