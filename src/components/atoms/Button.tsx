import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

/**
 * @component Button
 * @atomic atom
 * @figma Button (Components / Atoms / Button)
 *
 * @tokens
 *   type-button, type-caption, type-card-heading,
 *   color-accent, color-interactive-hover, color-inverse, color-primary,
 *   color-secondary, color-muted, color-floating, color-error-base,
 *   spacing-3, spacing-4, spacing-8, spacing-12
 *
 * @variants primary, primarydisabled, secondary, outline, ghost, remove, tertiary, glass, back
 * @sizes sm, md, lg
 * @states default, hover, active, focus, disabled
 * @transitions all 200ms ease
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  type?: "button" | "submit" | "reset";
  variant?:
    | "primary"
    | "primarydisabled"
    | "secondary"
    | "outline"
    | "ghost"
    | "remove"
    | "tertiary"
    | "glass"
    | "back";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size, type = "button", ...props },
    ref,
  ) => {
    const variants = {
      primary:
        "bg-accent text-inverse! font-bold hover:bg-interactive-hover neon-glow hover:scale-95",
      primarydisabled:
        "bg-accent/50 text-inverse/50 font-bold cursor-not-allowed",
      secondary:
        "bg-floating/90 text-primary hover:bg-floating hover:scale-95 purple-glow",
      outline:
        "border border-accent text-accent hover:bg-accent/10 hover:scale-95",
      tertiary: "!px-0 !py-0 text-muted hover:text-accent/70 hover:scale-95",
      ghost:
        "border-2 border-primary/20 text-primary/60 hover:bg-primary/10 hover:text-primary/90 hover:scale-95 font-semibold",
      remove:
        "border border-error-base/80 text-error-base/80 hover:bg-error-base/10 hover:scale-95",
      glass:
        "text-primary border border-primary/20 backdrop-blur-sm hover:bg-primary/10 hover:scale-95",
      back: "type-button text-primary/40! hover:text-accent!",
    };

    const sizes = {
      sm: "px-3 py-4",
      md: "px-8 py-4",
      lg: "px-12 py-8",
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          variants[variant],
          size && sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
