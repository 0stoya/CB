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

type DiscoveryFilter = "all" | "official" | "favourites";
type MobilePanel = "rooms" | "members" | "info" | null;
type ConnectionState = "connecting" | "online" | "offline";
type RoomStatus = {
  tone: "neutral" | "warning" | "danger";
  title: string;
  message: string;
  action?: "rooms" | "login";
};

type IconName =
  | "arrow"
  | "close"
  | "friends"
  | "info"
  | "lock"
  | "menu"
  | "more"
  | "plus"
  | "refresh"
  | "report"
  | "rooms"
  | "search"
  | "send"
  | "settings"
  | "star"
  | "users";

const GUEST_NICKNAME_KEY = "chati:guest-nickname";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="m15 18-6-6 6-6" {...common}/></>,
    close: <><path d="m6 6 12 12M18 6 6 18" {...common}/></>,
    friends: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...common}/><circle cx="9" cy="7" r="4" {...common}/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...common}/></>,
    info: <><circle cx="12" cy="12" r="9" {...common}/><path d="M12 11v5M12 8h.01" {...common}/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" {...common}/><path d="M8 10V7a4 4 0 0 1 8 0v3" {...common}/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" {...common}/></>,
    more: <><circle cx="5" cy="12" r="1" {...common}/><circle cx="12" cy="12" r="1" {...common}/><circle cx="19" cy="12" r="1" {...common}/></>,
    plus: <><path d="M12 5v14M5 12h14" {...common}/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" {...common}/><path d="M7 8a7 7 0 0 1 11.7-2.2L20 7M4 17l1.3 1.2A7 7 0 0 0 17 16" {...common}/></>,
    report: <><path d="M5 21V4M5 5h11l-2 4 2 4H5" {...common}/></>,
    rooms: <><path d="M4 5h16v12H8l-4 3V5Z" {...common}/><path d="M8 9h8M8 13h5" {...common}/></>,
    search: <><circle cx="11" cy="11" r="7" {...common}/><path d="m20 20-4-4" {...common}/></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7Z" {...common}/><path d="M22 2 11 13" {...common}/></>,
    settings: <><circle cx="12" cy="12" r="3" {...common}/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.4.3.8.6 1 .3.3.7.4 1.1.4h.1v4h-.1c-.4 0-.8.1-1.1.4-.3.2-.5.6-.6 1Z" {...common}/></>,
    star: <><path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8Z" {...common}/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...common}/><circle cx="8.5" cy="7" r="4" {...common}/><path d="M22 21v-2a4 4 0 0 0-3-3.87M15.5 3.2a4 4 0 0 1 0 7.6" {...common}/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>{paths[name]}</svg>;
}

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

function roleLabel(role: PublicChannelMember["role"]) {
  if (role === "OWNER") return "Właściciel";
  if (role === "MODERATOR") return "Moderator";
  return null;
}

