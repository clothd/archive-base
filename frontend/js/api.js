// Centralized API layer — all fetch() calls go through here
const API_BASE = "http://localhost:8000";

function getToken() {
  return localStorage.getItem("archive_token");
}

function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeader(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("archive_token");
    localStorage.removeItem("archive_user");
    window.location.href = "/index.html";
    return;
  }
  return res;
}

async function apiJSON(path, options = {}) {
  const res = await apiFetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// Auth
async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

async function getMe() {
  return apiJSON("/auth/me");
}

// Pipelines
async function getPipelineGeoJSON(pipelineId) {
  return apiJSON(`/pipelines/${pipelineId}/geojson`);
}

async function getPipelinePins(pipelineId) {
  return apiJSON(`/pipelines/${pipelineId}/pins`);
}

// Documents
async function getDocuments(pinId) {
  return apiJSON(`/pins/${pinId}/documents`);
}

async function uploadDocument(pinId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`/pins/${pinId}/documents`, {
    method: "POST",
    body: formData,
  });
  if (!res || !res.ok) {
    const err = await res?.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err?.detail || "Upload failed");
  }
  return res.json();
}

async function getDownloadUrl(documentId) {
  return apiJSON(`/documents/${documentId}/download`);
}

async function createPin(pipelineId, label, chainageKm, lat, lng) {
  return apiJSON(`/pipelines/${pipelineId}/pins`, {
    method: "POST",
    body: JSON.stringify({ label, chainage_km: chainageKm, lat, lng }),
  });
}

async function deletePin(pinId) {
  const res = await apiFetch(`/pins/${pinId}`, { method: "DELETE" });
  if (!res || !res.ok) {
    const err = await res?.json().catch(() => ({ detail: "Delete failed" }));
    throw new Error(err?.detail || "Delete failed");
  }
}

async function movePin(pinId, lat, lng) {
  return apiJSON(`/pins/${pinId}`, {
    method: "PATCH",
    body: JSON.stringify({ lat, lng }),
  });
}
