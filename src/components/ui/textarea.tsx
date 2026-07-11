import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-border/40 bg-background/30 px-3.5 py-3 text-sm",
          "placeholder:text-muted-foreground/70",
          "hover:border-border/60",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all resize-y",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
