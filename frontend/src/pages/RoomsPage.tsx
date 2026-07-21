import React, { useEffect, useMemo, useRef, useState } from "react";
import { accountApi, type AccountUser } from "../api/auth";
import { channelsApi, type ChannelListItem } from "../api/channels";
import {
  socket,
  type PublicChannel,
  type PublicChannelMember,
  type PublicChannelMessage
} from "../socket";
import { ChatiLogo } from "../components/Icons";
import "./rooms-page.css";

type RoomEvent =
  | ({ kind: "message" } & PublicChannelMessage)
  | {
      kind: "system";
      id: string;
      slug: string;
      text: string;
      createdAt: string;
    };

type OpenRoom = {
  channel: PublicChannel;
  events: RoomEvent[];
  members: PublicChannelMember[];
  online: number;
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
  switch (code) {
    case "ACCOUNT_REQUIRED":
      return "Ta funkcja wymaga zweryfikowanego konta.";
    case "GUEST_NICKNAME_REQUIRED":
      return "Wpisz pseudonim składający się z co najmniej 3 znaków.";
    case "CHANNEL_NOT_FOUND":
      return "Ten pokój już nie istnieje.";
    case "CHANNEL_FULL":
      return "Ten pokój jest obecnie pełny.";
    case "TOO_MANY_JOINED_CHANNELS":
      return "Osiągnięto limit jednocześnie otwartych pokoi.";
    case "MESSAGE_RATE_LIMITED":
      return "Wysyłasz wiadomości zbyt szybko.";
    case "SLOW_MODE":
      return `W tym pokoju działa tryb powolny. Spróbuj za ${Math.max(
        1,
        Math.ceil((retryAfterMs ?? 1000) / 1000)
      )} s.`;
    case "CHANNEL_SLUG_TAKEN":
      return "Pokój o takiej nazwie już istnieje.";
    default:
      return "Nie udało się wykonać tej operacji. Spróbuj ponownie.";
  }
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
  const [guestNickname, setGuestNickname] = useState(
    () => localStorage.getItem(GUEST_NICKNAME_KEY) || ""
  );
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    topic: "",
    allowGuests: true,
    slowModeSeconds: 0
  });
  const threadRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = activeSlug ? openRooms[activeSlug] : null;
  const filteredChannels = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(query) ||
        channel.slug.toLowerCase().includes(query) ||
        channel.topic?.toLowerCase().includes(query)
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
    void accountApi
      .me()
      .then((result) => setAccount(result.user))
      .catch(() => setAccount(null))
      .finally(() => setAccountReady(true));
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
        createdAt:
          typeof item.createdAt === "string"
            ? item.createdAt
            : new Date(item.createdAt).toISOString()
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
      setChannels((current) =>
        current.map((item) =>
          item.slug === payload.channel.slug
            ? { ...item, online: Math.max(item.online, payload.members.length) }
            : item
        )
      );
      setError(null);
    };

    const onMessage = (payload: PublicChannelMessage) => {
      setOpenRooms((current) => {
        const room = current[payload.slug];
        if (!room) return current;
        return {
          ...current,
          [payload.slug]: {
            ...room,
            events: [...room.events, { ...payload, kind: "message" }]
          }
        };
      });
    };

    const onSystem = (payload: {
      slug: string;
      type: "join" | "leave";
      nickname: string;
      createdAt: string;
    }) => {
      setOpenRooms((current) => {
        const room = current[payload.slug];
        if (!room) return current;
        const text =
          payload.type === "join"
            ? `${payload.nickname} dołącza do pokoju.`
            : `${payload.nickname} opuszcza pokój.`;
        return {
          ...current,
          [payload.slug]: {
            ...room,
            events: [...room.events, systemEvent(payload.slug, text, payload.createdAt)]
          }
        };
      });
    };

    const onPresence = (payload: {
      slug: string;
      online: number;
      members: PublicChannelMember[];
    }) => {
      setOpenRooms((current) => {
        const room = current[payload.slug];
        if (!room) return current;
        return {
          ...current,
          [payload.slug]: { ...room, online: payload.online, members: payload.members }
        };
      });
      setChannels((current) =>
        current.map((item) =>
          item.slug === payload.slug ? { ...item, online: payload.online } : item
        )
      );
    };

    const onPresenceChanged = (payload: { slug: string; online: number }) => {
      setChannels((current) =>
        current.map((item) =>
          item.slug === payload.slug ? { ...item, online: payload.online } : item
        )
      );
    };

    const onError = (payload: { code: string; retryAfterMs?: number }) => {
      setError(errorMessage(payload.code, payload.retryAfterMs));
    };

    socket.on("channel.joined", onJoined);
    socket.on("channel.message", onMessage);
    socket.on("channel.system", onSystem);
    socket.on("channel.presence", onPresence);
    socket.on("channels.presence.changed", onPresenceChanged);
    socket.on("channel.error", onError);

    if (socket.disconnected) socket.connect();

    return () => {
      socket.off("channel.joined", onJoined);
      socket.off("channel.message", onMessage);
      socket.off("channel.system", onSystem);
      socket.off("channel.presence", onPresence);
      socket.off("channels.presence.changed", onPresenceChanged);
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
    socket.emit("channel.join", {
      slug: channel.slug,
      nickname: account ? undefined : guestNickname.trim()
    });
    setActiveSlug(channel.slug);
  }

  function closeRoom(slug: string) {
    socket.emit("channel.leave", { slug });
    setOpenRooms((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
    setActiveSlug((current) => {
      if (current !== slug) return current;
      return Object.keys(openRooms).find((item) => item !== slug) ?? null;
    });
  }

  function sendMessage() {
    const text = message.trim();
    if (!text || !activeSlug) return;
    socket.emit("channel.message.send", { slug: activeSlug, text });
    setMessage("");
  }

  async function toggleFavourite(channel: ChannelListItem) {
    if (!account) {
      setError("Zaloguj się, aby zapisywać ulubione pokoje.");
      return;
    }
    try {
      if (channel.favourite) await channelsApi.unfavourite(channel.slug);
      else await channelsApi.favourite(channel.slug, false);
      setChannels((current) =>
        current.map((item) =>
          item.slug === channel.slug
            ? { ...item, favourite: !channel.favourite, autoJoin: false }
            : item
        )
      );
    } catch {
      setError("Nie udało się zmienić ulubionych.");
    }
  }

  async function toggleAutoJoin(channel: ChannelListItem) {
    if (!account) return;
    try {
      if (!channel.favourite) await channelsApi.favourite(channel.slug, true);
      else await channelsApi.updateFavourite(channel.slug, !channel.autoJoin);
      setChannels((current) =>
        current.map((item) =>
          item.slug === channel.slug
            ? { ...item, favourite: true, autoJoin: !channel.autoJoin }
            : item
        )
      );
    } catch {
      setError("Nie udało się zmienić automatycznego dołączania.");
    }
  }

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!account) {
      navigate("/konto/rejestracja");
      return;
    }
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
      const code = caught instanceof Error ? caught.message : "CHANNEL_CREATE_FAILED";
      setError(errorMessage(code));
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="rooms-layout">
      <header className="rooms-header">
        <button className="rooms-brand" type="button" onClick={onLeave}>
          <ChatiLogo size={34} />
          <span>Chati</span>
          <strong>Pokoje</strong>
        </button>
        <div className="rooms-header-actions">
          <span className="rooms-account-pill">
            {account ? `@${account.nickname}` : "Tryb gościa"}
          </span>
          {!account && (
            <button type="button" className="rooms-button secondary" onClick={() => navigate("/konto/logowanie")}>
              Zaloguj się
            </button>
          )}
          <button type="button" className="rooms-button secondary" onClick={onLeave}>
            Wyjdź
          </button>
        </div>
      </header>

      {error && (
        <div className="rooms-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="rooms-shell">
        <aside className="rooms-sidebar">
          <div className="rooms-sidebar-top">
            <div>
              <h1>Pokoje publiczne</h1>
              <p>Dołącz do rozmowy lub załóż własny pokój.</p>
            </div>
            <button
              type="button"
              className="rooms-create-button"
              onClick={() => (account ? setShowCreate(true) : navigate("/konto/rejestracja"))}
            >
              + Nowy
            </button>
          </div>

          {!account && (
            <label className="guest-nickname">
              <span>Twój pseudonim</span>
              <input
                value={guestNickname}
                maxLength={24}
                placeholder="np. Chris_Norfolk"
                onChange={(event) => setGuestNickname(event.target.value)}
              />
            </label>
          )}

          <input
            className="rooms-search"
            value={search}
            placeholder="Szukaj pokoju..."
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="rooms-list">
            {loadingChannels && <div className="rooms-empty-small">Ładowanie pokoi...</div>}
            {!loadingChannels && filteredChannels.length === 0 && (
              <div className="rooms-empty-small">Brak pasujących pokoi.</div>
            )}
            {filteredChannels.map((channel) => (
              <div
                className={`room-list-item ${activeSlug === channel.slug ? "active" : ""}`}
                key={channel.id}
              >
                <button type="button" className="room-list-main" onClick={() => joinChannel(channel)}>
                  <span className="room-hash">#</span>
                  <span className="room-list-copy">
                    <strong>{channel.name}</strong>
                    <small>{channel.topic || "Rozmowa publiczna"}</small>
                  </span>
                  <span className="room-online"><i />{channel.online}</span>
                </button>
                <button
                  type="button"
                  className={`room-star ${channel.favourite ? "selected" : ""}`}
                  title={channel.favourite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                  onClick={() => void toggleFavourite(channel)}
                >
                  {channel.favourite ? "★" : "☆"}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <main className="room-workspace">
          {Object.keys(openRooms).length > 0 && (
            <div className="room-tabs">
              {Object.values(openRooms).map((room) => (
                <button
                  type="button"
                  className={`room-tab ${activeSlug === room.channel.slug ? "active" : ""}`}
                  key={room.channel.slug}
                  onClick={() => setActiveSlug(room.channel.slug)}
                >
                  #{room.channel.slug}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeRoom(room.channel.slug);
                    }}
                    onKeyDown={() => undefined}
                  >×</span>
                </button>
              ))}
            </div>
          )}

          {!activeRoom ? (
            <div className="rooms-welcome">
              <div className="rooms-welcome-icon">#</div>
              <h2>Wybierz pokój i dołącz do rozmowy</h2>
              <p>
                Oficjalne pokoje są zawsze dostępne. Pokoje społeczności bez aktywności przez 48 godzin
                są automatycznie usuwane.
              </p>
              <div className="rooms-welcome-actions">
                <button type="button" onClick={() => filteredChannels[0] && joinChannel(filteredChannels[0])}>
                  Dołącz do #general
                </button>
                {!account && (
                  <button type="button" className="secondary" onClick={() => navigate("/konto/rejestracja")}>
                    Utwórz konto
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="room-titlebar">
                <div>
                  <h2>#{activeRoom.channel.slug}</h2>
                  <p>{activeRoom.channel.topic || "Rozmowa publiczna"}</p>
                </div>
                <div className="room-title-actions">
                  <span>{activeRoom.online} online</span>
                  {account && (() => {
                    const item = channels.find((channel) => channel.slug === activeRoom.channel.slug);
                    return item ? (
                      <button type="button" onClick={() => void toggleAutoJoin(item)}>
                        {item.autoJoin ? "Auto-join: włączony" : "Włącz auto-join"}
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="room-thread" ref={threadRef}>
                {activeRoom.events.length === 0 && (
                  <div className="room-thread-intro">
                    To początek rozmowy w #{activeRoom.channel.slug}. Przywitaj się 👋
                  </div>
                )}
                {activeRoom.events.map((event) =>
                  event.kind === "system" ? (
                    <div className="room-system-message" key={event.id}>{event.text}</div>
                  ) : (
                    <div className="room-message" key={event.id}>
                      <div className="room-avatar">{event.senderNickname.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <div className="room-message-meta">
                          <strong>{event.senderNickname}</strong>
                          <time>{formatTime(event.createdAt)}</time>
                        </div>
                        <p>{event.text}</p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="room-composer">
                <input
                  value={message}
                  maxLength={500}
                  placeholder={`Napisz wiadomość w #${activeRoom.channel.slug}`}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button type="button" disabled={!message.trim()} onClick={sendMessage}>Wyślij</button>
              </div>
            </>
          )}
        </main>

        <aside className="members-sidebar">
          <div className="members-title">
            <strong>Uczestnicy</strong>
            <span>{activeRoom?.online ?? 0}</span>
          </div>
          <div className="members-list">
            {activeRoom?.members.map((member, index) => (
              <div className="member-row" key={`${member.userId ?? member.nickname}_${index}`}>
                <span className="member-avatar">{member.nickname.slice(0, 1).toUpperCase()}</span>
                <span>{member.nickname}</span>
                <i />
              </div>
            ))}
            {activeRoom && activeRoom.members.length === 0 && (
              <div className="rooms-empty-small">Brak innych osób.</div>
            )}
          </div>
        </aside>
      </div>

      {showCreate && (
        <div className="rooms-modal-backdrop" onMouseDown={() => setShowCreate(false)}>
          <form className="rooms-modal" onSubmit={submitCreate} onMouseDown={(event) => event.stopPropagation()}>
            <div className="rooms-modal-heading">
              <div>
                <h2>Utwórz własny pokój</h2>
                <p>Pokój zostanie usunięty po 48 godzinach bez aktywności.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <label>
              <span>Nazwa pokoju</span>
              <input
                required
                minLength={3}
                maxLength={60}
                value={createForm.name}
                placeholder="np. Norfolk po polsku"
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              <span>Temat</span>
              <textarea
                maxLength={240}
                value={createForm.topic}
                placeholder="O czym rozmawiacie?"
                onChange={(event) => setCreateForm((current) => ({ ...current, topic: event.target.value }))}
              />
            </label>
            <label className="rooms-checkbox-row">
              <input
                type="checkbox"
                checked={createForm.allowGuests}
                onChange={(event) => setCreateForm((current) => ({ ...current, allowGuests: event.target.checked }))}
              />
              <span>Zezwalaj gościom na dołączanie</span>
            </label>
            <label>
              <span>Tryb powolny</span>
              <select
                value={createForm.slowModeSeconds}
                onChange={(event) => setCreateForm((current) => ({ ...current, slowModeSeconds: Number(event.target.value) }))}
              >
                <option value={0}>Wyłączony</option>
                <option value={5}>5 sekund</option>
                <option value={15}>15 sekund</option>
                <option value={30}>30 sekund</option>
                <option value={60}>60 sekund</option>
              </select>
            </label>
            <div className="rooms-modal-actions">
              <button type="button" className="secondary" onClick={() => setShowCreate(false)}>Anuluj</button>
              <button type="submit" disabled={createBusy}>{createBusy ? "Tworzenie..." : "Utwórz pokój"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
