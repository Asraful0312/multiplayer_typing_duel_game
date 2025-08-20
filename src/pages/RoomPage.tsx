import { useParams } from "react-router-dom";
import { TypingDuelGame } from "@/TypingDuelGame";
import { Id } from "../../convex/_generated/dataModel";

export default function RoomPage() {
  const { roomId } = useParams();

  if (!roomId) return <div>Invalid room</div>;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl mx-auto">
          <TypingDuelGame roomId={roomId as Id<"gameRooms">} />
        </div>
      </main>
    </div>
  );
}
