import { io, Socket } from "socket.io-client";
const SOCKET_URL = window.location.origin;

export type Device = "desktop" | "mobile";

export type PublicChannel = {
  id: string;
  slug: string;
  name: string;
  topic: string | null;
  language: string;
  isOfficial: boolean;
  allowGuests: boolean;
  maxMembers: number;
  slowModeSeconds: number;
  lastActivityAt: string;
  creator: { id: string; nickname: string } | null;
};

export type PublicChannelMessage = {
  id: string;
  channelId: string;
  slug: string;
  senderUserId: string | null;
  senderNickname: string;
  text: string;
  createdAt: string;
};

export type PublicChannelMember = {
  userId: string | null;
  nickname: string;
};

export type ServerToClientEvents = {
  "user.connected": () => void;
  "user.disconnected": () => void;
  receive_message: (payload: { text: string }) => void;
  "users.online": (count: number) => void;
  "user.start_writing": () => void;
  "user.stop_writing": () => void;
  "channel.joined": (payload: {
    channel: PublicChannel;
    history: Omit<PublicChannelMessage, "slug">[];
    members: PublicChannelMember[];
  }) => void;
  "channel.message": (payload: PublicChannelMessage) => void;
  "channel.system": (payload: {
    slug: string;
    type: "join" | "leave";
    nickname: string;
    createdAt: string;
  }) => void;
  "channel.presence": (payload: {
    slug: string;
    online: number;
    members: PublicChannelMember[];
  }) => void;
  "channels.presence.changed": (payload: { slug: string; online: number }) => void;
  "channels.autojoined": (payload: { slugs: string[] }) => void;
  "channel.error": (payload: {
    code: string;
    slug: string | null;
    retryAfterMs?: number;
  }) => void;
};

export type ClientToServerEvents = {
  join: () => void;
  "leave.chat": () => void;
  "send.message": (payload: { text: string; device: Device }) => void;
  "user.start_writing": () => void;
  "user.stop_writing": () => void;
  "channel.join": (payload: { slug: string; nickname?: string }) => void;
  "channel.leave": (payload: { slug: string }) => void;
  "channel.message.send": (payload: { slug: string; text: string }) => void;
  "channels.autojoin": () => void;
};

const CLIENT_ID_KEY = "chati_client_id";

function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (id && id.trim() && id.length <= 100) return id;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    id = crypto.randomUUID();
  } else {
    id = "mob_" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
  }

  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  path: "/socket.io/",
  transports: ["websocket", "polling"],
  withCredentials: true,
  autoConnect: false,
  auth: {
    clientId: getClientId()
  }
});
