import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all store items
export const getStoreItems = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("storeItems")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get user's inventory
export const getUserInventory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const inventoryItems = await ctx.db
      .query("inventory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get full item details for each inventory item
    const itemsWithDetails = await Promise.all(
      inventoryItems.map(async (invItem) => {
        const storeItem = await ctx.db.get(invItem.itemId);
        return {
          ...invItem,
          item: storeItem,
        };
      })
    );

    return itemsWithDetails;
  },
});

// Purchase an item
export const purchaseItem = mutation({
  args: {
    userId: v.id("users"),
    itemId: v.id("storeItems"),
  },
  handler: async (ctx, { userId, itemId }) => {
    // Get user and item
    const user = await ctx.db.get(userId);
    const item = await ctx.db.get(itemId);

    if (!user || !item) {
      throw new Error("User or item not found");
    }

    // Check if user has enough score
    const userCoins = user.coins || 0;
    if (userCoins < item.price) {
      throw new Error("Insufficient coins to purchase this item");
    }

    // Check if user already owns this item (for non-consumable items)
    const existingItem = await ctx.db
      .query("inventory")
      .withIndex("by_user_and_item", (q) =>
        q.eq("userId", userId).eq("itemId", itemId)
      )
      .first();

    if (existingItem && item.type === "sticker") {
      throw new Error("You already own this sticker");
    }

    // Deduct coins from user
    const newCoins = userCoins - item.price;
    await ctx.db.patch(userId, { coins: newCoins });

    // Add item to inventory
    if (existingItem && item.category === "consumables") {
      // If it's a consumable and user already has it, increase quantity
      await ctx.db.patch(existingItem._id, {
        quantity: (existingItem.quantity || 1) + 1,
      });
    } else {
      // Add new item to inventory
      await ctx.db.insert("inventory", {
        userId,
        itemId,
        purchasedAt: Date.now(),
        isEquip: true,
        quantity: item.category === "consumables" ? 1 : undefined,
      });
    }

    // Record transaction
    await ctx.db.insert("transactions", {
      userId,
      itemId,
      amount: -item.price,
      type: "purchase",
      createdAt: Date.now(),
    });

    return { success: true, newCoins };
  },
});

// Check if user owns an item
export const checkOwnership = query({
  args: {
    userId: v.id("users"),
    itemId: v.id("storeItems"),
  },
  handler: async (ctx, { userId, itemId }) => {
    const inventoryItem = await ctx.db
      .query("inventory")
      .withIndex("by_user_and_item", (q) =>
        q.eq("userId", userId).eq("itemId", itemId)
      )
      .first();

    return !!inventoryItem;
  },
});

// Get user's owned stickers for the emoji sender
export const getUserStickers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const inventoryItems = await ctx.db
      .query("inventory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isEquip"), true))
      .collect();

    // Get sticker items only
    const stickerItems = await Promise.all(
      inventoryItems.map(async (invItem) => {
        const storeItem = await ctx.db.get(invItem.itemId);
        if (storeItem && storeItem.type === "sticker") {
          return storeItem;
        }
        return null;
      })
    );

    return stickerItems.filter(Boolean);
  },
});

// Add this mutation to your store.ts file to populate the store
export const seedStoreItems = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing items first (optional)
    const existingItems = await ctx.db.query("storeItems").collect();
    for (const item of existingItems) {
      await ctx.db.delete(item._id);
    }

    // Insert the store items
    const storeItems = [
      {
        name: "Zarek tia Sticker",
        category: "stickers",
        price: 2500,
        rarity: "legendary",
        description: "A legendary sticker of zarek tia AKA deso neta",
        image:
          "https://media.tenor.com/Er_DtkmQZ8wAAAAe/zarek-tia-tareq-zia.png",
        type: "sticker" as const,
        content:
          "https://media.tenor.com/Er_DtkmQZ8wAAAAe/zarek-tia-tareq-zia.png",
        stats: { type: "Sticker", effect: "10%" },
        isActive: true,
      },
      {
        name: "Hero Alom Sticker",
        category: "stickers",
        price: 1800,
        rarity: "epic",
        description: "Sticker of the one and only mighty hero alom",
        image:
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSlVG4sfVEY5P7f574KAUHX_9k8Ji3-nJB9g&s",
        type: "sticker" as const,
        content:
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSlVG4sfVEY5P7f574KAUHX_9k8Ji3-nJB9g&s",
        stats: { type: "Sticker" },
        isActive: true,
      },
      {
        name: "Sefuda Sticker",
        category: "consumables",
        price: 150,
        rarity: "common",
        description: "কি খবর গোরিবের দল, টাকা লাগবে?",
        image:
          "https://www.observerbd.com/2019/11/20/observerbd.com_1574271452.jpg",
        type: "sticker" as const,
        content:
          "https://www.observerbd.com/2019/11/20/observerbd.com_1574271452.jpg",
        stats: { effect: "Speed +50%", duration: "30s" },
        isActive: true,
      },
      {
        name: "Mujib Sticker",
        category: "stickers",
        price: 1200,
        rarity: "rare",
        description: "Sticker of the Father of the Nation",
        image:
          "https://bongoboltu.com/content/images/size/w720/2023/08/mujibba.jpg",
        type: "sticker" as const,
        content:
          "https://bongoboltu.com/content/images/size/w720/2023/08/mujibba.jpg",
        stats: { type: "Sticker" },
        isActive: true,
      },
    ];

    for (const item of storeItems) {
      await ctx.db.insert("storeItems", item);
    }

    return { success: true, itemsAdded: storeItems.length };
  },
});

export const toggleEquipItem = mutation({
  args: {
    inventoryId: v.id("inventory"),
    isEquip: v.boolean(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.patch(args.inventoryId, { isEquip: args.isEquip });
    return id;
  },
});

// Run this once to populate your store:
// You can call this from your frontend or run it in the Convex dashboard
