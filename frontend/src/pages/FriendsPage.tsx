import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { accountApi, type AccountUser } from "../api/auth";
import {
  SocialApiError,
  socialApi,
  type DirectMessage,
  type PersonSearchResult,
  type SocialFriend,
  type SocialOverview,
  type SocialSettings
} from "../api/social";
import { socket, type DirectMessagePayload } from "../socket";
import { ChatiLogo } from "../components/Icons";
import "./friends-page.css";

export type FriendsTab = "friends" | "requests" | "search" | "settings";
type ConnectionState = "connecting" | "online" | "offline";
type IconName =
  | "account"
  | "arrow"
  | "check"
  | "checkDouble"
  | "close"
  | "friends"
  | "info"
  | "lock"
  | "message"
  | "more"
  | "plus"
  | "refresh"
  | "rooms"
  | "search"
  | "send"
  | "settings"
  | "shield";

type Props = {
  onLeave: () => void;
  navigate: (path: string) => void;
  initialFriendId?: string | null;
  initialTab?: FriendsTab;
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  const paths: Record<IconName, React.ReactNode> = {
    account: <><circle cx="12" cy="8" r="4" {...common}/><path d="M4 21a8 8 0 0 1 16 0" {...common}/></>,
    arrow: <path d="m15 18-6-6 6-6" {...common}/>,
    check: <path d="m5 12 4 4L19 6" {...common}/>,
    checkDouble: <><path d="m2 12 4 4L16 6" {...common}/><path d="m9 15 2 2L22 6" {...common}/></>,
    close: <path d="m6 6 12 12M18 6 6 18" {...common}/>,
    friends: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...common}/><circle cx="9" cy="7" r="4" {...common}/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...common}/></>,
    info: <><circle cx="12" cy="12" r="9" {...common}/><path d="M12 11v5M12 8h.01" {...common}/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" {...common}/><path d="M8 10V7a4 4 0 0 1 8 0v3" {...common}/></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" {...common}/><path d="M8 9h8M8 13h5" {...common}/></>,
    more: <><circle cx="5" cy="12" r="1" {...common}/><circle cx="12" cy="12" r="1" {...common}/><circle cx="19" cy="12" r="1" {...common}/></>,
    plus: <path d="M12 5v14M5 12h14" {...common}/>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" {...common}/><path d="M7 8a7 7 0 0 1 11.7-2.2L20 7M4 17l1.3 1.2A7 7 0 0 0 17 16" {...common}/></>,
    rooms: <><path d="M4 5h16v12H8l-4 3V5Z" {...common}/><path d="M8 9h8M8 13h5" {...common}/></>,
    search: <><circle cx="11" cy="11" r="7" {...common}/><path d="m20 20-4-4" {...common}/></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7Z" {...common}/><path d="M22 2 11 13" {...common}/></>,
    settings: <><circle cx="12" cy="12" r="3" {...common}/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.4.3.8.6 1 .3.3.7.4 1.1.4h.1v4h-.1c-.4 0-.8.1-1.1.4-.3.2-.5.6-.6 1Z" {...common}/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" {...common}/><path d="m9 12 2 2 4-4" {...common}/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>{paths[name]}</svg>;
}

function errorText(error: unknown) {
  const code = error instanceof SocialApiError ? error.code : error instanceof Error ? error.message : String(error);
  const messages: Record<string, string> = {
    USER_NOT_FOUND: "Nie znaleziono takiego użytkownika.",
    CANNOT_ADD_SELF: "Nie możesz dodać siebie.",
    FRIEND_REQUESTS_DISABLED: "Ten użytkownik nie przyjmuje zaproszeń.",
    SHARED_CHANNEL_REQUIRED: "Możesz zaprosić tę osobę dopiero po wspólnym pokoju.",
    REQUEST_ALREADY_PENDING: "Zaproszenie już oczekuje.",
    ALREADY_FRIENDS: "Ta osoba jest już w Twoich znajomych.",
    RELATIONSHIP_BLOCKED: "Ta relacja jest zablokowana.",
    FRIENDSHIP_NOT_FOUND: "Nie jesteście już znajomymi.",
    DIRECT_MESSAGES_DISABLED: "Ta osoba wyłączyła prywatne wiadomości.",
    AUTH_REQUIRED: "Sesja wygasła. Zaloguj się ponownie.",
    EMAIL_NOT_VERIFIED: "Najpierw potwierdź adres e-mail."
  };
  return messages[code] || "Nie udało się wykonać tej operacji. Spróbuj ponownie.";
}

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return date.toLocaleString(
    "pl-PL",
    sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
  );
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Dzisiaj";
  if (date.toDateString() === yesterday.toDateString()) return "Wczoraj";
  return date.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function dayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function presenceLabel(friend: SocialFriend) {
  if (friend.user.online) return "Online";
  if (friend.user.lastSeenAt) return `Ostatnio ${formatTime(friend.user.lastSeenAt)}`;
  return "Offline";
}

