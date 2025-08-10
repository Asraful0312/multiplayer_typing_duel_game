import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Send a chat message
export const sendMessage = mutation({
  args: { roomId: v.id("gameRooms"), message: v.string() },
  handler: async (ctx, { roomId, message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.insert("gameChats", {
      roomId,
      userId,
      userName: user.name || user.email || "Anonymous",
      message,
      sentAt: Date.now(),
    });
  },
});

// Get messages for a room (with real-time updates)
export const getMessages = query({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("gameChats")
      .withIndex("by_room_and_time", (q) => q.eq("roomId", roomId))
      .order("asc")
      .collect();
  },
});
