import { supabase } from "./supabaseClient.js";

const BASE = "http://localhost:4000/api";

async function request(path, options = {}) {
  // Retrieve token from Supabase session for each request (auto-refreshed by Supabase client)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
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

// Habits (365-day Tracker)
export const getHabits = (year) => request(`/habits?year=${year}`);
export const createHabit = (data) => request("/habits", { method: "POST", body: JSON.stringify(data) });
export const updateHabit = (id, data) => request(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteHabit = (id) => request(`/habits/${id}`, { method: "DELETE" });
export const getHabitCompletions = (id, year) => request(`/habits/${id}/completions?year=${year}`);
export const getAllHabitCompletions = (year) => request(`/habits/completions?year=${year}`);
export const toggleHabitCompletion = (id, date, completed) =>
  request(`/habits/${id}/completions`, { method: "PATCH", body: JSON.stringify({ date, completed }) });
