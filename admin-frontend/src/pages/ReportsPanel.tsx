import React, { useEffect, useMemo, useState } from "react";
import { api, type AdminModerationAction, type AdminReport } from "../api";

function snapshotSummary(report: AdminReport) {
  const snapshot = report.snapshot as Record<string, any>;
  const message = snapshot.message;
  const channel = snapshot.channel;
  const user = snapshot.user;
  if (message) return `${message.senderNickname || message.sender?.nickname || "Użytkownik"}: ${message.text || ""}`;
  if (channel) return `#${channel.slug || channel.name}: ${channel.topic || "bez opisu"}`;
  if (user) return `@${user.nickname}`;
  return report.targetId;
}

function statusBadge(status: AdminReport["status"]) {
  if (status === "OPEN") return <span className="admin-badge admin-badge-red">Otwarte</span>;
  if (status === "REVIEWING") return <span className="admin-badge admin-badge-amber">W trakcie</span>;
  if (status === "RESOLVED") return <span className="admin-badge admin-badge-green">Rozwiązane</span>;
  return <span className="admin-badge admin-badge-neutral">Odrzucone</span>;
}

function targetLabel(type: AdminReport["targetType"]) {
  const labels: Record<AdminReport["targetType"], string> = {
    CHANNEL: "Pokój",
    CHANNEL_MESSAGE: "Wiadomość w pokoju",
    DIRECT_MESSAGE: "Wiadomość prywatna",
    USER: "Profil"
  };
  return labels[type];
}

function reasonLabel(reason: AdminReport["reason"]) {
  const labels: Record<AdminReport["reason"], string> = {
    SPAM: "Spam",
    HARASSMENT: "Nękanie",
    HATE: "Mowa nienawiści",
    SEXUAL: "Treść seksualna",
    VIOLENCE: "Przemoc",
    IMPERSONATION: "Podszywanie się",
    ILLEGAL: "Treść nielegalna",
    OTHER: "Inne"
  };
  return labels[reason];
}

