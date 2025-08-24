/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import { GameHistory } from "./GameHistory";
import { EmojiStickerSender } from "./EmojiStickerSender";
import useLeaveRoomOnExit from "./hooks/useLeaveRoom";
import CreateOrJoinRoom from "./components/CreateOrJoinRoom";
import JoinRequests from "./components/JoinRequests";
import useGameRoom from "./hooks/useGameRoom";
import { formatTime, getAccuracy, getCompletionTime, getWPM } from "./lib/game";

import { CheckCheck, Copy, Crown, Users } from "lucide-react";
import PlayerTimer from "./components/PlayerTimer";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { useNavigate } from "react-router-dom";

export function TypingDuelGame({ roomId }: { roomId: Id<"gameRooms"> }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const updateProgress = useMutation(api.gameRooms.updateProgress);
  const prevReadyStatesRef = useRef<Record<string, boolean>>({});
  const prevGameStateRef = useRef<string>("");
  const updateMultiplayerGameScores = useMutation(
    api.leaderboard.updateMultiplayerGameScores
  );
  const [copiedText, setCopiedText] = useState("");
  const leaveRoom = useMutation(api.gameRooms.leaveRoom);
  const navigate = useNavigate();

  useLeaveRoomOnExit(roomId);

  const roomState = useQuery(
    api.gameRooms.getRoomState,
    roomId ? { roomId } : "skip"
  );

  const { handleStartNewRound, handleToggleReady, inputText, setInputText } =
    useGameRoom(roomId);

  //play ready sound
  useEffect(() => {
    if (!roomState?.players) return;

    // Compare current ready states to previous ready states
    roomState.players.forEach((player) => {
      const prevReady = prevReadyStatesRef.current[player._id];
      if (prevReady !== undefined && prevReady !== player.isReady) {
        // Play sound when ready status changes
        const audio = new Audio("/ready.mp3");
        audio.play().catch(() => {});
      }
    });

    // Store current states
    prevReadyStatesRef.current = roomState.players.reduce(
      (acc, player) => {
        acc[player._id] = player.isReady;
        return acc;
      },
      {} as Record<string, boolean>
    );
  }, [roomState?.players]);

  const handleInputChange = async (value: string) => {
    if (
      !roomId ||
      !roomState?.room ||
      roomState.room.gameState !== "playing" ||
      currentPlayer?.completionTime // already finished
    ) {
      return;
    }

    setInputText(value);

    const liveWpm = getWPM(
      value, // <-- use the new text
      currentPlayer?.startTime as number, // startTime comes from roomState.currentPlayer
      Date.now() // current moment so it's a live WPM
    );

    await updateProgress({
      roomId,
      progress: value,
      phrase: roomState.room.currentPhrase,
      wpm: liveWpm,
    });
  };

  // Focus input when game starts
  useEffect(() => {
    if (roomState?.room?.gameState === "playing" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [roomState?.room?.gameState]);

  // Clear input when game resets
  useEffect(() => {
    if (roomState?.room?.gameState === "waiting") {
      setInputText("");
    }
  }, [roomState?.room?.gameState, setInputText]);

  // Updated scoring logic for multiplayer
  useEffect(() => {
    if (!roomState?.room) return;

    const { gameState, winner } = roomState.room;

    if (prevGameStateRef.current === "playing" && gameState === "finished") {
      if (winner) {
        // Get all player IDs for score calculation
        const allPlayerIds = roomState.players.map((p) => p.userId);

        // Only the winner should trigger score updates to prevent duplicate calls
        if (currentPlayer?.userId === winner) {
          updateMultiplayerGameScores({
            winnerId: winner,
            allPlayerIds,
          }).catch(() => toast.error("Failed to update scores"));
        }
      }
    }

    prevGameStateRef.current = gameState;
  }, [
    roomId,
    roomState?.players,
    roomState?.room,
    roomState?.room.gameState,
    roomState?.room.winner,
    updateMultiplayerGameScores,
    roomState?.currentPlayer?.userId,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCopiedText("");
    }, 2000);

    return () => clearTimeout(timeout);
  }, [copiedText]);

  if (!roomId) {
    return <CreateOrJoinRoom />;
  }

  if (!roomState) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { room, players, currentPlayer, joinRequests, isHost } = roomState;

  const getProgressPercentage = (progress: string, phrase: string) => {
    if (!phrase) return 0;
    return Math.min((progress.length / phrase.length) * 100, 100);
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success("Text copied to clipboard!");
        setCopiedText(text);
      },
      () => toast.error("Failed to copy text.")
    );
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom({ roomId });
      await navigate("/", { state: { fromLeave: true } });
      toast.success("You've left the room");
    } catch (error) {
      toast.error("Failed to leave room");
    }
  };

  return (
    <div className="space-y-6">
      {/* Join Requests (for hosts of public rooms) */}
      {isHost &&
        room.roomType === "public" &&
        joinRequests &&
        joinRequests.length > 0 && (
          <JoinRequests joinRequests={joinRequests} roomCode={room.roomCode} />
        )}

      <Button onClick={handleLeaveRoom} variant="destructive">
        Leave Room
      </Button>

      {/* Room Info */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">
                {room.roomType === "public" && room.roomName
                  ? room.roomName
                  : `Room: ${room.roomCode}`}
              </h2>
              <Badge
                variant={room.roomType === "public" ? "default" : "secondary"}
              >
                {room.roomType}
              </Badge>
            </div>
            <button
              className="bg-gray-100 p-2 rounded"
              onClick={() => handleCopyText(room.roomCode)}
            >
              {copiedText === room.roomCode ? (
                <CheckCheck className="size-4 shrink-0 text-green-500" />
              ) : (
                <Copy className="size-4 shrink-0" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Users className="size-4" />
              <span>Players: {players.length}/5</span>
            </div>
            {room.roomType === "public" && room.roomName && (
              <div className="text-sm text-gray-500">Code: {room.roomCode}</div>
            )}
          </div>
        </div>

        {/* Players Status - Updated for more players */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {players.map((player) => (
            <div
              key={player._id}
              className={`bg-gray-50 rounded-lg p-4 border-2 ${
                player._id === currentPlayer?._id
                  ? "border-primary bg-blue-50"
                  : "border-gray-200"
              } ${
                room.gameState === "finished" && room.winner === player.userId
                  ? "border-yellow-500 bg-yellow-50"
                  : ""
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`size-3 rounded-full ${
                      player._id === currentPlayer?._id
                        ? "bg-primary"
                        : "bg-gray-400"
                    } ${
                      room.gameState === "finished" &&
                      room.winner === player.userId
                        ? "bg-yellow-500"
                        : ""
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">
                      {player._id === currentPlayer?._id ? (
                        <div className="flex items-center gap-2">
                          {player.name}
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        </div>
                      ) : (
                        player.name
                      )}
                    </p>
                    {player.isHost && (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {room.gameState === "finished" &&
                  room.winner === player.userId && (
                    <Badge variant="default" className="text-xs bg-yellow-500">
                      Winner!
                    </Badge>
                  )}
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    player.isReady
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {player.isReady ? "Ready" : "Not Ready"}
                </span>
              </div>

              {room.gameState === "playing" && room.currentPhrase && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-200 ${
                        player._id === currentPlayer?._id
                          ? "bg-blue-600"
                          : "bg-gray-600"
                      }`}
                      style={{
                        width: `${getProgressPercentage(player.progress, room.currentPhrase)}%`,
                      }}
                    ></div>
                  </div>

                  <div className="text-xs text-gray-600 mt-1 space-y-1">
                    <div>
                      {player.progress.length}/{room.currentPhrase.length} chars
                      {player.progress && (
                        <span className="text-sm ml-2">
                          Accuracy:{" "}
                          {getAccuracy(player.progress, room.currentPhrase)}%
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-primary">
                      <PlayerTimer
                        startTime={player?.startTime as number}
                        completionTime={player?.completionTime as number}
                      />
                    </div>
                  </div>
                </div>
              )}

              {room.gameState === "finished" && player.completionTime && (
                <div className="mt-2 text-xs">
                  <div className="font-mono text-blue-600 font-semibold">
                    Final Time:{" "}
                    {formatTime(
                      getCompletionTime(player.startTime, player.completionTime)
                    )}
                  </div>
                </div>
              )}

              {player.progress && (
                <div className="mt-2 text-sm text-gray-600">
                  <span>
                    Accuracy:{" "}
                    {getAccuracy(
                      player.progress,
                      room?.currentPhrase as string
                    )}
                    %
                  </span>
                  <span className="ml-4">
                    WPM:{" "}
                    {getWPM(
                      player.progress,
                      player.startTime as number,
                      player.completionTime
                    )}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Empty slots for remaining players */}
          {Array.from({ length: 5 - players.length }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300"
            >
              <div className="text-center text-gray-500 text-sm">
                {room.roomType === "public"
                  ? "Waiting for join requests..."
                  : "Waiting for player..."}
              </div>
            </div>
          ))}
        </div>

        {/* Game State - Updated for multiplayer */}
        {room.gameState === "waiting" && (
          <div className="text-center">
            {players.length < 2 ? (
              <p className="text-gray-600">
                {room.roomType === "public"
                  ? "Waiting for players to request joining... (Need at least 2 players)"
                  : "Waiting for players to join... (Need at least 2 players)"}
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">
                  {players.length} players joined! Get ready for a{" "}
                  {players.length}-player duel.
                  {players.length < 5 && " (Up to 5 players can join)"}
                </p>
                <Button
                  onClick={handleToggleReady}
                  variant={currentPlayer?.isReady ? "secondary" : "default"}
                >
                  {currentPlayer?.isReady ? "Cancel Ready" : "Ready to Duel!"}
                </Button>
                <p className="text-sm text-gray-500">
                  {players.filter((p) => p.isReady).length}/{players.length}{" "}
                  players ready
                </p>
              </div>
            )}
          </div>
        )}

        {room.gameState === "ready" && (
          <div className="text-center">
            <p className="text-lg font-semibold text-green-600">
              Get ready... {players.length}-player battle starting!
            </p>
          </div>
        )}

        {room.gameState === "playing" && room.currentPhrase && (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-center">
                Type this phrase - First to finish wins!
              </h3>
              <div className="text-xl font-mono text-center bg-white p-4 rounded border">
                {room.currentPhrase.split("").map((char, index) => {
                  const userChar = inputText[index];
                  let className = "bg-gray-100";

                  if (userChar !== undefined) {
                    className =
                      userChar === char ? "bg-green-200" : "bg-red-200";
                  } else if (index === inputText.length) {
                    className = "bg-blue-200 animate-pulse";
                  }

                  return (
                    <span key={index} className={`${className} px-1`}>
                      {char}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Your typing:
              </label>
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
                placeholder="Start typing..."
                disabled={
                  room.gameState !== "playing" ||
                  !!currentPlayer?.completionTime
                }
              />
            </div>
          </div>
        )}

        {room.gameState === "finished" && room.winner && (
          <div className="text-center space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex flex-col items-center">
                <h3 className="text-2xl font-bold text-yellow-800 ">
                  {players.length}-Player Battle Complete!
                </h3>
                <div className="flex items-end gap-1 mb-4">
                  <img className="size-10" src="/win.gif" alt="win" />
                  <p className="text-lg ">
                    <span className="font-semibold">
                      {players.find((p) => p.userId === room.winner)?.name}
                    </span>{" "}
                    wins the {players.length}-player duel!
                  </p>
                </div>
              </div>

              {/* Show final rankings */}
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold text-gray-800">Final Rankings:</h4>
                <div className="space-y-1">
                  {players
                    .sort((a, b) => {
                      // Winner first
                      if (a.userId === room.winner) return -1;
                      if (b.userId === room.winner) return 1;

                      // Then by completion time (if completed)
                      if (a.completionTime && b.completionTime) {
                        return (
                          a.completionTime -
                          (a.startTime || 0) -
                          (b.completionTime - (b.startTime || 0))
                        );
                      }
                      if (a.completionTime) return -1;
                      if (b.completionTime) return 1;

                      // Then by progress
                      return b.progress.length - a.progress.length;
                    })
                    .map((player, index) => (
                      <div
                        key={player._id}
                        className={`flex justify-between items-center p-2 rounded ${
                          index === 0 ? "bg-yellow-200" : "bg-gray-100"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-bold">#{index + 1}</span>
                          <span>{player.name}</span>
                          {index === 0 && <span>🏆</span>}
                        </span>
                        <span className="text-sm">
                          {player.completionTime
                            ? formatTime(
                                getCompletionTime(
                                  player.startTime,
                                  player.completionTime
                                )
                              )
                            : `${player.progress.length}/${room.currentPhrase?.length || 0} chars`}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Personal result */}
              {room.gameState === "finished" &&
                (room?.winner === currentPlayer?.userId ? (
                  <div className="bg-green-700 p-4 rounded-lg text-white text-center mt-4">
                    <h2 className="text-3xl font-bold mb-2">🏆 You Win!</h2>
                    <p className="text-lg">
                      Champion of this {players.length}-player battle! ⚡
                    </p>
                    <p className="text-sm mt-2">
                      Bonus points for competing against {players.length - 1}{" "}
                      players!
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-700 p-4 rounded-lg text-white text-center mt-4">
                    <h2 className="text-3xl font-bold mb-2">💀 You Lost</h2>
                    <p className="text-lg">Better luck next time!</p>
                    <p className="text-sm mt-2">
                      You earned participation points for the {players.length}
                      -player battle!
                    </p>
                  </div>
                ))}
            </div>

            <Button onClick={handleStartNewRound}>Start New Round</Button>
          </div>
        )}
      </div>

      <EmojiStickerSender roomId={roomId} />

      <GameHistory roomId={roomId} />

      {/* Instructions - Updated for multiplayer */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-3">How to Play:</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Create a room (public or private) or join with a room code</li>
          <li>
            For public rooms: others can request to join, and you can
            accept/reject (up to 5 players)
          </li>
          <li>
            For private rooms: share the code with friends to join directly (up
            to 5 players)
          </li>
          <li>Wait for at least 2 players to join (maximum 5 players)</li>
          <li>All players click "Ready to Duel!"</li>
          <li>Type the phrase as fast and accurately as possible</li>
          <li>First player to complete the phrase wins the entire battle!</li>
          <li>Winners get bonus points for larger battles!</li>
          <li>All players get participation rewards in multiplayer games</li>
        </ol>
      </div>
    </div>
  );
}
