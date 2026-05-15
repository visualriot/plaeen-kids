import React from "react";
import { Clock } from "lucide-react";
import { Card } from "../molecules/Card";
import { Button } from "../atoms/Button";

interface ScreenTimeAllowanceProps {
  allowanceType: "daily" | "weekly" | "monthly";
  setAllowanceType: (type: "daily" | "weekly" | "monthly") => void;
  dailyAllowance: number;
  setDailyAllowance: (value: number) => void;
  weeklyAllowance: number;
  monthlyAllowance: number;
  restrictedDays: string[];
  setRestrictedDays: (days: string[] | ((prev: string[]) => string[])) => void;
  onSave: () => void;
  isSaving: boolean;
}

/**
 * @component ScreenTimeAllowance
 * @atomic organism
 * @figma ScreenTimeAllowance (Components / Organisms / ScreenTimeAllowance)
 *
 * @tokens
 *   radius-md, radius-lg, radius-sm,
 *   color-primary, color-accent, color-muted
 *
 * @states default, saving
 * @transitions all 300ms ease
 */
export const ScreenTimeAllowance: React.FC<ScreenTimeAllowanceProps> = ({
  allowanceType,
  setAllowanceType,
  dailyAllowance,
  setDailyAllowance,
  weeklyAllowance,
  monthlyAllowance,
  restrictedDays,
  setRestrictedDays,
  onSave,
  isSaving,
}) => {
  return (
    <div className="space-y-8">
      <h2 className="text-[10px] font-bold uppercase  text-plaeen-green flex items-center gap-3">
        <Clock size={16} /> Screen Time Control
      </h2>
      <Card className="bg-white/5 border-white/10 p-8 space-y-10">
        <div>
          <div className="flex justify-between items-center mb-4">
            <label className="text-[10px] font-bold uppercase  text-white/40 block">
              Allowance
            </label>
            <div className="relative">
              <select
                value={allowanceType}
                onChange={(e) => setAllowanceType(e.target.value as any)}
                className="appearance-none bg-white/5 border border-white/10 rounded-radius-md px-4 py-2 pr-10 text-[10px] font-bold uppercase  text-plaeen-green focus:outline-none focus:border-plaeen-green/50 cursor-pointer transition-all backdrop-blur-xl"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2376e900'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.75rem center",
                  backgroundSize: "1rem",
                }}
              >
                <option value="daily" className="bg-plaeen-dark text-white">
                  Daily
                </option>
                <option value="weekly" className="bg-plaeen-dark text-white">
                  Weekly
                </option>
                <option value="monthly" className="bg-plaeen-dark text-white">
                  Monthly
                </option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <input
              type="range"
              min="0"
              max={480}
              step={15}
              value={dailyAllowance}
              onChange={(e) => setDailyAllowance(parseInt(e.target.value))}
              className="flex-1 accent-plaeen-green h-1.5 bg-white/5 rounded-radius-sm appearance-none cursor-pointer"
            />
            <input
              type="number"
              value={dailyAllowance}
              onChange={(e) => setDailyAllowance(parseInt(e.target.value) || 0)}
              className="w-20 bg-white/5 border border-white/10 rounded-radius-md px-3 py-2 text-xl font-bold text-white text-center focus:outline-none focus:border-plaeen-green/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] font-bold text-white/40 uppercase ">
              min/day
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/5 rounded-radius-lg p-4 border border-white/5">
              <p className="text-[8px] font-bold text-white/20 uppercase  mb-1">
                Weekly Total
              </p>
              <p className="text-lg font-bold text-white">{weeklyAllowance}m</p>
            </div>
            <div className="bg-white/5 rounded-radius-lg p-4 border border-white/5">
              <p className="text-[8px] font-bold text-white/20 uppercase  mb-1">
                Monthly Total
              </p>
              <p className="text-lg font-bold text-white">
                {monthlyAllowance}m
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase  text-white/40 mb-4 block">
            Restricted Days (No Play)
          </label>
          <div className="flex flex-wrap gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <button
                key={day}
                onClick={() => {
                  setRestrictedDays((prev = []) =>
                    prev.includes(day)
                      ? prev.filter((d) => d !== day)
                      : [...prev, day],
                  );
                }}
                className={`px-3 py-2 rounded-radius-sm text-[10px] font-bold uppercase  transition-all border-2 ${
                  (restrictedDays || []).includes(day)
                    ? "bg-red-500/20 border-red-500 text-red-500"
                    : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full bg-plaeen-green text-black font-bold uppercase  text-[10px] py-4"
        >
          {isSaving ? "Applying..." : "Apply Allowance Settings"}
        </Button>
      </Card>
    </div>
  );
};