function mergeMessages(current: DirectMessage[], incoming: DirectMessage[]) {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function asDirectMessage(message: DirectMessagePayload): DirectMessage {
  return message;
}

function messageState(item: DirectMessage) {
  if (item.readAt) return { label: "Przeczytano", icon: "checkDouble" as const, read: true };
  if (item.deliveredAt) return { label: "Dostarczono", icon: "checkDouble" as const, read: false };
  return { label: "Wysłano", icon: "check" as const, read: false };
}

export default function FriendsPage({ onLeave, navigate, initialFriendId = null, initialTab = "friends" }: Props) {
  const [account, setAccount] = useState<AccountUser | null | undefined>(undefined);
  const [overview, setOverview] = useState<SocialOverview | null>(null);
  const [tab, setTab] = useState<FriendsTab>(initialTab);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [messagesByFriend, setMessagesByFriend] = useState<Record<string, DirectMessage[]>>({});
  const [message, setMessage] = useState("");
  const [friendFilter, setFriendFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [typingByFriend, setTypingByFriend] = useState<Record<string, boolean>>({});
  const [settingsDraft, setSettingsDraft] = useState<SocialSettings | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(socket.connected ? "online" : "connecting");
  const [showDetails, setShowDetails] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const activeFriendIdRef = useRef<string | null>(null);
  const initialOpenedRef = useRef(false);

  const activeFriend = useMemo(
    () => overview?.friends.find((friend) => friend.user.id === activeFriendId) ?? null,
    [overview, activeFriendId]
  );
  const activeMessages = activeFriendId ? messagesByFriend[activeFriendId] ?? [] : [];
  const unreadTotal = overview?.friends.reduce((sum, friend) => sum + (friend.conversation?.unread ?? 0), 0) ?? 0;

  const visibleFriends = useMemo(() => {
    const query = friendFilter.trim().toLocaleLowerCase("pl-PL");
    return [...(overview?.friends ?? [])]
      .filter((friend) => !query || friend.user.nickname.toLocaleLowerCase("pl-PL").includes(query))
      .sort((left, right) => {
        const leftUnread = left.conversation?.unread ?? 0;
        const rightUnread = right.conversation?.unread ?? 0;
        if (leftUnread !== rightUnread) return rightUnread - leftUnread;
        if (left.user.online !== right.user.online) return left.user.online ? -1 : 1;
        const leftUpdated = left.conversation?.updatedAt || left.user.lastSeenAt || "";
        const rightUpdated = right.conversation?.updatedAt || right.user.lastSeenAt || "";
        return new Date(rightUpdated || 0).getTime() - new Date(leftUpdated || 0).getTime();
      });
  }, [friendFilter, overview?.friends]);

  useEffect(() => {
    activeFriendIdRef.current = activeFriendId;
  }, [activeFriendId]);

  async function refreshOverview() {
    const next = await socialApi.overview();
    setOverview(next);
    setSettingsDraft(next.settings);
    setActiveFriendId((current) => current && next.friends.some((friend) => friend.user.id === current) ? current : null);
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { user } = await accountApi.me();
        if (cancelled) return;
        setAccount(user);
        if (user) await refreshOverview();
      } catch (nextError) {
        if (cancelled) return;
        setAccount(null);
        setError(errorText(nextError));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!overview || !initialFriendId || initialOpenedRef.current) return;
    initialOpenedRef.current = true;
    const friend = overview.friends.find((item) => item.user.id === initialFriendId);
    if (friend) void selectFriend(friend);
  }, [initialFriendId, overview]);

  useEffect(() => {
    if (!account) return;

    const onConnect = () => setConnectionState("online");
    const onDisconnect = () => setConnectionState("offline");
    const onSocialChanged = () => void refreshOverview().catch(() => undefined);
    const onPresence = (payload: { userId: string; online: boolean; lastSeenAt: string | null }) => {
      setOverview((current) => current && {
        ...current,
        friends: current.friends.map((friend) => friend.user.id === payload.userId
          ? { ...friend, user: { ...friend.user, online: payload.online, lastSeenAt: payload.lastSeenAt } }
          : friend)
      });
    };
    const storeMessage = (payload: { message: DirectMessagePayload }) => {
      const directMessage = asDirectMessage(payload.message);
      const friendId = directMessage.senderId === account.id ? directMessage.recipientId : directMessage.senderId;
      const incoming = directMessage.recipientId === account.id;
      const isActive = activeFriendIdRef.current === friendId;
      setMessagesByFriend((current) => ({
        ...current,
        [friendId]: mergeMessages(current[friendId] ?? [], [directMessage])
      }));
      setOverview((current) => current && {
        ...current,
        friends: current.friends.map((friend) => friend.user.id === friendId ? {
          ...friend,
          conversation: {
            id: directMessage.conversationId,
            updatedAt: directMessage.createdAt,
            unread: incoming ? (isActive ? 0 : (friend.conversation?.unread ?? 0) + 1) : (friend.conversation?.unread ?? 0),
            lastMessage: {
              id: directMessage.id,
              senderId: directMessage.senderId,
              text: directMessage.text,
              createdAt: directMessage.createdAt,
              deliveredAt: directMessage.deliveredAt,
              readAt: directMessage.readAt
            }
          }
        } : friend)
      });
      if (incoming && isActive) {
        socket.emit("direct.message.read", { friendId });
        void socialApi.markRead(friendId).catch(() => undefined);
      }
    };
    const onSync = (payload: { messages: DirectMessagePayload[] }) => {
      const grouped = new Map<string, DirectMessage[]>();
      for (const item of payload.messages) {
        const friendId = item.senderId === account.id ? item.recipientId : item.senderId;
        const items = grouped.get(friendId) ?? [];
        items.push(asDirectMessage(item));
        grouped.set(friendId, items);
      }
      setMessagesByFriend((current) => {
        const next = { ...current };
        for (const [friendId, items] of grouped) next[friendId] = mergeMessages(next[friendId] ?? [], items);
        return next;
      });
      const activeId = activeFriendIdRef.current;
      if (activeId && grouped.has(activeId)) socket.emit("direct.message.read", { friendId: activeId });
    };
    const onDelivered = (payload: { messageIds: string[]; deliveredAt: string | null }) => {
      const ids = new Set(payload.messageIds);
      setMessagesByFriend((current) => Object.fromEntries(
        Object.entries(current).map(([friendId, items]) => [
          friendId,
          items.map((item) => ids.has(item.id) ? { ...item, deliveredAt: payload.deliveredAt } : item)
        ])
      ));
    };
    const onRead = (payload: { readerId: string; friendId: string; readAt: string }) => {
      const counterpartId = payload.readerId === account.id ? payload.friendId : payload.readerId;
      setMessagesByFriend((current) => ({
        ...current,
        [counterpartId]: (current[counterpartId] ?? []).map((item) => item.senderId !== payload.readerId
          ? { ...item, deliveredAt: item.deliveredAt || payload.readAt, readAt: payload.readAt }
          : item)
      }));
    };
    const onTyping = (payload: { friendId: string; typing: boolean }) => {
      setTypingByFriend((current) => ({ ...current, [payload.friendId]: payload.typing }));
    };
    const onDirectError = (payload: { code: string }) => setError(errorText(payload.code));

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("social.changed", onSocialChanged);
    socket.on("friend.presence", onPresence);
    socket.on("direct.message.sent", storeMessage);
    socket.on("direct.message.received", storeMessage);
    socket.on("direct.messages.sync", onSync);
    socket.on("direct.messages.delivered", onDelivered);
    socket.on("direct.messages.read", onRead);
    socket.on("direct.typing", onTyping);
    socket.on("direct.error", onDirectError);

    if (socket.disconnected) {
      setConnectionState("connecting");
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("social.changed", onSocialChanged);
      socket.off("friend.presence", onPresence);
      socket.off("direct.message.sent", storeMessage);
      socket.off("direct.message.received", storeMessage);
      socket.off("direct.messages.sync", onSync);
      socket.off("direct.messages.delivered", onDelivered);
      socket.off("direct.messages.read", onRead);
      socket.off("direct.typing", onTyping);
      socket.off("direct.error", onDirectError);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, [account]);

  useEffect(() => {
    const element = threadRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activeMessages.length, activeFriendId, typingByFriend]);

  useEffect(() => {
    if (!showDetails) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDetails(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", close);
    };
  }, [showDetails]);

  async function selectFriend(friend: SocialFriend) {
    setActiveFriendId(friend.user.id);
    setTab("friends");
    setMessage("");
    setShowDetails(false);
    setError(null);
    setOverview((current) => current && {
      ...current,
      friends: current.friends.map((item) => item.user.id === friend.user.id && item.conversation
        ? { ...item, conversation: { ...item.conversation, unread: 0 } }
        : item)
    });
    try {
      const result = await socialApi.messages(friend.user.id);
      setMessagesByFriend((current) => ({
        ...current,
        [friend.user.id]: mergeMessages(current[friend.user.id] ?? [], result.messages)
      }));
      if (socket.connected) socket.emit("direct.message.read", { friendId: friend.user.id });
      void socialApi.markRead(friend.user.id).catch(() => undefined);
    } catch (nextError) {
      setError(errorText(nextError));
    }
  }

  function sendMessage() {
    if (!activeFriend || !message.trim() || connectionState !== "online" || !activeFriend.user.allowDirectMessages) return;
    socket.emit("direct.message.send", { recipientId: activeFriend.user.id, text: message.trim() });
    setMessage("");
    socket.emit("direct.typing.stop", { friendId: activeFriend.user.id });
  }

  function handleMessageChange(value: string) {
    setMessage(value);
    if (!activeFriend || connectionState !== "online") return;
    socket.emit("direct.typing.start", { friendId: activeFriend.user.id });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      socket.emit("direct.typing.stop", { friendId: activeFriend.user.id });
    }, 1000);
  }

  async function runAction(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refreshOverview();
      if (success) setNotice(success);
      return true;
    } catch (nextError) {
      setError(errorText(nextError));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function searchPeople(event: React.FormEvent) {
    event.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setSearchAttempted(true);
    setError(null);
    try {
      const result = await socialApi.search(searchQuery.trim());
      setSearchResults(result.users);
    } catch (nextError) {
      setError(errorText(nextError));
    } finally {
      setSearching(false);
    }
  }

  async function removeActiveFriend() {
    if (!activeFriend || !window.confirm(`Usunąć ${activeFriend.user.nickname} ze znajomych? Historia rozmowy pozostanie zapisana zgodnie z polityką prywatności.`)) return;
    const removed = await runAction(() => socialApi.removeFriend(activeFriend.user.id), "Znajomy został usunięty.");
    if (removed) {
      setActiveFriendId(null);
      setShowDetails(false);
    }
  }

  async function blockActiveFriend() {
    if (!activeFriend || !window.confirm(`Zablokować ${activeFriend.user.nickname}? Nie będziecie mogli wysyłać sobie wiadomości ani zaproszeń.`)) return;
    const blocked = await runAction(() => socialApi.blockUser(activeFriend.user.id), "Użytkownik został zablokowany.");
    if (blocked) {
      setActiveFriendId(null);
      setShowDetails(false);
    }
  }

  if (account === undefined) {
    return <div className="friends-loading"><span className="friends-spinner"/><strong>Ładujemy wiadomości</strong><small>Sprawdzamy znajomych i rozmowy.</small></div>;
  }

  if (!account) {
    return (
      <div className="friends-auth-required">
        <div className="friends-auth-logo"><ChatiLogo size={48}/></div>
        <span className="friends-eyebrow">Znajomi i wiadomości</span>
        <h1>Prywatne rozmowy wymagają konta</h1>
        <p>Zaloguj się, aby zachować znajomych, odbierać wiadomości offline i kontrolować swoją prywatność.</p>
        <div className="friends-auth-actions">
          <button type="button" onClick={() => navigate("/konto/logowanie")}>Zaloguj się</button>
          <button type="button" className="secondary" onClick={() => navigate("/konto/rejestracja")}>Utwórz konto</button>
        </div>
        <button type="button" className="friends-auth-back" onClick={onLeave}><Icon name="arrow" size={17}/>Wróć na stronę główną</button>
      </div>
    );
  }

  return (
    <div className={`friends-layout ${activeFriend ? "has-active-conversation" : ""}`}>
      <header className="friends-header">
        <button className="friends-brand" type="button" onClick={onLeave} aria-label="Chati — strona główna">
          <ChatiLogo size={34}/><span>Chati</span><strong>Wiadomości</strong>
        </button>
        <div className="friends-header-copy">
          <strong>{activeFriend ? activeFriend.user.nickname : "Znajomi i wiadomości"}</strong>
          <span>{activeFriend ? presenceLabel(activeFriend) : `@${account.nickname} · ${overview?.friends.length ?? 0} znajomych`}</span>
        </div>
        <div className="friends-header-actions">
          <button type="button" className="friends-header-link desktop-only" onClick={() => navigate("/pokoje")}><Icon name="rooms" size={17}/>Pokoje</button>
          <button type="button" className="friends-header-link desktop-only" onClick={() => navigate("/konto")}><Icon name="account" size={17}/>Konto</button>
          <button type="button" className="friends-header-close" onClick={onLeave} aria-label="Wyjdź z wiadomości"><Icon name="close"/></button>
        </div>
      </header>

      {connectionState !== "online" && (
        <div className={`friends-connection ${connectionState}`} role="status">
          <span className="friends-connection-dot"/>
          <div><strong>{connectionState === "connecting" ? "Łączenie z wiadomościami…" : "Brak połączenia"}</strong><span>{connectionState === "offline" ? "Możesz czytać zapisane rozmowy, ale wysyłanie jest chwilowo wyłączone." : "Przywracamy statusy i nowe wiadomości."}</span></div>
          {connectionState === "offline" && <button type="button" onClick={() => { setConnectionState("connecting"); socket.connect(); }}><Icon name="refresh" size={17}/>Połącz ponownie</button>}
        </div>
      )}

      {error && <div className="friends-toast error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Zamknij komunikat"><Icon name="close" size={18}/></button></div>}
      {notice && <div className="friends-toast success" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Zamknij komunikat"><Icon name="close" size={18}/></button></div>}

      <div className="friends-body">
        <aside className="friends-sidebar" aria-label="Znajomi i ustawienia">
          <div className="friends-sidebar-heading">
            <div><span className="friends-eyebrow">Twoja sieć</span><h1>Wiadomości</h1></div>
            <button type="button" onClick={() => setTab("search")} aria-label="Znajdź osobę"><Icon name="plus"/></button>
          </div>

          <nav className="friends-tabs" aria-label="Sekcje wiadomości">
            <button type="button" className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}><Icon name="message"/><span>Rozmowy</span>{unreadTotal > 0 && <b>{unreadTotal > 99 ? "99+" : unreadTotal}</b>}</button>
            <button type="button" className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><Icon name="friends"/><span>Zaproszenia</span>{overview?.incoming.length ? <b>{overview.incoming.length}</b> : null}</button>
            <button type="button" className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}><Icon name="search"/><span>Znajdź</span></button>
            <button type="button" className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><Icon name="settings"/><span>Prywatność</span></button>
          </nav>

          <div className="friends-panel-scroll">
            {tab === "friends" && (
              <div className="friends-list-panel">
                <div className="friends-search-wrap"><Icon name="search" size={18}/><input value={friendFilter} onChange={(event) => setFriendFilter(event.target.value)} placeholder="Szukaj w znajomych"/>{friendFilter && <button type="button" onClick={() => setFriendFilter("")} aria-label="Wyczyść"><Icon name="close" size={16}/></button>}</div>
                <div className="friends-list">
                  {visibleFriends.map((friend) => {
                    const last = friend.conversation?.lastMessage;
                    const mine = last?.senderId === account.id;
                    return (
                      <button key={friend.user.id} type="button" className={`friend-row ${activeFriendId === friend.user.id ? "active" : ""}`} onClick={() => void selectFriend(friend)}>
                        <span className="friend-avatar">{friend.user.nickname.slice(0, 1).toUpperCase()}<i className={friend.user.online ? "online" : ""}/></span>
                        <span className="friend-row-copy">
                          <span className="friend-row-title"><strong>{friend.user.nickname}</strong>{last && <time>{formatTime(last.createdAt)}</time>}</span>
                          <small className={(friend.conversation?.unread ?? 0) > 0 ? "unread" : ""}>{last ? `${mine ? "Ty: " : ""}${last.text}` : presenceLabel(friend)}</small>
                        </span>
                        {(friend.conversation?.unread ?? 0) > 0 && <b className="unread-badge">{friend.conversation!.unread > 99 ? "99+" : friend.conversation!.unread}</b>}
                      </button>
                    );
                  })}
                  {!overview?.friends.length && <div className="friends-empty-state"><Icon name="friends" size={28}/><strong>Twoja lista jest jeszcze pusta</strong><small>Znajdź osobę po pseudonimie albo dodaj kogoś poznanego w pokoju.</small><button type="button" onClick={() => setTab("search")}>Znajdź osobę</button></div>}
                  {Boolean(overview?.friends.length) && visibleFriends.length === 0 && <div className="friends-empty-state compact"><Icon name="search" size={24}/><strong>Brak pasujących osób</strong><small>Spróbuj innego pseudonimu.</small></div>}
                </div>
              </div>
            )}

            {tab === "requests" && (
              <div className="request-list">
                <section>
                  <div className="friends-section-heading"><div><span className="friends-eyebrow">Do decyzji</span><h2>Otrzymane</h2></div><b>{overview?.incoming.length ?? 0}</b></div>
                  {overview?.incoming.map((request) => (
                    <article className="request-card" key={request.id}>
                      <span className="request-avatar">{request.user.nickname.slice(0, 1).toUpperCase()}<i className={request.user.online ? "online" : ""}/></span>
                      <div><strong>{request.user.nickname}</strong><small>{request.user.online ? "Teraz online" : `Zaproszenie ${formatTime(request.createdAt)}`}</small></div>
                      <div className="request-actions"><button type="button" disabled={busy} onClick={() => void runAction(() => socialApi.acceptRequest(request.id), `Dodano ${request.user.nickname} do znajomych.`)}>Akceptuj</button><button type="button" className="secondary" disabled={busy} onClick={() => void runAction(() => socialApi.declineRequest(request.id), "Zaproszenie zostało odrzucone.")}>Odrzuć</button></div>
                    </article>
                  ))}
                  {!overview?.incoming.length && <div className="friends-empty-state compact"><Icon name="check" size={24}/><strong>Wszystko załatwione</strong><small>Nie masz nowych zaproszeń.</small></div>}
                </section>

                <section>
                  <div className="friends-section-heading"><div><span className="friends-eyebrow">Oczekujące</span><h2>Wysłane</h2></div><b>{overview?.outgoing.length ?? 0}</b></div>
                  {overview?.outgoing.map((request) => (
                    <article className="request-card" key={request.id}>
                      <span className="request-avatar neutral">{request.user.nickname.slice(0, 1).toUpperCase()}</span>
                      <div><strong>{request.user.nickname}</strong><small>Wysłano {formatTime(request.createdAt)}</small></div>
                      <button type="button" className="secondary" disabled={busy} onClick={() => void runAction(() => socialApi.cancelRequest(request.id), "Zaproszenie zostało anulowane.")}>Anuluj</button>
                    </article>
                  ))}
                  {!overview?.outgoing.length && <div className="friends-empty-state compact"><Icon name="send" size={24}/><strong>Brak wysłanych zaproszeń</strong><small>Możesz znaleźć osobę po pseudonimie.</small></div>}
                </section>
              </div>
            )}

            {tab === "search" && (
              <div className="people-search">
                <div className="friends-panel-intro"><span className="friends-eyebrow">Nowe kontakty</span><h2>Znajdź osobę</h2><p>Wpisz co najmniej dwa znaki dokładnego pseudonimu.</p></div>
                <form onSubmit={searchPeople}><div><Icon name="search" size={18}/><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Pseudonim" minLength={2} maxLength={24}/></div><button type="submit" disabled={searching || searchQuery.trim().length < 2}>{searching ? "Szukam…" : "Szukaj"}</button></form>
                <div className="people-results">
                  {searchResults.map((person) => (
                    <article className="person-card" key={person.id}>
                      <span className="request-avatar">{person.nickname.slice(0, 1).toUpperCase()}<i className={person.online ? "online" : ""}/></span>
                      <div><strong>{person.nickname}</strong><small>{person.online ? "Online" : "Offline"}</small></div>
                      {person.relationshipStatus === "NONE" && <button type="button" disabled={busy} onClick={() => void runAction(() => socialApi.sendRequest(person.nickname), `Zaproszenie do ${person.nickname} zostało wysłane.`)}>Dodaj</button>}
                      {person.relationshipStatus === "PENDING_OUTGOING" && <span className="status-pill">Zaproszenie wysłane</span>}
                      {person.relationshipStatus === "PENDING_INCOMING" && <button type="button" className="secondary" onClick={() => setTab("requests")}>Odpowiedz</button>}
                      {person.relationshipStatus === "FRIENDS" && <button type="button" className="secondary" onClick={() => { const friend = overview?.friends.find((item) => item.user.id === person.id); if (friend) void selectFriend(friend); }}>Napisz</button>}
                      {person.relationshipStatus === "BLOCKED" && <span className="status-pill danger">Zablokowany</span>}
                    </article>
                  ))}
                  {searching && <div className="friends-empty-state compact"><span className="friends-spinner"/><strong>Szukamy</strong><small>Sprawdzamy dostępne konta.</small></div>}
                  {!searching && searchAttempted && searchResults.length === 0 && <div className="friends-empty-state compact"><Icon name="search" size={24}/><strong>Nikogo nie znaleziono</strong><small>Sprawdź pisownię pseudonimu.</small></div>}
                  {!searchAttempted && <div className="friends-search-tip"><Icon name="shield" size={22}/><div><strong>Szanuj prywatność innych</strong><span>Zaproszenie może zostać ograniczone do osób ze wspólnych pokoi.</span></div></div>}
                </div>
              </div>
            )}

            {tab === "settings" && settingsDraft && (
              <div className="social-settings">
                <div className="friends-panel-intro"><span className="friends-eyebrow">Kontrola kontaktów</span><h2>Prywatność</h2><p>Wybierz, kto może Cię znaleźć i kiedy inni widzą Twoją aktywność.</p></div>
                <section className="settings-card">
                  <label className="settings-select"><span><strong>Kto może wysyłać zaproszenia?</strong><small>Ograniczenie działa także w wyszukiwarce.</small></span><select value={settingsDraft.friendRequestPolicy} onChange={(event) => setSettingsDraft({ ...settingsDraft, friendRequestPolicy: event.target.value as SocialSettings["friendRequestPolicy"] })}><option value="EVERYONE">Wszyscy</option><option value="SHARED_CHANNELS">Osoby ze wspólnych pokoi</option><option value="NOBODY">Nikt</option></select></label>
                  <label className="toggle-row"><input type="checkbox" checked={settingsDraft.allowDirectMessages} onChange={(event) => setSettingsDraft({ ...settingsDraft, allowDirectMessages: event.target.checked })}/><span><strong>Prywatne wiadomości</strong><small>Zezwalaj znajomym na rozpoczynanie rozmowy.</small></span></label>
                  <label className="toggle-row"><input type="checkbox" checked={settingsDraft.showOnline} onChange={(event) => setSettingsDraft({ ...settingsDraft, showOnline: event.target.checked })}/><span><strong>Status online</strong><small>Pokazuj znajomym, że korzystasz teraz z Chati.</small></span></label>
                  <label className="toggle-row"><input type="checkbox" checked={settingsDraft.showLastSeen} onChange={(event) => setSettingsDraft({ ...settingsDraft, showLastSeen: event.target.checked })}/><span><strong>Ostatnia aktywność</strong><small>Pozwól znajomym zobaczyć, kiedy ostatnio byłeś online.</small></span></label>
                  <button type="button" className="settings-save" disabled={busy} onClick={() => void runAction(() => socialApi.updateSettings(settingsDraft), "Ustawienia prywatności zostały zapisane.")}>{busy ? "Zapisywanie…" : "Zapisz ustawienia"}</button>
                </section>

                <section className="blocked-section">
                  <div className="friends-section-heading"><div><span className="friends-eyebrow">Bezpieczeństwo</span><h2>Zablokowani</h2></div><b>{overview?.blocked.length ?? 0}</b></div>
                  {overview?.blocked.map((item) => <article className="person-card" key={item.id}><span className="request-avatar neutral">{item.user.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{item.user.nickname}</strong><small>Nie może wysyłać wiadomości ani zaproszeń</small></div><button type="button" className="secondary" disabled={busy} onClick={() => void runAction(() => socialApi.unblockUser(item.user.id), `${item.user.nickname} został odblokowany.`)}>Odblokuj</button></article>)}
                  {!overview?.blocked.length && <div className="friends-empty-state compact"><Icon name="shield" size={24}/><strong>Brak zablokowanych osób</strong><small>Lista pojawi się tutaj po zablokowaniu profilu.</small></div>}
                </section>
              </div>
            )}
          </div>
        </aside>

        <main className="conversation-shell">
          {activeFriend ? (
            <>
              <div className="conversation-header">
                <button type="button" className="conversation-back" onClick={() => setActiveFriendId(null)} aria-label="Wróć do rozmów"><Icon name="arrow"/></button>
                <button type="button" className="conversation-person" onClick={() => setShowDetails(true)}>
                  <span className="conversation-avatar">{activeFriend.user.nickname.slice(0, 1).toUpperCase()}<i className={activeFriend.user.online ? "online" : ""}/></span>
                  <span><strong>{activeFriend.user.nickname}</strong><small>{typingByFriend[activeFriend.user.id] ? "Pisze…" : presenceLabel(activeFriend)}</small></span>
                </button>
                <button type="button" className="conversation-info" onClick={() => setShowDetails(true)} aria-label="Informacje o znajomym"><Icon name="info"/></button>
              </div>

              {!activeFriend.user.allowDirectMessages && <div className="conversation-state-banner"><Icon name="lock"/><div><strong>Wiadomości są wyłączone</strong><span>Ta osoba nie przyjmuje obecnie prywatnych wiadomości.</span></div></div>}

              <div className="conversation-thread" ref={threadRef} aria-live="polite">
                {!activeMessages.length && <div className="conversation-empty"><span className="conversation-avatar large">{activeFriend.user.nickname.slice(0, 1).toUpperCase()}</span><strong>To początek Waszej rozmowy</strong><small>Wiadomości są zapisywane i dotrą również wtedy, gdy druga osoba jest offline.</small></div>}
                {activeMessages.map((item, index) => {
                  const mine = item.senderId === account.id;
                  const previous = activeMessages[index - 1];
                  const showDay = !previous || dayKey(previous.createdAt) !== dayKey(item.createdAt);
                  const state = messageState(item);
                  return (
                    <Fragment key={item.id}>
                      {showDay && <div className="conversation-day"><span>{dayLabel(item.createdAt)}</span></div>}
                      <article className={`direct-message ${mine ? "mine" : "theirs"}`}>
                        <div className="direct-message-bubble">{item.text}</div>
                        <small><time>{formatTime(item.createdAt)}</time>{mine && <span className={state.read ? "read" : ""} title={state.label}><Icon name={state.icon} size={14}/>{state.label}</span>}</small>
                      </article>
                    </Fragment>
                  );
                })}
                {typingByFriend[activeFriend.user.id] && <div className="direct-typing"><span/><span/><span/><small>{activeFriend.user.nickname} pisze</small></div>}
              </div>

              <div className="conversation-compose">
                <div className="conversation-compose-box">
                  <textarea value={message} rows={1} onChange={(event) => handleMessageChange(event.target.value)} onBlur={() => activeFriend && socket.emit("direct.typing.stop", { friendId: activeFriend.user.id })} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={!activeFriend.user.allowDirectMessages ? "Ta osoba wyłączyła wiadomości" : connectionState !== "online" ? "Oczekiwanie na połączenie…" : "Napisz wiadomość…"} maxLength={500} disabled={!activeFriend.user.allowDirectMessages || connectionState !== "online"}/>
                  <div><span>Enter wysyła · Shift+Enter dodaje linię</span><span className={message.length > 450 ? "warning" : ""}>{message.length}/500</span></div>
                </div>
                <button type="button" className="conversation-send" onClick={sendMessage} disabled={!message.trim() || !activeFriend.user.allowDirectMessages || connectionState !== "online"} aria-label="Wyślij wiadomość"><Icon name="send"/><span>Wyślij</span></button>
              </div>
            </>
          ) : (
            <div className="conversation-placeholder">
              <div className="conversation-placeholder-icon"><Icon name="message" size={34}/></div>
              <span className="friends-eyebrow">Prywatne wiadomości</span>
              <h2>Wybierz rozmowę</h2>
              <p>Rozmawiaj ze znajomymi w czasie rzeczywistym lub zostaw wiadomość, którą odbiorą później.</p>
              <div><span><strong>{overview?.friends.filter((friend) => friend.user.online).length ?? 0}</strong> online</span><span><strong>{unreadTotal}</strong> nieprzeczytanych</span></div>
              <button type="button" onClick={() => setTab("search")}><Icon name="plus" size={18}/>Znajdź osobę</button>
            </div>
          )}
        </main>
      </div>

      <button className={`friend-details-backdrop ${showDetails ? "is-visible" : ""}`} type="button" aria-label="Zamknij informacje" onClick={() => setShowDetails(false)}/>
      <aside className={`friend-details ${showDetails ? "is-open" : ""}`} aria-hidden={!showDetails} aria-label="Informacje o znajomym">
        <div className="friend-details-heading"><span>Informacje</span><button type="button" onClick={() => setShowDetails(false)} aria-label="Zamknij"><Icon name="close"/></button></div>
        {activeFriend && <div className="friend-details-content">
          <span className="conversation-avatar profile">{activeFriend.user.nickname.slice(0, 1).toUpperCase()}<i className={activeFriend.user.online ? "online" : ""}/></span>
          <h2>{activeFriend.user.nickname}</h2>
          <p>{presenceLabel(activeFriend)}</p>
          <div className="friend-details-status"><span><Icon name="message" size={17}/><strong>{activeFriend.user.allowDirectMessages ? "Wiadomości włączone" : "Wiadomości wyłączone"}</strong></span><span><Icon name="shield" size={17}/><strong>Zweryfikowane konto</strong></span></div>
          <div className="friend-details-actions"><button type="button" onClick={() => { setShowDetails(false); setTab("settings"); }}><Icon name="settings" size={18}/><span><strong>Ustawienia prywatności</strong><small>Zmień widoczność i wiadomości</small></span></button><button type="button" className="warning" disabled={busy} onClick={() => void removeActiveFriend()}><Icon name="friends" size={18}/><span><strong>Usuń ze znajomych</strong><small>Zakończ relację na Chati</small></span></button><button type="button" className="danger" disabled={busy} onClick={() => void blockActiveFriend()}><Icon name="lock" size={18}/><span><strong>Zablokuj użytkownika</strong><small>Zatrzymaj wiadomości i zaproszenia</small></span></button></div>
        </div>}
      </aside>
    </div>
  );
}
