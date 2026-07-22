import React, { useEffect, useMemo, useState } from "react";
import {
  AccountDashboardApiError,
  accountDashboardApi,
  type AccountOverview,
  type AccountSession
} from "../api/accountDashboard";
import { accountApi } from "../api/auth";
import { socialApi, type SocialSettings } from "../api/social";
import { socket } from "../socket";
import { ChatiLogo } from "../components/Icons";
import "./account-dashboard.css";

type Notice = { type: "success" | "error"; text: string };
type Section = "profile" | "privacy" | "rooms" | "security" | "sessions" | "data";
type IconName =
  | "arrow"
  | "check"
  | "close"
  | "data"
  | "download"
  | "external"
  | "key"
  | "lock"
  | "logout"
  | "menu"
  | "profile"
  | "rooms"
  | "security"
  | "sessions"
  | "shield"
  | "trash"
  | "users";

const sectionItems: Array<{
  id: Section;
  label: string;
  shortLabel: string;
  description: string;
  icon: IconName;
}> = [
  { id: "profile", label: "Profil", shortLabel: "Profil", description: "Nazwa i podstawowe informacje", icon: "profile" },
  { id: "privacy", label: "Prywatność", shortLabel: "Prywatność", description: "Widoczność, kontakty i blokady", icon: "shield" },
  { id: "rooms", label: "Pokoje", shortLabel: "Pokoje", description: "Role, ulubione i powiadomienia", icon: "rooms" },
  { id: "security", label: "Bezpieczeństwo", shortLabel: "Hasło", description: "Hasło i ochrona konta", icon: "security" },
  { id: "sessions", label: "Urządzenia i sesje", shortLabel: "Sesje", description: "Gdzie jesteś zalogowany", icon: "sessions" },
  { id: "data", label: "Dane i konto", shortLabel: "Dane", description: "Eksport i usunięcie konta", icon: "data" }
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="m9 18 6-6-6-6" {...common}/></>,
    check: <><path d="m5 12 4 4L19 6" {...common}/></>,
    close: <><path d="m6 6 12 12M18 6 6 18" {...common}/></>,
    data: <><path d="M4 4h16v16H4z" {...common}/><path d="M8 9h8M8 13h8M8 17h5" {...common}/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14" {...common}/></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" {...common}/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" {...common}/></>,
    key: <><circle cx="8" cy="15" r="4" {...common}/><path d="m11 12 8-8M16 7l3 3M14 9l2 2" {...common}/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" {...common}/><path d="M8 10V7a4 4 0 0 1 8 0v3" {...common}/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" {...common}/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" {...common}/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" {...common}/></>,
    profile: <><circle cx="12" cy="8" r="4" {...common}/><path d="M4 21a8 8 0 0 1 16 0" {...common}/></>,
    rooms: <><path d="M4 5h16v12H8l-4 3V5Z" {...common}/><path d="M8 9h8M8 13h5" {...common}/></>,
    security: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" {...common}/><path d="m9 12 2 2 4-4" {...common}/></>,
    sessions: <><rect x="3" y="4" width="18" height="12" rx="2" {...common}/><path d="M8 21h8M12 16v5" {...common}/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" {...common}/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" {...common}/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...common}/><circle cx="8.5" cy="7" r="4" {...common}/><path d="M22 21v-2a4 4 0 0 0-3-3.87M15.5 3.2a4 4 0 0 1 0 7.6" {...common}/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>{paths[name]}</svg>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
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

