// inside your TypingDuelGame component (or top-level wrapper)
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

export default function useLeaveRoomOnExit(roomId?: Id<"gameRooms"> | null) {
  const leaveRoom = useMutation(api.gameRooms.leaveRoom); // adjust import path

  console.log("leave");

  useEffect(() => {
    if (!roomId) return;

    // Call when React unmounts this component (navigating away within SPA)
    return () => {
      if (!roomId) return;
      leaveRoom({ roomId }).catch(() => {
        // swallow - we can't do much here
      });
    };
  }, [roomId, leaveRoom]);

  useEffect(() => {
    if (!roomId) return;

    const handleBeforeUnload = () => {
      try {
        // Best-effort: try a synchronous send using navigator.sendBeacon to a small server route if you have one.
        // Otherwise attempt the mutation (may not finish).
        // We still call the mutation (it may or may not complete).
        // This is best-effort — browsers restrict async work in beforeunload.
        leaveRoom({ roomId }).catch(() => {});
      } catch (e) {
        console.error("leave room err", e);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [roomId, leaveRoom]);
}
