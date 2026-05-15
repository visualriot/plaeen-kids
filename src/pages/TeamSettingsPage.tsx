import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "@/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { useProfile } from "@/contexts/ProfileContext";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import {
  ChevronLeft,
  Trash2,
  Shield,
  UserPlus,
  Image as ImageIcon,
  Check,
  X,
  LogOut,
  Settings,
  Plus,
  Sparkles,
} from "lucide-react";
import { cn, getUserAvatar } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Team, UserProfile } from "@/lib/types";

export const TeamSettingsPage = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const { activeKid: kidData, role, parentProfile } = useProfile();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [isUpdating, setIsUpdating] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: "leave" | "delete";
    targetId?: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);

  const activeUid = kidData ? kidData.uid : user?.uid;

  useEffect(() => {
    if (!teamId || !activeUid) return;

    const unsubscribe = onSnapshot(
      doc(db, "groups", teamId),
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.id
            ? ({ id: docSnap.id, ...docSnap.data() } as Team)
            : null;
          if (data) {
            // Check if user is still a member
            if (
              !data.members.includes(activeUid) &&
              !(data.pendingMembers || []).includes(activeUid)
            ) {
              // If we just left, the listener might trigger one last time
              // We'll navigate away
              navigate("/teams");
              return;
            }

            setTeam(data);
            setEditingName(data.name);
            setSelectedAvatar(data.imageURL || "");

            // Fetch member profiles
            const membersQuery = query(
              collection(db, "users_public"),
              where("uid", "in", data.members),
            );
            const membersSnap = await getDocs(membersQuery);
            setMembers(membersSnap.docs.map((d) => d.data() as UserProfile));
          }
        } else {
          navigate("/teams");
        }
        setLoading(false);
      },
    );

    // Fetch friends for inviting
    const fetchFriends = async () => {
      const userDoc = await getDoc(doc(db, "users", activeUid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friends || [];
        if (friendIds.length > 0) {
          const friendsQuery = query(
            collection(db, "users_public"),
            where("uid", "in", friendIds),
          );
          const friendsSnap = await getDocs(friendsQuery);
          setFriends(friendsSnap.docs.map((d) => d.data() as UserProfile));
        }
      }
    };
    fetchFriends();

    return () => unsubscribe();
  }, [teamId, activeUid, navigate]);

  const showFeedback = (
    message: string,
    type: "success" | "info" = "success",
  ) => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleUpdateBasic = async () => {
    if (!team || !editingName.trim()) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "groups", team.id), {
        name: editingName,
        imageURL: selectedAvatar,
      });
      showFeedback("Team settings updated!");
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleAdmin = async (
    memberId: string,
    isCurrentlyAdmin: boolean,
  ) => {
    if (!team) return;
    try {
      await updateDoc(doc(db, "groups", team.id), {
        adminIds: isCurrentlyAdmin
          ? arrayRemove(memberId)
          : arrayUnion(memberId),
      });
      showFeedback(
        isCurrentlyAdmin ? "Admin rights removed" : "New admin assigned",
        "info",
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!team) return;
    try {
      await updateDoc(doc(db, "groups", team.id), {
        members: arrayRemove(memberId),
        adminIds: arrayRemove(memberId),
      });
      showFeedback("Member removed from team", "info");
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveTeam = async () => {
    if (!team || !activeUid) return;
    try {
      await updateDoc(doc(db, "groups", team.id), {
        members: arrayRemove(activeUid),
        adminIds: arrayRemove(activeUid),
      });
      setConfirmModal(null);
      navigate("/teams");
    } catch (err) {
      console.error("Error leaving team:", err);
      // Close modal anyway to avoid UI lock
      setConfirmModal(null);
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    try {
      const batch = writeBatch(db);

      // Delete the group itself
      batch.delete(doc(db, "groups", team.id));

      // Cleanup associated notifications (invites)
      const q = query(
        collection(db, "notifications"),
        where("type", "==", "team_invite"),
        where("data.groupId", "==", team.id),
      );
      const inviteSnaps = await getDocs(q);
      inviteSnaps.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();

      setConfirmModal(null);
      navigate("/teams");
    } catch (err) {
      console.error("Error deleting team:", err);
      // Close modal anyway to avoid UI lock
      setConfirmModal(null);
    }
  };

  const inviteFriend = async (friendId: string) => {
    if (!team || !activeUid) return;
    try {
      await updateDoc(doc(db, "groups", team.id), {
        pendingMembers: arrayUnion(friendId),
      });

      // Send notification
      await addDoc(collection(db, "notifications"), {
        userId: friendId,
        type: "team_invite",
        title: "Team Invitation",
        message: `${kidData?.displayName || parentProfile?.displayName || "A friend"} invited you to join the team "${team.name}"`,
        data: {
          groupId: team.id,
          teamName: team.name,
          invitedBy: activeUid,
          invitedByName:
            kidData?.displayName || parentProfile?.displayName || "A friend",
        },
        read: false,
        createdAt: serverTimestamp(),
      });

      showFeedback("Invitation sent!");
      setIsAddMemberOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !team)
    return (
      <div className="flex h-screen items-center justify-center bg-plaeen-dark">
        <div className="text-white font-bold uppercase  animate-pulse">
          Scanning Data...
        </div>
      </div>
    );

  const hasAdminRights =
    (team.adminIds || []).includes(activeUid || "") ||
    (team.parentIds || []).includes(user?.uid || "");
  const canLeave = (team.members || []).length > 1;

  const sortedMembers = [...members].sort((a, b) => {
    const aIsAdmin = (team.adminIds || []).includes(a.uid);
    const bIsAdmin = (team.adminIds || []).includes(b.uid);
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    return 0;
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green transition-colors font-bold uppercase  text-xs mb-12"
      >
        <ChevronLeft size={16} /> Back to sector
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
        <div>
          <h1 className="font-display text-6xl font-bold text-white uppercase tracking-tighter mb-4">
            Team <span className="text-plaeen-green">Settings</span>
          </h1>
          <p className="text-sm font-bold text-white/40 uppercase ">
            {team.name} • Protocol ID: {team.id.substring(0, 8)}
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          {hasAdminRights ? (
            <Button
              variant="outline"
              onClick={() => setConfirmModal({ type: "delete" })}
              className="border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-bold uppercase  py-6"
            >
              <Trash2 size={18} className="mr-2" /> Delete Team
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => setConfirmModal({ type: "leave" })}
            className="text-white/40 hover:text-white font-bold uppercase  py-6"
          >
            <LogOut size={18} className="mr-2" /> Leave Team
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {/* Members List Section */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-bold uppercase  text-plaeen-green flex items-center gap-3">
                <Shield size={16} /> Team Roster
              </h2>
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="flex items-center gap-2 text-plaeen-green hover:text-white transition-colors text-xs font-bold uppercase "
              >
                <Plus size={16} /> Add Member
              </button>
            </div>

            <Card className="bg-white/5 border-white/5 p-6 space-y-4">
              {sortedMembers.map((member) => {
                const isMemberAdmin = (team.adminIds || []).includes(
                  member.uid,
                );
                const isMe = member.uid === activeUid;

                return (
                  <div
                    key={member.uid}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl bg-white/5 border transition-all group",
                      isMemberAdmin
                        ? "border-plaeen-green/30"
                        : "border-white/5 hover:border-white/20",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-xl p-1 bg-plaeen-dark relative",
                          isMemberAdmin
                            ? "border-2 border-plaeen-green"
                            : "border border-white/10",
                        )}
                      >
                        <img
                          src={getUserAvatar(member.photoURL)}
                          className="h-full w-full rounded-lg object-cover"
                        />
                        {isMemberAdmin && (
                          <div className="absolute -top-1 -right-1 bg-plaeen-green rounded-full p-1 shadow-lg">
                            <Shield size={10} className="text-black" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white uppercase">
                            {member.displayName} {isMe && "(You)"}
                          </p>
                          <span
                            className={cn(
                              "text-[8px] font-bold uppercase  px-2 py-0.5 rounded",
                              isMemberAdmin
                                ? "bg-plaeen-green/10 text-plaeen-green"
                                : "bg-white/5 text-white/40",
                            )}
                          >
                            {isMemberAdmin ? "Admin" : "Member"}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 font-bold uppercase ">
                          @{member.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasAdminRights && !isMe && (
                        <>
                          <button
                            onClick={() =>
                              handleToggleAdmin(member.uid, isMemberAdmin)
                            }
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase  transition-all",
                              isMemberAdmin
                                ? "bg-plaeen-green/20 text-plaeen-green border border-plaeen-green/30"
                                : "bg-white/5 text-white/40 hover:text-white",
                            )}
                          >
                            {isMemberAdmin ? "Remove Admin" : "Assign Admin"}
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.uid)}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      {isMe && !isMemberAdmin && (
                        <button
                          onClick={() => setConfirmModal({ type: "leave" })}
                          className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-[8px] font-bold uppercase "
                        >
                          Leave Team
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>

          {/* Pending Members */}
          {team.pendingMembers && team.pendingMembers.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold uppercase  text-amber-500 flex items-center gap-3 mb-8">
                <Sparkles size={16} /> Pending Invitations
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {team.pendingMembers.map((id) => {
                  const friend = friends.find((f) => f.uid === id);
                  return (
                    <Card
                      key={id}
                      className="bg-white/5 border-white/5 p-4 flex items-center gap-3 opacity-60"
                    >
                      <div className="h-8 w-8 rounded-full bg-white/10 overflow-hidden">
                        <img
                          src={getUserAvatar(friend?.photoURL)}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="truncate">
                        <p className="text-[10px] font-bold text-white uppercase truncate">
                          {friend?.displayName || "Scanning..."}
                        </p>
                      </div>
                      {hasAdminRights && (
                        <button
                          onClick={() =>
                            updateDoc(doc(db, "groups", team.id), {
                              pendingMembers: arrayRemove(id),
                            })
                          }
                          className="ml-auto text-white/20 hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-12">
          {/* Identity Section - Now available to all members */}
          <section>
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-green mb-8 flex items-center gap-3">
              <ImageIcon size={16} /> Team Identity
            </h2>
            <Card className="bg-white/5 border-white/5 p-8 space-y-10">
              <div>
                <label className="block text-[8px] font-bold uppercase  text-white/40 mb-4">
                  Team Avatar
                </label>
                <div className="flex flex-col gap-6">
                  <div className="aspect-square rounded-[2.5rem] overflow-hidden border-4 border-plaeen-green shadow-2xl bg-plaeen-dark/50 p-2">
                    {selectedAvatar ? (
                      <img
                        src={selectedAvatar}
                        className="h-full w-full object-cover rounded-[2rem]"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-white/10 uppercase font-black text-4xl">
                        ?
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/team-avatar-selection?teamId=${teamId}&returnTo=${encodeURIComponent(window.location.pathname)}`,
                      )
                    }
                    className="w-full py-4 text-xs font-bold uppercase  border-plaeen-green/30 text-plaeen-green hover:bg-plaeen-green/10"
                  >
                    Select New Avatar
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-[8px] font-bold uppercase  text-white/40 mb-4">
                  Team Callsign
                </label>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold uppercase focus:border-plaeen-green focus:outline-none transition-all placeholder:text-white/10"
                  placeholder="Enter Name"
                />
              </div>

              <Button
                onClick={handleUpdateBasic}
                className="w-full py-6 font-bold uppercase  shadow-[0_0_20px_rgba(118,233,0,0.2)]"
                disabled={isUpdating || !editingName.trim()}
              >
                {isUpdating ? "Synchronizing..." : "Save Configuration"}
              </Button>
            </Card>
          </section>
        </div>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <Card className="w-full max-w-md bg-plaeen-dark border-plaeen-green/30 p-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-bold text-white uppercase tracking-tighter">
                  Invite Players
                </h2>
                <button
                  onClick={() => setIsAddMemberOpen(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X size={32} />
                </button>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {friends
                  .filter(
                    (f) =>
                      !team.members.includes(f.uid) &&
                      !(team.pendingMembers || []).includes(f.uid),
                  )
                  .map((friend) => (
                    <div
                      key={friend.uid}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-4 text-left">
                        <img
                          src={getUserAvatar(friend.photoURL)}
                          className="h-10 w-10 rounded-full"
                        />
                        <div>
                          <p className="text-sm font-bold text-white uppercase">
                            {friend.displayName}
                          </p>
                          <p className="text-[10px] text-white/40 font-bold uppercase ">
                            @{friend.username}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => inviteFriend(friend.uid)}
                        className="h-10 px-6"
                      >
                        Invite
                      </Button>
                    </div>
                  ))}
                {friends.filter(
                  (f) =>
                    !team.members.includes(f.uid) &&
                    !(team.pendingMembers || []).includes(f.uid),
                ).length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-white/20 font-bold uppercase  text-xs">
                      All friends are already in high command
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <Card className="w-full max-w-md bg-plaeen-dark border-red-500/30 p-10 text-center">
              <div
                className={cn(
                  "h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-6",
                  confirmModal.type === "delete"
                    ? "bg-red-500/10"
                    : "bg-amber-500/10",
                )}
              >
                {confirmModal.type === "delete" ? (
                  <Trash2 size={32} className="text-red-500" />
                ) : (
                  <LogOut size={32} className="text-amber-500" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-tighter mb-4">
                {confirmModal.type === "delete"
                  ? "Decommission Team?"
                  : "Leave Sector?"}
              </h2>
              <p className="text-white/40 text-sm mb-10 font-bold uppercase  ">
                {confirmModal.type === "delete"
                  ? "This will permanently purge all team history, shared games, and scheduled sessions. This action is terminal."
                  : "You will lose access to team channels, sessions, and shared game history."}
              </p>
              <div className="flex flex-col gap-4">
                <Button
                  onClick={() =>
                    confirmModal.type === "delete"
                      ? handleDeleteTeam()
                      : handleLeaveTeam()
                  }
                  className={cn(
                    "w-full py-6 font-bold uppercase ",
                    confirmModal.type === "delete"
                      ? "bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                      : "bg-amber-500 hover:bg-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.3)]",
                  )}
                >
                  Confirm Protocol
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmModal(null)}
                  className="w-full text-white/40 hover:text-white font-bold uppercase  py-6"
                >
                  Abort
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Alert */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div
              className={cn(
                "px-8 py-4 rounded-2xl flex items-center gap-4 backdrop-blur-xl border shadow-2xl",
                feedback.type === "success"
                  ? "bg-plaeen-green/20 border-plaeen-green/30 text-plaeen-green"
                  : "bg-white/10 border-white/20 text-white",
              )}
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  feedback.type === "success"
                    ? "bg-plaeen-green animate-pulse"
                    : "bg-white",
                )}
              />
              <span className="text-xs font-bold uppercase ">
                {feedback.message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
