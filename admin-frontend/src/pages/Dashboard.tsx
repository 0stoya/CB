import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type AdminChannel,
  type BanRecord,
  type ContactMsg,
  type ReportType,
  type Stats
} from "../api";

type DashboardView = "overview" | "rooms" | "inbox" | "security";

function formatDate(value: number | string | null | undefined) {
  if (value == null) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function categoryBadge(category?: string) {
  switch (category) {
    case "szukam": return <span className="admin-badge admin-badge-amber">Szukam</span>;
    case "blad": return <span className="admin-badge admin-badge-red">Błąd</span>;
    case "sugestia": return <span className="admin-badge admin-badge-blue">Sugestia</span>;
    default: return <span className="admin-badge admin-badge-neutral">Inne</span>;
  }
}

function channelStatus(status: AdminChannel["status"]) {
  if (status === "ACTIVE") return <span className="admin-badge admin-badge-green">Aktywny</span>;
  if (status === "ARCHIVED") return <span className="admin-badge admin-badge-amber">Archiwum</span>;
  return <span className="admin-badge admin-badge-red">Ukryty</span>;
}

export default function Dashboard({ view }: { view: DashboardView }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [banIp, setBanIp] = useState("");
  const [banReason, setBanReason] = useState<ReportType>("abuse");
  const [banDurationMs, setBanDurationMs] = useState(86_400_000);
  const [banNote, setBanNote] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [messageCategory, setMessageCategory] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      if (view === "overview") {
        setStats(await api.stats());
      } else if (view === "rooms") {
        const result = await api.channels();
        setChannels(result.channels || []);
      } else if (view === "security") {
        const result = await api.bans();
        setBans(result.bans || []);
      } else {
        const result = await api.getMessages();
        setMessages(result.messages || []);
      }
      setLastUpdated(new Date());
      setNotice((current) => current?.error ? null : current);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się odświeżyć danych.", error: true });
    } finally {
      setBusy(false);
    }
  }, [view]);

  useEffect(() => {
    setNotice(null);
    void refresh();
    const interval = view === "overview" ? 5_000 : 15_000;
    const timer = window.setInterval(() => void refresh(), interval);
    return () => window.clearInterval(timer);
  }, [refresh, view]);

  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Dostępni online", value: stats.online, note: "Bieżące połączenia", accent: true },
      { label: "Pokoje publiczne", value: stats.publicRoomsActive, note: `${stats.publicRoomUsers} użytkowników w pokojach` },
      { label: "Kolejka losowa", value: stats.queueSize, note: "Osoby czekające na rozmowę" },
      { label: "Aktywne rozmowy", value: stats.activeRooms, note: "Losowe połączenia 1:1" },
      { label: "Wiadomości publiczne", value: stats.publicMessages, note: "Zapisane w pokojach" },
      { label: "Połączenia łącznie", value: stats.totals.matches, note: `${stats.last60s.matches} w ostatniej minucie` },
      { label: "Wiadomości łącznie", value: stats.totals.messages, note: `${stats.last60s.messages} w ostatniej minucie` },
      { label: "Aktywne blokady", value: stats.bansActive, note: `${stats.reports.abuse} zgłoszeń nadużyć` }
    ];
  }, [stats]);

  const filteredMessages = useMemo(() => {
    const query = messageQuery.trim().toLocaleLowerCase("pl-PL");
    return messages.filter((message) => {
      if (messageCategory && (message.category || "inne") !== messageCategory) return false;
      if (!query) return true;
      return [message.email, message.subject, message.message, message.ip]
        .some((value) => value.toLocaleLowerCase("pl-PL").includes(query));
    });
  }, [messageCategory, messageQuery, messages]);

  async function updateChannel(id: string, input: Parameters<typeof api.updateChannel>[1]) {
    setBusy(true);
    try {
      await api.updateChannel(id, input);
      await refresh();
      setNotice({ text: "Ustawienia pokoju zostały zapisane." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się zapisać pokoju.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function deleteChannel(channel: AdminChannel) {
    if (!window.confirm(`Trwale usunąć #${channel.slug} wraz z historią wiadomości?`)) return;
    setBusy(true);
    try {
      await api.deleteChannel(channel.id);
      await refresh();
      setNotice({ text: `Pokój #${channel.slug} został usunięty.` });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się usunąć pokoju.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function ban(event: React.FormEvent) {
    event.preventDefault();
    const ip = banIp.trim();
    if (!ip) return setNotice({ text: "Wprowadź adres IP.", error: true });
    setBusy(true);
    try {
      await api.ban(ip, banReason, banDurationMs, banNote.trim() || undefined);
      setBanIp("");
      setBanNote("");
      await refresh();
      setNotice({ text: `Adres ${ip} został zablokowany.` });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się dodać blokady.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function unban(ip: string) {
    if (!window.confirm(`Odblokować adres ${ip}?`)) return;
    setBusy(true);
    try {
      await api.unban(ip);
      await refresh();
      setNotice({ text: `Adres ${ip} został odblokowany.` });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się usunąć blokady.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage(id: string) {
    if (!window.confirm("Usunąć tę wiadomość ze skrzynki administratora?")) return;
    setBusy(true);
    try {
      await api.deleteMessage(id);
      await refresh();
      setNotice({ text: "Wiadomość została usunięta." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się usunąć wiadomości.", error: true });
    } finally {
      setBusy(false);
    }
  }

  const toolbar = (
    <div className="admin-page-toolbar">
      <div className="admin-page-toolbar-copy">
        <strong>{lastUpdated ? `Ostatnia aktualizacja: ${formatDate(lastUpdated.toISOString())}` : "Pobieranie danych…"}</strong>
        <span>{view === "overview" ? "Automatyczne odświeżanie co 5 sekund" : "Automatyczne odświeżanie co 15 sekund"}</span>
      </div>
      <button className="admin-button admin-button-quiet" type="button" onClick={() => void refresh()} disabled={busy}>
        {busy ? <><span className="admin-spinner"/>Odświeżanie</> : "Odśwież dane"}
      </button>
    </div>
  );

  if (view === "overview") {
    return (
      <div className="admin-page">
        {toolbar}
        {notice && <div className={`admin-notice ${notice.error ? "admin-notice-error" : ""}`} role="status">{notice.text}</div>}
        {!stats ? <div className="admin-empty"><span className="admin-spinner"/><strong>Ładowanie statystyk</strong><span>Pobieramy bieżący stan Chati.</span></div> : (
          <>
            <div className="admin-stat-grid">
              {kpis.map((item) => (
                <article className="admin-stat-card" key={item.label}>
                  <span className="admin-stat-label">{item.label}</span>
                  <strong className={`admin-stat-value ${item.accent ? "admin-stat-accent" : ""}`}>{item.value}</strong>
                  <span className="admin-stat-note">{item.note}</span>
                </article>
              ))}
            </div>
            <section className="admin-card">
              <div className="admin-card-header">
                <div><h2 className="admin-card-title">Stan moderacji w czasie rzeczywistym</h2><span className="admin-card-subtitle">Sygnały z losowego czatu i warstwy ochronnej.</span></div>
                <span className={`admin-badge ${stats.bansActive || stats.reports.abuse ? "admin-badge-amber" : "admin-badge-green"}`}>{stats.bansActive || stats.reports.abuse ? "Wymaga obserwacji" : "Spokojnie"}</span>
              </div>
              <div className="admin-card-body admin-detail-grid">
                <div className="admin-detail-box"><strong>Zgłoszenia botów</strong><span>{stats.reports.bot} w oknie {Math.round(stats.reports.windowMs / 60_000)} min</span></div>
                <div className="admin-detail-box"><strong>Zgłoszenia nadużyć</strong><span>{stats.reports.abuse} w bieżącym oknie</span></div>
                <div className="admin-detail-box"><strong>Aktywne blokady IP</strong><span>{stats.bansActive} obecnie egzekwowanych</span></div>
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  if (view === "rooms") {
    return (
      <div className="admin-page">
        {toolbar}
        {notice && <div className={`admin-notice ${notice.error ? "admin-notice-error" : ""}`} role="status">{notice.text}</div>}
        <section className="admin-card">
          <div className="admin-card-header">
            <div><h2 className="admin-card-title">Wszystkie pokoje</h2><span className="admin-card-subtitle">Zmiany są stosowane natychmiast w aktywnych pokojach.</span></div>
            <span className="admin-badge admin-badge-blue">{channels.length} pokoi</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table" style={{ minWidth: 980 }}>
              <thead><tr><th>Pokój</th><th>Typ i właściciel</th><th>Aktywność</th><th>Dostęp</th><th>Slow mode</th><th>Wygaśnięcie</th><th>Status</th><th>Akcje</th></tr></thead>
              <tbody>
                {channels.map((channel) => (
                  <tr key={channel.id}>
                    <td><div className="admin-primary-text">#{channel.slug}</div><div className="admin-secondary-text">{channel.topic || "Brak opisu pokoju"}</div></td>
                    <td><span className={`admin-badge ${channel.isOfficial ? "admin-badge-blue" : "admin-badge-neutral"}`}>{channel.isOfficial ? "Oficjalny" : "Społeczności"}</span><div className="admin-secondary-text" style={{ marginTop: 5 }}>{channel.creator?.nickname || "Chati"}</div></td>
                    <td><div className="admin-primary-text">{channel.online} online</div><div className="admin-secondary-text">{channel._count.messages} wiadomości<br/>{formatDate(channel.lastActivityAt)}</div></td>
                    <td><select className="admin-select" value={channel.allowGuests ? "yes" : "no"} disabled={busy} onChange={(event) => void updateChannel(channel.id, { allowGuests: event.target.value === "yes" })}><option value="yes">Goście dozwoleni</option><option value="no">Tylko konta</option></select></td>
                    <td><select className="admin-select" value={channel.slowModeSeconds} disabled={busy} onChange={(event) => void updateChannel(channel.id, { slowModeSeconds: Number(event.target.value) })}><option value={0}>Wyłączony</option><option value={5}>5 sekund</option><option value={15}>15 sekund</option><option value={30}>30 sekund</option><option value={60}>60 sekund</option></select></td>
                    <td>{channel.isOfficial ? <span className="admin-badge admin-badge-blue">Bezterminowy</span> : <button className={`admin-button admin-button-small ${channel.protectedFromExpiry ? "admin-button-success-quiet" : "admin-button-quiet"}`} disabled={busy} onClick={() => void updateChannel(channel.id, { protectedFromExpiry: !channel.protectedFromExpiry })}>{channel.protectedFromExpiry ? "Chroniony" : "48 godzin"}</button>}</td>
                    <td><div style={{ display: "grid", gap: 7 }}>{channelStatus(channel.status)}<select className="admin-select" value={channel.status} disabled={busy || channel.isOfficial} onChange={(event) => void updateChannel(channel.id, { status: event.target.value as AdminChannel["status"] })}><option value="ACTIVE">Aktywny</option><option value="ARCHIVED">Archiwum</option><option value="DELETED">Ukryty</option></select></div></td>
                    <td>{!channel.isOfficial && <button className="admin-button admin-button-small admin-button-danger-quiet" disabled={busy} onClick={() => void deleteChannel(channel)}>Usuń pokój</button>}</td>
                  </tr>
                ))}
                {!channels.length && <tr><td colSpan={8}><div className="admin-empty"><strong>Brak pokojów</strong><span>Nie znaleziono aktywnych ani zarchiwizowanych pokojów.</span></div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (view === "security") {
    return (
      <div className="admin-page">
        {toolbar}
        {notice && <div className={`admin-notice ${notice.error ? "admin-notice-error" : ""}`} role="status">{notice.text}</div>}
        <div className="admin-two-column">
          <section className="admin-card">
            <div className="admin-card-header"><div><h2 className="admin-card-title">Aktywne blokady IP</h2><span className="admin-card-subtitle">Ręczne i automatyczne ograniczenia ruchu.</span></div><span className="admin-badge admin-badge-red">{bans.length}</span></div>
            <div className="admin-table-wrap"><table className="admin-table" style={{ minWidth: 680 }}><thead><tr><th>Adres IP</th><th>Źródło</th><th>Sygnały</th><th>Ważny do</th><th>Notatka</th><th>Akcja</th></tr></thead><tbody>
              {bans.map((record) => <tr key={record.ip}><td><span className="admin-mono">{record.ip}</span></td><td><span className={`admin-badge ${record.source === "manual" ? "admin-badge-blue" : "admin-badge-neutral"}`}>{record.source === "manual" ? "Ręczna" : "Automatyczna"}</span></td><td><div className="admin-secondary-text">Bot: {record.reasons?.bot ?? 0}<br/>Nadużycie: {record.reasons?.abuse ?? 0}</div></td><td>{formatDate(record.until)}</td><td>{record.note || <span className="admin-secondary-text">Brak notatki</span>}</td><td><button className="admin-button admin-button-small admin-button-danger-quiet" disabled={busy} onClick={() => void unban(record.ip)}>Odblokuj</button></td></tr>)}
              {!bans.length && <tr><td colSpan={6}><div className="admin-empty"><strong>Brak aktywnych blokad</strong><span>Żaden adres IP nie jest obecnie zablokowany.</span></div></td></tr>}
            </tbody></table></div>
          </section>

          <section className="admin-card">
            <div className="admin-card-header"><div><h2 className="admin-card-title">Dodaj blokadę</h2><span className="admin-card-subtitle">Używaj tylko przy potwierdzonym nadużyciu.</span></div></div>
            <form className="admin-card-body" onSubmit={(event) => void ban(event)}>
              <div className="admin-form-group"><label htmlFor="ban-ip">Adres IP</label><input id="ban-ip" className="admin-field" value={banIp} onChange={(event) => setBanIp(event.target.value)} placeholder="192.0.2.1"/></div>
              <div className="admin-detail-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="admin-form-group"><label htmlFor="ban-reason">Powód</label><select id="ban-reason" className="admin-select" value={banReason} onChange={(event) => setBanReason(event.target.value as ReportType)}><option value="abuse">Nadużycie</option><option value="bot">Bot</option></select></div>
                <div className="admin-form-group"><label htmlFor="ban-duration">Czas</label><select id="ban-duration" className="admin-select" value={banDurationMs} onChange={(event) => setBanDurationMs(Number(event.target.value))}><option value={3_600_000}>1 godzina</option><option value={86_400_000}>24 godziny</option><option value={604_800_000}>7 dni</option><option value={2_592_000_000}>30 dni</option></select></div>
              </div>
              <div className="admin-form-group"><label htmlFor="ban-note">Notatka</label><textarea id="ban-note" className="admin-textarea" value={banNote} onChange={(event) => setBanNote(event.target.value)} placeholder="Opcjonalny kontekst dla moderatorów"/></div>
              <button className="admin-button admin-button-danger" type="submit" disabled={busy || !banIp.trim()}>Dodaj blokadę IP</button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {toolbar}
      {notice && <div className={`admin-notice ${notice.error ? "admin-notice-error" : ""}`} role="status">{notice.text}</div>}
      <section className="admin-card">
        <div className="admin-card-header"><div><h2 className="admin-card-title">Skrzynka administratora</h2><span className="admin-card-subtitle">Sugestie, błędy i wiadomości przesłane przez formularz.</span></div><span className="admin-badge admin-badge-blue">{filteredMessages.length} z {messages.length}</span></div>
        <div className="admin-filter-bar">
          <input className="admin-field" value={messageQuery} onChange={(event) => setMessageQuery(event.target.value)} placeholder="Szukaj w temacie, wiadomości, e-mailu lub IP"/>
          <select className="admin-select" value={messageCategory} onChange={(event) => setMessageCategory(event.target.value)}><option value="">Wszystkie kategorie</option><option value="sugestia">Sugestie</option><option value="blad">Błędy</option><option value="szukam">Szukam</option><option value="inne">Inne</option></select>
        </div>
        <div className="admin-table-wrap"><table className="admin-table" style={{ minWidth: 880 }}><thead><tr><th>Otrzymano</th><th>Nadawca</th><th>Kategoria i temat</th><th>Wiadomość</th><th>Akcja</th></tr></thead><tbody>
          {filteredMessages.map((message) => <tr key={message.id}><td>{formatDate(message.createdAt)}</td><td><div className="admin-primary-text">{message.email || "Bez e-maila"}</div><div className="admin-mono">{message.ip}</div></td><td>{categoryBadge(message.category)}<div className="admin-primary-text" style={{ marginTop: 7 }}>{message.subject}</div></td><td style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, maxWidth: 520 }}>{message.message}</td><td><button className="admin-button admin-button-small admin-button-danger-quiet" disabled={busy} onClick={() => void deleteMessage(message.id)}>Usuń</button></td></tr>)}
          {!filteredMessages.length && <tr><td colSpan={5}><div className="admin-empty"><strong>Skrzynka jest pusta</strong><span>Zmień filtry albo zaczekaj na nową wiadomość.</span></div></td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
