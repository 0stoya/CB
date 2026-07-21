import React, { useEffect, useMemo, useState } from "react";
import { api, type AdminModerationAction, type AdminReport } from "../api";

const styles = `
  .moderation-admin { font-family: Inter, sans-serif; background:#F8FAFC; padding:0 24px 32px; color:#0f172a; }
  .moderation-admin-inner { max-width:1320px; margin:0 auto; display:grid; gap:24px; }
  .moderation-card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,.02); }
  .moderation-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:18px; }
  .moderation-heading h2 { margin:0; font-size:19px; }
  .moderation-filter { border:1px solid #cbd5e1; border-radius:9px; padding:8px 10px; background:#fff; }
  .moderation-grid { display:grid; gap:14px; }
  .report-item { border:1px solid #e2e8f0; border-radius:14px; padding:16px; display:grid; gap:12px; }
  .report-top { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
  .report-meta { display:flex; gap:7px; flex-wrap:wrap; }
  .report-tag { padding:4px 9px; border-radius:999px; background:#f1f5f9; color:#475569; font-size:11px; font-weight:800; }
  .report-tag.open { background:#fef2f2; color:#dc2626; }
  .report-tag.reviewing { background:#fffbeb; color:#b45309; }
  .report-tag.resolved { background:#ecfdf5; color:#047857; }
  .report-copy { color:#475569; font-size:13px; line-height:1.55; }
  .report-snapshot { background:#0f172a; color:#cbd5e1; border-radius:10px; padding:12px; white-space:pre-wrap; overflow:auto; max-height:220px; font:12px/1.5 ui-monospace, monospace; }
  .report-actions { display:grid; grid-template-columns:180px 1fr auto auto; gap:9px; align-items:center; }
  .report-actions select,.report-actions input { border:1px solid #cbd5e1; border-radius:9px; padding:9px 10px; min-width:0; }
  .report-actions button { border:0; border-radius:9px; padding:10px 13px; font-weight:800; cursor:pointer; background:#006aff; color:#fff; }
  .report-actions button.dismiss { background:#f1f5f9; color:#475569; }
  .action-list { width:100%; border-collapse:collapse; font-size:12px; }
  .action-list th,.action-list td { text-align:left; border-bottom:1px solid #e2e8f0; padding:10px; vertical-align:top; }
  .moderation-empty { text-align:center; color:#94a3b8; padding:26px; }
  @media(max-width:800px){.moderation-admin{padding:0 10px 20px}.report-actions{grid-template-columns:1fr}.report-top{flex-direction:column}}
`;

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

function ReviewRow({ report, onDone }: { report: AdminReport; onDone: () => Promise<void> }) {
  const [action, setAction] = useState<"NONE" | "DELETE_CONTENT" | "SUSPEND_USER" | "ARCHIVE_ROOM">("NONE");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(status: "REVIEWING" | "RESOLVED" | "DISMISSED") {
    setBusy(true);
    try {
      await api.reviewReport(report.id, {
        status,
        action: status === "DISMISSED" ? "NONE" : action,
        resolutionNote: note || undefined
      });
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="report-item">
      <div className="report-top">
        <div>
          <div className="report-meta">
            <span className={`report-tag ${report.status.toLowerCase()}`}>{report.status}</span>
            <span className="report-tag">{report.targetType}</span>
            <span className="report-tag">{report.reason}</span>
          </div>
          <p className="report-copy"><strong>{snapshotSummary(report)}</strong><br />{report.details || "Brak dodatkowego opisu."}</p>
          <small className="report-copy">{new Date(report.createdAt).toLocaleString("pl-PL")} · reporter: {report.reporterUserId || report.reporterClientId || "nieznany"}</small>
        </div>
      </div>
      <details>
        <summary>Chroniony snapshot zgłoszenia</summary>
        <pre className="report-snapshot">{JSON.stringify(report.snapshot, null, 2)}</pre>
      </details>
      {report.status !== "RESOLVED" && report.status !== "DISMISSED" && (
        <div className="report-actions">
          <select value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
            <option value="NONE">Bez dodatkowej akcji</option>
            <option value="DELETE_CONTENT">Usuń treść</option>
            <option value="SUSPEND_USER">Zawieś konto</option>
            <option value="ARCHIVE_ROOM">Archiwizuj pokój</option>
          </select>
          <input value={note} maxLength={1000} placeholder="Notatka moderacyjna" onChange={(event) => setNote(event.target.value)} />
          <button disabled={busy} onClick={() => void submit("RESOLVED")}>Rozwiąż</button>
          <button className="dismiss" disabled={busy} onClick={() => void submit("DISMISSED")}>Odrzuć</button>
        </div>
      )}
    </article>
  );
}

export default function ReportsPanel() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [actions, setActions] = useState<AdminModerationAction[]>([]);
  const [filter, setFilter] = useState<"ALL" | AdminReport["status"]>("OPEN");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [reportResult, actionResult] = await Promise.all([
        api.reports(filter === "ALL" ? undefined : filter),
        api.moderationActions()
      ]);
      setReports(reportResult.reports);
      setActions(actionResult.actions);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się pobrać zgłoszeń");
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [filter]);

  const openCount = useMemo(() => reports.filter((report) => report.status === "OPEN").length, [reports]);

  return (
    <>
      <style>{styles}</style>
      <section className="moderation-admin">
        <div className="moderation-admin-inner">
          <div className="moderation-card">
            <div className="moderation-heading">
              <div><h2>🚨 Zgłoszenia użytkowników</h2><small>{openCount} otwartych w bieżącym widoku</small></div>
              <select className="moderation-filter" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="OPEN">Otwarte</option><option value="REVIEWING">W trakcie</option><option value="RESOLVED">Rozwiązane</option><option value="DISMISSED">Odrzucone</option><option value="ALL">Wszystkie</option>
              </select>
            </div>
            {error && <div className="report-tag open">{error}</div>}
            <div className="moderation-grid">
              {reports.map((report) => <ReviewRow key={report.id} report={report} onDone={refresh} />)}
              {!reports.length && <div className="moderation-empty">Brak zgłoszeń w tym widoku.</div>}
            </div>
          </div>

          <div className="moderation-card">
            <div className="moderation-heading"><h2>🧾 Historia moderacji</h2></div>
            <div style={{ overflowX: "auto" }}>
              <table className="action-list"><thead><tr><th>Data</th><th>Akcja</th><th>Moderator</th><th>Cel</th><th>Powód</th></tr></thead><tbody>
                {actions.slice(0, 100).map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString("pl-PL")}</td><td>{item.action}</td><td>{item.actorAdmin || item.actorUserId || "system"}</td><td>{item.targetUserId || item.targetMessageId || item.channelId || "-"}</td><td>{item.reason || "-"}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
