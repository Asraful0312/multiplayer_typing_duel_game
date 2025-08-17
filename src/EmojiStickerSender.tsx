/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { X } from "lucide-react";

export function EmojiStickerSender({ roomId }: { roomId: Id<"gameRooms"> }) {
  const userId = useQuery(api.auth.loggedInUser)?._id;

  const send = useMutation(api.chat.sendEmojiOrSticker);
  const messages = useQuery(api.chat.getEmojiAndStickers, { roomId });
  const userStickers = useQuery(
    api.store.getUserStickers,
    userId ? { userId } : "skip"
  );

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

  // Default emojis (always available)
  const emojis = ["😂", "❤️", "🔥", "👍", "🎉", "🥳", "😭"];

  // Default stickers (always available)
  const defaultStickers = [
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9rydf87d6dWmn4q7fxCMTzaBG6-_Zi4xY61ahSWqfHeH3N-qoR0Bujk-CwTaGEfXeKQI&usqp=CAU",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTaV-xrzMmFnC5KT4i3oel17LmqImsc-Ay04A&s",
  ];

  // Combine default stickers with user-owned premium stickers
  // const allStickers = [
  //   ...defaultStickers,
  //   ...(userStickers?.map((sticker) => sticker?.content) || []),
  // ];

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsPickerOpen((prev) => !prev)}
        className="fixed bottom-6 left-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg z-50"
      >
        {isPickerOpen ? <X className="size-5 shrink-0 text-white" /> : "😊"}
      </button>

      {/* Emoji/Sticker Picker Panel */}
      {isPickerOpen && (
        <div className="fixed bottom-20 left-6 bg-white shadow-lg rounded-lg p-3 z-50 max-w-sm">
          {/* Emojis Section */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Emojis</h4>
            <div className="flex gap-2 flex-wrap">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  className="text-2xl hover:bg-gray-100 p-1 rounded transition-colors"
                  onClick={() =>
                    send({ roomId, type: "emoji", content: emoji })
                  }
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Stickers Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Stickers
              {userStickers && userStickers.length > 0 && (
                <span className="text-xs text-blue-600 ml-1">
                  ({userStickers.length} owned)
                </span>
              )}
            </h4>
            <div className="flex gap-2 flex-wrap max-h-40 overflow-y-auto">
              {/* Default stickers */}
              {defaultStickers.map((url, index) => (
                <div key={`default-${index}`} className="relative">
                  <img
                    src={url}
                    alt="default sticker"
                    className="w-10 h-10 cursor-pointer shrink-0 object-cover rounded hover:opacity-80 transition-opacity"
                    onClick={() =>
                      send({ roomId, type: "sticker", content: url })
                    }
                  />
                </div>
              ))}

              {/* User-owned premium stickers */}
              {userStickers?.map((sticker) => (
                <div key={sticker?._id} className="relative">
                  <img
                    src={sticker?.content}
                    alt={sticker?.name}
                    className="w-10 h-10 cursor-pointer shrink-0 object-cover rounded hover:opacity-80 transition-opacity border-2 border-yellow-400"
                    onClick={() =>
                      send({
                        roomId,
                        type: "sticker",
                        content: sticker?.content as string,
                      })
                    }
                    title={`${sticker?.name} (Premium)`}
                  />
                  {/* Premium indicator */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white"></div>
                </div>
              ))}

              {/* Show message if no premium stickers */}
              {(!userStickers || userStickers.length === 0) && (
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded text-center">
                  Visit the store to unlock premium stickers!
                </div>
              )}
            </div>
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
