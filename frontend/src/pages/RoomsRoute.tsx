import React, { useEffect } from "react";
import { socket } from "../socket";
import RoomsPage from "./RoomsPage";

export default function RoomsRoute({
  onLeave,
  navigate
}: {
  onLeave: () => void;
  navigate: (path: string) => void;
}) {
  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, []);

  return <RoomsPage onLeave={onLeave} navigate={navigate} />;
}
