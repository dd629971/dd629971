import { Router } from "express";
import { db } from "../db.js";
import { uid, nowISO, rowToCustomer } from "../util.js";

export const customersRouter = Router();

customersRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM customers ORDER BY createdAt DESC").all();
  res.json(rows.map(rowToCustomer));
});

customersRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Customer not found" });
  res.json(rowToCustomer(row));
});

customersRouter.post("/", (req, res) => {
  const { name, phone, email, leadSource, zone } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const id = uid("cus");
  const createdAt = nowISO();
  db.prepare(
    `INSERT INTO customers (id, name, phone, email, type, leadSource, zone, createdAt)
     VALUES (?, ?, ?, ?, 'Prospect', ?, ?, ?)`
  ).run(id, name, phone || null, email || null, leadSource || null, zone || null, createdAt);

  res.status(201).json(rowToCustomer(db.prepare("SELECT * FROM customers WHERE id = ?").get(id)));
});

customersRouter.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Customer not found" });

  const fields = ["name", "phone", "email", "type", "leadSource", "zone", "recordingUrl", "transcript"];
  const next = { ...existing, ...Object.fromEntries(fields.filter((f) => f in req.body).map((f) => [f, req.body[f]])) };

  db.prepare(
    `UPDATE customers SET name=?, phone=?, email=?, type=?, leadSource=?, zone=?, recordingUrl=?, transcript=? WHERE id=?`
  ).run(next.name, next.phone, next.email, next.type, next.leadSource, next.zone, next.recordingUrl, next.transcript, req.params.id);

  res.json(rowToCustomer(db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id)));
});
