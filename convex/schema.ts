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
    type: v.union(v.literal("emoji"), v.literal("sticker")),
    content: v.string(), // emoji character or sticker image URL
    sentAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_time", ["roomId", "sentAt"]),

  playerScores: defineTable({
    playerId: v.id("users"), // or user ID if you have auth
    username: v.string(),
    score: v.number(), // total accumulated score
  }).index("by_player", ["playerId"]),

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    //custom fields
    score: v.optional(v.number()),
  }),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
