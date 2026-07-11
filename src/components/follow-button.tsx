"use client";

import * as React from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "@/server/actions/follow";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  userId: string;
  initialFollowing: boolean;
  size?: "sm" | "default";
  className?: string;
}

export function FollowButton({ userId, initialFollowing, size = "sm", className }: FollowButtonProps) {
  const [following, setFollowing] = React.useState(initialFollowing);
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    setLoading(true);

    // Optimistic update
    const next = !following;
    setFollowing(next);

    try {
      if (next) await followUser(userId);
      else await unfollowUser(userId);
    } catch (err) {
      setFollowing(!next);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={following ? "default" : "ghost"}
      size={size}
      onClick={onClick}
      disabled={loading}
      aria-pressed={following}
      className={cn("gap-1.5", className)}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : following ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
      {following ? "Siguiendo" : "Seguir"}
    </Button>
  );
}
