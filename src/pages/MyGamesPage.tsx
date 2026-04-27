import React, { useState, useEffect } from "react";
import { auth, db } from "@/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayRemove,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { useNavigate } from "react-router-dom";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { GameDetailsModal } from "@/components/GameDetailsModal";
import {
  Heart,
  Trash2,
  ExternalLink,
  Gamepad2,
  CheckCircle2,
  XCircle,
  Users,
  Share2,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Zap,
  Play,
  Search as SearchIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import type { GameItem } from "@/lib/types";

interface GameTeamAssociation {
  gameId: string;
  teamIds: string[];
}

interface TeamWithSession {
  id: string;
  name: string;
  sessionId: string;
  imageURL?: string;
}

export const MyGamesPage = () => {
  const [user] = useAuthState(auth);
  const { activeKid } = useProfile();
  const [wishlist, setWishlist] = useState<GameItem[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "wishlist" | "played" | "rejected"
  >("wishlist");
  const [gameTeamsMap, setGameTeamsMap] = useState<
    Map<string, TeamWithSession[]>
  >(new Map());
  const navigate = useNavigate();

  // Modal states
  const [selectedGameDetails, setSelectedGameDetails] =
    useState<GameItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedGameTeams, setSelectedGameTeams] = useState<TeamWithSession[]>(
    [],
  );
  const [proposeGameId, setProposeGameId] = useState<string | null>(null);
  const [recommendGameId, setRecommendGameId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !activeKid) return;

    // Listen to user data for wishlist and allowedGames
    const unsubscribeUser = onSnapshot(
      doc(db, "users", activeKid.uid),
      (docSnap) => {
        try {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setWishlist(data.wishlist || []);
          }
        } catch (err) {
          console.error("Error processing user wishlist:", err);
        }
      },
      (error) => handleFirestoreError(error, "get", `users/${activeKid.uid}`),
    );

    // Listen to approvals for pending/denied games
    const isParent = user.uid !== activeKid.uid;
    const qApprovals = query(
      collection(db, "approvals"),
      where("childId", "==", activeKid.uid),
      where(isParent ? "parentId" : "childId", "==", user.uid),
      where("type", "==", "game"),
    );
    const unsubscribeApprovals = onSnapshot(
      qApprovals,
      (snapshot) => {
        setApprovals(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, "list", "approvals"),
    );

    // Fetch teams
    const qTeams = query(
      collection(db, "groups"),
      where(isParent ? "parentIds" : "members", "array-contains", user.uid),
    );
    const unsubscribeTeams = onSnapshot(
      qTeams,
      (snapshot) => {
        const allTeams = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Filter client-side to avoid multiple array-contains
        setTeams(
          allTeams.filter((t: any) => t.members.includes(activeKid.uid)),
        );
      },
      (error) => handleFirestoreError(error, "list", "groups"),
    );

    // Fetch friends
    let unsubscribeFriends: (() => void) | undefined;
    if (activeKid.friends && activeKid.friends.length > 0) {
      const qFriends = query(
        collection(db, "users_public"),
        where("uid", "in", activeKid.friends),
      );
      unsubscribeFriends = onSnapshot(
        qFriends,
        (snapshot) => {
          setFriends(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (error) => handleFirestoreError(error, "list", "users_public"),
      );
    } else {
      setFriends([]);
    }

    return () => {
      unsubscribeUser();
      unsubscribeApprovals();
      unsubscribeTeams();
      if (unsubscribeFriends) unsubscribeFriends();
    };
  }, [user, activeKid]);

  // Fetch team sessions to find which games are being played
  useEffect(() => {
    if (!teams || teams.length === 0) {
      setGameTeamsMap(new Map());
      return;
    }

    const fetchTeamSessions = async () => {
      const newGameTeamsMap = new Map<string, TeamWithSession[]>();

      for (const team of teams) {
        try {
          const sessionsQuery = query(
            collection(db, "groups", team.id, "sessions"),
            where("status", "in", ["scheduled", "ongoing", "completed"]),
          );
          const sessionsSnapshot = await getDocs(sessionsQuery);

          sessionsSnapshot.forEach((sessionDoc) => {
            const session = sessionDoc.data();
            const gameId = session.gameId;

            if (gameId) {
              if (!newGameTeamsMap.has(gameId)) {
                newGameTeamsMap.set(gameId, []);
              }
              const teamAssociation: TeamWithSession = {
                id: team.id,
                name: team.name,
                sessionId: sessionDoc.id,
                imageURL: team.imageURL,
              };
              const existing = newGameTeamsMap.get(gameId);
              if (existing && !existing.find((t) => t.id === team.id)) {
                existing.push(teamAssociation);
              }
            }
          });
        } catch (err) {
          console.error(`Error fetching sessions for team ${team.id}:`, err);
        }
      }

      setGameTeamsMap(newGameTeamsMap);
    };

    fetchTeamSessions();
  }, [teams]);

  const removeFromWishlist = async (gameId: string) => {
    if (!activeKid) return;
    try {
      const itemToRemove = wishlist.find((item) => item.id === gameId);
      if (itemToRemove) {
        await updateDoc(doc(db, "users", activeKid.uid), {
          wishlist: arrayRemove(itemToRemove),
        });
      }
    } catch (err) {
      console.error("Error removing from wishlist:", err);
    }
  };

  const handleProposeToTeam = async (game: GameItem, teamId: string) => {
    if (!activeKid) return;
    try {
      await addDoc(collection(db, "groups", teamId, "sessions"), {
        gameId: game.id,
        gameName: game.name,
        gameImage: game.image,
        proposedBy: activeKid.uid,
        proposedByName: activeKid.displayName,
        status: "proposed",
        createdAt: serverTimestamp(),
        votes: {
          [activeKid.uid]: true,
        },
      });
      alert(`Proposed ${game.name} to the team!`);
    } catch (err) {
      console.error("Error proposing game:", err);
    }
  };

  const handleRecommendToFriend = async (game: GameItem, friendId: string) => {
    if (!activeKid) return;
    try {
      await addDoc(collection(db, "notifications"), {
        userId: friendId,
        type: "game_recommendation",
        title: "Game Recommendation!",
        message: `${activeKid.displayName} thinks you should check out ${game.name}`,
        data: {
          gameId: game.id,
          gameName: game.name,
          gameImage: game.image,
          fromId: activeKid.uid,
          fromName: activeKid.displayName,
        },
        createdAt: serverTimestamp(),
        read: false,
      });
      alert(`Recommended ${game.name} to your friend!`);
    } catch (err) {
      console.error("Error recommending game:", err);
    }
  };

  const approvedGames = wishlist.filter((g) =>
    activeKid?.allowedGames?.includes(g.id),
  );
  const pendingGames = approvals.filter((a) => a.status === "pending");
  const rejectedGames = approvals.filter((a) => a.status === "denied");

  // Separate games into played and wishlist-only
  const gamesBeingPlayed = wishlist.filter((g) => gameTeamsMap.has(g.id));
  const gamesWishlistOnly = wishlist.filter((g) => !gameTeamsMap.has(g.id));

  const renderGameCard = (
    game: GameItem,
    teamAssociations?: TeamWithSession[],
  ) => (
    <Card
      key={`${game.id}-${teamAssociations ? teamAssociations.map((t) => t.id).join("-") : "wishlist"}`}
      className="p-0 overflow-hidden border-white/10 bg-white/5 group hover:border-plaeen-green/30 transition-all duration-500"
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={game.image}
          alt={game.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Magnifier Overlay on Hover */}
        <button
          onClick={() => {
            setSelectedGameDetails(game);
            setSelectedGameTeams(gameTeamsMap.get(game.id) || []);
            setIsDetailsOpen(true);
          }}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="bg-plaeen-green/80 hover:bg-plaeen-green text-black rounded-full p-4 transition-all">
            <SearchIcon size={32} />
          </div>
        </button>

        {/* Status Badge */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {activeKid?.allowedGames?.includes(game.id) && (
            <div className="bg-plaeen-green text-black px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-lg">
              Approved
            </div>
          )}
          {teamAssociations && teamAssociations.length > 0 && (
            <div className="bg-plaeen-purple text-white px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-1">
              <Zap size={10} /> Playing
            </div>
          )}
        </div>

        {/* Team Associations (when played) */}
        {teamAssociations && teamAssociations.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-[8px] font-bold text-white/60 uppercase tracking-widest mb-2">
              Playing with:
            </p>
            <div className="flex flex-wrap gap-2">
              {teamAssociations.map((teamAssoc) => (
                <button
                  key={teamAssoc.id}
                  onClick={() =>
                    navigate(
                      `/teams/${teamAssoc.id}/games/${game.id}?sessionId=${teamAssoc.sessionId}`,
                    )
                  }
                  className="bg-plaeen-purple/80 hover:bg-plaeen-purple text-white px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  <Play size={10} fill="white" /> {teamAssoc.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-white group-hover:text-plaeen-green transition-colors uppercase tracking-tight mb-6">
          {game.name}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setProposeGameId(game.id)}
            className="bg-white/5 border border-white/10 text-white/40 hover:text-plaeen-green hover:border-plaeen-green/30 px-4 py-2 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <Users size={12} /> Propose
          </button>

          <button
            onClick={() => setRecommendGameId(game.id)}
            className="bg-white/5 border border-white/10 text-white/40 hover:text-plaeen-purple hover:border-plaeen-purple/30 px-4 py-2 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <Share2 size={12} /> Recommend
          </button>
        </div>

        <button
          onClick={() => removeFromWishlist(game.id)}
          className="w-full mt-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 hover:border-red-500/40 px-4 py-2 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 size={12} /> Remove from Wishlist
        </button>
      </div>
    </Card>
  );

  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center text-white">
        Loading...
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            My <span className="text-plaeen-green">Games</span>
          </h1>
          <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">
            Manage your library & wishlist
          </p>
        </div>
        <Button
          onClick={() => navigate("/search")}
          className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-8 py-6 shadow-[0_0_20px_rgba(118,233,0,0.4)]"
        >
          <Search size={20} className="mr-2" /> Explore Games
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-12 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab("wishlist")}
          className={`px-6 py-2 font-bold uppercase tracking-widest text-sm transition-all ${activeTab === "wishlist" ? "text-plaeen-green border-b-2 border-plaeen-green" : "text-white/40 hover:text-white"}`}
        >
          Wishlist ({gamesWishlistOnly.length + approvedGames.length})
        </button>
        <button
          onClick={() => setActiveTab("played")}
          className={`px-6 py-2 font-bold uppercase tracking-widest text-sm transition-all ${activeTab === "played" ? "text-plaeen-green border-b-2 border-plaeen-green" : "text-white/40 hover:text-white"}`}
        >
          Played ({gamesBeingPlayed.length})
        </button>
        <button
          onClick={() => setActiveTab("rejected")}
          className={`px-6 py-2 font-bold uppercase tracking-widest text-sm transition-all ${activeTab === "rejected" ? "text-red-500 border-b-2 border-red-500" : "text-white/40 hover:text-white"}`}
        >
          Rejected ({rejectedGames.length})
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "wishlist" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[...gamesWishlistOnly, ...approvedGames].map((game) =>
                renderGameCard(game, undefined),
              )}
            </div>
            {gamesWishlistOnly.length === 0 && approvedGames.length === 0 && (
              <Card className="text-center py-24 bg-white/5 border-dashed border-white/10 rounded-[2.5rem]">
                <Gamepad2 size={64} className="mx-auto text-white/10 mb-8" />
                <h2 className="text-3xl font-bold text-white uppercase tracking-tighter mb-4">
                  Your wishlist is empty
                </h2>
                <p className="text-white/40 mb-12 max-w-md mx-auto font-bold uppercase tracking-widest text-[10px] leading-relaxed">
                  Explore our massive database and add your favorite games to
                  your wishlist!
                </p>
                <Button
                  onClick={() => navigate("/search")}
                  className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-12 py-6"
                >
                  Explore Games
                </Button>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === "played" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {gamesBeingPlayed.map((game) => {
                const teamAssocs = gameTeamsMap.get(game.id) || [];
                return renderGameCard(game, teamAssocs);
              })}
            </div>
            {gamesBeingPlayed.length === 0 && (
              <Card className="text-center py-24 bg-white/5 border-dashed border-white/10 rounded-[2.5rem]">
                <Zap size={64} className="mx-auto text-white/10 mb-8" />
                <h2 className="text-3xl font-bold text-white uppercase tracking-tighter mb-4">
                  No games being played yet
                </h2>
                <p className="text-white/40 mb-12 max-w-md mx-auto font-bold uppercase tracking-widest text-[10px] leading-relaxed">
                  Start proposing games to your teams to begin playing together!
                </p>
                <Button
                  onClick={() => navigate("/search")}
                  className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-12 py-6"
                >
                  Browse Games
                </Button>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === "rejected" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {rejectedGames.map((game) => (
                <Card
                  key={game.id}
                  className="p-0 overflow-hidden border-red-500/20 bg-red-500/5 group hover:border-red-500/50 transition-all duration-500"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={game.data.image}
                      alt={game.data.gameName}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 grayscale"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />
                    <div className="absolute top-4 right-4">
                      <div className="bg-red-500 text-white px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-lg">
                        Denied
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white/60 group-hover:text-red-400 transition-colors uppercase tracking-tight mb-2">
                      {game.data.gameName}
                    </h3>
                    <p className="text-[8px] text-red-400 uppercase font-bold mb-4">
                      Denied by Parent
                    </p>
                  </div>
                </Card>
              ))}
            </div>
            {rejectedGames.length === 0 && (
              <Card className="text-center py-24 bg-white/5 border-dashed border-white/10 rounded-[2.5rem]">
                <XCircle size={64} className="mx-auto text-white/10 mb-8" />
                <h2 className="text-3xl font-bold text-white uppercase tracking-tighter mb-4">
                  No rejected games
                </h2>
                <p className="text-white/40 mb-12 max-w-md mx-auto font-bold uppercase tracking-widest text-[10px] leading-relaxed">
                  All games you request will be reviewed by your parents.
                </p>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Details Modal */}
      <GameDetailsModal
        game={selectedGameDetails}
        isOpen={isDetailsOpen}
        teams={selectedGameTeams}
        onCreateSession={() => {
          if (selectedGameDetails) {
            setProposeGameId(selectedGameDetails.id);
          }
        }}
        onRecommend={() => {
          if (selectedGameDetails) {
            setRecommendGameId(selectedGameDetails.id);
          }
        }}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedGameDetails(null);
          setSelectedGameTeams([]);
        }}
      />

      {/* Team Selector Modal for Propose */}
      <AnimatePresence>
        {proposeGameId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-99 flex items-center justify-center p-6"
            onClick={() => setProposeGameId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-plaeen-dark border border-white/10 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold text-white uppercase tracking-tight mb-2">
                  Propose Game
                </h2>
                <p className="text-white/40 text-sm mb-6">
                  Select a team to propose this game
                </p>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {teams.length > 0 ? (
                    teams.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => {
                          handleProposeToTeam(
                            wishlist.find((g) => g.id === proposeGameId)!,
                            team.id,
                          );
                          setProposeGameId(null);
                        }}
                        className="w-full text-left px-4 py-3 bg-white/5 hover:bg-plaeen-green/20 border border-white/10 rounded-lg transition-all text-white font-bold uppercase text-sm tracking-widest flex items-center justify-between"
                      >
                        {team.name}
                        <Users size={16} className="text-plaeen-green" />
                      </button>
                    ))
                  ) : (
                    <p className="text-white/40 text-sm text-center py-6">
                      No teams joined yet
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setProposeGameId(null)}
                  className="w-full mt-6 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 font-bold uppercase text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friend Selector Modal for Recommend */}
      <AnimatePresence>
        {recommendGameId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-99 flex items-center justify-center p-6"
            onClick={() => setRecommendGameId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-plaeen-dark border border-white/10 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold text-white uppercase tracking-tight mb-2">
                  Recommend Game
                </h2>
                <p className="text-white/40 text-sm mb-6">
                  Select a friend to recommend this game
                </p>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {friends.length > 0 ? (
                    friends.map((friend) => (
                      <button
                        key={friend.id}
                        onClick={() => {
                          handleRecommendToFriend(
                            wishlist.find((g) => g.id === recommendGameId)!,
                            friend.id,
                          );
                          setRecommendGameId(null);
                        }}
                        className="w-full text-left px-4 py-3 bg-white/5 hover:bg-plaeen-purple/20 border border-white/10 rounded-lg transition-all text-white font-bold uppercase text-sm tracking-widest flex items-center justify-between"
                      >
                        {friend.displayName}
                        <Share2 size={16} className="text-plaeen-purple" />
                      </button>
                    ))
                  ) : (
                    <p className="text-white/40 text-sm text-center py-6">
                      No friends found
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setRecommendGameId(null)}
                  className="w-full mt-6 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 font-bold uppercase text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
