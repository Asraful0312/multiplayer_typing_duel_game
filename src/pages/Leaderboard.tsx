import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Star,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useQueryWithStatus } from "@/App";
import { useMutation } from "convex/react";
import { calculateWinPercentage } from "@/lib/game";

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-6 h-6 text-yellow-500" />;
    case 2:
      return <Trophy className="w-6 h-6 text-gray-400" />;
    case 3:
      return <Medal className="w-6 h-6 text-amber-600" />;
    default:
      return <Award className="w-5 h-5 text-muted-foreground" />;
  }
};

const getRankBadgeColor = (rank: number) => {
  switch (rank) {
    case 1:
      return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
    case 2:
      return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
    case 3:
      return "bg-gradient-to-r from-amber-400 to-amber-600 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function Leaderboard() {
  const [_, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const backfill = useMutation(api.leaderboard.backfillAggregate);
  const { data: leaderboard, isPending } = useQueryWithStatus(
    api.leaderboard.getLeaderboard
  );

  // Call backfill() once to initialize
  //   const { data: scores, isPending } = useQueryWithStatus(
  //     api.gameRooms.pageOfScores,
  //     {
  //       offset: (currentPage - 1) * pageSize,
  //       numItems: pageSize,
  //     }
  //   );
  //   const scores = useQuery(api.gameRooms.pageOfScores, {
  //     offset: (currentPage - 1) * pageSize,
  //     numItems: pageSize,
  //   });

  console.log("leaderboard", leaderboard);
  const [sortBy, setSortBy] = useState<"score" | "wins" | "winRate">("score");

  useEffect(() => {
    setCurrentPage(1);
    const fn = async () => {
      await backfill();
    };
    void fn();
  }, [backfill, pageSize]);

  if (isPending && !leaderboard) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 className="shrink-0 size-7 text-primary animate-spin" />
      </div>
    );
  }

  const sortedData = [...(leaderboard as any)]?.sort((a, b) => {
    switch (sortBy) {
      case "wins":
        return b.wins - a.wins;
      case "winRate":
        return b.winRate - a.winRate;
      default:
        return b.score - a.score;
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Sort Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant={sortBy === "score" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("score")}
                className="gap-2 hover:bg-primary/80"
              >
                <Star className="w-4 h-4" />
                Sort by Score
              </Button>
              <Button
                variant={sortBy === "wins" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("wins")}
                className="gap-2 hover:bg-primary/80"
              >
                <Trophy className="w-4 h-4" />
                Sort by Wins
              </Button>
              <Button
                variant={sortBy === "winRate" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("winRate")}
                className="gap-2 hover:bg-primary/80"
              >
                <TrendingUp className="w-4 h-4" />
                Sort by Win Rate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Top 3 Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {sortedData?.slice(0, 3).map((player, index) => (
            <Card
              key={player.rank}
              className={`relative overflow-hidden ${
                index === 0
                  ? "md:order-2 ring-2 ring-yellow-500/50"
                  : index === 1
                    ? "md:order-1"
                    : "md:order-3"
              }`}
            >
              <CardContent className="p-6 text-center space-y-4">
                <div className="flex justify-center">
                  {getRankIcon(player.rank)}
                </div>
                <div className="text-4xl">🐉</div>
                <div>
                  <h3 className="font-bold text-lg">{player.name}</h3>
                  <Badge className={getRankBadgeColor(player.rank)}>
                    #{player.rank}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score:</span>
                    <span className="font-semibold">
                      {player.score.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wins:</span>
                    <span className="font-semibold">{player.wins || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Win Rate:</span>
                    <span className="font-semibold">
                      {calculateWinPercentage(player.wins, player.totalGames)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Full Leaderboard */}
        {/* Full Leaderboard */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Full Rankings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {leaderboard?.map((player, index) => (
                <div
                  key={player.rank}
                  className={`flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors ${
                    index < 3 ? "bg-muted/30" : ""
                  }`}
                >
                  {/* Rank */}
                  <div className="flex items-center gap-2 w-14 shrink-0">
                    {getRankIcon(player.rank)}
                    <span className="font-bold text-sm sm:text-lg">
                      #{player.rank}
                    </span>
                  </div>

                  {/* Avatar & Username */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="text-xl sm:text-2xl shrink-0">🐉</div>
                    <div className="min-w-0">
                      <h4 className="font-semibold truncate max-w-[120px] sm:max-w-[200px]">
                        {player.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Level
                      </p>
                    </div>
                  </div>

                  {/* Desktop Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center w-16">
                      <div className="font-bold">
                        {player.score.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground">Score</div>
                    </div>
                    <div className="text-center w-12">
                      <div className="font-bold">{player.wins}</div>
                      <div className="text-muted-foreground">Wins</div>
                    </div>
                    <div className="text-center w-16">
                      <div className="font-bold">
                        {calculateWinPercentage(player.wins, player.totalGames)}
                        %
                      </div>
                      <div className="text-muted-foreground">Win Rate</div>
                    </div>
                  </div>

                  {/* Mobile Stats */}
                  <div className="sm:hidden text-right shrink-0">
                    <div className="font-bold">
                      {player.score.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {player.wins || 0} wins
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm">
          Rankings updated in real-time • Last updated:{" "}
          {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}
