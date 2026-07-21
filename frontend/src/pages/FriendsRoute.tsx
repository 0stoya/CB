import React, { useEffect } from "react";
import { notificationsApi } from "../api/notifications";
import { socialApi } from "../api/social";
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

  return <FriendsPage onLeave={onLeave} navigate={navigate} />;
}
