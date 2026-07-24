// Real Twilio wiring, gated on TWILIO_* env vars. Without them configured, sends are
// logged and returned as { mocked: true } instead of silently no-oping, so callers/UI
// can surface "not actually sent" rather than falsely claiming success.
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

let twilioClient = null;
async function getTwilio() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) return null;
  if (!twilioClient) {
    const { default: twilio } = await import("twilio");
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

export function smsConfigured() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
}

export async function sendSms({ to, body }) {
  const client = await getTwilio();
  if (!client) {
    console.log(`[sms mock] to=${to} body=${body}`);
    return { mocked: true, sid: null };
  }
  const message = await client.messages.create({ to, from: TWILIO_FROM_NUMBER, body });
  return { mocked: false, sid: message.sid };
}

export function buildCleanerBrief({ job, cleaner, customerAddress }) {
  const lines = [
    `New job: ${job.customerName}`,
    `Service: ${job.serviceType}`,
    `Address: ${customerAddress || "TBD"}`,
    `Date: ${job.serviceDate || "TBD"}`,
    `Cleaner pay: $${Number(job.cleanerPay).toFixed(0)}`,
    "",
    "Reply CONFIRM to accept this job.",
  ];
  return lines.join("\n");
}
