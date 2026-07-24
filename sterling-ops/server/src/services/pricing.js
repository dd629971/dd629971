// Placeholder pricing model carried over from ops_system_v1.jsx.
// Not verified against real business numbers — swap these constants once real pricing is set.
export const BASE_PRICE = { Standard: 150, "Deep clean": 240, "Move in/out": 280 };
export const SQFT_MULT = { "Under 1500": 1, "1500-2500": 1.25, "2500-3500": 1.55, "3500+": 1.9 };

export function basePriceFor(serviceType, sqft) {
  const base = BASE_PRICE[serviceType];
  const mult = SQFT_MULT[sqft];
  if (base === undefined) throw new Error(`Unknown serviceType: ${serviceType}`);
  if (mult === undefined) throw new Error(`Unknown sqft range: ${sqft}`);
  return Math.round(base * mult);
}

export function totalPriceFor(basePrice, lineItems) {
  const addOns = (lineItems || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return Math.round(basePrice + addOns);
}
