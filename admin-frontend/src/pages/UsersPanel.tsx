import React, { useEffect, useState } from "react";
import { api, type AdminUserDetail, type AdminUserSummary } from "../api";

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pl-PL") : "—";
}

function statusBadge(status: AdminUserSummary["status"]) {
  if (status === "ACTIVE") return <span className="admin-badge admin-badge-green">Aktywne</span>;
  if (status === "SUSPENDED") return <span className="admin-badge admin-badge-amber">Zawieszone</span>;
  return <span className="admin-badge admin-badge-neutral">Usunięte</span>;
}

type UserFilters = {
  query: string;
  status: AdminUserSummary["status"] | "";
};

export default function UsersPanel() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminUserSummary["status"] | "">("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  async function load(nextPage = page, override?: Partial<UserFilters>) {
    const nextQuery = override?.query ?? query;
    const nextStatus = override?.status ?? status;
    setBusy(true);
    try {
      const result = await api.users({
        q: nextQuery.trim() || undefined,
        status: nextStatus || undefined,
        page: nextPage,
        pageSize: 25
      });
      setUsers(result.users);
      setPage(result.pagination.page);
      setPages(result.pagination.pages);
      setTotal(result.pagination.total);
      setNotice((current) => current?.error ? null : current);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się pobrać użytkowników.", error: true });
    } finally {
      setBusy(false);
      setLoaded(true);
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
      setNotice({ text: nextStatus === "SUSPENDED" ? "Konto zawieszone, a aktywne sesje zakończone." : "Konto zostało reaktywowane." });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się zmienić statusu konta.", error: true });
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
      setNotice({ text: `Zakończono ${result.revoked} aktywnych sesji.` });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Nie udało się zakończyć sesji.", error: true });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", close);
    };
  }, [selected]);

  function clearFilters() {
    setQuery("");
    setStatus("");
    void load(1, { query: "", status: "" });
  }

  return (
    <div className="admin-page">
      <div className="admin-page-toolbar">
        <div className="admin-page-toolbar-copy">
          <strong>{total} kont w bazie</strong>
          <span>Otwórz konto, aby zobaczyć sesje, ustawienia prywatności i utworzone pokoje.</span>
        </div>
        <button className="admin-button admin-button-quiet" type="button" onClick={() => void load(page)} disabled={busy}>
          {busy ? <><span className="admin-spinner"/>Odświeżanie</> : "Odśwież dane"}
        </button>
      </div>

      {notice && <div className={`admin-notice ${notice.error ? "admin-notice-error" : ""}`} role="status">{notice.text}</div>}

      <section className="admin-card">
        <form className="admin-filter-bar" onSubmit={(event) => { event.preventDefault(); void load(1); }}>
          <input
            className="admin-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj po e-mailu lub nazwie użytkownika"
            maxLength={100}
          />
          <select className="admin-select" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="">Wszystkie statusy</option>
            <option value="ACTIVE">Aktywne</option>
            <option value="SUSPENDED">Zawieszone</option>
            <option value="DELETED">Usunięte</option>
          </select>
          <button className="admin-button" type="submit" disabled={busy}>Szukaj</button>
          {(query || status) && <button className="admin-button admin-button-quiet" type="button" disabled={busy} onClick={clearFilters}>Wyczyść</button>}
        </form>

        {!loaded ? (
          <div className="admin-empty"><span className="admin-spinner"/><strong>Ładowanie kont</strong><span>Pobieramy dane użytkowników.</span></div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table" style={{ minWidth: 970 }}>
              <thead><tr><th>Konto</th><th>Status</th><th>Weryfikacja</th><th>Ostatnia aktywność</th><th>Aktywność</th><th>Akcje</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-primary-text">@{user.nickname}</div>
                      <div className="admin-secondary-text">{user.email}</div>
                      <div className="admin-mono">{user.id}</div>
                    </td>
                    <td>{statusBadge(user.status)}</td>
                    <td>{user.emailVerifiedAt ? <span className="admin-badge admin-badge-green">Zweryfikowany</span> : <span className="admin-badge admin-badge-amber">Oczekuje</span>}</td>
                    <td><div className="admin-primary-text">{formatDate(user.lastSeenAt)}</div><div className="admin-secondary-text">Utworzono: {formatDate(user.createdAt)}</div></td>
                    <td><div className="admin-secondary-text">Pokoje: {user._count.createdChannels}<br/>Publiczne wiadomości: {user._count.channelMessages}<br/>Prywatne wiadomości: {user._count.sentDirectMessages + user._count.receivedDirectMessages}</div></td>
                    <td>
                      <div className="admin-inline-actions">
                        <button className="admin-button admin-button-small admin-button-quiet" type="button" onClick={() => void openUser(user.id)} disabled={busy}>Szczegóły</button>
                        {user.status === "ACTIVE" && <button className="admin-button admin-button-small admin-button-danger-quiet" type="button" onClick={() => void changeStatus(user, "SUSPENDED")} disabled={busy}>Zawieś</button>}
                        {user.status === "SUSPENDED" && <button className="admin-button admin-button-small admin-button-success-quiet" type="button" onClick={() => void changeStatus(user, "ACTIVE")} disabled={busy}>Reaktywuj</button>}
                        {user.status !== "DELETED" && <button className="admin-button admin-button-small admin-button-quiet" type="button" onClick={() => void revokeSessions(user)} disabled={busy}>Wyloguj wszędzie</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.length && <tr><td colSpan={6}><div className="admin-empty"><strong>Brak pasujących kont</strong><span>Zmień wyszukiwanie lub filtr statusu.</span></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-card-section admin-page-toolbar">
          <div className="admin-secondary-text">Strona {page} z {pages} • {total} kont</div>
          <div className="admin-inline-actions">
            <button className="admin-button admin-button-small admin-button-quiet" type="button" disabled={busy || page <= 1} onClick={() => void load(page - 1)}>Poprzednia</button>
            <button className="admin-button admin-button-small admin-button-quiet" type="button" disabled={busy || page >= pages} onClick={() => void load(page + 1)}>Następna</button>
          </div>
        </div>
      </section>

      {selected && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <aside className="admin-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-user-detail-title">
            <div className="admin-drawer-header">
              <div><span className="admin-eyebrow">Szczegóły konta</span><h2 id="admin-user-detail-title">@{selected.nickname}</h2><p>{selected.email} • {selected.id}</p></div>
              <button className="admin-button admin-button-quiet" type="button" onClick={() => setSelected(null)}>Zamknij</button>
            </div>
            <div className="admin-drawer-body">
              <section className="admin-card">
                <div className="admin-card-header"><div><h3 className="admin-card-title">Stan konta</h3><span className="admin-card-subtitle">Dane profilu i bezpieczeństwa.</span></div>{statusBadge(selected.status)}</div>
                <div className="admin-card-body admin-detail-grid">
                  <div className="admin-detail-box"><strong>Weryfikacja e-mail</strong><span>{selected.emailVerifiedAt ? formatDate(selected.emailVerifiedAt) : "Niezweryfikowany"}</span></div>
                  <div className="admin-detail-box"><strong>Ostatnia aktywność</strong><span>{formatDate(selected.lastSeenAt)}</span></div>
                  <div className="admin-detail-box"><strong>Utworzono</strong><span>{formatDate(selected.createdAt)}</span></div>
                </div>
              </section>

              <section className="admin-card">
                <div className="admin-card-header"><div><h3 className="admin-card-title">Prywatność i aktywność</h3></div></div>
                <div className="admin-card-body admin-detail-grid">
                  <div className="admin-detail-box"><strong>Ustawienia prywatności</strong><span>Zaproszenia: {selected.friendRequestPolicy}<br/>Wiadomości prywatne: {selected.allowDirectMessages ? "dozwolone" : "wyłączone"}<br/>Online: {selected.showOnline ? "widoczny" : "ukryty"}<br/>Ostatnia aktywność: {selected.showLastSeen ? "widoczna" : "ukryta"}</span></div>
                  <div className="admin-detail-box"><strong>Relacje</strong><span>Członkostwa: {selected._count.channelMemberships}<br/>Ulubione: {selected._count.channelFavourites}<br/>Zaproszenia: {selected._count.friendshipRequests + selected._count.friendshipResponses}<br/>Powiadomienia: {selected._count.notifications}</span></div>
                  <div className="admin-detail-box"><strong>Wiadomości</strong><span>Publiczne: {selected._count.channelMessages}<br/>Wysłane prywatne: {selected._count.sentDirectMessages}<br/>Odebrane prywatne: {selected._count.receivedDirectMessages}</span></div>
                </div>
              </section>

              <section className="admin-card">
                <div className="admin-card-header"><div><h3 className="admin-card-title">Ostatnie sesje</h3><span className="admin-card-subtitle">Maksymalnie 20 ostatnich rekordów.</span></div><span className="admin-badge admin-badge-blue">{selected.sessions.filter((session) => !session.revokedAt && new Date(session.expiresAt) > new Date()).length} aktywnych</span></div>
                <div className="admin-card-body">
                  {selected.sessions.slice(0, 10).map((session) => (
                    <div className="admin-list-row" key={session.id}>
                      <div className="admin-primary-text">{session.locationLabel || "Lokalizacja niedostępna"} • {session.revokedAt ? "zakończona" : "aktywna"}</div>
                      <div className="admin-secondary-text">Ostatnia aktywność: {formatDate(session.lastSeenAt)}<br/>{session.userAgent || "Brak danych przeglądarki"}</div>
                    </div>
                  ))}
                  {!selected.sessions.length && <div className="admin-empty"><strong>Brak sesji</strong><span>Konto nie ma zapisanych sesji.</span></div>}
                </div>
              </section>

              <section className="admin-card">
                <div className="admin-card-header"><div><h3 className="admin-card-title">Utworzone pokoje</h3></div><span className="admin-badge admin-badge-neutral">{selected.createdChannels.length}</span></div>
                <div className="admin-card-body">
                  {selected.createdChannels.map((channel) => <div className="admin-list-row" key={channel.id}><div className="admin-primary-text">#{channel.slug} • {channel.status}</div><div className="admin-secondary-text">{channel.name} • {formatDate(channel.createdAt)}</div></div>)}
                  {!selected.createdChannels.length && <div className="admin-empty"><strong>Brak pokojów</strong><span>To konto nie utworzyło żadnego pokoju.</span></div>}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
