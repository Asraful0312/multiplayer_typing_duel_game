import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const updatePlayerScore = mutation({
  args: {
    playerId: v.id("users"),
    outcome: v.string(), // "win" or "lose"
  },
  handler: async ({ db }, { playerId, outcome }) => {
    const existing = await db.get(playerId);

    let change = 0;
    if (outcome === "win") change = 10;
    if (outcome === "lose") change = -5;

    let newScore = change;
    if (existing) {
      newScore = (existing?.score || 0) + change;
      if (newScore < 0) newScore = 0; // prevent negative score

      await db.patch(existing._id, { score: newScore });
    } else {
      await db.patch(playerId, { score: Math.max(newScore, 0) });
    }
  },
});
