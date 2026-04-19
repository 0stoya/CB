import { io, Socket } from "socket.io-client";
const SOCKET_URL = window.location.origin;

export type Device = "desktop" | "mobile";

export type ServerToClientEvents = {
  "user.connected": () => void;
  "user.disconnected": () => void;
  "receive_message": (payload: { text: string }) => void;
  "users.online": (count: number) => void;
  "user.start_writing": () => void;
  "user.stop_writing": () => void;
};

export type ClientToServerEvents = {
  "join": () => void;
  "leave.chat": () => void;
  "send.message": (payload: { text: string; device: Device }) => void;
  "user.start_writing": () => void;
  "user.stop_writing": () => void;
};

const CLIENT_ID_KEY = "chati_client_id";

function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (id && id.trim() && id.length <= 100) return id;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    id = crypto.randomUUID();
  } else {
    id = 'mob_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
  }
  
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SOCKET_URL,
  {
    path: "/socket.io/",
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: {
      clientId: getClientId()
    }
  }
);