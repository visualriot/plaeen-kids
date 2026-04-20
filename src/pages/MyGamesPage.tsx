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
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { useNavigate } from "react-router-dom";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile } from "@/contexts/ProfileContext";

interface GameItem {
  id: string;
  name: string;
  image: string;
  addedAt?: string;
  status?: "pending" | "approved" | "denied";
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
    "wishlist" | "approved" | "rejected"
  >("wishlist");
  const [showRejected, setShowRejected] = useState(false);
  const navigate = useNavigate();

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
          Wishlist ({wishlist.length})
        </button>
        <button
          onClick={() => setActiveTab("approved")}
          className={`px-6 py-2 font-bold uppercase tracking-widest text-sm transition-all ${activeTab === "approved" ? "text-plaeen-green border-b-2 border-plaeen-green" : "text-white/40 hover:text-white"}`}
        >
          Approved ({approvedGames.length})
        </button>
        <button
          onClick={() => setShowRejected(!showRejected)}
          className={`px-6 py-2 font-bold uppercase tracking-widest text-sm transition-all flex items-center gap-2 ${showRejected ? "text-red-500" : "text-white/40 hover:text-white"}`}
        >
          Rejected ({rejectedGames.length}){" "}
          {showRejected ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showRejected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-12 overflow-hidden"
          >
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-500 mb-6 flex items-center gap-2">
              <XCircle size={14} /> Rejected Requests
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rejectedGames.map((game) => (
                <Card
                  key={game.id}
                  className="bg-red-500/5 border-red-500/20 p-4 opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={game.data.image}
                      alt={game.data.gameName}
                      className="h-12 w-12 rounded-lg object-cover grayscale"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase">
                        {game.data.gameName}
                      </h3>
                      <p className="text-[8px] text-red-400 uppercase font-bold">
                        Denied by Parent
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
              {rejectedGames.length === 0 && (
                <p className="text-white/20 text-xs uppercase font-bold">
                  No rejected games
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {(activeTab === "wishlist" ? wishlist : approvedGames).map((game) => (
          <Card
            key={game.id}
            className="p-0 overflow-hidden border-white/10 bg-white/5 group hover:border-plaeen-green/30 transition-all duration-500"
          >
            <div className="relative aspect-video overflow-hidden">
              <img
                src={game.image}
                alt={game.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-6">
                <div className="flex gap-2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0 duration-300">
                  <Button
                    size="sm"
                    className="flex-1 bg-plaeen-green text-black font-bold text-[10px] uppercase tracking-widest"
                    onClick={() =>
                      navigate(`/search?q=${encodeURIComponent(game.name)}`)
                    }
                  >
                    <ExternalLink size={14} className="mr-2" /> Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => removeFromWishlist(game.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {activeKid?.allowedGames?.includes(game.id) && (
                <div className="absolute top-4 right-4 bg-plaeen-green text-black px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-lg">
                  Approved
                </div>
              )}
            </div>

            <div className="p-6">
              <h3 className="text-xl font-bold text-white group-hover:text-plaeen-green transition-colors uppercase tracking-tight mb-6">
                {game.name}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative group/menu">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/10 text-white/40 hover:text-plaeen-green hover:border-plaeen-green/30 text-[8px] font-bold uppercase tracking-widest"
                  >
                    <Users size={12} className="mr-2" /> Propose
                  </Button>
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-plaeen-dark border border-white/10 rounded-xl p-2 hidden group-hover/menu:block z-20 shadow-2xl">
                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest p-2 border-b border-white/5 mb-2">
                      Select Team
                    </p>
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => handleProposeToTeam(game, team.id)}
                        className="w-full text-left px-3 py-2 text-[10px] font-bold text-white hover:bg-plaeen-green hover:text-black rounded-lg transition-colors uppercase tracking-widest"
                      >
                        {team.name}
                      </button>
                    ))}
                    {teams.length === 0 && (
                      <p className="text-[8px] text-white/20 p-2">
                        No teams joined
                      </p>
                    )}
                  </div>
                </div>

                <div className="relative group/menu">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/10 text-white/40 hover:text-plaeen-purple hover:border-plaeen-purple/30 text-[8px] font-bold uppercase tracking-widest"
                  >
                    <Share2 size={12} className="mr-2" /> Recommend
                  </Button>
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-plaeen-dark border border-white/10 rounded-xl p-2 hidden group-hover/menu:block z-20 shadow-2xl">
                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest p-2 border-b border-white/5 mb-2">
                      Select Friend
                    </p>
                    {friends.map((friend) => (
                      <button
                        key={friend.id}
                        onClick={() => handleRecommendToFriend(game, friend.id)}
                        className="w-full text-left px-3 py-2 text-[10px] font-bold text-white hover:bg-plaeen-purple hover:text-white rounded-lg transition-colors uppercase tracking-widest"
                      >
                        {friend.displayName}
                      </button>
                    ))}
                    {friends.length === 0 && (
                      <p className="text-[8px] text-white/20 p-2">
                        No friends found
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {(activeTab === "wishlist" ? wishlist : approvedGames).length === 0 && (
        <Card className="text-center py-24 bg-white/5 border-dashed border-white/10 rounded-[2.5rem]">
          <Gamepad2 size={64} className="mx-auto text-white/10 mb-8" />
          <h2 className="text-3xl font-bold text-white uppercase tracking-tighter mb-4">
            No games found here
          </h2>
          <p className="text-white/40 mb-12 max-w-md mx-auto font-bold uppercase tracking-widest text-[10px] leading-relaxed">
            Explore our massive database and find your next favorite adventure!
          </p>
          <Button
            onClick={() => navigate("/search")}
            className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-12 py-6"
          >
            Start Exploring
          </Button>
        </Card>
      )}
    </div>
  );
};
