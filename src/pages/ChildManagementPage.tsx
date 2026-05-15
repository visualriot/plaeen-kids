import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/molecules/Card";
import { Button } from "@/components/atoms/Button";
import { Heading, Text, Label } from "@/components/atoms";
import { auth, db } from "@/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  increment,
  orderBy,
  limit,
  setDoc,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Shield,
  Clock,
  Gamepad2,
  Users,
  Trash2,
  Save,
  ArrowLeft,
  Plus,
  X,
  Search,
  Star,
  Zap,
  Info,
  Bell,
  History,
  RefreshCw,
  Lock,
} from "lucide-react";
import {
  cn,
  formatName,
  getUserAvatar,
  validateBirthDate,
  getTodayDateString,
  BIRTH_DATE_MIN,
} from "@/lib/utils";
import { format, isSameWeek, isSameMonth, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { validateUsername } from "@/lib/validation";
import { useProfile } from "@/contexts/ProfileContext";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import type { KidProfile } from "@/lib/types";

export const ChildManagementPage = () => {
  const { childId } = useParams();
  const [user] = useAuthState(auth);
  const { parentProfile } = useProfile();
  const [kid, setKid] = useState<KidProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyAllowance, setDailyAllowance] = useState(60);
  const [allowanceType, setAllowanceType] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");
  const [restrictedDays, setRestrictedDays] = useState<string[]>([]);
  const [restrictedMode, setRestrictedMode] = useState(false);
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const [gameSearch, setGameSearch] = useState("");
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const navigate = useNavigate();

  // Helper to calculate monthly allowance based on restricted days
  const calculateMonthlyAllowance = (daily: number, restricted: string[]) => {
    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    let total = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const dayName = format(
        new Date(now.getFullYear(), now.getMonth(), i),
        "EEE",
      );
      if (!restricted.includes(dayName)) total += daily;
    }
    return total;
  };

  const weeklyAllowance = dailyAllowance * (7 - restrictedDays.length);
  const monthlyAllowance = calculateMonthlyAllowance(
    dailyAllowance,
    restrictedDays,
  );

  useEffect(() => {
    if (!childId) return;

    const unsubscribe = onSnapshot(
      doc(db, "users", childId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as KidProfile;
          setKid(data);
          setDisplayName(data.displayName || "");
          setUsername(data.username || "");
          setBirthDate(data.birthDate || "");
          setDailyAllowance(data.screenTime?.dailyAllowance || 60);
          setAllowanceType((data.screenTime as any)?.allowanceType || "daily");
          setRestrictedDays((data.screenTime as any)?.restrictedDays || []);
          setRestrictedMode(data.restrictedMode || false);
          setAccumulatedTime(data.screenTime?.accumulatedTime || 0);
        }
      },
      (error) => handleFirestoreError(error, "get", `users/${childId}`),
    );

    return () => unsubscribe();
  }, [childId]);

  useEffect(() => {
    if (!childId || !user) return;
    const q = query(
      collection(db, "approvals"),
      where("childId", "==", childId),
      where("parentId", "==", user.uid),
      where("status", "==", "pending"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPendingApprovals(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
        );
      },
      (error) => handleFirestoreError(error, "list", "approvals"),
    );
    return () => unsubscribe();
  }, [childId, user]);

  useEffect(() => {
    if (!childId || !user) return;
    const q = query(
      collection(db, "sessions"),
      where("childId", "==", childId),
      where("parentId", "==", user.uid),
      orderBy("endTime", "desc"),
      limit(10),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSessions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, "list", "sessions"),
    );
    return () => unsubscribe();
  }, [childId, user]);

  const removeGame = async (gameId: string) => {
    if (!childId || !kid) return;
    try {
      const newGames = (kid.allowedGames || []).filter((g) => g !== gameId);
      await updateDoc(doc(db, "users", childId), { allowedGames: newGames });
    } catch (err) {
      console.error("Error removing game:", err);
    }
  };

  const removePenalty = async (type: "deduction" | "ban", value: any) => {
    if (!childId || !kid) return;
    try {
      const kidRef = doc(db, "users", childId);
      if (type === "deduction") {
        // Remove from scheduled list
        const newDeductions = (
          kid.screenTime?.scheduledDeductions || []
        ).filter((d) => {
          if (value.id && d.id) return d.id !== value.id;
          return !(d.date === value.date && d.minutes === value.minutes);
        });

        const updates: any = {
          "screenTime.scheduledDeductions": newDeductions,
        };

        // Reverse from weekly/monthly adjustments if applicable
        const firstDayOfWeekIndex =
          parentProfile?.firstDayOfWeek === "Sun" ? 0 : 1;
        const deductionDateObj = parseISO(value.date);
        const now = new Date();
        const isThisWeek = isSameWeek(deductionDateObj, now, {
          weekStartsOn: firstDayOfWeekIndex,
        });
        const isThisMonth = isSameMonth(deductionDateObj, now);

        if (isThisWeek)
          updates["screenTime.weeklyAdjustments"] = increment(value.minutes);
        if (isThisMonth)
          updates["screenTime.monthlyAdjustments"] = increment(value.minutes);

        // If the deduction was for today, also remove from todayAdjustments
        const todayStr = format(new Date(), "yyyy-MM-dd");
        if (value.date === todayStr) {
          const currentAdjustments = kid.screenTime?.todayAdjustments || [];
          updates["screenTime.todayAdjustments"] = currentAdjustments.filter(
            (a: any) => a.id !== value.id,
          );
        }

        await updateDoc(kidRef, updates);
      } else {
        const newBans = (kid.screenTime?.bannedDates || []).filter(
          (d) => d !== value,
        );
        await updateDoc(kidRef, { "screenTime.bannedDates": newBans });
      }
    } catch (err) {
      console.error("Error removing penalty:", err);
    }
  };

  const removeAdjustment = async (adjId: string) => {
    if (!childId || !kid) return;
    try {
      const kidRef = doc(db, "users", childId);
      const currentAdjustments = kid.screenTime?.todayAdjustments || [];
      const adjToRemove = currentAdjustments.find((a: any) => a.id === adjId);

      if (!adjToRemove) return;

      const updates: any = {
        "screenTime.todayAdjustments": currentAdjustments.filter(
          (a: any) => a.id !== adjId,
        ),
      };

      // Reverse the effect on weekly/monthly totals
      const change =
        adjToRemove.type === "penalty"
          ? adjToRemove.minutes
          : -adjToRemove.minutes;
      updates["screenTime.weeklyAdjustments"] = increment(change);
      updates["screenTime.monthlyAdjustments"] = increment(change);

      await updateDoc(kidRef, updates);
    } catch (err) {
      console.error("Error removing adjustment:", err);
    }
  };

  const handleResetDaily = async () => {
    if (!childId || !kid) return;
    try {
      const now = new Date();

      // Calculate expected used time for passed days in week (Mon-Sun)
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
      const daysPassedInWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      let expectedUsedWeekly = 0;
      for (let i = 0; i < daysPassedInWeek; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - (daysPassedInWeek - i));
        const dayName = format(d, "EEE");
        if (!restrictedDays.includes(dayName)) {
          expectedUsedWeekly += dailyAllowance;
        }
      }

      // Calculate expected used time for passed days in month
      const daysPassedInMonth = now.getDate() - 1;
      let expectedUsedMonthly = 0;
      for (let i = 0; i < daysPassedInMonth; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
        const dayName = format(d, "EEE");
        if (!restrictedDays.includes(dayName)) {
          expectedUsedMonthly += dailyAllowance;
        }
      }

      // Update user document
      await updateDoc(doc(db, "users", childId), {
        "screenTime.usedToday": 0,
        "screenTime.usedWeekly": expectedUsedWeekly,
        "screenTime.usedMonthly": expectedUsedMonthly,
        "screenTime.accumulatedTime": 0,
        "screenTime.scheduledDeductions": [],
        "screenTime.bannedDates": [],
      });

      // Clear pending approvals for this child
      const q = query(
        collection(db, "approvals"),
        where("childId", "==", childId),
        where("status", "==", "pending"),
      );
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch (err) {
      console.error("Error resetting daily allowance:", err);
    }
  };

  const handleSaveIdentity = async () => {
    if (!childId || !kid) return;
    setIsSaving(true);
    setError(null);
    try {
      const birthDateError = validateBirthDate(birthDate);
      if (birthDateError) {
        setError(birthDateError);
        setIsSaving(false);
        return;
      }

      const validation = validateUsername(username);
      if (!validation.isValid) {
        setError(validation.error || "Invalid username.");
        setIsSaving(false);
        return;
      }

      const cleanUsername = username.toLowerCase().trim().replace(/^@/, "");

      // If username changed, check uniqueness
      if (cleanUsername && cleanUsername !== kid.username) {
        const qUsername = query(
          collection(db, "users_public"),
          where("username", "==", cleanUsername),
        );
        const usernameSnap = await getDocs(qUsername);
        if (!usernameSnap.empty) {
          setError("Username already taken. Please choose another one.");
          setIsSaving(false);
          return;
        }
      }

      await updateDoc(doc(db, "users", childId), {
        displayName,
        username: cleanUsername,
        birthDate,
        restrictedMode,
      });

      // Sync with users_public
      await setDoc(
        doc(db, "users_public", childId),
        {
          uid: childId,
          displayName,
          username: cleanUsername,
          birthDate,
          photoURL: getUserAvatar(kid.photoURL),
          role: "kid",
          parentId: user?.uid,
        },
        { merge: true },
      );

      setError(null);
    } catch (err) {
      console.error("Error saving identity:", err);
      setError("Failed to save identity.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllowance = async () => {
    if (!childId || !kid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", childId), {
        "screenTime.dailyAllowance": dailyAllowance,
        "screenTime.weeklyAllowance": weeklyAllowance,
        "screenTime.monthlyAllowance": monthlyAllowance,
        "screenTime.allowanceType": allowanceType,
        "screenTime.restrictedDays": restrictedDays,
      });
    } catch (err) {
      console.error("Error saving allowance:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBonus = async () => {
    if (!childId || !kid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", childId), {
        "screenTime.accumulatedTime": accumulatedTime,
      });
    } catch (err) {
      console.error("Error saving bonus:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!kid)
    return (
      <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">
        Loading Profile...
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <Button
        onClick={() => navigate("/parent-dashboard")}
        variant="tertiary"
        size="sm"
        className="flex items-center gap-2 font-bold uppercase mb-8 "
      >
        <ArrowLeft size={14} /> Back to Guardian Hub
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 rounded-3xl border-2 border-plaeen-green p-1 bg-plaeen-dark shadow-[0_0_30px_rgba(118,233,0,0.2)]">
            <img
              src={getUserAvatar(kid.photoURL)}
              alt={kid.displayName}
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-wider">
              {formatName(kid.displayName)}
            </h1>
            <p className="text-sm  text-white/50">@{kid.username}</p>
          </div>
        </div>
      </div>

      {pendingApprovals.filter((a) => a.type === "overtime").length > 0 && (
        <div className="mb-12 space-y-4">
          <h2 className="text-xs font-bold text-red-500 flex items-center gap-3">
            <Bell size={16} /> Pending Overtime Decisions
          </h2>
          <div className="grid gap-4">
            {pendingApprovals
              .filter((a) => a.type === "overtime")
              .map((req) => (
                <Card
                  key={req.id}
                  className="bg-red-500/5 border-red-500/20 p-6 flex flex-col md:flex-row justify-between items-center gap-6"
                >
                  <div className="flex items-center gap-6">
                    <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                      <Clock size={24} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase ">
                        Overtime Detected: {req.data.overtimeMinutes} Minutes
                      </p>
                      <p className="text-[10px] text-white/40 font-bold uppercase  mt-1">
                        Session on{" "}
                        {format(
                          req.createdAt?.toDate() || new Date(),
                          "MMM d, h:mm a",
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      navigate(`/parent/overtime-decision/${req.id}`)
                    }
                    className="bg-red-500 text-white font-bold uppercase  text-[10px] px-8 py-4"
                  >
                    Handle Decision
                  </Button>
                </Card>
              ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Left Column: Screen Time Settings */}
        <div className="space-y-8">
          <h2 className="text-xs font-bold text-plaeen-green flex items-center gap-3">
            <Clock size={16} /> Screen Time Control
          </h2>
          <Card className="bg-white/5 border-white/10 p-8 space-y-10">
            <div>
              <div className="flex justify-between items-center mb-6">
                <label className="block">Allowance</label>
                <div className="relative">
                  <select
                    value={allowanceType}
                    onChange={(e) => setAllowanceType(e.target.value as any)}
                    className="appearance-none bg-white/5 border border-white/10 rounded-lg px-4 py-2 pr-10 text-[10px] font-bold uppercase  text-plaeen-green focus:outline-none focus:border-plaeen-green/50 cursor-pointer transition-all backdrop-blur-xl"
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
                    <option
                      value="weekly"
                      className="bg-plaeen-dark text-white"
                    >
                      Weekly
                    </option>
                    <option
                      value="monthly"
                      className="bg-plaeen-dark text-white"
                    >
                      Monthly
                    </option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-6 ">
                <input
                  type="range"
                  min="0"
                  max={480}
                  step={15}
                  value={dailyAllowance}
                  onChange={(e) => setDailyAllowance(parseInt(e.target.value))}
                  className="flex-1 accent-plaeen-green h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  value={dailyAllowance}
                  onChange={(e) =>
                    setDailyAllowance(parseInt(e.target.value) || 0)
                  }
                  className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xl font-bold text-white text-center focus:outline-none focus:border-plaeen-green/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <label>min/day</label>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[8px] font-bold text-white/20 uppercase  mb-1">
                    Weekly Total
                  </p>
                  <p className="text-lg font-bold text-white">
                    {weeklyAllowance}m
                  </p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
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
              <label className="mb-4 block">Restricted Days (No Play)</label>
              <div className="flex flex-wrap gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day) => (
                    <button
                      key={day}
                      onClick={() => {
                        setRestrictedDays((prev) =>
                          prev.includes(day)
                            ? prev.filter((d) => d !== day)
                            : [...prev, day],
                        );
                      }}
                      className={cn(
                        "px-3 py-2 rounded-lg text-[10px] font-bold uppercase  transition-all border-2",
                        restrictedDays.includes(day)
                          ? "bg-red-500/20 border-red-500 text-red-500"
                          : "bg-white/5 border-white/5 text-white/40 hover:border-white/20",
                      )}
                    >
                      {day}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="space-y-4">
              <Button
                onClick={handleSaveAllowance}
                size="md"
                variant="primary"
                className="w-full"
              >
                Apply Allowance Settings
              </Button>
              <div>
                <Button
                  onClick={handleResetDaily}
                  variant="tertiary"
                  size="sm"
                  className="w-full "
                >
                  <RefreshCw size={14} className="mr-2" /> Reset Daily Allowance
                </Button>
              </div>
            </div>
          </Card>

          {/* Bonus & Penalties */}
          <Card className="bg-white/5 border-white/10 p-8 space-y-10">
            <div>
              <label className="mb-4 block">Bonus / Accumulated Time</label>
              <div className="flex items-center gap-4 mb-6">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setAccumulatedTime(Math.max(0, accumulatedTime - 5))
                  }
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
                  variant="ghost"
                  onClick={() => setAccumulatedTime(accumulatedTime + 5)}
                >
                  +5m
                </Button>
              </div>
              <Button
                onClick={handleSaveBonus}
                variant="primary"
                size="sm"
                className="w-full "
              >
                Apply Bonus Time
              </Button>
            </div>
          </Card>

          <h2 className="text-xs font-bold text-plaeen-green flex items-center gap-3">
            <Shield size={16} /> Profile Identity
          </h2>
          <Card className="bg-white/5 border-white/10 p-8 space-y-6">
            <div>
              <label className="block mb-2 normal-case font-normal text-[12px] text-white/50">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-plaeen-green focus:outline-none transition-all uppercase "
              />
            </div>
            <div>
              <label className="block mb-2 normal-case font-normal text-[12px] text-white/50">
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
                  "w-full bg-white/5 border rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition-all uppercase ",
                  usernameError
                    ? "border-red-500 focus:border-red-500"
                    : "border-white/10 focus:border-plaeen-green",
                )}
              />
              {usernameError && (
                <p className="text-[8px] text-red-500 font-bold uppercase  mt-2">
                  {usernameError}
                </p>
              )}
              {!kid.username && !usernameError && (
                <p className="text-[8px] text-amber-500 font-bold uppercase  mt-2">
                  <Info size={10} className="inline mr-1" /> Username required
                  for social features
                </p>
              )}
            </div>
            <div>
              <label className="block mb-2 normal-case font-normal text-[12px] text-white/50">
                Date of Birth
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                min={BIRTH_DATE_MIN}
                max={getTodayDateString()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-plaeen-green focus:outline-none transition-all uppercase "
              />
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-[12px] font-bold text-white uppercase">
                    Parental Control
                  </p>
                  <p className="font-light italic mt-1 ">
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
              <p className="text-red-500 text-[8px] font-bold uppercase ">
                {error}
              </p>
            )}
            <Button
              onClick={handleSaveIdentity}
              variant="primary"
              size="sm"
              className="flex w-full"
            >
              Save Profile Changes
            </Button>
          </Card>
        </div>

        {/* Right Column: Action Required & Session History (Spans 2 columns) */}
        <div className="lg:col-span-2 space-y-12">
          {/* Today's Active Feedback */}
          {(() => {
            const todayStr = format(new Date(), "yyyy-MM-dd");
            const adjustments = [...(kid?.screenTime?.todayAdjustments || [])];

            // Add scheduled deductions for today that aren't already in adjustments (for legacy support)
            const scheduledToday = (kid?.screenTime?.scheduledDeductions || [])
              .filter((d) => d.date === todayStr)
              .filter((d) => !adjustments.some((a) => a.id === d.id));

            scheduledToday.forEach((d) => {
              adjustments.push({
                id: d.id,
                type: "penalty",
                minutes: d.minutes,
                reason: "Scheduled Penalty",
                timestamp: new Date().toISOString(),
                isScheduled: true,
                data: d,
              });
            });

            if (adjustments.length === 0) return null;

            return (
              <section className="space-y-6">
                <h2 className="text-[10px] font-bold uppercase  text-plaeen-green flex items-center gap-3">
                  <Zap size={16} /> Today's Active Feedback
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adjustments.map((adj: any) => (
                    <Card
                      key={adj.id}
                      className={cn(
                        "p-6 flex items-center justify-between group border-2",
                        adj.type === "penalty"
                          ? "bg-red-500/5 border-red-500/20"
                          : "bg-plaeen-green/5 border-plaeen-green/20",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center",
                            adj.type === "penalty"
                              ? "bg-red-500/10"
                              : "bg-plaeen-green/10",
                          )}
                        >
                          {adj.type === "penalty" ? (
                            <Clock size={20} className="text-red-500" />
                          ) : (
                            <Zap size={20} className="text-plaeen-green" />
                          )}
                        </div>
                        <div>
                          <p
                            className={cn(
                              "text-xs font-bold uppercase ",
                              adj.type === "penalty"
                                ? "text-red-500"
                                : "text-plaeen-green",
                            )}
                          >
                            {adj.minutes}m {adj.type} applied today
                          </p>
                          <p className="text-[8px] text-white/40 font-bold uppercase ">
                            {adj.reason}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() =>
                          adj.isScheduled
                            ? removePenalty("deduction", adj.data)
                            : removeAdjustment(adj.id)
                        }
                        variant="ghost"
                        className="text-[8px] font-bold uppercase  text-white/20 hover:text-red-500"
                      >
                        Cancel
                      </Button>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Active Penalties */}
          <section className="space-y-6">
            <h2 className="text-xs font-bold text-red-500 flex items-center gap-3">
              <Shield size={16} /> Active Penalties
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Scheduled Deductions */}
              {(kid.screenTime?.scheduledDeductions || []).map(
                (deduction: any) => (
                  <Card
                    key={deduction.id}
                    className="bg-red-500/5 border-red-500/20 p-6 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <Zap size={20} className="text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white uppercase ">
                          -{deduction.minutes}m Deduction
                        </p>
                        <p className="text-[8px] text-white/40 font-bold uppercase ">
                          Scheduled for {deduction.date}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => removePenalty("deduction", deduction)}
                      variant="ghost"
                      className="text-[8px] font-bold uppercase  text-white/20 hover:text-red-500"
                    >
                      Reverse
                    </Button>
                  </Card>
                ),
              )}

              {/* Banned Dates */}
              {(kid.screenTime?.bannedDates || []).map((date: string) => (
                <Card
                  key={date}
                  className="bg-red-500/5 border-red-500/20 p-6 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <Lock size={20} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase ">
                        Full Day Ban
                      </p>
                      <p className="text-[8px] text-white/40 font-bold uppercase ">
                        {date}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => removePenalty("ban", date)}
                    variant="ghost"
                    className="text-[8px] font-bold uppercase  text-white/20 hover:text-red-500"
                  >
                    Reverse
                  </Button>
                </Card>
              ))}

              {!kid.screenTime?.scheduledDeductions?.length &&
                !kid.screenTime?.bannedDates?.length && (
                  <Card className="md:col-span-2 bg-white/5 border-dashed border-white/10 p-12 text-center">
                    <p className="ghost-text">No active penalties</p>
                  </Card>
                )}
            </div>
          </section>

          {/* Action Required / Overtime Decisions */}
          {pendingApprovals.length > 0 && (
            <section className="space-y-6">
              <h2 className="text-[10px] font-bold uppercase  text-red-500 flex items-center gap-3">
                <Bell size={16} className="animate-bounce" /> Action Required:
                Overtime Decisions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingApprovals.map((req) => (
                  <Card
                    key={req.id}
                    className="bg-red-500/5 border-red-500/20 p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold text-red-500 uppercase  mb-1">
                          Overtime Detected
                        </p>
                        <h3 className="text-xl font-bold text-white ">
                          {req.data.overtimeMinutes} Minutes Over
                        </h3>
                      </div>
                      <div className="bg-red-500/20 p-2 rounded-lg">
                        <Clock size={20} className="text-red-500" />
                      </div>
                    </div>
                    <p className="text-xs text-white/60 mb-6">
                      {req.childName} didn't finish the session on time. Please
                      decide on a punishment or forgive the overtime.
                    </p>
                    <Button
                      onClick={() =>
                        navigate(`/parent/overtime-decision/${req.id}`)
                      }
                      className="w-full bg-red-500 text-white hover:bg-red-600 font-bold uppercase  text-[10px] py-4"
                    >
                      Handle Decision
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Session History */}
          <section className="space-y-6">
            <h2 className="text-xs font-bold text-white/40 flex items-center gap-3">
              <History size={16} /> Recent Sessions
            </h2>
            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-6 py-4 text-[8px] font-bold text-white/20 uppercase ">
                        Date
                      </th>
                      <th className="px-6 py-4 text-[8px] font-bold text-white/20 uppercase ">
                        Duration
                      </th>
                      <th className="px-6 py-4 text-[8px] font-bold text-white/20 uppercase ">
                        Overtime
                      </th>
                      <th className="px-6 py-4 text-[8px] font-bold text-white/20 uppercase ">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sessions.map((session) => (
                      <tr
                        key={session.id}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-white">
                            {session.endTime?.toDate
                              ? format(session.endTime.toDate(), "MMM d, HH:mm")
                              : "Active"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-white/60">
                            {session.duration}m
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p
                            className={`text-xs font-bold ${session.overtime > 0 ? "text-red-500" : "text-plaeen-green"}`}
                          >
                            {session.overtime > 0
                              ? `+${session.overtime}m`
                              : "On time"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-[8px] font-bold uppercase  px-2 py-1 rounded-full ${
                              session.status === "overtime_pending"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-plaeen-green/10 text-plaeen-green"
                            }`}
                          >
                            {session.status === "overtime_pending"
                              ? "Action Required"
                              : "Completed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <p className="ghost-text">No session history yet</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Allowed Games */}
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-plaeen-green flex items-center gap-3">
                <Gamepad2 size={16} /> Approved Games
              </h2>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 font-bold"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="SEARCH GAMES..."
                  value={gameSearch}
                  onChange={(e) => setGameSearch(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-4 text-[11px] font-bold uppercase  text-white focus:border-plaeen-green focus:outline-none transition-all w-64"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {(kid.allowedGames || []).map((gameId) => (
                <Card
                  key={gameId}
                  className="bg-white/5 border-white/10 p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-plaeen-dark overflow-hidden">
                      <img
                        src={`https://picsum.photos/seed/${gameId}/100`}
                        alt="Game"
                        className="h-full w-full object-cover opacity-50"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase ">
                        Game ID: {gameId}
                      </p>
                      <p className="text-[8px] text-white/20 font-bold uppercase ">
                        Approved
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeGame(gameId)}
                    className="p-2 text-white/10 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </Card>
              ))}
              <button className="border-2 border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-white/40 hover:text-plaeen-green hover:border-plaeen-green/30 transition-all group">
                <Plus size={32} />
                <span className="text-[12px] font-bold uppercase ">
                  Add New Game
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
