import React, { useEffect, useState } from "react";
import { api, type AdminUserDetail, type AdminUserSummary } from "../api";

const styles = `
  .launch-users { max-width: 1320px; margin: 0 auto 24px; padding: 0 24px; font-family: Inter, sans-serif; }
  .launch-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.02); }
  .launch-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:18px; }
  .launch-head h2 { margin:0 0 6px; font-size:20px; color:#0f172a; }
  .launch-head p { margin:0; color:#64748b; font-size:13px; }
  .launch-filter { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
  .launch-filter input,.launch-filter select { border:1px solid #cbd5e1; background:#f8fafc; border-radius:9px; padding:10px 12px; font:inherit; min-width:180px; }
  .launch-btn { border:0; border-radius:9px; padding:10px 14px; font-weight:700; cursor:pointer; background:#006aff; color:#fff; }
  .launch-btn.secondary { background:#fff; color:#334155; border:1px solid #cbd5e1; }
  .launch-btn.danger { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
  .launch-btn.success { background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; }
  .launch-btn:disabled { opacity:.5; cursor:not-allowed; }
  .launch-table-wrap { overflow:auto; }
  .launch-table { width:100%; min-width:920px; border-collapse:collapse; }
  .launch-table th { text-align:left; font-size:11px; text-transform:uppercase; color:#64748b; padding:11px; border-bottom:2px solid #e2e8f0; }
  .launch-table td { padding:12px 11px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#334155; vertical-align:top; }
  .launch-user-main { display:grid; gap:3px; }
  .launch-user-main strong { color:#0f172a; }
  .launch-user-main small { color:#64748b; }
  .launch-status { display:inline-flex; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:800; }
  .launch-status.ACTIVE { background:#ecfdf5; color:#047857; }
  .launch-status.SUSPENDED { background:#fffbeb; color:#b45309; }
  .launch-status.DELETED { background:#f1f5f9; color:#64748b; }
  .launch-actions { display:flex; gap:7px; flex-wrap:wrap; }
  .launch-actions .launch-btn { padding:7px 9px; font-size:11px; }
  .launch-pagination { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:16px; color:#64748b; font-size:12px; }
  .launch-detail { margin-top:18px; border-top:1px solid #e2e8f0; padding-top:18px; }
  .launch-detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  .launch-detail-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; }
  .launch-detail-box strong { display:block; color:#0f172a; margin-bottom:5px; }
  .launch-detail-box span,.launch-detail-box small { color:#64748b; font-size:12px; word-break:break-word; }
  .launch-session { padding:10px 0; border-bottom:1px solid #e2e8f0; display:grid; gap:3px; }
  .launch-notice { margin-bottom:14px; padding:11px 13px; border-radius:9px; background:#ecfdf5; color:#047857; font-size:13px; font-weight:700; }
  .launch-notice.error { background:#fef2f2; color:#dc2626; }
  @media(max-width:700px){.launch-users{padding:0 10px}.launch-card{padding:16px}.launch-head{flex-direction:column}.launch-filter input,.launch-filter select{width:100%}}
`;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pl-PL") : "—";
}

