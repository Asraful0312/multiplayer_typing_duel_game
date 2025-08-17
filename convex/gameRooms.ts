import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { getAccuracy, getWPM } from "./../src/lib/game";
import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { Triggers } from "convex-helpers/server/triggers";

const PHRASES = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "Bright vixens jump; dozy fowl quack",
  "Sphinx of black quartz, judge my vow",
  "Two driven jocks help fax my big quiz",
  "Five quacking zephyrs jolt my wax bed",
  "The five boxing wizards jump quickly",
  "Jackdaws love my big sphinx of quartz",
  "Mr. Jock, TV quiz PhD., bags few lynx",
];

export const aggregateByScore = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "leaderboard";
}>(components.aggregateByScore, {
  sortKey: (leaderboardTableDoc) => -(leaderboardTableDoc?.score ?? 0),
});

const triggers = new Triggers<DataModel>();
triggers.register("leaderboard", aggregateByScore.trigger());

export const pageOfScores = query({
  args: {
    offset: v.number(),
    numItems: v.number(),
  },
  handler: async (ctx, { offset, numItems }) => {
    const firstInPage = await aggregateByScore.at(ctx, offset);

    console.log("1 pase", firstInPage);

    const page = await aggregateByScore.paginate(ctx, {
      bounds: {
        lower: {
          key: firstInPage.key,
          id: firstInPage.id,
          inclusive: true,
        },
      },
      pageSize: numItems,
    });

    const scores = await Promise.all(
      page.page.map((doc) => ctx.db.get(doc.id))
    );

    return scores.filter((d) => d != null);
  },
});

const mutationWithTriggers = customMutation(
  mutation,
  customCtx(triggers.wrapDB)
);

export const getGameHistory = query({
  args: { roomId: v.id("gameRooms") },
  handler: async ({ db }, { roomId }) => {
    return await db
      .query("gameHistory")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
  },
});

export const gameHistory = action({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runQuery(api.gameRooms.getGameHistory, {
      roomId: args.roomId,
    });
  },
});

async function requireAuth(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required");
  }
  return userId;
}

export const createRoom = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate a 4-character room code
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    const roomId = await ctx.db.insert("gameRooms", {
      roomCode,
      gameState: "waiting",
      createdAt: Date.now(),
    });

    await ctx.db.insert("players", {
      roomId,
      userId,
      name: user.name || user.email || "Anonymous",
      progress: "",
      isReady: false,
    });

    return { roomId, roomCode };
  },
});

export const joinRoom = mutation({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const room = await ctx.db
      .query("gameRooms")
      .withIndex("by_room_code", (q) => q.eq("roomCode", args.roomCode))
      .unique();

    if (!room) {
      throw new Error("Room not found");
    }

    // Check if user is already in the room
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", userId).eq("roomId", room._id)
      )
      .unique();

    if (existingPlayer) {
      return { roomId: room._id, roomCode: room.roomCode };
    }

    // Check if room is full
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    if (players.length >= 2) {
      throw new Error("Room is full");
    }

    await ctx.db.insert("players", {
      roomId: room._id,
      userId,
      name: user.name || user.email || "Anonymous",
      progress: "",
      isReady: false,
    });

    return { roomId: room._id, roomCode: room.roomCode };
  },
});

export const getRoomState = query({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      return null;
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const currentPlayer = players.find((p) => p.userId === userId);

    return {
      room,
      players,
      currentPlayer,
      isCurrentUserInRoom: !!currentPlayer,
    };
  },
});

export const toggleReady = mutation({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const player = await ctx.db
      .query("players")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", userId).eq("roomId", args.roomId)
      )
      .unique();

    if (!player) {
      throw new Error("Player not found in room");
    }

    await ctx.db.patch(player._id, {
      isReady: !player.isReady,
    });

    // Check if both players are ready
    const allPlayers = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    if (allPlayers.length === 2 && allPlayers.every((p) => p.isReady)) {
      // Start the game
      const randomPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];

      await ctx.db.patch(args.roomId, {
        gameState: "playing",
        currentPhrase: randomPhrase,
        winner: undefined,
      });

      // Reset all players' progress and start their timers
      const gameStartTime = Date.now();
      for (const player of allPlayers) {
        await ctx.db.patch(player._id, {
          progress: "",
          wpm: undefined,
          accuracy: undefined,
          startTime: gameStartTime,
          completionTime: undefined,
        });
      }
    }
  },
});

