"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * Checkbox accesible con touch target ≥44px (botón completo) y ticker visible
 * de 20px. Mantiene un input nativo invisible para conservar el contrato de
 * formularios y la integración con react-hook-form.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, checked, defaultChecked, disabled, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "group inline-flex items-start gap-3 py-1.5 cursor-pointer select-none",
          "min-h-[44px]",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <span className="relative inline-flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-md border transition-all",
              "border-input bg-background/50",
              "peer-checked:border-primary peer-checked:bg-primary",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
              "group-hover:border-primary/60",
            )}
          />
          <Check
            aria-hidden
            className={cn(
              "relative h-3.5 w-3.5 text-primary-foreground transition-opacity",
              "opacity-0 peer-checked:opacity-100",
            )}
          />
        </span>
        {(label || description) && (
          <span className="flex flex-col gap-0.5 leading-snug">
            {label ? <span className="text-sm font-medium">{label}</span> : null}
            {description ? (
              <span className="text-xs text-muted-foreground/80">{description}</span>
            ) : null}
          </span>
        )}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
