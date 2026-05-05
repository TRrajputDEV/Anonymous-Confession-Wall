import axios from "axios";

// In production on Render, VITE_API_URL MUST be set to the backend URL
// (e.g. https://anonymous-confession-wall-7x6t.onrender.com) because the
// frontend and backend are on different domains.
//
// Leaving it empty only works when a reverse proxy (nginx/Vite dev server)
// forwards /api to the backend on the same origin — which is NOT the case
// on Render where frontend and backend are separate services.
//
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  withCredentials: true, // send session cookie on every request
});

// Auth
export const fetchUser = () => api.get("/api/auth/me");
export const logoutUser = () => api.post("/api/auth/logout");

// Confessions
export const getConfessions = (params) =>
  api.get("/api/confessions", { params });
export const createConfession = (data) => api.post("/api/confessions", data);
export const updateConfession = (id, data) =>
  api.put(`/api/confessions/${id}`, data);
export const deleteConfession = (id, secretCode) =>
  api.delete(`/api/confessions/${id}`, { data: { secretCode } });
export const reactConfession = (id, type) =>
  api.post(`/api/confessions/${id}/react`, { type });

// Tags
export const getPredefinedTags = () =>
  api.get("/api/confessions/tags/predefined");

// User Profile & Personal Logs
export const getMyProfile = () => api.get("/api/users/me");
export const getMyConfessions = (params) =>
  api.get("/api/users/me/confessions", { params });

// Comments
export const getComments = (confessionId) =>
  api.get(`/api/confessions/${confessionId}/comments`);
export const addComment = (confessionId, data) =>
  api.post(`/api/confessions/${confessionId}/comments`, data);
export const updateComment = (confessionId, commentId, data) =>
  api.put(`/api/confessions/${confessionId}/comments/${commentId}`, data);
export const deleteComment = (confessionId, commentId) =>
  api.delete(`/api/confessions/${confessionId}/comments/${commentId}`);