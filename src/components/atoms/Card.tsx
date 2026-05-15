import { cn } from "@/lib/utils";
import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
}

export const Card = ({ children, className, hover = false, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-6 transition-all duration-300",
        hover && "hover:-translate-y-1 hover:border-white/20 hover:bg-white/10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
