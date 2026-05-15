import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { Heading, Text, Label } from "@/components/atoms";
import { auth, db } from "@/firebase";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Plus,
  ChevronLeft,
  Calendar as CalendarIcon,
  Target,
  BookOpen,
  Trophy,
  Clock,
  MessageSquare,
  Save,
  RotateCcw,
  X,
  Check,
  HelpCircle,
  Gamepad2,
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import { cn, getUserAvatar } from "@/lib/utils";
import { getTeamGameFromSession } from "@/lib/teamGames";
import type { Session } from "@/lib/types";

interface GroupGame {
  id: string;
  name: string;
  image: string;
  description: string;
  platforms: string[];
  genres: string[];
  steamData?: {
    playtime: number;
    achievements: any[];
    lastPlayed: string;
  };
  teamGoals?: string[];
  teamNotes?: string;
}

export const TeamGameDetailPage = () => {
  const { teamId, gameId } = useParams();
  const [user] = useAuthState(auth);
  const [game, setGame] = useState<GroupGame | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [catalogSessionId, setCatalogSessionId] = useState<string | null>(null);
  const [usesFallbackGame, setUsesFallbackGame] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!teamId || !gameId) return;

    const unsubscribe = onSnapshot(
      doc(db, "groups", teamId, "games", gameId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as GroupGame;
          setUsesFallbackGame(false);
          setGame(data);
          setNotes(data.teamNotes || "");
        } else {
          setUsesFallbackGame(true);
        }
      },
    );

    const sessionsQuery = query(
      collection(db, "groups", teamId, "sessions"),
      where("gameId", "==", gameId),
    );
    const sessionsUnsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const allSessions = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Session,
      );
      const catalogSession =
        allSessions.find((session) => session.catalogEntry) || allSessions[0];

      setCatalogSessionId(catalogSession?.id || null);
      setSessions(allSessions.filter((session) => !session.catalogEntry));

      if (catalogSession && usesFallbackGame) {
        const fallbackGame = getTeamGameFromSession({
          gameId: catalogSession.gameId,
          gameName: catalogSession.gameName,
          gameImage: catalogSession.gameImage,
          description: catalogSession.description,
          platforms: catalogSession.platforms,
          genres: catalogSession.genres,
          teamGoals: catalogSession.teamGoals,
          teamNotes: catalogSession.teamNotes,
        });

        if (fallbackGame) {
          setGame(fallbackGame);
          setNotes(fallbackGame.teamNotes || "");
        }
      }
    });

    return () => {
      unsubscribe();
      sessionsUnsubscribe();
    };
  }, [teamId, gameId, usesFallbackGame]);

  const addGoal = async () => {
    if (!teamId || !gameId || !newGoal.trim()) return;
    if (usesFallbackGame && !catalogSessionId) return;
    try {
      const targetRef =
        usesFallbackGame && catalogSessionId
          ? doc(db, "groups", teamId, "sessions", catalogSessionId)
          : doc(db, "groups", teamId, "games", gameId);

      await updateDoc(targetRef, {
        teamGoals: arrayUnion(newGoal.trim()),
      });
      setNewGoal("");
    } catch (err) {
      console.error("Error adding goal:", err);
    }
  };

  const removeGoal = async (goal: string) => {
    if (!teamId || !gameId) return;
    if (usesFallbackGame && !catalogSessionId) return;
    try {
      const targetRef =
        usesFallbackGame && catalogSessionId
          ? doc(db, "groups", teamId, "sessions", catalogSessionId)
          : doc(db, "groups", teamId, "games", gameId);

      await updateDoc(targetRef, {
        teamGoals: arrayRemove(goal),
      });
    } catch (err) {
      console.error("Error removing goal:", err);
    }
  };

  const saveNotes = async () => {
    if (!teamId || !gameId) return;
    if (usesFallbackGame && !catalogSessionId) return;
    setIsSaving(true);
    try {
      const targetRef =
        usesFallbackGame && catalogSessionId
          ? doc(db, "groups", teamId, "sessions", catalogSessionId)
          : doc(db, "groups", teamId, "games", gameId);

      await updateDoc(targetRef, {
        teamNotes: notes,
      });
    } catch (err) {
      console.error("Error saving notes:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!game)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        Loading game intel...
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-12">
        <Button
          variant="ghost"
          onClick={() => navigate(`/teams/${teamId}`)}
          className="text-white/40 hover:text-plaeen-green gap-2 uppercase  font-bold mb-8"
        >
          <ChevronLeft size={20} /> Back to Team
        </Button>

        <div className="relative h-96 rounded-[3rem] overflow-hidden group">
          <img
            src={game.image}
            alt={game.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark via-plaeen-dark/40 to-transparent flex flex-col justify-end p-12">
            <div className="flex flex-wrap gap-3 mb-6">
              {game.genres.map((g) => (
                <span
                  key={g}
                  className="px-4 py-1 rounded-full bg-plaeen-green/10 border border-plaeen-green/20 text-plaeen-green text-[10px] font-bold uppercase "
                >
                  {g}
                </span>
              ))}
            </div>
            <h1 className="text-8xl font-bold text-white uppercase  drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
              {game.name}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {/* Progress Section */}
          <section>
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-green mb-8 flex items-center gap-3">
              <Trophy size={16} /> Team Progress
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-white/5 border-white/10 p-8 text-center group hover:border-plaeen-green/30 transition-all">
                <Clock className="mx-auto mb-4 text-plaeen-green" size={32} />
                <p className="text-3xl font-bold text-white mb-1">124h</p>
                <p className="text-[10px] font-bold text-white/20 uppercase ">
                  Total Playtime
                </p>
              </Card>
              <Card className="bg-white/5 border-white/10 p-8 text-center group hover:border-plaeen-green/30 transition-all">
                <Trophy className="mx-auto mb-4 text-plaeen-green" size={32} />
                <p className="text-3xl font-bold text-white mb-1">42/80</p>
                <p className="text-[10px] font-bold text-white/20 uppercase ">
                  Achievements
                </p>
              </Card>
              <Card className="bg-white/5 border-white/10 p-8 text-center group hover:border-plaeen-green/30 transition-all">
                <CalendarIcon
                  className="mx-auto mb-4 text-plaeen-green"
                  size={32}
                />
                <p className="text-3xl font-bold text-white mb-1">Yesterday</p>
                <p className="text-[10px] font-bold text-white/20 uppercase ">
                  Last Session
                </p>
              </Card>
            </div>
          </section>

          {/* Goals Section */}
          <section>
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-green mb-8 flex items-center gap-3">
              <Target size={16} /> Current Objectives
            </h2>
            <Card className="bg-white/5 border-white/10 p-8">
              <div className="space-y-4 mb-8">
                {game.teamGoals?.map((goal, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-6 w-6 rounded-lg border-2 border-plaeen-green/30 flex items-center justify-center group-hover:border-plaeen-green transition-colors">
                        <Check
                          size={14}
                          className="text-plaeen-green opacity-0 group-hover:opacity-100"
                        />
                      </div>
                      <span className="font-bold text-white/80 uppercase ">
                        {goal}
                      </span>
                    </div>
                    <button
                      onClick={() => removeGoal(goal)}
                      className="text-white/10 hover:text-red-500 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
                {(!game.teamGoals || game.teamGoals.length === 0) && (
                  <p className="text-center py-8 text-white/20 font-bold uppercase ">
                    No objectives set yet
                  </p>
                )}
              </div>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="Add a new goal (e.g. Complete Chapter 4)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all"
                />
                <Button onClick={addGoal} className="px-8 font-bold uppercase ">
                  Add
                </Button>
              </div>
            </Card>
          </section>

          {/* Notes Section */}
          <section>
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-green mb-8 flex items-center gap-3">
              <BookOpen size={16} /> Team Intel & Strategy
            </h2>
            <Card className="bg-white/5 border-white/10 p-8">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share strategies, build ideas, or session recaps..."
                className="w-full h-64 bg-white/5 border border-white/10 rounded-2xl p-6 text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all mb-6 resize-none"
              />
              <div className="flex justify-end gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setNotes(game.teamNotes || "")}
                  className="text-white/40 hover:text-white uppercase  font-bold"
                >
                  <RotateCcw size={18} className="mr-2" /> Revert
                </Button>
                <Button
                  onClick={saveNotes}
                  disabled={isSaving}
                  className="px-12 font-bold uppercase "
                >
                  {isSaving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save size={18} className="mr-2" /> Save Intel
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </section>
        </div>

        <div className="space-y-12">
          {/* Game Calendar */}
          <section>
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-green mb-8 flex items-center gap-3">
              <CalendarIcon size={16} /> Game Schedule
            </h2>
            <Card className="bg-white/5 border-white/10 p-8">
              <div className="space-y-6">
                {sessions
                  .filter((session) => session.startTime?.toDate)
                  .sort((a, b) => a.startTime.toDate() - b.startTime.toDate())
                  .map((session) => (
                    <div
                      key={session.id}
                      className="p-6 rounded-2xl bg-white/5 border-l-4 border-plaeen-green"
                    >
                      <p className="text-[10px] font-bold text-plaeen-green uppercase mb-2">
                        {format(session.startTime.toDate(), "EEEE, MMM d")}
                      </p>
                      <p className="text-2xl font-bold text-white mb-4">
                        {format(session.startTime.toDate(), "HH:mm")}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {Object.entries(session.responses || {}).map(
                            ([uid, res]: [string, any]) => (
                              <div
                                key={uid}
                                className={cn(
                                  "h-8 w-8 rounded-full border-2 border-plaeen-dark overflow-hidden",
                                  res.status === "accepted"
                                    ? "border-plaeen-green"
                                    : "border-white/20",
                                )}
                              >
                                <img
                                  src={getUserAvatar(res.photoURL)}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ),
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase  px-3 py-1 rounded-full",
                            session.status === "scheduled"
                              ? "bg-plaeen-green text-black"
                              : "bg-white/10 text-white/40",
                          )}
                        >
                          {session.status}
                        </span>
                      </div>
                    </div>
                  ))}
                {sessions.length === 0 && (
                  <p className="text-center py-12 text-white/20 font-bold uppercase ">
                    No sessions scheduled
                  </p>
                )}
                <Button
                  onClick={() => navigate(`/search?teamId=${teamId}`)}
                  className="w-full py-6 font-bold uppercase  bg-plaeen-purple/40 text-plaeen-green border border-plaeen-green/30"
                >
                  <Plus size={20} className="mr-2" /> Propose Session
                </Button>
              </div>
            </Card>
          </section>

          {/* Steam Integration Mock */}
          <section>
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-green mb-8 flex items-center gap-3">
              <MessageSquare size={16} /> Steam Integration
            </h2>
            <Card className="bg-white/5 border-white/10 p-8 text-center">
              <div className="h-16 w-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                <Gamepad2 size={32} className="text-white/20" />
              </div>
              <p className="text-sm text-white/40 font-medium mb-8">
                Connect your Steam ID to sync achievements and playtime
                automatically.
              </p>
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10 font-bold uppercase "
              >
                Connect Steam
              </Button>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
};
