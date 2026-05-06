"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Wrapper sobre <Input type="datetime-local"> que muestra siempre un icono
 * de calendario para dejar claro que el campo es tappable, incluso cuando
 * está vacío (Safari iOS no muestra placeholder en estos campos).
 */
const DateTimeInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, value, ...props }, ref) => {
    const isEmpty = !value;
    return (
      <div className="relative">
        <Calendar
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
            isEmpty ? "text-primary/70" : "text-muted-foreground",
          )}
        />
        <Input
          ref={ref}
          type="datetime-local"
          value={value}
          className={cn("pl-10", isEmpty && "text-muted-foreground/60", className)}
          {...props}
        />
      </div>
    );
  },
);
DateTimeInput.displayName = "DateTimeInput";

export { DateTimeInput };
