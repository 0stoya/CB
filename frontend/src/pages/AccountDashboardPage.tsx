import React, { useEffect, useMemo, useState } from "react";
import {
  AccountDashboardApiError,
  accountDashboardApi,
  type AccountOverview
} from "../api/accountDashboard";
import { accountApi } from "../api/auth";
import { socialApi, type SocialSettings } from "../api/social";
import { socket } from "../socket";
import { ChatiLogo } from "../components/Icons";
import "./account-dashboard.css";

type Notice = { type: "success" | "error"; text: string };
type Section = "profile" | "privacy" | "rooms" | "security" | "data";

function formatDate(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function errorMessage(error: unknown) {
  const code = error instanceof AccountDashboardApiError ? error.code : error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    NICKNAME_ALREADY_USED: "Ta nazwa użytkownika jest już zajęta.",
    INVALID_CURRENT_PASSWORD: "Obecne hasło jest nieprawidłowe.",
    SESSION_NOT_FOUND: "Ta sesja już nie istnieje.",
    CHANNEL_MEMBERSHIP_NOT_FOUND: "Nie należysz już do tego pokoju.",
    INVALID_DELETE_CONFIRMATION: "Wpisz dokładnie: USUŃ KONTO",
    AUTH_REQUIRED: "Sesja wygasła. Zaloguj się ponownie.",
    EXPORT_FAILED: "Nie udało się przygotować eksportu."
  };
  return messages[code] || "Nie udało się wykonać operacji. Spróbuj ponownie.";
}