function memberRank(member: PublicChannelMember) {
  if (member.role === "OWNER") return 0;
  if (member.role === "MODERATOR") return 1;
  return member.userId ? 2 : 3;
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
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);
  const [guestNickname, setGuestNickname] = useState(() => localStorage.getItem(GUEST_NICKNAME_KEY) || "");
  const [search, setSearch] = useState("");
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryFilter>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(socket.connected ? "online" : "connecting");
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedMember, setSelectedMember] = useState<PublicChannelMember | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("HARASSMENT");
  const [reportDetails, setReportDetails] = useState("");
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [roomSettings, setRoomSettings] = useState({ topic: "", allowGuests: true, slowModeSeconds: 0, isLocked: false });
  const [createForm, setCreateForm] = useState({ name: "", topic: "", allowGuests: true, slowModeSeconds: 0 });
  const threadRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = activeSlug ? openRooms[activeSlug] : null;
  const activeChannelItem = activeRoom ? channels.find((channel) => channel.slug === activeRoom.channel.slug) : null;
  const filterCounts = useMemo(() => ({
    all: channels.length,
    official: channels.filter((channel) => channel.isOfficial).length,
    favourites: channels.filter((channel) => channel.favourite).length
  }), [channels]);

  const filteredChannels = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pl-PL");
    return channels
      .filter((channel) => {
        if (discoveryFilter === "official" && !channel.isOfficial) return false;
        if (discoveryFilter === "favourites" && !channel.favourite) return false;
        if (!query) return true;
        return [channel.name, channel.slug, channel.topic || "", channel.creator?.nickname || ""]
          .some((value) => value.toLocaleLowerCase("pl-PL").includes(query));
      })
      .sort((left, right) => {
        if (left.favourite !== right.favourite) return left.favourite ? -1 : 1;
        if (left.isOfficial !== right.isOfficial) return left.isOfficial ? -1 : 1;
        if (left.online !== right.online) return right.online - left.online;
        return new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime();
      });
  }, [channels, discoveryFilter, search]);

  const sortedMembers = useMemo(
    () => [...(activeRoom?.members ?? [])].sort((left, right) => memberRank(left) - memberRank(right) || left.nickname.localeCompare(right.nickname, "pl")),
    [activeRoom?.members]
  );

  const composerLocked = Boolean(activeRoom?.channel.isLocked && !isModerator(activeRoom.channel));
  const canSend = Boolean(message.trim() && activeSlug && !composerLocked && connectionState === "online");

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
    void accountApi.me()
      .then((result) => setAccount(result.user))
      .catch(() => setAccount(null))
      .finally(() => setAccountReady(true));
    void refreshChannels();
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setConnectionState("online");
      setError((current) => current === "Połączenie z czatem zostało przerwane." ? null : current);
    };
    const onDisconnect = () => setConnectionState("offline");
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
      setActiveSlug(payload.channel.slug);
      setJoiningSlug(null);
      setRoomStatus(null);
      setMobilePanel(null);
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
      setChannels((current) => current.map((item) => item.slug === payload.slug ? {
        ...item,
        topic: payload.topic,
        allowGuests: payload.allowGuests,
        slowModeSeconds: payload.slowModeSeconds
      } : item));
      setNotice(`Ustawienia #${payload.slug} zostały zaktualizowane.`);
    };

    const removeRoom = (slug: string, status: RoomStatus) => {
      setOpenRooms((current) => {
        const next = { ...current };
        delete next[slug];
        return next;
      });
      setActiveSlug((current) => current === slug ? null : current);
      setSelectedMember(null);
      setMobilePanel(null);
      setRoomStatus(status);
      void refreshChannels();
    };

    const onKicked = (payload: { slug: string; reason: string | null }) => {
      removeRoom(payload.slug, {
        tone: "warning",
        title: `Opuszczasz #${payload.slug}`,
        message: payload.reason || "Moderator usunął Cię z tego pokoju.",
        action: "rooms"
      });
    };
    const onClosed = (payload: { slug: string }) => removeRoom(payload.slug, {
      tone: "neutral",
      title: "Pokój został zamknięty",
      message: `Administracja zamknęła #${payload.slug}. Możesz od razu wybrać inną rozmowę.`,
      action: "rooms"
    });
    const onError = (payload: { code: string; retryAfterMs?: number; slug: string | null }) => {
      setJoiningSlug(null);
      const text = errorMessage(payload.code, payload.retryAfterMs);
      if (["CHANNEL_BANNED", "CHANNEL_LOCKED", "CHANNEL_FULL", "CHANNEL_NOT_FOUND"].includes(payload.code)) {
        setRoomStatus({
          tone: payload.code === "CHANNEL_BANNED" ? "danger" : "warning",
          title: payload.code === "CHANNEL_BANNED" ? "Brak dostępu do pokoju" : "Nie można teraz dołączyć",
          message: text,
          action: "rooms"
        });
        setActiveSlug(null);
      } else {
        setError(text);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
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
    if (socket.disconnected) {
      setConnectionState("connecting");
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
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

  useEffect(() => {
    if (!mobilePanel && !selectedMember && !reportTarget && !showRoomSettings && !showCreate) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobilePanel, reportTarget, selectedMember, showCreate, showRoomSettings]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobilePanel(null);
      setSelectedMember(null);
      setReportTarget(null);
      setShowRoomSettings(false);
      setShowCreate(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  function joinChannel(channel: ChannelListItem) {
    if (openRooms[channel.slug]) {
      setActiveSlug(channel.slug);
      setMobilePanel(null);
      return;
    }
    if (!account && !channel.allowGuests) {
      setRoomStatus({
        tone: "neutral",
        title: "Ten pokój jest tylko dla kont",
        message: "Zaloguj się lub utwórz bezpłatne konto, aby dołączyć do tej rozmowy.",
        action: "login"
      });
      setActiveSlug(null);
      setMobilePanel(null);
      return;
    }
    if (!account && guestNickname.trim().length < 3) {
      setError("Wpisz pseudonim, zanim dołączysz jako gość.");
      setMobilePanel("rooms");
      return;
    }
    setJoiningSlug(channel.slug);
    setRoomStatus(null);
    socket.emit("channel.join", { slug: channel.slug, nickname: account ? undefined : guestNickname.trim() });
  }

  function closeRoom(slug: string) {
    socket.emit("channel.leave", { slug });
    const nextSlug = Object.keys(openRooms).find((item) => item !== slug) ?? null;
    setOpenRooms((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
    setActiveSlug((current) => current === slug ? nextSlug : current);
    setSelectedMember(null);
  }

  function sendMessage() {
    const text = message.trim();
    if (!text || !activeSlug || !canSend) return;
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
      setNotice(channel.autoJoin ? "Automatyczne dołączanie zostało wyłączone." : "Ten pokój otworzy się automatycznie po zalogowaniu.");
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
      setJoiningSlug(result.channel.slug);
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
      return true;
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : "ACTION_FAILED"));
      return false;
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
    const submitted = await runAction(
      () => moderationApi.report({
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason: reportReason,
        details: reportDetails || undefined
      }),
      "Zgłoszenie zostało przekazane do moderacji."
    );
    if (submitted) setReportTarget(null);
  }

  function openSettings() {
    if (!activeRoom) return;
    setRoomSettings({
      topic: activeRoom.channel.topic || "",
      allowGuests: activeRoom.channel.allowGuests,
      slowModeSeconds: activeRoom.channel.slowModeSeconds,
      isLocked: activeRoom.channel.isLocked
    });
    setMobilePanel(null);
    setShowRoomSettings(true);
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!activeRoom) return;
    const saved = await runAction(
      () => moderationApi.updateRoom(activeRoom.channel.slug, roomSettings),
      "Ustawienia pokoju zapisane."
    );
    if (saved) setShowRoomSettings(false);
  }

  function retryConnection() {
    setConnectionState("connecting");
    socket.connect();
  }

  function openRoomDirectory() {
    setMobilePanel("rooms");
    window.setTimeout(() => document.querySelector<HTMLInputElement>(".rooms-search")?.focus(), 180);
  }

  return (
    <div className="rooms-layout">
      <header className="rooms-header">
        <button className="rooms-brand" type="button" onClick={onLeave} aria-label="Wróć na stronę główną">
          <ChatiLogo size={34}/><span>Chati</span><strong>Pokoje</strong>
        </button>
        <div className="rooms-header-context">
          {activeRoom ? <><strong>#{activeRoom.channel.slug}</strong><span>{activeRoom.online} online</span></> : <><strong>Pokoje publiczne</strong><span>{channels.length} dostępnych</span></>}
        </div>
        <div className="rooms-header-actions">
          <span className="rooms-account-pill">{account ? `@${account.nickname}` : "Gość"}</span>
          {!account && <button type="button" className="rooms-button secondary desktop-only" onClick={() => navigate("/konto/logowanie")}>Zaloguj się</button>}
          {account && <button type="button" className="rooms-button secondary desktop-only" onClick={() => navigate("/znajomi")}><Icon name="friends" size={17}/>Znajomi</button>}
          <button type="button" className="rooms-button secondary desktop-only" onClick={onLeave}>Wyjdź</button>
          <button type="button" className="rooms-icon-button rooms-mobile-directory" onClick={openRoomDirectory} aria-label="Otwórz listę pokoi"><Icon name="rooms"/></button>
          {activeRoom && <button type="button" className="rooms-icon-button rooms-mobile-members" onClick={() => setMobilePanel("members")} aria-label="Pokaż uczestników"><Icon name="users"/></button>}
          <button type="button" className="rooms-icon-button rooms-mobile-exit" onClick={onLeave} aria-label="Wyjdź z pokoi"><Icon name="close"/></button>
        </div>
      </header>

      {connectionState !== "online" && (
        <div className={`rooms-connection ${connectionState}`} role="status">
          <span className="rooms-connection-dot"/>
          <div><strong>{connectionState === "connecting" ? "Łączenie z czatem…" : "Brak połączenia"}</strong><span>{connectionState === "offline" ? "Wiadomości nie zostaną wysłane, dopóki połączenie nie wróci." : "Przywracamy pokoje i uczestników."}</span></div>
          {connectionState === "offline" && <button type="button" onClick={retryConnection}><Icon name="refresh" size={17}/>Połącz ponownie</button>}
        </div>
      )}

      {error && <div className="rooms-toast error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Zamknij komunikat"><Icon name="close" size={18}/></button></div>}
      {notice && <div className="rooms-toast success" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Zamknij komunikat"><Icon name="close" size={18}/></button></div>}

      <button className={`rooms-panel-backdrop ${mobilePanel ? "is-visible" : ""}`} type="button" aria-label="Zamknij panel" onClick={() => setMobilePanel(null)}/>

      <div className="rooms-shell">
        <aside className={`rooms-sidebar ${mobilePanel === "rooms" ? "is-open" : ""}`} aria-label="Lista pokoi">
          <div className="rooms-panel-heading">
            <div><span className="rooms-eyebrow">Odkrywaj</span><h1>Pokoje publiczne</h1><p>Wybierz temat i dołącz do rozmowy.</p></div>
            <button type="button" className="rooms-panel-close" onClick={() => setMobilePanel(null)} aria-label="Zamknij listę pokoi"><Icon name="close"/></button>
          </div>

          <button type="button" className="rooms-create-button" onClick={() => account ? setShowCreate(true) : navigate("/konto/rejestracja")}>
            <Icon name="plus" size={18}/><span><strong>Utwórz pokój</strong><small>{account ? "Własny temat i ustawienia" : "Wymaga bezpłatnego konta"}</small></span>
          </button>

          {!account && (
            <label className="guest-nickname">
              <span>Dołączasz jako gość</span>
              <input value={guestNickname} maxLength={24} placeholder="Twój pseudonim" onChange={(event) => setGuestNickname(event.target.value)}/>
              <small>Pseudonim ma od 3 do 24 znaków i zostaje tylko na tym urządzeniu.</small>
            </label>
          )}

          <div className="rooms-search-wrap">
            <Icon name="search" size={18}/>
            <input className="rooms-search" value={search} placeholder="Szukaj nazwy lub tematu" onChange={(event) => setSearch(event.target.value)}/>
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Wyczyść wyszukiwanie"><Icon name="close" size={16}/></button>}
          </div>

          <div className="rooms-filters" role="tablist" aria-label="Filtry pokoi">
            <button type="button" className={discoveryFilter === "all" ? "active" : ""} onClick={() => setDiscoveryFilter("all")}>Wszystkie <span>{filterCounts.all}</span></button>
            <button type="button" className={discoveryFilter === "official" ? "active" : ""} onClick={() => setDiscoveryFilter("official")}>Oficjalne <span>{filterCounts.official}</span></button>
            {account && <button type="button" className={discoveryFilter === "favourites" ? "active" : ""} onClick={() => setDiscoveryFilter("favourites")}>Ulubione <span>{filterCounts.favourites}</span></button>}
          </div>

          <div className="rooms-list">
            {loadingChannels && <div className="rooms-list-state"><span className="rooms-spinner"/><strong>Ładujemy pokoje</strong><small>Sprawdzamy aktywne rozmowy.</small></div>}
            {!loadingChannels && filteredChannels.length === 0 && <div className="rooms-list-state"><Icon name="search" size={24}/><strong>Brak pasujących pokoi</strong><small>Zmień filtr lub spróbuj innej nazwy.</small></div>}
            {filteredChannels.map((channel) => {
              const isOpen = Boolean(openRooms[channel.slug]);
              const isActive = activeSlug === channel.slug;
              return (
                <article className={`room-list-item ${isActive ? "active" : ""} ${isOpen ? "is-open" : ""}`} key={channel.id}>
                  <button type="button" className="room-list-main" onClick={() => joinChannel(channel)}>
                    <span className="room-list-icon">#</span>
                    <span className="room-list-copy">
                      <span className="room-list-title"><strong>{channel.name}</strong>{channel.isOfficial && <em>Oficjalny</em>}</span>
                      <small>{channel.topic || "Rozmowa publiczna"}</small>
                      <span className="room-list-meta">
                        <span className="room-online"><i/>{channel.online} online</span>
                        <span>{channel.allowGuests ? "Goście mile widziani" : "Tylko konta"}</span>
                        {channel.slowModeSeconds > 0 && <span>{channel.slowModeSeconds}s slow mode</span>}
                      </span>
                    </span>
                    {joiningSlug === channel.slug ? <span className="rooms-spinner"/> : isOpen ? <span className="room-open-mark">Otwarte</span> : <Icon name="arrow" size={17}/>} 
                  </button>
                  <button
                    type="button"
                    className={`room-star ${channel.favourite ? "selected" : ""}`}
                    onClick={() => void toggleFavourite(channel)}
                    aria-label={channel.favourite ? `Usuń ${channel.name} z ulubionych` : `Dodaj ${channel.name} do ulubionych`}
                    aria-pressed={channel.favourite}
                  ><Icon name="star" size={18}/></button>
                </article>
              );
            })}
          </div>
        </aside>

        <main className="room-workspace">
          {Object.keys(openRooms).length > 0 && (
            <div className="room-tabs" aria-label="Otwarte pokoje">
              {Object.values(openRooms).map((room) => (
                <button
                  type="button"
                  data-room-slug={room.channel.slug}
                  className={`room-tab ${activeSlug === room.channel.slug ? "active" : ""}`}
                  key={room.channel.slug}
                  onClick={() => setActiveSlug(room.channel.slug)}
                >
                  <span className="room-tab-dot"/>
                  <strong>#{room.channel.slug}</strong>
                  {room.channel.isLocked && <Icon name="lock" size={13}/>} 
                  <span className="room-tab-online">{room.online}</span>
                  <span
                    className="room-tab-close"
                    role="button"
                    tabIndex={0}
                    aria-label={`Zamknij #${room.channel.slug}`}
                    onClick={(event) => { event.stopPropagation(); closeRoom(room.channel.slug); }}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); closeRoom(room.channel.slug); } }}
                  ><Icon name="close" size={14}/></span>
                </button>
              ))}
            </div>
          )}

          {!activeRoom ? (
            <div className={`rooms-welcome ${roomStatus ? `tone-${roomStatus.tone}` : ""}`}>
              <div className="rooms-welcome-icon">{roomStatus?.tone === "danger" ? <Icon name="lock" size={30}/> : <Icon name="rooms" size={30}/>}</div>
              <span className="rooms-eyebrow">{roomStatus ? "Status pokoju" : "Rozmowy społeczności"}</span>
              <h2>{roomStatus?.title || "Wybierz pokój i dołącz do rozmowy"}</h2>
              <p>{roomStatus?.message || "Oficjalne pokoje są zawsze dostępne, a pokoje społeczności skupiają rozmowy wokół konkretnych tematów."}</p>
              <div className="rooms-welcome-actions">
                <button type="button" onClick={roomStatus?.action === "login" ? () => navigate("/konto/logowanie") : openRoomDirectory}>
                  {roomStatus?.action === "login" ? "Zaloguj się" : "Przeglądaj pokoje"}
                </button>
                {account && <button type="button" className="secondary" onClick={() => setShowCreate(true)}>Utwórz własny</button>}
              </div>
              <div className="rooms-welcome-notes"><span>Publiczne wiadomości</span><span>Moderacja społeczności</span><span>Konto opcjonalne</span></div>
            </div>
          ) : (
            <>
              <div className="room-titlebar">
                <div className="room-title-copy">
                  <div className="room-title-line">
                    <h2>#{activeRoom.channel.slug}</h2>
                    {activeRoom.channel.isOfficial && <span className="room-badge official">Oficjalny</span>}
                    {activeRoom.channel.currentUserRole === "OWNER" && <span className="room-badge owner">Właściciel</span>}
                    {activeRoom.channel.currentUserRole === "MODERATOR" && <span className="room-badge moderator">Moderator</span>}
                    {activeRoom.channel.isLocked && <span className="room-badge locked"><Icon name="lock" size={13}/>Zamknięty</span>}
                  </div>
                  <p>{activeRoom.channel.topic || "Rozmowa publiczna"}</p>
                  <div className="room-title-meta"><span><i/>{activeRoom.online} online</span><span>{activeRoom.channel.allowGuests ? "Goście mogą dołączyć" : "Tylko zweryfikowane konta"}</span>{activeRoom.channel.slowModeSeconds > 0 && <span>Slow mode: {activeRoom.channel.slowModeSeconds}s</span>}</div>
                </div>
                <div className="room-title-actions">
                  <button type="button" className="room-members-button" onClick={() => setMobilePanel("members")}><Icon name="users" size={17}/><span>{activeRoom.online}</span></button>
                  <button type="button" className="room-info-button" onClick={() => setMobilePanel("info")}><Icon name="info" size={18}/><span>Informacje</span></button>
                  <details className="room-actions-menu">
                    <summary aria-label="Więcej działań"><Icon name="more"/></summary>
                    <div>
                      {account && activeChannelItem && <button type="button" onClick={() => void toggleAutoJoin(activeChannelItem)}><Icon name="star" size={17}/><span><strong>{activeChannelItem.autoJoin ? "Wyłącz auto-join" : "Włącz auto-join"}</strong><small>Otwieraj pokój po zalogowaniu</small></span></button>}
                      {isModerator(activeRoom.channel) && <button type="button" onClick={openSettings}><Icon name="settings" size={17}/><span><strong>Ustawienia pokoju</strong><small>Temat, goście i slow mode</small></span></button>}
                      <button type="button" className="danger" onClick={() => openReport({ type: "CHANNEL", id: activeRoom.channel.id, label: `#${activeRoom.channel.slug}` })}><Icon name="report" size={17}/><span><strong>Zgłoś pokój</strong><small>Przekaż do moderacji</small></span></button>
                    </div>
                  </details>
                </div>
              </div>

              {composerLocked && <div className="room-state-banner locked"><Icon name="lock"/><div><strong>Pokój jest chwilowo zamknięty</strong><span>Tylko właściciel i moderatorzy mogą teraz pisać.</span></div></div>}

              <div className="room-thread" ref={threadRef} aria-live="polite">
                {activeRoom.events.length === 0 && <div className="room-thread-intro"><span>👋</span><strong>To początek rozmowy</strong><small>Napisz pierwszą wiadomość w #{activeRoom.channel.slug}.</small></div>}
                {activeRoom.events.map((event) => {
                  if (event.kind === "system") return <div className="room-system-message" key={event.id}><span>{event.text}</span></div>;
                  const sender = activeRoom.members.find((item) => item.userId === event.senderUserId && item.nickname === event.senderNickname);
                  const ownMessage = event.senderUserId ? event.senderUserId === account?.id : event.senderNickname === guestNickname.trim();
                  return (
                    <article className={`room-message ${ownMessage ? "is-own" : ""}`} key={event.id}>
                      <button className="room-avatar" type="button" disabled={!sender} onClick={() => sender && setSelectedMember(sender)} aria-label={`Otwórz profil ${event.senderNickname}`}>{event.senderNickname.slice(0, 1).toUpperCase()}</button>
                      <div className="room-message-content">
                        <div className="room-message-meta">
                          <button type="button" disabled={!sender} onClick={() => sender && setSelectedMember(sender)}>{event.senderNickname}</button>
                          {sender?.role && <span className={`message-role ${sender.role.toLowerCase()}`}>{roleLabel(sender.role)}</span>}
                          {ownMessage && <span className="message-you">Ty</span>}
                          <time>{formatTime(event.createdAt)}</time>
                        </div>
                        <div className="room-message-bubble"><p>{event.text}</p></div>
                        <div className="room-message-actions">
                          <button type="button" onClick={() => openReport({ type: "CHANNEL_MESSAGE", id: event.id, label: `Wiadomość od ${event.senderNickname}` })}>Zgłoś</button>
                          {isModerator(activeRoom.channel) && <button type="button" className="danger" onClick={() => window.confirm("Usunąć tę wiadomość z pokoju?") && void runAction(() => moderationApi.deleteMessage(activeRoom.channel.slug, event.id), "Wiadomość została usunięta.")}>Usuń</button>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="room-composer">
                <div className="room-composer-box">
                  <textarea
                    value={message}
                    maxLength={500}
                    rows={1}
                    disabled={composerLocked || connectionState !== "online"}
                    placeholder={composerLocked ? "Pokój jest zamknięty" : connectionState !== "online" ? "Oczekiwanie na połączenie…" : `Napisz wiadomość w #${activeRoom.channel.slug}`}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <div className="room-composer-meta">
                    <span>{activeRoom.channel.slowModeSeconds > 0 ? `Slow mode ${activeRoom.channel.slowModeSeconds}s` : "Enter wysyła • Shift+Enter dodaje linię"}</span>
                    <span className={message.length > 450 ? "warning" : ""}>{message.length}/500</span>
                  </div>
                </div>
                <button type="button" className="room-send-button" disabled={!canSend} onClick={sendMessage} aria-label="Wyślij wiadomość"><Icon name="send" size={20}/><span>Wyślij</span></button>
              </div>
            </>
          )}
        </main>

        <aside className={`members-sidebar ${mobilePanel === "members" ? "is-open" : ""}`} aria-label="Uczestnicy pokoju">
          <div className="rooms-panel-heading members-heading">
            <div><span className="rooms-eyebrow">#{activeRoom?.channel.slug || "pokój"}</span><h2>Uczestnicy</h2><p>{activeRoom ? `${activeRoom.online} osób online` : "Wybierz pokój"}</p></div>
            <button type="button" className="rooms-panel-close" onClick={() => setMobilePanel(null)} aria-label="Zamknij uczestników"><Icon name="close"/></button>
          </div>
          <div className="members-list">
            {sortedMembers.map((member) => (
              <button className="member-row member-button" type="button" key={member.memberId} onClick={() => { setSelectedMember(member); setMobilePanel(null); }}>
                <span className="member-avatar">{member.nickname.slice(0, 1).toUpperCase()}</span>
                <span className="member-copy"><strong>{member.nickname}{member.userId === account?.id && <em>Ty</em>}</strong><small>{roleLabel(member.role) || (member.userId ? "Zweryfikowane konto" : "Gość")}</small></span>
                <i/>
              </button>
            ))}
            {activeRoom && sortedMembers.length === 0 && <div className="rooms-list-state"><Icon name="users" size={24}/><strong>Nikogo tu jeszcze nie ma</strong><small>Lista zaktualizuje się automatycznie.</small></div>}
            {!activeRoom && <div className="rooms-list-state"><Icon name="rooms" size={24}/><strong>Wybierz pokój</strong><small>Uczestnicy pojawią się po dołączeniu.</small></div>}
          </div>
        </aside>
      </div>

      <aside className={`room-info-drawer ${mobilePanel === "info" ? "is-open" : ""}`} aria-label="Informacje o pokoju">
        <div className="rooms-panel-heading">
          <div><span className="rooms-eyebrow">Informacje</span><h2>#{activeRoom?.channel.slug || "pokój"}</h2><p>{activeRoom?.channel.topic || "Rozmowa publiczna"}</p></div>
          <button type="button" className="rooms-panel-close" onClick={() => setMobilePanel(null)} aria-label="Zamknij informacje"><Icon name="close"/></button>
        </div>
        {activeRoom && <div className="room-info-content">
          <div className="room-info-grid">
            <div><strong>{activeRoom.online}</strong><span>online</span></div>
            <div><strong>{activeRoom.channel.maxMembers}</strong><span>limit osób</span></div>
            <div><strong>{activeRoom.channel.slowModeSeconds || "—"}</strong><span>{activeRoom.channel.slowModeSeconds ? "sek. slow mode" : "bez slow mode"}</span></div>
          </div>
          <div className="room-info-list">
            <div><span>Dostęp</span><strong>{activeRoom.channel.allowGuests ? "Konta i goście" : "Tylko konta"}</strong></div>
            <div><span>Status</span><strong>{activeRoom.channel.isLocked ? "Zamknięty" : "Otwarty"}</strong></div>
            <div><span>Twój poziom</span><strong>{activeRoom.channel.currentUserRole === "OWNER" ? "Właściciel" : activeRoom.channel.currentUserRole === "MODERATOR" ? "Moderator" : "Uczestnik"}</strong></div>
          </div>
          <div className="room-info-actions">
            {account && activeChannelItem && <button type="button" onClick={() => void toggleAutoJoin(activeChannelItem)}><Icon name="star" size={18}/><span><strong>{activeChannelItem.autoJoin ? "Wyłącz auto-join" : "Włącz auto-join"}</strong><small>Automatycznie otwieraj ten pokój</small></span></button>}
            {isModerator(activeRoom.channel) && <button type="button" onClick={openSettings}><Icon name="settings" size={18}/><span><strong>Ustawienia pokoju</strong><small>Temat, dostęp, blokada i slow mode</small></span></button>}
            <button type="button" className="danger" onClick={() => { setMobilePanel(null); openReport({ type: "CHANNEL", id: activeRoom.channel.id, label: `#${activeRoom.channel.slug}` }); }}><Icon name="report" size={18}/><span><strong>Zgłoś pokój</strong><small>Przekaż treść moderatorom Chati</small></span></button>
            <button type="button" onClick={() => { closeRoom(activeRoom.channel.slug); setMobilePanel(null); }}><Icon name="close" size={18}/><span><strong>Opuść pokój</strong><small>Zamknij tę kartę rozmowy</small></span></button>
          </div>
        </div>}
      </aside>

      {selectedMember && activeRoom && (
        <div className="room-popover-backdrop" role="presentation" onMouseDown={() => setSelectedMember(null)}>
          <section className="room-user-card" role="dialog" aria-modal="true" aria-labelledby="room-user-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="room-card-close" type="button" onClick={() => setSelectedMember(null)} aria-label="Zamknij profil"><Icon name="close"/></button>
            <div className="room-user-avatar">{selectedMember.nickname.slice(0, 1).toUpperCase()}</div>
            <h3 id="room-user-title">{selectedMember.nickname}</h3>
            <div className="room-user-meta"><span className={`room-badge ${selectedMember.role?.toLowerCase() || "member"}`}>{roleLabel(selectedMember.role) || (selectedMember.userId ? "Zweryfikowane konto" : "Gość")}</span>{selectedMember.userId === account?.id && <span className="room-badge official">To Ty</span>}</div>
            <div className="room-card-actions">
              {account && selectedMember.userId && selectedMember.userId !== account.id && <>
                <button disabled={actionBusy} onClick={() => void runAction(() => socialApi.sendRequest(selectedMember.nickname), "Zaproszenie zostało wysłane.")}>Dodaj znajomego</button>
                <button className="secondary" disabled={actionBusy} onClick={() => void runAction(() => socialApi.blockUser(selectedMember.userId!), "Użytkownik został zablokowany.")}>Zablokuj</button>
                <button className="secondary" type="button" onClick={() => { setSelectedMember(null); openReport({ type: "USER", id: selectedMember.userId!, label: selectedMember.nickname }); }}>Zgłoś profil</button>
              </>}
              {isModerator(activeRoom.channel) && selectedMember.userId !== account?.id && selectedMember.role !== "OWNER" && <>
                <div className="room-card-divider"><span>Moderacja pokoju</span></div>
                <button className="warning" disabled={actionBusy} onClick={() => void runAction(() => moderationApi.kickMember(activeRoom.channel.slug, selectedMember.memberId), "Użytkownik został usunięty z pokoju.")}>Usuń z pokoju</button>
                {selectedMember.userId && <>
                  <button className="warning" disabled={actionBusy} onClick={() => void runAction(() => moderationApi.muteUser(activeRoom.channel.slug, selectedMember.userId!, 10), "Użytkownik został wyciszony na 10 minut.")}>Wycisz 10 min</button>
                  <button className="danger" disabled={actionBusy} onClick={() => window.confirm("Zablokować użytkownika w tym pokoju?") && void runAction(() => moderationApi.banUser(activeRoom.channel.slug, selectedMember.userId!), "Użytkownik został zablokowany w pokoju.")}>Zablokuj w pokoju</button>
                  {activeRoom.channel.currentUserRole === "OWNER" && <button className="secondary" disabled={actionBusy} onClick={() => void runAction(() => moderationApi.setModerator(activeRoom.channel.slug, selectedMember.userId!, selectedMember.role !== "MODERATOR"), selectedMember.role === "MODERATOR" ? "Usunięto rolę moderatora." : "Nadano rolę moderatora.")}>{selectedMember.role === "MODERATOR" ? "Usuń moderatora" : "Nadaj moderatora"}</button>}
                </>}
              </>}
              {selectedMember.userId === account?.id && <div className="room-user-self">To Twój profil w tym pokoju.</div>}
            </div>
          </section>
        </div>
      )}

      {reportTarget && (
        <div className="rooms-modal-backdrop" role="presentation" onMouseDown={() => setReportTarget(null)}>
          <form className="rooms-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="report-room-title" onSubmit={submitReport} onMouseDown={(event) => event.stopPropagation()}>
            <div className="rooms-modal-heading"><div><span className="rooms-eyebrow">Moderacja</span><h2 id="report-room-title">Zgłoś treść</h2><p>{reportTarget.label}</p></div><button type="button" onClick={() => setReportTarget(null)} aria-label="Zamknij"><Icon name="close"/></button></div>
            <label><span>Powód</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)}><option value="SPAM">Spam</option><option value="HARASSMENT">Nękanie lub obrażanie</option><option value="HATE">Mowa nienawiści</option><option value="SEXUAL">Treści seksualne</option><option value="VIOLENCE">Przemoc lub groźby</option><option value="IMPERSONATION">Podszywanie się</option><option value="ILLEGAL">Nielegalne treści</option><option value="OTHER">Inny powód</option></select></label>
            <label><span>Szczegóły <small>opcjonalnie</small></span><textarea maxLength={1000} value={reportDetails} placeholder="Krótko opisz problem, aby ułatwić ocenę." onChange={(event) => setReportDetails(event.target.value)}/></label>
            <p className="rooms-modal-note">Do zgłoszenia zostanie dołączony chroniony zapis wskazanej treści. Nie musisz kopiować wiadomości ręcznie.</p>
            <div className="rooms-modal-actions"><button type="button" className="secondary" onClick={() => setReportTarget(null)}>Anuluj</button><button type="submit" disabled={actionBusy}>{actionBusy ? "Wysyłanie…" : "Wyślij zgłoszenie"}</button></div>
          </form>
        </div>
      )}

      {showRoomSettings && activeRoom && (
        <div className="rooms-modal-backdrop" role="presentation" onMouseDown={() => setShowRoomSettings(false)}>
          <form className="rooms-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="settings-room-title" onSubmit={saveSettings} onMouseDown={(event) => event.stopPropagation()}>
            <div className="rooms-modal-heading"><div><span className="rooms-eyebrow">Moderacja pokoju</span><h2 id="settings-room-title">Ustawienia #{activeRoom.channel.slug}</h2><p>Zmiany działają natychmiast dla wszystkich uczestników.</p></div><button type="button" onClick={() => setShowRoomSettings(false)} aria-label="Zamknij"><Icon name="close"/></button></div>
            <label><span>Temat pokoju</span><textarea maxLength={240} value={roomSettings.topic} placeholder="O czym rozmawiacie?" onChange={(event) => setRoomSettings((current) => ({ ...current, topic: event.target.value }))}/></label>
            <label><span>Tryb powolny</span><select value={roomSettings.slowModeSeconds} onChange={(event) => setRoomSettings((current) => ({ ...current, slowModeSeconds: Number(event.target.value) }))}><option value={0}>Wyłączony</option><option value={5}>5 sekund</option><option value={15}>15 sekund</option><option value={30}>30 sekund</option><option value={60}>60 sekund</option></select></label>
            <label className="rooms-checkbox-row"><input type="checkbox" checked={roomSettings.allowGuests} onChange={(event) => setRoomSettings((current) => ({ ...current, allowGuests: event.target.checked }))}/><span><strong>Zezwalaj gościom na dołączanie</strong><small>Po wyłączeniu nowe osoby muszą mieć zweryfikowane konto.</small></span></label>
            <label className="rooms-checkbox-row"><input type="checkbox" checked={roomSettings.isLocked} onChange={(event) => setRoomSettings((current) => ({ ...current, isLocked: event.target.checked }))}/><span><strong>Zamknij możliwość pisania</strong><small>Zwykli uczestnicy pozostaną w pokoju, ale pisać będą mogli tylko moderatorzy.</small></span></label>
            <div className="rooms-modal-actions"><button type="button" className="secondary" onClick={() => setShowRoomSettings(false)}>Anuluj</button><button type="submit" disabled={actionBusy}>{actionBusy ? "Zapisywanie…" : "Zapisz ustawienia"}</button></div>
          </form>
        </div>
      )}

      {showCreate && (
        <div className="rooms-modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <form className="rooms-modal" role="dialog" aria-modal="true" aria-labelledby="create-room-title" onSubmit={submitCreate} onMouseDown={(event) => event.stopPropagation()}>
            <div className="rooms-modal-heading"><div><span className="rooms-eyebrow">Nowa społeczność</span><h2 id="create-room-title">Utwórz własny pokój</h2><p>Nieaktywny pokój społeczności jest usuwany po 48 godzinach.</p></div><button type="button" onClick={() => setShowCreate(false)} aria-label="Zamknij"><Icon name="close"/></button></div>
            <label><span>Nazwa pokoju</span><input required minLength={3} maxLength={60} value={createForm.name} placeholder="np. Polacy w Norfolk" onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}/><small>Krótka, czytelna nazwa najlepiej pomaga znaleźć rozmowę.</small></label>
            <label><span>Temat</span><textarea maxLength={240} value={createForm.topic} placeholder="Napisz, o czym jest ten pokój." onChange={(event) => setCreateForm((current) => ({ ...current, topic: event.target.value }))}/></label>
            <label className="rooms-checkbox-row"><input type="checkbox" checked={createForm.allowGuests} onChange={(event) => setCreateForm((current) => ({ ...current, allowGuests: event.target.checked }))}/><span><strong>Zezwalaj gościom na dołączanie</strong><small>Goście używają tymczasowego pseudonimu i nie mają funkcji konta.</small></span></label>
            <label><span>Tryb powolny</span><select value={createForm.slowModeSeconds} onChange={(event) => setCreateForm((current) => ({ ...current, slowModeSeconds: Number(event.target.value) }))}><option value={0}>Wyłączony</option><option value={5}>5 sekund</option><option value={15}>15 sekund</option><option value={30}>30 sekund</option></select></label>
            <div className="rooms-modal-actions"><button type="button" className="secondary" onClick={() => setShowCreate(false)}>Anuluj</button><button type="submit" disabled={createBusy}>{createBusy ? "Tworzenie…" : "Utwórz i dołącz"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
