export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function rowToCustomer(row) {
  if (!row) return null;
  return { ...row, type: row.type };
}

export function rowToQuote(row) {
  if (!row) return null;
  return {
    ...row,
    lineItems: JSON.parse(row.lineItems || "[]"),
    cardOnFile: Boolean(row.cardOnFile),
    needsReconfirmation: Boolean(row.needsReconfirmation),
  };
}

export function rowToJob(row) {
  if (!row) return null;
  return {
    ...row,
    cardOnFile: Boolean(row.cardOnFile),
    timeline: JSON.parse(row.timeline || "[]"),
  };
}

export function rowToCleaner(row) {
  if (!row) return null;
  return { ...row, blacklisted: Boolean(row.blacklisted) };
}