export default function UsersPanel() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminUserSummary["status"] | "">("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  async function load(nextPage = page) {
    setBusy(true);
    try {
      const result = await api.users({ q: query.trim() || undefined, status: status || undefined, page: nextPage, pageSize: 25 });
      setUsers(result.users);
      setPage(result.pagination.page);
      setPages(result.pagination.pages);
      setTotal(result.pagination.total);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się pobrać użytkowników.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function openUser(id: string) {
    setBusy(true);
    try {
      const result = await api.user(id);
      setSelected(result.user);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się pobrać konta.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(user: AdminUserSummary, nextStatus: "ACTIVE" | "SUSPENDED") {
    const action = nextStatus === "SUSPENDED" ? "zawiesić" : "reaktywować";
    if (!window.confirm(`Czy na pewno ${action} konto @${user.nickname}?`)) return;
    const reason = window.prompt("Powód działania (opcjonalnie):") || undefined;
    setBusy(true);
    try {
      const result = await api.setUserStatus(user.id, nextStatus, reason);
      setSelected(result.user);
      await load(page);
      setNotice({ text: nextStatus === "SUSPENDED" ? "Konto zawieszone i sesje zakończone." : "Konto reaktywowane." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się zmienić statusu.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function revokeSessions(user: AdminUserSummary) {
    if (!window.confirm(`Zakończyć wszystkie sesje konta @${user.nickname}?`)) return;
    const reason = window.prompt("Powód działania (opcjonalnie):") || undefined;
    setBusy(true);
    try {
      const result = await api.revokeUserSessions(user.id, reason);
      await openUser(user.id);
      setNotice({ text: `Zakończono sesje: ${result.revoked}.` });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się zakończyć sesji.", error: true });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(1); }, []);

  return (
    <section className="launch-users">
      <style>{styles}</style>
      <div className="launch-card">
        <div className="launch-head">
          <div><h2>👥 Użytkownicy</h2><p>Wyszukiwanie kont, sesje i działania administracyjne z historią audytową.</p></div>
          <button className="launch-btn secondary" onClick={() => void load(page)} disabled={busy}>Odśwież</button>
        </div>
        {notice && <div className={`launch-notice ${notice.error ? "error" : ""}`}>{notice.text}</div>}
        <form className="launch-filter" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="E-mail lub nazwa użytkownika" maxLength={100} />
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="">Wszystkie statusy</option>
            <option value="ACTIVE">Aktywne</option>
            <option value="SUSPENDED">Zawieszone</option>
            <option value="DELETED">Usunięte</option>
          </select>
          <button className="launch-btn" type="submit" disabled={busy}>Szukaj</button>
        </form>
        <div className="launch-table-wrap">
          <table className="launch-table">
            <thead><tr><th>Konto</th><th>Status</th><th>Weryfikacja</th><th>Ostatnia aktywność</th><th>Aktywność</th><th>Akcje</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><div className="launch-user-main"><strong>@{user.nickname}</strong><small>{user.email}</small><small>{user.id}</small></div></td>
                  <td><span className={`launch-status ${user.status}`}>{user.status}</span></td>
                  <td>{user.emailVerifiedAt ? "✓ Zweryfikowany" : "Niezweryfikowany"}</td>
                  <td>{formatDate(user.lastSeenAt)}<br/><small>Utworzono: {formatDate(user.createdAt)}</small></td>
                  <td><small>Pokoje: {user._count.createdChannels}<br/>Publiczne: {user._count.channelMessages}<br/>Prywatne: {user._count.sentDirectMessages + user._count.receivedDirectMessages}</small></td>
                  <td><div className="launch-actions">
                    <button className="launch-btn secondary" onClick={() => void openUser(user.id)} disabled={busy}>Szczegóły</button>
                    {user.status === "ACTIVE" && <button className="launch-btn danger" onClick={() => void changeStatus(user, "SUSPENDED")} disabled={busy}>Zawieś</button>}
                    {user.status === "SUSPENDED" && <button className="launch-btn success" onClick={() => void changeStatus(user, "ACTIVE")} disabled={busy}>Reaktywuj</button>}
                    {user.status !== "DELETED" && <button className="launch-btn secondary" onClick={() => void revokeSessions(user)} disabled={busy}>Wyloguj wszędzie</button>}
                  </div></td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan={6}>Brak pasujących kont.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="launch-pagination"><span>{total} kont • strona {page} z {pages}</span><div className="launch-actions"><button className="launch-btn secondary" disabled={busy || page <= 1} onClick={() => void load(page - 1)}>Wstecz</button><button className="launch-btn secondary" disabled={busy || page >= pages} onClick={() => void load(page + 1)}>Dalej</button></div></div>

        {selected && <div className="launch-detail">
          <div className="launch-head"><div><h2>@{selected.nickname}</h2><p>{selected.email} • {selected.id}</p></div><button className="launch-btn secondary" onClick={() => setSelected(null)}>Zamknij</button></div>
          <div className="launch-detail-grid">
            <div className="launch-detail-box"><strong>Prywatność</strong><span>Zaproszenia: {selected.friendRequestPolicy}<br/>DM: {selected.allowDirectMessages ? "tak" : "nie"}<br/>Online: {selected.showOnline ? "widoczny" : "ukryty"}<br/>Ostatnia aktywność: {selected.showLastSeen ? "widoczna" : "ukryta"}</span></div>
            <div className="launch-detail-box"><strong>Relacje i pokoje</strong><span>Członkostwa: {selected._count.channelMemberships}<br/>Ulubione: {selected._count.channelFavourites}<br/>Zaproszenia: {selected._count.friendshipRequests + selected._count.friendshipResponses}<br/>Powiadomienia: {selected._count.notifications}</span></div>
            <div className="launch-detail-box"><strong>Sesje</strong><span>{selected.sessions.filter((session) => !session.revokedAt && new Date(session.expiresAt) > new Date()).length} aktywnych / {selected.sessions.length} ostatnich</span></div>
          </div>
          <div className="launch-detail-grid" style={{marginTop:12}}>
            <div className="launch-detail-box"><strong>Ostatnie sesje</strong>{selected.sessions.slice(0,8).map((session) => <div className="launch-session" key={session.id}><span>{session.locationLabel || "Lokalizacja niedostępna"} • {session.revokedAt ? "zakończona" : "aktywna"}</span><small>{formatDate(session.lastSeenAt)}<br/>{session.userAgent || "Brak user-agent"}</small></div>)}</div>
            <div className="launch-detail-box"><strong>Utworzone pokoje</strong>{selected.createdChannels.length ? selected.createdChannels.map((channel) => <div className="launch-session" key={channel.id}><span>#{channel.slug} • {channel.status}</span><small>{channel.name} • {formatDate(channel.createdAt)}</small></div>) : <small>Brak pokojów.</small>}</div>
          </div>
        </div>}
      </div>
    </section>
  );
}
