import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-border/40 bg-background/30 px-3.5 py-2 text-sm",
          "placeholder:text-muted-foreground/70",
          "hover:border-border/60",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
