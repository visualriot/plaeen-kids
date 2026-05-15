import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

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
    | "glass";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:
    "bg-plaeen-green text-black font-bold neon-glow hover:bg-plaeen-green/90 hover:scale-95",
  primarydisabled:
    "bg-plaeen-green/50 text-black/50 font-bold cursor-not-allowed",
  secondary:
    "bg-plaeen-purple-medium/90 text-white purple-glow hover:bg-plaeen-purple-medium/80 hover:scale-95",
  outline:
    "border border-plaeen-green text-plaeen-green hover:bg-plaeen-green/10 hover:text-plaeen-green hover:scale-95",
  tertiary:
    "text-white/50 transition-all ease-in-out hover:text-plaeen-green/70 hover:scale-95",
  ghost:
    "border-2 border-white/20 text-white/60 font-medium hover:bg-white/10 hover:text-white/90 hover:scale-95",
  remove:
    "border border-red-500/80 text-red-500/80 fill-red-500 hover:bg-red-500/10 hover:scale-95",
  glass:
    "border border-white/20 text-white backdrop-blur-sm transition-all ease-in-out hover:bg-white/20 hover:scale-95",
} satisfies Record<NonNullable<ButtonProps["variant"]>, string>;

const sizes = {
  sm: "px-3 py-4 text-sm",
  md: "px-8 py-4 text-base",
  lg: "px-12 py-8 text-xl font-bold uppercase",
} satisfies Record<NonNullable<ButtonProps["size"]>, string>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-[10px] transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
