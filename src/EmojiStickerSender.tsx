/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export function EmojiStickerSender({ roomId }: { roomId: Id<"gameRooms"> }) {
  const send = useMutation(api.chat.sendEmojiOrSticker);
  const messages = useQuery(api.chat.getEmojiAndStickers, { roomId });

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [fallingItems, setFallingItems] = useState<
    { id: string; content: string; type: string; left: number }[]
  >([]);

  // Trigger falling animation when new emoji/sticker comes in
  useEffect(() => {
    if (!messages) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    const id = Math.random().toString(36);
    const left = Math.random() * 90; // lock position for each item

    setFallingItems((prev) => [
      ...prev,
      { id, content: lastMsg.content, type: lastMsg.type, left },
    ]);

    const timer = setTimeout(() => {
      setFallingItems((prev) => prev.filter((item) => item.id !== id));
    }, 4000);

    return () => clearTimeout(timer);
  }, [messages]);

  const emojis = ["😂", "❤️", "🔥", "👍", "🎉", "🥳", "😭"];
  const stickers = [
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9rydf87d6dWmn4q7fxCMTzaBG6-_Zi4xY61ahSWqfHeH3N-qoR0Bujk-CwTaGEfXeKQI&usqp=CAU",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTaV-xrzMmFnC5KT4i3oel17LmqImsc-Ay04A&s",
    "/stickers/thumbs.gif",
  ];

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsPickerOpen((prev) => !prev)}
        className="fixed bottom-6 left-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg z-50"
      >
        {isPickerOpen ? "✖" : "😊"}
      </button>

      {/* Emoji/Sticker Picker Panel */}
      {isPickerOpen && (
        <div className="fixed bottom-20 left-6 bg-white shadow-lg rounded-lg p-3 z-50">
          <div className="flex gap-2 flex-wrap max-w-xs">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                className="text-2xl"
                onClick={() => send({ roomId, type: "emoji", content: emoji })}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap max-w-xs">
            {stickers.map((url) => (
              <img
                key={url}
                src={url}
                alt="sticker"
                className="w-10 h-10 cursor-pointer shrink-0 object-cover"
                onClick={() => send({ roomId, type: "sticker", content: url })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Falling Animation Layer */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-40">
        {fallingItems.map((item) => (
          <div
            key={item.id}
            className="absolute animate-fall"
            style={{
              left: `${item.left}%`,
              top: "-50px",
            }}
          >
            {item.type === "emoji" ? (
              <span className="text-4xl">{item.content}</span>
            ) : (
              <img
                src={item.content}
                alt="sticker"
                className="size-20 shrink-0 object-contain"
              />
            )}
          </div>
        ))}
      </div>

      {/* Tailwind animation */}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        .animate-fall {
          animation: fall 5s linear forwards;
        }
      `}</style>
    </>
  );
}
