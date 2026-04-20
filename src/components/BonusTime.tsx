import React from "react";
import { Zap, RefreshCw } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

interface BonusTimeProps {
  accumulatedTime: number;
  setAccumulatedTime: (value: number) => void;
  onSave: () => void;
  onResetDaily: () => void;
  isSaving: boolean;
}

export const BonusTime: React.FC<BonusTimeProps> = ({
  accumulatedTime,
  setAccumulatedTime,
  onSave,
  onResetDaily,
  isSaving,
}) => {
  return (
    <div className="space-y-8">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
        <Zap size={16} /> Bonus / Accumulated Time
      </h2>
      <Card className="bg-white/5 border-white/10 p-8 space-y-10">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-4 block">
            Bonus / Accumulated Time
          </label>
          <div className="flex items-center gap-4 mb-6">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAccumulatedTime(accumulatedTime - 5)}
              className="border-white/10 text-white/40"
            >
              -5m
            </Button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-white">
                {accumulatedTime}m
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAccumulatedTime(accumulatedTime + 5)}
              className="border-white/10 text-white/40"
            >
              +5m
            </Button>
          </div>
          <Button
            onClick={onSave}
            disabled={isSaving}
            variant="outline"
            className="w-full border-plaeen-green/30 text-plaeen-green font-bold uppercase tracking-widest text-[10px] py-4 hover:bg-plaeen-green/10"
          >
            {isSaving ? "Applying..." : "Apply Bonus Time"}
          </Button>
        </div>

        <div className="pt-8 border-t border-white/5">
          <Button
            onClick={onResetDaily}
            variant="outline"
            className="w-full border-white/10 text-white/40 hover:text-plaeen-green hover:border-plaeen-green/30 font-bold uppercase tracking-widest text-[10px] py-6"
          >
            <RefreshCw size={14} className="mr-2" /> Reset Daily Allowance
          </Button>
          <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest mt-3 text-center">
            Returns today's used time to weekly & monthly pots
          </p>
        </div>
      </Card>
    </div>
  );
};
