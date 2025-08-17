/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Search,
  Sword,
  Shield,
  Zap,
  Star,
  TrendingUp,
  Settings,
  Loader2,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

const categories = [
  { id: "all", name: "All Items", icon: Package },
  { id: "weapons", name: "Weapons", icon: Sword },
  { id: "armor", name: "Armor", icon: Shield },
  { id: "consumables", name: "Consumables", icon: Zap },
];

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

export default function Inventory() {
  const currentUser = useQuery(api.auth.loggedInUser, {});
  const userInventory = useQuery(
    api.store.getUserInventory,
    currentUser?._id ? { userId: currentUser?._id } : "skip"
  );
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "rarity" | "level" | "acquired"
  >("name");
  const toggleEquipItem = useMutation(api.store.toggleEquipItem);
  const [loading, setLoading] = useState(false);

  if (userInventory === undefined) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredItems = userInventory?.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.item?.category === selectedCategory;
    const matchesSearch = item.item?.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedItems = [...(filteredItems as any)]?.sort((a, b) => {
    switch (sortBy) {
      case "rarity": {
        const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return (
          rarityOrder[b.rarity as keyof typeof rarityOrder] -
          rarityOrder[a.rarity as keyof typeof rarityOrder]
        );
      }
      case "level":
        return b.level - a.level;
      case "acquired":
        return new Date(b.acquired).getTime() - new Date(a.acquired).getTime();
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const toggleEquipped = async (
    isEquip: boolean,
    inventoryId: Id<"inventory">
  ) => {
    setLoading(true);
    try {
      await toggleEquipItem({ inventoryId, isEquip: !isEquip });
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error("equip error: ", error);
      toast.error("Failed to equip item!");
    }
  };

  const getTotalValue = () => {
    return userInventory?.reduce((total, item: any) => {
      if (item.item) {
        return total + item.item.price;
      }
    }, 0);
  };

  const getEquippedItems = () => {
    return userInventory.filter((item) => item.isEquip);
  };

  console.log("stored item", sortedItems);

  return (
    <div className="space-y-6 px-7">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Inventory
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage your collected items
            </p>
          </div>

          {/* Inventory Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-primary">
                  {userInventory.length}
                </div>
                <div className="text-sm text-muted-foreground">Total Items</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {getEquippedItems().length}
                </div>
                <div className="text-sm text-muted-foreground">Equipped</div>
              </CardContent>
            </Card>
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {getTotalValue().toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Value</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search inventory..."
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
                  className="gap-2 whitespace-nowrap"
                >
                  <IconComponent className="w-4 h-4" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button
              variant={sortBy === "name" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("name")}
            >
              Name
            </Button>
            <Button
              variant={sortBy === "rarity" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("rarity")}
            >
              <Star className="w-4 h-4" />
            </Button>
            <Button
              variant={sortBy === "level" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("level")}
            >
              <TrendingUp className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Inventory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedItems.map((item) => (
            <Card
              key={item._id}
              className={`overflow-hidden hover:shadow-lg transition-shadow ${
                item.isEquip ? "ring-2 ring-green-500/50" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      className="size-20 shrink-0 object-cover rounded"
                      src={item.item?.image}
                      alt={item.item?.name}
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      className={getRarityColor(item.item?.rarity as string)}
                    >
                      {item.item?.rarity}
                    </Badge>
                    {item.isEquip && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800"
                      >
                        Equipped
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg">{item.item?.name}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Stats */}
                {item?.item && (
                  <div className="space-y-2">
                    {Object.entries(item.item?.stats)?.map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground capitalize">
                          {key.replace("_", " ")}:
                        </span>
                        <span className="font-medium">{value as any}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {item.item?.category !== "consumables" && (
                    <Button
                      size="sm"
                      variant={item.isEquip ? "secondary" : "default"}
                      onClick={() => toggleEquipped(item.isEquip, item._id)}
                      disabled={loading}
                      className="flex-1 items-center justify-center"
                    >
                      {!loading && <Settings className="w-4 h-4 mr-1" />}
                      {loading ? (
                        <Loader2 className="size-4  shrink-0 animate-spin" />
                      ) : item.isEquip ? (
                        "Unequip"
                      ) : (
                        "Equip"
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Results */}
        {sortedItems.length === 0 && (
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
          Showing {sortedItems.length} of {userInventory?.length} items
        </div>
      </div>
    </div>
  );
}
