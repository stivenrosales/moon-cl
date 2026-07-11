import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Native <select> styled to match <Input>. Custom chevron, consistent
 * height and focus ring. Avoids native iOS chevron mismatch.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "flex h-10 w-full appearance-none rounded-lg border border-border/40 bg-background/30",
            "px-3.5 pr-10 py-2 text-sm",
            "hover:border-border/60",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
