import { cn } from "@/lib/utils";
import { CSSProperties, HTMLAttributes } from "react";

/**
 * @component Label
 * @atomic atom
 * @figma Tab Label, Button Text
 *
 * @tokens
 *   font-size-heading-sm, font-size-label, line-height-label,
 *   tracking-label, tracking-widget-title
 *
 * @variants
 *   - tab: 14px Geist Bold, uppercase (tab labels in navigation)
 *   - button: 12px Geist SemiBold, letter-spacing 0.16px (form labels & button text)
 *
 * @colors primary, secondary, muted, disabled, accent, accent-secondary
 */

interface LabelProps extends HTMLAttributes<HTMLElement> {
  variant?: "tab" | "button";
  color?:
    | "primary"
    | "secondary"
    | "muted"
    | "disabled"
    | "accent"
    | "accent-secondary";
  required?: boolean;
  as?: "label" | "span" | "div";
}

export const Label = ({
  variant = "button",
  color = "primary",
  required,
  as: Component = "label",
  className,
  style,
  children,
  ...props
}: LabelProps) => {
  const variantStyles: Record<string, CSSProperties> = {
    tab: {
      fontSize: "var(--font-size-heading-sm)",
      lineHeight: "var(--line-height-label)",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "var(--tracking-widget-title)",
    },
    button: {
      fontSize: "var(--font-size-label)",
      lineHeight: "var(--line-height-label)",
      fontWeight: 600,
      letterSpacing: "var(--tracking-label)",
    },
  };

  const colorClasses = {
    primary: "text-primary",
    secondary: "text-secondary",
    muted: "text-muted",
    disabled: "text-disabled",
    accent: "text-accent",
    "accent-secondary": "text-accent-secondary",
  };

  return (
    <Component
      className={cn(colorClasses[color], className)}
      style={{ ...variantStyles[variant], ...style }}
      {...props}
    >
      {children}
      {required && <span className="text-accent ml-1">*</span>}
    </Component>
  );
};
