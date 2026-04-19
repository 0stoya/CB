import React, { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../socket";
import { isMobileDevice, nowMs, formatTime } from "../utils/helpers";
import {
  ChatiLogo,
  FlagIcon,
  CloseIcon,
  ArrowUpIcon,
  SoundOnIcon,
  SoundOffIcon
} from "../components/Icons";
import "./chat-page.css";

type UiState = "idle" | "searching" | "connected";

type LogItem = {
  id: string;
  kind: "sys" | "them" | "me";
  text: string;
  ts: number;
};

type TabLock = {
  ownerId: string;
  lastSeen: number;
};

const TAB_LOCK_KEY = "chati:tabLock";
const TAB_LOCK_TTL_MS = 8000;
const TAB_LOCK_HEARTBEAT_MS = 2500;
const DEFAULT_TITLE = "Chati Online - Rozmawiaj z nieznajomymi";

function safeParseLock(v: string | null): TabLock | null {
  if (!v) return null;
  try {
    const obj = JSON.parse(v) as TabLock;
    if (!obj?.ownerId || typeof obj.lastSeen !== "number") return null;
    return obj;
  } catch {
    return null;
  }
}

function makeLogItem(kind: LogItem["kind"], text: string): LogItem {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${kind}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    kind,
    text,
    ts: Date.now()
  };
}