export default function AccountDashboardPage({
  navigate
}: {
  navigate: (path: string) => void;
}) {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [section, setSection] = useState<Section>("profile");
  const [nickname, setNickname] = useState("");
  const [privacy, setPrivacy] = useState<SocialSettings | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const favouriteIds = useMemo(
    () => new Set(overview?.favourites.map((item) => item.channel.id) ?? []),
    [overview]
  );

  async function refresh() {
    const result = await accountDashboardApi.overview();
    setOverview(result);
    setNickname(result.user.nickname);
    setPrivacy({
      friendRequestPolicy: result.user.friendRequestPolicy,
      allowDirectMessages: result.user.allowDirectMessages,
      showOnline: result.user.showOnline,
      showLastSeen: result.user.showLastSeen
    });
  }

  useEffect(() => {
    void refresh().catch(() => navigate("/konto/logowanie"));
  }, []);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ type: "success", text: success });
    } catch (error) {
      setNotice({ type: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (!overview || !privacy) {
    return <div className="account-dashboard-loading">Ładujemy Twoje konto…</div>;
  }

  return (
    <div className="account-dashboard-layout">
      <header className="account-dashboard-header">
        <button type="button" className="account-dashboard-brand" onClick={() => navigate("/")}>
          <ChatiLogo size={34} />
          <span>Chati</span>
          <strong>Konto</strong>
        </button>
        <div className="account-dashboard-header-actions">
          <button type="button" onClick={() => navigate("/znajomi")}>Znajomi</button>
          <button type="button" onClick={() => navigate("/pokoje")}>Pokoje</button>
          <button
            type="button"
            className="danger-text"
            onClick={() => void accountApi.logout().finally(() => navigate("/"))}
          >
            Wyloguj
          </button>
        </div>
      </header>

      {notice && (
        <div className={`account-dashboard-notice ${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <div className="account-dashboard-shell">
        <aside className="account-dashboard-nav">
          <div className="account-profile-summary">
            <span>{overview.user.nickname.slice(0, 1).toUpperCase()}</span>
            <div><strong>{overview.user.nickname}</strong><small>{overview.user.email}</small></div>
          </div>
          {([
            ["profile", "Profil"],
            ["privacy", "Prywatność"],
            ["rooms", "Pokoje i ulubione"],
            ["security", "Hasło i sesje"],
            ["data", "Dane i usunięcie konta"]
          ] as [Section, string][]).map(([value, label]) => (
            <button
              type="button"
              className={section === value ? "active" : ""}
              key={value}
              onClick={() => setSection(value)}
            >
              {label}
            </button>
          ))}
        </aside>

        <main className="account-dashboard-content">
          {section === "profile" && (
            <section className="account-section-card">
              <div className="account-section-heading">
                <div><h1>Profil</h1><p>Zarządzaj nazwą widoczną w pokojach i rozmowach.</p></div>
                <span className="verified-pill">✓ E-mail potwierdzony</span>
              </div>
              <div className="account-form-grid">
                <label><span>Adres e-mail</span><input value={overview.user.email} disabled /></label>
                <label>
                  <span>Nazwa użytkownika</span>
                  <input value={nickname} minLength={3} maxLength={24} onChange={(event) => setNickname(event.target.value)} />
                  <small>Litery, cyfry, _ lub -. Zmiana dotyczy nowych wiadomości.</small>
                </label>
              </div>
              <button
                type="button"
                className="primary-action"
                disabled={busy || nickname.trim() === overview.user.nickname}
                onClick={() => void run(async () => {
                  await accountDashboardApi.updateProfile(nickname.trim());
                  await refresh();
                }, "Profil został zapisany.")}
              >
                Zapisz profil
              </button>
              <div className="account-meta-row">
                <span>Konto utworzone</span><strong>{formatDate(overview.user.createdAt)}</strong>
              </div>
            </section>
          )}

          {section === "privacy" && (
            <section className="account-section-card">
              <div className="account-section-heading"><div><h1>Prywatność</h1><p>Kontroluj zaproszenia, wiadomości i widoczność aktywności.</p></div></div>
              <div className="privacy-stack">
                <label>
                  <span>Kto może wysyłać zaproszenia?</span>
                  <select
                    value={privacy.friendRequestPolicy}
                    onChange={(event) => setPrivacy({ ...privacy, friendRequestPolicy: event.target.value as SocialSettings["friendRequestPolicy"] })}
                  >
                    <option value="EVERYONE">Wszyscy</option>
                    <option value="SHARED_CHANNELS">Osoby ze wspólnych pokojów</option>
                    <option value="NOBODY">Nikt</option>
                  </select>
                </label>
                <label className="account-toggle"><input type="checkbox" checked={privacy.allowDirectMessages} onChange={(event) => setPrivacy({ ...privacy, allowDirectMessages: event.target.checked })} /><span><strong>Wiadomości prywatne</strong><small>Zezwalaj znajomym na wysyłanie wiadomości.</small></span></label>
                <label className="account-toggle"><input type="checkbox" checked={privacy.showOnline} onChange={(event) => setPrivacy({ ...privacy, showOnline: event.target.checked })} /><span><strong>Status online</strong><small>Pokazuj znajomym, gdy korzystasz z Chati.</small></span></label>
                <label className="account-toggle"><input type="checkbox" checked={privacy.showLastSeen} onChange={(event) => setPrivacy({ ...privacy, showLastSeen: event.target.checked })} /><span><strong>Ostatnia aktywność</strong><small>Pokazuj czas ostatniego połączenia.</small></span></label>
              </div>
              <button
                type="button"
                className="primary-action"
                disabled={busy}
                onClick={() => void run(async () => {
                  await socialApi.updateSettings(privacy);
                  await refresh();
                }, "Ustawienia prywatności zapisane.")}
              >
                Zapisz prywatność
              </button>
              <div className="blocked-section">
                <div><h2>Zablokowani użytkownicy</h2><button type="button" onClick={() => navigate("/znajomi")}>Otwórz znajomych</button></div>
                {!overview.blocked.length && <p>Nikogo nie blokujesz.</p>}
                {overview.blocked.map((item) => (
                  <div className="blocked-row" key={item.id}>
                    <strong>{item.nickname}</strong>
                    <button type="button" disabled={busy} onClick={() => void run(async () => {
                      await socialApi.unblockUser(item.id);
                      await refresh();
                    }, `Odblokowano ${item.nickname}.`)}>Odblokuj</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === "rooms" && (
            <section className="account-section-card">
              <div className="account-section-heading"><div><h1>Pokoje i ulubione</h1><p>Zarządzaj automatycznym dołączaniem i powiadomieniami o wzmiankach.</p></div></div>
              <div className="account-room-list">
                {overview.memberships.map((membership) => {
                  const favourite = overview.favourites.find((item) => item.channel.id === membership.channel.id);
                  return (
                    <div className="account-room-row" key={membership.channel.id}>
                      <div><strong>#{membership.channel.slug}</strong><span>{membership.role === "OWNER" ? "Właściciel" : membership.role === "MODERATOR" ? "Moderator" : favouriteIds.has(membership.channel.id) ? "Ulubiony" : "Uczestnik"}</span></div>
                      <div className="account-room-actions">
                        {favourite && <span className="small-pill">{favourite.autoJoin ? "Auto-join" : "Ulubiony"}</span>}
                        <label><input type="checkbox" checked={!membership.muteNotifications} onChange={(event) => void run(async () => {
                          await accountDashboardApi.setRoomNotificationsMuted(membership.channel.id, !event.target.checked);
                          await refresh();
                        }, event.target.checked ? "Włączono powiadomienia pokoju." : "Wyciszono powiadomienia pokoju.")} /><span>Wzmianki</span></label>
                        <button type="button" onClick={() => navigate(`/pokoje?room=${encodeURIComponent(membership.channel.slug)}`)}>Otwórz</button>
                      </div>
                    </div>
                  );
                })}
                {!overview.memberships.length && <p className="account-empty">Nie należysz jeszcze do żadnego pokoju.</p>}
              </div>
            </section>
          )}

          {section === "security" && (
            <div className="account-section-stack">
              <section className="account-section-card">
                <div className="account-section-heading"><div><h1>Zmień hasło</h1><p>Pozostałe urządzenia zostaną automatycznie wylogowane.</p></div></div>
                <div className="account-form-grid">
                  <label><span>Obecne hasło</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                  <label><span>Nowe hasło</span><input type="password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                  <label><span>Powtórz nowe hasło</span><input type="password" minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
                </div>
                <button type="button" className="primary-action" disabled={busy || newPassword.length < 10 || newPassword !== confirmPassword} onClick={() => void run(async () => {
                  await accountDashboardApi.changePassword(currentPassword, newPassword);
                  setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
                  await refresh();
                }, "Hasło zmienione. Pozostałe sesje zostały wylogowane.")}>Zmień hasło</button>
              </section>

              <section className="account-section-card">
                <div className="account-section-heading"><div><h1>Aktywne sesje</h1><p>Sprawdź urządzenia i wyloguj te, których nie rozpoznajesz.</p></div><button type="button" className="secondary-action" disabled={busy} onClick={() => void run(async () => { await accountDashboardApi.revokeOthers(); await refresh(); }, "Wylogowano pozostałe urządzenia.")}>Wyloguj pozostałe</button></div>
                <div className="session-list">
                  {overview.sessions.map((session) => (
                    <div className="session-row" key={session.id}>
                      <span className="session-icon">{session.device.includes("telefon") ? "📱" : "💻"}</span>
                      <div><strong>{session.device} {session.current && <em>Ta sesja</em>}</strong><span>{session.location}</span><small>Aktywna: {formatDate(session.lastSeenAt)} · Utworzona: {formatDate(session.createdAt)}</small></div>
                      <button type="button" disabled={busy} onClick={() => void run(async () => {
                        const result = await accountDashboardApi.revokeSession(session.id);
                        if (result.currentSessionRevoked) { socket.disconnect(); navigate("/konto/logowanie"); return; }
                        await refresh();
                      }, "Sesja została wylogowana.")}>{session.current ? "Wyloguj" : "Cofnij dostęp"}</button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {section === "data" && (
            <div className="account-section-stack">
              <section className="account-section-card">
                <div className="account-section-heading"><div><h1>Pobierz swoje dane</h1><p>Otrzymasz plik JSON z profilem, pokojami, relacjami, wiadomościami i powiadomieniami.</p></div></div>
                <button type="button" className="primary-action" disabled={busy} onClick={() => void run(() => accountDashboardApi.exportData(), "Eksport został pobrany.")}>Pobierz eksport</button>
              </section>
              <section className="account-section-card danger-zone">
                <div className="account-section-heading"><div><h1>Usuń konto</h1><p>Ta operacja archiwizuje Twoje pokoje, anonimizuje publiczne autorstwo i usuwa prywatne dane konta.</p></div></div>
                <div className="account-form-grid">
                  <label><span>Hasło</span><input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label>
                  <label><span>Wpisz dokładnie: USUŃ KONTO</span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label>
                </div>
                <button type="button" className="delete-action" disabled={busy || deleteConfirmation !== "USUŃ KONTO" || !deletePassword} onClick={() => {
                  if (!window.confirm("Czy na pewno trwale usunąć konto?")) return;
                  void run(async () => {
                    await accountDashboardApi.deleteAccount(deletePassword, deleteConfirmation);
                    socket.disconnect();
                    navigate("/");
                  }, "Konto zostało usunięte.");
                }}>Usuń konto</button>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
