import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { Heading, Text, Label } from "@/components/atoms";
import { auth, db } from "@/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Plus,
  Edit2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Trash2,
  Bell,
  UserPlus,
  Gamepad2,
  Sparkles,
  Check,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Clock,
  Shield,
  Settings,
  Minus,
  AlertTriangle,
} from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isAfter,
  subDays,
} from "date-fns";
import { cn, safeToDate, getUserAvatar } from "@/lib/utils";
import { mergeTeamGames } from "@/lib/teamGames";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile } from "@/contexts/ProfileContext";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import type {
  Team,
  GroupGame,
  UserProfile,
  Session,
  TeamEvent,
} from "@/lib/types";

export const TeamDetailPage = () => {
  const { teamId } = useParams();
  const [user] = useAuthState(auth);
  const { role, activeKid: kidData, parentProfile } = useProfile();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [teamGames, setTeamGames] = useState<GroupGame[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [dismissedEvents, setDismissedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isResponseOpen, setIsResponseOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [responseNote, setResponseNote] = useState("");
  const navigate = useNavigate();

  const activeUid = kidData ? kidData.uid : user?.uid;

  useEffect(() => {
    if (!teamId) return;

    const unsubscribe = onSnapshot(
      doc(db, "groups", teamId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<Team, "id">;
          const adminIds =
            data.adminIds || (data.ownerId ? [data.ownerId] : []);
          setTeam({ id: docSnap.id, ...data, adminIds });
        } else {
          navigate("/teams");
        }
        setLoading(false);
      },
      (error) => handleFirestoreError(error, "get", `groups/${teamId}`),
    );

    const sessionsUnsubscribe = onSnapshot(
      collection(db, "groups", teamId, "sessions"),
      (snapshot) => {
        setSessions(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Session),
        );
      },
      (error) =>
        handleFirestoreError(error, "list", `groups/${teamId}/sessions`),
    );

    const gamesUnsubscribe = onSnapshot(
      collection(db, "groups", teamId, "games"),
      (snapshot) => {
        setTeamGames(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupGame),
        );
      },
      (error) => handleFirestoreError(error, "list", `groups/${teamId}/games`),
    );

    const eventsUnsubscribe = onSnapshot(
      query(
        collection(db, "groups", teamId, "events"),
        orderBy("createdAt", "desc"),
        limit(10),
      ),
      (snapshot) => {
        setEvents(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TeamEvent),
        );
      },
      (error) => handleFirestoreError(error, "list", `groups/${teamId}/events`),
    );

    return () => {
      unsubscribe();
      sessionsUnsubscribe();
      gamesUnsubscribe();
      eventsUnsubscribe();
    };
  }, [teamId, navigate]);

  useEffect(() => {
    if (!team?.members || team.members.length === 0) {
      setMembers([]);
      return;
    }

    const unsubscribes = team.members.map((memberId) => {
      return onSnapshot(
        doc(db, "users", memberId),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setMembers((prev) => {
              const otherMembers = prev.filter((m) => m.uid !== memberId);
              return [...otherMembers, data];
            });
          }
        },
        (error) => handleFirestoreError(error, "get", `users/${memberId}`),
      );
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [team?.members]);

  useEffect(() => {
    if (!team?.pendingMembers || team.pendingMembers.length === 0) {
      setPendingMembers([]);
      return;
    }

    const q = query(
      collection(db, "users_public"),
      where("uid", "in", team.pendingMembers),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPendingMembers(
          snapshot.docs.map((doc) => doc.data() as UserProfile),
        );
      },
      (error) => handleFirestoreError(error, "list", "users_public"),
    );

    return () => unsubscribe();
  }, [team?.pendingMembers]);

  useEffect(() => {
    if (!activeUid) return;
    const fetchFriends = async () => {
      const userDoc = await getDoc(doc(db, "users", activeUid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friends || [];
        const nonMemberFriends = friendIds.filter(
          (id: string) =>
            !team?.members.includes(id) &&
            !(team?.pendingMembers || []).includes(id),
        );
        if (nonMemberFriends.length > 0) {
          const friendsQuery = query(
            collection(db, "users_public"),
            where("uid", "in", nonMemberFriends),
          );
          const friendsSnap = await getDocs(friendsQuery);
          setFriends(friendsSnap.docs.map((d) => d.data() as UserProfile));
        } else {
          setFriends([]);
        }
      }
    };
    fetchFriends();
  }, [activeUid, team?.members]);

  const addMember = async (memberId: string) => {
    if (!teamId || !team) return;

    // Check if already a member or already has a pending invitation
    if (
      team.members.includes(memberId) ||
      (team.pendingMembers || []).includes(memberId)
    ) {
      return;
    }

    try {
      // Find the friend's record to get their name
      const friend = friends.find((f) => f.uid === memberId);

      await updateDoc(doc(db, "groups", teamId), {
        pendingMembers: arrayUnion(memberId),
      });

      // Get the invitee's parentId from users_public
      const memberPublicDoc = await getDoc(doc(db, "users_public", memberId));
      const memberParentId = memberPublicDoc.exists()
        ? memberPublicDoc.data()?.parentId
        : null;

      // Send notification for invitation
      await addDoc(collection(db, "notifications"), {
        userId: memberId,
        parentId: memberParentId || null,
        type: "team_invite",
        title: "Team Invitation",
        message: `${kidData?.displayName || parentProfile?.displayName || "A friend"} invited you to join the team "${team.name}"`,
        data: {
          groupId: teamId,
          teamName: team.name,
          invitedBy: activeUid,
          invitedByName:
            kidData?.displayName || parentProfile?.displayName || "A friend",
        },
        read: false,
        createdAt: serverTimestamp(),
      });

      setIsAddMemberOpen(false);
    } catch (err) {
      console.error("Error adding member:", err);
    }
  };

  const respondToSession = async (
    status: "accepted" | "rejected" | "maybe",
    note: string,
    sessionId?: string,
  ) => {
    const targetSessionId = sessionId || selectedSession?.id;
    if (!teamId || !activeUid || !targetSessionId) return;
    try {
      await updateDoc(doc(db, "groups", teamId, "sessions", targetSessionId), {
        [`responses.${activeUid}`]: { status, note },
      });
      setIsResponseOpen(false);
      setSelectedSession(null);
      setResponseNote("");
    } catch (err) {
      console.error("Error responding:", err);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!teamId) return;
    try {
      await deleteDoc(doc(db, "groups", teamId, "sessions", sessionId));
      setIsResponseOpen(false);
      setSelectedSession(null);
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const requestAllowanceIncrease = async (session: Session) => {
    if (!kidData || !kidData.parentId || !teamId) return;
    try {
      await addDoc(collection(db, "approvals"), {
        parentId: kidData.parentId,
        childId: kidData.uid,
        childName: kidData.displayName,
        type: "time",
        title: `Extra time for ${session.gameName}`,
        status: "pending",
        createdAt: serverTimestamp(),
        data: {
          sessionId: session.id,
          gameName: session.gameName,
          requestedMinutes: session.duration,
          startTime: session.startTime,
        },
      });

      // Update session response to indicate pending approval
      await updateDoc(doc(db, "groups", teamId, "sessions", session.id), {
        [`responses.${activeUid}`]: {
          status: "maybe",
          note: "Waiting for guardian approval for extra time.",
          guardianApprovalPending: true,
          requestedAllowance: session.duration,
        },
      });

      setIsResponseOpen(false);
      setSelectedSession(null);
    } catch (err) {
      console.error("Error requesting allowance:", err);
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }).map((_, i) => i);

  if (loading || !team)
    return (
      <div className="flex h-[60vh] items-center justify-center text-white font-bold uppercase ">
        Loading Team Data...
      </div>
    );

  const visibleSessions = sessions.filter((session) => !session.catalogEntry);
  const combinedTeamGames = mergeTeamGames(teamGames, sessions);
  const headerImage =
    combinedTeamGames.length > 0
      ? combinedTeamGames[0].image
      : "https://picsum.photos/seed/gaming/1920/1080";

  const activeEvents = events.filter((e) => {
    if (dismissedEvents.includes(e.id)) return false;
    const created = safeToDate(e.createdAt);
    return isAfter(created, subDays(new Date(), 1));
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Team Events Banners */}
      <div className="space-y-2 mb-8">
        <AnimatePresence>
          {activeEvents.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div
                className="flex items-center justify-between bg-plaeen-green/10 border border-plaeen-green/20 rounded-2xl p-4 cursor-pointer hover:bg-plaeen-green/20 transition-all"
                onClick={() =>
                  setDismissedEvents((prev) => [...prev, event.id])
                }
              >
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)] animate-pulse" />
                  <p className="text-xs font-bold text-white uppercase ">
                    <span className="text-plaeen-green">{event.userName}</span>{" "}
                    joined the team!
                  </p>
                </div>
                <X
                  size={16}
                  className="text-white/20 hover:text-white transition-colors"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header Section */}
      <div className="relative h-[400px] rounded-[3rem] overflow-hidden mb-12 group">
        <img
          src={headerImage}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark via-plaeen-dark/40 to-transparent" />

        <div className="absolute inset-0 p-12 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-8xl font-bold text-white uppercase  drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
                {kidData?.teamAliases?.[team.id] ||
                  parentProfile?.teamAliases?.[team.id] ||
                  team.name}
              </h1>
              <div className="mt-6 flex items-center gap-4">
                <Button
                  onClick={() => navigate(`/search?teamId=${teamId}`)}
                  className="bg-plaeen-green text-black font-bold uppercase  px-8 py-6 shadow-[0_0_20px_rgba(118,233,0,0.4)]"
                >
                  <Plus size={20} className="mr-2" /> Add Session
                </Button>
                <Button
                  onClick={() => navigate(`/teams/${teamId}/settings`)}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 font-bold uppercase  px-8 py-6"
                >
                  <Settings size={20} className="mr-2" /> Team Settings
                </Button>
              </div>
            </div>

            <Card className="bg-black/40 backdrop-blur-xl border-white/10 p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-plaeen-green flex items-center justify-center text-black shadow-[0_0_15px_rgba(118,233,0,0.5)]">
                <Bell size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase ">
                  Notifications
                </p>
                <p className="text-[10px] text-white/40 uppercase ">
                  {
                    visibleSessions.filter(
                      (s) =>
                        s.status === "proposed" &&
                        !s.responses?.[user?.uid || ""],
                    ).length
                  }{" "}
                  Pending Invites
                </p>
              </div>
            </Card>
          </div>

          <div className="flex items-end justify-between">
            <div className="flex flex-wrap gap-4">
              {[...members]
                .sort((a, b) => {
                  const aIsAdmin = team.adminIds?.includes(a.uid);
                  const bIsAdmin = team.adminIds?.includes(b.uid);
                  if (aIsAdmin && !bIsAdmin) return -1;
                  if (!aIsAdmin && bIsAdmin) return 1;
                  return 0;
                })
                .map((member) => (
                  <div key={member.uid} className="relative group/member">
                    <div
                      className={cn(
                        "h-14 w-14 rounded-full border-2 p-1 bg-plaeen-dark shadow-[0_0_15px_rgba(118,233,0,0.2)]",
                        team.adminIds?.includes(member.uid)
                          ? "border-plaeen-green"
                          : "border-white/10",
                      )}
                    >
                      <img
                        src={getUserAvatar(member.photoURL)}
                        alt={member.displayName}
                        className="h-full w-full rounded-full object-cover"
                      />
                      {team.adminIds?.includes(member.uid) && (
                        <div className="absolute -top-1 -right-1 bg-plaeen-green rounded-full p-1 shadow-lg">
                          <Shield size={10} className="text-black" />
                        </div>
                      )}
                    </div>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-plaeen-dark border border-white/10 px-3 py-1 rounded-lg opacity-0 group-hover/member:opacity-100 transition-opacity whitespace-nowrap z-20">
                      <p className="text-[10px] font-bold text-white uppercase ">
                        {member.displayName}{" "}
                        {team.adminIds?.includes(member.uid) && "(Admin)"}
                      </p>
                    </div>
                  </div>
                ))}

              {/* Pending Members */}
              {pendingMembers.map((member) => (
                <div key={member.uid} className="relative group/member">
                  <div className="h-14 w-14 rounded-full border-2 border-white/10 p-1 bg-plaeen-dark/60 opacity-60">
                    <img
                      src={getUserAvatar(member.photoURL)}
                      alt={member.displayName}
                      className="h-full w-full rounded-full object-cover grayscale"
                    />
                    <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-1 shadow-lg">
                      <Clock size={10} className="text-white" />
                    </div>
                  </div>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-plaeen-dark border border-white/10 px-3 py-1 rounded-lg opacity-0 group-hover/member:opacity-100 transition-opacity whitespace-nowrap z-20">
                    <p className="text-[10px] font-bold text-amber-500 uppercase ">
                      {member.displayName} (Pending)
                    </p>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="h-14 w-14 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center text-white/20 hover:border-plaeen-green hover:text-plaeen-green transition-all"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-12">
        {/* Games Played Section */}
        <div className="lg:col-span-1 space-y-8">
          <h2 className="text-[10px] font-bold uppercase  text-plaeen-green flex items-center gap-3">
            <Gamepad2 size={16} /> Games Played
          </h2>
          <div className="space-y-4">
            {combinedTeamGames.map((game) => (
              <Link key={game.id} to={`/teams/${teamId}/games/${game.id}`}>
                <Card className="group relative overflow-hidden p-0 border-white/5 bg-white/5 hover:border-plaeen-green/30 transition-all mb-4">
                  <div className="aspect-video relative">
                    <img
                      src={game.image}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-lg font-bold text-white uppercase  group-hover:text-plaeen-green transition-colors">
                        {game.name}
                      </h3>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
            <Button
              variant="outline"
              onClick={() => navigate(`/search?teamId=${teamId}`)}
              className="w-full py-8 border-dashed border-white/10 text-white/20 hover:text-plaeen-green hover:border-plaeen-green transition-all uppercase  font-bold"
            >
              <Plus size={20} className="mr-2" /> Add Game
            </Button>
          </div>
        </div>

        {/* Game Proposals Section */}
        <div className="lg:col-span-4 space-y-8 mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-purple flex items-center gap-3">
              <Sparkles size={16} /> Game Proposals
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visibleSessions
              .filter((s) => s.status === "proposed" && !s.startTime)
              .map((proposal) => {
                const votes = Object.values(proposal.responses || {}).filter(
                  (r: any) => r.status === "accepted",
                ).length;
                const hasVoted =
                  proposal.responses?.[activeUid || ""]?.status === "accepted";

                return (
                  <Card
                    key={proposal.id}
                    className="bg-white/5 border-white/10 p-6 group hover:border-plaeen-purple/30 transition-all"
                  >
                    <div className="aspect-video rounded-xl overflow-hidden mb-4">
                      <img
                        src={proposal.gameImage}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase mb-2">
                      {proposal.gameName}
                    </h3>
                    <p className="text-[10px] text-white/40 uppercase font-bold mb-6">
                      Proposed by {proposal.proposedByName}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-plaeen-purple transition-all"
                            style={{
                              width: `${Math.min((votes / (team.members.length || 1)) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-plaeen-purple">
                          {votes}/{team.members.length}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant={hasVoted ? "outline" : "primary"}
                        className={
                          hasVoted
                            ? "border-plaeen-purple text-plaeen-purple"
                            : "bg-plaeen-purple text-white"
                        }
                        onClick={() =>
                          respondToSession(
                            hasVoted ? "rejected" : "accepted",
                            "",
                            proposal.id,
                          )
                        }
                      >
                        {hasVoted ? "Voted" : "Vote"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            {visibleSessions.filter(
              (s) => s.status === "proposed" && !s.startTime,
            ).length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                <p className="text-white/20 font-bold uppercase  text-xs">
                  No active game proposals
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Unified Calendar Section */}
        <div className="lg:col-span-4 space-y-8 mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-green flex items-center gap-3">
              <CalendarIcon size={16} /> Unified Schedule
            </h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                className="text-white/20 hover:text-plaeen-green transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <span className="text-sm font-bold text-white uppercase ">
                {format(days[0], "MMM d")} - {format(days[6], "MMM d")}
              </span>
              <button
                onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                className="text-white/20 hover:text-plaeen-green transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <Card className="bg-white/5 border-white/10 p-4 lg:p-10 overflow-hidden relative">
            <div className="w-full">
              <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-0.5 mb-6 md:gap-3">
                <div />
                {hours.map((h) => (
                  <div
                    key={h}
                    className="text-center text-[8px] md:text-[10px] font-bold text-white/20"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {days.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayIdx = day.getDay();
                return (
                  <div
                    key={dayKey}
                    className="grid grid-cols-[80px_repeat(24,1fr)] gap-0.5 mb-0.5 items-center md:gap-3 md:mb-3"
                  >
                    <div className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase  md:">
                      {format(day, "EEE d")}
                    </div>
                    {hours.map((hour) => {
                      const recurringKey = `${dayIdx}_${hour}`;
                      const onceKey = `${dayKey}_${hour}`;

                      const availableMembers = members.filter(
                        (m) =>
                          m.availability?.recurring?.[recurringKey] ||
                          m.availability?.once?.[onceKey],
                      );

                      const isFullyAvailable =
                        members.length > 0 &&
                        availableMembers.length === members.length;
                      const isPartiallyAvailable =
                        availableMembers.length >= 2 &&
                        availableMembers.length < members.length;

                      const session = visibleSessions.find((s) => {
                        if (!s.startTime?.toDate) return false;
                        const sDate = s.startTime.toDate();
                        return (
                          isSameDay(sDate, day) && sDate.getHours() === hour
                        );
                      });

                      const isProposedByMe = session?.proposedBy === activeUid;
                      const hasResponded = activeUid
                        ? session?.responses?.[activeUid]
                        : undefined;
                      const shouldBlink =
                        session?.status === "proposed" && !hasResponded;

                      return (
                        <div
                          key={hour}
                          onClick={() => {
                            if (session) {
                              setSelectedSession(session);
                              setIsResponseOpen(true);
                            } else if (
                              isFullyAvailable ||
                              isPartiallyAvailable
                            ) {
                              navigate(
                                `/teams/${teamId}/propose?day=${dayKey}&hour=${hour}`,
                              );
                            }
                          }}
                          className={cn(
                            "aspect-square rounded-lg transition-all border border-transparent relative group hover:scale-95",
                            session || isFullyAvailable || isPartiallyAvailable
                              ? "cursor-pointer"
                              : "cursor-default pointer-events-none opacity-60",
                            shouldBlink && "animate-blink-glow",
                            session?.status === "scheduled"
                              ? "bg-plaeen-green shadow-[0_0_20px_rgba(118,233,0,0.6)] z-20 border-white/40"
                              : session?.status === "proposed"
                                ? isProposedByMe
                                  ? "bg-amber-400/20 border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.2)]"
                                  : hasResponded?.status === "rejected"
                                    ? "bg-red-500/10 border-red-500/20 opacity-40"
                                    : "bg-amber-400/40 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                                : isFullyAvailable
                                  ? "bg-plaeen-green/40 border-plaeen-green/60 hover:bg-plaeen-green/50 shadow-[0_0_15px_rgba(118,233,0,0.2)]"
                                  : isPartiallyAvailable
                                    ? "bg-[#a855f7] border-[#c084fc] hover:bg-[#c084fc]"
                                    : "bg-white/20 border border-white/10",
                          )}
                        >
                          {(isFullyAvailable ||
                            isPartiallyAvailable ||
                            session) && (
                            <div
                              className={cn(
                                "absolute left-1/2 -translate-x-1/2 bg-plaeen-dark border border-white/10 px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap z-50 pointer-events-none shadow-2xl",
                                session ? "-top-12" : "top-full mt-2",
                              )}
                            >
                              {session ? (
                                <div className="flex flex-col items-center gap-1">
                                  <p className="text-[10px] font-bold text-plaeen-green uppercase ">
                                    {session.gameName}
                                  </p>
                                  <p className="text-[8px] text-white/40 font-bold uppercase">
                                    Click to view session
                                  </p>
                                </div>
                              ) : isFullyAvailable ? (
                                <div className="flex flex-col items-center gap-1">
                                  <p className="text-[10px] font-bold text-plaeen-green uppercase  mb-1">
                                    All team available!
                                  </p>
                                  <p className="text-[10px] text-white/60 font-medium uppercase ">
                                    Click to propose session
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-plaeen-purple uppercase ">
                                    Available:
                                  </p>
                                  {availableMembers.map((m) => (
                                    <p
                                      key={m.uid}
                                      className="text-[10px] text-white/80 font-bold uppercase"
                                    >
                                      {m.displayName}
                                    </p>
                                  ))}
                                  <div className="pt-1 mt-1 border-t border-white/10">
                                    <p className="text-[8px] text-white/40 font-bold uppercase mb-1">
                                      {availableMembers.length} /{" "}
                                      {members.length} Players Available
                                    </p>
                                    <p className="text-[9px] text-plaeen-green font-bold uppercase ">
                                      Click to propose session
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 pt-8 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-plaeen-green shadow-[0_0_15px_rgba(118,233,0,0.6)] border border-white/40" />
                <span className="text-[10px] font-bold text-white/80 uppercase ">
                  Scheduled Session
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)] border border-white/20" />
                <span className="text-[10px] font-bold text-white/80 uppercase ">
                  Active Proposal
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-plaeen-green/40 border border-plaeen-green/60" />
                <span className="text-[10px] font-bold text-white/80 uppercase ">
                  Team Available
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-[#a855f7] border border-[#c084fc]" />
                <span className="text-[10px] font-bold text-white uppercase ">
                  Partially Available (2+)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-white/20 border border-white/10" />
                <span className="text-[10px] font-bold text-white/80 uppercase ">
                  Unavailable
                </span>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-plaeen-purple/5 border border-plaeen-purple/20 flex items-center gap-3">
              <Sparkles size={14} className="text-plaeen-purple" />
              <p className="text-[10px] font-bold text-white/40 uppercase ">
                Click on any slot to propose a new gaming session for your team.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <Card className="w-full max-w-md bg-plaeen-dark border-plaeen-green/30 p-10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-white uppercase ">
                Add Player
              </h2>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              {friends.map((friend) => (
                <div
                  key={friend.uid}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={getUserAvatar(friend.photoURL)}
                      className="h-10 w-10 rounded-full"
                    />
                    <span className="font-bold text-white uppercase text-sm">
                      {friend.displayName}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => addMember(friend.uid)}>
                    Invite
                  </Button>
                </div>
              ))}
              {friends.length === 0 && (
                <p className="text-center py-8 text-white/20 font-bold uppercase ">
                  No friends to invite
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {isResponseOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <Card className="w-full max-w-2xl bg-plaeen-dark border-plaeen-green/30 p-10 shadow-[0_0_50px_rgba(118,233,0,0.1)]">
            <div className="flex justify-between items-start mb-10">
              <div>
                <p className="text-[10px] font-bold uppercase  text-plaeen-green mb-2">
                  Session Proposed by{" "}
                  <span className="text-white">
                    {selectedSession.proposedByName}
                  </span>
                </p>
                <h2 className="text-5xl font-bold text-white uppercase  mb-2">
                  {selectedSession.gameName}
                </h2>
                <div className="flex items-center gap-4 text-white/40 font-bold uppercase  text-[10px]">
                  <div className="flex items-center gap-1">
                    <CalendarIcon size={14} />
                    {format(selectedSession.startTime.toDate(), "EEEE, MMM d")}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    {format(selectedSession.startTime.toDate(), "HH:mm")} -{" "}
                    {format(
                      selectedSession.endTime?.toDate() || new Date(),
                      "HH:mm",
                    )}{" "}
                    ({selectedSession.duration}m)
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedSession.proposedBy === activeUid && (
                  <button
                    onClick={() => deleteSession(selectedSession.id)}
                    className="h-10 w-10 rounded-full border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                    title="Delete Proposal"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                <button
                  onClick={() => setIsResponseOpen(false)}
                  className="h-10 w-10 rounded-full border border-white/10 text-white/40 hover:text-white transition-colors flex items-center justify-center"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-10">
              <div>
                <label className="text-[10px] font-bold uppercase  text-plaeen-green mb-6 block">
                  Invitees Status
                </label>
                <div className="space-y-3">
                  {members.map((member) => {
                    const response = selectedSession.responses?.[member.uid];
                    return (
                      <div
                        key={member.uid}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={getUserAvatar(member.photoURL)}
                            className="h-8 w-8 rounded-full"
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-white uppercase text-[10px] ">
                              {member.displayName}
                            </span>
                            {response?.guardianApprovalPending && (
                              <span className="text-[8px] text-amber-400 font-bold uppercase">
                                Pending Guardian Approval
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {response?.status === "accepted" ? (
                            <Check className="text-plaeen-green" size={16} />
                          ) : response?.status === "rejected" ? (
                            <X className="text-red-500" size={16} />
                          ) : response?.status === "maybe" ? (
                            <HelpCircle className="text-yellow-500" size={16} />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-white/10" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold uppercase  text-plaeen-green mb-6 block">
                    Admin Note
                  </label>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 italic text-white/60 text-sm">
                    "
                    {selectedSession.notes ||
                      "No specific goals set for this session"}
                    "
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase  text-plaeen-green mb-4 block">
                    Personal Allowance
                  </label>
                  {(() => {
                    const me = members.find((m) => m.uid === activeUid);
                    const allowance = me?.screenTime?.dailyAllowance || 0;
                    const used = me?.screenTime?.usedToday || 0;
                    const remaining = allowance - used;
                    const canAfford = remaining >= selectedSession.duration;

                    return (
                      <div
                        className={cn(
                          "p-4 rounded-2xl border flex items-center justify-between",
                          canAfford
                            ? "bg-plaeen-green/10 border-plaeen-green/20"
                            : "bg-amber-400/10 border-amber-400/20",
                        )}
                      >
                        <div>
                          <p className="text-xs font-bold text-white uppercase   mb-1">
                            Remaining Today
                          </p>
                          <p
                            className={cn(
                              "text-2xl font-bold",
                              canAfford
                                ? "text-plaeen-green"
                                : "text-amber-400",
                            )}
                          >
                            {remaining} min
                          </p>
                        </div>
                        {!canAfford && role === "kid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-400/40 text-amber-400 hover:bg-amber-400/10 text-[10px] py-1 px-3"
                            onClick={() =>
                              requestAllowanceIncrease(selectedSession)
                            }
                          >
                            Ask Guardian
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <label className="absolute left-4 -top-2 px-2 bg-plaeen-dark text-[10px] font-bold text-white/40 uppercase  z-10">
                  Add a note
                </label>
                <textarea
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  placeholder="e.g. I'll join but might be late!"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pt-6 text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all h-20"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Button
                  onClick={() => respondToSession("accepted", responseNote)}
                  className="bg-plaeen-green text-black font-bold uppercase  py-6"
                >
                  {activeUid &&
                  selectedSession.responses?.[activeUid]?.status === "accepted"
                    ? "Update Response"
                    : "Accept"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => respondToSession("maybe", responseNote)}
                  className="border-white/20 text-white hover:bg-white/10 font-bold uppercase  py-6"
                >
                  Maybe
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => respondToSession("rejected", responseNote)}
                  className="text-red-400 hover:bg-red-500/10 font-bold uppercase  py-6"
                >
                  {activeUid &&
                  selectedSession.responses?.[activeUid]?.status === "rejected"
                    ? "Withdrawn"
                    : "Decline"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
