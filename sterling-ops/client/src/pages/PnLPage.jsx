import { TrendingUp } from "lucide-react";
import { StatTile, money, Empty } from "../components/ui.jsx";

export default function PnLPage({ jobs, pnl }) {
  if (!pnl) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="grid-4col">
        <StatTile label="Revenue" value={money(pnl.revenue)} />
        <StatTile label="Cleaner payouts (est.)" value={money(pnl.cleanerPay)} />
        <StatTile label="Net" value={money(pnl.net)} highlight />
        <StatTile label="Jobs" value={pnl.jobs} />
      </div>
      <div className="card">
        <h3 className="subtitle">Job-level detail</h3>
        {jobs.length === 0 && <Empty text="No jobs yet — P&L populates as quotes get approved." />}
        {jobs.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Revenue</th>
                <th>Cleaner pay</th>
                <th>Margin</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 500 }}>{j.customerName}</td>
                  <td>{money(j.price)}</td>
                  <td>{money(j.cleanerPay)}</td>
                  <td style={{ fontWeight: 500, color: "#059669" }}>{money(j.price - j.cleanerPay)}</td>
                  <td>{j.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h3 className="subtitle">Leads by source</h3>
        <p className="muted-sm" style={{ marginBottom: 8 }}>
          Schema-supported (customer.leadSource / customer.zone) but not wired to a marketing spend module yet.
        </p>
        <table>
          <thead>
            <tr>
              <th>Lead source</th>
              <th># Customers</th>
            </tr>
          </thead>
          <tbody>
            {pnl.byLeadSource.map((row) => (
              <tr key={row.leadSource}>
                <td>{row.leadSource}</td>
                <td>{row.customers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
