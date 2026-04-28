import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc,
  addDoc,
  getDocs,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import {
  Bell,
  X,
  Check,
  Trash2,
  Shield,
  Users,
  UserPlus,
  Star,
  Gamepad2,
  ArrowLeft,
  Clock,
  MoreVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { useProfile } from "../contexts/ProfileContext";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { cn, formatName, safeToDate } from "../lib/utils";
import { handleFirestoreError } from "../lib/firestoreUtils";
import { format, isToday, isYesterday, subDays, isAfter } from "date-fns";
import type { Notification } from "@/lib/types";

export const NotificationsPage = () => {
  const [user] = useAuthState(auth);
  const { activeKid, parentProfile, isParentViewingKid } = useProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const navigate = useNavigate();

  const activeUid = activeKid?.uid || user?.uid;

  useEffect(() => {
    if (!activeUid || !user) return;

    let q;
    if (isParentViewingKid) {
      q = query(
        collection(db, "notifications"),
        where("userId", "==", activeUid),
        where("parentId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(100),
      );
    } else {
      q = query(
        collection(db, "notifications"),
        where("userId", "==", activeUid),
        orderBy("createdAt", "desc"),
        limit(100),
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification),
        );
        setLoading(false);
      },
      (error) => handleFirestoreError(error, "list", "notifications"),
    );

    return () => unsubscribe();
  }, [activeUid, user, isParentViewingKid]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      setActiveMenu(null);
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      await handleMarkAsRead(n.id);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
      setActiveMenu(null);
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const showFeedback = (
    message: string,
    type: "success" | "info" = "success",
  ) => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleTeamInvite = async (notif: any, accept: boolean) => {
    const gid =
      notif.data?.groupId ||
      notif.data?.teamId ||
      notif.groupId ||
      notif.teamId;
    const teamName = notif.data?.teamName || notif.teamName || "New Team";
    const notificationId = notif.id;
    if (!activeUid || !activeKid) return;

    try {
      if (gid) {
        const groupRef = doc(db, "groups", gid);
        if (accept) {
          // Check for name collision in user's existing teams
          const teamsQuery = query(
            collection(db, "groups"),
            where("members", "array-contains", activeUid),
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
            await updateDoc(doc(db, "users", activeUid), {
              [`teamAliases.${gid}`]: alias,
            });
          }

          await updateDoc(groupRef, {
            members: arrayUnion(activeUid),
            pendingMembers: arrayRemove(activeUid),
            ...(activeKid?.parentId
              ? { parentIds: arrayUnion(activeKid.parentId) }
              : {}),
          });

          // Add team event for member joined
          await addDoc(collection(db, "groups", gid, "events"), {
            type: "member_joined",
            userId: activeUid,
            userName:
              activeKid?.displayName ||
              parentProfile?.displayName ||
              "Anonymous",
            createdAt: serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
        } else {
          await updateDoc(groupRef, {
            pendingMembers: arrayRemove(activeUid),
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
            where("userId", "==", activeUid),
            where("parentId", "==", user?.uid),
            where("type", "==", "team_invite"),
          );
        } else {
          qClean = query(
            collection(db, "notifications"),
            where("userId", "==", activeUid),
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
            const nGid =
              n.data?.groupId || n.data?.teamId || n.groupId || n.teamId;
            return nGid !== gid;
          }),
        );

        showFeedback(
          accept ? "You just joined the team!" : "Invitation declined",
          accept ? "success" : "info",
        );
      } else {
        await deleteDoc(doc(db, "notifications", notif.id));
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
        showFeedback("Invitation declined", "info");
      }
    } catch (err) {
      console.error("Error handling team invite:", err);
      showFeedback("Update failed. Please try again.", "info");
    }
  };

  const handleFriendRequest = async (notif: any, accept: boolean) => {
    const fromId = notif.fromId || notif.data?.fromId;
    const notificationId = notif.id;
    if (!activeUid || !activeKid) return;

    try {
      if (accept) {
        let requestId = notif.requestId || notif.data?.requestId;
        if (!requestId && fromId) {
          const q = query(
            collection(db, "friendRequests"),
            where("fromId", "==", fromId),
            where("toId", "==", activeUid),
            where("status", "==", "pending"),
          );
          const snap = await getDocs(q);
          if (!snap.empty) requestId = snap.docs[0].id;
        }

        if (requestId && fromId) {
          await updateDoc(doc(db, "friendRequests", requestId), {
            status: "accepted",
          });
          await updateDoc(doc(db, "users", activeUid), {
            friends: arrayUnion(fromId),
          });
          await updateDoc(doc(db, "users", fromId), {
            friends: arrayUnion(activeUid),
          });

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
                fromId: activeUid,
              });
            }
          } catch (notificationErr) {
            console.warn("Friend accepted notification failed:", notificationErr);
          }
        }
      } else if (fromId) {
        let requestId = notif.requestId || notif.data?.requestId;
        if (!requestId) {
          const q = query(
            collection(db, "friendRequests"),
            where("fromId", "==", fromId),
            where("toId", "==", activeUid),
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
          let qClean;
          if (isParentViewingKid) {
            qClean = query(
              collection(db, "notifications"),
              where("userId", "==", activeUid),
              where("parentId", "==", user?.uid),
              where("type", "==", "friend_request"),
            );
          } else {
            qClean = query(
              collection(db, "notifications"),
              where("userId", "==", activeUid),
              where("type", "==", "friend_request"),
            );
          }
          const snap = await getDocs(qClean);
          const batch = writeBatch(db);
          snap.docs.forEach((d) => {
            const dData = d.data() as any;
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

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }

    // Navigation logic
    switch (notif.type) {
      case "friend_request":
        navigate("/friends");
        break;
      case "friend_accepted":
        navigate("/friends");
        break;
      case "team_invite":
        // Already on notifications page, buttons are visible
        break;
      case "decision":
        navigate("/kid-dashboard");
        break;
      case "game_approval":
        navigate("/parent/approvals");
        break;
      case "overtime":
        navigate(`/parent/overtime-decision/${notif.id}`);
        break;
      default:
        // Stay on page if no specific target
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "decision":
        return <Shield size={20} className="text-plaeen-purple" />;
      case "team_invite":
        return <Users size={20} className="text-plaeen-green" />;
      case "friend_request":
        return <UserPlus size={20} className="text-amber-500" />;
      case "friend_accepted":
        return <Star size={20} className="text-plaeen-green" />;
      case "game_approval":
        return <Gamepad2 size={20} className="text-plaeen-green" />;
      default:
        return <Bell size={20} className="text-white/40" />;
    }
  };

  const requiresAction = (type: string) => {
    return ["friend_request", "team_invite", "overtime"].includes(type);
  };

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  const groupedNotifications = notifications.reduce((groups: any, notif) => {
    const date = safeToDate(notif.createdAt);
    const label = formatDateLabel(date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(notif);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-plaeen-green"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green font-bold uppercase  text-[10px] mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            Inbox <span className="text-plaeen-green">Center</span>
          </h1>
          <p className="text-white/40 font-bold uppercase  text-xs mt-2">
            Manage your alerts and invitations
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <Button
            variant="outline"
            onClick={markAllAsRead}
            className="border-white/10 text-white/40 hover:text-white hover:border-white/20 text-[10px] font-bold uppercase "
          >
            Mark all as read
          </Button>
        )}
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className={cn(
              "mb-8 p-4 rounded-2xl border font-bold uppercase  text-xs text-center shadow-lg",
              feedback.type === "success"
                ? "bg-plaeen-green/10 text-plaeen-green border-plaeen-green/20"
                : "bg-white/5 text-white/40 border-white/10",
            )}
          >
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-12">
        {Object.keys(groupedNotifications).length === 0 ? (
          <Card className="bg-white/5 border-dashed border-white/10 p-20 text-center">
            <Bell size={48} className="mx-auto text-white/5 mb-6" />
            <p className="text-white/20 font-bold uppercase ">
              Your inbox is empty
            </p>
          </Card>
        ) : (
          Object.entries(groupedNotifications).map(
            ([label, items]: [string, any]) => (
              <div key={label} className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-white/20 uppercase  whitespace-nowrap">
                    {label}
                  </span>
                  <div className="h-px w-full bg-white/5" />
                </div>

                <div className="space-y-4">
                  {items.map((notif: Notification) => (
                    <Card
                      key={notif.id}
                      className={`group relative bg-white/5 border-white/10 p-6 transition-all hover:bg-white/[0.07] ${!notif.read ? "border-l-4 border-l-plaeen-green" : "opacity-60"} ${activeMenu === notif.id ? "z-50" : "z-0"}`}
                    >
                      <div className="flex justify-between items-start gap-6">
                        <div
                          className="flex gap-6 flex-1"
                          onClick={() => handleNotificationClick(notif)}
                          style={{ cursor: "pointer" }}
                        >
                          <div
                            className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${
                              notif.type === "decision"
                                ? "bg-plaeen-purple/10 text-plaeen-purple"
                                : notif.type === "team_invite"
                                  ? "bg-plaeen-green/10 text-plaeen-green"
                                  : notif.type === "friend_request"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "bg-white/5 text-white/40"
                            }`}
                          >
                            {getIcon(notif.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-[10px] font-bold text-plaeen-green uppercase ">
                                {notif.title}
                              </span>
                              <span className="text-[8px] text-white/20 uppercase ">
                                • {format(safeToDate(notif.createdAt), "HH:mm")}
                              </span>
                              {!notif.read && (
                                <span className="text-[8px] font-bold text-plaeen-green uppercase  bg-plaeen-green/10 px-2 py-0.5 rounded">
                                  New
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white/60 font-medium  mb-4">
                              {notif.message}
                            </p>

                            {/* Action Buttons - Always show if notification exists, as it's deleted upon fulfillment */}
                            {notif.type === "team_invite" && (
                              <div
                                className="flex gap-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  size="sm"
                                  onClick={() => handleTeamInvite(notif, true)}
                                  className="bg-plaeen-green text-black text-[10px] font-bold uppercase  px-6 py-2"
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTeamInvite(notif, false)}
                                  className="border-white/10 text-white/40 text-[10px] font-bold uppercase  px-6 py-2"
                                >
                                  Decline
                                </Button>
                              </div>
                            )}

                            {notif.type === "friend_request" && (
                              <div
                                className="flex gap-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleFriendRequest(notif, true)
                                  }
                                  className="bg-plaeen-green text-black text-[10px] font-bold uppercase  px-6 py-2"
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleFriendRequest(notif, false)
                                  }
                                  className="border-white/10 text-white/40 text-[10px] font-bold uppercase  px-6 py-2"
                                >
                                  Decline
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate("/friends")}
                                  className="text-white/20 text-[8px] font-bold uppercase  px-4 py-2 ml-auto"
                                >
                                  View
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Options Menu */}
                        {!requiresAction(notif.type) && (
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveMenu(
                                  activeMenu === notif.id ? null : notif.id,
                                )
                              }
                              className="p-2 text-white/20 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                            >
                              <MoreVertical size={20} />
                            </button>

                            <AnimatePresence>
                              {activeMenu === notif.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setActiveMenu(null)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    className="absolute right-0 mt-2 w-48 rounded-2xl bg-plaeen-dark border border-white/10 shadow-2xl p-1 z-20 overflow-hidden"
                                  >
                                    {!notif.read && (
                                      <button
                                        onClick={() =>
                                          handleMarkAsRead(notif.id)
                                        }
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-bold text-white/60 hover:text-plaeen-green hover:bg-plaeen-green/5 transition-all uppercase "
                                      >
                                        <Check size={14} /> Mark as Read
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDelete(notif.id)}
                                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-bold text-red-400 hover:bg-red-400/5 transition-all uppercase "
                                    >
                                      <Trash2 size={14} /> Delete Alert
                                    </button>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
};
