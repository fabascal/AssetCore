import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: true,
});

/* ── Automatic silent refresh on 401 ────────────────────── */

let refreshPromise: Promise<unknown> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only attempt refresh once per request, and not for auth endpoints themselves
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.startsWith("/auth/")
    ) {
      original._retry = true;

      // Deduplicate concurrent refresh attempts
      if (!refreshPromise) {
        refreshPromise = api.post("/auth/refresh").finally(() => {
          refreshPromise = null;
        });
      }

      try {
        await refreshPromise;
        return api(original);
      } catch {
        // Refresh failed — let the 401 propagate
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