function sectionFromHash(): Section {
  const hash = window.location.hash.replace(/^#/, "") as Section;
  return sectionItems.some((item) => item.id === hash) ? hash : "profile";
}

function roleLabel(role: "OWNER" | "MODERATOR" | "MEMBER") {
  if (role === "OWNER") return "Właściciel";
  if (role === "MODERATOR") return "Moderator";
  return "Uczestnik";
}

function sessionIcon(session: AccountSession) {
  const label = session.device.toLocaleLowerCase("pl-PL");
  if (label.includes("telefon") || label.includes("mobile") || label.includes("android") || label.includes("iphone")) return "phone";
  if (label.includes("tablet") || label.includes("ipad")) return "tablet";
  return "desktop";
}

export default function AccountDashboardPage({
  navigate
}: {
  navigate: (path: string) => void;
}) {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [section, setSection] = useState<Section>(() => sectionFromHash());
  const [nickname, setNickname] = useState("");
  const [privacy, setPrivacy] = useState<SocialSettings | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const favouriteIds = useMemo(
    () => new Set(overview?.favourites.map((item) => item.channel.id) ?? []),
    [overview]
  );

  const activeSection = sectionItems.find((item) => item.id === section) ?? sectionItems[0];
  const otherSessions = overview?.sessions.filter((item) => !item.current).length ?? 0;
  const privacyChanged = Boolean(overview && privacy && (
    privacy.friendRequestPolicy !== overview.user.friendRequestPolicy
    || privacy.allowDirectMessages !== overview.user.allowDirectMessages
    || privacy.showOnline !== overview.user.showOnline
    || privacy.showLastSeen !== overview.user.showLastSeen
  ));
  const profileChanged = Boolean(overview && nickname.trim() && nickname.trim() !== overview.user.nickname);

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
    setLoadingError(null);
  }

  useEffect(() => {
    void refresh().catch((error) => {
      if (error instanceof AccountDashboardApiError && error.code === "AUTH_REQUIRED") {
        navigate("/konto/logowanie");
        return;
      }
      setLoadingError(errorMessage(error));
    });
  }, []);

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", close);
    };
  }, [mobileNavOpen]);

  function selectSection(next: Section) {
    setSection(next);
    setMobileNavOpen(false);
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  async function logout() {
    setBusy(true);
    try {
      await accountApi.logout();
    } finally {
      navigate("/");
    }
  }

  if (!overview || !privacy) {
    if (loadingError) {
      return (
        <div className="account-dashboard-state">
          <div className="account-state-icon error"><Icon name="close" size={28}/></div>
          <h1>Nie udało się otworzyć konta</h1>
          <p>{loadingError}</p>
          <div>
            <button type="button" onClick={() => void refresh()}>Spróbuj ponownie</button>
            <button type="button" className="secondary" onClick={() => navigate("/")}>Wróć na Chati</button>
          </div>
        </div>
      );
    }
    return (
      <div className="account-dashboard-loading" role="status">
        <span className="account-loading-mark"><ChatiLogo size={42}/></span>
        <strong>Ładujemy Twoje konto</strong>
        <small>Sprawdzamy profil, pokoje i aktywne sesje.</small>
      </div>
    );
  }

  return (
    <div className="account-dashboard-layout">
      <header className="account-dashboard-header">
        <button type="button" className="account-dashboard-brand" onClick={() => navigate("/")} aria-label="Wróć na stronę główną">
          <ChatiLogo size={34}/>
          <span>Chati</span>
          <strong>Konto</strong>
        </button>
        <div className="account-dashboard-header-context">
          <strong>{activeSection.label}</strong>
          <span>{activeSection.description}</span>
        </div>
        <div className="account-dashboard-header-actions">
          <button type="button" className="header-link desktop-only" onClick={() => navigate("/znajomi")}><Icon name="users" size={17}/>Znajomi</button>
          <button type="button" className="header-link desktop-only" onClick={() => navigate("/pokoje")}><Icon name="rooms" size={17}/>Pokoje</button>
          <button type="button" className="header-logout desktop-only" disabled={busy} onClick={() => void logout()}><Icon name="logout" size={17}/>Wyloguj</button>
          <button type="button" className="account-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Otwórz menu konta" aria-expanded={mobileNavOpen}><Icon name="menu"/></button>
        </div>
      </header>

      {notice && (
        <div className={`account-dashboard-notice ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          <span className="notice-icon">{notice.type === "success" ? <Icon name="check" size={18}/> : <Icon name="close" size={18}/>}</span>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Zamknij komunikat"><Icon name="close" size={18}/></button>
        </div>
      )}

      <button type="button" className={`account-nav-backdrop ${mobileNavOpen ? "visible" : ""}`} onClick={() => setMobileNavOpen(false)} aria-label="Zamknij menu"/>

      <div className="account-dashboard-shell">
        <aside className={`account-dashboard-nav ${mobileNavOpen ? "open" : ""}`} aria-label="Ustawienia konta">
          <div className="account-nav-mobile-heading">
            <div><strong>Twoje konto</strong><span>Ustawienia Chati</span></div>
            <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Zamknij menu"><Icon name="close"/></button>
          </div>

          <div className="account-profile-summary">
            <span className="account-avatar">{overview.user.nickname.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{overview.user.nickname}</strong>
              <small>{overview.user.email}</small>
              <span className="account-verified"><Icon name="check" size={12}/>Zweryfikowane konto</span>
            </div>
          </div>

          <nav className="account-nav-list">
            {sectionItems.map((item) => (
              <button
                type="button"
                className={section === item.id ? "active" : ""}
                key={item.id}
                onClick={() => selectSection(item.id)}
                aria-current={section === item.id ? "page" : undefined}
              >
                <span className="account-nav-icon"><Icon name={item.icon} size={19}/></span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                <Icon name="arrow" size={16}/>
              </button>
            ))}
          </nav>

          <div className="account-nav-footer">
            <button type="button" onClick={() => navigate("/znajomi")}><Icon name="users" size={17}/>Znajomi</button>
            <button type="button" onClick={() => navigate("/pokoje")}><Icon name="rooms" size={17}/>Pokoje</button>
            <button type="button" className="logout" disabled={busy} onClick={() => void logout()}><Icon name="logout" size={17}/>Wyloguj się</button>
          </div>
        </aside>

        <main className="account-dashboard-content">
          <div className="account-mobile-section-tabs" aria-label="Sekcje konta">
            {sectionItems.map((item) => (
              <button type="button" key={item.id} className={section === item.id ? "active" : ""} onClick={() => selectSection(item.id)}>
                <Icon name={item.icon} size={18}/><span>{item.shortLabel}</span>
              </button>
            ))}
          </div>

          {section === "profile" && (
            <div className="account-section-stack">
              <section className="account-profile-hero">
                <div className="account-profile-main">
                  <span className="account-hero-avatar">{overview.user.nickname.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <span className="account-eyebrow">Twoje konto Chati</span>
                    <h1>{overview.user.nickname}</h1>
                    <p>{overview.user.email}</p>
                    <div className="account-profile-badges">
                      <span className="verified-pill"><Icon name="check" size={14}/>E-mail potwierdzony</span>
                      <span className="status-pill">Konto aktywne</span>
                    </div>
                  </div>
                </div>
                <div className="account-profile-stats">
                  <div><strong>{overview.memberships.length}</strong><span>pokojów</span></div>
                  <div><strong>{overview.favourites.length}</strong><span>ulubionych</span></div>
                  <div><strong>{overview.sessions.length}</strong><span>sesji</span></div>
                </div>
              </section>

              <section className="account-section-card">
                <div className="account-section-heading">
                  <div><span className="account-eyebrow">Profil publiczny</span><h2>Nazwa użytkownika</h2><p>Ta nazwa jest widoczna w pokojach, wiadomościach i zaproszeniach.</p></div>
                </div>
                <div className="account-form-grid profile-fields">
                  <label><span>Adres e-mail</span><input value={overview.user.email} disabled/><small>Adres służy do logowania i odzyskiwania konta.</small></label>
                  <label><span>Nazwa użytkownika</span><input value={nickname} minLength={3} maxLength={24} onChange={(event) => setNickname(event.target.value)}/><small>3–24 znaki: litery, cyfry, _ lub -.</small></label>
                </div>
                <div className="account-card-footer">
                  <span>Konto utworzone {formatShortDate(overview.user.createdAt)}</span>
                  <button
                    type="button"
                    className="primary-action"
                    disabled={busy || !profileChanged || nickname.trim().length < 3}
                    onClick={() => void run(async () => {
                      await accountDashboardApi.updateProfile(nickname.trim());
                      await refresh();
                    }, "Profil został zapisany.")}
                  >{busy ? "Zapisywanie…" : "Zapisz profil"}</button>
                </div>
              </section>

              <section className="account-quick-links" aria-label="Skróty konta">
                <button type="button" onClick={() => navigate("/znajomi")}><span><Icon name="users"/></span><div><strong>Znajomi i wiadomości</strong><small>Rozmowy, zaproszenia i prywatność</small></div><Icon name="arrow"/></button>
                <button type="button" onClick={() => navigate("/pokoje")}><span><Icon name="rooms"/></span><div><strong>Pokoje publiczne</strong><small>Ulubione, role i powiadomienia</small></div><Icon name="arrow"/></button>
              </section>
            </div>
          )}

          {section === "privacy" && (
            <div className="account-section-stack">
              <section className="account-section-card">
                <div className="account-section-heading">
                  <div><span className="account-eyebrow">Kontrola widoczności</span><h1>Prywatność</h1><p>Wybierz, kto może Cię znaleźć, napisać i zobaczyć Twoją aktywność.</p></div>
                  <span className="section-status"><Icon name="shield" size={16}/>Ustawienia osobiste</span>
                </div>

                <div className="privacy-policy-card">
                  <div><span className="setting-icon"><Icon name="users"/></span><span><strong>Kto może wysyłać zaproszenia?</strong><small>Możesz ograniczyć zaproszenia do osób spotkanych w tych samych pokojach.</small></span></div>
                  <select value={privacy.friendRequestPolicy} onChange={(event) => setPrivacy({ ...privacy, friendRequestPolicy: event.target.value as SocialSettings["friendRequestPolicy"] })}>
                    <option value="EVERYONE">Wszyscy</option>
                    <option value="SHARED_CHANNELS">Osoby ze wspólnych pokojów</option>
                    <option value="NOBODY">Nikt</option>
                  </select>
                </div>

                <div className="privacy-stack">
                  <label className="account-toggle"><input type="checkbox" checked={privacy.allowDirectMessages} onChange={(event) => setPrivacy({ ...privacy, allowDirectMessages: event.target.checked })}/><span className="toggle-control"/><span className="toggle-copy"><strong>Wiadomości prywatne</strong><small>Zezwalaj znajomym na wysyłanie wiadomości, również gdy jesteś offline.</small></span></label>
                  <label className="account-toggle"><input type="checkbox" checked={privacy.showOnline} onChange={(event) => setPrivacy({ ...privacy, showOnline: event.target.checked })}/><span className="toggle-control"/><span className="toggle-copy"><strong>Status online</strong><small>Pokazuj znajomym, gdy korzystasz z Chati.</small></span></label>
                  <label className="account-toggle"><input type="checkbox" checked={privacy.showLastSeen} onChange={(event) => setPrivacy({ ...privacy, showLastSeen: event.target.checked })}/><span className="toggle-control"/><span className="toggle-copy"><strong>Ostatnia aktywność</strong><small>Pokazuj znajomym przybliżony czas ostatniego połączenia.</small></span></label>
                </div>

                <div className="account-card-footer privacy-footer">
                  <span>{privacyChanged ? "Masz niezapisane zmiany." : "Ustawienia są aktualne."}</span>
                  <button type="button" className="primary-action" disabled={busy || !privacyChanged} onClick={() => void run(async () => {
                    await socialApi.updateSettings(privacy);
                    await refresh();
                  }, "Ustawienia prywatności zapisane.")}>{busy ? "Zapisywanie…" : "Zapisz prywatność"}</button>
                </div>
              </section>

              <section className="account-section-card">
                <div className="account-section-heading compact">
                  <div><span className="account-eyebrow">Relacje</span><h2>Zablokowani użytkownicy</h2><p>Zablokowane osoby nie mogą wysyłać Ci zaproszeń ani wiadomości.</p></div>
                  <button type="button" className="secondary-action" onClick={() => navigate("/znajomi?tab=settings")}><Icon name="external" size={16}/>Otwórz znajomych</button>
                </div>
                {!overview.blocked.length ? (
                  <div className="account-empty-state"><span><Icon name="shield" size={25}/></span><strong>Nikogo nie blokujesz</strong><small>Zablokowane konta pojawią się w tym miejscu.</small></div>
                ) : (
                  <div className="blocked-list">
                    {overview.blocked.map((item) => (
                      <div className="blocked-row" key={item.id}>
                        <span className="mini-avatar">{item.nickname.slice(0, 1).toUpperCase()}</span>
                        <div><strong>{item.nickname}</strong><small>Brak dostępu do zaproszeń i wiadomości</small></div>
                        <button type="button" disabled={busy} onClick={() => void run(async () => {
                          await socialApi.unblockUser(item.id);
                          await refresh();
                        }, `Odblokowano ${item.nickname}.`)}>Odblokuj</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {section === "rooms" && (
            <section className="account-section-card rooms-account-card">
              <div className="account-section-heading">
                <div><span className="account-eyebrow">Twoje społeczności</span><h1>Pokoje</h1><p>Zarządzaj rolami, ulubionymi pokojami i powiadomieniami o wzmiankach.</p></div>
                <button type="button" className="secondary-action" onClick={() => navigate("/pokoje")}><Icon name="external" size={16}/>Przeglądaj pokoje</button>
              </div>

              <div className="room-account-summary">
                <div><span><Icon name="rooms"/></span><strong>{overview.memberships.length}</strong><small>pokojów</small></div>
                <div><span><Icon name="check"/></span><strong>{overview.favourites.length}</strong><small>ulubionych</small></div>
                <div><span><Icon name="shield"/></span><strong>{overview.memberships.filter((item) => item.role !== "MEMBER").length}</strong><small>ról moderacji</small></div>
              </div>

              {!overview.memberships.length ? (
                <div className="account-empty-state large"><span><Icon name="rooms" size={28}/></span><strong>Nie należysz jeszcze do żadnego pokoju</strong><small>Dołącz do rozmowy, aby zobaczyć tutaj role i ustawienia powiadomień.</small><button type="button" onClick={() => navigate("/pokoje")}>Odkryj pokoje</button></div>
              ) : (
                <div className="account-room-list">
                  {overview.memberships.map((membership) => {
                    const favourite = overview.favourites.find((item) => item.channel.id === membership.channel.id);
                    return (
                      <article className="account-room-row" key={membership.channel.id}>
                        <div className="room-row-main">
                          <span className="room-row-icon">#</span>
                          <div><strong>{membership.channel.name}</strong><small>#{membership.channel.slug}</small></div>
                        </div>
                        <div className="room-row-badges">
                          {membership.channel.isOfficial && <span className="room-pill official">Oficjalny</span>}
                          <span className={`room-pill role-${membership.role.toLowerCase()}`}>{roleLabel(membership.role)}</span>
                          {favourite && <span className="room-pill favourite">{favourite.autoJoin ? "Auto-join" : "Ulubiony"}</span>}
                        </div>
                        <label className="room-notification-toggle">
                          <input type="checkbox" checked={!membership.muteNotifications} disabled={busy} onChange={(event) => void run(async () => {
                            await accountDashboardApi.setRoomNotificationsMuted(membership.channel.id, !event.target.checked);
                            await refresh();
                          }, event.target.checked ? "Włączono powiadomienia pokoju." : "Wyciszono powiadomienia pokoju.")}/>
                          <span className="toggle-control"/>
                          <span><strong>Wzmianki</strong><small>{membership.muteNotifications ? "Wyciszone" : "Włączone"}</small></span>
                        </label>
                        <button type="button" className="room-open-button" onClick={() => navigate(`/pokoje?room=${encodeURIComponent(membership.channel.slug)}`)}>Otwórz<Icon name="arrow" size={16}/></button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {section === "security" && (
            <div className="account-section-stack">
              <section className="account-security-hero">
                <span className="security-hero-icon"><Icon name="security" size={30}/></span>
                <div><span className="account-eyebrow">Ochrona konta</span><h1>Bezpieczeństwo</h1><p>Silne, unikalne hasło chroni Twoje rozmowy, znajomych i pokoje.</p></div>
                <div className="security-status"><Icon name="check" size={17}/><span><strong>Konto chronione</strong><small>E-mail potwierdzony</small></span></div>
              </section>

              <section className="account-section-card">
                <div className="account-section-heading">
                  <div><span className="account-eyebrow">Dane logowania</span><h2>Zmień hasło</h2><p>Po zmianie hasła wszystkie pozostałe urządzenia zostaną automatycznie wylogowane.</p></div>
                  <span className="section-icon"><Icon name="key"/></span>
                </div>
                <div className="account-form-grid password-grid">
                  <label className="full-width"><span>Obecne hasło</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}/></label>
                  <label><span>Nowe hasło</span><input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><small>Co najmniej 10 znaków.</small></label>
                  <label><span>Powtórz nowe hasło</span><input type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/><small>{confirmPassword && newPassword !== confirmPassword ? "Hasła nie są identyczne." : "Wpisz nowe hasło ponownie."}</small></label>
                </div>
                <div className="password-strength" aria-live="polite">
                  <span className={newPassword.length >= 10 ? "complete" : ""}/><span className={newPassword.length >= 14 ? "complete" : ""}/><span className={/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? "complete" : ""}/>
                  <small>{newPassword.length < 10 ? "Hasło jest za krótkie" : newPassword.length < 14 ? "Dobre hasło" : "Silne hasło"}</small>
                </div>
                <div className="account-card-footer">
                  <span>Zmiana zakończy pozostałe aktywne sesje.</span>
                  <button type="button" className="primary-action" disabled={busy || !currentPassword || newPassword.length < 10 || newPassword !== confirmPassword} onClick={() => void run(async () => {
                    await accountDashboardApi.changePassword(currentPassword, newPassword);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    await refresh();
                  }, "Hasło zmienione. Pozostałe sesje zostały wylogowane.")}>{busy ? "Zmienianie…" : "Zmień hasło"}</button>
                </div>
              </section>

              <section className="security-tips">
                <div><Icon name="lock"/><span><strong>Używaj unikalnego hasła</strong><small>Nie wykorzystuj hasła z poczty ani innych serwisów.</small></span></div>
                <div><Icon name="sessions"/><span><strong>Sprawdzaj urządzenia</strong><small>Wyloguj sesje, których nie rozpoznajesz.</small></span></div>
                <button type="button" onClick={() => selectSection("sessions")}>Sprawdź aktywne sesje<Icon name="arrow" size={16}/></button>
              </section>
            </div>
          )}

          {section === "sessions" && (
            <section className="account-section-card sessions-card">
              <div className="account-section-heading">
                <div><span className="account-eyebrow">Dostęp do konta</span><h1>Urządzenia i sesje</h1><p>Sprawdź, gdzie jesteś zalogowany. Cofnij dostęp urządzeniom, których nie rozpoznajesz.</p></div>
                <button type="button" className="secondary-action warning-action" disabled={busy || otherSessions === 0} onClick={() => {
                  if (!window.confirm("Wylogować wszystkie pozostałe urządzenia?")) return;
                  void run(async () => {
                    await accountDashboardApi.revokeOthers();
                    await refresh();
                  }, "Wylogowano pozostałe urządzenia.");
                }}><Icon name="logout" size={16}/>Wyloguj pozostałe ({otherSessions})</button>
              </div>

              <div className="sessions-security-note"><Icon name="shield"/><div><strong>Twoja obecna sesja jest oznaczona poniżej</strong><span>Lokalizacja jest przybliżona i nie zawiera surowego adresu IP.</span></div></div>

              <div className="session-list">
                {[...overview.sessions].sort((left, right) => Number(right.current) - Number(left.current) || new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime()).map((session) => (
                  <article className={`session-row ${session.current ? "current" : ""}`} key={session.id}>
                    <span className={`session-device-icon ${sessionIcon(session)}`}><Icon name="sessions"/></span>
                    <div className="session-copy">
                      <div><strong>{session.device}</strong>{session.current && <span className="current-session-pill"><Icon name="check" size={12}/>Ta sesja</span>}</div>
                      <span>{session.location || "Lokalizacja niedostępna"}</span>
                      <small>Ostatnia aktywność: {formatDate(session.lastSeenAt)}</small>
                      <small>Wygasa: {formatDate(session.expiresAt)}</small>
                    </div>
                    <button type="button" className={session.current ? "session-logout-current" : ""} disabled={busy} onClick={() => {
                      const confirmation = session.current ? "Wylogować to urządzenie?" : `Cofnąć dostęp dla: ${session.device}?`;
                      if (!window.confirm(confirmation)) return;
                      void run(async () => {
                        const result = await accountDashboardApi.revokeSession(session.id);
                        if (result.currentSessionRevoked) {
                          socket.disconnect();
                          navigate("/konto/logowanie");
                          return;
                        }
                        await refresh();
                      }, "Sesja została wylogowana.");
                    }}>{session.current ? "Wyloguj to urządzenie" : "Cofnij dostęp"}</button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {section === "data" && (
            <div className="account-section-stack">
              <section className="account-section-card export-card">
                <div className="export-card-icon"><Icon name="download" size={27}/></div>
                <div className="export-card-copy"><span className="account-eyebrow">Twoje informacje</span><h1>Pobierz swoje dane</h1><p>Eksport JSON zawiera profil, pokoje, relacje, prywatne wiadomości i powiadomienia powiązane z Twoim kontem.</p><small>Plik zostanie przygotowany i pobrany bezpośrednio na to urządzenie.</small></div>
                <button type="button" className="primary-action" disabled={busy} onClick={() => void run(() => accountDashboardApi.exportData(), "Eksport został pobrany.")}><Icon name="download" size={17}/>{busy ? "Przygotowywanie…" : "Pobierz eksport"}</button>
              </section>

              <section className="account-section-card danger-zone">
                <div className="danger-zone-heading">
                  <span><Icon name="trash" size={25}/></span>
                  <div><span className="account-eyebrow">Nieodwracalna operacja</span><h2>Usuń konto</h2><p>Po potwierdzeniu nie będzie można odzyskać konta ani prywatnych wiadomości.</p></div>
                </div>

                <div className="deletion-impact">
                  <strong>Co stanie się z Twoimi danymi?</strong>
                  <ul>
                    <li><Icon name="check" size={15}/>Prywatne dane konta i relacje zostaną usunięte.</li>
                    <li><Icon name="check" size={15}/>Publiczne wiadomości pozostaną, ale autor zostanie zanonimizowany.</li>
                    <li><Icon name="check" size={15}/>Twoje nieoficjalne pokoje zostaną zarchiwizowane.</li>
                    <li><Icon name="check" size={15}/>Aktywne sesje zostaną natychmiast zakończone.</li>
                  </ul>
                </div>

                <div className="account-form-grid deletion-fields">
                  <label><span>Potwierdź hasłem</span><input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Twoje obecne hasło"/></label>
                  <label><span>Wpisz dokładnie: <strong>USUŃ KONTO</strong></span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="USUŃ KONTO"/></label>
                </div>

                <div className="danger-zone-footer">
                  <span>Ta operacja nie może zostać cofnięta.</span>
                  <button type="button" className="delete-action" disabled={busy || deleteConfirmation !== "USUŃ KONTO" || !deletePassword} onClick={() => {
                    if (!window.confirm("Czy na pewno trwale usunąć konto? Tej operacji nie można cofnąć.")) return;
                    void run(async () => {
                      await accountDashboardApi.deleteAccount(deletePassword, deleteConfirmation);
                      socket.disconnect();
                      navigate("/");
                    }, "Konto zostało usunięte.");
                  }}><Icon name="trash" size={17}/>{busy ? "Usuwanie…" : "Trwale usuń konto"}</button>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
