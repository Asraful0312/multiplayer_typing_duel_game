// convex/leaderboard.ts
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import { TableAggregate } from "@convex-dev/aggregate";
import { v } from "convex/values";

// Define the aggregate for user scores
const userScoreAggregate = new TableAggregate<{
  Key: number; // score value
  DataModel: DataModel;
  TableName: "users";
}>(components.aggregateByScore, {
  sortKey: (doc) => doc.score || 0, // Sort by score
  sumValue: (doc) => doc.score || 0, // Sum value for calculations
});
// Your existing function modified to work with aggregate
export const updatePlayerScore = mutation({
  args: {
    playerId: v.id("users"),
    outcome: v.string(), // "win" or "lose"
  },
  handler: async (ctx, { playerId, outcome }) => {
    const existing = await ctx.db.get(playerId);

    // Calculate score change
    let scoreChange = 0;
    if (outcome === "win") scoreChange = 10;
    if (outcome === "lose") scoreChange = -5;

    // Calculate stat changes
    let winsChange = 0;
    let lossesChange = 0;
    if (outcome === "win") winsChange = 1;
    if (outcome === "lose") lossesChange = 1;

    let coins = 0;
    if (outcome === "win") coins = 20;

    if (existing) {
      const newScore = Math.max((existing?.score || 0) + scoreChange, 0);
      const newWins = (existing?.wins || 0) + winsChange;
      const newLosses = (existing?.losses || 0) + lossesChange;
      const newCoins = (existing?.coins || 0) + coins;
      const newTotalGames = (existing?.totalGames || 0) + 1;

      // Store old document for aggregate update
      const oldDoc = { ...existing };

      // Update the database with all new values
      await ctx.db.patch(existing._id, {
        score: newScore,
        wins: newWins,
        losses: newLosses,
        totalGames: newTotalGames,
        coins: newCoins,
      });

      // Get updated document
      const updatedDoc = await ctx.db.get(existing._id);

      // Update the aggregate
      if (oldDoc.score !== undefined) {
        // Replace existing score in aggregate
        await userScoreAggregate.replace(ctx, oldDoc, updatedDoc!);
      } else {
        // Insert new score into aggregate (first time user gets a score)
        await userScoreAggregate.insert(ctx, updatedDoc!);
      }
    } else {
      // This case shouldn't happen if playerId exists, but handle it
      const finalScore = Math.max(scoreChange, 0);
      const initialWins = outcome === "win" ? 1 : 0;
      const initialLosses = outcome === "lose" ? 1 : 0;

      await ctx.db.patch(playerId, {
        score: finalScore,
        wins: initialWins,
        losses: initialLosses,
        totalGames: 1,
      });

      // Get the updated document and insert into aggregate
      const updatedDoc = await ctx.db.get(playerId);
      if (updatedDoc) {
        await userScoreAggregate.insert(ctx, updatedDoc);
      }
    }
  },
});

// Get leaderboard using the aggregate
export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    // Get total count of users with scores
    const totalUsers = await userScoreAggregate.count(ctx);

    if (totalUsers === 0) {
      return [];
    }

    // Get top 10 users by iterating from highest scores
    const leaderboard = [];
    const maxUsers = Math.min(10, totalUsers);

    for (let i = 0; i < maxUsers; i++) {
      const { key: _, id } = await userScoreAggregate.at(
        ctx,
        totalUsers - 1 - i
      );
      const user = await ctx.db.get(id);

      if (user && user.score !== undefined) {
        leaderboard.push({
          rank: i + 1,
          userId: user._id,
          name: user.name || user.email || "Anonymous",
          image: user.image,
          score: user.score,
          wins: user.wins,
          losses: user.losses,
          totalGames: user.totalGames,
        });
      }
    }

    return leaderboard;
  },
});

// Get user's rank
export const getUserRank = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);

    if (!user || user.score === undefined) {
      return null;
    }

    // Get the user's rank by counting how many users have higher scores
    const higherScoreCount = await userScoreAggregate.count(ctx, {
      bounds: {
        lower: { key: user.score, inclusive: false },
      },
    });

    const totalUsers = await userScoreAggregate.count(ctx);

    return {
      rank: higherScoreCount + 1,
      score: user.score,
      totalPlayers: totalUsers,
    };
  },
});

// Helper function to update user score
export const updateUserScore = mutation({
  args: { userId: v.id("users"), newScore: v.number() },
  handler: async (ctx, { userId, newScore }) => {
    const oldUser = await ctx.db.get(userId);

    if (!oldUser) {
      throw new Error("User not found");
    }

    // Update the user's score
    await ctx.db.patch(userId, { score: newScore });
    const updatedUser = await ctx.db.get(userId);

    // Update the aggregate
    if (oldUser.score !== undefined) {
      // Replace existing score in aggregate
      await userScoreAggregate.replace(ctx, oldUser, updatedUser!);
    } else {
      // Insert new score into aggregate
      await userScoreAggregate.insert(ctx, updatedUser!);
    }

    return updatedUser;
  },
});

// Initialize aggregate for existing users (run this once as a migration)
export const backfillAggregate = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing aggregate data
    await userScoreAggregate.clear(ctx);

    // Get all users with scores
    const users = await ctx.db.query("users").collect();

    // Insert users with scores into aggregate
    for (const user of users) {
      if (user.score !== undefined) {
        await userScoreAggregate.insertIfDoesNotExist(ctx, user);
      }
    }

    return { processed: users.length };
  },
});
