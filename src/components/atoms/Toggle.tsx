import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

/**
 * @component Toggle
 * @atomic atom
 * @figma Toggle (Components / Atoms / Toggle)
 *
 * @tokens
 *   type-caption, type-button, type-card-heading,
 *   color-primary, color-muted, color-accent,
 *   spacing-3, spacing-4, spacing-8, spacing-12
 *
 * @states on, off
 * @interactive-states default, hover, active, focus, disabled
 * @sizes sm, md, lg
 * @transitions all 200ms ease
 */
interface ToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  state?: "on" | "off";
  size?: "sm" | "md" | "lg";
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, state = "off", size = "md", ...props }, ref) => {
    const states = {
      on: "bg-primary/15 text-primary hover:bg-primary/25 active:bg-primary/20",
      off: "text-muted hover:text-primary/70 active:text-primary cursor-not-allowed",
    };

    const sizes = {
      sm: "type-caption px-3 py-4",
      md: "type-button px-8 py-4",
      lg: "type-card-heading px-12 py-8",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-all gap-2 duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          states[state],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Toggle.displayName = "Toggle";
