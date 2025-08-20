// hooks/useJoinRequestStatus.ts
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export const useJoinRequestStatus = (roomId: Id<"gameRooms"> | null) => {
  const navigate = useNavigate();

  // Query to get the current user's join requests for this room
  const joinRequestStatus = useQuery(
    api.gameRooms.getUserJoinRequestStatus,
    roomId ? { roomId } : "skip"
  );

  useEffect(() => {
    if (joinRequestStatus) {
      console.log("status", joinRequestStatus);
      if (joinRequestStatus.status === "accepted") {
        toast.success("Your join request was accepted! Redirecting...");
        // Small delay to show the toast before navigation
        setTimeout(() => {
          void navigate(`/room/${roomId}`);
        }, 1500);
      } else if (joinRequestStatus.status === "rejected") {
        toast.error("Your join request was rejected.");
      }
    }
  }, [joinRequestStatus, navigate, roomId]);

  return joinRequestStatus;
};
