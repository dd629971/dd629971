const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  health: () => request("/health"),

  listCustomers: () => request("/customers"),

  listQuotes: () => request("/quotes"),
  createQuote: (body) => request("/quotes", { method: "POST", body: JSON.stringify(body) }),
  addLineItem: (quoteId, body) =>
    request(`/quotes/${quoteId}/line-items`, { method: "POST", body: JSON.stringify(body) }),
  correctTier: (quoteId, body) =>
    request(`/quotes/${quoteId}/correct-tier`, { method: "POST", body: JSON.stringify(body) }),
  reconfirmQuote: (quoteId) => request(`/quotes/${quoteId}/reconfirm`, { method: "POST" }),
  updateQuote: (quoteId, body) => request(`/quotes/${quoteId}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveQuote: (quoteId) => request(`/quotes/${quoteId}/approve`, { method: "POST" }),

  listJobs: () => request("/jobs"),
  setJobStage: (jobId, stage) => request(`/jobs/${jobId}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
  assignCleaner: (jobId, cleanerId) =>
    request(`/jobs/${jobId}/assign`, { method: "POST", body: JSON.stringify({ cleanerId }) }),

  listCleaners: () => request("/cleaners"),

  createSetupIntent: (quoteId) =>
    request("/payments/setup-intent", { method: "POST", body: JSON.stringify({ quoteId }) }),
  markCardOnFile: (quoteId) =>
    request("/payments/mark-card-on-file", { method: "POST", body: JSON.stringify({ quoteId }) }),

  pnl: () => request("/stats/pnl"),
};
