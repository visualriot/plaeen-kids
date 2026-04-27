import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Plus,
  Edit2,
  X,
  Check,
  UserPlus,
  Sparkles,
  Trash2,
  Settings,
  Shield,
  LogOut,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import {
  cn,
  getTeamAvatar,
  getUserAvatar,
  DEFAULT_TEAM_AVATAR,
} from "@/lib/utils";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import type { Team, Friend } from "@/lib/types";

import { useProfile } from "@/contexts/ProfileContext";

export const TeamsPage = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const {
    role,
    activeKid: kidData,
    parentProfile,
    isLoading: profileLoading,
  } = useProfile();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: "leave" | "delete";
    teamId: string;
  } | null>(null);

  const activeUid = kidData ? kidData.uid : user?.uid;

  useEffect(() => {
    if (!activeUid || profileLoading) return;

    const isActuallyParent = role === "parent";
    const parentId = kidData?.parentId || parentProfile?.uid;

    // Parent should query by parentIds regardless of which profile they selected,
    // to satisfy the Query Enforcer rule. Kid queries by members.
    const q = query(
      collection(db, "groups"),
      where(
        isActuallyParent ? "parentIds" : "members",
        "array-contains",
        isActuallyParent ? parentId : activeUid,
      ),
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          let allTeams = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            const adminIds =
              data.adminIds || (data.ownerId ? [data.ownerId] : []);
            return { id: docSnap.id, ...data, adminIds } as Team;
          });

          // If viewing as a parent for a specific kid, filter locally
          if (isActuallyParent && kidData) {
            allTeams = allTeams.filter((t) => t.members?.includes(kidData.uid));
          }

          setTeams(allTeams);
          setLoading(false);

          // Backfill missing parentIds if we are viewing as a kid
          if (kidData) {
            allTeams.forEach(async (t: any) => {
              if (!t.parentIds?.includes(kidData.parentId)) {
                console.log(`Backfilling missing parentId for team: ${t.name}`);
                await updateDoc(doc(db, "groups", t.id), {
                  parentIds: arrayUnion(kidData.parentId),
                }).catch((e) => console.error("Backfill failed:", e));
              }
            });
          }
        } catch (err) {
          console.error("Error in snapshot callback:", err);
          setLoading(false);
        }
      },
      (error) => handleFirestoreError(error, "list", "groups"),
    );

    return () => unsubscribe();
  }, [activeUid]);

  const handleDeleteTeam = async (teamId: string) => {
    try {
      const batch = writeBatch(db);

      // Delete the group itself
      batch.delete(doc(db, "groups", teamId));

      // Cleanup associated notifications (invites)
      const q = query(
        collection(db, "notifications"),
        where("type", "==", "team_invite"),
        where("data.groupId", "==", teamId),
      );
      const inviteSnaps = await getDocs(q);
      inviteSnaps.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();

      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setConfirmModal(null);
    } catch (err) {
      console.error("Error deleting team:", err);
      setConfirmModal(null);
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!activeUid) return;
    try {
      await updateDoc(doc(db, "groups", teamId), {
        members: arrayRemove(activeUid),
        adminIds: arrayRemove(activeUid),
      });
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setConfirmModal(null);
    } catch (err) {
      console.error("Error leaving team:", err);
    }
  };

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    try {
      await updateDoc(doc(db, "groups", teamId), {
        members: arrayRemove(memberId),
        adminIds: arrayRemove(memberId),
      });
    } catch (err) {
      console.error("Error removing member:", err);
    }
  };

  const handleToggleAdmin = async (
    teamId: string,
    memberId: string,
    isCurrentlyAdmin: boolean,
  ) => {
    try {
      await updateDoc(doc(db, "groups", teamId), {
        adminIds: isCurrentlyAdmin
          ? arrayRemove(memberId)
          : arrayUnion(memberId),
      });
    } catch (err) {
      console.error("Error toggling admin:", err);
    }
  };

  const toggleFriend = (uid: string) => {
    setSelectedFriends((prev) =>
      prev.includes(uid)
        ? prev.filter((id: string) => id !== uid)
        : [...prev, uid],
    );
  };

  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        Loading...
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-6 py-20 text-center">
      <div className="flex flex-col items-center justify-center gap-6 mb-20">
        <div className="flex items-end justify-baseline gap-4">
          <h1>
            Who are you <span className="text-plaeen-green">playing</span> with?
          </h1>
          <Button
            onClick={() => setIsEditMode(!isEditMode)}
            variant="tertiary"
            className={cn(
              "flex gap-x-2 py-0 px-1 pb-0 justify-baseline self-end",
              isEditMode ? "text-plaeen-green" : "",
            )}
          >
            <Edit2 size={14} /> {isEditMode ? "Done" : "Edit teams"}
          </Button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-12 cursor-pointer">
          <div className="relative group">
            <div className="absolute inset-0 bg-plaeen-green/40 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
              onClick={() => navigate("/teams/create")}
              className="relative flex flex-col space-y-6 h-64 w-64 items-center justify-center rounded-[2.5rem] bg-plaeen-purple/20 border-2 border-dashed border-white/10 transition-all hover:scale-105 hover:border-plaeen-green group"
            >
              <Plus
                size={64}
                className="text-white/30 group-hover:text-plaeen-green transition-colors"
              />
              <p className="text-lg font-bold uppercase tracking-wider font-white/40 group-hover:text-plaeen-green">
                Add new team
              </p>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-16 max-w-6xl mx-auto px-6">
          {teams.map((team) => {
            const alias =
              kidData?.teamAliases?.[team.id] ||
              parentProfile?.teamAliases?.[team.id];
            const displayName = alias || team.name;

            const cardContent = (
              <div className="group flex flex-col items-center gap-6 relative">
                <div className="relative h-44 w-44 rounded-[2.2rem] overflow-hidden border-4 border-transparent group-hover:border-plaeen-green transition-all duration-300 shadow-2xl">
                  <img
                    src={getTeamAvatar(team.imageURL)}
                    alt={displayName}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  {isEditMode ? (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-3 opacity-100 transition-opacity p-2">
                      <Link
                        to={`/teams/${team.id}/settings`}
                        className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-xl shrink-0"
                        title="Team Settings"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings size={20} />
                      </Link>

                      {/* Leave Button: visible if not admin, OR if admin but multiple admins exist */}
                      {(!(team.adminIds || []).includes(activeUid || "") ||
                        (team.adminIds || []).length > 1) && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmModal({ type: "leave", teamId: team.id });
                          }}
                          className="h-10 w-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-xl shrink-0"
                          title="Leave Team"
                        >
                          <LogOut size={20} />
                        </button>
                      )}

                      {/* Delete Button: only for admins */}
                      {(team.adminIds || []).includes(activeUid || "") && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmModal({
                              type: "delete",
                              teamId: team.id,
                            });
                          }}
                          className="h-10 w-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-xl shrink-0"
                          title="Delete Team"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <Sparkles
                        size={40}
                        className="text-plaeen-green animate-pulse"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold text-white/60 group-hover:text-white uppercase tracking-widest transition-colors text-center">
                    {displayName}
                  </span>
                  <span className="text-sm font-bold text-white/20 group-hover:text-white/30 uppercase tracking-widest transition-colors">
                    {team.members?.length || 0}{" "}
                    {(team.members?.length || 0) === 1 ? "Member" : "Members"}
                  </span>
                </div>
              </div>
            );

            return isEditMode ? (
              <div key={team.id}>{cardContent}</div>
            ) : (
              <Link key={team.id} to={`/teams/${team.id}`}>
                {cardContent}
              </Link>
            );
          })}

          {/* Add New Team card inline */}
          {!isEditMode && (
            <button
              onClick={() => navigate("/teams/create")}
              className="group flex flex-col items-center gap-6 relative cursor-pointer"
            >
              <div className="relative h-44 w-44 rounded-[2.2rem] flex items-center justify-center bg-plaeen-purple/20 border-4 border-dashed border-white/10 group-hover:border-plaeen-green group-hover:bg-plaeen-purple/30 transition-all duration-300 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-plaeen-green/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Plus
                  size={48}
                  className="text-white/20 group-hover:text-plaeen-green transition-all group-hover:scale-110"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-white/40 group-hover:text-white uppercase tracking-widest transition-colors text-center">
                  Add New Team
                </span>
                <span className="text-sm font-bold text-white/10 group-hover:text-white/20 uppercase tracking-widest transition-colors">
                  Join the battle
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Confirmation Modals */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          {(() => {
            const team = teams.find((t) => t.id === confirmModal.teamId);
            const isDeleting = confirmModal.type === "delete";

            return (
              <Card className="w-full max-w-md bg-plaeen-dark border-red-500/30 p-10 text-center">
                <div
                  className={cn(
                    "h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-6",
                    isDeleting ? "bg-red-500/10" : "bg-amber-500/10",
                  )}
                >
                  {isDeleting ? (
                    <Trash2 size={32} className="text-red-500" />
                  ) : (
                    <LogOut size={32} className="text-amber-500" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white uppercase tracking-tighter mb-4">
                  {isDeleting ? "Delete Team?" : "Leave Team?"}
                </h2>
                <p className="text-white/40 text-sm mb-8 font-bold uppercase tracking-widest leading-relaxed">
                  {isDeleting
                    ? "This will permanently remove the team and all its history."
                    : "You will no longer be able to access this team's sessions and games."}
                </p>
                <div className="flex gap-4">
                  <Button
                    onClick={() =>
                      isDeleting
                        ? handleDeleteTeam(confirmModal.teamId)
                        : handleLeaveTeam(confirmModal.teamId)
                    }
                    className={cn(
                      "flex-1 py-6 font-bold uppercase tracking-widest",
                      isDeleting
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-white",
                    )}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 border-white/10 text-white hover:bg-white/5 py-6 font-bold uppercase tracking-widest"
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
};
function setSelectedFriends(arg0: (prev: any) => any) {
  throw new Error("Function not implemented.");
}
