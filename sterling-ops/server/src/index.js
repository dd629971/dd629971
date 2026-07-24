import express from "express";
import cors from "cors";
import "./db.js";
import { customersRouter } from "./routes/customers.js";
import { quotesRouter } from "./routes/quotes.js";
import { jobsRouter, cleanersRouter } from "./routes/jobs.js";
import { paymentsRouter } from "./routes/payments.js";
import { telephonyRouter } from "./routes/telephony.js";
import { decisionsRouter } from "./routes/decisions.js";
import { statsRouter } from "./routes/stats.js";
import { stripeConfigured } from "./services/stripe.js";
import { smsConfigured } from "./services/sms.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    integrations: {
      stripe: stripeConfigured(),
      sms: smsConfigured(),
      telephony: Boolean(process.env.OPENPHONE_API_KEY || process.env.TWILIO_ACCOUNT_SID),
    },
  });
});

app.use("/api/customers", customersRouter);
app.use("/api/quotes", quotesRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/cleaners", cleanersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/telephony", telephonyRouter);
app.use("/api/decisions", decisionsRouter);
app.use("/api/stats", statsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Sterling Ops API listening on :${PORT}`);
});
