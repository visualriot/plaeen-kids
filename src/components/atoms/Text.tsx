import { cn } from "@/lib/utils";
import { CSSProperties, HTMLAttributes } from "react";

/**
 * @component Text
 * @atomic atom
 * @figma Body, Body Small, Subtitle, Caption
 *
 * @tokens
 *   font-size-body, font-size-body-sm, font-size-label, font-size-caption,
 *   line-height-body, line-height-body-sm, line-height-label, line-height-caption
 *
 * @variants
 *   - body: 16px Geist Regular (default body text)
 *   - small: 14px Geist Regular (smaller body text)
 *   - subtitle: 12px Geist SemiBold, uppercase (section subtitles)
 *   - caption: 12px Geist Regular (metadata, timestamps)
 *
 * @colors primary, secondary, muted, disabled, accent, accent-secondary
 */

interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: "body" | "small" | "subtitle" | "caption";
  color?:
    | "primary"
    | "secondary"
    | "muted"
    | "disabled"
    | "accent"
    | "accent-secondary";
  as?: "p" | "span" | "li" | "div";
}

export const Text = ({
  variant = "body",
  color = "primary",
  as: Component = "p",
  className,
  style,
  ...props
}: TextProps) => {
  const variantStyles: Record<string, CSSProperties> = {
    body: {
      fontSize: "var(--font-size-body)",
      lineHeight: "var(--line-height-body)",
    },
    small: {
      fontSize: "var(--font-size-body-sm)",
      lineHeight: "var(--line-height-body-sm)",
    },
    subtitle: {
      fontSize: "var(--font-size-label)",
      lineHeight: "var(--line-height-label)",
      letterSpacing: "var(--tracking-page-subtitle)",
      fontWeight: 500,
      textTransform: "uppercase",
      color: "var(--color-secondary)",
    },
    caption: {
      fontSize: "var(--font-size-caption)",
      lineHeight: "var(--line-height-caption)",
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
    />
  );
};
