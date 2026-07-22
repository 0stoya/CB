import React, { useEffect, useMemo, useState } from "react";
import { api, type DailyMetric, type OperationsOverview } from "../api";

type OperationsWithHttp = OperationsOverview & {
  http: {
    lifetime: { total: number; clientErrors: number; serverErrors: number; averageLatencyMs: number; maxLatencyMs: number };
    last5Minutes: { total: number; clientErrors: number; serverErrors: number; averageLatencyMs: number; maxLatencyMs: number };
  };
};

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pl-PL") : "—";
}

function bytes(value: number) {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function healthBadge(state: "ok" | "warn" | "fail", label: string) {
  const className = state === "ok" ? "admin-badge-green" : state === "warn" ? "admin-badge-amber" : "admin-badge-red";
  return <span className={`admin-badge ${className}`}>{label}</span>;
}

export default function OperationsPanel() {
  const [operations, setOperations] = useState<OperationsWithHttp | null>(null);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [tab, setTab] = useState<"health" | "analytics">("health");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  async function refresh() {
    setBusy(true);
    try {
      const [operationsResult, analyticsResult] = await Promise.all([api.operations(), api.analytics(30)]);
      setOperations(operationsResult.operations as OperationsWithHttp);
      setMetrics(analyticsResult.metrics);
      setNotice((current) => current?.error ? null : current);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się pobrać stanu operacyjnego.", error: true });
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }

  async function verifySmtp() {
    setBusy(true);
    try {
      const result = await api.verifySmtp();
      setOperations(result.operations as OperationsWithHttp);
      const ok = result.operations.smtp.lastCheckOk === true;
      setNotice({ text: ok ? "Połączenie SMTP działa poprawnie." : `SMTP: ${result.operations.smtp.lastCheckError || "sprawdzenie nieudane"}`, error: !ok });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Sprawdzenie SMTP nie powiodło się.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function maintenance() {
    if (!window.confirm("Uruchomić bezpieczne czyszczenie starych rekordów technicznych?")) return;
    setBusy(true);
    try {
      await api.runMaintenance();
      await refresh();
      setNotice({ text: "Czyszczenie zakończyło się poprawnie." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Czyszczenie nie powiodło się.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function rebuild() {
    if (!window.confirm("Przeliczyć zagregowane metryki z ostatnich 30 dni?")) return;
    setBusy(true);
    try {
      const result = await api.rebuildAnalytics(30);
      setMetrics(result.metrics);
      setNotice({ text: "Przeliczono statystyki z ostatnich 30 dni." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się przeliczyć statystyk.", error: true });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const totals = useMemo(() => metrics.reduce((sum, metric) => ({
    users: sum.users + metric.registeredUsers,
    verified: sum.verified + metric.verifiedUsers,
    active: Math.max(sum.active, metric.activeUsers),
    publicMessages: sum.publicMessages + metric.publicMessages,
    directMessages: sum.directMessages + metric.directMessages,
    reports: sum.reports + metric.reportsCreated,
    emailsSent: sum.emailsSent + metric.emailsSent,
    emailsFailed: sum.emailsFailed + metric.emailsFailed
  }), { users: 0, verified: 0, active: 0, publicMessages: 0, directMessages: 0, reports: 0, emailsSent: 0, emailsFailed: 0 }), [metrics]);

  return (
    <div className="admin-page">
      <div className="admin-page-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="Widok operacyjny">
          <button className={`admin-tab ${tab === "health" ? "is-active" : ""}`} type="button" role="tab" aria-selected={tab === "health"} onClick={() => setTab("health")}>Stan usługi</button>
          <button className={`admin-tab ${tab === "analytics" ? "is-active" : ""}`} type="button" role="tab" aria-selected={tab === "analytics"} onClick={() => setTab("analytics")}>Analityka 30 dni</button>
        </div>
        <div className="admin-actions">
          <button className="admin-button admin-button-quiet" type="button" onClick={() => void refresh()} disabled={busy}>{busy ? <><span className="admin-spinner"/>Odświeżanie</> : "Odśwież"}</button>
          {tab === "health" && <button className="admin-button admin-button-quiet" type="button" onClick={() => void verifySmtp()} disabled={busy}>Sprawdź SMTP</button>}
          {tab === "health" && <button className="admin-button admin-button-danger-quiet" type="button" onClick={() => void maintenance()} disabled={busy}>Uruchom czyszczenie</button>}
          {tab === "analytics" && <button className="admin-button" type="button" onClick={() => void rebuild()} disabled={busy}>Przelicz 30 dni</button>}
        </div>
      </div>

      {notice && <div className={`admin-notice ${notice.error ? "admin-notice-error" : ""}`} role="status">{notice.text}</div>}

      {!loaded || !operations ? (
        <div className="admin-empty"><span className="admin-spinner"/><strong>Ładowanie stanu usługi</strong><span>Sprawdzamy bazę danych, proces i zagregowane metryki.</span></div>
      ) : tab === "health" ? (
        <>
          <div className="admin-health-grid">
            <article className="admin-health-card">
              <h3>Baza danych</h3>
              {healthBadge(operations.database.ok ? "ok" : "fail", operations.database.ok ? "Działa" : "Błąd")}
              <strong className="admin-health-value">{operations.database.latencyMs ?? "—"} ms</strong>
              <small>{operations.database.error || "Zapytanie gotowości zakończone poprawnie."}</small>
            </article>
            <article className="admin-health-card">
              <h3>HTTP / ostatnie 5 minut</h3>
              {healthBadge(operations.http.last5Minutes.serverErrors ? "fail" : operations.http.last5Minutes.clientErrors ? "warn" : "ok", operations.http.last5Minutes.serverErrors ? "Błędy 5xx" : operations.http.last5Minutes.clientErrors ? "Błędy 4xx" : "Stabilnie")}
              <strong className="admin-health-value">{operations.http.last5Minutes.averageLatencyMs} ms</strong>
              <small>Żądania: {operations.http.last5Minutes.total}<br/>4xx: {operations.http.last5Minutes.clientErrors} • 5xx: {operations.http.last5Minutes.serverErrors}<br/>Maks.: {operations.http.last5Minutes.maxLatencyMs} ms</small>
            </article>
            <article className="admin-health-card">
              <h3>SMTP</h3>
              {healthBadge(operations.smtp.lastCheckOk === true ? "ok" : operations.smtp.configured ? "warn" : "fail", operations.smtp.lastCheckOk === true ? "Połączony" : operations.smtp.configured ? "Do sprawdzenia" : "Brak konfiguracji")}
              <strong className="admin-health-value">{operations.smtp.lastCheckOk === true ? "OK" : "—"}</strong>
              <small>Sprawdzenie: {formatDate(operations.smtp.lastCheckedAt)}<br/>Ostatnia wysyłka: {formatDate(operations.smtp.lastSentAt)}<br/>Ostatni błąd: {formatDate(operations.smtp.lastFailedAt)}</small>
            </article>
            <article className="admin-health-card">
              <h3>Aplikacja</h3>
              {healthBadge("ok", "Uruchomiona")}
              <strong className="admin-health-value">{Math.floor(operations.application.uptimeSeconds / 3600)} h</strong>
              <small>Wersja: {operations.application.version}<br/>Build: {operations.application.buildSha}<br/>Node: {operations.application.nodeVersion}</small>
            </article>
            <article className="admin-health-card">
              <h3>Pamięć procesu</h3>
              {healthBadge(operations.application.memory.heapUsed / operations.application.memory.heapTotal > .85 ? "warn" : "ok", "Heap")}
              <strong className="admin-health-value">{bytes(operations.application.memory.rss)}</strong>
              <small>Heap: {bytes(operations.application.memory.heapUsed)} / {bytes(operations.application.memory.heapTotal)}</small>
            </article>
            <article className="admin-health-card">
              <h3>Konta i sesje</h3>
              {healthBadge("ok", "Aktywne")}
              <strong className="admin-health-value">{operations.counts.users.ACTIVE || 0}</strong>
              <small>Zawieszone: {operations.counts.users.SUSPENDED || 0}<br/>Usunięte: {operations.counts.users.DELETED || 0}<br/>Aktywne sesje: {operations.counts.activeSessions}</small>
            </article>
            <article className="admin-health-card">
              <h3>Kolejki bezpieczeństwa</h3>
              {healthBadge(operations.counts.openReports ? "warn" : "ok", operations.counts.openReports ? "Wymaga uwagi" : "Spokojnie")}
              <strong className="admin-health-value">{operations.counts.openReports}</strong>
              <small>Otwarte zgłoszenia<br/>Nieprzeczytane powiadomienia: {operations.counts.unreadNotifications}</small>
            </article>
            <article className="admin-health-card">
              <h3>Ostatnie czyszczenie</h3>
              {healthBadge(operations.maintenance.success === true ? "ok" : operations.maintenance.success === false ? "fail" : "warn", operations.maintenance.running ? "W toku" : operations.maintenance.success === true ? "Sukces" : operations.maintenance.success === false ? "Błąd" : "Brak wyniku")}
              <strong className="admin-health-value">{operations.maintenance.counts ? Object.values(operations.maintenance.counts).reduce((sum, value) => sum + value, 0) : "—"}</strong>
              <small>Zakończono: {formatDate(operations.maintenance.finishedAt)}<br/>{operations.maintenance.error || "Usunięte rekordy techniczne"}</small>
            </article>
          </div>

          <section className="admin-card">
            <div className="admin-card-header"><div><h2 className="admin-card-title">Szczegóły operacyjne</h2><span className="admin-card-subtitle">Informacje przydatne podczas diagnostyki i wdrożeń.</span></div><span className="admin-badge admin-badge-blue">{formatDate(operations.generatedAt)}</span></div>
            <div className="admin-card-body admin-detail-grid">
              <div className="admin-detail-box"><strong>HTTP od uruchomienia</strong><span>Żądania: {operations.http.lifetime.total}<br/>Średnia: {operations.http.lifetime.averageLatencyMs} ms<br/>Maks.: {operations.http.lifetime.maxLatencyMs} ms<br/>4xx / 5xx: {operations.http.lifetime.clientErrors} / {operations.http.lifetime.serverErrors}</span></div>
              <div className="admin-detail-box"><strong>Wersja procesu</strong><span>APP_VERSION: {operations.application.version}<br/>BUILD_SHA: {operations.application.buildSha}<br/>NODE_ENV: {operations.application.nodeEnv}</span></div>
              <div className="admin-detail-box"><strong>Endpointy monitoringu</strong><span><a href="/healthz" target="_blank" rel="noreferrer">Otwórz /healthz</a><br/><a href="/readyz" target="_blank" rel="noreferrer">Otwórz /readyz</a></span></div>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="admin-stat-grid">
            <article className="admin-stat-card"><span className="admin-stat-label">Nowe konta</span><strong className="admin-stat-value admin-stat-accent">{totals.users}</strong><span className="admin-stat-note">Zweryfikowane: {totals.verified}</span></article>
            <article className="admin-stat-card"><span className="admin-stat-label">Maks. aktywnych dziennie</span><strong className="admin-stat-value">{totals.active}</strong><span className="admin-stat-note">Na podstawie aktywnych sesji</span></article>
            <article className="admin-stat-card"><span className="admin-stat-label">Wiadomości publiczne</span><strong className="admin-stat-value">{totals.publicMessages}</strong><span className="admin-stat-note">Bez treści wiadomości</span></article>
            <article className="admin-stat-card"><span className="admin-stat-label">Wiadomości prywatne</span><strong className="admin-stat-value">{totals.directMessages}</strong><span className="admin-stat-note">Wyłącznie liczba rekordów</span></article>
            <article className="admin-stat-card"><span className="admin-stat-label">Zgłoszenia</span><strong className="admin-stat-value">{totals.reports}</strong><span className="admin-stat-note">Utworzone w okresie</span></article>
            <article className="admin-stat-card"><span className="admin-stat-label">E-maile wysłane</span><strong className="admin-stat-value">{totals.emailsSent}</strong><span className="admin-stat-note">Nieudane: {totals.emailsFailed}</span></article>
          </div>
          <section className="admin-card">
            <div className="admin-card-header"><div><h2 className="admin-card-title">Dzienne metryki</h2><span className="admin-card-subtitle">Agregaty nie zawierają treści rozmów, adresów e-mail ani adresów IP.</span></div><span className="admin-badge admin-badge-blue">{metrics.length} dni</span></div>
            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 930 }}>
                <thead><tr><th>Dzień</th><th>Nowe konta</th><th>Zweryfikowane</th><th>Aktywni</th><th>Publiczne</th><th>Prywatne</th><th>Pokoje</th><th>Zgłoszenia</th><th>E-maile</th></tr></thead>
                <tbody>
                  {metrics.map((metric) => <tr key={metric.day}><td className="admin-primary-text">{new Date(metric.day).toLocaleDateString("pl-PL")}</td><td>{metric.registeredUsers}</td><td>{metric.verifiedUsers}</td><td>{metric.activeUsers}</td><td>{metric.publicMessages}</td><td>{metric.directMessages}</td><td>{metric.roomsCreated}</td><td>{metric.reportsCreated}</td><td>{metric.emailsSent} <span className="admin-secondary-text">/ {metric.emailsFailed} błędów</span></td></tr>)}
                  {!metrics.length && <tr><td colSpan={9}><div className="admin-empty"><strong>Brak zagregowanych danych</strong><span>Użyj „Przelicz 30 dni”, aby odbudować zestawienie.</span></div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
