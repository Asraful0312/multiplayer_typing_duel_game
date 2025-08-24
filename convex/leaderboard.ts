// convex/leaderboard.ts
import { maskEmail } from "../src/lib/game";
import { api, components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import { TableAggregate } from "@convex-dev/aggregate";
import { v } from "convex/values";

type UpdateResult = {
  playerId: string;
  outcome: "win" | "lose";
  score: number;
  wins?: number;
  losses?: number;
  totalGames?: number;
};

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
    playerCount: v.optional(v.number()), // Total players in the game
    placement: v.optional(v.number()), // Player's placement (1st, 2nd, etc.)
  },
  handler: async (
    ctx,
    { playerId, outcome, playerCount = 2, placement = 1 }
  ) => {
    const existing = await ctx.db.get(playerId);

    // Calculate score change based on outcome and game size
    let scoreChange = 0;
    let coins = 0;

    if (outcome === "win") {
      // Winner gets more points in larger games
      const baseWinPoints = 10;
      const bonusForGameSize = Math.max(0, (playerCount - 2) * 2); // +2 points per extra player
      scoreChange = baseWinPoints + bonusForGameSize;

      // Winner gets more coins in larger games
      const baseCoinReward = 20;
      const bonusCoinReward = Math.max(0, (playerCount - 2) * 5); // +5 coins per extra player
      coins = baseCoinReward + bonusCoinReward;
    } else if (outcome === "lose") {
      // Losers get penalty, but less harsh in larger games
      const baseLosePenalty = -5;
      // Reduce penalty in larger games (more competition = less harsh)
      const penaltyReduction = Math.min(3, Math.max(0, (playerCount - 2) * 1));
      scoreChange = baseLosePenalty + penaltyReduction;

      // Losers get small participation reward in larger games
      const participationCoins =
        playerCount > 2 ? Math.min(5, playerCount - 2) : 0;
      coins = participationCoins;
    }

    // Calculate stat changes
    let winsChange = 0;
    let lossesChange = 0;
    if (outcome === "win") winsChange = 1;
    if (outcome === "lose") lossesChange = 1;

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
      const initialCoins = Math.max(coins, 0);

      await ctx.db.patch(playerId, {
        score: finalScore,
        wins: initialWins,
        losses: initialLosses,
        totalGames: 1,
        coins: initialCoins,
      });

      // Get the updated document and insert into aggregate
      const updatedDoc = await ctx.db.get(playerId);
      if (updatedDoc) {
        await userScoreAggregate.insert(ctx, updatedDoc);
      }
    }

    return {
      scoreChange,
      coinsEarned: coins,
      newScore: existing
        ? Math.max((existing?.score || 0) + scoreChange, 0)
        : Math.max(scoreChange, 0),
      newCoins: existing ? (existing?.coins || 0) + coins : Math.max(coins, 0),
    };
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
          name: user.name || (user.email ? maskEmail(user.email) : "Anonymous"),
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

// Helper function to update scores for all players after a multiplayer game
export const updateMultiplayerGameScores = mutation({
  args: {
    winnerId: v.id("users"),
    allPlayerIds: v.array(v.id("users")),
  },
  handler: async (ctx, { winnerId, allPlayerIds }): Promise<UpdateResult[]> => {
    const playerCount = allPlayerIds.length;
    const results: UpdateResult[] = [];

    // Update winner
    const winnerResult = await ctx.runMutation(
      api.leaderboard.updatePlayerScore,
      {
        playerId: winnerId,
        outcome: "win",
        playerCount,
        placement: 1,
      }
    );
    results.push({
      playerId: winnerId,
      outcome: "win",
      ...winnerResult,
      score: 0,
    });

    // Update all losers
    for (const playerId of allPlayerIds) {
      if (playerId !== winnerId) {
        const loserResult = await ctx.runMutation(
          api.leaderboard.updatePlayerScore,
          {
            playerId,
            outcome: "lose",
            playerCount,
          }
        );
        results.push({
          playerId,
          outcome: "lose",
          ...loserResult,
          score: 0,
        });
      }
    }

    return results;
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
