import { useEffect, useState } from "react";
import { Phone, Plus, ArrowRight, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../api.js";
import { money, StatusPill, Field, Input, Select, ChecklistItem } from "../components/ui.jsx";
import { SERVICE_TYPES, SQFT_RANGES, todayISO } from "../constants.js";

export default function QuotePage({ quotes, activeQuote, setActiveQuoteId, reloadQuotes, reloadJobs, showToast, goToBoard, integrations }) {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "",
    serviceType: "Standard", sqft: "1500-2500", serviceDate: todayISO(),
  });
  const [addonLabel, setAddonLabel] = useState("");
  const [addonAmt, setAddonAmt] = useState("");
  const [correctingTier, setCorrectingTier] = useState(false);
  const [pendingTier, setPendingTier] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (activeQuote) setPendingTier(activeQuote.serviceType);
  }, [activeQuote?.id]);

  async function handleStartQuote() {
    if (!form.name) return;
    setBusy(true);
    try {
      const { quote } = await api.createQuote(form);
      await reloadQuotes();
      setActiveQuoteId(quote.id);
      showToast("Quote created — still on the call, keep going");
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLineItem() {
    if (!addonLabel || !addonAmt) return;
    try {
      await api.addLineItem(activeQuote.id, { label: addonLabel, amount: Number(addonAmt) });
      await reloadQuotes();
      setAddonLabel("");
      setAddonAmt("");
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function handleCorrectTier() {
    try {
      await api.correctTier(activeQuote.id, { serviceType: pendingTier });
      await reloadQuotes();
      setCorrectingTier(false);
      showToast("Tier corrected — customer must reconfirm before proceeding");
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function handleReconfirm() {
    try {
      await api.reconfirmQuote(activeQuote.id);
      await reloadQuotes();
      showToast("Customer reconfirmed the updated price");
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function handleCollectPayment() {
    try {
      const result = await api.createSetupIntent(activeQuote.id);
      if (result.mocked) {
        showToast("Stripe not configured — falling back to manual card-on-file note");
      } else {
        showToast("SetupIntent created — collect card details on the Stripe Elements form");
      }
      await api.updateQuote(activeQuote.id, { cardOnFile: true });
      await reloadQuotes();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function handleMarkCardFallback() {
    try {
      await api.markCardOnFile(activeQuote.id);
      await reloadQuotes();
      showToast("Marked card-on-file pending — go back in after the call to enter it for real");
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function handleApprove() {
    try {
      await api.approveQuote(activeQuote.id);
      showToast("Job created and pushed to the Board");
      setActiveQuoteId(null);
      await Promise.all([reloadQuotes(), reloadJobs()]);
      goToBoard();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  if (activeQuote) {
    return (
      <div className="grid-3">
        <div className="card">
          <div className="row-top" style={{ marginBottom: 4 }}>
            <h2 className="title">{activeQuote.customerName}</h2>
            <StatusPill status={activeQuote.status} />
          </div>
          <p className="muted" style={{ marginBottom: 20 }}>
            {activeQuote.id} · {activeQuote.address || "no address on file"}
          </p>

          <div className="grid-2col" style={{ marginBottom: 24 }}>
            <Field label="Service type" value={activeQuote.serviceType} />
            <Field label="Sq ft range" value={activeQuote.sqft} />
            <Field label="Service date" value={activeQuote.serviceDate} />
            <Field label="Base price" value={money(activeQuote.basePrice)} />
          </div>

          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16, marginBottom: 16 }}>
            <h3 className="subtitle">Live add-ons (upsell on-site)</h3>
            {activeQuote.lineItems.length === 0 && (
              <p className="muted" style={{ marginBottom: 8 }}>
                No add-ons yet — e.g. "windows rough, add $10 each"
              </p>
            )}
            {activeQuote.lineItems.map((li, i) => (
              <div key={i} className="row-top" style={{ padding: "4px 0", fontSize: 14 }}>
                <span>{li.label}</span>
                <span>{money(li.amount)}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                value={addonLabel}
                onChange={(e) => setAddonLabel(e.target.value)}
                placeholder='e.g. Windows x15 @ $10'
                className="text-input"
                style={{ flex: 1 }}
              />
              <input
                value={addonAmt}
                onChange={(e) => setAddonAmt(e.target.value)}
                placeholder="$"
                type="number"
                className="text-input"
                style={{ width: 90 }}
              />
              <button onClick={handleAddLineItem} className="btn btn-dark">
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16, marginBottom: 24 }}>
            <span className="field-label">Mis-quoted tier? Correct it before proceeding</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                aria-label="Correct service tier"
                value={pendingTier || activeQuote.serviceType}
                onChange={(e) => setPendingTier(e.target.value)}
                className="text-input"
                style={{ width: "auto" }}
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {pendingTier && pendingTier !== activeQuote.serviceType && (
                <button className="btn btn-outline btn-sm" onClick={handleCorrectTier}>
                  Apply correction
                </button>
              )}
            </div>
            <p className="warn-banner">
              <AlertCircle size={12} /> Changing this recalculates price and requires customer reconfirmation.
            </p>
            {activeQuote.needsReconfirmation && (
              <div style={{ marginTop: 8 }}>
                <span className="error-banner" style={{ display: "block", marginBottom: 8 }}>
                  Price changed to {money(activeQuote.price)} — customer must reconfirm before this can be approved.
                </span>
                <button className="btn btn-outline btn-sm" onClick={handleReconfirm}>
                  Customer reconfirmed on this call
                </button>
              </div>
            )}
          </div>

          <div className="row-top" style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16, alignItems: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>Total: {money(activeQuote.price)}</span>
            <div style={{ display: "flex", gap: 8 }}>
              {!activeQuote.cardOnFile ? (
                <>
                  <button onClick={handleCollectPayment} className="btn btn-primary">
                    <CreditCard size={15} /> Collect card & save on file
                  </button>
                  {!integrations?.stripe && (
                    <button onClick={handleMarkCardFallback} className="btn btn-outline btn-sm">
                      No time — mark pending
                    </button>
                  )}
                </>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#059669", fontSize: 14, fontWeight: 500 }}>
                  <CheckCircle2 size={15} /> Card on file
                </span>
              )}
              <button
                disabled={activeQuote.status === "approved" || activeQuote.needsReconfirmation}
                onClick={handleApprove}
                className="btn btn-success"
              >
                Approve → create job <ArrowRight size={15} />
              </button>
            </div>
          </div>
          {!integrations?.stripe && (
            <p className="integration-note">Stripe not configured (STRIPE_SECRET_KEY) — card capture is stubbed.</p>
          )}
        </div>

        <div className="card card-tight">
          <h3 className="subtitle">On-the-call checklist</h3>
          <ChecklistItem done>Answer call → open Quote page</ChecklistItem>
          <ChecklistItem done={!!activeQuote.address}>Ask qualification Qs (size, type, condition)</ChecklistItem>
          <ChecklistItem done>Quote price out loud, same call</ChecklistItem>
          <ChecklistItem done={activeQuote.cardOnFile}>Collect card, save on file</ChecklistItem>
          <ChecklistItem done={activeQuote.status === "approved"}>Approve → pushes to Board</ChecklistItem>
          <button onClick={() => setActiveQuoteId(null)} className="btn btn-ghost" style={{ marginTop: 12, padding: 0 }}>
            ← Start a different call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-3">
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Phone size={18} color="#3b6bff" />
          <h2 className="title" style={{ margin: 0 }}>New call — build the quote live</h2>
        </div>
        <p className="muted" style={{ marginBottom: 20 }}>Step 1–2 of the SOP: caller is on the line right now.</p>
        <div className="grid-2col">
          <Input label="Caller name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Input label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Select label="Service type" value={form.serviceType} options={SERVICE_TYPES} onChange={(v) => setForm({ ...form, serviceType: v })} />
          <Select label="Sq footage" value={form.sqft} options={SQFT_RANGES} onChange={(v) => setForm({ ...form, sqft: v })} />
          <Input label="Requested service date" type="date" value={form.serviceDate} onChange={(v) => setForm({ ...form, serviceDate: v })} />
        </div>
        <button onClick={handleStartQuote} disabled={!form.name || busy} className="btn btn-primary" style={{ marginTop: 24 }}>
          Generate live quote <ArrowRight size={15} />
        </button>
      </div>
      <div className="card card-tight">
        <h3 className="subtitle">Recent quotes</h3>
        {quotes.length === 0 && <p className="muted-sm">None yet.</p>}
        {quotes.slice(0, 5).map((q) => (
          <button key={q.id} onClick={() => setActiveQuoteId(q.id)} className="recent-quote-row">
            <div className="row-top">
              <span style={{ fontWeight: 500 }}>{q.customerName}</span>
              <StatusPill status={q.status} />
            </div>
            <span className="muted-sm">{q.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
