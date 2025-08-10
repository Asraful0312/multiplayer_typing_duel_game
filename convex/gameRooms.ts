import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

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

export const updateProgress = mutation({
  args: {
    roomId: v.id("gameRooms"),
    progress: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const room = await ctx.db.get(args.roomId);
    if (!room || room.gameState !== "playing") {
      return;
    }

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
      progress: args.progress,
    });

    // Check if player completed the phrase
    if (room.currentPhrase && args.progress === room.currentPhrase) {
      const completionTime = Date.now();

      // Update player's completion time
      await ctx.db.patch(player._id, {
        completionTime,
      });

      // Mark game as finished and set winner
      await ctx.db.patch(args.roomId, {
        gameState: "finished",
        winner: userId,
      });

      // Insert game history record
      const players = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();

      await ctx.db.insert("gameHistory", {
        roomId: args.roomId,
        endedAt: completionTime,
        winnerId: userId,
        players: players.map((p) => ({
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

export const startNewRound = mutation({
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
