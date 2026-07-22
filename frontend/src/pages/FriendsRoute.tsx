import React, { useEffect, useMemo, useState } from "react";
import { accountApi, type AccountUser } from "../api/auth";
import { notificationsApi } from "../api/notifications";
import NotificationBell from "../components/NotificationBell";
import FriendsPage, { type FriendsTab } from "./FriendsPage";
import "./friends-mobile-fixes.css";

function tabFromQuery(value: string | null): FriendsTab {
  if (value === "requests" || value === "search" || value === "settings") return value;
  return "friends";
}

export default function FriendsRoute({
  onLeave,
  navigate
}: {
  onLeave: () => void;
  navigate: (path: string) => void;
}) {
  const [account, setAccount] = useState<AccountUser | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialFriendId = params.get("friend");
  const initialTab = tabFromQuery(params.get("tab"));

  useEffect(() => {
    void accountApi.me().then((result) => setAccount(result.user)).catch(() => setAccount(null));
    const link = `${window.location.pathname}${window.location.search}`;
    void notificationsApi.markLinkRead(link).catch(() => undefined);
  }, []);

  return (
    <>
      <FriendsPage
        onLeave={onLeave}
        navigate={navigate}
        initialFriendId={initialFriendId}
        initialTab={initialTab}
      />
      {account && <div className="workspace-notification-bell"><NotificationBell navigate={navigate} /></div>}
    </>
  );
}
