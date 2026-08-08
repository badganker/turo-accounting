let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  authStatus: () => request("/auth/status"),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (email, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),

  listTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transactions${qs ? `?${qs}` : ""}`);
  },
  createTransaction: (data) =>
    request("/transactions", { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (id, data) =>
    request(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),

  summary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/summary${qs ? `?${qs}` : ""}`);
  },

  uploadReceipt: (file) => {
    const form = new FormData();
    form.append("receipt", file);
    return request("/receipts/upload", { method: "POST", body: form });
  },
  confirmReceipt: (data) =>
    request("/receipts/confirm", { method: "POST", body: JSON.stringify(data) }),

  turoStatus: () => request("/turo/status"),
  turoSync: (years) => request("/turo/sync", { method: "POST", body: JSON.stringify({ years }) }),
};
