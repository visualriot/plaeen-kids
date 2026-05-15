import { cn } from "@/lib/utils";
import React from "react";

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type HeadingVariant = "display" | "section-eyebrow" | "section-title" | "subtitle" | "muted";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingElement;
  variant?: HeadingVariant;
}

const elementDefaults = {
  h1: "font-display text-4xl font-bold tracking-wider md:text-6xl",
  h2: "text-xs font-bold text-plaeen-green",
  h3: "text-2xl font-bold text-white uppercase",
  h4: "text-xl md:text-2xl",
  h5: "text-neutral-400",
  h6: "text-sm font-bold text-white uppercase",
} satisfies Record<HeadingElement, string>;

const variants = {
  display: elementDefaults.h1,
  "section-eyebrow": "text-xs font-bold text-plaeen-green uppercase",
  "section-title": "text-2xl font-bold text-white uppercase",
  subtitle: "text-xl md:text-2xl",
  muted: "text-neutral-400",
} satisfies Record<HeadingVariant, string>;

export const Heading = ({
  as: Component = "h2",
  variant,
  className,
  ...props
}: HeadingProps) => {
  return (
    <Component
      className={cn(variant ? variants[variant] : elementDefaults[Component], className)}
      {...props}
    />
  );
};
