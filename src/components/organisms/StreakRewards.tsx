import React from "react";
import { Flame, RotateCcw, History, Info } from "lucide-react";
import { format } from "date-fns";
import { Card } from "../molecules/Card";
import { Button } from "../atoms/Button";
import { cn } from "@/lib/utils";

interface StreakRewardsProps {
  streakCount: number;
  lastUpdate?: string;
  streakTarget: number;
  setStreakTarget: (val: number) => void;
  streakReward: number;
  setStreakReward: (val: number) => void;
  onResetStreak: () => void;
  onRestoreStreak: () => void;
  onUpdateConfig: (target: number, reward: number) => void;
}

/**
 * @component StreakRewards
 * @atomic organism
 * @figma StreakRewards (Components / Organisms / StreakRewards)
 *
 * @tokens
 *   radius-lg, radius-sm,
 *   color-primary, color-accent, color-muted
 *
 * @states default
 * @transitions all 300ms ease
 */
export const StreakRewards: React.FC<StreakRewardsProps> = ({
  streakCount,
  lastUpdate,
  streakTarget,
  setStreakTarget,
  streakReward,
  setStreakReward,
  onResetStreak,
  onRestoreStreak,
  onUpdateConfig,
}) => {
  return (
    <div className="space-y-8">
      <h2 className="text-[10px] font-bold uppercase  text-plaeen-green flex items-center gap-3">
        <Flame size={16} /> Streak & Rewards
      </h2>
      <Card className="bg-white/5 border-white/10 p-8 space-y-4">
        <div className="bg-white/5 rounded-radius-lg p-6 border border-white/5 flex flex-col gap-6">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <div className="h-16 w-16 rounded-radius-lg bg-plaeen-green/10 flex items-center justify-center relative">
              <Flame
                size={32}
                className={cn(
                  streakCount > 0
                    ? "text-plaeen-green fill-plaeen-green animate-pulse"
                    : "text-white/10",
                )}
              />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] text-xl font-black text-white">
                {streakCount}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white uppercase ">
                Current Streak
              </p>
              <p className="text-[8px] text-white/40 font-bold uppercase  mt-1">
                Last Update:{" "}
                {lastUpdate
                  ? format(new Date(lastUpdate), "MMM d, HH:mm")
                  : "Never"}
              </p>
            </div>
            <div className="flex gap-2 text-right">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onResetStreak}
                  className="h-8 w-8 text-white/20 hover:text-red-500"
                >
                  <RotateCcw size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRestoreStreak}
                  className="h-8 w-8 text-white/20 hover:text-blue-500"
                >
                  <History size={14} />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold uppercase  text-white/40">
                  Streak Target
                </label>
                <span className="text-xs font-black text-plaeen-green uppercase">
                  {streakTarget} Days
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="10"
                value={streakTarget}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setStreakTarget(val);
                  onUpdateConfig(val, streakReward);
                }}
                className="w-full h-1.5 bg-white/5 rounded-radius-sm appearance-none cursor-pointer accent-plaeen-green"
              />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold uppercase  text-white/40">
                  Reward Bonus
                </label>
                <span className="text-xs font-black text-plaeen-green uppercase">
                  +{streakReward} Mins
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={streakReward}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setStreakReward(val);
                  onUpdateConfig(streakTarget, val);
                }}
                className="w-full h-1.5 bg-white/5 rounded-radius-sm appearance-none cursor-pointer accent-plaeen-green"
              />
            </div>

            <p className="text-[8px] text-white/40 font-medium uppercase  bg-white/5 p-3 rounded-radius-sm border border-white/5">
              <Info
                size={10}
                className="inline mr-1 text-plaeen-green mb-0.5"
              />
              Kid gets +{streakReward} mins daily bonus when they reach{" "}
              {streakTarget} streaks.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
