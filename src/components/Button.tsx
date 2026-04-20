import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primarydisabled"
    | "secondary"
    | "outline"
    | "ghost"
    | "remove"
    | "tertiary";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants = {
      primary:
        "text-[10px] bg-plaeen-green text-black font-bold hover:bg-opacity-90 neon-glow tracking-wide hover:scale-95",
      primarydisabled:
        "text-[10px] bg-plaeen-green/50 text-black/50 font-bold tracking-wide cursor-not-allowed",
      secondary:
        "bg-plaeen-purple-medium/90 text-white hover:bg-opacity-80 hover:scale-95 purple-glow",
      outline:
        "border border-plaeen-green text-plaeen-green hover:text-plaeen-green hover:bg-plaeen-green/10 hover:scale-95",
      tertiary:
        "text-[10px] text-white/50 tracking-wider hover:scale-95 hover:text-plaeen-green/70 transition-all ease-in-out",
      ghost:
        "text-[10px] border-2 border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90 hover:scale-95 font-medium tracking-wide",
      remove:
        "border-1 border-red-500/80 text-red-500/80 fill-red-500 hover:bg-red-500/10 hover:scale-95",
    };

    const sizes = {
      sm: "px-3 py-4 text-sm",
      md: "px-8 py-4 text-base",
      lg: "px-12 py-6 text-xl font-bold uppercase tracking-widest",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
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
