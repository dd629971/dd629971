import { Router } from "express";
import { db } from "../db.js";
import { uid, nowISO, rowToQuote, rowToCustomer } from "../util.js";
import { basePriceFor, totalPriceFor } from "../services/pricing.js";

export const quotesRouter = Router();

quotesRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM quotes ORDER BY createdAt DESC").all();
  res.json(rows.map(rowToQuote));
});

quotesRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Quote not found" });
  res.json(rowToQuote(row));
});

// Start a new quote live, on the call. Finds an existing customer by phone or creates one.
quotesRouter.post("/", (req, res) => {
  const { name, phone, email, serviceType, sqft, address, leadSource, zone, serviceDate } = req.body;
  if (!name || !serviceType || !sqft) {
    return res.status(400).json({ error: "name, serviceType, and sqft are required" });
  }

  let customer = phone
    ? db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone)
    : null;

  if (!customer) {
    const customerId = uid("cus");
    db.prepare(
      `INSERT INTO customers (id, name, phone, email, type, leadSource, zone, createdAt)
       VALUES (?, ?, ?, ?, 'Prospect', ?, ?, ?)`
    ).run(customerId, name, phone || null, email || null, leadSource || null, zone || null, nowISO());
    customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
  }

  const basePrice = basePriceFor(serviceType, sqft);
  const price = totalPriceFor(basePrice, []);
  const id = uid("Q-SCC");
  const createdAt = nowISO();

  db.prepare(
    `INSERT INTO quotes (id, customerId, customerName, serviceType, sqft, address, lineItems, basePrice, price, status, cardOnFile, needsReconfirmation, serviceDate, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, 'draft', 0, 0, ?, ?)`
  ).run(id, customer.id, customer.name, serviceType, sqft, address || null, basePrice, price, serviceDate || null, createdAt);

  res.status(201).json({
    quote: rowToQuote(db.prepare("SELECT * FROM quotes WHERE id = ?").get(id)),
    customer: rowToCustomer(customer),
  });
});

function recalc(quote) {
  const lineItems = JSON.parse(quote.lineItems || "[]");
  const price = totalPriceFor(quote.basePrice, lineItems);
  return price;
}

// Add a live add-on line item (e.g. "windows are rough, add $10 each") and re-quote in real time.
quotesRouter.post("/:id/line-items", (req, res) => {
  const { label, amount } = req.body;
  if (!label || amount === undefined) return res.status(400).json({ error: "label and amount are required" });

  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ error: "Quote not found" });

  const lineItems = JSON.parse(quote.lineItems || "[]");
  lineItems.push({ label, amount: Number(amount) });
  const price = totalPriceFor(quote.basePrice, lineItems);

  db.prepare("UPDATE quotes SET lineItems = ?, price = ? WHERE id = ?").run(JSON.stringify(lineItems), price, req.params.id);
  res.json(rowToQuote(db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id)));
});

// Correct a mis-set service tier (e.g. left on "Standard" when it should've been "Deep clean"):
// recalculates price and flags the quote as needing customer reconfirmation before proceeding.
quotesRouter.post("/:id/correct-tier", (req, res) => {
  const { serviceType, sqft } = req.body;
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ error: "Quote not found" });

  const nextServiceType = serviceType || quote.serviceType;
  const nextSqft = sqft || quote.sqft;
  const basePrice = basePriceFor(nextServiceType, nextSqft);
  const lineItems = JSON.parse(quote.lineItems || "[]");
  const price = totalPriceFor(basePrice, lineItems);

  db.prepare(
    "UPDATE quotes SET serviceType = ?, sqft = ?, basePrice = ?, price = ?, needsReconfirmation = 1 WHERE id = ?"
  ).run(nextServiceType, nextSqft, basePrice, price, req.params.id);

  res.json(rowToQuote(db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id)));
});

// Customer reconfirms the corrected price on the call.
quotesRouter.post("/:id/reconfirm", (req, res) => {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  db.prepare("UPDATE quotes SET needsReconfirmation = 0 WHERE id = ?").run(req.params.id);
  res.json(rowToQuote(db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id)));
});

quotesRouter.patch("/:id", (req, res) => {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ error: "Quote not found" });

  const fields = ["status", "cardOnFile", "stripeSetupIntentId", "stripeCustomerId", "serviceDate", "address"];
  const next = { ...quote, ...Object.fromEntries(fields.filter((f) => f in req.body).map((f) => [f, req.body[f]])) };

  db.prepare(
    `UPDATE quotes SET status=?, cardOnFile=?, stripeSetupIntentId=?, stripeCustomerId=?, serviceDate=?, address=? WHERE id=?`
  ).run(
    next.status,
    next.cardOnFile ? 1 : 0,
    next.stripeSetupIntentId,
    next.stripeCustomerId,
    next.serviceDate,
    next.address,
    req.params.id
  );

  res.json(rowToQuote(db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id)));
});

// Quote saved/approved -> becomes a Job on the Board.
quotesRouter.post("/:id/approve", (req, res) => {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  if (quote.needsReconfirmation) {
    return res.status(409).json({ error: "Quote has an unconfirmed tier/price change — reconfirm with the customer first." });
  }

  const existingJob = db.prepare("SELECT * FROM jobs WHERE quoteId = ?").get(quote.id);
  if (existingJob) return res.status(409).json({ error: "Job already created for this quote" });

  db.prepare("UPDATE quotes SET status = 'approved' WHERE id = ?").run(quote.id);

  const jobId = uid("job");
  const createdAt = nowISO();
  const cleanerPay = Math.round(quote.price * 0.55);
  const timeline = [{ at: createdAt, event: "Job created from quote" }];

  db.prepare(
    `INSERT INTO jobs (id, quoteId, customerId, customerName, serviceType, address, price, cleanerPay, cardOnFile, serviceDate, stage, timeline, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?)`
  ).run(
    jobId,
    quote.id,
    quote.customerId,
    quote.customerName,
    quote.serviceType,
    quote.address,
    quote.price,
    cleanerPay,
    quote.cardOnFile,
    quote.serviceDate,
    JSON.stringify(timeline),
    createdAt
  );

  db.prepare("UPDATE customers SET type = 'Current Customer' WHERE id = ?").run(quote.customerId);

  res.status(201).json({ jobId });
});
