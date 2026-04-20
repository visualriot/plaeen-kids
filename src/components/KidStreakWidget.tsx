import React from "react";
import { Card } from "./Card";
import { Check, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakData {
  count: number;
  history: Record<string, boolean>; // YYYY-MM-DD -> boolean
  lastUpdate: string; // ISO string
  targetDays?: number; // Guardian setting (3-10)
  rewardMinutes?: number; // Guardian setting (e.g. 5)
  rewardClaimedToday?: boolean; // Track if bonus was added for today
}

interface KidStreakWidgetProps {
  streak: StreakData;
  className?: string;
}

export const KidStreakWidget = ({
  streak,
  className,
}: KidStreakWidgetProps) => {
  const target = streak?.targetDays || 7;
  const currentProgress = streak?.count || 0;
  const progressInGoal = currentProgress % target;
  const isGoalMeta = currentProgress > 0 && progressInGoal === 0;
  const remaining = isGoalMeta ? 0 : target - progressInGoal;

  // Create dots based on target
  const dots = Array.from({ length: target }, (_, i) => ({
    isFilled: isGoalMeta ? true : i < progressInGoal,
  }));

  return (
    <div className={cn("flex flex-col items-center gap-8", className)}>
      {/* Left Side: Streak Count */}
      <div className="flex flex-col items-center text-center md:text-left min-w-56">
        <div className="relative mb-2">
          <Flame
            size={96}
            className={cn(
              "transition-all duration-500",
              currentProgress > 0
                ? "text-plaeen-green fill-plaeen-green animate-pulse"
                : "text-white/20",
            )}
          />
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] text-5xl font-black text-white">
            {currentProgress}
          </span>
        </div>
        <h3 className="text-2xl my-2 font-black text-white uppercase tracking-wider leading-none">
          {currentProgress} DAY STREAK!
        </h3>
        {remaining > 0 && (
          <p className="text-[12px] text-white-60 tracking-[0.2em] mt-2 italic">
            {remaining} more to gain reward.
          </p>
        )}
      </div>

      {/* Right Side: Progress Dots */}
      <div className="flex-1 w-full flex flex-col gap-6">
        <div className="rounded-2xl">
          <div className="flex justify-between w-full mb-6">
            {dots.map((dot, i) => (
              <div
                key={i}
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-500 border-2",
                  dot.isFilled
                    ? "bg-plaeen-green/20 border-plaeen-green text-plaeen-green shadow-[0_0_15px_rgba(118,233,0,0.3)]"
                    : "bg-white/5 border-white/30 text-white/30",
                )}
              >
                {dot.isFilled ? (
                  <Check size={16} strokeWidth={4} />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1 text-center">
            {streak?.rewardMinutes && (
              <p className="text-[12px]">
                You will get an extra{" "}
                <span className="text-plaeen-green/80 font-bold">
                  {streak.rewardMinutes} minutes
                </span>{" "}
                of play after{" "}
                <span className="text-plaeen-green/80 font-bold">
                  {target} streaks!
                </span>{" "}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
