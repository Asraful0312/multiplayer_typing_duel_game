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
import useGameRoom from "./hooks/useGameRoom";
import {
  formatTime,
  getAccuracy,
  getCompletionTime,
  getElapsedTime,
  handleCopyText,
} from "./lib/game";

import { Copy } from "lucide-react";

export function TypingDuelGame() {
  const [roomId, setRoomId] = useState<Id<"gameRooms"> | null>(null);

  const [currentTime, setCurrentTime] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const updateProgress = useMutation(api.gameRooms.updateProgress);
  const prevReadyStatesRef = useRef<Record<string, boolean>>({});
  const prevGameStateRef = useRef<string>("");
  const updatePlayerScore = useMutation(api.score.updatePlayerScore);

  useLeaveRoomOnExit(roomId);

  const roomState = useQuery(
    api.gameRooms.getRoomState,
    roomId ? { roomId } : "skip"
  );

  const { handleStartNewRound, handleToggleReady, inputText, setInputText } =
    useGameRoom(roomId!);

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
    await updateProgress({ roomId, progress: value });
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
  }, [roomState?.room?.gameState]);

  // Update current time every 100ms for real-time timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!roomState?.room) return;

    if (
      prevGameStateRef.current === "playing" &&
      roomState.room.gameState === "finished"
    ) {
      const winner = roomState.room.winner;

      if (winner) {
        // Winner gets +10
        updatePlayerScore({
          playerId: winner,
          outcome: "win",
        }).catch(() => toast.error("Failed to update score"));

        // Loser gets −5
        const loser =
          roomState.players.find((p) => p.userId !== winner) || null;
        if (loser) {
          updatePlayerScore({
            playerId: loser.userId,
            outcome: "lose",
          }).catch(() => toast.error("Failed to update score"));
        }
      }

      // Play sounds
      if (winner === currentPlayer?.userId) {
        new Audio("/win.mp3").play().catch(() => {});
      } else {
        new Audio("/lose.mp3").play().catch(() => {});
      }
    }

    prevGameStateRef.current = roomState.room.gameState;
  }, [
    roomId,
    roomState?.room,
    roomState?.room?.gameState,
    roomState?.room?.winner,
    updatePlayerScore,
  ]);

  if (!roomId) {
    return <CreateOrJoinRoom setRoomId={setRoomId} />;
  }

  if (!roomState) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { room, players, currentPlayer } = roomState;
  // const otherPlayer = players.find((p) => p.userId !== currentPlayer?.userId);

  const getProgressPercentage = (progress: string, phrase: string) => {
    if (!phrase) return 0;
    return Math.min((progress.length / phrase.length) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Room Info */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold">Room: {room.roomCode}</h2>
            <button
              className="bg-gray-100 p-2 rounded"
              onClick={() => handleCopyText(room.roomCode)}
            >
              <Copy className="size-4 shrink-0" />{" "}
            </button>
          </div>
          <div className="text-sm text-gray-500">
            Players: {players.length}/2
          </div>
        </div>

        {/* Players Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {players.map((player) => (
            <div
              key={player._id}
              className={`bg-gray-50 rounded-lg p-4 ${player._id === currentPlayer?._id ? "border-primary/80" : "border-red-400"}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`size-3 rounded-full ${player._id === currentPlayer?._id ? "bg-primary" : "bg-red-500"}`}
                  />
                  <p className="font-semibold">
                    {player._id === currentPlayer?._id ? (
                      <p className="flex items-center gap-2">
                        {player.name}{" "}
                        <p className="text-sm font-normal bg-gray-100 rounded py-0.5 px-3">
                          You
                        </p>
                      </p>
                    ) : (
                      player.name
                    )}
                  </p>
                </div>
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
                      className={` h-2 rounded-full transition-all duration-200 ${player._id === currentPlayer?._id ? "bg-blue-600" : "bg-red-600"}`}
                      style={{
                        width: `${getProgressPercentage(player.progress, room.currentPhrase)}%`,
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 space-y-1">
                    <div>
                      {player.progress.length}/{room.currentPhrase.length} chars
                      {player.progress && (
                        <span className="ml-2">
                          Accuracy:{" "}
                          {getAccuracy(player.progress, room.currentPhrase)}%
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-blue-600">
                      {player.completionTime ? (
                        <span className="font-semibold">
                          ✓{" "}
                          {formatTime(
                            getCompletionTime(
                              player.startTime,
                              player.completionTime
                            )
                          )}
                        </span>
                      ) : (
                        <span>
                          ⏱️{" "}
                          {formatTime(
                            getElapsedTime(
                              player.startTime as number,
                              currentTime
                            )
                          )}
                        </span>
                      )}
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
            </div>
          ))}

          {players.length < 2 && (
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
              <div className="text-center text-gray-500">
                Waiting for another player...
              </div>
            </div>
          )}
        </div>

        {/* Game State */}
        {room.gameState === "waiting" && (
          <div className="text-center">
            {players.length < 2 ? (
              <p className="text-gray-600">
                Waiting for another player to join...
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Both players joined! Get ready to duel.
                </p>
                <button
                  onClick={handleToggleReady}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    currentPlayer?.isReady
                      ? "bg-gray-500 text-white hover:bg-gray-600"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {currentPlayer?.isReady ? "Cancel Ready" : "Ready to Duel!"}
                </button>
              </div>
            )}
          </div>
        )}

        {room.gameState === "ready" && (
          <div className="text-center">
            <p className="text-lg font-semibold text-green-600">
              Get ready... Game starting!
            </p>
          </div>
        )}

        {room.gameState === "playing" && room.currentPhrase && (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-center">
                Type this phrase:
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
                  Game Over!
                </h3>
                <div className="flex items-end gap-1 mb-4">
                  <img className="size-10" src="/win.gif" alt="win" />

                  <p className="text-lg ">
                    <span className="font-semibold">
                      {players.find((p) => p.userId === room.winner)?.name}
                    </span>{" "}
                    wins the duel!
                  </p>
                </div>
              </div>

              {/* Final Results */}
              {room.gameState === "finished" &&
                (room?.winner === currentPlayer?.userId ? (
                  <div className="bg-green-700 p-4 rounded-lg text-white text-center">
                    <h2 className="text-3xl font-bold mb-2">🏆 You Win!</h2>
                    <p className="text-lg">You typed like lightning! ⚡</p>
                  </div>
                ) : (
                  <div className="bg-red-700 p-4 rounded-lg text-white text-center">
                    <h2 className="text-3xl font-bold mb-2">💀 You Lose</h2>
                    <p className="text-lg">Better luck next time!</p>
                  </div>
                ))}
            </div>

            <button
              onClick={handleStartNewRound}
              className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start New Round
            </button>
          </div>
        )}
      </div>

      <EmojiStickerSender roomId={roomId} />

      <GameHistory roomId={roomId} />

      {/* Instructions */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-3">How to Play:</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Create a room or join with a room code</li>
          <li>Wait for another player to join</li>
          <li>Both players click "Ready to Duel!"</li>
          <li>Type the phrase as fast and accurately as possible</li>
          <li>First to complete the phrase wins!</li>
          <li>See who completed it faster with the timer!</li>
        </ol>
      </div>
    </div>
  );
}
