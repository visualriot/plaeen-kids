import React, { useEffect, useState } from "react";
import { Card } from "@/components/molecules/Card";
import { Button } from "@/components/atoms/Button";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  getDoc,
  getDocs,
  Timestamp,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Plus,
  Users,
  UserPlus,
  Clock,
  Gamepad2,
  Bell,
  Shield,
  Lock,
  Unlock,
  ChevronRight,
  Check,
  X,
  Calendar,
  Zap,
  Star,
  Trophy,
  Activity,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { useProfile } from "@/contexts/ProfileContext";
import { motion, AnimatePresence } from "framer-motion";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import { KidStreakWidget } from "@/components/organisms/KidStreakWidget";
import { Heading } from "@/components/atoms/Heading";
import { Text } from "@/components/atoms/Text";
import { Label } from "@/components/atoms/Label";

import { cn, calculateAge, formatName } from "@/lib/utils";

export const KidDashboard = () => {
  const [user] = useAuthState(auth);
  const {
    activeKid,
    parentProfile,
    isParentViewingKid,
    isLoading: profileLoading,
  } = useProfile();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOvertimeWarning, setShowOvertimeWarning] = useState(false);
  const [hasPlayed5MinWarning, setHasPlayed5MinWarning] = useState(false);
  const [hasPlayed0MinWarning, setHasPlayed0MinWarning] = useState(false);
  const [lastOvertimeSoundMinute, setLastOvertimeSoundMinute] = useState(-1);
  const [isChoreModalOpen, setIsChoreModalOpen] = useState(false);
  const [choreTitle, setChoreTitle] = useState("");
  const [isSubmittingChore, setIsSubmittingChore] = useState(false);
  const [choreSuccess, setChoreSuccess] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationLimit, setNotificationLimit] = useState(5);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [activeNotifMenu, setActiveNotifMenu] = useState<string | null>(null);
  const [showRewardClaimed, setShowRewardClaimed] = useState(false);
  const [screenTimeView, setScreenTimeView] = useState<
    "daily" | "weekly" | "monthly"
  >((activeKid?.screenTime as any)?.allowanceType || "daily");
  const navigate = useNavigate();

  // Sync session state from activeKid
  useEffect(() => {
    if (activeKid?.screenTime) {
      setIsSessionActive(!!activeKid.screenTime.isSessionActive);
      setSessionStartTime(activeKid.screenTime.sessionStartTime || null);
    }
  }, [
    activeKid?.uid,
    activeKid?.screenTime?.isSessionActive,
    activeKid?.screenTime?.sessionStartTime,
  ]);

  useEffect(() => {
    if (activeKid?.screenTime) {
      setScreenTimeView((activeKid.screenTime as any).allowanceType || "daily");
    }
  }, [activeKid?.uid]);

  // Check for streak reward payout
  useEffect(() => {
    if (!activeKid || isParentViewingKid || profileLoading) return;

    const checkReward = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const streak = activeKid.streak;

      // If we have a streak, a target, and we haven't claimed today
      if (
        streak &&
        streak.count > 0 &&
        streak.targetDays &&
        streak.rewardMinutes
      ) {
        // Condition: count is multiple of target, and not claimed today
        const isGoalMet = streak.count % streak.targetDays === 0;
        const alreadyClaimed = streak.rewardClaimedToday === true;

        if (isGoalMet && !alreadyClaimed) {
          try {
            const userRef = doc(db, "users", activeKid.uid);
            await updateDoc(userRef, {
              "screenTime.dailyAllowance": increment(streak.rewardMinutes),
              "streak.rewardClaimedToday": true,
            });
            setShowRewardClaimed(true);
            setTimeout(() => setShowRewardClaimed(false), 5000);
          } catch (err) {
            console.error("Error claiming streak reward:", err);
          }
        }
      }
    };

    checkReward();
  }, [
    activeKid?.streak?.count,
    activeKid?.uid,
    isParentViewingKid,
    profileLoading,
  ]);

  // Request notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Timer for active session
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive]);

  useEffect(() => {
    if (!user || !activeKid || profileLoading) return;

    const isParent = user?.uid !== activeKid?.uid;
    const q = query(
      collection(db, "groups"),
      where(isParent ? "parentIds" : "members", "array-contains", user?.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const gids = snapshot.docs
          .map((d) => d.id)
          .filter((id) => {
            const data = snapshot.docs.find((doc) => doc.id === id)?.data();
            return data?.members && data.members.includes(activeKid.uid);
          });

        if (gids.length === 0) {
          setSessions([]);
          return;
        }

        // Fetch sessions for all groups
        const allSessions: any[] = [];
        for (const gid of gids) {
          const qSessions = query(
            collection(db, "groups", gid, "sessions"),
            where("status", "in", ["proposed", "scheduled"]),
            orderBy("startTime", "asc"),
            limit(10),
          );
          const sSnap = await getDocs(qSessions);
          sSnap.docs.forEach((d) => {
            const sData = d.data();
            // Filter rejected
            const myResp = sData.responses?.[activeKid.uid];
            if (!myResp || myResp.status !== "rejected") {
              allSessions.push({ id: d.id, groupId: gid, ...sData });
            }
          });
        }

        // Sort all combined sessions
        allSessions.sort(
          (a, b) => a.startTime.toMillis() - b.startTime.toMillis(),
        );
        setSessions(allSessions.slice(0, 5));
      },
      (error) => handleFirestoreError(error, "list", "groups"),
    );

    return () => unsubscribe();
  }, [user, activeKid, profileLoading]);

  // Fetch notifications
  useEffect(() => {
    if (!user || !activeKid || profileLoading) return;

    let q;
    if (isParentViewingKid) {
      q = query(
        collection(db, "notifications"),
        where("userId", "==", activeKid.uid),
        where("parentId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(notificationLimit + 1),
      );
    } else {
      q = query(
        collection(db, "notifications"),
        where("userId", "==", activeKid.uid),
        orderBy("createdAt", "desc"),
        limit(notificationLimit + 1),
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setHasMoreNotifications(docs.length > notificationLimit);
        setNotifications(docs.slice(0, notificationLimit));
      },
      (error) => handleFirestoreError(error, "list", "notifications"),
    );

    return () => unsubscribe();
  }, [user, activeKid, notificationLimit, profileLoading, isParentViewingKid]);

  // Cleanup old notifications (older than 30 days)
  useEffect(() => {
    if (!activeKid || !user || profileLoading) return;

    const cleanupOldNotifications = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let q;
      if (isParentViewingKid) {
        q = query(
          collection(db, "notifications"),
          where("userId", "==", activeKid.uid),
          where("parentId", "==", user.uid),
          where("createdAt", "<", Timestamp.fromDate(thirtyDaysAgo)),
        );
      } else {
        q = query(
          collection(db, "notifications"),
          where("userId", "==", activeKid.uid),
          where("createdAt", "<", Timestamp.fromDate(thirtyDaysAgo)),
        );
      }

      try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (err) {
        console.error("Error cleaning up notifications:", err);
      }
    };

    cleanupOldNotifications();
  }, [activeKid?.uid, user, profileLoading, isParentViewingKid]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      setActiveNotifMenu(null);
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
      setActiveNotifMenu(null);
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const requiresAction = (type: string) => {
    return ["friend_request", "team_invite", "overtime"].includes(type);
  };

  const handleStartSession = async () => {
    if (!activeKid) return;

    // Check for restricted days
    const today = format(new Date(), "EEE"); // Mon, Tue, etc.
    const restrictedDays = (activeKid.screenTime as any)?.restrictedDays || [];
    if (restrictedDays.includes(today)) {
      setErrorMessage("Today is a restricted day. No gaming sessions allowed!");
      return;
    }

    // Check for banned dates
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const bannedDates = activeKid.screenTime?.bannedDates || [];
    if (bannedDates.includes(todayStr)) {
      setErrorMessage("Your access is restricted for today by your guardian.");
      return;
    }

    const usedToday = activeKid.screenTime?.usedToday || 0;
    const todayAdjSum = (activeKid.screenTime?.todayAdjustments || []).reduce(
      (acc: number, adj: any) =>
        acc + (adj.type === "reward" ? adj.minutes : -adj.minutes),
      0,
    );
    const allowanceTodayTotal =
      (activeKid.screenTime?.dailyAllowance || 0) + todayAdjSum;

    if (usedToday >= allowanceTodayTotal) {
      setErrorMessage("You have no screen time left today!");
      return;
    }

    const now = Date.now();
    setIsSessionActive(true);
    setSessionStartTime(now);
    setCurrentTime(now);
    setElapsedMinutes(0);
    setErrorMessage(null);
    setHasPlayed5MinWarning(false);
    setHasPlayed0MinWarning(false);
    setLastOvertimeSoundMinute(-1);

    // Update user document for live status
    await updateDoc(doc(db, "users", activeKid.uid), {
      "screenTime.isSessionActive": true,
      "screenTime.sessionStartTime": now,
    });

    // Notify parent
    if (activeKid.parentId) {
      await addDoc(collection(db, "notifications"), {
        userId: activeKid.parentId,
        type: "session_start",
        childId: activeKid.uid,
        childName: activeKid.displayName,
        message: `${activeKid.displayName} started a gaming session.`,
        createdAt: serverTimestamp(),
        read: false,
      });
    }
  };

  const showFeedback = (
    message: string,
    type: "success" | "info" = "success",
  ) => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleTeamInvite = async (notification: any, accept: boolean) => {
    if (!user || !activeKid) return;
    const gid =
      notification.data?.groupId ||
      notification.data?.teamId ||
      notification.groupId;
    const teamName =
      notification.data?.teamName || notification.teamName || "New Team";
    const notificationId = notification.id;

    try {
      if (gid) {
        const groupRef = doc(db, "groups", gid);
        if (accept) {
          // Check for name collision in user's existing teams
          const teamsQuery = query(
            collection(db, "groups"),
            where("members", "array-contains", activeKid.uid),
          );
          const teamsSnap = await getDocs(teamsQuery);
          const existingNames = teamsSnap.docs.map((d) =>
            d.data().name.toLowerCase(),
          );

          if (existingNames.includes(teamName.toLowerCase())) {
            // Collision detected! Find a unique name
            let suffix = 2;
            let alias = `${teamName}-${suffix}`;
            while (existingNames.includes(alias.toLowerCase())) {
              suffix++;
              alias = `${teamName}-${suffix}`;
            }

            // Store alias in user document
            await updateDoc(doc(db, "users", activeKid.uid), {
              [`teamAliases.${gid}`]: alias,
            });
          }

          await updateDoc(groupRef, {
            members: arrayUnion(activeKid.uid),
            pendingMembers: arrayRemove(activeKid.uid),
            parentIds: arrayUnion(activeKid.parentId),
          });

          await addDoc(collection(db, "groups", gid, "events"), {
            type: "member_joined",
            userId: activeKid.uid,
            userName: activeKid.displayName,
            createdAt: serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
          });
        } else {
          await updateDoc(groupRef, {
            pendingMembers: arrayRemove(activeKid.uid),
          });
        }

        // Delete the specific notification by ID
        if (notificationId) {
          await deleteDoc(doc(db, "notifications", notificationId));
        }

        // Find and delete any other notifications from this same team
        let qClean;
        if (isParentViewingKid) {
          qClean = query(
            collection(db, "notifications"),
            where("userId", "==", activeKid.uid),
            where("parentId", "==", user.uid),
            where("type", "==", "team_invite"),
          );
        } else {
          qClean = query(
            collection(db, "notifications"),
            where("userId", "==", activeKid.uid),
            where("type", "==", "team_invite"),
          );
        }
        const snap = await getDocs(qClean);
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          const dData = d.data() as any;
          const dGid =
            dData.data?.groupId ||
            dData.data?.teamId ||
            dData.groupId ||
            dData.teamId;
          if (dGid === gid && d.id !== notificationId) {
            batch.delete(d.ref);
          }
        });
        if (snap.docs.length > 0) {
          await batch.commit();
        }

        // Now remove from UI state AFTER deletion completes to ensure it's gone
        setNotifications((prev) =>
          prev.filter((n) => {
            if (n.type !== "team_invite") return true;
            const nGid = n.data?.groupId || n.data?.teamId || n.groupId;
            return nGid !== gid;
          }),
        );

        showFeedback(
          accept ? "You just joined the team!" : "Invitation declined",
          accept ? "success" : "info",
        );
      } else {
        await deleteDoc(doc(db, "notifications", notification.id));
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notification.id),
        );
        showFeedback("Invitation declined", "info");
      }
    } catch (err) {
      console.error("Error handling team invite:", err);
      showFeedback("Update failed", "info");
    }
  };

  const handleFriendRequest = async (notif: any, accept: boolean) => {
    if (!user || !activeKid) return;
    const fromId = notif.fromId || notif.data?.fromId;
    const notificationId = notif.id;

    try {
      if (accept) {
        let requestId = notif.requestId || notif.data?.requestId;
        if (!requestId && fromId) {
          const q = query(
            collection(db, "friendRequests"),
            where("fromId", "==", fromId),
            where("toId", "==", activeKid.uid),
            where("status", "==", "pending"),
          );
          const snap = await getDocs(q);
          if (!snap.empty) requestId = snap.docs[0].id;
        }

        // if (requestId && fromId) {
        //   await updateDoc(doc(db, "friendRequests", requestId), {
        //     status: "accepted",
        //   });
        //   await updateDoc(doc(db, "users", activeKid.uid), {
        //     friends: arrayUnion(fromId),
        //   });
        //   await updateDoc(doc(db, "users", fromId), {
        //     friends: arrayUnion(activeKid.uid),
        //   });

        //   try {
        //     const senderPublicDoc = await getDoc(
        //       doc(db, "users_public", fromId),
        //     );
        //     if (senderPublicDoc.exists()) {
        //       const senderData = senderPublicDoc.data();
        //       await addDoc(collection(db, "notifications"), {
        //         userId: fromId,
        //         parentId: senderData.parentId || null,
        //         type: "friend_accepted",
        //         title: "Friend Request Accepted",
        //         message: `${activeKid.displayName} accepted your friend request!`,
        //         createdAt: serverTimestamp(),
        //         read: false,
        //         fromId: activeKid.uid,
        //         fromParentId: activeKid.parentId,
        //       });
        //     }
        //   } catch (notificationErr) {
        //     console.warn("Friend accepted notification failed:", notificationErr);
        //   }
        // }
        if (requestId && fromId) {
          const batch = writeBatch(db);

          batch.update(doc(db, "friendRequests", requestId), {
            status: "accepted",
          });

          batch.update(doc(db, "users", activeKid.uid), {
            friends: arrayUnion(fromId),
          });

          batch.update(doc(db, "users", fromId), {
            friends: arrayUnion(activeKid.uid),
          });

          await batch.commit();

          try {
            const senderPublicDoc = await getDoc(
              doc(db, "users_public", fromId),
            );

            if (senderPublicDoc.exists()) {
              const senderData = senderPublicDoc.data();

              await addDoc(collection(db, "notifications"), {
                userId: fromId,
                parentId: senderData.parentId || null,
                type: "friend_accepted",
                title: "Friend Request Accepted",
                message: `${activeKid?.displayName || parentProfile?.displayName || "Anonymous"} accepted your friend request!`,
                createdAt: serverTimestamp(),
                read: false,
                fromId: activeKid.uid,
              });
            }
          } catch (notificationErr) {
            console.warn(
              "Friend accepted notification failed:",
              notificationErr,
            );
          }
        }
      } else if (fromId) {
        let requestId = notif.requestId || notif.data?.requestId;
        if (!requestId) {
          const q = query(
            collection(db, "friendRequests"),
            where("fromId", "==", fromId),
            where("toId", "==", activeKid.uid),
            where("status", "==", "pending"),
          );
          const snap = await getDocs(q);
          if (!snap.empty) requestId = snap.docs[0].id;
        }
        if (requestId) {
          await updateDoc(doc(db, "friendRequests", requestId), {
            status: "rejected",
          });
        }
      }

      try {
        if (notificationId) {
          await deleteDoc(doc(db, "notifications", notificationId));
        }

        if (fromId) {
          const qClean = isParentViewingKid
            ? query(
                collection(db, "notifications"),
                where("userId", "==", activeKid.uid),
                where("parentId", "==", user.uid),
                where("type", "==", "friend_request"),
              )
            : query(
                collection(db, "notifications"),
                where("userId", "==", activeKid.uid),
                where("type", "==", "friend_request"),
              );
          const snap = await getDocs(qClean);
          const batch = writeBatch(db);
          snap.docs.forEach((d) => {
            const dData = d.data();
            const dFromId = dData.fromId || dData.data?.fromId;
            if (dFromId === fromId && d.id !== notificationId) {
              batch.delete(d.ref);
            }
          });
          if (snap.docs.length > 0) {
            await batch.commit();
          }
        }
      } catch (cleanupErr) {
        console.warn("Friend request notification cleanup failed:", cleanupErr);
      }

      setNotifications((prev) =>
        prev.filter((n) => {
          if (n.type !== "friend_request") return true;
          const nFromId = n.fromId || n.data?.fromId;
          return nFromId !== fromId;
        }),
      );

      showFeedback(
        accept ? "Friend request accepted!" : "Request declined",
        accept ? "success" : "info",
      );
    } catch (err) {
      console.error("Error handling friend request:", err);
      showFeedback("Update failed", "info");
    }
  };

  const handleEndSession = async () => {
    if (!activeKid || !sessionStartTime) return;

    const endTime = Date.now();
    const durationMs = endTime - sessionStartTime;
    const durationMin = Math.ceil(durationMs / 60000); // Use ceil to be conservative with time

    // Get latest data from activeKid
    const currentAllowance = activeKid.screenTime?.dailyAllowance || 0;
    const currentUsed = activeKid.screenTime?.usedToday || 0;
    const remainingAtStart = Math.max(0, currentAllowance - currentUsed);

    // Calculate overtime
    const overtimeMin = Math.max(0, durationMin - remainingAtStart);

    try {
      const userRef = doc(db, "users", activeKid.uid);

      // Calculate Streak Info
      const todayStr = new Date().toISOString().split("T")[0];
      const currentStreak = activeKid?.streak || {
        count: 0,
        history: {} as Record<string, boolean>,
        lastUpdate: "",
        rewardClaimedToday: false,
        rewardMinutes: 0,
      };
      let newStreak = { ...currentStreak };

      // 1 strike per day, must be at least 5 mins session, must be on time or within 5 min overtime
      const isEligibleForStreak = durationMin >= 5 && overtimeMin <= 5;
      const alreadyHasStreakToday = !!currentStreak.history?.[todayStr];
      const target = activeKid.streak?.targetDays || 7;

      if (!alreadyHasStreakToday) {
        if (isEligibleForStreak) {
          // Increment streak
          const newCount = (currentStreak.count || 0) + 1;
          newStreak.count = newCount;
          newStreak.history = { ...currentStreak.history, [todayStr]: true };
          newStreak.lastUpdate = new Date().toISOString();

          // Check for REWARD goal reached
          if (newCount > 0 && newCount % target === 0) {
            newStreak.rewardClaimedToday = false; // Reset flag so it can be claimed tomorrow
          }
        } else if (overtimeMin > 5) {
          // Reset streak if failed overtime rules
          newStreak.count = 0;
        }
      }

      let finalUsedToday = currentUsed + durationMin;
      let finalUsedWeekly =
        (activeKid.screenTime?.usedWeekly || 0) + durationMin;
      let finalUsedMonthly =
        (activeKid.screenTime?.usedMonthly || 0) + durationMin;

      // Rule: Overtime should not affect allowance until guardian decides
      // So we cap the usage at the allowance for now.
      if (overtimeMin > 0) {
        finalUsedToday = currentAllowance;
        finalUsedWeekly =
          (activeKid.screenTime?.usedWeekly || 0) + remainingAtStart;
        finalUsedMonthly =
          (activeKid.screenTime?.usedMonthly || 0) + remainingAtStart;
      }

      const updates: any = {
        "screenTime.usedToday": finalUsedToday,
        "screenTime.usedWeekly": finalUsedWeekly,
        "screenTime.usedMonthly": finalUsedMonthly,
        "screenTime.lastReset": serverTimestamp(),
        "screenTime.isSessionActive": false,
        "screenTime.sessionStartTime": null,
        streak: newStreak,
      };

      await updateDoc(userRef, updates);

      // Save start time before clearing state
      const startTimeVal = sessionStartTime;

      setIsSessionActive(false);
      setSessionStartTime(null);
      setShowOvertimeWarning(false);

      if (activeKid.parentId && startTimeVal) {
        if (overtimeMin > 1) {
          // Use a batch to create both with cross-references
          const notifRef = doc(collection(db, "notifications"));
          const approvalRef = doc(collection(db, "approvals"));
          const batch = writeBatch(db);

          batch.set(notifRef, {
            userId: activeKid.parentId,
            type: "time_warning",
            childId: activeKid.uid,
            childName: activeKid.displayName,
            title: "Overtime Alert",
            message: `${activeKid.displayName} finished their session. (Overtime: ${overtimeMin}m - Action Required)`,
            duration: durationMin,
            overtime: overtimeMin,
            createdAt: serverTimestamp(),
            read: false,
            rewardEligible: false,
            handled: false,
            approvalId: approvalRef.id,
          });

          batch.set(approvalRef, {
            parentId: activeKid.parentId,
            childId: activeKid.uid,
            childName: activeKid.displayName,
            type: "overtime",
            title: `Overtime: ${overtimeMin}m`,
            status: "pending",
            notificationId: notifRef.id,
            data: {
              overtimeMinutes: overtimeMin,
              sessionDuration: durationMin,
              allowanceAtStart: currentAllowance,
              usedAtStart: currentUsed,
            },
            createdAt: serverTimestamp(),
          });

          await batch.commit();
        } else {
          await addDoc(collection(db, "notifications"), {
            userId: activeKid.parentId,
            type: "session_end",
            childId: activeKid.uid,
            childName: activeKid.displayName,
            title: "Session Ended",
            message: `${activeKid.displayName} finished their session.${overtimeMin > 0 ? " (Within grace period)" : ""}`,
            duration: durationMin,
            overtime: overtimeMin,
            createdAt: serverTimestamp(),
            read: false,
            rewardEligible: overtimeMin === 0,
          });
        }

        // Add to session history
        await addDoc(collection(db, "sessions"), {
          childId: activeKid.uid,
          parentId: activeKid.parentId,
          startTime: new Timestamp(Math.floor(startTimeVal / 1000), 0),
          endTime: serverTimestamp(),
          duration: durationMin,
          overtime: overtimeMin,
          status: overtimeMin > 1 ? "overtime_pending" : "completed",
        });
      }
    } catch (err) {
      console.error("Error ending session:", err);
    }
  };

  const handleAddChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKid || !choreTitle || isSubmittingChore) return;

    setIsSubmittingChore(true);
    try {
      await addDoc(collection(db, "approvals"), {
        parentId: activeKid.parentId,
        childId: activeKid.uid,
        childName: activeKid.displayName,
        type: "activity",
        title: choreTitle,
        status: "pending",
        createdAt: serverTimestamp(),
        rewardMinutes: 0,
      });

      setChoreSuccess(true);
      setChoreTitle("");
      setTimeout(() => {
        setIsChoreModalOpen(false);
        setChoreSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Error adding chore:", err);
      setErrorMessage(
        "Failed to send activity for approval. Please try again.",
      );
    } finally {
      setIsSubmittingChore(false);
    }
  };

  if (!activeKid) return null;

  const used =
    screenTimeView === "daily"
      ? activeKid.screenTime?.usedToday || 0
      : screenTimeView === "weekly"
        ? activeKid.screenTime?.usedWeekly || 0
        : activeKid.screenTime?.usedMonthly || 0;

  const restrictedDays = (activeKid.screenTime as any)?.restrictedDays || [];
  const dailyAllowance = activeKid.screenTime?.dailyAllowance || 0;
  const todayAdjSum = (activeKid.screenTime?.todayAdjustments || []).reduce(
    (acc: number, adj: any) =>
      acc + (adj.type === "reward" ? adj.minutes : -adj.minutes),
    0,
  );

  const dailyAllowanceTotal = dailyAllowance + todayAdjSum;

  // Calculate Synced Allowances
  const weeklyAllowance =
    dailyAllowance * (7 - restrictedDays.length) +
    (activeKid.screenTime?.weeklyAdjustments || 0);

  // Monthly calculation: non-restricted days in current month
  const getMonthlyAllowance = () => {
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
      if (!restrictedDays.includes(dayName)) total += dailyAllowance;
    }
    return total + (activeKid.screenTime?.monthlyAdjustments || 0);
  };

  const allowance =
    screenTimeView === "daily"
      ? dailyAllowanceTotal
      : screenTimeView === "weekly"
        ? weeklyAllowance
        : getMonthlyAllowance();

  // Calculate precise remaining time
  const usedInSessionSeconds =
    isSessionActive && sessionStartTime
      ? Math.max(0, Math.floor((currentTime - sessionStartTime) / 1000))
      : 0;
  const totalUsedSeconds = used * 60 + usedInSessionSeconds;
  const totalAllowanceSeconds = allowance * 60;
  const remainingSecondsTotal = totalAllowanceSeconds - totalUsedSeconds;

  const isOvertime = remainingSecondsTotal < 0;
  const isTimeUp = remainingSecondsTotal <= 0;
  const absoluteRemainingSeconds = Math.abs(remainingSecondsTotal);
  const remainingMinutes = Math.floor(absoluteRemainingSeconds / 60);
  const remainingSecondsDisplay = absoluteRemainingSeconds % 60;

  const progress =
    totalAllowanceSeconds > 0
      ? Math.min(100, (totalUsedSeconds / totalAllowanceSeconds) * 100)
      : 0;

  // Reset Logic
  useEffect(() => {
    if (!activeKid || !user) return;

    const checkAndReset = async () => {
      const now = new Date();
      const lastReset =
        activeKid.screenTime?.lastReset?.toDate() || new Date(0);
      const updates: any = {};

      // Daily Reset
      if (format(now, "yyyy-MM-dd") !== format(lastReset, "yyyy-MM-dd")) {
        updates["screenTime.usedToday"] = 0;
        updates["screenTime.todayAdjustments"] = [];

        const todayStr = format(now, "yyyy-MM-dd");
        const deductions = activeKid.screenTime?.scheduledDeductions || [];

        // Clean up old deductions (older than today)
        const activeDeductions = deductions.filter((d) => d.date >= todayStr);
        if (activeDeductions.length !== deductions.length) {
          updates["screenTime.scheduledDeductions"] = activeDeductions;
        }

        // Apply scheduled deductions for today
        const todayDeductions = deductions.filter((d) => d.date === todayStr);

        if (todayDeductions.length > 0) {
          const totalDeduction = todayDeductions.reduce(
            (acc, d) => acc + d.minutes,
            0,
          );
          updates["screenTime.usedToday"] = totalDeduction;
          updates["screenTime.todayAdjustments"] = todayDeductions.map((d) => ({
            id: d.id || Math.random().toString(36).substr(2, 9),
            type: "penalty",
            minutes: d.minutes,
            reason: "Scheduled Penalty",
            timestamp: new Date().toISOString(),
          }));
        }

        // Clean up old banned dates
        const bannedDates = activeKid.screenTime?.bannedDates || [];
        const activeBanned = bannedDates.filter((d) => d >= todayStr);
        if (activeBanned.length !== bannedDates.length) {
          updates["screenTime.bannedDates"] = activeBanned;
        }

        updates["screenTime.lastReset"] = serverTimestamp();
      }

      // Weekly Reset
      const firstDay = parentProfile?.firstDayOfWeek || "Mon";
      const currentDay = format(now, "EEE");

      // If today is the first day of week and we haven't reset this week yet
      const daysSinceReset = Math.floor(
        (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (
        currentDay === firstDay &&
        (daysSinceReset >= 1 ||
          format(now, "yyyy-ww") !== format(lastReset, "yyyy-ww"))
      ) {
        updates["screenTime.usedWeekly"] = 0;
        updates["screenTime.weeklyAdjustments"] = 0;
      }

      // Monthly Reset
      if (now.getDate() === 1 && now.getMonth() !== lastReset.getMonth()) {
        updates["screenTime.usedMonthly"] = 0;
        updates["screenTime.monthlyAdjustments"] = 0;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "users", activeKid.uid), updates);
      }
    };

    checkAndReset();
  }, [activeKid?.uid, parentProfile?.firstDayOfWeek]);

  // Sound and Notification Logic
  useEffect(() => {
    if (!isSessionActive) {
      setShowOvertimeWarning(false);
      return;
    }

    // 5 Minute Warning
    if (
      !isOvertime &&
      remainingMinutes === 5 &&
      remainingSecondsDisplay === 0 &&
      !hasPlayed5MinWarning
    ) {
      const audio = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
      );
      audio.play().catch((e) => console.log("Audio play failed:", e));
      setHasPlayed5MinWarning(true);
    }

    // 0 Minute Warning (System Notification + Longer Sound)
    // Fix: Trigger exactly when remainingSecondsTotal hits 0
    if (remainingSecondsTotal === 0 && !hasPlayed0MinWarning) {
      const audio = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
      );
      audio.play().catch((e) => console.log("Audio play failed:", e));
      setHasPlayed0MinWarning(true);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Time is Up!", {
          body: "Your gaming session has ended. Please end your session now!",
          icon: "/logo/logo.png",
          requireInteraction: true,
        });
      }
    }

    // Overtime Recurring Sound (Every minute)
    if (
      isOvertime &&
      remainingMinutes > 0 &&
      remainingMinutes !== lastOvertimeSoundMinute &&
      remainingSecondsDisplay === 0
    ) {
      // Use a more urgent "hurry up" sound
      // If >= 5 minutes overtime, use a longer "buzz" sound
      const soundUrl =
        remainingMinutes >= 5
          ? "https://assets.mixkit.co/active_storage/sfx/1003/1003-preview.mp3" // Buzz/Alarm
          : "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"; // Urgent beep

      const audio = new Audio(soundUrl);
      audio.play().catch((e) => console.log("Audio play failed:", e));
      setLastOvertimeSoundMinute(remainingMinutes);
    }

    if (isOvertime && !showOvertimeWarning) {
      setShowOvertimeWarning(true);
    } else if (!isOvertime && showOvertimeWarning) {
      setShowOvertimeWarning(false);
    }
  }, [
    absoluteRemainingSeconds,
    isSessionActive,
    isOvertime,
    hasPlayed5MinWarning,
    hasPlayed0MinWarning,
    lastOvertimeSoundMinute,
    remainingMinutes,
    remainingSecondsDisplay,
    remainingSecondsTotal,
    showOvertimeWarning,
  ]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-6 py-12 relative z-0">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Heading
              level={1}
              variant="display"
              className="drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]"
            >
              Welcome,{" "}
              <span className="text-plaeen-green">
                {activeKid.displayName.split(" ")[0]}!
              </span>
            </Heading>
            {activeKid.uid && activeKid.username && (
              <Text variant="subtitle" color="muted" className="mt-6">
                @{activeKid.username.split(" ")[0]}
              </Text>
            )}
          </motion.div>

          <div className="flex gap-4">
            <Button
              onClick={() => navigate("/kid-calendar")}
              variant="ghost"
              className="px-8 py-6"
            >
              <Calendar size={20} className="mr-2" /> Calendar
            </Button>
            <Button
              onClick={() => setIsChoreModalOpen(true)}
              variant="ghost"
              className="px-8 py-6"
            >
              <Zap size={20} className="mr-2" /> Log Activity
            </Button>
            {!isSessionActive ? (
              <Button
                onClick={() => {
                  const today = format(new Date(), "EEE");
                  const restrictedDays =
                    (activeKid.screenTime as any)?.restrictedDays || [];
                  const usedToday = activeKid.screenTime?.usedToday || 0;
                  const todayAdjSum = (
                    activeKid.screenTime?.todayAdjustments || []
                  ).reduce(
                    (acc: number, adj: any) =>
                      acc +
                      (adj.type === "reward" ? adj.minutes : -adj.minutes),
                    0,
                  );
                  const allowanceTodayTotal =
                    (activeKid.screenTime?.dailyAllowance || 0) + todayAdjSum;

                  if (restrictedDays.includes(today)) {
                    setErrorMessage(
                      "Today is a restricted day. No gaming sessions allowed!",
                    );
                    return;
                  }
                  if (usedToday >= allowanceTodayTotal) {
                    setErrorMessage("You have no screen time left today!");
                    return;
                  }
                  handleStartSession();
                }}
                disabled={
                  restrictedDays.includes(format(new Date(), "EEE")) ||
                  (activeKid.screenTime?.usedToday || 0) >= dailyAllowanceTotal
                }
                size="md"
                variant={
                  restrictedDays.includes(format(new Date(), "EEE")) ||
                  (activeKid.screenTime?.usedToday || 0) >= dailyAllowanceTotal
                    ? "primarydisabled"
                    : "primary"
                }
                className={cn("your-other-classes")}
              >
                <Gamepad2 size={20} className="mr-2" /> Start Playing
              </Button>
            ) : (
              <Button
                onClick={handleEndSession}
                className="bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] red-glow"
                variant="primary"
              >
                <X size={20} className="mr-2" /> End Session
              </Button>
            )}
          </div>
        </div>

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase  text-center"
          >
            {errorMessage}
          </motion.div>
        )}

        {/* Floating Action Feedback */}
        <AnimatePresence mode="wait">
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 50, x: "-50%" }}
              className={cn(
                "fixed bottom-8 left-1/2 z-[100] px-8 py-4 rounded-2xl border font-bold uppercase  text-[10px] shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl",
                feedback.type === "success"
                  ? "bg-plaeen-green text-black border-plaeen-green/30"
                  : "bg-white/10 text-white/60 border-white/20",
              )}
            >
              {feedback.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Left Column: Screen Time & Stats */}
          <div className="space-y-12">
            <Card className="bg-white/5 border-white/10 p-8 relative overflow-hidden group">
              <div className="flex justify-between items-center mb-8">
                <Heading
                  level={2}
                  variant="widget"
                  className="flex items-center gap-2"
                >
                  <Clock size={18} className="text-plaeen-green text-nowrap" />{" "}
                  Screen Time
                </Heading>
              </div>
              <div className="flex bg-white/5 rounded-lg px-1 py-3 items-center justify-center mb-8 w-66 gap-4 mx-auto">
                {(["daily", "weekly", "monthly"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setScreenTimeView(v)}
                    className={`px-3 py-1 rounded-sm text-[12px] font-semibold uppercase  transition-all ${
                      screenTimeView === v
                        ? "bg-plaeen-green text-black"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="text-center mb-8">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="h-48 w-48 -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="12"
                      className="text-white/5"
                    />
                    <motion.circle
                      cx="96"
                      cy="96"
                      r="88"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="12"
                      strokeDasharray={552.92}
                      initial={{ strokeDashoffset: 552.92 }}
                      animate={{
                        strokeDashoffset: 552.92 - (552.92 * progress) / 100,
                      }}
                      className={cn(
                        "transition-colors duration-500",
                        isOvertime
                          ? "text-red-500"
                          : isTimeUp && !isSessionActive
                            ? "text-white/10"
                            : remainingMinutes <= 5
                              ? "text-yellow-500"
                              : "text-plaeen-green",
                      )}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.div
                      key={remainingSecondsTotal}
                      initial={
                        isSessionActive ? { scale: 1.1, opacity: 0.5 } : {}
                      }
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center"
                    >
                      <span
                        className={cn(
                          "font-bold   transition-colors",
                          isSessionActive ? "text-4xl" : "text-5xl",
                          isOvertime
                            ? "text-red-500"
                            : isTimeUp && !isSessionActive
                              ? "text-white/20"
                              : "text-white",
                        )}
                      >
                        {isSessionActive
                          ? `${isOvertime ? "-" : ""}${remainingMinutes}:${remainingSecondsDisplay.toString().padStart(2, "0")}`
                          : `${isOvertime ? "-" : ""}${remainingMinutes}`}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase  mt-1",
                          isOvertime
                            ? "text-red-500/60"
                            : isTimeUp && !isSessionActive
                              ? "text-white/10"
                              : "text-white/40",
                        )}
                      >
                        {isOvertime
                          ? "Overtime"
                          : isSessionActive
                            ? "Remaining"
                            : "Minutes Left"}
                      </span>
                    </motion.div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-2xl p-4 text-center">
                  <Text variant="caption" color="muted" as="p" className="mb-1">
                    Used Today
                  </Text>
                  <Text variant="body" color="primary" as="p">
                    {used}m
                  </Text>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 text-center">
                  <Text variant="caption" color="muted" as="p" className="mb-1">
                    Allowance
                  </Text>
                  <Text variant="body" color="accent" as="p">
                    {allowance}m
                  </Text>
                </div>
              </div>

              {/* Today's Adjustments Feedback */}
              {(() => {
                const todayStr = format(new Date(), "yyyy-MM-dd");
                const adjustments = [
                  ...(activeKid.screenTime?.todayAdjustments || []),
                ];

                // Add scheduled deductions for today that aren't already in adjustments (for legacy support)
                const scheduledToday = (
                  activeKid.screenTime?.scheduledDeductions || []
                )
                  .filter((d) => d.date === todayStr)
                  .filter((d) => !adjustments.some((a) => a.id === d.id));

                scheduledToday.forEach((d) => {
                  adjustments.push({
                    id: d.id,
                    type: "penalty",
                    minutes: d.minutes,
                    reason: "Scheduled Penalty",
                    timestamp: new Date().toISOString(),
                  });
                });

                if (adjustments.length === 0) return null;

                return (
                  <div className="mt-6 space-y-3">
                    {adjustments.map((adj, idx) => (
                      <motion.div
                        key={adj.id || idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "p-4 rounded-2xl border-2 flex items-center justify-between shadow-lg",
                          adj.type === "penalty"
                            ? "bg-red-500/10 border-red-500/20 text-red-500"
                            : "bg-plaeen-green/10 border-plaeen-green/20 text-plaeen-green",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              adj.type === "penalty"
                                ? "bg-red-500/20"
                                : "bg-plaeen-green/20",
                            )}
                          >
                            {adj.type === "penalty" ? (
                              <Clock size={16} />
                            ) : (
                              <Zap size={16} />
                            )}
                          </div>
                          <div>
                            <Text
                              variant="caption"
                              color="primary"
                              as="p"
                              className="mb-1"
                            >
                              {adj.minutes}m {adj.type} applied today
                            </Text>
                            <Text variant="caption" color="muted" as="p">
                              {adj.reason}
                            </Text>
                          </div>
                        </div>
                        <div className="text-sm font-black ">
                          {adj.type === "penalty" ? "-" : "+"}
                          {adj.minutes}m
                        </div>
                      </motion.div>
                    ))}
                  </div>
                );
              })()}

              {Boolean(
                activeKid.screenTime?.accumulatedTime &&
                activeKid.screenTime.accumulatedTime > 0,
              ) && (
                <div className="mt-6 p-4 rounded-2xl bg-plaeen-purple/10 border border-plaeen-purple/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Star size={16} className="text-plaeen-purple" />
                    <Text variant="caption" color="primary" as="span">
                      Bonus Time
                    </Text>
                  </div>
                  <Text variant="small" color="accent-secondary" as="span">
                    +{activeKid.screenTime.accumulatedTime}m
                  </Text>
                </div>
              )}
            </Card>

            <Card className="bg-plaeen-purple/10 border-plaeen-purple/20 p-8">
              <Heading
                level={2}
                variant="widget"
                className="mb-6 flex items-center gap-2"
              >
                <Trophy size={18} className="text-plaeen-purple" /> Streaks
              </Heading>
              <KidStreakWidget
                streak={
                  activeKid?.streak
                    ? {
                        ...activeKid.streak,
                        rewardMinutes:
                          typeof activeKid.streak.rewardMinutes === "number"
                            ? activeKid.streak.rewardMinutes
                            : undefined,
                      }
                    : { count: 0, history: {}, lastUpdate: "" }
                }
              />
            </Card>
          </div>

          {/* Middle Column: Activity & Sessions */}
          <div className="lg:col-span-2 space-y-12">
            <AnimatePresence>
              {showRewardClaimed && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-plaeen-green text-black p-6 rounded-2xl flex items-center justify-between shadow-[0_20px_50px_rgba(118,233,0,0.3)] border border-white/20 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-150 transition-transform duration-1000">
                    <Trophy size={80} />
                  </div>
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="h-16 w-16 bg-black/10 rounded-xl flex items-center justify-center">
                      <Zap size={32} />
                    </div>
                    <div>
                      <Heading level={3} variant="section" className="mb-1">
                        REWARD ACTIVATED!
                      </Heading>
                      <Text
                        variant="caption"
                        color="primary"
                        as="p"
                        className="opacity-70"
                      >
                        You gained +{activeKid?.streak?.rewardMinutes} mins
                        daily allowance for your hard work!
                      </Text>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRewardClaimed(false)}
                    className="text-black hover:bg-black/10"
                  >
                    <X size={20} />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <section className="space-y-6">
              <Heading
                level={2}
                variant="section"
                color="accent"
                className="flex items-center gap-3"
              >
                <Calendar size={16} /> Upcoming Sessions
              </Heading>
              <div className="grid md:grid-cols-2 gap-6">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "glass rounded-2xl p-6 duration-300 bg-white/5 border-white/10 hover:border-plaeen-green/30 transition-all group cursor-pointer relative overflow-hidden",
                        session.status === "proposed" && "border-amber-400/30",
                      )}
                      onClick={() => navigate(`/teams/${session.groupId}`)}
                    >
                      <div className="absolute top-0 right-0 p-3">
                        {session.status === "proposed" ? (
                          <span className="text-[8px] font-bold bg-amber-400 text-black px-2 py-1 rounded-full uppercase  animate-pulse">
                            Invitation
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold bg-plaeen-green text-black px-2 py-1 rounded-full uppercase ">
                            Scheduled
                          </span>
                        )}
                      </div>

                      <div className="flex gap-4">
                        {session.gameImage && (
                          <img
                            src={session.gameImage}
                            className="h-16 w-16 rounded-xl object-cover border border-white/10"
                            alt=""
                          />
                        )}
                        <div>
                          <Heading
                            level={3}
                            variant="widget"
                            className="group-hover:text-plaeen-green transition-colors"
                          >
                            {session.gameName}
                          </Heading>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className="text-white/40" />
                            <Text variant="caption" color="muted" as="span">
                              {format(
                                session.startTime.toDate(),
                                "EEE d, HH:mm",
                              )}
                            </Text>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Users size={12} className="text-white/40" />
                            <Text variant="caption" color="muted" as="span">
                              {
                                Object.values(session.responses || {}).filter(
                                  (r: any) => r.status === "accepted",
                                ).length
                              }{" "}
                              Accepted
                            </Text>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <Card className="md:col-span-2 bg-white/5 border-dashed border-white/10 p-12 text-center">
                    <Text variant="body" color="muted" as="p">
                      No sessions planned yet
                    </Text>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-6 px-6 py-3"
                    >
                      Invite Friends to Play
                    </Button>
                  </Card>
                )}
              </div>
            </section>

            {((activeKid.screenTime?.scheduledDeductions?.length || 0) > 0 ||
              (activeKid.screenTime?.bannedDates?.length || 0) > 0) && (
              <section className="space-y-6">
                <Heading
                  level={2}
                  variant="widget"
                  color="primary"
                  className="flex items-center gap-3"
                >
                  <Shield size={16} /> Active Penalties
                </Heading>
                <div className="grid md:grid-cols-2 gap-4">
                  {activeKid.screenTime?.scheduledDeductions?.map(
                    (deduction, idx) => (
                      <Card
                        key={`deduction-${idx}`}
                        className="bg-red-500/5 border-red-500/20 p-4 flex items-center gap-4"
                      >
                        <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                          <Clock size={20} className="text-red-500" />
                        </div>
                        <div>
                          <Text variant="small" color="primary" as="p">
                            -{deduction.minutes} Minutes
                          </Text>
                          <Text variant="caption" color="muted" as="p">
                            Scheduled for{" "}
                            {format(
                              new Date(deduction.date + "T12:00:00"),
                              "MMM d",
                            )}
                          </Text>
                        </div>
                      </Card>
                    ),
                  )}
                  {activeKid.screenTime?.bannedDates?.map((date, idx) => (
                    <Card
                      key={`ban-${idx}`}
                      className="bg-red-500/5 border-red-500/20 p-4 flex items-center gap-4"
                    >
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <Lock size={20} className="text-red-500" />
                      </div>
                      <div>
                        <Text variant="small" color="primary" as="p">
                          Access Restricted
                        </Text>
                        <Text variant="caption" color="muted" as="p">
                          On {format(new Date(date + "T12:00:00"), "MMM d")}
                        </Text>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-6">
              <Heading
                level={2}
                variant="section"
                color="accent"
                className="flex items-center gap-3"
              >
                <Activity size={16} /> Recent Activity
              </Heading>
              <Card className="bg-white/5 border-white/10 p-8">
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-plaeen-green/10 flex items-center justify-center">
                        <Gamepad2 size={20} className="text-plaeen-green" />
                      </div>
                      <div>
                        <Text variant="small" color="primary" as="p">
                          Minecraft Session
                        </Text>
                        <Text variant="caption" color="muted" as="p">
                          Today • 45 Minutes
                        </Text>
                      </div>
                    </div>
                    <Text variant="caption" color="accent" as="span">
                      Completed
                    </Text>
                  </div>
                </div>
              </Card>
            </section>
          </div>
        </div>
      </div>

      {/* Chore Modal */}
      <AnimatePresence>
        {isChoreModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <div className="w-full max-w-md border border-plaeen-purple-medium p-10 rounded-2xl shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <Heading level={2} variant="section">
                  Log Activity
                </Heading>
                <button
                  onClick={() => setIsChoreModalOpen(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <Text variant="small" color="muted" as="p" className="mb-8">
                Tell your parents what you've done to earn extra screen time!
              </Text>

              {choreSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 text-center"
                >
                  <div className="h-20 w-20 rounded-full bg-plaeen-green/20 flex items-center justify-center mx-auto mb-6">
                    <Check size={40} className="text-plaeen-green" />
                  </div>
                  <Heading level={3} variant="section" className="mb-2">
                    Activity Sent!
                  </Heading>
                  <Text variant="caption" color="muted" as="p">
                    Waiting for parent approval
                  </Text>
                </motion.div>
              ) : (
                <form onSubmit={handleAddChore} className="space-y-6">
                  <div>
                    <Label variant="button" as="label" className="mb-2 block">
                      What did you do?
                    </Label>
                    <input
                      type="text"
                      value={choreTitle}
                      onChange={(e) => setChoreTitle(e.target.value)}
                      placeholder="E.G. DID THE DISHES, CLEANED ROOM"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/10 focus:border-plaeen-purple focus:outline-none transition-all uppercase  text-sm"
                      required
                      disabled={isSubmittingChore}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmittingChore}
                    className="w-full py-6 bg-plaeen-purple hover:bg-plaeen-purple/80 text-white font-bold uppercase "
                  >
                    {isSubmittingChore ? "Sending..." : "Send for Approval"}
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overtime Warning Overlay */}
      <AnimatePresence>
        {showOvertimeWarning && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6 pointer-events-none"
          >
            <div className="bg-red-600 rounded-2xl p-6 shadow-2xl flex items-center justify-between pointer-events-auto relative overflow-hidden border border-red-500/50">
              {/* Solid background to prevent backdrop-blur artifacts from elements behind */}
              <div className="absolute inset-0 bg-red-600" />

              <div className="flex items-center gap-4 relative z-10">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Bell size={24} className="text-white" />
                </div>
                <div>
                  <Text variant="small" color="primary" as="p">
                    Time is Up!
                  </Text>
                  <Text variant="caption" color="primary" as="p">
                    {remainingMinutes < 5
                      ? `Finish in ${5 - remainingMinutes}m to avoid penalty`
                      : "Penalty applied! End session now"}
                  </Text>
                </div>
              </div>
              <Button
                onClick={handleEndSession}
                className="bg-white text-red-600 hover:bg-white/90 font-bold uppercase  text-[10px] px-6 relative z-10"
              >
                End Now
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
function increment(rewardMinutes: number | boolean): unknown {
  throw new Error("Function not implemented.");
}
