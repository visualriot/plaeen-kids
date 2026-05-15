import { cn } from "@/lib/utils";
import { CSSProperties, HTMLAttributes } from "react";

/**
 * @component Heading
 * @atomic atom
 * @figma Display, Section Title, Widget Title, Card Heading
 *
 * @tokens
 *   font-size-display, font-size-heading-lg, font-size-heading-md, font-size-heading-sm,
 *   line-height-display, line-height-heading,
 *   tracking-display, tracking-section-title, tracking-widget-title
 *
 * @variants
 *   - display: 48px Abolition Bold, uppercase, letter-spacing 2.4px (page titles)
 *   - section: 16px Geist Bold (section titles)
 *   - widget: 14px Geist Bold, uppercase (widget/card titles)
 *   - card: 24px Geist Bold, uppercase (card headings)
 *
 * @colors primary, secondary, muted, disabled, accent, accent-secondary
 */

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  variant?: "display" | "section" | "widget" | "card";
  color?:
    | "primary"
    | "secondary"
    | "muted"
    | "disabled"
    | "accent"
    | "accent-secondary";
}

export const Heading = ({
  level,
  variant = "display",
  color = "primary",
  className,
  style,
  ...props
}: HeadingProps) => {
  const Component = `h${level}` as const;

  const variantStyles: Record<string, CSSProperties> = {
    display: {
      fontFamily: "var(--font-brand)",
      fontSize: "var(--font-size-display)",
      lineHeight: "var(--line-height-display)",
      letterSpacing: "var(--tracking-display)",
      fontWeight: 700,
      textTransform: "uppercase",
    },
    section: {
      fontSize: "var(--font-size-heading-md)",
      lineHeight: "var(--line-height-heading)",
      fontWeight: 700,
    },
    widget: {
      fontSize: "var(--font-size-heading-sm)",
      lineHeight: "var(--line-height-heading)",
      fontWeight: 700,
      textTransform: "uppercase",
    },
    card: {
      fontSize: "var(--font-size-heading-lg)",
      lineHeight: "var(--line-height-heading)",
      fontWeight: 700,
      textTransform: "uppercase",
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
