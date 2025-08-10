import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  gameRooms: defineTable({
    roomCode: v.string(),
    currentPhrase: v.optional(v.string()),
    gameState: v.union(
      v.literal("waiting"),
      v.literal("ready"),
      v.literal("playing"),
      v.literal("finished")
    ),
    winner: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_room_code", ["roomCode"]),

  players: defineTable({
    roomId: v.id("gameRooms"),
    userId: v.id("users"),
    name: v.string(),
    progress: v.string(),
    isReady: v.boolean(),
    wpm: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    startTime: v.optional(v.number()),
    completionTime: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_user_and_room", ["userId", "roomId"]),

  gameHistory: defineTable({
    roomId: v.id("gameRooms"),
    endedAt: v.number(), // timestamp when game ended
    winnerId: v.optional(v.id("users")),
    players: v.array(
      v.object({
        userId: v.id("users"),
        name: v.string(),
        wpm: v.optional(v.number()),
        accuracy: v.optional(v.number()),
        completionTime: v.optional(v.number()),
      })
    ),
  }).index("by_room", ["roomId"]),

  gameChats: defineTable({
    roomId: v.id("gameRooms"),
    userId: v.id("users"),
    userName: v.string(),
    message: v.string(),
    sentAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_time", ["roomId", "sentAt"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
