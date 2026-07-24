import { Router } from "express";
import { db } from "../db.js";

export const statsRouter = Router();

statsRouter.get("/pnl", (req, res) => {
  const jobs = db.prepare("SELECT * FROM jobs").all();
  const revenue = jobs.reduce((sum, j) => sum + j.price, 0);
  const cleanerPay = jobs.reduce((sum, j) => sum + j.cleanerPay, 0);
  const customers = db.prepare("SELECT COUNT(*) AS n FROM customers").get().n;

  const byServiceType = {};
  for (const j of jobs) {
    byServiceType[j.serviceType] = byServiceType[j.serviceType] || { count: 0, revenue: 0 };
    byServiceType[j.serviceType].count += 1;
    byServiceType[j.serviceType].revenue += j.price;
  }

  // Lead-source ROI is schema-supported (customers.leadSource / customers.zone) but not
  // wired to a marketing spend module yet — flagged in the handoff as a first-class need
  // once a Leads/Cities module exists.
  const byLeadSource = db
    .prepare(
      `SELECT COALESCE(c.leadSource, 'Unknown') AS leadSource, COUNT(DISTINCT c.id) AS customers
       FROM customers c GROUP BY leadSource`
    )
    .all();

  res.json({
    customers,
    jobs: jobs.length,
    revenue,
    cleanerPay,
    net: revenue - cleanerPay,
    byServiceType,
    byLeadSource,
  });
});
