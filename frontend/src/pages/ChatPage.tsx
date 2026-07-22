import React, { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../socket";
import { formatTime, isMobileDevice, nowMs } from "../utils/helpers";
import { ChatiLogo } from "../components/Icons";
import "./chat-page.css";

type UiState = "idle" | "searching" | "connected";
type ConnectionState = "connecting" | "online" | "offline";
type Notice = { tone: "success" | "warning" | "error"; text: string };
type LogItem = {
  id: string;
  kind: "sys" | "them" | "me";
  text: string;
  ts: number;
};
type TabLock = { ownerId: string; lastSeen: number };
type IconName =
  | "arrow"
  | "check"
  | "close"
  | "flag"
  | "lock"
  | "more"
  | "refresh"
  | "send"
  | "soundOff"
  | "soundOn"
  | "spark"
  | "users";

const TAB_LOCK_KEY = "chati:tabLock";
const TAB_LOCK_TTL_MS = 8000;
const TAB_LOCK_HEARTBEAT_MS = 2500;
const DEFAULT_TITLE = "Chati Online - Rozmawiaj z nieznajomymi";

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
    flag: <><path d="M5 21V4M5 5h11l-2 4 2 4H5" {...common}/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" {...common}/><path d="M8 10V7a4 4 0 0 1 8 0v3" {...common}/></>,
    more: <><circle cx="5" cy="12" r="1" {...common}/><circle cx="12" cy="12" r="1" {...common}/><circle cx="19" cy="12" r="1" {...common}/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" {...common}/><path d="M7 8a7 7 0 0 1 11.7-2.2L20 7M4 17l1.3 1.2A7 7 0 0 0 17 16" {...common}/></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7Z" {...common}/><path d="M22 2 11 13" {...common}/></>,
    soundOff: <><path d="M11 5 6 9H2v6h4l5 4V5Z" {...common}/><path d="m22 9-6 6M16 9l6 6" {...common}/></>,
    soundOn: <><path d="M11 5 6 9H2v6h4l5 4V5Z" {...common}/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" {...common}/></>,
    spark: <><path d="m12 3 1.3 4.1L17 9l-3.7 1.9L12 15l-1.3-4.1L7 9l3.7-1.9L12 3Z" {...common}/><path d="m5 15 .8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15ZM19 12l.7 1.8L22 15l-2.3 1.2L19 18l-.7-1.8L16 15l2.3-1.2L19 12Z" {...common}/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...common}/><circle cx="8.5" cy="7" r="4" {...common}/><path d="M22 21v-2a4 4 0 0 0-3-3.87M15.5 3.2a4 4 0 0 1 0 7.6" {...common}/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>{paths[name]}</svg>;
}

function safeParseLock(value: string | null): TabLock | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as TabLock;
    if (!parsed?.ownerId || typeof parsed.lastSeen !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function makeLogItem(kind: LogItem["kind"], text: string): LogItem {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${kind}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    kind,
    text,
    ts: Date.now()
  };
}

