import { Router } from "express";
import { db } from "../db.js";
import { uid, nowISO } from "../util.js";

export const decisionsRouter = Router();

// Lightweight "decisions log" audit trail (what was decided, what area of the business,
// status, date) — a simple internal table instead of full Notion integration.
decisionsRouter.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM decisions ORDER BY date DESC").all());
});

decisionsRouter.post("/", (req, res) => {
  const { area, decision, status } = req.body;
  if (!area || !decision) return res.status(400).json({ error: "area and decision are required" });

  const id = uid("dec");
  db.prepare("INSERT INTO decisions (id, area, decision, status, date) VALUES (?, ?, ?, ?, ?)").run(
    id, area, decision, status || "active", nowISO()
  );
  res.status(201).json(db.prepare("SELECT * FROM decisions WHERE id = ?").get(id));
});
