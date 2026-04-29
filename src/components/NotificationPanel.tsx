import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebase";
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
  MoreVertical,
  Shield,
  Users,
  UserPlus,
  Star,
  Gamepad2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { cn, formatName, safeToDate } from "../lib/utils";
import { format } from "date-fns";
import { handleFirestoreError } from "../lib/firestoreUtils";
import { useProfile } from "@/contexts/ProfileContext";
import type { Notification, NotificationPanelProps } from "@/lib/types";

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  userId,
  isOpen,
  onClose,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);
  const navigate = useNavigate();

  const { activeKid, parentProfile, isParentViewingKid } = useProfile();
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (!userId || !isOpen || !user) return;

    let q;
    if (isParentViewingKid) {
      q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("parentId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(20),
      );
    } else {
      q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(20),
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification),
        );
      },
      (err) => {
        console.error("Notifications listener error:", err);
        handleFirestoreError(err, "list", "notifications");
      },
    );

    return () => unsubscribe();
  }, [userId, isOpen, user, isParentViewingKid]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
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

    try {
      if (gid) {
        const groupRef = doc(db, "groups", gid);
        if (accept) {
          // Check for name collision in user's existing teams
          const teamsQuery = query(
            collection(db, "groups"),
            where("members", "array-contains", userId),
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
            await updateDoc(doc(db, "users", userId), {
              [`teamAliases.${gid}`]: alias,
            });
          }

          await updateDoc(groupRef, {
            members: arrayUnion(userId),
            pendingMembers: arrayRemove(userId),
            ...(activeKid?.parentId
              ? { parentIds: arrayUnion(activeKid.parentId) }
              : {}),
          });

          await addDoc(collection(db, "groups", gid, "events"), {
            type: "member_joined",
            userId: userId,
            userName:
              activeKid?.displayName ||
              parentProfile?.displayName ||
              "Anonymous",
            createdAt: serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
          });
        } else {
          await updateDoc(groupRef, {
            pendingMembers: arrayRemove(userId),
          });
        }

        // Delete the specific notification by ID
        if (notificationId) {
          await deleteDoc(doc(db, "notifications", notificationId));
        }

        // Also find and delete any other notifications from this same team
        let qClean;
        if (isParentViewingKid) {
          qClean = query(
            collection(db, "notifications"),
            where("userId", "==", userId),
            where("parentId", "==", user?.uid),
            where("type", "==", "team_invite"),
          );
        } else {
          qClean = query(
            collection(db, "notifications"),
            where("userId", "==", userId),
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
        // This prevents the real-time listener from re-adding it
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
      showFeedback("Update failed", "info");
    }
  };

  const handleFriendRequest = async (notif: any, accept: boolean) => {
    const fromId = notif.fromId || notif.data?.fromId;
    const notificationId = notif.id;

    try {
      if (accept) {
        // Find the friend request document
        let requestId = notif.requestId || notif.data?.requestId;
        if (!requestId && fromId) {
          const q = query(
            collection(db, "friendRequests"),
            where("fromId", "==", fromId),
            where("toId", "==", userId),
            where("status", "==", "pending"),
          );
          const snap = await getDocs(q);
          if (!snap.empty) requestId = snap.docs[0].id;
        }

        if (requestId && fromId) {
          const batch = writeBatch(db);

          batch.update(doc(db, "friendRequests", requestId), {
            status: "accepted",
          });

          batch.update(doc(db, "users", userId), {
            friends: arrayUnion(fromId),
          });

          batch.update(doc(db, "users", fromId), {
            friends: arrayUnion(userId),
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
                fromId: userId,
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
        // Reject logic
        let requestId = notif.requestId || notif.data?.requestId;
        if (!requestId) {
          const q = query(
            collection(db, "friendRequests"),
            where("fromId", "==", fromId),
            where("toId", "==", userId),
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
              where("userId", "==", userId),
              where("parentId", "==", user?.uid),
              where("type", "==", "friend_request"),
            );
          } else {
            qClean = query(
              collection(db, "notifications"),
              where("userId", "==", userId),
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

    onClose();

    // Navigation logic
    switch (notif.type) {
      case "friend_request":
        navigate("/friends");
        break;
      case "friend_accepted":
        navigate("/friends");
        break;
      case "team_invite":
        navigate("/notifications");
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
        // Default to dashboard if unknown
        navigate(
          userId.startsWith("kid_") ? "/kid-dashboard" : "/parent-dashboard",
        );
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "decision":
        return <Shield size={16} className="text-plaeen-purple" />;
      case "team_invite":
        return <Users size={16} className="text-plaeen-green" />;
      case "friend_request":
        return <UserPlus size={16} className="text-amber-500" />;
      case "friend_accepted":
        return <Star size={16} className="text-plaeen-green" />;
      case "game_approval":
        return <Gamepad2 size={16} className="text-plaeen-green" />;
      default:
        return <Bell size={16} className="text-white/40" />;
    }
  };

  const requiresAction = (type: string) => {
    return ["friend_request", "team_invite", "overtime"].includes(type);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute right-0 top-full mt-2 w-80 md:w-96 rounded-2xl bg-plaeen-dark border border-white/10 shadow-2xl z-[70] overflow-hidden backdrop-blur-xl"
        >
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h3 className="text-xs font-bold text-white uppercase ">
              Notifications
            </h3>
          </div>

          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  "px-4 py-2 border-b font-bold uppercase  text-[8px] text-center",
                  feedback.type === "success"
                    ? "bg-plaeen-green/10 text-plaeen-green border-plaeen-green/20"
                    : "bg-white/5 text-white/40 border-white/10",
                )}
              >
                {feedback.message}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-12 text-center">
                <Bell size={32} className="mx-auto text-white/5 mb-4" />
                <p className="text-[10px] font-bold text-white/20 uppercase ">
                  All clear
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`group relative p-4 hover:bg-white/5 transition-all cursor-pointer ${!notif.read ? "bg-plaeen-green/5" : ""}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex gap-4">
                      <div className="mt-1 h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p
                            className={`text-[10px] font-bold uppercase tracking-tight truncate ${!notif.read ? "text-white" : "text-white/60"}`}
                          >
                            {formatName(notif.title)}
                          </p>
                          <span className="text-[8px] font-bold text-white/20 uppercase  shrink-0">
                            {notif.createdAt
                              ? format(safeToDate(notif.createdAt), "HH:mm")
                              : "Just now"}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 font-medium  mb-3">
                          {notif.message}
                        </p>

                        {/* Action Buttons for specific types - showing always as fulfilled items are deleted */}
                        {notif.type === "team_invite" && (
                          <div
                            className="flex gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              onClick={() => handleTeamInvite(notif, true)}
                              className="bg-plaeen-green text-black text-[8px] font-bold uppercase  px-3 py-1.5 h-auto"
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTeamInvite(notif, false)}
                              className="border-white/10 text-white/40 text-[8px] font-bold uppercase  px-3 py-1.5 h-auto"
                            >
                              Decline
                            </Button>
                          </div>
                        )}

                        {notif.type === "friend_request" && (
                          <div
                            className="flex gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              onClick={() => handleFriendRequest(notif, true)}
                              className="bg-plaeen-green text-black text-[8px] font-bold uppercase  px-3 py-1.5 h-auto"
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFriendRequest(notif, false)}
                              className="border-white/10 text-white/40 text-[8px] font-bold uppercase  px-3 py-1.5 h-auto"
                            >
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate("/friends")}
                              className="text-white/20 text-[6px] font-bold uppercase  px-2 py-1.5 h-auto ml-auto"
                            >
                              View
                            </Button>
                          </div>
                        )}
                      </div>
                      {!notif.read && (
                        <div className="shrink-0 mt-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-white/5 bg-white/5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[8px] font-bold uppercase  text-white/40 hover:text-white"
              onClick={() => {
                onClose();
                navigate("/notifications");
              }}
            >
              View All Notifications
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
