import React, { useEffect, useMemo, useState } from "react";
import { api, BanRecord, ReportType, Stats } from "../api";

// ---------------- Style dla Panelu Admina ----------------
const adminStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  .admin-layout { font-family: 'Inter', sans-serif; background: #F8FAFC; color: #111827; min-height: 100vh; padding: 32px 24px; }
  .admin-container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
  
  /* Header */
  .admin-header { display: flex; justify-content: space-between; align-items: flex-end; background: #FFFFFF; padding: 24px; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
  .admin-title { font-size: 24px; font-weight: 800; color: #111827; margin: 0 0 8px 0; }
  .admin-subtitle { font-size: 14px; color: #64748B; font-weight: 500; margin: 0; }
  .header-actions { display: flex; gap: 12px; }

  /* Karty i sekcje */
  .admin-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .card-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0; }

  /* KPI Grid (Statystyki) */
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .kpi-box { background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; }
  .kpi-value { font-size: 28px; font-weight: 800; color: #006AFF; margin-bottom: 4px; }
  .kpi-label { font-size: 13px; font-weight: 600; color: #64748B; }

  /* Formularze i Przyciski */
  .form-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .admin-input, .admin-select, .admin-textarea { background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px 16px; font-size: 14px; color: #111827; outline: none; transition: border-color 0.2s; font-family: inherit; }
  .admin-input:focus, .admin-select:focus, .admin-textarea:focus { border-color: #006AFF; background: #FFFFFF; }
  .admin-textarea { width: 100%; min-height: 80px; resize: vertical; margin-top: 12px; }
  
  .btn { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: #006AFF; color: #FFFFFF; }
  .btn-primary:hover:not(:disabled) { background: #0056D6; }
  .btn-outline { background: #FFFFFF; color: #475569; border: 1px solid #CBD5E1; }
  .btn-outline:hover:not(:disabled) { background: #F8FAFC; color: #111827; }
  .btn-danger { background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; }
  .btn-danger:hover:not(:disabled) { background: #FEE2E2; }

  /* Tabele */
  .table-container { overflow-x: auto; margin-top: 12px; }
  .admin-table { width: 100%; border-collapse: collapse; text-align: left; }
  .admin-table th { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; padding: 12px 16px; border-bottom: 2px solid #E2E8F0; }
  .admin-table td { padding: 16px; border-bottom: 1px solid #E2E8F0; font-size: 14px; color: #1F2937; vertical-align: top; }
  .admin-table tbody tr:hover { background: #F8FAFC; }
  
  .tag { display: inline-block; padding: 4px 10px; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 999px; font-size: 12px; font-weight: 600; color: #475569; }
  .toast { padding: 12px 16px; background: #10B981; color: white; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 16px; animation: fadeIn 0.3s; }
  .toast.error { background: #EF4444; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
`;
// ---------------------------------------------------------

function fmt(ts: number) {
  try {
    return new Date(ts).toLocaleString('pl-PL', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  } catch {
    return String(ts);
  }
}
function renderCategory(cat?: string) {
  switch(cat) {
    case "szukam": return <span className="tag" style={{background: "#FEF3C7", color: "#D97706", border: "none"}}>🔎 Szukam</span>;
    case "blad": return <span className="tag" style={{background: "#FEE2E2", color: "#DC2626", border: "none"}}>🐛 Błąd</span>;
    case "sugestia": return <span className="tag" style={{background: "#E0E7FF", color: "#4338CA", border: "none"}}>💡 Sugestia</span>;
    default: return <span className="tag">Inne</span>;
  }
}
function tag(text: string) {
  return <span className="tag">{text}</span>;
}

export default function Dashboard(props: { onLogout: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [banIp, setBanIp] = useState("");
  const [banReason, setBanReason] = useState<ReportType>("abuse");
  const [banDurationMs, setBanDurationMs] = useState<number>(86400000);
  const [banNote, setBanNote] = useState("");

  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      { l: "Dostępni online", v: stats.online },
      { l: "Oczekujący (Kolejka)", v: stats.queueSize },
      { l: "Aktywne Pokoje", v: stats.activeRooms },
      { l: "Aktywne Blokady (Bany)", v: stats.bansActive },
      { l: "Połączenia (Suma)", v: stats.totals.matches },
      { l: "Wiadomości (Suma)", v: stats.totals.messages },
      { l: "Połączenia (ostatnie 60s)", v: stats.last60s.matches },
      { l: "Wiadomości (ostatnie 60s)", v: stats.last60s.messages },
      { l: "Zgłoszenia - Boty", v: stats.reports.bot },
      { l: "Zgłoszenia - Nadużycia", v: stats.reports.abuse },
      { l: "Okno czasowe zgłoszeń", v: Math.round(stats.reports.windowMs / 60000) + " min" }
    ];
  }, [stats]);
const [messages, setMessages] = useState<any[]>([]); // Dodany stan dla wiadomości

  async function refresh() {
    setBusy(true);
    try {
      const [s, b, m] = await Promise.all([api.stats(), api.bans(), api.getMessages()]); 
      setStats(s);
      setBans(b.bans || []);
      setMessages(m.messages || []); 
    } catch (e: any) {
      setToast({ msg: e?.message || "Błąd odświeżania", type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function doDeleteMessage(id: string) {
    if (!window.confirm("Usunąć tę wiadomość?")) return;
    setBusy(true);
    try {
      await api.deleteMessage(id);
      await refresh();
      setToast({ msg: "Wiadomość usunięta", type: 'success' });
    } catch {
      setToast({ msg: "Błąd usuwania", type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => refresh(), 5000);
    return () => window.clearInterval(t);
  }, []);

  async function doLogout() {
    setToast(null);
    try {
      await api.logout();
    } catch {}
    props.onLogout();
  }

  async function doBan() {
    setToast(null);
    const ip = banIp.trim();
    if (!ip) return setToast({ msg: "Wprowadź adres IP", type: 'error' });
    setBusy(true);
    try {
      await api.ban(ip, banReason, banDurationMs, banNote.trim() || undefined);
      setBanIp("");
      setBanNote("");
      await refresh();
      setToast({ msg: "Zablokowano IP: " + ip, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setToast({ msg: e?.message || "Blokowanie nie powiodło się", type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function doUnban(ip: string) {
    if (!window.confirm(`Czy na pewno chcesz odblokować IP: ${ip}?`)) return;
    setToast(null);
    setBusy(true);
    try {
      await api.unban(ip);
      await refresh();
      setToast({ msg: "Odblokowano IP: " + ip, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setToast({ msg: e?.message || "Odblokowanie nie powiodło się", type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{adminStyles}</style>
      <div className="admin-layout">
        <div className="admin-container">
          
          {/* HEADER */}
          <div className="admin-header">
            <div>
              <h1 className="admin-title">Panel Administratora</h1>
              <p className="admin-subtitle">
                Automatyczne odświeżanie: 5s 
                {stats && <span> • Ostatnia aktualizacja: {fmt(stats.now)}</span>}
              </p>
            </div>
            <div className="header-actions">
              <button className="btn btn-outline" onClick={refresh} disabled={busy}>
                {busy ? "Odświeżanie..." : "Odśwież ręcznie"}
              </button>
              <button className="btn btn-danger" onClick={doLogout}>
                Wyloguj
              </button>
            </div>
          </div>

          {/* POWIADOMIENIA (TOAST) */}
          {toast && (
            <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>
              {toast.msg}
            </div>
          )}

          {/* STATYSTYKI */}
          <div className="admin-card">
            <div className="card-header">
              <h2 className="card-title">📊 Statystyki na żywo</h2>
            </div>
            <div className="kpi-grid">
              {kpis.map((k) => (
                <div className="kpi-box" key={k.l}>
                  <div className="kpi-value">{k.v ?? "-"}</div>
                  <div className="kpi-label">{k.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RĘCZNA BLOKADA (BAN) */}
          <div className="admin-card">
            <div className="card-header">
              <h2 className="card-title">🛡️ Ręczna blokada (Ban)</h2>
            </div>
            <div className="form-row">
              <input
                className="admin-input"
                placeholder="Adres IP (np. 1.2.3.4)"
                value={banIp}
                onChange={(e) => setBanIp(e.target.value)}
                style={{ flex: "1", minWidth: "200px" }}
              />
              
              <select
                className="admin-select"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value as ReportType)}
              >
                <option value="abuse">Nadużycie (Abuse)</option>
                <option value="bot">Podejrzenie Bota</option>
              </select>

              <select
                className="admin-select"
                value={String(banDurationMs)}
                onChange={(e) => setBanDurationMs(Number(e.target.value))}
              >
                <option value="3600000">1 godzina</option>
                <option value="21600000">6 godzin</option>
                <option value="86400000">24 godziny</option>
                <option value="604800000">7 dni</option>
                <option value="2592000000">30 dni</option>
              </select>

              <button className="btn btn-primary" onClick={doBan} disabled={busy}>
                Zablokuj IP
              </button>
            </div>
            
            <textarea
              className="admin-textarea"
              placeholder="Wewnętrzna notatka (opcjonalnie)"
              value={banNote}
              onChange={(e) => setBanNote(e.target.value)}
            />
            <p className="admin-subtitle" style={{ marginTop: "12px", fontSize: "13px" }}>
              Bany są zapisywane trwale na serwerze. Adresy IP dodane do białej listy (Whitelist) nie mogą zostać zablokowane.
            </p>
          </div>

          {/* AKTYWNE BLOKADY (TABELA) */}
          <div className="admin-card">
            <div className="card-header">
              <h2 className="card-title">🚫 Aktywne Blokady</h2>
              <span className="tag" style={{ background: "#FEF2F2", color: "#DC2626", border: "none" }}>
                {bans.length} aktywnych
              </span>
            </div>
            
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Adres IP</th>
                    <th>Źródło</th>
                    <th>Oflagowany</th>
                    <th>Zgłoszenia</th>
                    <th>Ważny do</th>
                    <th>Notatka</th>
                    <th style={{ textAlign: "right" }}>Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {bans.map((b) => (
                    <tr key={b.ip}>
                      <td>{tag(b.ip)}</td>
                      <td>{tag(b.source || "auto")}</td>
                      <td>{b.flagged ? tag("Tak") : tag("Nie")}</td>
                      <td>
                        <span style={{ fontSize: "13px", color: "#64748B" }}>
                          Bot: <b>{b.reasons?.bot ?? 0}</b>, Nadużycie: <b>{b.reasons?.abuse ?? 0}</b>
                        </span>
                      </td>
                      <td>{fmt(b.until)}</td>
                      <td style={{ maxWidth: "300px", whiteSpace: "pre-wrap", color: "#64748B" }}>
                        {b.note || "-"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: "6px 12px", fontSize: "13px", borderColor: "#FCA5A5", color: "#DC2626" }} 
                          onClick={() => doUnban(b.ip)} 
                          disabled={busy}
                        >
                          Odblokuj
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!bans.length && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#94A3B8", padding: "32px 0" }}>
                        Brak aktywnych blokad. Serwer jest czysty! ✨
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
{/* SKRZYNKA ODBIORCZA (FORMULARZ KONTAKTOWY) */}
          <div className="admin-card">
            <div className="card-header">
              <h2 className="card-title">✉️ Wiadomości od użytkowników</h2>
              <span className="tag" style={{ background: "#EFF6FF", color: "#1D4ED8", border: "none" }}>
                {messages.length} wiadomości
              </span>
            </div>
            
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: "15%" }}>Data</th>
                    <th style={{ width: "15%" }}>IP / Email</th>
                    <th style={{ width: "20%" }}>Temat</th>
                    <th style={{ width: "40%" }}>Wiadomość</th>
                    <th style={{ width: "10%", textAlign: "right" }}>Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.id}>
                      <td>{fmt(m.createdAt)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.ip}</div>
                        {m.email && <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>{m.email}</div>}
                      </td>
                      <td>
    <div style={{ marginBottom: "8px" }}>{renderCategory(m.category)}</div>
    <div style={{ fontWeight: 600, fontSize: "15px" }}>{m.subject}</div>
  </td>
                      <td style={{ whiteSpace: "pre-wrap", color: "#475569" }}>{m.message}</td>
                      <td style={{ textAlign: "right" }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: "6px 12px", fontSize: "13px" }} 
                          onClick={() => doDeleteMessage(m.id)} 
                          disabled={busy}
                        >
                          Usuń
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!messages.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "#94A3B8", padding: "32px 0" }}>
                        Brak nowych wiadomości. Skrzynka jest pusta! 📭
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}