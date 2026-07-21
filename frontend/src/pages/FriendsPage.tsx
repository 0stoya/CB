import React, { useEffect, useMemo, useRef, useState } from "react";
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

type Props = {
  onLeave: () => void;
  navigate: (path: string) => void;
};

type Tab = "friends" | "requests" | "search" | "settings";

function errorText(error: unknown) {
  const code = error instanceof SocialApiError ? error.code : String(error);
  const messages: Record<string, string> = {
    USER_NOT_FOUND: "Nie znaleziono takiego użytkownika.",
    CANNOT_ADD_SELF: "Nie możesz dodać siebie.",
    FRIEND_REQUESTS_DISABLED: "Ten użytkownik nie przyjmuje zaproszeń.",
    SHARED_CHANNEL_REQUIRED: "Możesz zaprosić tę osobę dopiero po wspólnym kanale.",
    REQUEST_ALREADY_PENDING: "Zaproszenie już oczekuje.",
    ALREADY_FRIENDS: "Ta osoba jest już w Twoich znajomych.",
    RELATIONSHIP_BLOCKED: "Ta relacja jest zablokowana.",
    FRIENDSHIP_NOT_FOUND: "Nie jesteście już znajomymi.",
    DIRECT_MESSAGES_DISABLED: "Ta osoba wyłączyła prywatne wiadomości.",
    AUTH_REQUIRED: "Zaloguj się ponownie.",
    EMAIL_NOT_VERIFIED: "Najpierw potwierdź adres e-mail."
  };
  return messages[code] || "Coś poszło nie tak. Spróbuj ponownie.";
}

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return date.toLocaleString("pl-PL", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function mergeMessages(current: DirectMessage[], incoming: DirectMessage[]) {
  const map = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) map.set(message.id, { ...map.get(message.id), ...message });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function asDirectMessage(message: DirectMessagePayload): DirectMessage {
  return message;
}

export default function FriendsPage({ onLeave, navigate }: Props) {
  const [account, setAccount] = useState<AccountUser | null | undefined>(undefined);
  const [overview, setOverview] = useState<SocialOverview | null>(null);
  const [tab, setTab] = useState<Tab>("friends");
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [messagesByFriend, setMessagesByFriend] = useState<Record<string, DirectMessage[]>>({});
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingByFriend, setTypingByFriend] = useState<Record<string, boolean>>({});
  const [settingsDraft, setSettingsDraft] = useState<SocialSettings | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const activeFriend = useMemo(
    () => overview?.friends.find((friend) => friend.user.id === activeFriendId) ?? null,
    [overview, activeFriendId]
  );
  const activeMessages = activeFriendId ? messagesByFriend[activeFriendId] ?? [] : [];
  const unreadTotal = overview?.friends.reduce((sum, friend) => sum + (friend.conversation?.unread ?? 0), 0) ?? 0;

  async function refreshOverview() {
    const next = await socialApi.overview();
    setOverview(next);
    setSettingsDraft(next.settings);
    setActiveFriendId((current) => current ?? next.friends[0]?.user.id ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    accountApi.me()
      .then(({ user }) => {
        if (cancelled) return;
        setAccount(user);
        if (user) return refreshOverview();
      })
      .catch(() => {
        if (!cancelled) setAccount(null);
      })
      .catch((nextError) => {
        if (!cancelled) setError(errorText(nextError));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!account) return;

    const onSocialChanged = () => {
      void refreshOverview().catch(() => undefined);
    };
    const onPresence = (payload: { userId: string; online: boolean; lastSeenAt: string | null }) => {
      setOverview((current) => current && ({
        ...current,
        friends: current.friends.map((friend) =>
          friend.user.id === payload.userId
            ? { ...friend, user: { ...friend.user, online: payload.online, lastSeenAt: payload.lastSeenAt } }
            : friend
        )
      }));
    };
    const storeMessage = (payload: { message: DirectMessagePayload }) => {
      const directMessage = asDirectMessage(payload.message);
      const friendId = directMessage.senderId === account.id
        ? directMessage.recipientId
        : directMessage.senderId;
      setMessagesByFriend((current) => ({
        ...current,
        [friendId]: mergeMessages(current[friendId] ?? [], [directMessage])
      }));
      if (directMessage.recipientId === account.id && activeFriendId === friendId) {
        socket.emit("direct.message.read", { friendId });
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
        for (const [friendId, items] of grouped) {
          next[friendId] = mergeMessages(next[friendId] ?? [], items);
        }
        return next;
      });
      if (activeFriendId && grouped.has(activeFriendId)) {
        socket.emit("direct.message.read", { friendId: activeFriendId });
      }
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
        [counterpartId]: (current[counterpartId] ?? []).map((item) =>
          item.senderId !== payload.readerId ? { ...item, deliveredAt: item.deliveredAt || payload.readAt, readAt: payload.readAt } : item
        )
      }));
    };
    const onTyping = (payload: { friendId: string; typing: boolean }) => {
      setTypingByFriend((current) => ({ ...current, [payload.friendId]: payload.typing }));
    };
    const onDirectError = (payload: { code: string }) => setError(errorText(payload.code));

    socket.on("social.changed", onSocialChanged);
    socket.on("friend.presence", onPresence);
    socket.on("direct.message.sent", storeMessage);
    socket.on("direct.message.received", storeMessage);
    socket.on("direct.messages.sync", onSync);
    socket.on("direct.messages.delivered", onDelivered);
    socket.on("direct.messages.read", onRead);
    socket.on("direct.typing", onTyping);
    socket.on("direct.error", onDirectError);
    if (socket.disconnected) socket.connect();

    return () => {
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
  }, [account, activeFriendId]);

  useEffect(() => {
    const element = threadRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activeMessages.length, activeFriendId]);

  async function selectFriend(friend: SocialFriend) {
    setActiveFriendId(friend.user.id);
    setTab("friends");
    setError(null);
    try {
      const result = await socialApi.messages(friend.user.id);
      setMessagesByFriend((current) => ({
        ...current,
        [friend.user.id]: mergeMessages(current[friend.user.id] ?? [], result.messages)
      }));
      socket.emit("direct.message.read", { friendId: friend.user.id });
    } catch (nextError) {
      setError(errorText(nextError));
    }
  }

  function sendMessage() {
    if (!activeFriend || !message.trim()) return;
    socket.emit("direct.message.send", { recipientId: activeFriend.user.id, text: message.trim() });
    setMessage("");
    socket.emit("direct.typing.stop", { friendId: activeFriend.user.id });
  }

  function handleMessageChange(value: string) {
    setMessage(value);
    if (!activeFriend) return;
    socket.emit("direct.typing.start", { friendId: activeFriend.user.id });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      socket.emit("direct.typing.stop", { friendId: activeFriend.user.id });
    }, 1000);
  }

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refreshOverview();
    } catch (nextError) {
      setError(errorText(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
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

  if (account === undefined) {
    return <div className="friends-loading">Ładujemy Twoje konto…</div>;
  }

  if (!account) {
    return (
      <div className="friends-auth-required">
        <ChatiLogo size={48} />
        <h1>Znajomi wymagają konta</h1>
        <p>Zaloguj się, aby wysyłać zaproszenia i odbierać wiadomości offline.</p>
        <button onClick={() => navigate("/konto/logowanie")}>Zaloguj się</button>
        <button className="secondary" onClick={onLeave}>Wróć</button>
      </div>
    );
  }

  return (
    <div className="friends-layout">
      <header className="friends-header">
        <button className="friends-brand" onClick={onLeave}>
          <ChatiLogo size={34} />
          <span>Chati</span>
        </button>
        <div className="friends-header-copy">
          <strong>Znajomi i wiadomości</strong>
          <span>Zalogowano jako {account.nickname}</span>
        </div>
        <button className="friends-close" onClick={onLeave}>Zamknij</button>
      </header>

      {error && <div className="friends-error">{error}<button onClick={() => setError(null)}>×</button></div>}

      <div className="friends-body">
        <aside className="friends-sidebar">
          <nav className="friends-tabs">
            <button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}>
              Znajomi {unreadTotal > 0 && <b>{unreadTotal}</b>}
            </button>
            <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>
              Zaproszenia {overview?.incoming.length ? <b>{overview.incoming.length}</b> : null}
            </button>
            <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>Szukaj</button>
            <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Prywatność</button>
          </nav>

          <div className="friends-panel-scroll">
            {tab === "friends" && (
              <div className="friends-list">
                {overview?.friends.map((friend) => (
                  <button
                    key={friend.user.id}
                    className={`friend-row ${activeFriendId === friend.user.id ? "active" : ""}`}
                    onClick={() => void selectFriend(friend)}
                  >
                    <span className={`presence-dot ${friend.user.online ? "online" : ""}`} />
                    <span className="friend-row-copy">
                      <strong>{friend.user.nickname}</strong>
                      <small>
                        {friend.conversation?.lastMessage?.text || (friend.user.online ? "Online" : friend.user.lastSeenAt ? `Ostatnio ${formatTime(friend.user.lastSeenAt)}` : "Offline")}
                      </small>
                    </span>
                    {(friend.conversation?.unread ?? 0) > 0 && <b className="unread-badge">{friend.conversation!.unread}</b>}
                  </button>
                ))}
                {!overview?.friends.length && <p className="friends-empty">Nie masz jeszcze znajomych. Wyszukaj kogoś po nazwie.</p>}
              </div>
            )}

            {tab === "requests" && (
              <div className="request-list">
                <h3>Otrzymane</h3>
                {overview?.incoming.map((request) => (
                  <div className="request-card" key={request.id}>
                    <div><strong>{request.user.nickname}</strong><small>{request.user.online ? "Online" : "Offline"}</small></div>
                    <div className="request-actions">
                      <button disabled={busy} onClick={() => void runAction(() => socialApi.acceptRequest(request.id))}>Akceptuj</button>
                      <button className="secondary" disabled={busy} onClick={() => void runAction(() => socialApi.declineRequest(request.id))}>Odrzuć</button>
                    </div>
                  </div>
                ))}
                {!overview?.incoming.length && <p className="friends-empty">Brak nowych zaproszeń.</p>}
                <h3>Wysłane</h3>
                {overview?.outgoing.map((request) => (
                  <div className="request-card" key={request.id}>
                    <div><strong>{request.user.nickname}</strong><small>Oczekuje na odpowiedź</small></div>
                    <button className="secondary" disabled={busy} onClick={() => void runAction(() => socialApi.cancelRequest(request.id))}>Anuluj</button>
                  </div>
                ))}
                {!overview?.outgoing.length && <p className="friends-empty">Brak wysłanych zaproszeń.</p>}
              </div>
            )}

            {tab === "search" && (
              <div className="people-search">
                <form onSubmit={search}>
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nazwa użytkownika" minLength={2} maxLength={24} />
                  <button disabled={searching}>{searching ? "Szukam…" : "Szukaj"}</button>
                </form>
                {searchResults.map((person) => (
                  <div className="request-card" key={person.id}>
                    <div><strong>{person.nickname}</strong><small>{person.online ? "Online" : "Offline"}</small></div>
                    {person.relationshipStatus === "NONE" && (
                      <button disabled={busy} onClick={() => void runAction(() => socialApi.sendRequest(person.nickname))}>Dodaj</button>
                    )}
                    {person.relationshipStatus === "PENDING_OUTGOING" && <span className="status-pill">Wysłano</span>}
                    {person.relationshipStatus === "PENDING_INCOMING" && <span className="status-pill">Czeka na Ciebie</span>}
                    {person.relationshipStatus === "FRIENDS" && <span className="status-pill">Znajomy</span>}
                    {person.relationshipStatus === "BLOCKED" && <span className="status-pill">Zablokowany</span>}
                  </div>
                ))}
              </div>
            )}

            {tab === "settings" && settingsDraft && (
              <div className="social-settings">
                <label>
                  <span>Kto może wysyłać zaproszenia?</span>
                  <select value={settingsDraft.friendRequestPolicy} onChange={(event) => setSettingsDraft({ ...settingsDraft, friendRequestPolicy: event.target.value as SocialSettings["friendRequestPolicy"] })}>
                    <option value="EVERYONE">Wszyscy</option>
                    <option value="SHARED_CHANNELS">Osoby ze wspólnych kanałów</option>
                    <option value="NOBODY">Nikt</option>
                  </select>
                </label>
                <label className="toggle-row"><input type="checkbox" checked={settingsDraft.allowDirectMessages} onChange={(event) => setSettingsDraft({ ...settingsDraft, allowDirectMessages: event.target.checked })} /><span>Zezwalaj znajomym na wiadomości</span></label>
                <label className="toggle-row"><input type="checkbox" checked={settingsDraft.showOnline} onChange={(event) => setSettingsDraft({ ...settingsDraft, showOnline: event.target.checked })} /><span>Pokazuj status online</span></label>
                <label className="toggle-row"><input type="checkbox" checked={settingsDraft.showLastSeen} onChange={(event) => setSettingsDraft({ ...settingsDraft, showLastSeen: event.target.checked })} /><span>Pokazuj ostatnią aktywność</span></label>
                <button disabled={busy} onClick={() => void runAction(() => socialApi.updateSettings(settingsDraft))}>Zapisz ustawienia</button>
                <h3>Zablokowani</h3>
                {overview?.blocked.map((item) => (
                  <div className="request-card" key={item.id}>
                    <strong>{item.user.nickname}</strong>
                    <button className="secondary" disabled={busy} onClick={() => void runAction(() => socialApi.unblockUser(item.user.id))}>Odblokuj</button>
                  </div>
                ))}
                {!overview?.blocked.length && <p className="friends-empty">Nikogo nie blokujesz.</p>}
              </div>
            )}
          </div>
        </aside>

        <main className="conversation-shell">
          {activeFriend ? (
            <>
              <div className="conversation-header">
                <div>
                  <strong>{activeFriend.user.nickname}</strong>
                  <span>{activeFriend.user.online ? "Online" : activeFriend.user.lastSeenAt ? `Ostatnio ${formatTime(activeFriend.user.lastSeenAt)}` : "Offline — wiadomość zostanie dostarczona później"}</span>
                </div>
                <div className="conversation-actions">
                  <button className="secondary" onClick={() => {
                    if (window.confirm(`Usunąć ${activeFriend.user.nickname} ze znajomych?`)) {
                      void runAction(() => socialApi.removeFriend(activeFriend.user.id));
                      setActiveFriendId(null);
                    }
                  }}>Usuń</button>
                  <button className="danger" onClick={() => {
                    if (window.confirm(`Zablokować ${activeFriend.user.nickname}?`)) {
                      void runAction(() => socialApi.blockUser(activeFriend.user.id));
                      setActiveFriendId(null);
                    }
                  }}>Zablokuj</button>
                </div>
              </div>

              <div className="conversation-thread" ref={threadRef}>
                {!activeMessages.length && <div className="conversation-empty">To początek Waszej rozmowy.</div>}
                {activeMessages.map((item) => {
                  const mine = item.senderId === account.id;
                  return (
                    <div className={`direct-message ${mine ? "mine" : "theirs"}`} key={item.id}>
                      <div>{item.text}</div>
                      <small>
                        {formatTime(item.createdAt)}
                        {mine && ` · ${item.readAt ? "Przeczytano" : item.deliveredAt ? "Dostarczono" : "Wysłano"}`}
                      </small>
                    </div>
                  );
                })}
                {typingByFriend[activeFriend.user.id] && <div className="direct-typing">{activeFriend.user.nickname} pisze…</div>}
              </div>

              <div className="conversation-compose">
                <textarea
                  value={message}
                  onChange={(event) => handleMessageChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={activeFriend.user.allowDirectMessages ? "Napisz wiadomość…" : "Ta osoba wyłączyła wiadomości"}
                  maxLength={500}
                  disabled={!activeFriend.user.allowDirectMessages}
                />
                <button onClick={sendMessage} disabled={!message.trim() || !activeFriend.user.allowDirectMessages}>Wyślij</button>
              </div>
            </>
          ) : (
            <div className="conversation-placeholder">
              <ChatiLogo size={54} />
              <h2>Wybierz znajomego</h2>
              <p>Wiadomości zapisujemy, więc dotrą również wtedy, gdy druga osoba jest offline.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
