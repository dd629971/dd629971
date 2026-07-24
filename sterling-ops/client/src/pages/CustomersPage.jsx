import { StatTile, TypePill, Empty } from "../components/ui.jsx";
import { money } from "../components/ui.jsx";

export default function CustomersPage({ customers, quotes, jobs }) {
  return (
    <div className="card">
      <div className="grid-3col" style={{ marginBottom: 24 }}>
        <StatTile label="Customers" value={customers.length} />
        <StatTile label="Jobs" value={jobs.length} />
        <StatTile label="Revenue" value={money(jobs.reduce((s, j) => s + j.price, 0))} />
      </div>
      {customers.length === 0 && (
        <Empty text="No customers yet — they're created automatically the first time you build a quote for them." />
      )}
      {customers.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Phone</th>
              <th>Created</th>
              <th># Quotes</th>
              <th>Call recording</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td>
                  <TypePill type={c.type} />
                </td>
                <td className="muted">{c.phone || "—"}</td>
                <td className="muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td>{quotes.filter((q) => q.customerId === c.id).length}</td>
                <td>
                  {c.recordingUrl ? (
                    <a href={c.recordingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      Recording + transcript
                    </a>
                  ) : (
                    <span className="muted-sm">none attached</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
