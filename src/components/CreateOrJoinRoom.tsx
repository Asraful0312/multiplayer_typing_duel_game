/* eslint-disable @typescript-eslint/no-misused-promises */
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Users,
  Clock,
  Crown,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CreateOrJoinRoom = () => {
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [activeTab, setActiveTab] = useState<"create" | "join" | "public">(
    "create"
  );

  const createRoom = useMutation(api.gameRooms.createRoom);
  const joinRoom = useMutation(api.gameRooms.joinRoom);
  const requestToJoinRoom = useMutation(api.gameRooms.requestToJoinRoom);
  const publicRooms = useQuery(api.gameRooms.getPublicRooms);

  const userJoinRequests = useQuery(api.gameRooms.getUserJoinRequests);

  const handleInputFocus = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        if (/^[A-Za-z0-9]{4}$/.test(clipboardText)) {
          setRoomCode(clipboardText.toUpperCase());
          toast.success("PIN pasted from clipboard!");
        }
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const handleCreateRoom = async (roomType: "public" | "private") => {
    try {
      const result = await createRoom({
        roomType,
        roomName: roomType === "public" ? roomName.trim() : undefined,
      });
      toast.success(
        `${roomType === "public" ? "Public" : "Private"} room created!`
      );
      await navigate(`/room/${result.roomId}`);
    } catch {
      toast.error("Failed to create room");
    }
  };

  const handleJoinRoom = async () => {
    try {
      const result = await joinRoom({ roomCode: roomCode.toUpperCase() });
      toast.success("Joined room successfully!");
      await navigate(`/room/${result.roomId}`);
    } catch {
      toast.error("Failed to join room. Check the room code.");
    }
  };

  const handleRequestToJoin = async (roomId: Id<"gameRooms">) => {
    try {
      await requestToJoinRoom({ roomId });
      toast.success("Join request sent! Wait for host approval.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send join request");
    }
  };

  useEffect(() => {
    if (userJoinRequests) {
      const acceptedRequest = userJoinRequests.find(
        (request: any) => request.status === "accepted" && !request.redirected
      );

      if (acceptedRequest) {
        toast.success("Your join request was accepted! Redirecting...");
        setTimeout(() => {
          void navigate(`/room/${acceptedRequest.roomId}`);
        }, 1500);
      }
    }
  }, [userJoinRequests, navigate]);

  const getJoinRequestForRoom = (roomId: Id<"gameRooms">) => {
    return userJoinRequests?.find((request) => request.roomId === roomId);
  };

  const RoomCard = ({ room }: { room: any }) => {
    const joinRequest = getJoinRequestForRoom(room._id);

    const getStatusIcon = () => {
      if (!joinRequest) return null;

      switch (joinRequest.status) {
        case "pending":
          return <AlertCircle className="h-4 w-4 text-yellow-500" />;
        case "accepted":
          return <CheckCircle className="h-4 w-4 text-green-500" />;
        case "rejected":
          return <XCircle className="h-4 w-4 text-red-500" />;
        default:
          return null;
      }
    };

    const getStatusText = () => {
      if (!joinRequest) return "Request Join";
      switch (joinRequest.status) {
        case "pending":
          return "Pending...";
        case "accepted":
          return "Accepted";
        case "rejected":
          return "Rejected";
        default:
          return "Request Join";
      }
    };

    const isDisabled =
      joinRequest?.status === "pending" || joinRequest?.status === "accepted";

    return (
      <Card key={room._id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-lg truncate">
                  {room.roomName || `Room ${room.roomCode}`}
                </h3>
                <Badge variant="secondary" className="shrink-0">
                  {room.roomCode}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Crown className="h-4 w-4" />
                  <span>{room.hostName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{room.playerCount}/5</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    {Math.floor((Date.now() - room.createdAt) / (1000 * 60))}m
                    ago
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {getStatusIcon()}
              <Button
                onClick={() => handleRequestToJoin(room._id)}
                size="sm"
                disabled={isDisabled}
                variant={
                  joinRequest?.status === "rejected" ? "outline" : "default"
                }
              >
                {getStatusText()}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto  sm:px-0 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-6">
          Join the Battle Arena
        </h2>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === "create"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => setActiveTab("join")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === "join"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Join Private
          </button>
          <button
            onClick={() => setActiveTab("public")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === "public"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Public Battles
          </button>
        </div>

        {/* Create Room Tab */}
        {activeTab === "create" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Room name (for public rooms)"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full"
                maxLength={30}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  onClick={() => handleCreateRoom("private")}
                  className="w-full"
                  variant="outline"
                >
                  Create Private Room
                </Button>
                <Button
                  onClick={() => handleCreateRoom("public")}
                  className="w-full"
                >
                  Create Public Battle
                </Button>
              </div>
            </div>
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <p className="font-medium mb-1">Room Types:</p>
              <p>
                <strong>Private:</strong> Share the code with friends to join
                (2-5 players)
              </p>
              <p>
                <strong>Public:</strong> Others can request to join from the
                public list (2-5 players)
              </p>
            </div>
          </div>
        )}

        {/* Join Private Room Tab */}
        {activeTab === "join" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onFocus={handleInputFocus}
                className="w-full text-center tracking-widest uppercase"
                maxLength={4}
              />
              <Button onClick={handleJoinRoom} className="w-full">
                Join Private Room
              </Button>
            </div>
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <p>
                Enter the 4-character room code to join a private room
                instantly.
              </p>
              <p className="mt-1 font-medium">Up to 5 players can compete!</p>
            </div>
          </div>
        )}

        {/* Public Rooms Tab */}
        {activeTab === "public" && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Request to join public battles. The host will need to approve your
              request.{" "}
              <span className="font-medium">Up to 5 players can battle!</span>
            </div>

            {publicRooms === undefined ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : publicRooms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                <p>No public battles available</p>
                <p className="text-sm">
                  Create one to start a multiplayer battle!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {publicRooms.map((room) => (
                  <RoomCard key={room._id} room={room} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateOrJoinRoom;
