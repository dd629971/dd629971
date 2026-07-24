import { useCallback, useEffect, useState } from "react";
import { Phone, FileText, Users, KanbanSquare, DollarSign } from "lucide-react";
import { api } from "./api.js";
import { Toast } from "./components/ui.jsx";
import QuotePage from "./pages/QuotePage.jsx";
import QuotesPage from "./pages/QuotesPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import BoardPage from "./pages/BoardPage.jsx";
import PnLPage from "./pages/PnLPage.jsx";

const NAV_ITEMS = [
  { id: "quote", label: "Quote", icon: Phone },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "customers", label: "Customers", icon: Users },
  { id: "board", label: "Board", icon: KanbanSquare },
  { id: "pl", label: "P&L", icon: DollarSign },
];
const STUB_ITEMS = ["Calendar", "Leads", "Cities", "Pay", "Recurring", "Backup", "Settings"];

export default function App() {
  const [tab, setTab] = useState("quote");
  const [customers, setCustomers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [pnl, setPnl] = useState(null);
  const [activeQuoteId, setActiveQuoteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [integrations, setIntegrations] = useState({});

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const reloadCustomers = useCallback(() => api.listCustomers().then(setCustomers), []);
  const reloadQuotes = useCallback(() => api.listQuotes().then(setQuotes), []);
  const reloadJobs = useCallback(() => api.listJobs().then(setJobs), []);
  const reloadCleaners = useCallback(() => api.listCleaners().then(setCleaners), []);
  const reloadPnl = useCallback(() => api.pnl().then(setPnl), []);

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadCustomers(), reloadQuotes(), reloadJobs(), reloadCleaners(), reloadPnl()]);
  }, [reloadCustomers, reloadQuotes, reloadJobs, reloadCleaners, reloadPnl]);

  useEffect(() => {
    api.health().then((h) => setIntegrations(h.integrations)).catch(() => {});
    reloadAll().catch((err) => showToast(err.message, true));
  }, [reloadAll, showToast]);

  // Keep dependent views fresh whenever quotes/jobs mutate elsewhere.
  useEffect(() => {
    reloadPnl().catch(() => {});
  }, [jobs, reloadPnl]);

  const activeQuote = quotes.find((q) => q.id === activeQuoteId) || null;

  const wrappedShowToast = (message, isError) => showToast(message, isError);
  const wrappedReloadQuotes = async () => {
    await reloadQuotes();
    await reloadCustomers();
  };
  const wrappedReloadJobs = async () => {
    await reloadJobs();
  };

  return (
    <div className="app-shell">
      <div className="topnav">
        <div className="topnav-inner">
          <div className="brand">
            <span className="brand-badge">S</span>
            STERLING OPS <span className="brand-sub">v1 build</span>
          </div>
          <div className="nav-items">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`nav-btn${tab === item.id ? " active" : ""}`}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
            {STUB_ITEMS.map((s) => (
              <span key={s} className="nav-stub" title="Not built in v1">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="page">
        {tab === "quote" && (
          <QuotePage
            quotes={quotes}
            activeQuote={activeQuote}
            setActiveQuoteId={setActiveQuoteId}
            reloadQuotes={wrappedReloadQuotes}
            reloadJobs={wrappedReloadJobs}
            showToast={wrappedShowToast}
            goToBoard={() => setTab("board")}
            integrations={integrations}
          />
        )}
        {tab === "quotes" && (
          <QuotesPage quotes={quotes} setActiveQuoteId={setActiveQuoteId} goToQuote={() => setTab("quote")} />
        )}
        {tab === "customers" && <CustomersPage customers={customers} quotes={quotes} jobs={jobs} />}
        {tab === "board" && (
          <BoardPage jobs={jobs} cleaners={cleaners} reloadJobs={wrappedReloadJobs} showToast={wrappedShowToast} />
        )}
        {tab === "pl" && <PnLPage jobs={jobs} pnl={pnl} />}
      </div>

      {toast && <Toast message={toast.message} error={toast.isError} />}
    </div>
  );
}
