export const SERVICE_TYPES = ["Standard", "Deep clean", "Move in/out"];
export const SQFT_RANGES = ["Under 1500", "1500-2500", "2500-3500", "3500+"];
export const STAGES = ["Scheduled", "In Progress", "Completed"];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