export default function ChatPage({ onLeave }: { onLeave: () => void }) {
  const isMobile = useMemo(() => isMobileDevice(), []);
  const device = useMemo(() => (isMobile ? "mobile" : "desktop"), [isMobile]);
  const tabId = useMemo(
    () => `${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}_${nowMs()}`,
    []
  );

  const [uiState, setUiState] = useState<UiState>("idle");
  const [connectionState, setConnectionState] = useState<ConnectionState>(socket.connected ? "online" : "connecting");
  const [online, setOnline] = useState(0);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [log, setLog] = useState<LogItem[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);
  const [tabLockBypass, setTabLockBypass] = useState(isMobile);
  const [hasTabLock, setHasTabLock] = useState(true);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  const isTyping = useRef(false);
  const autoStartedRef = useRef(false);
  const unreadCount = useRef(0);
  const isTabHidden = useRef(typeof document !== "undefined" ? document.hidden : false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);

  const hasChatMessages = useMemo(() => log.some((item) => item.kind !== "sys"), [log]);
  const canSend = hasTabLock && connectionState === "online" && uiState === "connected" && Boolean(text.trim());
  const status = !hasTabLock
    ? { label: "Czat otwarty w innej karcie", tone: "warning" }
    : connectionState === "offline"
      ? { label: "Brak połączenia", tone: "offline" }
      : uiState === "searching"
        ? { label: "Szukamy rozmówcy", tone: "searching" }
        : uiState === "connected"
          ? { label: "Rozmowa aktywna", tone: "online" }
          : { label: "Łączenie", tone: "connecting" };

  function addSystem(message: string) {
    setLog((current) => [...current, makeLogItem("sys", message)]);
  }

  function addMessage(kind: "me" | "them", message: string) {
    setLog((current) => [...current, makeLogItem(kind, message)]);
  }

  useEffect(() => {
    try {
      const muted = localStorage.getItem("chati:muted") === "true";
      mutedRef.current = muted;
      setIsMuted(muted);
    } catch {
      mutedRef.current = false;
      setIsMuted(false);
    }
  }, []);

  useEffect(() => {
    audioRef.current = new Audio("/ding.mp3");
    return () => {
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.title = DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      isTabHidden.current = document.hidden;
      if (!document.hidden) {
        unreadCount.current = 0;
        document.title = DEFAULT_TITLE;
        if (hasTabLock && socket.disconnected) socket.connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [hasTabLock]);

  function playSound() {
    if (mutedRef.current || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    void audioRef.current.play().catch(() => undefined);
  }

  function toggleMute() {
    const nextMuted = !isMuted;
    mutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    try {
      localStorage.setItem("chati:muted", String(nextMuted));
    } catch {
      // Storage can be unavailable in privacy modes.
    }
  }

  function stopClientTyping(force = false) {
    if (!force && !isTyping.current) return;
    isTyping.current = false;
    socket.emit("user.stop_writing");
  }

  function resetConversation(systemMessage?: string) {
    setTyping(false);
    setText("");
    setShowReport(false);
    isTyping.current = false;
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    setLog(systemMessage ? [makeLogItem("sys", systemMessage)] : []);
  }

  function beginSearch(systemMessage?: string) {
    if (!hasTabLock) return;
    resetConversation(systemMessage);
    setUiState("searching");
    setNotice(null);
    autoStartedRef.current = true;
    socket.emit("join");
  }

  function nextConversation() {
    socket.emit("leave.chat");
    stopClientTyping(true);
    setShowLeaveDialog(false);
    beginSearch();
  }

  function exitRandomChat() {
    socket.emit("leave.chat");
    stopClientTyping(true);
    setShowLeaveDialog(false);
    onLeave();
  }

  function retryConnection() {
    setConnectionState("connecting");
    socket.connect();
  }

  function claimThisTab() {
    try {
      localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ ownerId: tabId, lastSeen: nowMs() }));
    } catch {
      // Continue even if storage is unavailable.
    }
    setHasTabLock(true);
    setConnectionState("connecting");
    if (socket.disconnected) socket.connect();
  }

  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && hasTabLock && uiState !== "idle") setShowLeaveDialog(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasTabLock, isMobile, uiState]);

  function handleTouchStart(event: React.TouchEvent) {
    setTouchEndY(null);
    setTouchStartY(event.targetTouches[0].clientY);
  }

  function handleTouchMove(event: React.TouchEvent) {
    setTouchEndY(event.targetTouches[0].clientY);
  }

  function handleTouchEnd() {
    if (touchStartY === null || touchEndY === null) return;
    if (touchStartY - touchEndY > 70 && hasTabLock && uiState === "connected") setShowLeaveDialog(true);
  }

  useEffect(() => {
    if (isMobile) return;
    void fetch("/admin/whoami")
      .then((response) => response.json())
      .then((data) => {
        if (data?.ok && data?.whitelisted) setTabLockBypass(true);
      })
      .catch(() => undefined);
  }, [isMobile]);

  useEffect(() => {
    function onPageHide() {
      socket.emit("leave.chat");
      socket.disconnect();
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  useEffect(() => {
    if (tabLockBypass) {
      setHasTabLock(true);
      return;
    }

    function canTakeLock(existing: TabLock | null) {
      return !existing || nowMs() - existing.lastSeen > TAB_LOCK_TTL_MS;
    }

    function writeLock() {
      try {
        localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ ownerId: tabId, lastSeen: nowMs() }));
      } catch {
        // Storage can be unavailable in privacy modes.
      }
    }

    function evaluateLock() {
      const existing = safeParseLock(localStorage.getItem(TAB_LOCK_KEY));
      if (existing?.ownerId === tabId || canTakeLock(existing)) {
        writeLock();
        setHasTabLock(true);
      } else {
        setHasTabLock(false);
      }
    }

    evaluateLock();
    const heartbeat = window.setInterval(() => {
      const existing = safeParseLock(localStorage.getItem(TAB_LOCK_KEY));
      if (existing?.ownerId === tabId) writeLock();
      else evaluateLock();
    }, TAB_LOCK_HEARTBEAT_MS);

    function onStorage(event: StorageEvent) {
      if (event.key === TAB_LOCK_KEY) evaluateLock();
    }

    function releaseIfOwner() {
      const existing = safeParseLock(localStorage.getItem(TAB_LOCK_KEY));
      if (existing?.ownerId === tabId) localStorage.removeItem(TAB_LOCK_KEY);
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", releaseIfOwner);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", releaseIfOwner);
      releaseIfOwner();
    };
  }, [tabId, tabLockBypass]);

  useEffect(() => {
    if (hasTabLock) return;
    socket.emit("leave.chat");
    socket.disconnect();
    setUiState("idle");
    setTyping(false);
    setShowReport(false);
    setShowLeaveDialog(false);
    setLog([]);
  }, [hasTabLock]);

  useEffect(() => {
    if (hasTabLock && socket.disconnected) {
      setConnectionState("connecting");
      socket.connect();
    }
  }, [hasTabLock]);

  useEffect(() => {
    const onMatched = () => {
      setUiState("connected");
      setTyping(false);
      setNotice({ tone: "success", text: "Znaleźliśmy rozmówcę. Możesz zacząć pisać." });
      addSystem("Połączono z nowym rozmówcą.");
      playSound();
      window.setTimeout(() => textareaRef.current?.focus(), 100);
      if (isTabHidden.current) document.title = "⚡ Znaleziono rozmówcę!";
    };

    const onStrangerDisconnected = () => {
      beginSearch("Rozmówca zakończył rozmowę. Szukamy kolejnej osoby.");
    };

    const onReceive = (payload: { text: string }) => {
      addMessage("them", payload.text);
      playSound();
      if (isTabHidden.current) {
        unreadCount.current += 1;
        document.title = `(${unreadCount.current}) Nowa wiadomość - Chati`;
      }
    };

    const onSocketConnect = () => {
      if (!hasTabLock) {
        socket.disconnect();
        return;
      }
      setConnectionState("online");
      if (!autoStartedRef.current) beginSearch();
    };

    const onSocketDisconnect = () => {
      autoStartedRef.current = false;
      setConnectionState("offline");
      setUiState("idle");
      setTyping(false);
      stopClientTyping(true);
    };

    socket.on("user.connected", onMatched);
    socket.on("user.disconnected", onStrangerDisconnected);
    socket.on("receive_message", onReceive);
    socket.on("users.online", setOnline);
    socket.on("user.start_writing", () => setTyping(true));
    socket.on("user.stop_writing", () => setTyping(false));
    socket.on("connect", onSocketConnect);
    socket.on("disconnect", onSocketDisconnect);

    if (socket.connected) onSocketConnect();

    return () => {
      socket.off("user.connected", onMatched);
      socket.off("user.disconnected", onStrangerDisconnected);
      socket.off("receive_message", onReceive);
      socket.off("users.online", setOnline);
      socket.off("user.start_writing");
      socket.off("user.stop_writing");
      socket.off("connect", onSocketConnect);
      socket.off("disconnect", onSocketDisconnect);
    };
  }, [hasTabLock]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end", behavior: hasChatMessages ? "smooth" : "auto" });
  }, [hasChatMessages, log, typing]);

  useEffect(() => {
    if (!showReport && !showLeaveDialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowReport(false);
      setShowLeaveDialog(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", close);
    };
  }, [showLeaveDialog, showReport]);

  function onInputChange(value: string) {
    setText(value);
    if (uiState !== "connected") return;
    if (!value.trim()) {
      stopClientTyping(true);
      return;
    }
    if (!isTyping.current) {
      isTyping.current = true;
      socket.emit("user.start_writing");
    }
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => stopClientTyping(), 700);
  }

  function send() {
    if (!canSend) return;
    const message = text.trim().replace(/\n{3,}/g, "\n\n");
    addMessage("me", message);
    socket.emit("send.message", { text: message, device });
    setText("");
    stopClientTyping(true);
  }

  async function submitReport(type: "bot" | "abuse") {
    if (!hasTabLock || reportBusy) return;
    setReportBusy(true);
    try {
      const response = await fetch("/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socketId: socket.id, type })
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; ignored?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "REPORT_FAILED");
      setNotice({
        tone: "success",
        text: data.ignored ? "Zgłoszenie zostało przyjęte bez dodatkowych działań." : "Zgłoszenie zostało przekazane do moderacji."
      });
      setShowReport(false);
    } catch {
      setNotice({ tone: "error", text: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie." });
    } finally {
      setReportBusy(false);
    }
  }

  function chooseIcebreaker(value: string) {
    setText(value);
    textareaRef.current?.focus();
  }

  return (
    <div className={`random-chat-layout state-${uiState}`}>
      <header className="random-chat-header">
        <button type="button" className="random-chat-brand" onClick={() => setShowLeaveDialog(true)} aria-label="Opuść losowy czat">
          <ChatiLogo size={34}/><span>Chati</span><strong>Losowy czat</strong>
        </button>

        <div className="random-chat-status" role="status">
          <span className={`status-dot ${status.tone}`}/>
          <span><strong>{status.label}</strong><small>{online.toLocaleString("pl-PL")} osób online</small></span>
        </div>

        <div className="random-chat-actions">
          <button type="button" className="chat-icon-action" onClick={toggleMute} aria-label={isMuted ? "Włącz dźwięk" : "Wycisz dźwięk"} aria-pressed={isMuted}>
            <Icon name={isMuted ? "soundOff" : "soundOn"}/>
          </button>
          <button type="button" className="chat-icon-action report" onClick={() => setShowReport(true)} disabled={!hasTabLock || uiState !== "connected"} aria-label="Zgłoś rozmówcę">
            <Icon name="flag"/>
          </button>
          <button type="button" className="chat-icon-action" onClick={() => setShowLeaveDialog(true)} aria-label="Zakończ lub zmień rozmowę">
            <Icon name="more"/>
          </button>
        </div>
      </header>

      {connectionState !== "online" && hasTabLock && (
        <div className={`random-connection-banner ${connectionState}`} role="status">
          <span className="connection-pulse"/>
          <div><strong>{connectionState === "connecting" ? "Łączenie z Chati…" : "Połączenie zostało przerwane"}</strong><span>{connectionState === "offline" ? "Nie możesz teraz wysyłać wiadomości." : "Przygotowujemy bezpieczne połączenie."}</span></div>
          {connectionState === "offline" && <button type="button" onClick={retryConnection}><Icon name="refresh" size={17}/>Połącz ponownie</button>}
        </div>
      )}

      {notice && (
        <div className={`random-chat-toast ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          <Icon name={notice.tone === "success" ? "check" : notice.tone === "warning" ? "lock" : "flag"} size={18}/>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Zamknij komunikat"><Icon name="close" size={17}/></button>
        </div>
      )}

      <main
        ref={threadRef}
        className="random-chat-main"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        {!hasTabLock && !tabLockBypass ? (
          <section className="random-state-card locked-state">
            <span className="state-icon"><Icon name="lock" size={30}/></span>
            <span className="state-eyebrow">Ochrona przed duplikatem</span>
            <h1>Losowy czat jest aktywny w innej karcie</h1>
            <p>Jedna aktywna karta zapobiega podwójnym połączeniom i przypadkowemu utraceniu rozmowy.</p>
            <div className="state-actions">
              <button type="button" onClick={claimThisTab}>Użyj tej karty</button>
              <button type="button" className="secondary" onClick={onLeave}>Wróć na stronę główną</button>
            </div>
          </section>
        ) : uiState === "searching" ? (
          <section className="random-state-card matching-state">
            <div className="matching-orbit" aria-hidden="true"><span/><span/><span/></div>
            <span className="state-eyebrow">Losowe dopasowanie</span>
            <h1>Szukamy osoby do rozmowy</h1>
            <p>Łączymy Cię anonimowo z jedną dostępną osobą. Zwykle zajmuje to tylko chwilę.</p>
            <div className="matching-facts"><span><Icon name="lock" size={16}/>Bez logowania</span><span><Icon name="users" size={16}/>{online.toLocaleString("pl-PL")} online</span></div>
            <button type="button" className="cancel-search" onClick={exitRandomChat}>Anuluj wyszukiwanie</button>
          </section>
        ) : uiState === "connected" ? (
          <div className="random-conversation">
            {!hasChatMessages && (
              <section className="conversation-intro">
                <span className="conversation-match-icon"><Icon name="spark" size={28}/></span>
                <span className="state-eyebrow">Połączenie gotowe</span>
                <h1>Rozmowa z nieznajomym rozpoczęta</h1>
                <p>Nie udostępniaj danych osobowych. Możesz zakończyć rozmowę w dowolnym momencie.</p>
                <div className="icebreaker-list" aria-label="Propozycje pierwszej wiadomości">
                  {["Hej! Jak mija Ci dzień?", "Skąd piszesz?", "O czym lubisz rozmawiać?"].map((item) => (
                    <button type="button" key={item} onClick={() => chooseIcebreaker(item)}>{item}<Icon name="arrow" size={15}/></button>
                  ))}
                </div>
              </section>
            )}

            <div className="random-message-list" aria-live="polite">
              {log.map((item) => item.kind === "sys" ? (
                <div className="random-system-message" key={item.id}><span>{item.text}</span></div>
              ) : (
                <article className={`random-message ${item.kind}`} key={item.id}>
                  <div className="random-message-meta"><strong>{item.kind === "me" ? "Ty" : "Nieznajomy"}</strong><time>{formatTime(item.ts)}</time></div>
                  <div className="random-message-bubble"><p>{item.text}</p></div>
                </article>
              ))}

              {typing && hasTabLock && (
                <div className="random-typing" aria-label="Nieznajomy pisze">
                  <span><i/><i/><i/></span><small>Nieznajomy pisze…</small>
                </div>
              )}
              <div ref={threadEndRef}/>
            </div>
          </div>
        ) : (
          <section className="random-state-card connecting-state">
            <span className="state-icon"><Icon name="refresh" size={29}/></span>
            <h1>Przygotowujemy losowy czat</h1>
            <p>Sprawdzamy połączenie i dostępność rozmówców.</p>
          </section>
        )}
      </main>

      <footer className="random-chat-composer">
        <div className="random-composer-inner">
          <button type="button" className="next-chat-button" disabled={!hasTabLock || uiState !== "connected"} onClick={() => setShowLeaveDialog(true)}>
            <Icon name="refresh" size={18}/><span><strong>Następny</strong><small>Esc</small></span>
          </button>

          <div className="random-input-shell">
            <textarea
              ref={textareaRef}
              value={text}
              rows={1}
              maxLength={500}
              disabled={!hasTabLock || connectionState !== "online" || uiState !== "connected"}
              placeholder={uiState === "connected" ? "Napisz anonimową wiadomość…" : uiState === "searching" ? "Szukamy rozmówcy…" : "Oczekiwanie na połączenie…"}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <div className="random-input-meta"><span>Enter wysyła • Shift+Enter dodaje linię</span><span className={text.length > 450 ? "warning" : ""}>{text.length}/500</span></div>
          </div>

          <button type="button" className="random-send-button" onClick={send} disabled={!canSend} aria-label="Wyślij wiadomość">
            <Icon name="send" size={20}/><span>Wyślij</span>
          </button>
        </div>
      </footer>

      {showReport && hasTabLock && (
        <div className="random-modal-backdrop" role="presentation" onMouseDown={() => setShowReport(false)}>
          <section className="random-modal" role="dialog" aria-modal="true" aria-labelledby="random-report-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="random-modal-close" onClick={() => setShowReport(false)} aria-label="Zamknij"><Icon name="close"/></button>
            <span className="modal-icon danger"><Icon name="flag" size={24}/></span>
            <span className="state-eyebrow">Bezpieczeństwo rozmowy</span>
            <h2 id="random-report-title">Zgłoś rozmówcę</h2>
            <p>Wybierz najlepiej pasujący powód. Zgłoszenie dotyczy wyłącznie bieżącego połączenia.</p>
            <div className="report-options">
              <button type="button" disabled={reportBusy} onClick={() => void submitReport("bot")}><span><strong>Bot lub spam</strong><small>Automatyczne wiadomości albo powtarzalne reklamy</small></span><Icon name="arrow"/></button>
              <button type="button" className="danger" disabled={reportBusy} onClick={() => void submitReport("abuse")}><span><strong>Nadużycie lub niebezpieczna treść</strong><small>Groźby, nękanie, seksualne lub nielegalne treści</small></span><Icon name="arrow"/></button>
            </div>
            <button type="button" className="modal-cancel" onClick={() => setShowReport(false)}>Anuluj</button>
          </section>
        </div>
      )}

      {showLeaveDialog && (
        <div className="random-modal-backdrop" role="presentation" onMouseDown={() => setShowLeaveDialog(false)}>
          <section className="random-modal leave-modal" role="dialog" aria-modal="true" aria-labelledby="random-leave-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="random-modal-close" onClick={() => setShowLeaveDialog(false)} aria-label="Zamknij"><Icon name="close"/></button>
            <span className="modal-icon"><Icon name="refresh" size={25}/></span>
            <span className="state-eyebrow">Losowy czat</span>
            <h2 id="random-leave-title">Co chcesz zrobić?</h2>
            <p>{uiState === "connected" ? "Możesz zakończyć tę rozmowę i od razu znaleźć nową osobę." : "Możesz kontynuować wyszukiwanie albo wrócić na stronę główną."}</p>
            <div className="leave-actions">
              <button type="button" className="primary" onClick={nextConversation} disabled={connectionState !== "online"}><Icon name="refresh"/><span><strong>Znajdź nową osobę</strong><small>Zakończ obecną rozmowę</small></span></button>
              <button type="button" onClick={() => setShowLeaveDialog(false)}><Icon name="arrow"/><span><strong>Wróć do rozmowy</strong><small>Nic nie zmieniaj</small></span></button>
              <button type="button" className="danger" onClick={exitRandomChat}><Icon name="close"/><span><strong>Opuść losowy czat</strong><small>Wróć na stronę główną</small></span></button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
