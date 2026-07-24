import { Router } from "express";
import { db } from "../db.js";
import { createSetupIntent, stripeConfigured } from "../services/stripe.js";

export const paymentsRouter = Router();

// Capture card info live, on the call, and save it on file.
paymentsRouter.post("/setup-intent", async (req, res) => {
  const { quoteId } = req.body;
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId);
  if (!quote) return res.status(404).json({ error: "Quote not found" });

  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(quote.customerId);
  const result = await createSetupIntent({
    customerName: customer.name,
    email: customer.email,
    existingStripeCustomerId: quote.stripeCustomerId,
  });

  db.prepare("UPDATE quotes SET stripeSetupIntentId = ?, stripeCustomerId = ? WHERE id = ?").run(
    result.setupIntentId,
    result.stripeCustomerId,
    quoteId
  );

  res.json({ ...result, configured: stripeConfigured() });
});

// Fallback path: operator didn't have time to enter the card mid-call. Mark the quote as
// pending card entry (rely on the call recording) so it surfaces for follow-up afterward.
paymentsRouter.post("/mark-card-on-file", (req, res) => {
  const { quoteId } = req.body;
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(quoteId);
  if (!quote) return res.status(404).json({ error: "Quote not found" });

  db.prepare("UPDATE quotes SET cardOnFile = 1 WHERE id = ?").run(quoteId);
  res.json({ ok: true });
});
