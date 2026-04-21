import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { auth, db } from "@/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Search,
  Filter,
  Gamepad2,
  Star,
  Plus,
  Check,
  Info,
  Sparkles,
  Monitor,
  Smartphone,
  Cpu,
  X,
  Heart,
  ExternalLink,
  ChevronDown,
  Shield,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { cn } from "@/lib/utils";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Game {
  id: string;
  slug?: string;
  name: string;
  description: string;
  platforms: string[];
  genres: string[];
  image: string;
  rating: number;
  releaseDate: string;
  isChildFriendly: boolean;
  minAge?: number;
  esrb_rating?: any;
}

import { useProfile } from "@/contexts/ProfileContext";

// Helper to calculate age from birthDate
function getAgeFromBirthDate(birthDate: any): number | null {
  if (!birthDate) return null;

  // Handle different date formats
  const date = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

export const GameSearchPage = () => {
  const [user] = useAuthState(auth);
  const { activeKid: kidData, role } = useProfile();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get("q") || "";
  const teamId = searchParams.get("teamId");

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<Game | null>(null);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [page, setPage] = useState(1);
  const [isRequesting, setIsRequesting] = useState(false);

  const isGameApproved = (gameId: string) => {
    if (role !== "kid" || !kidData) return true;
    return kidData.allowedGames?.includes(gameId);
  };

  const requestGameAccess = async (game: Game) => {
    if (!user || !kidData || !kidData.parentId) return;
    setIsRequesting(true);
    try {
      await addDoc(collection(db, "approvals"), {
        parentId: kidData.parentId,
        childId: kidData.uid,
        childName: kidData.displayName || "Anonymous",
        type: "game",
        status: "pending",
        data: {
          gameId: game.id,
          gameName: game.name,
          image: game.image,
          description: game.description,
          rating: game.rating,
          genres: game.genres,
          platforms: game.platforms,
          slug: game.slug || game.id,
          isChildFriendly: game.isChildFriendly,
          esrbRating:
            (game as any).esrb_rating?.name ||
            (game as any).esrbRating ||
            "Not Rated",
        },
        createdAt: Timestamp.now(),
      });
      alert("Access request sent to your parent!");
    } catch (err) {
      console.error("Error requesting game access:", err);
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch("/api/games");
        if (response.status === 500) {
          const data = await response.json();
          if (data.error === "RAWG_API_KEY is not configured") {
            setApiKeyMissing(true);
          }
        }
      } catch (err) {
        // Ignore
      }
    };
    checkApiKey();
  }, []);

  const exploreGames = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      let url = `/api/games?page=${pageNum}`;
      if (role === "kid" && kidData?.restrictedMode) {
        const age = getAgeFromBirthDate(kidData.birthDate);
        if (age) url += `&userAge=${age}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("API error");
      const data = await response.json();
      if (pageNum === 1) {
        setGames(data);
        if (data.length > 0) setRecommendation(data[0]);
      } else {
        setGames((prev) => [...prev, ...data]);
      }
    } catch (err) {
      console.error("Explore error:", err);
      // Fallback to Gemini
      try {
        const prompt = `Act as a game database API. Provide 6 popular trending games. 
        Return a JSON array of exactly 6 game objects with: id (string), name, description (short), platforms (array), genres (array), image (picsum.photos/seed/{name}/600/400), rating (0-100), releaseDate, isChildFriendly (boolean).`;

        const geminiResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });

        const text = geminiResponse.text || "";
        const cleanedText = text.replace(/```json|```/g, "").trim();
        const fallbackGames = JSON.parse(cleanedText);
        if (pageNum === 1) {
          setGames(fallbackGames);
          setRecommendation(fallbackGames[0]);
        } else {
          setGames((prev) => [...prev, ...fallbackGames]);
        }
      } catch (geminiErr) {
        console.error("Gemini fallback error:", geminiErr);
        const defaultGames = [
          {
            id: "1",
            name: "Elden Ring",
            description:
              "Rise, Tarnished, and be led by grace to brandish the power of the Elden Ring.",
            platforms: ["PC", "PS5", "Xbox"],
            genres: ["RPG"],
            image: "https://picsum.photos/seed/elden/600/400",
            rating: 96,
            releaseDate: "2022-02-25",
            isChildFriendly: false,
          },
          {
            id: "2",
            name: "Valorant",
            description: "A 5v5 character-based tactical shooter.",
            platforms: ["PC"],
            genres: ["Shooter"],
            image: "https://picsum.photos/seed/valorant/600/400",
            rating: 80,
            releaseDate: "2020-06-02",
            isChildFriendly: false,
          },
          {
            id: "3",
            name: "Minecraft",
            description:
              "Explore infinite worlds and build everything from the simplest of homes to the grandest of castles.",
            platforms: ["PC", "Mobile", "Console"],
            genres: ["Sandbox"],
            image: "https://picsum.photos/seed/minecraft/600/400",
            rating: 90,
            releaseDate: "2011-11-18",
            isChildFriendly: true,
          },
        ];
        if (pageNum === 1) {
          setGames(defaultGames);
          setRecommendation(defaultGames[0]);
        } else {
          setGames((prev) => [...prev, ...defaultGames]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const searchGames = useCallback(
    async (queryOverride?: string, pageNum = 1) => {
      const query = queryOverride || searchQuery;
      if (!query.trim()) {
        exploreGames(pageNum);
        return;
      }

      setLoading(true);
      try {
        let url = `/api/games?search=${encodeURIComponent(query)}&page=${pageNum}`;
        if (role === "kid" && kidData?.restrictedMode) {
          const age = getAgeFromBirthDate(kidData.birthDate);
          if (age) url += `&userAge=${age}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error("API error");
        const data = await response.json();
        if (pageNum === 1) {
          setGames(data);
        } else {
          setGames((prev) => [...prev, ...data]);
        }
      } catch (err) {
        console.error("Search error:", err);
        // Fallback to Gemini if backend API fails
        try {
          const prompt = `Act as a game database API. Search for games matching "${query}". 
        Return a JSON array of exactly 6 game objects with: id (string), name, description (short), platforms (array), genres (array), image (picsum.photos/seed/{name}/600/400), rating (0-100), releaseDate, isChildFriendly (boolean).
        Filter results based on: ${role === "kid" && kidData?.restrictedMode ? "ONLY child-friendly games" : "all games"}.`;

          const geminiResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
          });

          const text = geminiResponse.text || "";
          const cleanedText = text.replace(/```json|```/g, "").trim();
          const fallbackGames = JSON.parse(cleanedText);
          if (pageNum === 1) {
            setGames(fallbackGames);
          } else {
            setGames((prev) => [...prev, ...fallbackGames]);
          }
        } catch (geminiErr) {
          console.error("Gemini fallback error:", geminiErr);
          exploreGames(pageNum);
        }
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, role, exploreGames],
  );

  const fetchGameDetails = async (game: Game) => {
    setLoadingDetails(true);
    setSelectedGame(game); // Show basic info immediately
    try {
      const response = await fetch(`/api/games/${game.id}`);
      if (!response.ok) throw new Error("API error");
      const data = await response.json();
      setSelectedGame(data);
    } catch (err) {
      console.error("Details error:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const createSession = async (game: Game) => {
    if (!user || !teamId) return;
    try {
      await addDoc(collection(db, "groups", teamId, "sessions"), {
        gameId: game.id,
        gameName: game.name,
        gameImage: game.image,
        startTime: Timestamp.fromDate(new Date()), // Default to now, user can edit in calendar
        proposedBy: user.uid,
        proposedByName: user.displayName,
        status: "proposed",
        responses: {
          [user.uid]: { status: "accepted", note: "Created from search" },
        },
      });
      navigate(`/teams/${teamId}`);
    } catch (err) {
      console.error("Error creating session:", err);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    if (searchQuery) {
      searchGames(searchQuery, nextPage);
    } else {
      exploreGames(nextPage);
    }
  };

  useEffect(() => {
    if (kidData) {
      setWishlistIds(kidData.wishlist?.map((g: any) => g.id) || []);
    }

    if (initialQuery) {
      searchGames(initialQuery);
    } else {
      exploreGames();
    }
  }, [kidData, initialQuery, searchGames, exploreGames]);

  const toggleWishlist = async (game: Game) => {
    if (!user) return;
    const isAdded = wishlistIds.includes(game.id);

    try {
      if (isAdded) {
        // Find the exact item in the user's wishlist to remove it
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const currentWishlist = userDoc.data().wishlist || [];
          const itemToRemove = currentWishlist.find(
            (item: any) => item.id === game.id,
          );
          if (itemToRemove) {
            await updateDoc(doc(db, "users", user.uid), {
              wishlist: arrayRemove(itemToRemove),
            });
          }
        }
        setWishlistIds((prev) => prev.filter((id) => id !== game.id));
      } else {
        const wishlistItem = {
          ...game,
          addedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, "users", user.uid), {
          wishlist: arrayUnion(wishlistItem),
        });
        setWishlistIds((prev) => [...prev, game.id]);
      }
    } catch (err) {
      console.error("Wishlist error:", err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {apiKeyMissing && (
        <div className="mb-8 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-sm font-bold uppercase tracking-widest text-center">
          RAWG API Key is missing. Using AI-generated game data as fallback.
          <span className="block text-[10px] mt-1 opacity-60">
            Please configure RAWG_API_KEY in settings for real game data.
          </span>
        </div>
      )}

      <div className="mb-16 flex flex-col md:flex-row items-center justify-between gap-6">
        <h1>Create New Session</h1>
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="border-white/20 text-white hover:bg-white/10 font-bold uppercase tracking-widest px-8"
        >
          Go Back
        </Button>
      </div>

      {/* Recommendation Section */}
      {recommendation && !searchQuery && (
        <div className="mb-20 relative h-[500px] rounded-[2.5rem] overflow-hidden group">
          <img
            src={recommendation.image}
            alt={recommendation.name}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center p-12 md:p-20">
            <div className="text-plaeen-green text-xs font-bold uppercase tracking-[0.4em] mb-4">
              Our Recommendation
            </div>
            <h2 className="text-6xl md:text-8xl font-bold text-white uppercase tracking-tighter mb-8 max-w-2xl">
              {recommendation.name}
            </h2>
            <div className="flex flex-wrap gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() =>
                  teamId
                    ? createSession(recommendation)
                    : fetchGameDetails(recommendation)
                }
              >
                {teamId ? "Create Session" : "Let's play!"}
              </Button>
              <Button
                variant="glass"
                onClick={() =>
                  window.open(
                    `https://rawg.io/games/${recommendation.slug || recommendation.id}`,
                    "_blank",
                  )
                }
                className="text-xl"
              >
                <ExternalLink className="mr-3" size={24} /> Check on RAWG
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl mb-12">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            searchGames();
          }}
          className="relative group mb-8"
        >
          <div className="absolute inset-0 bg-plaeen-green/20 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for games..."
            className="w-full rounded-2xl border-2 border-white/10 bg-plaeen-purple/20 px-8 py-6 text-xl font-bold text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all relative z-10 backdrop-blur-xl"
          />
          <button
            type="submit"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-xl bg-plaeen-green text-black flex items-center justify-center hover:scale-110 transition-transform z-20 shadow-[0_0_15px_rgba(118,233,0,0.5)]"
          >
            <Search size={24} />
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-4">
          {["Relevance", "Genre", "Theme", "Platform"].map((filter) => (
            <button
              key={filter}
              className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-plaeen-green hover:border-plaeen-green/50 transition-all flex items-center gap-3"
            >
              {filter} <ChevronDown size={14} />
            </button>
          ))}
        </div>
      </div>

      {loading && page === 1 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="h-16 w-16 border-4 border-plaeen-green border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(118,233,0,0.3)]" />
          <p className="text-plaeen-green font-bold uppercase tracking-[0.3em] animate-pulse">
            Scanning Database...
          </p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Card
              key={game.id}
              className="group relative overflow-hidden bg-plaeen-purple/20 border-white/5 p-0 hover:border-plaeen-green/30 transition-all duration-500"
            >
              <div className="aspect-[16/10] overflow-hidden relative">
                <img
                  src={game.image}
                  alt={game.name}
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark via-transparent to-transparent opacity-60" />
              </div>

              <div className="p-6">
                <h3 className="text-xl font-bold text-plaeen-green uppercase tracking-tight mb-4 group-hover:text-white transition-colors">
                  {game.name}
                </h3>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-white/20">Release date</span>
                    <span className="text-white/60">
                      {game.releaseDate !== "TBA"
                        ? format(new Date(game.releaseDate), "d MMMM yyyy")
                        : "TBA"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-white/20">Genre</span>
                    <span className="text-white/60 truncate max-w-[150px]">
                      {game.genres.join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-white/20">Platforms</span>
                    <div className="flex gap-2 text-white/60">
                      {game.platforms.slice(0, 3).map((p) => (
                        <Monitor key={p} size={12} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {isGameApproved(game.id) ? (
                    <Button
                      onClick={() =>
                        teamId ? createSession(game) : fetchGameDetails(game)
                      }
                      className="flex-1 font-bold uppercase tracking-widest text-xs py-3 bg-plaeen-purple text-white hover:bg-plaeen-green hover:text-black transition-all"
                    >
                      {teamId ? "Create Session" : "View Details"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => requestGameAccess(game)}
                      disabled={isRequesting}
                      className="flex-1 font-bold uppercase tracking-widest text-[10px] py-3 bg-white/5 text-white/40 border border-white/10 hover:border-plaeen-green hover:text-plaeen-green transition-all"
                    >
                      Request Access
                    </Button>
                  )}
                  <button
                    onClick={() => toggleWishlist(game)}
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center transition-all border",
                      wishlistIds.includes(game.id)
                        ? "bg-plaeen-green border-plaeen-green text-black shadow-[0_0_15px_rgba(118,233,0,0.4)]"
                        : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/30",
                    )}
                  >
                    <Heart
                      size={18}
                      className={
                        wishlistIds.includes(game.id) ? "fill-current" : ""
                      }
                    />
                  </button>
                  <button
                    onClick={() =>
                      window.open(
                        `https://rawg.io/games/${game.slug || game.id}`,
                        "_blank",
                      )
                    }
                    className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-white/40 flex items-center justify-center hover:text-white hover:border-white/30 transition-all"
                  >
                    <ExternalLink size={18} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {games.length > 0 && (
        <div className="mt-16 flex justify-center">
          <Button
            onClick={loadMore}
            disabled={loading}
            className="px-12 py-6 text-lg font-bold uppercase tracking-widest bg-plaeen-green text-black hover:scale-105 transition-transform shadow-[0_0_30px_rgba(118,233,0,0.3)]"
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {/* Game Details Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-plaeen-dark border-plaeen-green/30 p-0 shadow-[0_0_50px_rgba(118,233,0,0.1)]">
            <div className="relative h-80">
              <img
                src={selectedGame.image}
                alt={selectedGame.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark via-transparent to-transparent" />
              <button
                onClick={() => setSelectedGame(null)}
                className="absolute top-6 right-6 h-12 w-12 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:scale-110 transition-transform border border-white/10"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-12">
              <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                <div>
                  <h2 className="text-6xl font-bold text-white uppercase tracking-tighter mb-4">
                    {selectedGame.name}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {selectedGame.genres.map((g) => (
                      <span
                        key={g}
                        className="px-4 py-1 rounded-full bg-plaeen-green/10 border border-plaeen-green/20 text-plaeen-green text-[10px] font-bold uppercase tracking-widest"
                      >
                        {g}
                      </span>
                    ))}
                    <span className="px-4 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold uppercase tracking-widest">
                      Released:{" "}
                      {selectedGame.releaseDate !== "TBA"
                        ? format(
                            new Date(selectedGame.releaseDate),
                            "d MMMM yyyy",
                          )
                        : "TBA"}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-bold text-plaeen-green mb-1">
                    {selectedGame.rating}%
                  </div>
                  <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                    Metascore
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-12">
                <div className="md:col-span-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-6">
                    About the game
                  </h3>
                  {loadingDetails ? (
                    <div className="flex items-center gap-4 text-plaeen-green animate-pulse">
                      <Sparkles size={20} />
                      <span className="font-bold uppercase tracking-widest">
                        Fetching full intel...
                      </span>
                    </div>
                  ) : (
                    <p className="text-lg text-white/60 leading-relaxed font-medium">
                      {selectedGame.description}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-6">
                    Platforms
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedGame.platforms.map((p) => (
                      <div
                        key={p}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                      >
                        <Monitor size={16} className="text-white/20" />
                        <span className="text-xs font-bold text-white/60 uppercase">
                          {p}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 space-y-4">
                    {isGameApproved(selectedGame.id) ? (
                      <Button
                        onClick={() =>
                          teamId
                            ? createSession(selectedGame)
                            : toggleWishlist(selectedGame)
                        }
                        className={cn(
                          "w-full py-6 font-bold uppercase tracking-widest gap-3",
                          teamId
                            ? "bg-plaeen-green text-black"
                            : wishlistIds.includes(selectedGame.id)
                              ? "bg-white/5 border-white/10 text-white/40"
                              : "bg-plaeen-green text-black",
                        )}
                      >
                        {teamId ? (
                          <>
                            <Plus size={20} /> Create Session
                          </>
                        ) : wishlistIds.includes(selectedGame.id) ? (
                          <>
                            <Check size={20} /> In Wishlist
                          </>
                        ) : (
                          <>
                            <Heart size={20} /> Add to Wishlist
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => requestGameAccess(selectedGame)}
                        disabled={isRequesting}
                        className="w-full py-6 font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 hover:border-plaeen-green hover:text-plaeen-green gap-3"
                      >
                        <Shield size={20} /> Request Parent Approval
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `https://rawg.io/games/${selectedGame.slug || selectedGame.id}`,
                          "_blank",
                        )
                      }
                      className="w-full py-6 font-bold uppercase tracking-widest border-white/20 text-white hover:bg-white/10 gap-3"
                    >
                      <ExternalLink size={20} /> Check on RAWG
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!loading && games.length === 0 && searchQuery && (
        <div className="text-center py-20">
          <Gamepad2 size={64} className="mx-auto text-white/10 mb-6" />
          <p className="text-xl font-bold text-white/20 uppercase tracking-widest">
            No games found in this sector
          </p>
        </div>
      )}
    </div>
  );
};
