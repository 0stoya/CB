import React, { useEffect, useState } from "react";
import { accountApi, type AccountUser } from "../api/auth";
import { notificationsApi } from "../api/notifications";
import { socialApi } from "../api/social";
import NotificationBell from "../components/NotificationBell";
import FriendsPage from "./FriendsPage";

function clickWhenReady(find: () => HTMLElement | null) {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const element = find();
    if (element) {
      window.clearInterval(timer);
      element.click();
    } else if (attempts >= 30) {
      window.clearInterval(timer);
    }
  }, 100);
  return () => window.clearInterval(timer);
}

export default function FriendsRoute({
  onLeave,
  navigate
}: {
  onLeave: () => void;
  navigate: (path: string) => void;
}) {
  const [account, setAccount] = useState<AccountUser | null>(null);

  useEffect(() => {
    void accountApi.me().then((result) => setAccount(result.user)).catch(() => setAccount(null));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const friendId = params.get("friend");
    const tab = params.get("tab");
    const link = `${window.location.pathname}${window.location.search}`;
    void notificationsApi.markLinkRead(link).catch(() => undefined);

    if (tab === "requests") {
      return clickWhenReady(() =>
        [...document.querySelectorAll<HTMLButtonElement>(".friends-tabs button")].find((button) =>
          button.textContent?.includes("Zaproszenia")
        ) ?? null
      );
    }

    if (!friendId) return;
    let cleanup: (() => void) | undefined;
    void socialApi.overview().then((overview) => {
      const friend = overview.friends.find((item) => item.user.id === friendId);
      if (!friend) return;
      cleanup = clickWhenReady(() =>
        [...document.querySelectorAll<HTMLButtonElement>(".friend-row")].find((button) =>
          button.querySelector("strong")?.textContent === friend.user.nickname
        ) ?? null
      );
    }).catch(() => undefined);

    return () => cleanup?.();
  }, []);

  return (
    <>
      <FriendsPage onLeave={onLeave} navigate={navigate} />
      {account && <div className="workspace-notification-bell"><NotificationBell navigate={navigate} /></div>}
    </>
  );
}
