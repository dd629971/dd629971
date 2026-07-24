// Real Stripe wiring, gated on STRIPE_SECRET_KEY. Without a key configured, these
// functions return a clearly-marked mock result instead of silently pretending to work,
// so the UI/API caller can distinguish "not configured" from "succeeded."
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

let stripeClient = null;
async function getStripe() {
  if (!STRIPE_SECRET_KEY) return null;
  if (!stripeClient) {
    const { default: Stripe } = await import("stripe");
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export function stripeConfigured() {
  return Boolean(STRIPE_SECRET_KEY);
}

// Creates (or reuses) a Stripe Customer + SetupIntent so a card can be captured
// and saved on file live, on the call. Returns { mocked: true, ... } when no key is set.
export async function createSetupIntent({ customerName, email, existingStripeCustomerId }) {
  const stripe = await getStripe();
  if (!stripe) {
    return {
      mocked: true,
      clientSecret: null,
      stripeCustomerId: existingStripeCustomerId || null,
      setupIntentId: null,
      message: "STRIPE_SECRET_KEY not configured — card capture is stubbed.",
    };
  }

  const stripeCustomer = existingStripeCustomerId
    ? await stripe.customers.retrieve(existingStripeCustomerId)
    : await stripe.customers.create({ name: customerName, email: email || undefined });

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomer.id,
    payment_method_types: ["card"],
  });

  return {
    mocked: false,
    clientSecret: setupIntent.client_secret,
    stripeCustomerId: stripeCustomer.id,
    setupIntentId: setupIntent.id,
  };
}

export async function setupIntentSucceeded(setupIntentId) {
  const stripe = await getStripe();
  if (!stripe || !setupIntentId) return false;
  const intent = await stripe.setupIntents.retrieve(setupIntentId);
  return intent.status === "succeeded";
}
