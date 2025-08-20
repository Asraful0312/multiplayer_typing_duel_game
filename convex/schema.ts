import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  storeItems: defineTable({
    name: v.string(),
    category: v.string(),
    price: v.number(),
    rarity: v.string(),
    description: v.string(),
    image: v.string(),
    type: v.union(v.literal("emoji"), v.literal("sticker")),
    content: v.string(), // emoji character or sticker URL
    stats: v.optional(
      v.object({
        type: v.optional(v.string()),
        effect: v.optional(v.string()),
        duration: v.optional(v.string()),
      })
    ),
    isActive: v.optional(v.boolean()), // to enable/disable items
  }).index("by_category", ["category"]),

  inventory: defineTable({
    userId: v.id("users"),
    itemId: v.id("storeItems"),
    purchasedAt: v.number(),
    isEquip: v.optional(v.boolean()),
    quantity: v.optional(v.number()), // for consumable items
  })
    .index("by_user", ["userId"])
    .index("by_user_and_item", ["userId", "itemId"]),

  transactions: defineTable({
    userId: v.id("users"),
    itemId: v.id("storeItems"),
    amount: v.number(), // negative for purchases
    type: v.union(v.literal("purchase"), v.literal("refund")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  gameRooms: defineTable({
    roomCode: v.string(),
    roomType: v.optional(v.union(v.literal("public"), v.literal("private"))), // NEW: room type
    roomName: v.optional(v.string()), // NEW: display name for public rooms
    hostId: v.optional(v.id("users")), // NEW: room host/creator
    currentPhrase: v.optional(v.string()),
    gameState: v.union(
      v.literal("waiting"),
      v.literal("ready"),
      v.literal("playing"),
      v.literal("finished")
    ),
    winner: v.optional(v.id("users")),
    createdAt: v.number(),
    isActive: v.optional(v.boolean()), // NEW: to hide/show public rooms
  })
    .index("by_room_code", ["roomCode"])
    .index("by_room_type", ["roomType"]) // NEW: index for public rooms
    .index("by_host", ["hostId"]), // NEW: index for host operations

  // NEW: Join requests for public rooms
  joinRequests: defineTable({
    roomId: v.id("gameRooms"),
    requesterId: v.id("users"),
    requesterName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    redirected: v.optional(v.boolean()), // Add this field
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_requester", ["requesterId"])
    .index("by_room_and_status", ["roomId", "status"]),

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
    isHost: v.optional(v.boolean()), // NEW: identify room host
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
    wins: v.optional(v.number()),
    losses: v.optional(v.number()),
    totalGames: v.optional(v.number()),
    coins: v.optional(v.number()),
  }),

  leaderboard: defineTable({
    name: v.string(),
    score: v.number(),
  }),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
