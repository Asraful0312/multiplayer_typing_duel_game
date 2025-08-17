/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Package, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import CurrencyIcon from "@/shared/CurrencyIcon";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const categories = [{ id: "all", name: "All Items", icon: Package }];

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case "legendary":
      return "bg-gradient-to-r from-yellow-400 to-orange-500 text-white";
    case "epic":
      return "bg-gradient-to-r from-purple-500 to-pink-500 text-white";
    case "rare":
      return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

export default function Store() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const currentUser = useQuery(api.auth.loggedInUser, {});

  // Queries
  const storeItems = useQuery(api.store.getStoreItems, {});
  const userInventory = useQuery(
    api.store.getUserInventory,
    currentUser?._id ? { userId: currentUser?._id } : "skip"
  );

  // Mutations
  const purchaseItem = useMutation(api.store.purchaseItem);

  const filteredItems =
    storeItems?.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    }) || [];

  const handlePurchase = async (
    itemId: Id<"storeItems">,
    itemPrice: number,
    itemName: string
  ) => {
    if (!currentUser?._id) {
      toast.error("Please log in to make purchases");
      return;
    }

    if (!currentUser?.coins || currentUser.coins < itemPrice) {
      toast.error("Insufficient score to purchase this item");
      return;
    }

    try {
      await purchaseItem({ userId: currentUser?._id, itemId });
      toast.success(`Successfully purchased ${itemName}!`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to purchase item"
      );
    }
  };

  const isItemOwned = (itemId: string) => {
    return userInventory?.some((inv) => inv.itemId === itemId) || false;
  };

  if (!storeItems) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-7">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {categories.map((category) => {
              const IconComponent = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={
                    selectedCategory === category.id ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="gap-2 whitespace-nowrap hover:bg-secondary"
                >
                  <IconComponent className="w-4 h-4" />
                  {category.name}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 font-bold text-[#003049]">
          Balance:
          <CurrencyIcon />
          {currentUser?.coins?.toLocaleString() || 0}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => {
            const owned = isItemOwned(item._id);
            const canAfford = currentUser?.coins || 0 >= item.price;
            console.log("can afford", canAfford);
            return (
              <Card
                key={item._id}
                className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <img
                      className="size-20 shrink-0 object-cover rounded"
                      src={item.image}
                      alt={item.name}
                    />
                    <div className="flex flex-col gap-2">
                      <Badge className={getRarityColor(item.rarity)}>
                        {item.rarity}
                      </Badge>
                      {owned && (
                        <Badge className="bg-green-500 text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Owned
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Stats */}
                  {item.stats && (
                    <div className="space-y-2">
                      {Object.entries(item.stats).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">
                            {key.replace("_", " ")}:
                          </span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Price and Purchase Button */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-xl font-bold text-[#003049] flex items-center gap-2">
                      <CurrencyIcon />
                      {item.price.toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        handlePurchase(item._id, item.price, item.name)
                      }
                      disabled={owned || !canAfford || !currentUser?._id}
                      className="gap-2"
                      variant={owned ? "secondary" : "default"}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {owned
                        ? "Owned"
                        : currentUser?.coins || 0 < item?.price
                          ? "Can't Afford"
                          : "Buy now"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* No Results */}
        {filteredItems.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No items found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or category filter
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm">
          Showing {filteredItems.length} of {storeItems.length} items
        </div>
      </div>
    </div>
  );
}

// Temporary component to seed the store (remove after running once)
// const SeedButton = () => {
//   const seedStore = useMutation(api.store.seedStoreItems);

//   return <button onClick={() => seedStore()}>Seed Store Items</button>;
// };
