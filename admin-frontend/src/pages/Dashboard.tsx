import React, { useEffect, useMemo, useState } from "react";
import {
  api,
  type AdminChannel,
  type BanRecord,
  type ContactMsg,
  type ReportType,
  type Stats
} from "../api";

const adminStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  .admin-layout { font-family: 'Inter', sans-serif; background: #F8FAFC; color: #111827; min-height: 100vh; padding: 32px 24px; }
  .admin-container { max-width: 1320px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
  .admin-header { display: flex; justify-content: space-between; align-items: flex-end; background: #FFFFFF; padding: 24px; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
  .admin-title { font-size: 24px; font-weight: 800; color: #111827; margin: 0 0 8px 0; }
  .admin-subtitle { font-size: 14px; color: #64748B; font-weight: 500; margin: 0; }
  .header-actions, .form-row, .inline-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .admin-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
  .card-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
  .card-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
  .kpi-box { background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; }
  .kpi-value { font-size: 28px; font-weight: 800; color: #006AFF; margin-bottom: 4px; }
  .kpi-label { font-size: 13px; font-weight: 600; color: #64748B; }
  .admin-input, .admin-select, .admin-textarea { background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px 12px; font-size: 14px; color: #111827; outline: none; font-family: inherit; }
  .admin-input:focus, .admin-select:focus, .admin-textarea:focus { border-color: #006AFF; background: #FFFFFF; }
  .admin-textarea { width: 100%; min-height: 80px; resize: vertical; margin-top: 12px; }
  .admin-select.compact { padding: 7px 9px; font-size: 12px; }
  .btn { padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: #006AFF; color: #FFFFFF; }
  .btn-primary:hover:not(:disabled) { background: #0056D6; }
  .btn-outline { background: #FFFFFF; color: #475569; border: 1px solid #CBD5E1; }
  .btn-outline:hover:not(:disabled) { background: #F8FAFC; color: #111827; }
  .btn-danger { background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; }
  .btn-small { padding: 7px 10px; font-size: 12px; }
  .table-container { overflow-x: auto; margin-top: 12px; }
  .admin-table { width: 100%; border-collapse: collapse; text-align: left; min-width: 820px; }
  .admin-table th { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; padding: 12px 14px; border-bottom: 2px solid #E2E8F0; }
  .admin-table td { padding: 14px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #1F2937; vertical-align: top; }
  .admin-table tbody tr:hover { background: #F8FAFC; }
  .tag { display: inline-block; padding: 4px 9px; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 999px; font-size: 11px; font-weight: 700; color: #475569; }
  .tag.green { background: #ECFDF5; color: #047857; border-color: #A7F3D0; }
  .tag.blue { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }
  .tag.amber { background: #FFFBEB; color: #B45309; border-color: #FDE68A; }
  .tag.red { background: #FEF2F2; color: #DC2626; border-color: #FECACA; }
  .toast { padding: 12px 16px; background: #10B981; color: white; border-radius: 8px; font-size: 14px; font-weight: 600; animation: fadeIn 0.3s; }
  .toast.error { background: #EF4444; }
  .channel-name { display: grid; gap: 4px; }
  .channel-name strong { font-size: 14px; }
  .channel-name small { color: #64748B; max-width: 340px; line-height: 1.4; }
  .muted { color: #64748B; font-size: 12px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 700px) { .admin-layout { padding: 16px 10px; } .admin-header { align-items: flex-start; flex-direction: column; } .admin-card { padding: 16px; } }
`;

function fmt(value: number | string) {
  try {
    return new Date(value).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(value);
  }
}

function category(cat?: string) {
  switch (cat) {
    case "szukam": return <span className="tag amber">🔎 Szukam</span>;
    case "blad": return <span className="tag red">🐛 Błąd</span>;
    case "sugestia": return <span className="tag blue">💡 Sugestia</span>;
    default: return <span className="tag">Inne</span>;
  }
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [banIp, setBanIp] = useState("");
  const [banReason, setBanReason] = useState<ReportType>("abuse");
  const [banDurationMs, setBanDurationMs] = useState(86400000);
  const [banNote, setBanNote] = useState("");

  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Dostępni online", value: stats.online },
      { label: "Kolejka losowa", value: stats.queueSize },
      { label: "Prywatne rozmowy", value: stats.activeRooms },
      { label: "Aktywne pokoje publiczne", value: stats.publicRoomsActive },
      { label: "Użytkownicy w pokojach", value: stats.publicRoomUsers },
      { label: "Wiadomości publiczne", value: stats.publicMessages },
      { label: "Połączenia losowe", value: stats.totals.matches },
      { label: "Wiadomości prywatne", value: stats.totals.messages },
      { label: "Aktywne bany", value: stats.bansActive },
      { label: "Zgłoszenia botów", value: stats.reports.bot },
      { label: "Zgłoszenia nadużyć", value: stats.reports.abuse }
    ];
  }, [stats]);

  async function refresh() {
    setBusy(true);
    try {
      const [statsResult, bansResult, messagesResult, channelsResult] = await Promise.all([
        api.stats(),
        api.bans(),
        api.getMessages(),
        api.channels()
      ]);
      setStats(statsResult);
      setBans(bansResult.bans || []);
      setMessages(messagesResult.messages || []);
      setChannels(channelsResult.channels || []);
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : "Błąd odświeżania", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function logout() {
    try { await api.logout(); } catch {}
    onLogout();
  }

  async function ban() {
    const ip = banIp.trim();
    if (!ip) return setToast({ msg: "Wprowadź adres IP", type: "error" });
    setBusy(true);
    try {
      await api.ban(ip, banReason, banDurationMs, banNote.trim() || undefined);
      setBanIp("");
      setBanNote("");
      await refresh();
      setToast({ msg: `Zablokowano IP: ${ip}`, type: "success" });
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : "Błąd blokowania", type: "error" });
    } finally { setBusy(false); }
  }

  async function unban(ip: string) {
    if (!window.confirm(`Odblokować IP ${ip}?`)) return;
    setBusy(true);
    try {
      await api.unban(ip);
      await refresh();
      setToast({ msg: `Odblokowano IP: ${ip}`, type: "success" });
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : "Błąd odblokowania", type: "error" });
    } finally { setBusy(false); }
  }

  async function deleteMessage(id: string) {
    if (!window.confirm("Usunąć tę wiadomość?")) return;
    setBusy(true);
    try {
      await api.deleteMessage(id);
      await refresh();
      setToast({ msg: "Wiadomość usunięta", type: "success" });
    } catch { setToast({ msg: "Błąd usuwania", type: "error" }); }
    finally { setBusy(false); }
  }

  async function updateChannel(id: string, input: Parameters<typeof api.updateChannel>[1]) {
    setBusy(true);
    try {
      await api.updateChannel(id, input);
      await refresh();
      setToast({ msg: "Ustawienia pokoju zapisane", type: "success" });
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : "Błąd zapisu pokoju", type: "error" });
    } finally { setBusy(false); }
  }

  async function deleteChannel(channel: AdminChannel) {
    if (!window.confirm(`Trwale usunąć #${channel.slug} wraz z historią?`)) return;
    setBusy(true);
    try {
      await api.deleteChannel(channel.id);
      await refresh();
      setToast({ msg: `Usunięto #${channel.slug}`, type: "success" });
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : "Błąd usuwania pokoju", type: "error" });
    } finally { setBusy(false); }
  }

  return (
    <>
      <style>{adminStyles}</style>
      <div className="admin-layout">
        <div className="admin-container">
          <div className="admin-header">
            <div>
              <h1 className="admin-title">Panel Administratora Chati</h1>
              <p className="admin-subtitle">Odświeżanie co 5 sekund {stats && `• ${fmt(stats.now)}`}</p>
            </div>
            <div className="header-actions">
              <button className="btn btn-outline" onClick={() => void refresh()} disabled={busy}>{busy ? "Odświeżanie..." : "Odśwież"}</button>
              <button className="btn btn-danger" onClick={() => void logout()}>Wyloguj</button>
            </div>
          </div>

          {toast && <div className={`toast ${toast.type === "error" ? "error" : ""}`}>{toast.msg}</div>}

          <section className="admin-card">
            <div className="card-header"><h2 className="card-title">📊 Statystyki na żywo</h2></div>
            <div className="kpi-grid">
              {kpis.map((item) => <div className="kpi-box" key={item.label}><div className="kpi-value">{item.value}</div><div className="kpi-label">{item.label}</div></div>)}
            </div>
          </section>

          <section className="admin-card">
            <div className="card-header">
              <h2 className="card-title"># Pokoje publiczne</h2>
              <span className="tag blue">{channels.length} pokoi</span>
            </div>
            <div className="table-container">
              <table className="admin-table">
                <thead><tr><th>Pokój</th><th>Typ / właściciel</th><th>Aktywność</th><th>Goście</th><th>Slow mode</th><th>Wygaśnięcie</th><th>Status</th><th>Akcje</th></tr></thead>
                <tbody>
                  {channels.map((channel) => (
                    <tr key={channel.id}>
                      <td><div className="channel-name"><strong>#{channel.slug}</strong><small>{channel.topic || "Brak opisu"}</small></div></td>
                      <td>
                        <span className={`tag ${channel.isOfficial ? "blue" : ""}`}>{channel.isOfficial ? "Oficjalny" : "Społeczności"}</span>
                        <div className="muted" style={{ marginTop: 6 }}>{channel.creator?.nickname || "Chati"}</div>
                      </td>
                      <td><strong>{channel.online}</strong> online<div className="muted">{channel._count.messages} wiadomości • {fmt(channel.lastActivityAt)}</div></td>
                      <td>
                        <select className="admin-select compact" value={channel.allowGuests ? "yes" : "no"} disabled={busy} onChange={(event) => void updateChannel(channel.id, { allowGuests: event.target.value === "yes" })}>
                          <option value="yes">Dozwoleni</option><option value="no">Tylko konta</option>
                        </select>
                      </td>
                      <td>
                        <select className="admin-select compact" value={channel.slowModeSeconds} disabled={busy} onChange={(event) => void updateChannel(channel.id, { slowModeSeconds: Number(event.target.value) })}>
                          <option value={0}>Wyłączony</option><option value={5}>5 s</option><option value={15}>15 s</option><option value={30}>30 s</option><option value={60}>60 s</option>
                        </select>
                      </td>
                      <td>
                        {channel.isOfficial ? <span className="tag blue">Nigdy</span> : (
                          <button className={`btn btn-small ${channel.protectedFromExpiry ? "btn-primary" : "btn-outline"}`} disabled={busy} onClick={() => void updateChannel(channel.id, { protectedFromExpiry: !channel.protectedFromExpiry })}>
                            {channel.protectedFromExpiry ? "Chroniony" : "48 godzin"}
                          </button>
                        )}
                      </td>
                      <td>
                        <select className="admin-select compact" value={channel.status} disabled={busy || channel.isOfficial} onChange={(event) => void updateChannel(channel.id, { status: event.target.value as AdminChannel["status"] })}>
                          <option value="ACTIVE">Aktywny</option><option value="ARCHIVED">Archiwum</option><option value="DELETED">Ukryty</option>
                        </select>
                      </td>
                      <td>{!channel.isOfficial && <button className="btn btn-danger btn-small" disabled={busy} onClick={() => void deleteChannel(channel)}>Usuń</button>}</td>
                    </tr>
                  ))}
                  {!channels.length && <tr><td colSpan={8} style={{ textAlign: "center", color: "#94A3B8", padding: 28 }}>Brak pokoi.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card">
            <div className="card-header"><h2 className="card-title">🛡️ Ręczna blokada IP</h2></div>
            <div className="form-row">
              <input className="admin-input" placeholder="Adres IP" value={banIp} onChange={(event) => setBanIp(event.target.value)} style={{ flex: 1, minWidth: 200 }} />
              <select className="admin-select" value={banReason} onChange={(event) => setBanReason(event.target.value as ReportType)}><option value="abuse">Nadużycie</option><option value="bot">Bot</option></select>
              <select className="admin-select" value={banDurationMs} onChange={(event) => setBanDurationMs(Number(event.target.value))}><option value={3600000}>1 godzina</option><option value={86400000}>24 godziny</option><option value={604800000}>7 dni</option><option value={2592000000}>30 dni</option></select>
              <button className="btn btn-primary" onClick={() => void ban()} disabled={busy}>Zablokuj</button>
            </div>
            <textarea className="admin-textarea" placeholder="Notatka (opcjonalnie)" value={banNote} onChange={(event) => setBanNote(event.target.value)} />
          </section>

          <section className="admin-card">
            <div className="card-header"><h2 className="card-title">🚫 Aktywne blokady</h2><span className="tag red">{bans.length}</span></div>
            <div className="table-container"><table className="admin-table"><thead><tr><th>IP</th><th>Źródło</th><th>Zgłoszenia</th><th>Ważny do</th><th>Notatka</th><th>Akcja</th></tr></thead><tbody>
              {bans.map((record) => <tr key={record.ip}><td><span className="tag">{record.ip}</span></td><td>{record.source || "auto"}</td><td>Bot: {record.reasons?.bot ?? 0}, nadużycie: {record.reasons?.abuse ?? 0}</td><td>{fmt(record.until)}</td><td>{record.note || "-"}</td><td><button className="btn btn-danger btn-small" disabled={busy} onClick={() => void unban(record.ip)}>Odblokuj</button></td></tr>)}
              {!bans.length && <tr><td colSpan={6} style={{ textAlign: "center", color: "#94A3B8", padding: 28 }}>Brak aktywnych blokad.</td></tr>}
            </tbody></table></div>
          </section>

          <section className="admin-card">
            <div className="card-header"><h2 className="card-title">✉️ Wiadomości od użytkowników</h2><span className="tag blue">{messages.length}</span></div>
            <div className="table-container"><table className="admin-table"><thead><tr><th>Data</th><th>IP / email</th><th>Temat</th><th>Wiadomość</th><th>Akcja</th></tr></thead><tbody>
              {messages.map((item) => <tr key={item.id}><td>{fmt(item.createdAt)}</td><td>{item.ip}<div className="muted">{item.email}</div></td><td>{category(item.category)}<div style={{ marginTop: 7, fontWeight: 700 }}>{item.subject}</div></td><td style={{ whiteSpace: "pre-wrap" }}>{item.message}</td><td><button className="btn btn-outline btn-small" disabled={busy} onClick={() => void deleteMessage(item.id)}>Usuń</button></td></tr>)}
              {!messages.length && <tr><td colSpan={5} style={{ textAlign: "center", color: "#94A3B8", padding: 28 }}>Skrzynka jest pusta.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </div>
    </>
  );
}
