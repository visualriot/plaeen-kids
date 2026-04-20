import React from "react";
import { Shield, Info } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface ProfileIdentityProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  username: string;
  setUsername: (val: string) => void;
  birthDate: string;
  setBirthDate: (val: string) => void;
  restrictedMode: boolean;
  setRestrictedMode: (val: boolean) => void;
  usernameError: string | null;
  setUsernameError: (val: string | null) => void;
  validateUsername: (val: string) => { isValid: boolean; error?: string };
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
  hasUsername: boolean;
}

export const ProfileIdentity: React.FC<ProfileIdentityProps> = ({
  displayName,
  setDisplayName,
  username,
  setUsername,
  birthDate,
  setBirthDate,
  restrictedMode,
  setRestrictedMode,
  usernameError,
  setUsernameError,
  validateUsername,
  onSave,
  isSaving,
  error,
  hasUsername,
}) => {
  return (
    <div className="space-y-8">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
        <Shield size={16} /> Profile Identity
      </h2>
      <Card className="bg-white/5 border-white/10 p-8 space-y-6">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 block mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-plaeen-green focus:outline-none transition-all uppercase tracking-widest"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green block mb-2">
            Unique Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              const val = e.target.value;
              setUsername(val);
              if (val) {
                const v = validateUsername(val);
                setUsernameError(
                  v.isValid ? null : v.error || "Invalid username",
                );
              } else {
                setUsernameError(null);
              }
            }}
            placeholder="SET_USERNAME"
            className={cn(
              "w-full bg-white/5 border rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-all uppercase tracking-widest",
              usernameError
                ? "border-red-500 focus:border-red-500"
                : "border-white/10 focus:border-plaeen-green",
            )}
          />
          {usernameError && (
            <p className="text-[8px] text-red-500 font-bold uppercase tracking-widest mt-2">
              {usernameError}
            </p>
          )}
          {!hasUsername && !usernameError && (
            <p className="text-[8px] text-amber-500 font-bold uppercase tracking-widest mt-2">
              <Info size={10} className="inline mr-1" /> Username required for
              social features
            </p>
          )}
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 block mb-2">
            Date of Birth
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-plaeen-green focus:outline-none transition-all uppercase tracking-widest"
          />
        </div>

        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-tight">
                Restricted Mode (Child Friendly)
              </p>
              <p className="text-[8px] text-white/40 mt-1 uppercase tracking-widest font-bold">
                Only show child-friendly games
              </p>
            </div>
            <button
              onClick={() => setRestrictedMode(!restrictedMode)}
              className={`h-6 w-11 rounded-full p-1 transition-colors duration-300 ${
                restrictedMode ? "bg-plaeen-green" : "bg-white/10"
              }`}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                  restrictedMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-[8px] font-bold uppercase tracking-widest">
            {error}
          </p>
        )}
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-[10px] py-4 hover:border-plaeen-green hover:text-plaeen-green"
        >
          {isSaving ? "Saving..." : "Save Profile Changes"}
        </Button>
      </Card>
    </div>
  );
};
