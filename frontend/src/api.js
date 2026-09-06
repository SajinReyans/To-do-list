import { supabase } from "./supabaseClient.js";

const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const BASE = rawApiUrl
  ? (rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`)
  : "/api";

// Fast in-memory token cache to avoid waiting on async getSession() before every request
let cachedToken = null;

// Listen to auth changes so token is always fresh
if (supabase?.auth) {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token || null;
  });
}

async function getAccessToken() {
  if (cachedToken) return cachedToken;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    cachedToken = session?.access_token || null;
    return cachedToken;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = await getAccessToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
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

// Today (dedicated daily tasks with priorities & status)
export const getTodayTasks = (date) => request(`/today${date ? `?date=${encodeURIComponent(date)}` : ""}`);
export const createTodayTask = (data) => request("/today", { method: "POST", body: JSON.stringify(data) });
export const updateTodayTask = (id, data) => request(`/today/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteTodayTask = (id) => request(`/today/${id}`, { method: "DELETE" });

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

