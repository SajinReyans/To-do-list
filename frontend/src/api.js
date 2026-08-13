const BASE = "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Queue (one-day tasks)
export const getQueueTasks = () => request("/queue");
export const createQueueTask = (data) => request("/queue", { method: "POST", body: JSON.stringify(data) });
export const updateQueueTask = (id, data) => request(`/queue/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteQueueTask = (id) => request(`/queue/${id}`, { method: "DELETE" });

// Tree (long-term tasks)
export const getTree = () => request("/tree");
export const createTreeNode = (data) => request("/tree", { method: "POST", body: JSON.stringify(data) });
export const updateTreeNode = (id, data) => request(`/tree/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteTreeNode = (id) => request(`/tree/${id}`, { method: "DELETE" });

// Settings
export const getSettings = () => request("/settings");
export const updateSettings = (data) => request("/settings", { method: "PATCH", body: JSON.stringify(data) });
