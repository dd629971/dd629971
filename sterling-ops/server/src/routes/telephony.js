import { Router } from "express";
import { db } from "../db.js";
import { rowToCustomer } from "../util.js";

export const telephonyRouter = Router();

// Webhook receiver shaped for an OpenPhone/Twilio-style "call recording + transcription
// complete" callback. Matches the caller to a customer by phone and auto-attaches the
// recording URL + transcript to that customer's record (the accountability layer for
// cleaner/customer disputes). Not wired to a live telephony provider yet — call this
// manually or point a real provider's webhook at it once one is configured.
telephonyRouter.post("/webhook", (req, res) => {
  const { fromNumber, recordingUrl, transcript } = req.body;
  if (!fromNumber) return res.status(400).json({ error: "fromNumber is required" });

  const customer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(fromNumber);
  if (!customer) {
    return res.status(404).json({ error: "No customer found for this number", fromNumber });
  }

  db.prepare("UPDATE customers SET recordingUrl = ?, transcript = ? WHERE id = ?").run(
    recordingUrl || customer.recordingUrl,
    transcript || customer.transcript,
    customer.id
  );

  res.json(rowToCustomer(db.prepare("SELECT * FROM customers WHERE id = ?").get(customer.id)));
});

telephonyRouter.get("/configured", (req, res) => {
  res.json({ configured: Boolean(process.env.OPENPHONE_API_KEY || process.env.TWILIO_ACCOUNT_SID) });
});
