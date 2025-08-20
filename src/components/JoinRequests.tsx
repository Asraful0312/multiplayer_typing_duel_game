/* eslint-disable @typescript-eslint/no-misused-promises */
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

type JoinRequest = {
  _id: Id<"joinRequests">;
  roomId: Id<"gameRooms">;
  requesterId: Id<"users">;
  requesterName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

type Props = {
  joinRequests: JoinRequest[];
  roomCode: string;
};

const JoinRequests = ({ joinRequests, roomCode }: Props) => {
  const handleJoinRequest = useMutation(api.gameRooms.handleJoinRequest);
  const handleRequest = async (
    requestId: Id<"joinRequests">,
    action: "accept" | "reject"
  ) => {
    try {
      await handleJoinRequest({ requestId, action });
      toast.success(
        action === "accept" ? "Player added to room!" : "Join request rejected"
      );
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} request`);
    }
  };

  if (!joinRequests || joinRequests.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">Join Requests</h3>
        <Badge variant="secondary">{joinRequests.length}</Badge>
      </div>

      <div className="space-y-3">
        {joinRequests.map((request) => (
          <Card key={request._id} className="border border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{request.requesterName}</p>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>
                        {Math.floor(
                          (Date.now() - request.createdAt) / (1000 * 60)
                        )}
                        m ago
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleRequest(request._id, "accept")}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleRequest(request._id, "reject")}
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
        <p>
          <strong>Room Code:</strong> {roomCode} • As the host, you can accept
          or reject join requests for your public room.
        </p>
      </div>
    </div>
  );
};

export default JoinRequests;