export default function ChatPage({ onLeave }: { onLeave: () => void }) {
  const isMobile = useMemo(() => isMobileDevice(), []);
  const device = useMemo(() => (isMobile ? "mobile" : "desktop"), [isMobile]);
  const tabId = useMemo(
    () =>
      `${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}_${nowMs()}`,
    []
  );

  const [uiState, setUiState] = useState<UiState>("idle");
  const [online, setOnline] = useState<number>(0);
  const [typing, setTyping] = useState<boolean>(false);
  const [text, setText] = useState("");
  const [log, setLog] = useState<LogItem[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [showNextSheet, setShowNextSheet] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);
  const [tabLockBypass, setTabLockBypass] = useState<boolean>(isMobile);
  const [hasTabLock, setHasTabLock] = useState<boolean>(true);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  const isTyping = useRef<boolean>(false);
  const autoStartedRef = useRef(false);
  const unreadCount = useRef(0);
  const isTabHidden = useRef(
    typeof document !== "undefined" ? document.hidden : false
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasChatMessages = useMemo(
    () => log.some((m) => m.kind === "me" || m.kind === "them"),
    [log]
  );

  const controlsDisabled = !hasTabLock;
  const showConnectedIntro = uiState === "connected" && !hasChatMessages;
  const showIdleLanding = uiState === "idle" && hasTabLock;

  const addSys = (msg: string) =>
    setLog((prev) => [...prev, makeLogItem("sys", msg)]);
  const addMe = (msg: string) =>
    setLog((prev) => [...prev, makeLogItem("me", msg)]);
  const addThem = (msg: string) =>
    setLog((prev) => [...prev, makeLogItem("them", msg)]);

  useEffect(() => {
    try {
      setIsMuted(localStorage.getItem("chati:muted") === "true");
    } catch {
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

  const playSound = () => {
    if (isMuted || !audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
    } catch {
      // autoplay may be blocked until a user gesture
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    try {
      localStorage.setItem("chati:muted", String(nextMuted));
    } catch {
      //
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabHidden.current = document.hidden;

      if (!document.hidden) {
        unreadCount.current = 0;
        document.title = DEFAULT_TITLE;

        if (hasTabLock && socket.disconnected) {
          socket.connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hasTabLock]);

  function resetChatWindow(sysMsg?: string) {
    setTyping(false);
    setText("");
    setShowReport(false);
    setShowNextSheet(false);
    isTyping.current = false;

    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }

    setLog(sysMsg ? [makeLogItem("sys", sysMsg)] : []);
  }

  function stopClientTyping(force = false) {
    if (!force && !isTyping.current) return;
    isTyping.current = false;
    try {
      socket.emit("user.stop_writing");
    } catch {
      //
    }
  }

  function joinSearchWindow(msg?: string) {
    resetChatWindow(msg);
    setUiState("searching");
    try {
      socket.emit("join");
    } catch {
      //
    }
  }

  function doNextConfirmed() {
    try {
      socket.emit("leave.chat");
    } catch {
      //
    }
    stopClientTyping(true);
    joinSearchWindow();
  }

  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && hasTabLock && uiState !== "idle") {
        doNextConfirmed();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasTabLock, uiState, isMobile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEndY(null);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStartY || !touchEndY) return;
    if (touchStartY - touchEndY > 60 && hasTabLock && uiState === "connected") {
      setShowNextSheet(true);
    }
  };

  useEffect(() => {
    if (isMobile) return;

    (async () => {
      try {
        const res = await fetch("/admin/whoami");
        const data = await res.json();
        if (data?.ok && data?.whitelisted) {
          setTabLockBypass(true);
        }
      } catch {
        //
      }
    })();
  }, [isMobile]);

  useEffect(() => {
    function onPageHide() {
      try {
        socket.emit("leave.chat");
        socket.disconnect();
      } catch {
        //
      }
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
        localStorage.setItem(
          TAB_LOCK_KEY,
          JSON.stringify({ ownerId: tabId, lastSeen: nowMs() })
        );
      } catch {
        //
      }
    }

    function evaluateLock() {
      const existing = safeParseLock(localStorage.getItem(TAB_LOCK_KEY));

      if (existing?.ownerId === tabId || canTakeLock(existing)) {
        writeLock();
        setHasTabLock(true);
        return;
      }

      setHasTabLock(false);
    }

    evaluateLock();

    const beat = window.setInterval(() => {
      const existing = safeParseLock(localStorage.getItem(TAB_LOCK_KEY));
      if (existing?.ownerId === tabId) {
        writeLock();
      } else {
        evaluateLock();
      }
    }, TAB_LOCK_HEARTBEAT_MS);

    function onStorage(e: StorageEvent) {
      if (e.key === TAB_LOCK_KEY) evaluateLock();
    }

    function releaseIfOwner() {
      const existing = safeParseLock(localStorage.getItem(TAB_LOCK_KEY));
      if (existing?.ownerId === tabId) {
        localStorage.removeItem(TAB_LOCK_KEY);
      }
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", releaseIfOwner);

    return () => {
      window.clearInterval(beat);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", releaseIfOwner);
      releaseIfOwner();
    };
  }, [tabId, tabLockBypass]);

  useEffect(() => {
    if (hasTabLock) return;

    try {
      socket.emit("leave.chat");
      socket.disconnect();
    } catch {
      //
    }

    setUiState("idle");
    setTyping(false);
    setShowReport(false);
    setShowNextSheet(false);
    setLog([makeLogItem("sys", "Inna karta jest aktywna. Ta karta jest zablokowana.")]);
  }, [hasTabLock]);

  useEffect(() => {
    if (!hasTabLock || socket.connected) return;
    try {
      socket.connect();
    } catch {
      //
    }
  }, [hasTabLock]);

  function autoStartIfNeeded() {
    if (!hasTabLock || autoStartedRef.current) return;
    autoStartedRef.current = true;
    joinSearchWindow();
  }

  useEffect(() => {
    const onMatched = () => {
      setUiState("connected");
      setTyping(false);
      addSys("Połączono.");
      playSound();

      if (isTabHidden.current) {
        document.title = "⚡️ Znaleziono rozmówcę!";
      }
    };

    const onStrangerDisconnected = () => {
      joinSearchWindow("Nieznajomy się rozłączył. Szukam...");
    };

    const onReceive = (p: { text: string }) => {
      addThem(p.text);
      playSound();

      if (isTabHidden.current) {
        unreadCount.current += 1;
        document.title = `(${unreadCount.current}) Nowa wiadomość! - Chati`;
      }
    };

    const onOnline = (count: number) => setOnline(count);
    const onStartTyping = () => setTyping(true);
    const onStopTyping = () => setTyping(false);

    const onSocketConnect = () => {
      if (!hasTabLock) {
        try {
          socket.disconnect();
        } catch {
          //
        }
        return;
      }
      addSys("Połączono z serwerem.");
      autoStartIfNeeded();
    };

    const onSocketDisconnect = () => {
      autoStartedRef.current = false;
      setUiState("idle");
      setTyping(false);
      addSys("Rozłączono z serwerem.");
    };

    socket.on("user.connected", onMatched);
    socket.on("user.disconnected", onStrangerDisconnected);
    socket.on("receive_message", onReceive);
    socket.on("users.online", onOnline);
    socket.on("user.start_writing", onStartTyping);
    socket.on("user.stop_writing", onStopTyping);
    socket.on("connect", onSocketConnect);
    socket.on("disconnect", onSocketDisconnect);

    if (socket.connected) {
      onSocketConnect();
    }

    return () => {
      socket.off("user.connected", onMatched);
      socket.off("user.disconnected", onStrangerDisconnected);
      socket.off("receive_message", onReceive);
      socket.off("users.online", onOnline);
      socket.off("user.start_writing", onStartTyping);
      socket.off("user.stop_writing", onStopTyping);
      socket.off("connect", onSocketConnect);
      socket.off("disconnect", onSocketDisconnect);
    };
  }, [hasTabLock]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [log, typing]);

  function onInputChange(v: string) {
    setText(v);

    if (!isTyping.current && uiState === "connected") {
      isTyping.current = true;
      socket.emit("user.start_writing");
    }

    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
    }

    typingTimer.current = window.setTimeout(() => {
      if (uiState === "connected") stopClientTyping();
    }, 700);
  }

  function send() {
    if (!hasTabLock || uiState !== "connected" || !text.trim()) return;

    const msg = text.replace(/\s+/g, " ").trim();
    addMe(msg);
    socket.emit("send.message", { text: msg, device });
    setText("");
    stopClientTyping(true);
  }

  async function submitReport(type: "bot" | "abuse") {
    if (!hasTabLock) return;

    try {
      const res = await fetch("/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socketId: socket.id, type })
      });

      const data = await res.json();

      if (data.ok) {
        if (data.ignored) {
          addSys("Zgłoszenie zignorowane (adres chroniony).");
        } else {
          addSys(`Zgłoszono: ${type}.`);
        }
      } else {
        addSys(
          `Nie można zgłosić: ${
            data.error === "no partner to report" ? "Brak rozmówcy" : data.error
          }.`
        );
      }
    } catch {
      addSys("Błąd sieci. Zgłoszenie nie powiodło się.");
    } finally {
      setShowReport(false);
    }
  }

  return (
    <div className="chat-shell">
      {!hasTabLock && !tabLockBypass && (
        <div className="locked-banner">
          Ten czat jest otwarty w innej karcie. Zamknij ją.
        </div>
      )}

      <header className="chat-header">
        <div className="shell-container chat-header-inner">
          <button
            type="button"
            className="brand-btn"
            onClick={onLeave}
            aria-label="Opuść czat"
          >
            <ChatiLogo size={isMobile ? 32 : 36} />
            <span className="brand-logo-text">Chati</span>
          </button>

          <div className="chat-header-center">
            <div className="online-pill" aria-label={`${online}+ użytkowników online`}>
              <span className="dot-green" />
              <span className="online-pill-text">
                {online.toLocaleString()}+ online
              </span>
            </div>
          </div>

          <div className="chat-header-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={toggleMute}
              title={isMuted ? "Włącz dźwięk" : "Wycisz dźwięk"}
              aria-label={isMuted ? "Włącz dźwięk" : "Wycisz dźwięk"}
            >
              {isMuted ? (
                <SoundOffIcon color="#64748B" size={20} />
              ) : (
                <SoundOnIcon color="#006AFF" size={20} />
              )}
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowReport(true)}
              disabled={controlsDisabled || uiState !== "connected"}
              title="Zgłoś użytkownika"
              aria-label="Zgłoś użytkownika"
            >
              <FlagIcon color="#EF4444" size={18} />
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowNextSheet(true)}
              disabled={controlsDisabled || uiState === "idle"}
              title="Nowa rozmowa"
              aria-label="Nowa rozmowa"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </header>

      <main
        ref={threadRef}
        className="chat-thread"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <div className="shell-container chat-thread-inner">
          {showIdleLanding && (
            <section className="idle-panel">
              <div className="idle-card">
                <h1 className="idle-title">Chati.online – Darmowy Czat Anonimowy</h1>
                <p className="idle-copy">
                  Witamy w <strong>Chati</strong> – nowoczesnym polskim czacie do
                  rozmów z nieznajomymi bez logowania. Szukasz alternatywy dla
                  6obcy lub Omegle? Jesteś w dobrym miejscu.
                </p>

                <div className="idle-features">
                  <div className="idle-feature">
                    <strong>100% anonimowości</strong>
                    <span>Bez rejestracji, e-maila i danych osobowych.</span>
                  </div>
                  <div className="idle-feature">
                    <strong>Anty-bot</strong>
                    <span>Filtry ograniczają spam i automatyczne konta.</span>
                  </div>
                  <div className="idle-feature">
                    <strong>Lepszy matchmaking</strong>
                    <span>Po rozłączeniu nie trafisz od razu na tę samą osobę.</span>
                  </div>
                </div>

                <div className="idle-links">
                  <a href="/faq">Jak to działa?</a>
                  <a href="/terms">Regulamin</a>
                  <a href="/privacy">Polityka prywatności</a>
                  <a href="/contact">Kontakt</a>
                </div>
              </div>
            </section>
          )}

          {uiState === "searching" && (
            <div className="state-card">
              <div className="state-spinner" />
              <div className="state-title">Szukam rozmówcy…</div>
              <div className="state-text">To zwykle trwa tylko chwilę.</div>
            </div>
          )}

          {showConnectedIntro && (
            <div className="connected-card">
              <div className="connected-badge">⚡️ Połączono</div>
              <h2 className="connected-title">Rozmowa z nieznajomym rozpoczęta</h2>
              <p className="connected-text">
                Napisz pierwszą wiadomość albo zacznij od prostego pytania.
              </p>
              <div className="icebreakers" aria-hidden="true">
                <span>Co u Ciebie?</span>
                <span>Skąd jesteś?</span>
                <span>Jak minął dzień?</span>
              </div>
            </div>
          )}

          <div className="messages">
            {log.map((m) => (
              <div key={m.id} className={`msg-wrapper ${m.kind}`}>
                <div className="msg-bubble">
                  <div className="msg-text">{m.text}</div>
                  {m.kind !== "sys" && (
                    <div className="msg-meta">
                      <span className="msg-time">{formatTime(m.ts)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {uiState === "connected" && typing && hasTabLock && (
              <div className="typing-row">
                <div className="typing-pill">
                  <span className="typing-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  Nieznajomy pisze…
                </div>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>
        </div>
      </main>

      <footer className="chat-composer">
        <div className="shell-container composer-row">
          {!isMobile && (
            <button
              type="button"
              className="btn-large"
              onClick={doNextConfirmed}
              disabled={controlsDisabled || uiState === "idle"}
            >
              <span className="main-text">Nowy</span>
              <span className="sub-text">Esc</span>
            </button>
          )}

          <div className="composer-input-wrap">
            <input
              className="chat-input"
              value={text}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={
                uiState === "connected"
                  ? "Napisz wiadomość…"
                  : uiState === "searching"
                  ? "Trwa szukanie rozmówcy…"
                  : "Czekam…"
              }
              disabled={controlsDisabled || uiState !== "connected"}
              maxLength={500}
            />
          </div>

          {isMobile ? (
            <button
              type="button"
              className="mobile-send-btn"
              onClick={send}
              disabled={controlsDisabled || uiState !== "connected" || !text.trim()}
              aria-label="Wyślij wiadomość"
            >
              <ArrowUpIcon />
            </button>
          ) : (
            <button
              type="button"
              className="btn-large btn-primary"
              onClick={send}
              disabled={controlsDisabled || uiState !== "connected" || !text.trim()}
            >
              <span className="main-text">Wyślij</span>
              <span className="sub-text">Enter</span>
            </button>
          )}
        </div>
      </footer>

      {showReport && hasTabLock && (
        <div className="overlay" onClick={() => setShowReport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Zgłoś użytkownika</h3>
            <p className="modal-text">
              Wybierz powód. Powtarzające się zgłoszenia mogą skutkować blokadą.
            </p>

            <div className="modal-actions">
              <button className="btn-outline" onClick={() => submitReport("bot")}>
                Zgłoś jako bota
              </button>
              <button
                className="btn-filled btn-danger"
                onClick={() => submitReport("abuse")}
              >
                Zgłoś nadużycie
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowReport(false)}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {showNextSheet && (
        <div className="sheet-overlay" onClick={() => setShowNextSheet(false)}>
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">Na pewno rozłączyć?</h3>

            <div className="sheet-actions">
              <button
                className="btn-filled"
                onClick={() => {
                  setShowNextSheet(false);
                  doNextConfirmed();
                }}
              >
                Tak, szukaj kogoś
              </button>

              <button
                className="btn-outline"
                onClick={() => setShowNextSheet(false)}
              >
                Nie, wróć do czatu
              </button>

              <button
                className="btn-ghost btn-danger-text"
                onClick={() => {
                  setShowNextSheet(false);
                  onLeave();
                }}
              >
                Opuść całkowicie aplikację
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}