import React, { useEffect, useRef, useState } from "react";
import { accountApi, type AccountUser } from "../api/auth";
import { channelsApi } from "../api/channels";
import { notificationsApi } from "../api/notifications";
import NotificationBell from "../components/NotificationBell";
import {
  socket,
  type PublicChannelMember,
  type PublicChannelMessage
} from "../socket";
import RoomsPage from "./RoomsPage";
import "./room-mentions.css";

type SuggestionState = {
  items: PublicChannelMember[];
  input: HTMLInputElement;
  top: number;
  left: number;
  width: number;
};

function highlightMentions(nickname: string | null) {
  const normalized = nickname?.toLocaleLowerCase("pl-PL") ?? null;
  document.querySelectorAll<HTMLElement>(".room-message-content p").forEach((paragraph) => {
    const text = paragraph.textContent || "";
    if (paragraph.dataset.mentionSource === text) return;
    paragraph.dataset.mentionSource = text;
    paragraph.replaceChildren();

    const expression = /@([\p{L}\p{N}_-]{3,24})/gu;
    let cursor = 0;
    for (const match of text.matchAll(expression)) {
      const index = match.index ?? 0;
      if (index > cursor) paragraph.append(document.createTextNode(text.slice(cursor, index)));
      const span = document.createElement("span");
      span.className = "room-mention";
      if (normalized && match[1]!.toLocaleLowerCase("pl-PL") === normalized) {
        span.classList.add("is-me");
      }
      span.textContent = match[0];
      paragraph.append(span);
      cursor = index + match[0].length;
    }
    if (cursor < text.length) paragraph.append(document.createTextNode(text.slice(cursor)));
  });
}

function replaceCurrentMention(input: HTMLInputElement, nickname: string) {
  const current = input.value;
  const next = current.replace(/(?:^|\s)@[\p{L}\p{N}_-]{0,24}$/u, (value) => {
    const prefix = value.startsWith(" ") ? " " : "";
    return `${prefix}@${nickname} `;
  });
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

export default function RoomsRoute({
  onLeave,
  navigate
}: {
  onLeave: () => void;
  navigate: (path: string) => void;
}) {
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionState | null>(null);
  const membersBySlug = useRef(new Map<string, PublicChannelMember[]>());
  const joinedSlugs = useRef(new Set<string>());
  const requestedRoom = useRef(new URLSearchParams(window.location.search).get("room"));
  const requestedMessage = useRef(new URLSearchParams(window.location.search).get("message"));

  useEffect(() => {
    let cancelled = false;
    void accountApi.me().then((result) => {
      if (!cancelled) setAccount(result.user);
    }).catch(() => {
      if (!cancelled) setAccount(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onJoined = (payload: {
      channel: { slug: string };
      members: PublicChannelMember[];
    }) => {
      joinedSlugs.current.add(payload.channel.slug);
      membersBySlug.current.set(payload.channel.slug, payload.members);
      window.setTimeout(() => highlightMentions(account?.nickname ?? null), 0);

      if (payload.channel.slug !== requestedRoom.current) return;
      const link = `${window.location.pathname}${window.location.search}`;
      if (account) void notificationsApi.markLinkRead(link).catch(() => undefined);

      const messageId = requestedMessage.current;
      if (!messageId) return;
      void channelsApi.messages(payload.channel.slug).then((result) => {
        const index = result.messages.findIndex((message) => message.id === messageId);
        if (index < 0) return;
        window.setTimeout(() => {
          const rows = document.querySelectorAll<HTMLElement>(".room-thread .room-message");
          const row = rows[index];
          if (!row) return;
          row.classList.add("mention-focus");
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => row.classList.remove("mention-focus"), 3500);
        }, 100);
      }).catch(() => undefined);
    };

    const onPresence = (payload: { slug: string; members: PublicChannelMember[] }) => {
      membersBySlug.current.set(payload.slug, payload.members);
    };

    const onMessage = (payload: PublicChannelMessage) => {
      window.setTimeout(() => highlightMentions(account?.nickname ?? null), 0);
      if (account && payload.senderUserId === account.id) {
        void notificationsApi.processMentions(payload.id).catch(() => undefined);
      }
    };

    const onInput = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches(".room-composer input")) return;
      const match = input.value.match(/(?:^|\s)@([\p{L}\p{N}_-]{0,24})$/u);
      if (!match) {
        setSuggestions(null);
        return;
      }

      const activeTab = document.querySelector<HTMLElement>(".room-tab.active");
      const slug = activeTab?.textContent?.replace(/[×🔒#]/g, "").trim() || requestedRoom.current;
      if (!slug) return setSuggestions(null);
      const query = match[1]!.toLocaleLowerCase("pl-PL");
      const unique = new Map<string, PublicChannelMember>();
      for (const member of membersBySlug.current.get(slug) ?? []) {
        if (!member.userId || member.nickname === account?.nickname) continue;
        if (!member.nickname.toLocaleLowerCase("pl-PL").startsWith(query)) continue;
        unique.set(member.userId, member);
      }
      const items = [...unique.values()].slice(0, 6);
      if (!items.length) return setSuggestions(null);
      const rect = input.getBoundingClientRect();
      setSuggestions({
        items,
        input,
        top: rect.top,
        left: rect.left,
        width: rect.width
      });
    };

    socket.on("channel.joined", onJoined);
    socket.on("channel.presence", onPresence);
    socket.on("channel.message", onMessage);
    document.addEventListener("input", onInput);
    if (socket.disconnected) socket.connect();

    return () => {
      socket.off("channel.joined", onJoined);
      socket.off("channel.presence", onPresence);
      socket.off("channel.message", onMessage);
      document.removeEventListener("input", onInput);
      socket.disconnect();
    };
  }, [account]);

  useEffect(() => {
    if (!account || !requestedRoom.current || joinedSlugs.current.has(requestedRoom.current)) return;
    const timer = window.setTimeout(() => {
      socket.emit("channel.join", { slug: requestedRoom.current! });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [account]);

  return (
    <>
      <RoomsPage onLeave={onLeave} navigate={navigate} />
      {account && <div className="workspace-notification-bell"><NotificationBell navigate={navigate} /></div>}
      {suggestions && (
        <div
          className="mention-suggestions"
          style={{
            left: suggestions.left,
            top: Math.max(12, suggestions.top - 10),
            width: suggestions.width
          }}
        >
          {suggestions.items.map((member) => (
            <button
              type="button"
              key={member.userId}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                replaceCurrentMention(suggestions.input, member.nickname);
                setSuggestions(null);
              }}
            >
              <span>{member.nickname.slice(0, 1).toUpperCase()}</span>
              <strong>@{member.nickname}</strong>
              {member.role === "OWNER" ? <small>Właściciel</small> : member.role === "MODERATOR" ? <small>Moderator</small> : null}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
