import React, { useEffect, useMemo, useState } from "react";
import { api, type DailyMetric, type OperationsOverview } from "../api";

type OperationsWithHttp = OperationsOverview & {
  http: {
    lifetime: { total: number; clientErrors: number; serverErrors: number; averageLatencyMs: number; maxLatencyMs: number };
    last5Minutes: { total: number; clientErrors: number; serverErrors: number; averageLatencyMs: number; maxLatencyMs: number };
  };
};

const styles = `
  .ops-wrap { max-width:1320px; margin:0 auto 24px; padding:0 24px; font-family:Inter,sans-serif; }
  .ops-card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,.02); }
  .ops-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; }
  .ops-head h2 { margin:0 0 6px; color:#0f172a; font-size:20px; }
  .ops-head p { margin:0; color:#64748b; font-size:13px; }
  .ops-actions { display:flex; gap:8px; flex-wrap:wrap; }
  .ops-btn { border:0; border-radius:9px; padding:9px 12px; font-weight:700; cursor:pointer; background:#006aff; color:#fff; }
  .ops-btn.secondary { background:#fff; color:#334155; border:1px solid #cbd5e1; }
  .ops-btn:disabled { opacity:.5; cursor:not-allowed; }
  .ops-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin-bottom:18px; }
  .ops-box { border:1px solid #e2e8f0; background:#f8fafc; border-radius:12px; padding:15px; display:grid; gap:5px; }
  .ops-box strong { color:#0f172a; font-size:13px; }
  .ops-value { color:#006aff; font-size:24px; font-weight:800; }
  .ops-box small { color:#64748b; line-height:1.45; }
  .ops-state { display:inline-flex; width:max-content; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:800; }
  .ops-state.ok { background:#ecfdf5; color:#047857; }
  .ops-state.warn { background:#fffbeb; color:#b45309; }
  .ops-state.fail { background:#fef2f2; color:#dc2626; }
  .ops-table-wrap { overflow:auto; margin-top:14px; }
  .ops-table { border-collapse:collapse; width:100%; min-width:920px; }
  .ops-table th { text-align:left; padding:10px; font-size:11px; text-transform:uppercase; color:#64748b; border-bottom:2px solid #e2e8f0; }
  .ops-table td { padding:10px; font-size:12px; color:#334155; border-bottom:1px solid #e2e8f0; }
  .ops-note { padding:11px 13px; border-radius:9px; margin-bottom:14px; background:#ecfdf5; color:#047857; font-size:13px; font-weight:700; }
  .ops-note.error { background:#fef2f2; color:#dc2626; }
  .ops-links { display:flex; gap:12px; flex-wrap:wrap; margin-top:14px; font-size:12px; }
  .ops-links a { color:#006aff; font-weight:700; }
  @media(max-width:700px){.ops-wrap{padding:0 10px}.ops-card{padding:16px}.ops-head{flex-direction:column}}
`;

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pl-PL") : "—";
}

