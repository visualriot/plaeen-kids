import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { validateUsername } from "@/lib/validation";
import {
  UserPlus,
  Shield,
  Clock,
  Check,
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Lock,
  Gamepad2,
  Sparkles,
} from "lucide-react";
import { cn, getRandomUserAvatar } from "@/lib/utils";

interface KidForm {
  name: string;
  username: string;
  birthDate: string;
  dailyAllowance: number;
  allowanceType: "daily" | "weekly" | "monthly";
  restrictedDays: string[];
  parentalControl: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const OnboardingPage = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [kids, setKids] = useState<KidForm[]>([]);
  const [currentKid, setCurrentKid] = useState<KidForm>({
    name: "",
    username: "",
    birthDate: "",
    dailyAllowance: 60,
    allowanceType: "daily",
    restrictedDays: [],
    parentalControl: true,
  });
  const [pin, setPin] = useState("");
  const [activeKey, setActiveKey] = useState<string | number | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddKid = async () => {
    if (!currentKid.name || !currentKid.username || !currentKid.birthDate) {
      setError("Please fill in all required fields");
      return;
    }

    const validation = validateUsername(currentKid.username);
    if (!validation.isValid) {
      setError(validation.error || "Invalid username");
      return;
    }

    const cleanUsername = currentKid.username
      .toLowerCase()
      .trim()
      .replace(/^@/, "");

    // Check if username is unique - Query users_public instead of users to avoid permission issues
    const q = query(
      collection(db, "users_public"),
      where("username", "==", cleanUsername),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      setError("Username already taken");
      return;
    }

    setKids([...kids, { ...currentKid, username: cleanUsername }]);
    setCurrentKid({
      name: "",
      username: "",
      birthDate: "",
      dailyAllowance: 60,
      allowanceType: "daily",
      restrictedDays: [],
      parentalControl: true,
    });
    setError("");
  };

  const removeKid = (index: number) => {
    setKids(kids.filter((_, i) => i !== index));
  };

  const toggleDay = (day: string) => {
    setCurrentKid((prev) => ({
      ...prev,
      restrictedDays: prev.restrictedDays.includes(day)
        ? prev.restrictedDays.filter((d) => d !== day)
        : [...prev.restrictedDays, day],
    }));
  };