export const updateProgress = mutationWithTriggers({
  args: {
    roomId: v.id("gameRooms"),
    progress: v.string(),
    phrase: v.optional(v.string()),
    wpm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const room = await ctx.db.get(args.roomId);
    if (!room || room.gameState !== "playing") return;

    const player = await ctx.db
      .query("players")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", userId).eq("roomId", args.roomId)
      )
      .unique();

    if (!player) throw new Error("Player not found in room");

    // Update current player's progress, wpm, accuracy
    await ctx.db.patch(player._id, {
      progress: args.progress,
      accuracy: getAccuracy(args.progress, args.phrase as string),
      wpm: args.wpm,
    });

    // Check if current player completed the phrase
    if (room.currentPhrase && args.progress === room.currentPhrase) {
      const completionTime = Date.now();

      // Winner's completion time
      await ctx.db.patch(player._id, { completionTime });

      // Find the loser
      const otherPlayers = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();

      const loser = otherPlayers.find((p) => p.userId !== userId);
      if (loser) {
        await ctx.db.patch(loser._id, {
          wpm:
            loser.wpm ??
            getWPM(loser.progress, loser.startTime as number, Date.now()),
          accuracy:
            loser.accuracy ?? getAccuracy(loser.progress, room.currentPhrase),
          completionTime: loser.completionTime ?? Date.now(),
        });
      }

      // Mark room finished & winner
      await ctx.db.patch(args.roomId, {
        gameState: "finished",
        winner: userId,
      });

      // Save game history with both winner & loser data
      const updatedPlayers = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();

      await ctx.db.insert("gameHistory", {
        roomId: args.roomId,
        endedAt: completionTime,
        winnerId: userId,
        players: updatedPlayers.map((p) => ({
          userId: p.userId,
          name: p.name,
          wpm: p.wpm,
          accuracy: p.accuracy,
          completionTime: p.completionTime,
        })),
      });
    }
  },
});

export const startNewRound = mutationWithTriggers({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    // Reset room state
    await ctx.db.patch(args.roomId, {
      gameState: "waiting",
      currentPhrase: undefined,
      winner: undefined,
    });

    // Reset all players
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const player of players) {
      await ctx.db.patch(player._id, {
        progress: "",
        isReady: false,
        wpm: undefined,
        accuracy: undefined,
        startTime: undefined,
        completionTime: undefined,
      });
    }
  },
});

export const leaveRoom = mutationWithTriggers({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await requireAuth(ctx);

    // 1) Find and delete the player's row (if exists)
    const player = await ctx.db
      .query("players")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", userId).eq("roomId", roomId)
      )
      .unique();

    if (player) {
      await ctx.db.delete(player._id);
    }

    // 2) Check remaining players in room (use index)
    const remainingPlayers = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    if (remainingPlayers.length > 0) {
      // other players still present -> do not clean up room
      return;
    }

    // 3) No players left -> delete chats, history, and the room
    const chats = await ctx.db
      .query("gameChats")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    for (const c of chats) {
      await ctx.db.delete(c._id);
    }

    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    for (const h of history) {
      await ctx.db.delete(h._id);
    }

    // Finally delete the room itself
    await ctx.db.delete(roomId);
  },
});

export const completeGame = mutation({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.gameState !== "playing") return;

    // Mark game as finished and set winner (if not already set)
    await ctx.db.patch(roomId, {
      gameState: "finished",
      // Add any other completion logic here
    });

    // Update scores if there's a winner
    if (room.winner) {
      await ctx.scheduler.runAfter(0, api.leaderboard.updatePlayerScore, {
        playerId: room.winner,
        outcome: "win",
      });

      const players = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .collect();

      const loser = players.find((p) => p.userId !== room.winner);
      if (loser) {
        await ctx.scheduler.runAfter(0, api.leaderboard.updatePlayerScore, {
          playerId: loser.userId,
          outcome: "lose",
        });
      }
    }
  },
});