function bytes(value: number) {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function OperationsPanel() {
  const [operations, setOperations] = useState<OperationsWithHttp | null>(null);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  async function refresh() {
    setBusy(true);
    try {
      const [operationsResult, analyticsResult] = await Promise.all([api.operations(), api.analytics(30)]);
      setOperations(operationsResult.operations as OperationsWithHttp);
      setMetrics(analyticsResult.metrics);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się pobrać stanu operacyjnego.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function verifySmtp() {
    setBusy(true);
    try {
      const result = await api.verifySmtp();
      setOperations(result.operations as OperationsWithHttp);
      setNotice({ text: result.operations.smtp.lastCheckOk ? "Połączenie SMTP działa poprawnie." : `SMTP: ${result.operations.smtp.lastCheckError || "sprawdzenie nieudane"}`, error: !result.operations.smtp.lastCheckOk });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Sprawdzenie SMTP nie powiodło się.", error: true });
    } finally { setBusy(false); }
  }

  async function maintenance() {
    if (!window.confirm("Uruchomić bezpieczne czyszczenie starych rekordów technicznych?")) return;
    setBusy(true);
    try {
      await api.runMaintenance();
      await refresh();
      setNotice({ text: "Czyszczenie zakończone." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Czyszczenie nie powiodło się.", error: true });
    } finally { setBusy(false); }
  }

  async function rebuild() {
    setBusy(true);
    try {
      const result = await api.rebuildAnalytics(30);
      setMetrics(result.metrics);
      setNotice({ text: "Przeliczono statystyki z ostatnich 30 dni." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się przeliczyć statystyk.", error: true });
    } finally { setBusy(false); }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const totals = useMemo(() => metrics.reduce((sum, metric) => ({
    users: sum.users + metric.registeredUsers,
    active: Math.max(sum.active, metric.activeUsers),
    publicMessages: sum.publicMessages + metric.publicMessages,
    directMessages: sum.directMessages + metric.directMessages,
    emailsSent: sum.emailsSent + metric.emailsSent,
    emailsFailed: sum.emailsFailed + metric.emailsFailed
  }), { users: 0, active: 0, publicMessages: 0, directMessages: 0, emailsSent: 0, emailsFailed: 0 }), [metrics]);

  return (
    <section className="ops-wrap">
      <style>{styles}</style>
      <div className="ops-card">
        <div className="ops-head">
          <div><h2>🩺 Operacje i stan usługi</h2><p>Zdrowie aplikacji, SMTP, retencja danych technicznych i zagregowane metryki bez treści rozmów.</p></div>
          <div className="ops-actions"><button className="ops-btn secondary" onClick={() => void refresh()} disabled={busy}>Odśwież</button><button className="ops-btn secondary" onClick={() => void verifySmtp()} disabled={busy}>Sprawdź SMTP</button><button className="ops-btn secondary" onClick={() => void maintenance()} disabled={busy}>Uruchom czyszczenie</button><button className="ops-btn" onClick={() => void rebuild()} disabled={busy}>Przelicz 30 dni</button></div>
        </div>
        {notice && <div className={`ops-note ${notice.error ? "error" : ""}`}>{notice.text}</div>}
        {!operations ? <div>Ładowanie stanu usługi…</div> : <>
          <div className="ops-grid">
            <div className="ops-box"><strong>Baza danych</strong><span className={`ops-state ${operations.database.ok ? "ok" : "fail"}`}>{operations.database.ok ? "Działa" : "Błąd"}</span><div className="ops-value">{operations.database.latencyMs ?? "—"} ms</div><small>{operations.database.error || "Zapytanie gotowości zakończone poprawnie."}</small></div>
            <div className="ops-box"><strong>HTTP / ostatnie 5 min</strong><span className={`ops-state ${operations.http.last5Minutes.serverErrors ? "fail" : "ok"}`}>{operations.http.last5Minutes.serverErrors ? "Błędy 5xx" : "Stabilnie"}</span><div className="ops-value">{operations.http.last5Minutes.averageLatencyMs} ms</div><small>Żądania: {operations.http.last5Minutes.total}<br/>4xx: {operations.http.last5Minutes.clientErrors} • 5xx: {operations.http.last5Minutes.serverErrors}<br/>Maks.: {operations.http.last5Minutes.maxLatencyMs} ms</small></div>
            <div className="ops-box"><strong>SMTP</strong><span className={`ops-state ${operations.smtp.lastCheckOk === true ? "ok" : operations.smtp.configured ? "warn" : "fail"}`}>{operations.smtp.configured ? (operations.smtp.lastCheckOk === true ? "Połączony" : "Skonfigurowany") : "Brak konfiguracji"}</span><div className="ops-value">{operations.smtp.lastCheckOk === true ? "OK" : "—"}</div><small>Ostatnie sprawdzenie: {formatDate(operations.smtp.lastCheckedAt)}<br/>Wysłano: {formatDate(operations.smtp.lastSentAt)}<br/>Błąd: {formatDate(operations.smtp.lastFailedAt)}</small></div>
            <div className="ops-box"><strong>Aplikacja</strong><span className="ops-state ok">Uruchomiona</span><div className="ops-value">{Math.floor(operations.application.uptimeSeconds / 3600)} h</div><small>Wersja: {operations.application.version}<br/>Build: {operations.application.buildSha}<br/>Node: {operations.application.nodeVersion}</small></div>
            <div className="ops-box"><strong>Pamięć procesu</strong><div className="ops-value">{bytes(operations.application.memory.rss)}</div><small>Heap: {bytes(operations.application.memory.heapUsed)} / {bytes(operations.application.memory.heapTotal)}</small></div>
            <div className="ops-box"><strong>Konta</strong><div className="ops-value">{operations.counts.users.ACTIVE || 0}</div><small>Zawieszone: {operations.counts.users.SUSPENDED || 0}<br/>Usunięte: {operations.counts.users.DELETED || 0}<br/>Aktywne sesje: {operations.counts.activeSessions}</small></div>
            <div className="ops-box"><strong>Kolejki bezpieczeństwa</strong><div className="ops-value">{operations.counts.openReports}</div><small>Otwarte zgłoszenia<br/>Nieprzeczytane powiadomienia: {operations.counts.unreadNotifications}</small></div>
            <div className="ops-box"><strong>Ostatnie czyszczenie</strong><span className={`ops-state ${operations.maintenance.success === true ? "ok" : operations.maintenance.success === false ? "fail" : "warn"}`}>{operations.maintenance.running ? "W toku" : operations.maintenance.success === true ? "Sukces" : operations.maintenance.success === false ? "Błąd" : "Jeszcze nie uruchomiono"}</span><small>Zakończono: {formatDate(operations.maintenance.finishedAt)}<br/>{operations.maintenance.error || (operations.maintenance.counts ? Object.entries(operations.maintenance.counts).map(([key,value]) => `${key}: ${value}`).join(" • ") : "Brak wyniku")}</small></div>
          </div>
          <div className="ops-grid">
            <div className="ops-box"><strong>Nowe konta / 30 dni</strong><div className="ops-value">{totals.users}</div><small>Maks. aktywnych dziennie: {totals.active}</small></div>
            <div className="ops-box"><strong>Wiadomości publiczne / 30 dni</strong><div className="ops-value">{totals.publicMessages}</div></div>
            <div className="ops-box"><strong>Wiadomości prywatne / 30 dni</strong><div className="ops-value">{totals.directMessages}</div></div>
            <div className="ops-box"><strong>E-maile / 30 dni</strong><div className="ops-value">{totals.emailsSent}</div><small>Nieudane: {totals.emailsFailed}</small></div>
          </div>
          <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Dzień</th><th>Nowe konta</th><th>Zweryfikowane</th><th>Aktywni</th><th>Publiczne</th><th>Prywatne</th><th>Pokoje</th><th>Zgłoszenia</th><th>E-maile</th></tr></thead><tbody>{metrics.map((metric) => <tr key={metric.day}><td>{new Date(metric.day).toLocaleDateString("pl-PL")}</td><td>{metric.registeredUsers}</td><td>{metric.verifiedUsers}</td><td>{metric.activeUsers}</td><td>{metric.publicMessages}</td><td>{metric.directMessages}</td><td>{metric.roomsCreated}</td><td>{metric.reportsCreated}</td><td>{metric.emailsSent} / <span title="Nieudane">{metric.emailsFailed}</span></td></tr>)}{!metrics.length && <tr><td colSpan={9}>Brak zagregowanych danych. Użyj „Przelicz 30 dni”.</td></tr>}</tbody></table></div>
          <div className="ops-links"><a href="/healthz" target="_blank" rel="noreferrer">Liveness /healthz</a><a href="/readyz" target="_blank" rel="noreferrer">Readiness /readyz</a><span>Wygenerowano: {formatDate(operations.generatedAt)}</span></div>
        </>}
      </div>
    </section>
  );
}
