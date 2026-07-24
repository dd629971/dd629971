import { X, CheckCircle2 } from "lucide-react";

export function money(n) {
  return `$${Number(n || 0).toFixed(0)}`;
}

export function StatusPill({ status }) {
  return <span className={`pill pill-${status}`}>{status}</span>;
}

export function TypePill({ type }) {
  const cls = type === "Current Customer" ? "pill-current" : "pill-prospect";
  return <span className={`pill ${cls}`}>{type}</span>;
}

export function StatTile({ label, value, highlight }) {
  return (
    <div className={`stat-tile${highlight ? " highlight" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function Field({ label, value }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="field-value">{value || "—"}</div>
    </div>
  );
}

export function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="input-label">
      <span className="field-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-input"
      />
    </label>
  );
}

export function Select({ label, value, options, onChange }) {
  return (
    <label className="input-label">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="text-input">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Empty({ text }) {
  return <p className="muted">{text}</p>;
}

export function ChecklistItem({ done, children }) {
  return (
    <div className={`checklist-item${done ? " done" : ""}`}>
      <span className="checklist-dot" />
      {children}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message, error }) {
  if (!message) return null;
  return (
    <div className={`toast${error ? " error" : ""}`}>
      <CheckCircle2 size={16} />
      {message}
    </div>
  );
}
