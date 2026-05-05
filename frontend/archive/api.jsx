// API client — all calls to the ArcHive backend.
// JWT is stored in localStorage under "archive_token".

const API_BASE = "http://localhost:8000";

async function request(method, path, { body, token, form } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.detail || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  if (res.status === 204) return null;
  return res.json();
}

window.API = {
  getToken: () => localStorage.getItem("archive_token"),
  setToken: (t) => t
    ? localStorage.setItem("archive_token", t)
    : localStorage.removeItem("archive_token"),

  async login(email, password) {
    const data = await request("POST", "/auth/login", { body: { email, password } });
    API.setToken(data.access_token);
    return data; // { access_token, token_type, user: { id, email, name, role } }
  },

  async me() {
    return request("GET", "/auth/me", { token: API.getToken() });
  },

  async getConfig() {
    return request("GET", "/config");
  },

  async getPipelines() {
    return request("GET", "/pipelines/", { token: API.getToken() });
  },

  async getPipelineGeojson(pipelineId) {
    return request("GET", `/pipelines/${pipelineId}/geojson`, { token: API.getToken() });
  },

  async getPipelinePins(pipelineId) {
    return request("GET", `/pipelines/${pipelineId}/pins`, { token: API.getToken() });
  },

  async createPin(pipelineId, { label, chainage_km, lat, lng }) {
    return request("POST", `/pipelines/${pipelineId}/pins`, {
      token: API.getToken(),
      body: { label, chainage_km, lat, lng },
    });
  },

  async getPinDocuments(pinId) {
    return request("GET", `/pins/${pinId}/documents`, { token: API.getToken() });
  },

  async uploadDocument(pinId, file) {
    const form = new FormData();
    form.append("file", file);
    return request("POST", `/pins/${pinId}/documents`, { token: API.getToken(), form });
  },

  async deletePin(pinId) {
    return request("DELETE", `/pins/${pinId}`, { token: API.getToken() });
  },

  async movePin(pinId, { lat, lng, label, chainage_km }) {
    return request("PATCH", `/pins/${pinId}`, {
      token: API.getToken(),
      body: { lat, lng, label, chainage_km },
    });
  },

  async downloadDocument(docId) {
    return request("GET", `/documents/${docId}/download`, { token: API.getToken() });
  },
};
