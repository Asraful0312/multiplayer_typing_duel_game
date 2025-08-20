import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// convex/players.ts
export const getCurrentRoomId = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const player = await ctx.db
      .query("players")
      .withIndex("by_user_and_room", (q) => q.eq("userId", userId))
      .first();

    return player ? player.roomId : null;
  },
});
