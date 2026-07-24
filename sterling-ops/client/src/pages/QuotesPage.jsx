import { CreditCard } from "lucide-react";
import { money, StatusPill, Empty } from "../components/ui.jsx";

export default function QuotesPage({ quotes, setActiveQuoteId, goToQuote }) {
  return (
    <div className="card">
      <h2 className="title" style={{ marginBottom: 16 }}>All quotes</h2>
      {quotes.length === 0 && <Empty text="No quotes yet — start one from the Quote tab while a caller is live." />}
      <div>
        {quotes.map((q) => (
          <div
            key={q.id}
            onClick={() => {
              setActiveQuoteId(q.id);
              goToQuote();
            }}
            className="job-card-top"
            style={{ border: "1px solid #f3f4f6", borderRadius: 8, padding: "12px 16px", marginBottom: 8, cursor: "pointer" }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {q.customerName} <span className="muted-sm">· {q.id}</span>
              </div>
              <div className="muted-sm">{q.serviceType} · {q.serviceDate || "no date"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {q.cardOnFile && (
                <span style={{ fontSize: 12, color: "#059669", display: "flex", alignItems: "center", gap: 4 }}>
                  <CreditCard size={12} /> Card on file
                </span>
              )}
              <span style={{ fontWeight: 600, fontSize: 14 }}>{money(q.price)}</span>
              <StatusPill status={q.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
