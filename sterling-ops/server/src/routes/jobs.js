import { Router } from "express";
import { db } from "../db.js";
import { nowISO, rowToJob, rowToCleaner } from "../util.js";
import { sendSms, buildCleanerBrief, smsConfigured } from "../services/sms.js";

export const jobsRouter = Router();

jobsRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM jobs ORDER BY createdAt DESC").all();
  res.json(rows.map(rowToJob));
});

jobsRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Job not found" });
  res.json(rowToJob(row));
});

function appendTimeline(jobId, event) {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
  const timeline = JSON.parse(job.timeline || "[]");
  timeline.push({ at: nowISO(), event });
  db.prepare("UPDATE jobs SET timeline = ? WHERE id = ?").run(JSON.stringify(timeline), jobId);
}

jobsRouter.patch("/:id/stage", (req, res) => {
  const { stage } = req.body;
  const valid = ["Scheduled", "In Progress", "Completed"];
  if (!valid.includes(stage)) return res.status(400).json({ error: `stage must be one of ${valid.join(", ")}` });

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  db.prepare("UPDATE jobs SET stage = ? WHERE id = ?").run(stage, req.params.id);
  appendTimeline(req.params.id, `Stage changed: ${job.stage} -> ${stage}`);

  res.json(rowToJob(db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id)));
});

// Assign a cleaner, generate the Cleaner Brief, and dispatch it via SMS/text link.
// Cleaners never get logins — the brief is the entire interface they get.
jobsRouter.post("/:id/assign", async (req, res) => {
  const { cleanerId } = req.body;
  if (!cleanerId) return res.status(400).json({ error: "cleanerId is required" });

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const cleaner = db.prepare("SELECT * FROM cleaners WHERE id = ?").get(cleanerId);
  if (!cleaner) return res.status(404).json({ error: "Cleaner not found" });
  if (cleaner.blacklisted) return res.status(409).json({ error: "This cleaner is flagged and cannot be assigned" });

  const briefText = buildCleanerBrief({ job, cleaner, customerAddress: job.address });
  const smsResult = await sendSms({ to: cleaner.phone, body: briefText });

  db.prepare(
    "UPDATE jobs SET cleanerId = ?, briefText = ?, briefSentAt = ? WHERE id = ?"
  ).run(cleanerId, briefText, nowISO(), req.params.id);
  appendTimeline(req.params.id, `Assigned to ${cleaner.name}${smsResult.mocked ? " (brief logged, SMS not sent — TWILIO not configured)" : " (brief sent via SMS)"}`);

  res.json({
    job: rowToJob(db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id)),
    smsMocked: smsResult.mocked,
    smsConfigured: smsConfigured(),
  });
});

export const cleanersRouter = Router();

cleanersRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM cleaners ORDER BY name ASC").all();
  res.json(rows.map(rowToCleaner));
});

cleanersRouter.post("/", (req, res) => {
  const { id, name, phone, areas } = req.body;
  if (!id || !name) return res.status(400).json({ error: "id and name are required" });
  db.prepare("INSERT INTO cleaners (id, name, phone, areas, blacklisted) VALUES (?, ?, ?, ?, 0)").run(
    id, name, phone || null, areas || null
  );
  res.status(201).json(rowToCleaner(db.prepare("SELECT * FROM cleaners WHERE id = ?").get(id)));
});

// Reliability flag: mark a cleaner blacklisted (no-shows, misrepresenting job conditions).
cleanersRouter.patch("/:id/reliability", (req, res) => {
  const { blacklisted, reliabilityNotes } = req.body;
  const cleaner = db.prepare("SELECT * FROM cleaners WHERE id = ?").get(req.params.id);
  if (!cleaner) return res.status(404).json({ error: "Cleaner not found" });

  db.prepare("UPDATE cleaners SET blacklisted = ?, reliabilityNotes = ? WHERE id = ?").run(
    blacklisted ? 1 : 0,
    reliabilityNotes !== undefined ? reliabilityNotes : cleaner.reliabilityNotes,
    req.params.id
  );
  res.json(rowToCleaner(db.prepare("SELECT * FROM cleaners WHERE id = ?").get(req.params.id)));
});
