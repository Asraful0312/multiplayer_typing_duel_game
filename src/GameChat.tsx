/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState, useRef } from "react";
import { api } from "../convex/_generated/api"; // adjust import
import { useMutation, useQuery } from "convex/react";
import { Id } from "../convex/_generated/dataModel";

export function GameChat({ roomId }: { roomId: Id<"gameRooms"> }) {
  const [newMessage, setNewMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messages = useQuery(api.chat.getMessages, roomId ? { roomId } : "skip");
  const sendMessage = useMutation(api.chat.sendMessage);

  const currentUser = useQuery(api.auth.loggedInUser);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      await sendMessage({ message: newMessage, roomId: roomId });
      setNewMessage("");
      inputRef.current?.focus();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const onEnterPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleSend();
    }
  };

  if (messages === undefined) {
    return <p>Loading messages...</p>;
  }

  return (
    <div className="flex flex-col h-96 border rounded shadow p-4 bg-white max-w-md mx-auto">
      <div className="flex-1 overflow-y-auto mb-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-400">No messages yet.</div>
        )}
        {messages.map((msg) => (
          <div
            key={msg._id}
            className={`${
              msg.userId === currentUser?._id // replace with actual current user id for styling
                ? "text-right"
                : "text-left"
            }`}
          >
            <div
              className={`inline-block px-3 py-1 rounded ${
                msg.userId === currentUser?._id
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              <div className="text-xs font-semibold">{msg.userName}</div>
              <div>{msg.message}</div>
              <div className="text-xs text-gray-500">
                {new Date(msg.sentAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex space-x-2">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={onEnterPress}
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}
