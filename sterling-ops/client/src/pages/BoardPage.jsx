import { useState } from "react";
import { MessageSquare, ClipboardList } from "lucide-react";
import { api } from "../api.js";
import { money, Modal } from "../components/ui.jsx";
import { STAGES } from "../constants.js";

export default function BoardPage({ jobs, cleaners, reloadJobs, showToast }) {
  const [assignJobId, setAssignJobId] = useState(null);
  const [briefJobId, setBriefJobId] = useState(null);

  async function handleAssign(jobId, cleanerId) {
    try {
      const result = await api.assignCleaner(jobId, cleanerId);
      await reloadJobs();
      setAssignJobId(null);
      showToast(
        result.smsMocked
          ? "Assigned — SMS not sent (Twilio not configured), brief logged to timeline"
          : "Dispatch SMS sent to cleaner"
      );
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function handleAdvance(job) {
    const idx = STAGES.indexOf(job.stage);
    const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
    try {
      await api.setJobStage(job.id, next);
      await reloadJobs();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  const assignJob = jobs.find((j) => j.id === assignJobId);
  const briefJob = jobs.find((j) => j.id === briefJobId);

  return (
    <div>
      <div className="board-cols">
        {STAGES.map((stage) => {
          const stageJobs = jobs.filter((j) => j.stage === stage);
          return (
            <div key={stage} className="board-col">
              <h3 className="board-col-title">
                {stage} · {stageJobs.length}
              </h3>
              {stageJobs.map((j) => {
                const cleaner = cleaners.find((c) => c.id === j.cleanerId);
                return (
                  <div key={j.id} className="job-card">
                    <div className="job-card-top">
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{j.customerName}</div>
                        <div className="muted-sm">
                          {j.serviceType} · {j.serviceDate || "no date"}
                        </div>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{money(j.price)}</span>
                    </div>
                    {j.cardOnFile && <div style={{ fontSize: 11, color: "#059669", marginTop: 4 }}>Card on file</div>}
                    <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                      {!j.cleanerId ? (
                        <button className="btn btn-dark btn-sm" onClick={() => setAssignJobId(j.id)}>
                          Assign cleaner
                        </button>
                      ) : (
                        <>
                          <span className="btn btn-outline btn-sm" style={{ cursor: "default" }}>{cleaner?.name || "Assigned"}</span>
                          <button className="btn btn-outline btn-sm" onClick={() => setBriefJobId(j.id)}>
                            <ClipboardList size={12} /> Brief
                          </button>
                        </>
                      )}
                      {stage !== "Completed" && (
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => handleAdvance(j)}>
                          Advance →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {stageJobs.length === 0 && <p className="muted-sm" style={{ padding: "16px 8px" }}>Nothing here</p>}
            </div>
          );
        })}
      </div>

      {assignJob && (
        <Modal title={`Assign cleaner — ${assignJob.customerName}`} onClose={() => setAssignJobId(null)}>
          {cleaners.map((c) => (
            <button
              key={c.id}
              disabled={c.blacklisted}
              onClick={() => handleAssign(assignJob.id, c.id)}
              className="cleaner-option"
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>
                  {c.name} {c.blacklisted && <span style={{ color: "#b91c1c", fontSize: 11 }}>(flagged)</span>}
                </div>
                <div className="muted-sm">{c.areas}</div>
              </div>
              <MessageSquare size={16} color="#9ca3af" />
            </button>
          ))}
          <p className="muted-sm" style={{ marginTop: 12 }}>
            Confirming here sends a dispatch SMS/brief and logs the assignment to the job timeline.
          </p>
        </Modal>
      )}

      {briefJob && (
        <Modal title="Cleaner brief" onClose={() => setBriefJobId(null)}>
          <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: 16, fontSize: 14, whiteSpace: "pre-wrap" }}>
            {briefJob.briefText || "No brief generated yet."}
          </div>
          <p className="muted-sm" style={{ marginTop: 12 }}>
            Cleaners never get a Sterling Ops login — this brief is the entire scope they receive, sent via SMS/text link.
          </p>
          <div style={{ marginTop: 16 }}>
            <h4 className="subtitle" style={{ fontSize: 11, textTransform: "uppercase", color: "#9ca3af" }}>Job timeline</h4>
            {briefJob.timeline.map((t, i) => (
              <div key={i} className="muted-sm">
                {new Date(t.at).toLocaleString()} — {t.event}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
