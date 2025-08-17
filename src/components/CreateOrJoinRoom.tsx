/* eslint-disable @typescript-eslint/no-misused-promises */
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Props = {
  setRoomId: (v: Id<"gameRooms">) => void;
};

const CreateOrJoinRoom = ({ setRoomId }: Props) => {
  const [roomCode, setRoomCode] = useState("");
  const createRoom = useMutation(api.gameRooms.createRoom);
  const joinRoom = useMutation(api.gameRooms.joinRoom);

  const handleInputFocus = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        // Validate: exactly 4 letters/numbers
        if (/^[A-Za-z0-9]{4}$/.test(clipboardText)) {
          setRoomCode(clipboardText.toUpperCase()); // <-- paste into input
          toast.success("PIN pasted from clipboard!");
        }
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const handleCreateRoom = async () => {
    try {
      const result = await createRoom();
      setRoomId(result.roomId);
      toast.success(`Room created! Code: ${result.roomCode}`);
    } catch {
      toast.error("Failed to create room");
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      toast.error("Please enter a room code");
      return;
    }

    try {
      const result = await joinRoom({ roomCode: roomCode.toUpperCase() });
      setRoomId(result.roomId);
      toast.success("Joined room successfully!");
    } catch {
      toast.error("Failed to join room. Check the room code.");
    }
  };
  return (
    <div className="w-[400px] mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Join the Duel</h2>

        <div className="space-y-4">
          <Button onClick={handleCreateRoom} className="w-full">
            Create New Room
          </Button>

          <div className="text-center text-gray-500">or</div>

          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onFocus={handleInputFocus}
              className="w-full"
              maxLength={4}
            />
            <Button
              onClick={handleJoinRoom}
              className="w-full"
              variant="secondary"
            >
              Join Room
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrJoinRoom;
