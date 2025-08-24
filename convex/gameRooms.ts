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

async function requireAuth(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required");
  }
  return userId;
}

// Create room with public/private option
export const createRoom = mutation({
  args: {
    roomType: v.union(v.literal("public"), v.literal("private")),
    roomName: v.optional(v.string()), // Required for public rooms
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate a 4-character room code
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    const roomId = await ctx.db.insert("gameRooms", {
      roomCode,
      roomType: args.roomType,
      roomName: args.roomName,
      hostId: userId,
      gameState: "waiting",
      createdAt: Date.now(),
      isActive: true,
    });

    await ctx.db.insert("players", {
      roomId,
      userId,
      name: user.name || user.email || "Anonymous",
      progress: "",
      isReady: false,
      isHost: true,
    });

    return { roomId, roomCode };
  },
});

// Get list of public rooms
export const getPublicRooms = query({
  args: {},
  handler: async (ctx) => {
    const publicRooms = await ctx.db
      .query("gameRooms")
      .withIndex("by_room_type", (q) => q.eq("roomType", "public"))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get player counts for each room
    const roomsWithPlayerCounts = await Promise.all(
      publicRooms.map(async (room) => {
        const players = await ctx.db
          .query("players")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();

        if (!room.hostId) {
          throw new Error("Host not found");
        }

        const host = await ctx.db.get(room.hostId);

        return {
          ...room,
          playerCount: players.length,
          hostName: host?.name || host?.email || "Anonymous",
        };
      })
    );

    return roomsWithPlayerCounts.filter((room) => room.playerCount < 2);
  },
});

// Request to join a public room
export const requestToJoinRoom = mutation({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.roomType !== "public") {
      throw new Error("Room not found or not public");
    }

    // Check if already requested
    const existingRequest = await ctx.db
      .query("joinRequests")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("requesterId"), userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .unique();

    if (existingRequest) {
      throw new Error("Join request already pending");
    }

    // Check if already in room
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", userId).eq("roomId", args.roomId)
      )
      .unique();

    if (existingPlayer) {
      throw new Error("Already in this room");
    }

    await ctx.db.insert("joinRequests", {
      roomId: args.roomId,
      requesterId: userId,
      requesterName: user.name || user.email || "Anonymous",
      status: "pending",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Get join requests for a room (host only)
export const getJoinRequests = query({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const room = await ctx.db.get(args.roomId);
    if (!room || room.hostId !== userId) {
      throw new Error("Not authorized to view join requests");
    }

    return await ctx.db
      .query("joinRequests")
      .withIndex("by_room_and_status", (q) =>
        q.eq("roomId", args.roomId).eq("status", "pending")
      )
      .collect();
  },
});

// Accept/reject join request (host only)
export const handleJoinRequest = mutation({
  args: {
    requestId: v.id("joinRequests"),
    action: v.union(v.literal("accept"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Join request not found");
    }

    const room = await ctx.db.get(request.roomId);
    if (!room || room.hostId !== userId) {
      throw new Error("Not authorized to handle this request");
    }

    if (args.action === "accept") {
      // Check if room is still available
      const players = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", request.roomId))
        .collect();

      if (players.length >= 2) {
        throw new Error("Room is now full");
      }

      // Add player to room
      await ctx.db.insert("players", {
        roomId: request.roomId,
        userId: request.requesterId,
        name: request.requesterName,
        progress: "",
        isReady: false,
        isHost: false,
      });
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: args.action === "accept" ? "accepted" : "rejected",
    });

    return { success: true, roomId: request.roomId };
  },
});

// Modified joinRoom for private rooms
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

    // Only allow direct joining for private rooms
    if (room.roomType === "public") {
      throw new Error(
        "Cannot join public room directly. Please request to join."
      );
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
      isHost: false,
    });

    return { roomId: room._id, roomCode: room.roomCode };
  },
});

// Get user's join request status for a specific room
export const getUserJoinRequestStatus = query({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const joinRequest = await ctx.db
      .query("joinRequests")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("requesterId"), userId))
      .order("desc") // Get the most recent request
      .first();

    if (!joinRequest) {
      return null;
    }

    return {
      _id: joinRequest._id,
      status: joinRequest.status,
      createdAt: joinRequest.createdAt,
    };
  },
});

export const getUserJoinRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const joinRequests = await ctx.db
      .query("joinRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", userId))
      .order("desc")
      .collect();

    return joinRequests.map((request) => ({
      _id: request._id,
      roomId: request.roomId,
      status: request.status,
      createdAt: request.createdAt,
      redirected: request.redirected || false,
    }));
  },
});

// Rest of your existing functions remain the same...
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

    // Get join requests if user is host
    let joinRequests: any = [];
    if (room.hostId === userId && room.roomType === "public") {
      joinRequests = await ctx.db
        .query("joinRequests")
        .withIndex("by_room_and_status", (q) =>
          q.eq("roomId", args.roomId).eq("status", "pending")
        )
        .collect();
    }

    return {
      room,
      players,
      currentPlayer,
      joinRequests,
      isCurrentUserInRoom: !!currentPlayer,
      isHost: currentPlayer?.isHost || false,
    };
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("gameRooms") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Find the player in the room
    const player = await ctx.db
      .query("players")
      .withIndex("by_user_and_room", (q) =>
        q.eq("userId", userId).eq("roomId", args.roomId)
      )
      .unique();

    if (!player) {
      // Already left
      return;
    }

    // Remove the player
    await ctx.db.delete(player._id);

    // Check if the room is now empty
    const remainingPlayers = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    if (remainingPlayers.length === 0) {
      // Room is empty - delete everything
      const requests = await ctx.db
        .query("joinRequests")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
        .collect();
      await Promise.all(requests.map((req) => ctx.db.delete(req._id)));
      await ctx.db.delete(args.roomId);
    } else {
      // If the leaving player was the host, assign a new host
      if (player.isHost) {
        // Assign the first remaining player as the new host
        const newHost = remainingPlayers[0];
        await ctx.db.patch(newHost._id, { isHost: true });

        // *** THIS IS THE CRITICAL FIX ***
        // Update the room's hostId to point to the new host
        await ctx.db.patch(args.roomId, { hostId: newHost.userId });
      }
    }
  },
});

export const getRoom = query({
  args: {
    roomId: v.id("gameRooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    return room;
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
