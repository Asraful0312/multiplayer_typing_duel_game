import { api } from "../convex/_generated/api"; // adjust import to your api
import { useQuery } from "convex/react";
import { Id } from "../convex/_generated/dataModel";

export function GameHistory({ roomId }: { roomId: Id<"gameRooms"> }) {
  //   const [history, setHistory] = useState<GameHistoryItem[] | null>(null);

  const gameHistory = useQuery(api.gameRooms.getGameHistory, { roomId });

  if (gameHistory === undefined) {
    return <div>Loading game history...</div>;
  }

  if (!gameHistory || gameHistory.length === 0) {
    return <div>No game history found for this room.</div>;
  }

  const formatTime = (ms?: number) => {
    if (ms === undefined) return "-";
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${seconds}.${milliseconds}s`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="w-full p-4 bg-white rounded shadow space-y-6">
      <h2 className="text-2xl font-bold mb-4">Game History</h2>
      {gameHistory?.map((game) => (
        <div key={game._id} className="border p-4 rounded">
          <div className="mb-2 text-gray-600 text-sm">
            Ended at: {formatDate(game.endedAt)}
          </div>
          <div className="mb-2 font-semibold">
            Winner:{" "}
            {game.players.find((p) => p.userId === game.winnerId)?.name ||
              "Unknown"}
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 px-2">Player</th>
                <th className="py-1 px-2">WPM</th>
                <th className="py-1 px-2">Accuracy</th>
                <th className="py-1 px-2">Completion Time</th>
              </tr>
            </thead>
            <tbody>
              {game?.players?.map((player) => (
                <tr
                  key={player.userId}
                  className={
                    player.userId === game.winnerId
                      ? "bg-green-100 font-semibold"
                      : "bg-red-100"
                  }
                >
                  <td className="py-1 px-2">{player.name}</td>
                  <td className="py-1 px-2">{player.wpm ?? "-"}</td>
                  <td className="py-1 px-2">
                    {player.accuracy !== undefined
                      ? `${player.accuracy}%`
                      : "-"}
                  </td>
                  <td className="py-1 px-2">
                    {formatTime(player.completionTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
