"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
  ariaLabel?: string;
}

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly,
  ariaLabel = "Valoración",
}: StarRatingProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div
      className="inline-flex items-center gap-1"
      role={readOnly ? undefined : "radiogroup"}
      aria-label={ariaLabel}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= display;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(null)}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            className={cn(
              "transition-transform",
              !readOnly && "hover:scale-110 cursor-pointer",
              readOnly && "cursor-default",
            )}
          >
            <Star
              width={size}
              height={size}
              className={cn(
                "transition-colors",
                active ? "fill-accent text-accent" : "text-muted-foreground/40",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
