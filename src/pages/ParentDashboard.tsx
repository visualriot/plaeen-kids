import React, { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  setDoc,
  getDoc,
  Timestamp,
  deleteDoc,
  increment,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Plus,
  Users,
  Clock,
  Gamepad2,
  Bell,
  Shield,
  Lock,
  Unlock,
  ChevronRight,
  Check,
  X,
  Star,
  Zap,
  Trash2,
  Settings,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { format, isSameWeek, isSameMonth } from "date-fns";
import { useProfile } from "@/contexts/ProfileContext";
import { motion, AnimatePresence } from "framer-motion";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import { validateUsername } from "@/lib/validation";
import {
  cn,
  formatName,
  getUserAvatar,
  DEFAULT_USER_AVATAR,
} from "@/lib/utils";
import type { KidProfile, ApprovalRequest } from "@/lib/types";

export const ParentDashboard = () => {
  const [user] = useAuthState(auth);
  const { setActiveKid, setParentAuthenticated, parentProfile } = useProfile();
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isAddKidOpen, setIsAddKidOpen] = useState(false);
  const [newKidName, setNewKidName] = useState("");
  const [newKidUsername, setNewKidUsername] = useState("");
  const [newKidBirthDate, setNewKidBirthDate] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<{
    message: string;
    childName: string;
  } | null>(null);
  const [selectedApproval, setSelectedApproval] =
    useState<ApprovalRequest | null>(null);
  const [rewardMinutes, setRewardMinutes] = useState(5);
  const [repairKid, setRepairKid] = useState<KidProfile | null>(null);
  const [repairUsername, setRepairUsername] = useState("");
  const [repairUsernameError, setRepairUsernameError] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10000); // Update every 10 seconds for better responsiveness
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "users"), where("parentId", "==", user.uid));
    const unsubscribeKids = onSnapshot(
      q,
      (snapshot) => {
        setKids(
          snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }) as KidProfile),
        );
      },
      (error) => handleFirestoreError(error, "list", "users"),
    );

    const qApprovals = query(
      collection(db, "approvals"),
      where("parentId", "==", user.uid),
      where("status", "==", "pending"),
    );
    const unsubscribeApprovals = onSnapshot(
      qApprovals,
      (snapshot) => {
        const newApprovals = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as ApprovalRequest,
        );

        // Check for new overtime approvals to show alert
        const newOvertime = newApprovals.find(
          (a) =>
            a.type === "overtime" && !approvals.find((old) => old.id === a.id),
        );
        if (newOvertime) {
          setActiveAlert({
            message: `New Overtime Alert: ${newOvertime.data.overtimeMinutes}m`,
            childName: newOvertime.childName,
          });
          setTimeout(() => setActiveAlert(null), 5000);
        }

        setApprovals(newApprovals);
      },
      (error) => handleFirestoreError(error, "list", "approvals"),
    );

    return () => {
      unsubscribeKids();
      unsubscribeApprovals();
    };
  }, [user]);

  // Sync parent email to users_public once for searchability
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const syncProfile = async () => {
      const publicRef = doc(db, "users_public", user.uid);
      const publicSnap = await getDoc(publicRef);
      if (publicSnap.exists()) {
        const data = publicSnap.data();
        if (!data.email && user.email) {
          await updateDoc(publicRef, { email: user.email.toLowerCase() });
        }
      }
    };
    syncProfile();
  }, [user]);

  const createKidAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newKidName || !newKidUsername || !newKidBirthDate) return;
    setError(null);

    try {
      const validation = validateUsername(newKidUsername);
      if (!validation.isValid) {
        setError(validation.error || "Invalid username.");
        return;
      }

      const cleanUsername = newKidUsername
        .toLowerCase()
        .trim()
        .replace(/^@/, "");

      // Check for username uniqueness
      const qUsername = query(
        collection(db, "users_public"),
        where("username", "==", cleanUsername),
      );
      const usernameSnap = await getDocs(qUsername);

      if (!usernameSnap.empty) {
        setError("Username already taken. Please choose another one.");
        return;
      }

      const kidUid = `kid_${Math.random().toString(36).substr(2, 9)}`;
      const kidData = {
        uid: kidUid,
        displayName: newKidName,
        username: cleanUsername,
        birthDate: newKidBirthDate,
        role: "kid",
        parentId: user.uid,
        screenTime: {
          dailyAllowance: 60,
          usedToday: 0,
          lastReset: Timestamp.now(),
        },
        allowedGames: [],
        friends: [],
        wishlist: [],
        availability: {},
        createdAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, "users", user.uid),
        {
          linkedKids: arrayUnion(kidUid),
        },
        { merge: true },
      );

      await setDoc(doc(db, "users", kidUid), kidData);

      await setDoc(doc(db, "users_public", kidUid), {
        uid: kidUid,
        displayName: kidData.displayName,
        username: cleanUsername,
        photoURL: DEFAULT_USER_AVATAR,
        role: "kid",
        parentId: user.uid,
      });

      setIsAddKidOpen(false);
      setNewKidName("");
      setNewKidUsername("");
      setNewKidBirthDate("");
      setError(null);
    } catch (err) {
      console.error("Error creating kid account:", err);
      setError("Failed to create account. Please try again.");
    }
  };

  const handleApproval = async (
    id: string,
    status: "approved" | "denied",
    reward: number = 0,
    deductionType?: "daily" | "weekly" | "monthly" | "accumulated",
  ) => {
    try {
      const req = approvals.find((a) => a.id === id);
      if (!req) return;

      const updates: any = {
        status,
        rewardMinutes: reward,
      };

      if (deductionType) {
        updates.deductionType = deductionType;
      }

      await updateDoc(doc(db, "approvals", id), updates);

      if (status === "approved") {
        if (reward > 0) {
          const firstDayOfWeekIndex =
            parentProfile?.firstDayOfWeek === "Sun" ? 0 : 1;
          const now = new Date();

          const kidUpdates: any = {
            "screenTime.todayAdjustments": arrayUnion({
              id: Math.random().toString(36).substr(2, 9),
              type: "reward",
              minutes: reward,
              reason: req.title || "Activity Reward",
              timestamp: now.toISOString(),
            }),
            "screenTime.weeklyAdjustments": increment(reward),
            "screenTime.monthlyAdjustments": increment(reward),
          };

          await updateDoc(doc(db, "users", req.childId), kidUpdates);
        }
      }

      setSelectedApproval(null);
    } catch (err) {
      console.error("Error updating approval:", err);
    }
  };

  const handleSwitchProfile = (kidId: string) => {
    setActiveKid(kidId);
    navigate("/kid-dashboard");
  };

  const handleRepairUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairKid || !repairUsername) return;
    setError(null);

    try {
      const validation = validateUsername(repairUsername);
      if (!validation.isValid) {
        setError(validation.error || "Invalid username.");
        return;
      }

      const cleanUsername = repairUsername
        .toLowerCase()
        .trim()
        .replace(/^@/, "");

      // Check for username uniqueness
      const qUsername = query(
        collection(db, "users_public"),
        where("username", "==", cleanUsername),
      );
      const usernameSnap = await getDocs(qUsername);

      if (!usernameSnap.empty) {
        setError("Username already taken. Please choose another one.");
        return;
      }

      // Update both collections
      await updateDoc(doc(db, "users", repairKid.uid), {
        username: cleanUsername,
      });

      await setDoc(
        doc(db, "users_public", repairKid.uid),
        {
          uid: repairKid.uid,
          displayName: repairKid.displayName,
          username: cleanUsername,
          photoURL: getUserAvatar(repairKid.photoURL),
          role: "kid",
          parentId: user?.uid,
        },
        { merge: true },
      );

      setRepairKid(null);
      setRepairUsername("");
      setError(null);
    } catch (err) {
      console.error("Error repairing username:", err);
      setError("Failed to update username.");
    }
  };

  const handleDeleteKid = async (kidId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this kid account? This cannot be undone.",
      )
    )
      return;

    try {
      // 1. Remove from parent's linkedKids
      await updateDoc(doc(db, "users", user!.uid), {
        linkedKids: kids.filter((k) => k.uid !== kidId).map((k) => k.uid),
      });

      // 2. Delete from users and users_public
      await deleteDoc(doc(db, "users", kidId));
      await deleteDoc(doc(db, "users_public", kidId));

      // 3. Delete approvals
      if (user) {
        const qApprovals = query(
          collection(db, "approvals"),
          where("childId", "==", kidId),
          where("parentId", "==", user.uid),
        );
        const snapApprovals = await getDocs(qApprovals);
        for (const d of snapApprovals.docs) {
          await deleteDoc(d.ref);
        }
      }
    } catch (err) {
      console.error("Error deleting kid:", err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16">
        <div>
          <h1 className="text-6xl text-white drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            Guardian <span className="text-plaeen-green">Hub</span>
          </h1>
          <p className="note mt-2">Parental Oversight & Management</p>
        </div>
        <div className="flex gap-4">
          <Link to="/parent/settings">
            <Button variant="ghost" className=" py-6">
              <Settings size={20} />
            </Button>
          </Link>
          <Button
            onClick={() => setIsAddKidOpen(true)}
            className="bg-plaeen-green text-black font-bold uppercase  px-8 py-6 shadow-[0_0_20px_rgba(118,233,0,0.4)]"
          >
            <Plus size={20} className="mr-2" /> Register Kid
          </Button>
        </div>
      </div>

      {/* Real-time Overtime Alert Toast */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm"
          >
            <Card className="bg-red-500 border-red-400 p-6 shadow-[0_0_50px_rgba(239,68,68,0.5)]">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl">
                  <Bell size={24} className="text-white animate-bounce" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/60 uppercase  mb-1">
                    {activeAlert.childName} Needs Attention
                  </p>
                  <p className="text-lg font-bold text-white tracking-tight">
                    {activeAlert.message}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Kids List */}
        <div className="lg:col-span-2 space-y-8">
          <h2 className="flex items-center gap-3">
            <Shield size={16} /> Linked Accounts
          </h2>

          <div className="grid gap-6">
            {kids.map((kid) => (
              <Card
                key={kid.uid}
                className="bg-white/5 border-white/10 p-8 hover:border-plaeen-green/30 transition-all group"
              >
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="flex items-center gap-6">
                    <div className="h-20 w-20 rounded-2xl border-2 border-plaeen-green p-1 bg-plaeen-dark shadow-[0_0_15px_rgba(118,233,0,0.2)]">
                      <img
                        src={getUserAvatar(kid.photoURL)}
                        alt={kid.displayName}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3>{formatName(kid.displayName)}</h3>
                        {kid.screenTime?.isSessionActive && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-plaeen-green/10 border border-plaeen-green/20 text-[8px] font-bold text-plaeen-green uppercase  animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-plaeen-green"></span>
                            Live
                          </span>
                        )}
                        {kid.screenTime?.isSessionActive &&
                          kid.screenTime.sessionStartTime &&
                          (() => {
                            const elapsed = Math.ceil(
                              (now - kid.screenTime.sessionStartTime) / 60000,
                            );
                            const remainingAtStart = Math.max(
                              0,
                              kid.screenTime.dailyAllowance -
                                kid.screenTime.usedToday,
                            );
                            const currentOvertime = Math.max(
                              0,
                              elapsed - remainingAtStart,
                            );
                            if (currentOvertime > 0) {
                              return (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[8px] font-bold text-red-500 uppercase ">
                                  Overtime: {currentOvertime}m
                                </span>
                              );
                            }
                            return null;
                          })()}
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-white/60 uppercase  bg-white/5 px-3 py-1 rounded-full">
                          <Clock size={12} className="text-plaeen-green" />
                          {(() => {
                            const usedToday = kid.screenTime?.usedToday || 0;
                            const allowance =
                              kid.screenTime?.dailyAllowance || 0;
                            let currentUsed = usedToday;
                            if (
                              kid.screenTime?.isSessionActive &&
                              kid.screenTime.sessionStartTime
                            ) {
                              const elapsed = Math.floor(
                                (now - kid.screenTime.sessionStartTime) / 60000,
                              );
                              currentUsed += elapsed;
                            }
                            return Math.max(0, allowance - currentUsed);
                          })()}
                          m Remaining
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-medium text-white/60 uppercase  bg-white/5 px-3 py-1 rounded-full">
                          <Gamepad2 size={12} className="text-plaeen-green" />
                          {(kid.allowedGames || []).length} Games Allowed
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-4">
                    <div className="flex gap-2">
                      <Link to={`/parent/child/${kid.uid}`}>
                        <Button className="w-full flex px-6">Manage</Button>
                      </Link>
                      <Button
                        variant="remove"
                        onClick={() => handleDeleteKid(kid.uid)}
                        className="px-4"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>

                    <Button
                      variant="tertiary"
                      onClick={() => handleSwitchProfile(kid.uid)}
                      size="sm"
                      className="w-full py-1"
                    >
                      Switch to Profile{" "}
                      <ChevronRight size={16} className="ml-2" />
                    </Button>

                    {!kid.username && (
                      <Button
                        onClick={() => {
                          setRepairKid(kid);
                          setRepairUsername("");
                        }}
                        className="bg-amber-500 text-black font-bold uppercase  text-[8px] px-4 py-2"
                      >
                        Set Username
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {kids.length === 0 && (
              <Card className="bg-white/5 border-dashed border-white/10 p-12 text-center">
                <p className="text-white/20 font-bold uppercase ">
                  No kid accounts registered yet
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar: Approvals & Activity */}
        <div className="space-y-12">
          {/* Action Required */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-3">
                <Bell
                  size={16}
                  className={
                    approvals.length > 0 ? "animate-bounce text-red-500" : ""
                  }
                />{" "}
                Action Required
                {approvals.length > 0 && (
                  <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                    {approvals.length}
                  </span>
                )}
              </h2>
              <Link to="/parent/approvals" className="link">
                View All
              </Link>
            </div>

            <div className="space-y-4">
              {approvals.map((req) => (
                <Card
                  key={req.id}
                  className={`bg-white/5 border-white/10 p-4 transition-all ${req.type === "overtime" ? "border-l-2 border-l-red-500 bg-red-500/5" : ""}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[8px] font-bold text-plaeen-green uppercase  mb-1">
                        {req.childName}
                      </p>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">
                        {req.type === "activity"
                          ? `Activity: ${req.title}`
                          : req.type === "friend"
                            ? `Friend: ${req.data.friendName}`
                            : req.type === "game"
                              ? `Game: ${req.data.gameName}`
                              : req.type === "time"
                                ? `Extra Time: ${req.data.requestedMinutes}m`
                                : req.type === "overtime"
                                  ? `Overtime: ${req.data.overtimeMinutes}m`
                                  : "Team Invite"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {req.type === "game" && (
                      <Button
                        size="sm"
                        onClick={() => navigate("/parent/approvals")}
                        className="w-full bg-white/5 text-white/40 border border-white/10 hover:border-plaeen-green hover:text-plaeen-green py-2 font-bold uppercase  text-[8px]"
                      >
                        See Game Details
                      </Button>
                    )}
                    <div className="flex gap-2">
                      {req.type === "activity" ? (
                        <Button
                          size="sm"
                          onClick={() => setSelectedApproval(req)}
                          className="flex-1 bg-plaeen-purple/10 text-plaeen-purple border border-plaeen-purple/20 hover:bg-plaeen-purple hover:text-white py-2 font-bold uppercase  text-[8px]"
                        >
                          Review & Reward
                        </Button>
                      ) : req.type === "overtime" ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(`/parent/overtime-decision/${req.id}`)
                          }
                          className="flex-1 bg-red-500 text-white border border-red-500/20 hover:bg-red-600 py-2 font-bold uppercase  text-[8px] shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                        >
                          Handle Decision
                        </Button>
                      ) : req.type === "time" ? (
                        <div className="flex gap-2 w-full">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleApproval(
                                req.id,
                                "approved",
                                req.data.requestedMinutes,
                              )
                            }
                            className="flex-1 bg-plaeen-green/10 text-plaeen-green border border-plaeen-green/20 hover:bg-plaeen-green hover:text-black py-2 text-[8px] font-bold uppercase "
                          >
                            Approve {req.data.requestedMinutes}m
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApproval(req.id, "denied")}
                            className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white py-2"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApproval(req.id, "approved")}
                            className="flex-1 bg-plaeen-green/10 text-plaeen-green border border-plaeen-green/20 hover:bg-plaeen-green hover:text-black py-2"
                          >
                            <Check size={14} />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApproval(req.id, "denied")}
                            className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white py-2"
                          >
                            <X size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {approvals.length === 0 && (
                <p className="text-center py-8 ghost-text font-bold uppercase  border border-dashed border-white/20 rounded-2xl">
                  All clear
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Reward / Overtime Modal */}
      <AnimatePresence>
        {selectedApproval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <Card className="w-full max-w-md bg-plaeen-dark border-plaeen-purple/30 p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">
                  {selectedApproval.type === "overtime"
                    ? "Overtime Decision"
                    : "Approve Activity"}
                </h2>
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              {selectedApproval.type === "overtime" ? (
                <div className="space-y-8">
                  <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[10px] font-bold text-red-500 uppercase  mb-2">
                      {selectedApproval.childName} went overtime
                    </p>
                    <p className="text-4xl font-bold text-white tracking-tighter mb-1">
                      {selectedApproval.data.overtimeMinutes}m
                    </p>
                    <p className="text-[10px] text-white/40 font-bold uppercase ">
                      Exceeded allowance
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase  text-plaeen-purple block">
                      Extract from Allowance
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() =>
                          handleApproval(
                            selectedApproval.id,
                            "approved",
                            0,
                            "daily",
                          )
                        }
                        className="bg-white/5 text-white hover:bg-plaeen-purple py-4 text-[10px]"
                      >
                        Daily
                      </Button>
                      <Button
                        onClick={() =>
                          handleApproval(
                            selectedApproval.id,
                            "approved",
                            0,
                            "weekly",
                          )
                        }
                        className="bg-white/5 text-white hover:bg-plaeen-purple py-4 text-[10px]"
                      >
                        Weekly
                      </Button>
                      <Button
                        onClick={() =>
                          handleApproval(
                            selectedApproval.id,
                            "approved",
                            0,
                            "monthly",
                          )
                        }
                        className="bg-white/5 text-white hover:bg-plaeen-purple py-4 text-[10px]"
                      >
                        Monthly
                      </Button>
                      <Button
                        onClick={() =>
                          handleApproval(
                            selectedApproval.id,
                            "approved",
                            0,
                            "accumulated",
                          )
                        }
                        className="bg-white/5 text-white hover:bg-plaeen-purple py-4 text-[10px]"
                      >
                        Bonus
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() =>
                      handleApproval(selectedApproval.id, "denied")
                    }
                    variant="outline"
                    className="w-full py-6 border-white/10 text-white/40 hover:text-white font-bold uppercase "
                  >
                    Forgive Overtime
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <p className="text-[10px] font-bold text-plaeen-green uppercase  mb-2">
                      {selectedApproval.childName} says:
                    </p>
                    <p className="text-xl font-bold text-white uppercase tracking-tight italic">
                      "{selectedApproval.title}"
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold uppercase  text-plaeen-purple mb-4 block">
                        Allocate Screen Time Reward
                      </label>
                      <div className="flex items-center justify-between gap-4">
                        {[5, 10, 15, 30].map((min) => (
                          <button
                            key={min}
                            onClick={() => setRewardMinutes(min)}
                            className={`flex-1 py-4 rounded-xl font-bold transition-all ${
                              rewardMinutes === min
                                ? "bg-plaeen-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                                : "bg-white/5 text-white/40 hover:bg-white/10"
                            }`}
                          >
                            {min}m
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Button
                        onClick={() =>
                          handleApproval(
                            selectedApproval.id,
                            "approved",
                            rewardMinutes,
                          )
                        }
                        className="flex-1 py-6 bg-plaeen-green text-black font-bold uppercase "
                      >
                        Approve +{rewardMinutes}m
                      </Button>
                      <Button
                        onClick={() =>
                          handleApproval(selectedApproval.id, "denied")
                        }
                        variant="outline"
                        className="flex-1 py-6 border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold uppercase "
                      >
                        Deny
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Kid Modal */}
      <AnimatePresence>
        {isAddKidOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <Card className="w-full max-w-md bg-plaeen-dark border-plaeen-green/30 p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">
                  Register Kid
                </h2>
                <button
                  onClick={() => setIsAddKidOpen(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={createKidAccount} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase  text-plaeen-green mb-2 block">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newKidName}
                    onChange={(e) => setNewKidName(e.target.value)}
                    placeholder="KID'S NAME"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase  text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase  text-plaeen-green mb-2 block">
                    Username
                  </label>
                  <input
                    type="text"
                    value={newKidUsername}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewKidUsername(val);
                      if (val) {
                        const v = validateUsername(val);
                        setUsernameError(
                          v.isValid ? null : v.error || "Invalid username",
                        );
                      } else {
                        setUsernameError(null);
                      }
                    }}
                    placeholder="KID_USERNAME"
                    className={cn(
                      "w-full bg-white/5 border rounded-xl p-4 text-white placeholder:text-white/10 focus:outline-none transition-all uppercase  text-sm",
                      usernameError
                        ? "border-red-500 focus:border-red-500"
                        : "border-white/10 focus:border-plaeen-green",
                    )}
                    required
                  />
                  {usernameError && (
                    <p className="text-red-500 text-[8px] font-bold uppercase  mt-2">
                      {usernameError}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase  text-plaeen-green mb-2 block">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={newKidBirthDate}
                    onChange={(e) => setNewKidBirthDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-plaeen-green focus:outline-none transition-all uppercase  text-sm"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-[10px] font-bold uppercase  text-center">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full py-6 font-bold uppercase "
                >
                  Create Account
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Repair Username Modal */}
      <AnimatePresence>
        {repairKid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <Card className="w-full max-w-md bg-plaeen-dark border-amber-500/30 p-10">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">
                    Set Username
                  </h2>
                  <p className="text-amber-500 text-[10px] font-bold uppercase  mt-1">
                    Required for social features
                  </p>
                </div>
                <button
                  onClick={() => setRepairKid(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleRepairUsername} className="space-y-6">
                <div>
                  <p className="text-xs text-white/60 mb-4">
                    Setting a unique username for{" "}
                    <span className="text-white font-bold">
                      {repairKid.displayName}
                    </span>{" "}
                    will allow them to be found by friends.
                  </p>
                  <label className="text-[10px] font-bold uppercase  text-amber-500 mb-2 block">
                    New Username
                  </label>
                  <input
                    type="text"
                    value={repairUsername}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepairUsername(val);
                      if (val) {
                        const v = validateUsername(val);
                        setRepairUsernameError(
                          v.isValid ? null : v.error || "Invalid username",
                        );
                      } else {
                        setRepairUsernameError(null);
                      }
                    }}
                    placeholder="KID_USERNAME"
                    className={cn(
                      "w-full bg-white/5 border rounded-xl p-4 text-white placeholder:text-white/10 focus:outline-none transition-all uppercase  text-sm",
                      repairUsernameError
                        ? "border-red-500 focus:border-red-500"
                        : "border-white/10 focus:border-amber-500",
                    )}
                    required
                  />
                  {repairUsernameError && (
                    <p className="text-red-500 text-[8px] font-bold uppercase  mt-2">
                      {repairUsernameError}
                    </p>
                  )}
                </div>
                {error && (
                  <p className="text-red-500 text-[10px] font-bold uppercase  text-center">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full py-6 bg-amber-500 text-black font-bold uppercase "
                >
                  Update Identity
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