function ReviewCard({
  report,
  onDone,
  onError
}: {
  report: AdminReport;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [action, setAction] = useState<"NONE" | "DELETE_CONTENT" | "SUSPEND_USER" | "ARCHIVE_ROOM">("NONE");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(status: "RESOLVED" | "DISMISSED") {
    if (status === "RESOLVED" && action !== "NONE" && !window.confirm("Ta decyzja wykona dodatkową akcję moderacyjną. Kontynuować?")) return;
    setBusy(true);
    try {
      await api.reviewReport(report.id, {
        status,
        action: status === "DISMISSED" ? "NONE" : action,
        resolutionNote: note.trim() || undefined
      });
      await onDone();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Nie udało się zapisać decyzji moderacyjnej.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="admin-report-card">
      <div className="admin-report-top">
        <div>
          <div className="admin-report-meta">
            {statusBadge(report.status)}
            <span className="admin-badge admin-badge-blue">{targetLabel(report.targetType)}</span>
            <span className="admin-badge admin-badge-neutral">{reasonLabel(report.reason)}</span>
          </div>
          <p className="admin-report-copy"><span className="admin-primary-text">{snapshotSummary(report)}</span><br/>{report.details || "Brak dodatkowego opisu od zgłaszającego."}</p>
          <span className="admin-secondary-text">{new Date(report.createdAt).toLocaleString("pl-PL")} • reporter: {report.reporterUserId || report.reporterClientId || "nieznany"}</span>
        </div>
      </div>

      <details>
        <summary className="admin-secondary-text" style={{ cursor: "pointer", marginTop: 10 }}>Pokaż chroniony snapshot</summary>
        <pre className="admin-snapshot">{JSON.stringify(report.snapshot, null, 2)}</pre>
      </details>

      {report.status !== "RESOLVED" && report.status !== "DISMISSED" && (
        <div className="admin-report-actions">
          <select className="admin-select" value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
            <option value="NONE">Bez dodatkowej akcji</option>
            <option value="DELETE_CONTENT">Usuń zgłoszoną treść</option>
            <option value="SUSPEND_USER">Zawieś konto</option>
            <option value="ARCHIVE_ROOM">Archiwizuj pokój</option>
          </select>
          <input className="admin-field" value={note} maxLength={1000} placeholder="Notatka moderacyjna" onChange={(event) => setNote(event.target.value)}/>
          <button className="admin-button" type="button" disabled={busy} onClick={() => void submit("RESOLVED")}>{busy ? "Zapisywanie…" : "Rozwiąż"}</button>
          <button className="admin-button admin-button-quiet" type="button" disabled={busy} onClick={() => void submit("DISMISSED")}>Odrzuć</button>
        </div>
      )}
    </article>
  );
}

export default function ReportsPanel() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [actions, setActions] = useState<AdminModerationAction[]>([]);
  const [filter, setFilter] = useState<"ALL" | AdminReport["status"]>("OPEN");
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function refresh() {
    setBusy(true);
    try {
      const [reportResult, actionResult] = await Promise.all([
        api.reports(filter === "ALL" ? undefined : filter),
        api.moderationActions()
      ]);
      setReports(reportResult.reports);
      setActions(actionResult.actions);
      setError(null);
      setLastUpdated(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się pobrać danych moderacyjnych.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [filter]);

  const actionCounts = useMemo(() => {
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    return actions.filter((action) => new Date(action.createdAt).getTime() >= last24Hours).length;
  }, [actions]);

  return (
    <div className="admin-page">
      <div className="admin-page-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="Widok moderacji">
          <button className={`admin-tab ${tab === "queue" ? "is-active" : ""}`} type="button" role="tab" aria-selected={tab === "queue"} onClick={() => setTab("queue")}>Kolejka zgłoszeń</button>
          <button className={`admin-tab ${tab === "history" ? "is-active" : ""}`} type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>Historia moderacji</button>
        </div>
        <div className="admin-actions">
          {tab === "queue" && (
            <select className="admin-select" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="OPEN">Otwarte</option>
              <option value="REVIEWING">W trakcie</option>
              <option value="RESOLVED">Rozwiązane</option>
              <option value="DISMISSED">Odrzucone</option>
              <option value="ALL">Wszystkie</option>
            </select>
          )}
          <button className="admin-button admin-button-quiet" type="button" onClick={() => void refresh()} disabled={busy}>{busy ? <><span className="admin-spinner"/>Odświeżanie</> : "Odśwież"}</button>
        </div>
      </div>

      {error && <div className="admin-notice admin-notice-error" role="alert">{error}</div>}

      {tab === "queue" ? (
        <section className="admin-card">
          <div className="admin-card-header">
            <div><h2 className="admin-card-title">Kolejka zgłoszeń</h2><span className="admin-card-subtitle">Ostatnia aktualizacja: {lastUpdated ? lastUpdated.toLocaleTimeString("pl-PL") : "—"}</span></div>
            <span className={`admin-badge ${reports.length ? "admin-badge-red" : "admin-badge-green"}`}>{reports.length} w widoku</span>
          </div>
          <div className="admin-card-body">
            <div className="admin-report-list">
              {reports.map((report) => <ReviewCard key={report.id} report={report} onDone={refresh} onError={setError}/>) }
              {!reports.length && <div className="admin-empty"><strong>Brak zgłoszeń</strong><span>W wybranym statusie nie ma elementów wymagających uwagi.</span></div>}
            </div>
          </div>
        </section>
      ) : (
        <section className="admin-card">
          <div className="admin-card-header"><div><h2 className="admin-card-title">Historia działań</h2><span className="admin-card-subtitle">Ostatnie 100 zapisanych zdarzeń moderacyjnych.</span></div><span className="admin-badge admin-badge-blue">{actionCounts} / 24 h</span></div>
          <div className="admin-table-wrap">
            <table className="admin-table" style={{ minWidth: 820 }}>
              <thead><tr><th>Data</th><th>Akcja</th><th>Moderator</th><th>Cel</th><th>Powód</th></tr></thead>
              <tbody>
                {actions.slice(0, 100).map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("pl-PL")}</td>
                    <td><span className="admin-badge admin-badge-neutral">{item.action}</span></td>
                    <td>{item.actorAdmin || item.actorUserId || "system"}</td>
                    <td><span className="admin-mono">{item.targetUserId || item.targetMessageId || item.channelId || "—"}</span></td>
                    <td>{item.reason || <span className="admin-secondary-text">Brak powodu</span>}</td>
                  </tr>
                ))}
                {!actions.length && <tr><td colSpan={5}><div className="admin-empty"><strong>Brak historii</strong><span>Nie zapisano jeszcze działań moderacyjnych.</span></div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
