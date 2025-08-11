import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

const useGameRoom = (roomId: Id<"gameRooms">) => {
  const toggleReady = useMutation(api.gameRooms.toggleReady);
  const startNewRound = useMutation(api.gameRooms.startNewRound);
  const [inputText, setInputText] = useState("");

  //toggle ready state
  const handleToggleReady = async () => {
    if (!roomId) return;
    try {
      await toggleReady({ roomId });
    } catch {
      toast.error("Failed to update ready status");
    }
  };

  //start new game
  const handleStartNewRound = async () => {
    if (!roomId) return;
    try {
      await startNewRound({ roomId });
      setInputText("");
    } catch {
      toast.error("Failed to start new round");
    }
  };

  return {
    handleToggleReady,
    handleStartNewRound,
    inputText,
    setInputText,
  };
};

export default useGameRoom;