  const handleComplete = async () => {
    if (!user) return;
    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Parent Profile
      const parentData = {
        uid: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "Parent",
        email: user.email,
        photoURL: user.photoURL,
        role: "parent",
        guardianPin: pin,
        onboardingComplete: true,
        linkedKids: [],
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", user.uid), parentData);
      await setDoc(doc(db, "users_public", user.uid), {
        uid: user.uid,
        displayName: parentData.displayName,
        photoURL: parentData.photoURL,
        email: user.email?.toLowerCase(),
        role: "parent",
      });

      // 2. Create Kid Profiles
      const kidIds: string[] = [];
      for (const kid of kids) {
        const kidId = `kid_${Math.random().toString(36).substr(2, 9)}`;
        const kidAvatar = getRandomUserAvatar();
        const kidData = {
          uid: kidId,
          displayName: kid.name,
          username: kid.username.toLowerCase(),
          photoURL: kidAvatar,
          birthDate: kid.birthDate,
          parentId: user.uid,
          role: "kid",
          screenTime: {
            dailyAllowance: kid.dailyAllowance,
            allowanceType: kid.allowanceType,
            restrictedDays: kid.restrictedDays,
            usedToday: 0,
            lastReset: serverTimestamp(),
          },
          restrictedMode: kid.parentalControl,
          allowedGames: [],
          friends: [],
          wishlist: [],
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", kidId), kidData);
        await setDoc(doc(db, "users_public", kidId), {
          uid: kidId,
          displayName: kid.name,
          username: kid.username.toLowerCase(),
          photoURL: kidAvatar,
          role: "kid",
          parentId: user.uid,
          parentEmail: user.email?.toLowerCase() || null,
        });
        kidIds.push(kidId);
      }

      // 3. Update Parent with linked kids
      await updateDoc(doc(db, "users", user.uid), {
        linkedKids: kidIds,
      });

      navigate("/parent-dashboard");
    } catch (err) {
      console.error("Onboarding error:", err);
      setError("Failed to complete setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard support for PIN
  React.useEffect(() => {
    if (step !== 2) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        const num = parseInt(e.key);
        if (pin.length < 4) {
          setPin((prev) => (prev.length < 4 ? prev + num : prev));
          setActiveKey(num);
          setTimeout(() => setActiveKey(null), 150);
        }
      } else if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
        setActiveKey("DEL");
        setTimeout(() => setActiveKey(null), 150);
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        setPin("");
        setActiveKey("C");
        setTimeout(() => setActiveKey(null), 150);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, pin.length]);

  const skipOnboarding = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          displayName:
            user.displayName || user.email?.split("@")[0] || "Parent",
          email: user.email,
          photoURL: user.photoURL,
          role: "parent",
          onboardingComplete: true,
          linkedKids: [],
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      navigate("/parent-dashboard");
    } catch (err) {
      console.error("Skip error:", err);
      setError("Failed to skip setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-plaeen-dark flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(118,233,0,0.05)_0%,transparent_50%)]" />

      <div className="w-full max-w-4xl relative z-10">
        {/* Progress Bar */}
        <div className="flex justify-center gap-4 mb-12">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 w-24 rounded-full transition-all duration-500",
                step >= s
                  ? "bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]"
                  : "bg-white/10",
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <Card className="p-12 bg-plaeen-purple/20 border-white/10 backdrop-blur-2xl">
            <div className="text-center mb-12">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-plaeen-green text-black mb-8 shadow-[0_0_30px_rgba(118,233,0,0.3)]">
                <UserPlus size={40} />
              </div>
              <h1 className="font-display text-5xl font-bold text-white uppercase tracking-tighter mb-4">
                Add Your <span className="text-plaeen-green">Kids</span>
              </h1>
              <p className="text-white/40 font-bold  text-xs">
                You can always adjust these settings later in your dashboard.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 mb-12">
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase  text-plaeen-green">
                    Kid's Name
                  </label>
                  <input
                    type="text"
                    value={currentKid.name}
                    onChange={(e) =>
                      setCurrentKid({ ...currentKid, name: e.target.value })
                    }
                    placeholder="e.g. MAX"
                    className="w-full rounded-xl border-2 border-white/5 bg-white/5 px-6 py-4 text-white font-bold placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase "
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase  text-plaeen-green">
                    Unique Username
                  </label>
                  <input
                    type="text"
                    value={currentKid.username}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCurrentKid({ ...currentKid, username: val });
                      if (val) {
                        const v = validateUsername(val);
                        setError(
                          v.isValid ? "" : v.error || "Invalid username",
                        );
                      } else {
                        setError("");
                      }
                    }}
                    placeholder="e.g. CYBER_MAX"
                    className={cn(
                      "w-full rounded-xl border-2 bg-white/5 px-6 py-4 text-white font-bold placeholder:text-white/10 focus:outline-none transition-all uppercase ",
                      error && currentKid.username
                        ? "border-red-500 focus:border-red-500"
                        : "border-white/5 focus:border-plaeen-green",
                    )}
                  />
                </div>

                <div className="flex gap-6">
                  <div className="space-y-4 flex-1">
                    <label className="block text-[10px] font-bold uppercase  text-plaeen-green">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={currentKid.birthDate}
                      onChange={(e) =>
                        setCurrentKid({
                          ...currentKid,
                          birthDate: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border-2 border-white/5 bg-white/5 px-6 py-4 text-white font-bold focus:border-plaeen-green focus:outline-none transition-all uppercase "
                    />
                  </div>
                  <div className="space-y-4 flex-1">
                    <label className="block text-[10px] font-bold uppercase  text-plaeen-green">
                      Allowance (Min)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={currentKid.dailyAllowance}
                        onChange={(e) =>
                          setCurrentKid({
                            ...currentKid,
                            dailyAllowance: parseInt(e.target.value),
                          })
                        }
                        className="w-32 rounded-xl border-2 border-white/5 bg-white/5 px-4 py-4 text-white font-bold focus:border-plaeen-green focus:outline-none transition-all uppercase  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <select
                        value={currentKid.allowanceType}
                        onChange={(e) =>
                          setCurrentKid({
                            ...currentKid,
                            allowanceType: e.target.value as any,
                          })
                        }
                        className="flex-1 rounded-xl border-2 border-white/5 bg-white/5 px-4 py-4 text-xs font-bold uppercase  text-white focus:border-plaeen-green focus:outline-none cursor-pointer transition-all appearance-none backdrop-blur-xl"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "right 1rem center",
                          backgroundSize: "1rem",
                        }}
                      >
                        <option
                          value="daily"
                          className="bg-plaeen-dark text-white py-4"
                        >
                          Daily
                        </option>
                        <option
                          value="weekly"
                          className="bg-plaeen-dark text-white py-4"
                        >
                          Weekly
                        </option>
                        <option
                          value="monthly"
                          className="bg-plaeen-dark text-white py-4"
                        >
                          Monthly
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase  text-plaeen-green">
                    Restricted Days (No Play)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-[10px] font-bold uppercase  transition-all border-2",
                          currentKid.restrictedDays.includes(day)
                            ? "bg-red-500/20 border-red-500 text-red-500"
                            : "bg-white/5 border-white/5 text-white/40 hover:border-white/20",
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-4">
                    <Shield className="text-plaeen-green" size={24} />
                    <div>
                      <p className="text-xs font-bold text-white uppercase ">
                        Parental Control
                      </p>
                      <p className="text-[10px] text-white/40 uppercase  mt-1">
                        Restricted content & approvals
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setCurrentKid({
                        ...currentKid,
                        parentalControl: !currentKid.parentalControl,
                      })
                    }
                    className={cn(
                      "h-6 w-12 rounded-full transition-all relative",
                      currentKid.parentalControl
                        ? "bg-plaeen-green"
                        : "bg-white/10",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 h-4 w-4 rounded-full bg-white transition-all",
                        currentKid.parentalControl ? "right-1" : "left-1",
                      )}
                    />
                  </button>
                </div>

                {error && (
                  <p className="text-red-500 text-[10px] font-bold uppercase  text-center">
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleAddKid}
                  variant="outline"
                  className="w-full py-6 border-plaeen-green/30 text-plaeen-green hover:bg-plaeen-green hover:text-black"
                >
                  <Plus size={20} className="mr-2" /> Add to Family
                </Button>
              </div>

              <div className="space-y-8">
                <h3 className="text-[10px] font-bold uppercase  text-white/40">
                  Family ({kids.length})
                </h3>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                  {kids.map((k, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10 group hover:border-plaeen-green/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-plaeen-purple/40 flex items-center justify-center text-plaeen-green font-bold text-xl">
                          {k.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white uppercase ">
                            {k.name}
                          </p>
                          <p className="text-[10px] text-white/40 uppercase ">
                            @{k.username}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeKid(i)}
                        className="text-white/20 hover:text-red-500 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                  {kids.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-20">
                      <Sparkles size={48} className="mb-4" />
                      <p className="text-xs font-bold uppercase ">
                        Your family is empty
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="max-w-md mx-auto space-y-4 border-t border-white/5 pt-12">
              <Button
                onClick={() => setStep(2)}
                className="w-full py-8 text-xl font-bold uppercase  shadow-[0_0_30px_rgba(118,233,0,0.3)]"
              >
                Continue <ArrowRight size={24} className="ml-2" />
              </Button>
              <button
                onClick={skipOnboarding}
                className="w-full text-[10px] font-bold text-white/20 hover:text-white uppercase  transition-colors"
              >
                Skip for now
              </button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-12 bg-plaeen-purple/20 border-white/10 backdrop-blur-2xl max-w-md mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-plaeen-green text-black mb-8 shadow-[0_0_30px_rgba(118,233,0,0.3)]">
                <Lock size={40} />
              </div>
              <h1 className="font-display text-5xl font-bold text-white uppercase tracking-tighter mb-4">
                Secure <span className="text-plaeen-green">Access</span>
              </h1>
              <p className="text-white/40 font-bold uppercase  text-xs">
                Set your 4-digit guardian PIN
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex justify-center gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-16 w-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all",
                      pin.length > i
                        ? "border-plaeen-green text-plaeen-green bg-plaeen-green/10"
                        : "border-white/10 text-white/20",
                    )}
                  >
                    {pin[i] ? "•" : ""}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "DEL"].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      if (num === "C") setPin("");
                      else if (num === "DEL") setPin(pin.slice(0, -1));
                      else if (pin.length < 4) setPin(pin + num);
                      setActiveKey(num);
                      setTimeout(() => setActiveKey(null), 150);
                    }}
                    className={cn(
                      "h-16 rounded-xl border font-bold transition-all active:scale-95",
                      activeKey === num
                        ? "bg-plaeen-green border-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.5)] scale-95"
                        : "bg-white/5 border-white/5 text-white hover:bg-white/10 hover:border-plaeen-green/30",
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-red-500 text-[10px] font-bold uppercase  text-center">
                  {error}
                </p>
              )}

              <div className="flex gap-4 pt-8">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-white/10"
                >
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={pin.length !== 4 || isSubmitting}
                  className="flex-2 shadow-[0_0_30px_rgba(118,233,0,0.3)]"
                >
                  {isSubmitting ? "Initializing..." : "Complete Setup"}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
