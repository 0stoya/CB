import React, { useEffect, useMemo, useRef, useState } from "react";
import { accountApi, type AccountUser } from "../api/auth";
import { channelsApi, type ChannelListItem } from "../api/channels";
import { socialApi } from "../api/social";
import {
  moderationApi,
  type ReportReason,
  type ReportTargetType
} from "../api/moderation";
import {
  socket,
  type PublicChannel,
  type PublicChannelMember,
  type PublicChannelMessage
} from "../socket";
import { ChatiLogo } from "../components/Icons";
import "./rooms-page.css";
import "./rooms-moderation.css";

type RoomEvent =
  | ({ kind: "message" } & PublicChannelMessage)
  | { kind: "system"; id: string; slug: string; text: string; createdAt: string };

type OpenRoom = {
  channel: PublicChannel;
  events: RoomEvent[];
  members: PublicChannelMember[];
  online: number;
};

type ReportTarget = {
  type: ReportTargetType;
  id: string;
  label: string;
};

const GUEST_NICKNAME_KEY = "chati:guest-nickname";

function systemEvent(slug: string, text: string, createdAt = new Date().toISOString()): RoomEvent {
  return {
    kind: "system",
    id: `${slug}_${createdAt}_${Math.random().toString(16).slice(2)}`,
    slug,
    text,
    createdAt
  };
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function errorMessage(code: string, retryAfterMs?: number) {
  const seconds = Math.max(1, Math.ceil((retryAfterMs ?? 1000) / 1000));
  const messages: Record<string, string> = {
    ACCOUNT_REQUIRED: "Ta funkcja wymaga zweryfikowanego konta.",
    GUEST_NICKNAME_REQUIRED: "Wpisz pseudonim składający się z co najmniej 3 znaków.",
    CHANNEL_NOT_FOUND: "Ten pokój już nie istnieje.",
    CHANNEL_FULL: "Ten pokój jest obecnie pełny.",
    TOO_MANY_JOINED_CHANNELS: "Osiągnięto limit jednocześnie otwartych pokoi.",
    MESSAGE_RATE_LIMITED: "Wysyłasz wiadomości zbyt szybko.",
    CHANNEL_SLUG_TAKEN: "Pokój o takiej nazwie już istnieje.",
    CHANNEL_LOCKED: "Pokój jest obecnie zamknięty przez moderatora.",
    CHANNEL_BANNED: "Nie masz dostępu do tego pokoju.",
    CHANNEL_MODERATOR_REQUIRED: "Ta akcja wymaga uprawnień moderatora.",
    CHANNEL_OWNER_REQUIRED: "Ta akcja wymaga uprawnień właściciela pokoju.",
    CANNOT_MODERATE_OWNER: "Nie możesz moderować właściciela pokoju."
  };
  if (code === "SLOW_MODE") return `Tryb powolny. Spróbuj za ${seconds} s.`;
  if (code === "CHANNEL_MUTED") return `Jesteś wyciszony w tym pokoju jeszcze przez około ${seconds} s.`;
  return messages[code] || "Nie udało się wykonać tej operacji. Spróbuj ponownie.";
}

function isModerator(channel?: PublicChannel | null) {
  return channel?.currentUserRole === "OWNER" || channel?.currentUserRole === "MODERATOR";
}

export default function RoomsPage({
  onLeave,
  navigate
}: {
  onLeave: () => void;
  navigate: (path: string) => void;
}) {
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [openRooms, setOpenRooms] = useState<Record<string, OpenRoom>>({});
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [guestNickname, setGuestNickname] = useState(() => localStorage.getItem(GUEST_NICKNAME_KEY) || "");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedMember, setSelectedMember] = useState<PublicChannelMember | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("HARASSMENT");
  const [reportDetails, setReportDetails] = useState("");
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [roomSettings, setRoomSettings] = useState({ topic: "", allowGuests: true, slowModeSeconds: 0, isLocked: false });
  const [createForm, setCreateForm] = useState({ name: "", topic: "", allowGuests: true, slowModeSeconds: 0 });
  const threadRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = activeSlug ? openRooms[activeSlug] : null;
  const filteredChannels = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter((channel) =>
      [channel.name, channel.slug, channel.topic || ""].some((value) => value.toLowerCase().includes(query))
    );
  }, [channels, search]);

  async function refreshChannels() {
    setLoadingChannels(true);
    try {
      const result = await channelsApi.list();
      setChannels(result.channels);
    } catch {
      setError("Nie udało się pobrać listy pokoi.");
    } finally {
      setLoadingChannels(false);
    }
  }

  useEffect(() => {
    void accountApi.me().then((result) => setAccount(result.user)).catch(() => setAccount(null)).finally(() => setAccountReady(true));
    void refreshChannels();
  }, []);

  useEffect(() => {
    const onJoined = (payload: {
      channel: PublicChannel;
      history: Omit<PublicChannelMessage, "slug">[];
      members: PublicChannelMember[];
    }) => {
      const events: RoomEvent[] = payload.history.map((item) => ({
        ...item,
        slug: payload.channel.slug,
        kind: "message" as const,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(item.createdAt).toISOString()
      }));
      setOpenRooms((current) => ({
        ...current,
        [payload.channel.slug]: {
          channel: payload.channel,
          events,
          members: payload.members,
          online: payload.members.length
        }
      }));
      setActiveSlug((current) => current ?? payload.channel.slug);
      setError(null);
    };

    const onMessage = (payload: PublicChannelMessage) => {
      setOpenRooms((current) => {
        const room = current[payload.slug];
        if (!room) return current;
        return { ...current, [payload.slug]: { ...room, events: [...room.events, { ...payload, kind: "message" }] } };
      });
    };

    const onDeleted = (payload: { slug: string; messageId: string }) => {
      setOpenRooms((current) => {
        const room = current[payload.slug];
        if (!room) return current;
        return {
          ...current,
          [payload.slug]: {
            ...room,
            events: room.events.filter((event) => event.kind !== "message" || event.id !== payload.messageId)
          }
        };
      });
    };

    const onSystem = (payload: { slug: string; type: "join" | "leave"; nickname: string; createdAt: string }) => {
      setOpenRooms((current) => {
        const room = current[payload.slug];
        if (!room) return current;
        const text = payload.type === "join" ? `${payload.nickname} dołącza do pokoju.` : `${payload.nickname} opuszcza pokój.`;
        return { ...current, [payload.slug]: { ...room, events: [...room.events, systemEvent(payload.slug, text, payload.createdAt)] } };
      });
    };

    const onPresence = (payload: { slug: string; online: number; members: PublicChannelMember[] }) => {
      setOpenRooms((current) => {
        const room = current[payload.slug];
        if (!room) return current;
        return { ...current, [payload.slug]: { ...room, online: payload.online, members: payload.members } };
      });
      setChannels((current) => current.map((item) => item.slug === payload.slug ? { ...item, online: payload.online } : item));
    };

    const onPresenceChanged = (payload: { slug: string; online: number }) => {
      setChannels((current) => current.map((item) => item.slug === payload.slug ? { ...item, online: payload.online } : item));
    };

    const onUpdated = (payload: {
      slug: string;
      topic: string | null;
      allowGuests: boolean;
      slowModeSeconds: number;
      isLocked: boolean;
    }) => {
      setOpenRooms((current) => {
        const room = current[payload.slug];
        if (!room) return current;
        return {
          ...current,
          [payload.slug]: {
            ...room,
            channel: { ...room.channel, ...payload }
          }
        };
      });
      setNotice(`Ustawienia #${payload.slug} zostały zaktualizowane.`);
    };

    const removeRoom = (slug: string, text: string) => {
      setOpenRooms((current) => {
        const next = { ...current };
        delete next[slug];
        return next;
      });
      setActiveSlug((current) => current === slug ? null : current);
      setSelectedMember(null);
      setNotice(text);
      void refreshChannels();
    };

    const onKicked = (payload: { slug: string; reason: string | null }) => {
      removeRoom(payload.slug, payload.reason ? `Usunięto Cię z pokoju: ${payload.reason}` : "Usunięto Cię z pokoju.");
    };
    const onClosed = (payload: { slug: string }) => removeRoom(payload.slug, "Pokój został zamknięty przez administrację.");
    const onError = (payload: { code: string; retryAfterMs?: number }) => setError(errorMessage(payload.code, payload.retryAfterMs));

    socket.on("channel.joined", onJoined);
    socket.on("channel.message", onMessage);
    socket.on("channel.message.deleted", onDeleted);
    socket.on("channel.system", onSystem);
    socket.on("channel.presence", onPresence);
    socket.on("channels.presence.changed", onPresenceChanged);
    socket.on("channel.updated", onUpdated);
    socket.on("channel.kicked", onKicked);
    socket.on("channel.closed", onClosed);
    socket.on("channel.error", onError);
    if (socket.disconnected) socket.connect();

    return () => {
      socket.off("channel.joined", onJoined);
      socket.off("channel.message", onMessage);
      socket.off("channel.message.deleted", onDeleted);
      socket.off("channel.system", onSystem);
      socket.off("channel.presence", onPresence);
      socket.off("channels.presence.changed", onPresenceChanged);
      socket.off("channel.updated", onUpdated);
      socket.off("channel.kicked", onKicked);
      socket.off("channel.closed", onClosed);
      socket.off("channel.error", onError);
    };
  }, []);

  useEffect(() => {
    if (accountReady && account) socket.emit("channels.autojoin");
  }, [accountReady, account]);

  useEffect(() => {
    const element = threadRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activeRoom?.events.length, activeSlug]);

  useEffect(() => {
    localStorage.setItem(GUEST_NICKNAME_KEY, guestNickname.trim());
  }, [guestNickname]);

  function joinChannel(channel: ChannelListItem) {
    if (!account && guestNickname.trim().length < 3) {
      setError("Wpisz pseudonim, zanim dołączysz jako gość.");
      return;
    }
    socket.emit("channel.join", { slug: channel.slug, nickname: account ? undefined : guestNickname.trim() });
    setActiveSlug(channel.slug);
  }

  function closeRoom(slug: string) {
    socket.emit("channel.leave", { slug });
    setOpenRooms((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
    setActiveSlug((current) => current === slug ? Object.keys(openRooms).find((item) => item !== slug) ?? null : current);
  }

  function sendMessage() {
    const text = message.trim();
    if (!text || !activeSlug) return;
    socket.emit("channel.message.send", { slug: activeSlug, text });
    setMessage("");
  }

  async function toggleFavourite(channel: ChannelListItem) {
    if (!account) return setError("Zaloguj się, aby zapisywać ulubione pokoje.");
    try {
      if (channel.favourite) await channelsApi.unfavourite(channel.slug);
      else await channelsApi.favourite(channel.slug, false);
      setChannels((current) => current.map((item) => item.slug === channel.slug ? { ...item, favourite: !channel.favourite, autoJoin: false } : item));
    } catch {
      setError("Nie udało się zmienić ulubionych.");
    }
  }

  async function toggleAutoJoin(channel: ChannelListItem) {
    if (!account) return;
    try {
      if (!channel.favourite) await channelsApi.favourite(channel.slug, true);
      else await channelsApi.updateFavourite(channel.slug, !channel.autoJoin);
      setChannels((current) => current.map((item) => item.slug === channel.slug ? { ...item, favourite: true, autoJoin: !channel.autoJoin } : item));
    } catch {
      setError("Nie udało się zmienić automatycznego dołączania.");
    }
  }

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!account) return navigate("/konto/rejestracja");
    setCreateBusy(true);
    setError(null);
    try {
      const result = await channelsApi.create({
        name: createForm.name,
        topic: createForm.topic || undefined,
        allowGuests: createForm.allowGuests,
        slowModeSeconds: createForm.slowModeSeconds
      });
      setShowCreate(false);
      setCreateForm({ name: "", topic: "", allowGuests: true, slowModeSeconds: 0 });
      await refreshChannels();
      socket.emit("channel.join", { slug: result.channel.slug });
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : "CHANNEL_CREATE_FAILED"));
    } finally {
      setCreateBusy(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, success: string) {
    setActionBusy(true);
    setError(null);
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : "ACTION_FAILED"));
    } finally {
      setActionBusy(false);
    }
  }

  function openReport(target: ReportTarget) {
    setReportTarget(target);
    setReportReason("HARASSMENT");
    setReportDetails("");
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reportTarget) return;
    await runAction(
      () => moderationApi.report({
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason: reportReason,
        details: reportDetails || undefined
      }),
      "Zgłoszenie zostało przekazane do moderacji."
    );
    setReportTarget(null);
  }

  function openSettings() {
    if (!activeRoom) return;
    setRoomSettings({
      topic: activeRoom.channel.topic || "",
      allowGuests: activeRoom.channel.allowGuests,
      slowModeSeconds: activeRoom.channel.slowModeSeconds,
      isLocked: activeRoom.channel.isLocked
    });
    setShowRoomSettings(true);
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!activeRoom) return;
    await runAction(
      () => moderationApi.updateRoom(activeRoom.channel.slug, roomSettings),
      "Ustawienia pokoju zapisane."
    );
    setShowRoomSettings(false);
  }

  return (
    <div className="rooms-layout">
      <header className="rooms-header">
        <button className="rooms-brand" type="button" onClick={onLeave}>
          <ChatiLogo size={34} /><span>Chati</span><strong>Pokoje</strong>
        </button>
        <div className="rooms-header-actions">
          <span className="rooms-account-pill">{account ? `@${account.nickname}` : "Tryb gościa"}</span>
          {!account && <button type="button" className="rooms-button secondary" onClick={() => navigate("/konto/logowanie")}>Zaloguj się</button>}
          {account && <button type="button" className="rooms-button secondary" onClick={() => navigate("/znajomi")}>Znajomi</button>}
          <button type="button" className="rooms-button secondary" onClick={onLeave}>Wyjdź</button>
        </div>
      </header>

      {error && <div className="rooms-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}>×</button></div>}
      {notice && <div className="rooms-notice"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div>}

      <div className="rooms-shell">
        <aside className="rooms-sidebar">
          <div className="rooms-sidebar-top">
            <div><h1>Pokoje publiczne</h1><p>Dołącz do rozmowy lub załóż własny pokój.</p></div>
            <button type="button" className="rooms-create-button" onClick={() => account ? setShowCreate(true) : navigate("/konto/rejestracja")}>+ Nowy</button>
          </div>
          {!account && <label className="guest-nickname"><span>Twój pseudonim</span><input value={guestNickname} maxLength={24} placeholder="np. Chris_Norfolk" onChange={(event) => setGuestNickname(event.target.value)} /></label>}
          <input className="rooms-search" value={search} placeholder="Szukaj pokoju..." onChange={(event) => setSearch(event.target.value)} />
          <div className="rooms-list">
            {loadingChannels && <div className="rooms-empty-small">Ładowanie pokoi...</div>}
            {!loadingChannels && filteredChannels.length === 0 && <div className="rooms-empty-small">Brak pasujących pokoi.</div>}
            {filteredChannels.map((channel) => (
              <div className={`room-list-item ${activeSlug === channel.slug ? "active" : ""}`} key={channel.id}>
                <button type="button" className="room-list-main" onClick={() => joinChannel(channel)}>
                  <span className="room-hash">#</span><span className="room-list-copy"><strong>{channel.name}</strong><small>{channel.topic || "Rozmowa publiczna"}</small></span><span className="room-online"><i />{channel.online}</span>
                </button>
                <button type="button" className={`room-star ${channel.favourite ? "selected" : ""}`} onClick={() => void toggleFavourite(channel)}>{channel.favourite ? "★" : "☆"}</button>
              </div>
            ))}
          </div>
        </aside>

        <main className="room-workspace">
          {Object.keys(openRooms).length > 0 && <div className="room-tabs">{Object.values(openRooms).map((room) => (
            <button type="button" className={`room-tab ${activeSlug === room.channel.slug ? "active" : ""}`} key={room.channel.slug} onClick={() => setActiveSlug(room.channel.slug)}>
              #{room.channel.slug}{room.channel.isLocked && " 🔒"}<span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); closeRoom(room.channel.slug); }}>×</span>
            </button>
          ))}</div>}

          {!activeRoom ? (
            <div className="rooms-welcome"><div className="rooms-welcome-icon">#</div><h2>Wybierz pokój i dołącz do rozmowy</h2><p>Oficjalne pokoje są zawsze dostępne. Pokoje społeczności bez aktywności przez 48 godzin są automatycznie usuwane.</p></div>
          ) : (
            <>
              <div className="room-titlebar">
                <div><h2>#{activeRoom.channel.slug} {activeRoom.channel.isLocked && <span title="Pokój zamknięty">🔒</span>}</h2><p>{activeRoom.channel.topic || "Rozmowa publiczna"}</p></div>
                <div className="room-title-actions">
                  <span>{activeRoom.online} online</span>
                  <button type="button" onClick={() => openReport({ type: "CHANNEL", id: activeRoom.channel.id, label: `#${activeRoom.channel.slug}` })}>Zgłoś pokój</button>
                  {isModerator(activeRoom.channel) && <button type="button" onClick={openSettings}>Ustawienia</button>}
                  {account && (() => { const item = channels.find((channel) => channel.slug === activeRoom.channel.slug); return item ? <button type="button" onClick={() => void toggleAutoJoin(item)}>{item.autoJoin ? "Auto-join: włączony" : "Włącz auto-join"}</button> : null; })()}
                </div>
              </div>

              <div className="room-thread" ref={threadRef}>
                {activeRoom.events.length === 0 && <div className="room-thread-intro">To początek rozmowy w #{activeRoom.channel.slug}. Przywitaj się 👋</div>}
                {activeRoom.events.map((event) => event.kind === "system" ? (
                  <div className="room-system-message" key={event.id}>{event.text}</div>
                ) : (
                  <div className="room-message" key={event.id}>
                    <button className="room-avatar" onClick={() => {
                      const member = activeRoom.members.find((item) => item.userId === event.senderUserId && item.nickname === event.senderNickname);
                      if (member) setSelectedMember(member);
                    }}>{event.senderNickname.slice(0, 1).toUpperCase()}</button>
                    <div className="room-message-content">
                      <div className="room-message-meta"><strong>{event.senderNickname}</strong><time>{formatTime(event.createdAt)}</time></div>
                      <p>{event.text}</p>
                      <div className="room-message-actions">
                        <button onClick={() => openReport({ type: "CHANNEL_MESSAGE", id: event.id, label: `Wiadomość od ${event.senderNickname}` })}>Zgłoś</button>
                        {isModerator(activeRoom.channel) && <button onClick={() => void runAction(() => moderationApi.deleteMessage(activeRoom.channel.slug, event.id), "Wiadomość została usunięta.")}>Usuń</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="room-composer">
                <input value={message} maxLength={500} disabled={activeRoom.channel.isLocked && !isModerator(activeRoom.channel)} placeholder={activeRoom.channel.isLocked && !isModerator(activeRoom.channel) ? "Pokój jest zamknięty" : `Napisz wiadomość w #${activeRoom.channel.slug}`} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} />
                <button type="button" disabled={!message.trim() || (activeRoom.channel.isLocked && !isModerator(activeRoom.channel))} onClick={sendMessage}>Wyślij</button>
              </div>
            </>
          )}
        </main>

        <aside className="members-sidebar">
          <div className="members-title"><strong>Uczestnicy</strong><span>{activeRoom?.online ?? 0}</span></div>
          <div className="members-list">
            {activeRoom?.members.map((member) => (
              <button className="member-row member-button" key={member.memberId} onClick={() => setSelectedMember(member)}>
                <span className="member-avatar">{member.nickname.slice(0, 1).toUpperCase()}</span>
                <span>{member.nickname}{member.role === "OWNER" ? " 👑" : member.role === "MODERATOR" ? " 🛡️" : ""}</span><i />
              </button>
            ))}
            {activeRoom && activeRoom.members.length === 0 && <div className="rooms-empty-small">Brak innych osób.</div>}
          </div>
        </aside>
      </div>

      {selectedMember && activeRoom && (
        <div className="room-popover-backdrop" onMouseDown={() => setSelectedMember(null)}>
          <section className="room-user-card" onMouseDown={(event) => event.stopPropagation()}>
            <button className="room-card-close" onClick={() => setSelectedMember(null)}>×</button>
            <div className="room-user-avatar">{selectedMember.nickname.slice(0, 1).toUpperCase()}</div>
            <h3>{selectedMember.nickname}</h3>
            <p>{selectedMember.role === "OWNER" ? "Właściciel pokoju" : selectedMember.role === "MODERATOR" ? "Moderator pokoju" : selectedMember.userId ? "Zweryfikowane konto" : "Gość"}</p>
            <div className="room-card-actions">
              {account && selectedMember.userId && selectedMember.userId !== account.id && <>
                <button disabled={actionBusy} onClick={() => void runAction(() => socialApi.sendRequest(selectedMember.nickname), "Zaproszenie zostało wysłane.")}>Dodaj znajomego</button>
                <button className="secondary" disabled={actionBusy} onClick={() => void runAction(() => socialApi.blockUser(selectedMember.userId!), "Użytkownik został zablokowany.")}>Zablokuj</button>
                <button className="secondary" onClick={() => openReport({ type: "USER", id: selectedMember.userId!, label: selectedMember.nickname })}>Zgłoś profil</button>
              </>}
              {isModerator(activeRoom.channel) && selectedMember.userId !== account?.id && selectedMember.role !== "OWNER" && <>
                <button className="warning" disabled={actionBusy} onClick={() => void runAction(() => moderationApi.kickMember(activeRoom.channel.slug, selectedMember.memberId), "Użytkownik został usunięty z pokoju.")}>Usuń z pokoju</button>
                {selectedMember.userId && <>
                  <button className="warning" disabled={actionBusy} onClick={() => void runAction(() => moderationApi.muteUser(activeRoom.channel.slug, selectedMember.userId!, 10), "Użytkownik został wyciszony na 10 minut.")}>Wycisz 10 min</button>
                  <button className="danger" disabled={actionBusy} onClick={() => window.confirm("Zablokować użytkownika w tym pokoju?") && void runAction(() => moderationApi.banUser(activeRoom.channel.slug, selectedMember.userId!), "Użytkownik został zablokowany w pokoju.")}>Ban w pokoju</button>
                  {activeRoom.channel.currentUserRole === "OWNER" && <button className="secondary" disabled={actionBusy} onClick={() => void runAction(() => moderationApi.setModerator(activeRoom.channel.slug, selectedMember.userId!, selectedMember.role !== "MODERATOR"), selectedMember.role === "MODERATOR" ? "Usunięto rolę moderatora." : "Nadano rolę moderatora.")}>{selectedMember.role === "MODERATOR" ? "Usuń moderatora" : "Nadaj moderatora"}</button>}
                </>}
              </>}
            </div>
          </section>
        </div>
      )}

      {reportTarget && (
        <div className="rooms-modal-backdrop" onMouseDown={() => setReportTarget(null)}>
          <form className="rooms-modal compact-modal" onSubmit={submitReport} onMouseDown={(event) => event.stopPropagation()}>
            <div className="rooms-modal-heading"><div><h2>Zgłoś</h2><p>{reportTarget.label}</p></div><button type="button" onClick={() => setReportTarget(null)}>×</button></div>
            <label><span>Powód</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)}><option value="SPAM">Spam</option><option value="HARASSMENT">Nękanie lub obrażanie</option><option value="HATE">Mowa nienawiści</option><option value="SEXUAL">Treści seksualne</option><option value="VIOLENCE">Przemoc lub groźby</option><option value="IMPERSONATION">Podszywanie się</option><option value="ILLEGAL">Nielegalne treści</option><option value="OTHER">Inny powód</option></select></label>
            <label><span>Szczegóły (opcjonalnie)</span><textarea maxLength={1000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} /></label>
            <div className="rooms-modal-actions"><button type="button" className="secondary" onClick={() => setReportTarget(null)}>Anuluj</button><button type="submit" disabled={actionBusy}>{actionBusy ? "Wysyłanie..." : "Wyślij zgłoszenie"}</button></div>
          </form>
        </div>
      )}

      {showRoomSettings && activeRoom && (
        <div className="rooms-modal-backdrop" onMouseDown={() => setShowRoomSettings(false)}>
          <form className="rooms-modal compact-modal" onSubmit={saveSettings} onMouseDown={(event) => event.stopPropagation()}>
            <div className="rooms-modal-heading"><div><h2>Ustawienia #{activeRoom.channel.slug}</h2><p>Zmiany są widoczne od razu.</p></div><button type="button" onClick={() => setShowRoomSettings(false)}>×</button></div>
            <label><span>Temat</span><textarea maxLength={240} value={roomSettings.topic} onChange={(event) => setRoomSettings((current) => ({ ...current, topic: event.target.value }))} /></label>
            <label><span>Tryb powolny</span><select value={roomSettings.slowModeSeconds} onChange={(event) => setRoomSettings((current) => ({ ...current, slowModeSeconds: Number(event.target.value) }))}><option value={0}>Wyłączony</option><option value={5}>5 sekund</option><option value={15}>15 sekund</option><option value={30}>30 sekund</option><option value={60}>60 sekund</option></select></label>
            <label className="rooms-checkbox-row"><input type="checkbox" checked={roomSettings.allowGuests} onChange={(event) => setRoomSettings((current) => ({ ...current, allowGuests: event.target.checked }))} /><span>Zezwalaj gościom na dołączanie</span></label>
            <label className="rooms-checkbox-row"><input type="checkbox" checked={roomSettings.isLocked} onChange={(event) => setRoomSettings((current) => ({ ...current, isLocked: event.target.checked }))} /><span>Zamknij pokój dla zwykłych uczestników</span></label>
            <div className="rooms-modal-actions"><button type="button" className="secondary" onClick={() => setShowRoomSettings(false)}>Anuluj</button><button type="submit" disabled={actionBusy}>Zapisz</button></div>
          </form>
        </div>
      )}

      {showCreate && (
        <div className="rooms-modal-backdrop" onMouseDown={() => setShowCreate(false)}>
          <form className="rooms-modal" onSubmit={submitCreate} onMouseDown={(event) => event.stopPropagation()}>
            <div className="rooms-modal-heading"><div><h2>Utwórz własny pokój</h2><p>Pokój zostanie usunięty po 48 godzinach bez aktywności.</p></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>
            <label><span>Nazwa pokoju</span><input required minLength={3} maxLength={60} value={createForm.name} placeholder="np. Norfolk po polsku" onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label><span>Temat</span><textarea maxLength={240} value={createForm.topic} placeholder="O czym rozmawiacie?" onChange={(event) => setCreateForm((current) => ({ ...current, topic: event.target.value }))} /></label>
            <label className="rooms-checkbox-row"><input type="checkbox" checked={createForm.allowGuests} onChange={(event) => setCreateForm((current) => ({ ...current, allowGuests: event.target.checked }))} /><span>Zezwalaj gościom na dołączanie</span></label>
            <label><span>Tryb powolny</span><select value={createForm.slowModeSeconds} onChange={(event) => setCreateForm((current) => ({ ...current, slowModeSeconds: Number(event.target.value) }))}><option value={0}>Wyłączony</option><option value={5}>5 sekund</option><option value={15}>15 sekund</option><option value={30}>30 sekund</option></select></label>
            <div className="rooms-modal-actions"><button type="button" className="secondary" onClick={() => setShowCreate(false)}>Anuluj</button><button type="submit" disabled={createBusy}>{createBusy ? "Tworzenie..." : "Utwórz pokój"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
