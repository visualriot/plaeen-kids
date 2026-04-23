import { useState, useEffect, useCallback, useRef } from "react";
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
  query,
  where,
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
import { format, set } from "date-fns";

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
  platformsCount?: number;
  tags?: string[];
}

// Common platforms and genres
const PLATFORMS = [
  { id: "1", name: "PC" },
  { id: "2", name: "PlayStation" },
  { id: "3", name: "Xbox" },
  { id: "7", name: "Nintendo" },
  { id: "8", name: "iOS" },
  { id: "9", name: "Android" },
];

const GENRES = [
  { id: "4", name: "Action" },
  { id: "51", name: "Indie" },
  { id: "3", name: "Adventure" },
  { id: "5", name: "RPG" },
  { id: "10", name: "Strategy" },
  { id: "2", name: "Shooter" },
  { id: "59", name: "Massively Multiplayer" },
  { id: "1", name: "Racing" },
  { id: "6", name: "Sport" },
  { id: "14", name: "Simulation" },
  { id: "7", name: "Puzzle" },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "By Relevance" },
  { value: "year-desc", label: "By Release Year (Newest)" },
  { value: "year-asc", label: "By Release Year (Oldest)" },
  { value: "recommendation", label: "By Recommendation" },
];

// Platform logo mapping - returns SVG file paths
const getPlatformLogo = (platform: string): string => {
  const platformLower = platform.toLowerCase();

  // Determine SVG based on platform name
  if (
    platformLower.includes("playstation") ||
    platformLower.includes("ps5") ||
    platformLower.includes("ps4")
  ) {
    return "/icons/platforms/playstation.svg";
  } else if (platformLower.includes("xbox")) {
    return "/icons/platforms/xbox.svg";
  } else if (
    platformLower.includes("nintendo") ||
    platformLower.includes("switch")
  ) {
    return "/icons/platforms/nintendo.svg";
  } else if (platformLower.includes("pc") || platformLower === "pc") {
    return "/icons/platforms/pc.svg";
  } else if (
    platformLower.includes("linux") ||
    platformLower.includes("ubuntu")
  ) {
    return "/icons/platforms/ubuntu.svg";
  } else if (
    platformLower.includes("ios") ||
    platformLower.includes("apple") ||
    platformLower.includes("macos") ||
    platformLower.includes("mac")
  ) {
    return "/icons/platforms/apple.svg";
  } else if (platformLower.includes("android")) {
    return "/icons/platforms/android.svg";
  } else if (
    platformLower.includes("web") ||
    platformLower.includes("browser")
  ) {
    return "/icons/platforms/web.svg";
  } else {
    return "/icons/platforms/other.svg";
  }
};

// Platform Icon Component that renders SVG img with Tailwind support
const PlatformIcon: React.FC<{
  platform: string;
  className?: string;
  title?: string;
}> = ({ platform, className = "", title }) => {
  const svgPath = getPlatformLogo(platform);

  return (
    <img
      src={svgPath}
      alt={platform}
      title={title || platform}
      className={cn("inline-block", className)}
      style={{
        filter: "invert(1) brightness(1.1)",
      }}
    />
  );
};

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
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState(
    initialQuery.trim(),
  );
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<Game | null>(null);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [page, setPage] = useState(1);
  const [isRequesting, setIsRequesting] = useState(false);

  // Filter state
  const [sortBy, setSortBy] = useState<
    "relevance" | "year-desc" | "year-asc" | "recommendation"
  >("relevance");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [multiplatformOnly, setMultiplatformOnly] = useState(false);
  const [multiplayerOnly, setMultiplayerOnly] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  // Team selection modal state
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [userTeams, setUserTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [gameToCreate, setGameToCreate] = useState<Game | null>(null);
  const latestRequestRef = useRef(0);
  const lastInitialQueryRef = useRef(initialQuery);
  const [showRecommendationSection, setShowRecommendationSection] = useState(
    !initialQuery.trim(),
  );
  const hasSubmittedSearch = submittedSearchQuery.length > 0;

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterContainerRef.current &&
        !filterContainerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [openDropdown]);

  const getSortLabel = () => {
    const option = SORT_OPTIONS.find((opt) => opt.value === sortBy);
    return option?.label.split("By ")[1] || "Relevance";
  };

  const resetGenreFilters = () => {
    setSelectedGenres([]);
    setPage(1);
  };

  const resetPlatformFilters = () => {
    setSelectedPlatforms([]);
    setMultiplatformOnly(false);
    setPage(1);
  };

  const clearAllFilters = () => {
    setSortBy("relevance");
    setSelectedGenres([]);
    setSelectedPlatforms([]);
    setMultiplatformOnly(false);
    setMultiplayerOnly(false);
    setSearchQuery("");
    setSubmittedSearchQuery("");
    setShowRecommendationSection(false);
    setPage(1);
  };

  // Check if game is age-appropriate for the kid
  const isAgeAppropriate = (game: Game): boolean => {
    if (role !== "kid" || !kidData) return true;

    // If child-friendly, always appropriate
    if (game.isChildFriendly) return true;

    // Check against kid's age
    const kidAge = getAgeFromBirthDate(kidData.birthDate);
    if (!kidAge) return false;

    const minAge = game.minAge || 0;
    return kidAge >= minAge;
  };

  // Determine if kid needs to request access
  const needsAccessRequest = (game: Game): boolean => {
    if (role !== "kid" || !kidData) return false;

    // If already approved by parent, no need to request
    if (kidData.allowedGames?.includes(game.id)) return false;

    // If game is age-appropriate for the kid, no request needed
    if (isAgeAppropriate(game)) return false;

    // Otherwise (game is age-inappropriate), request is needed
    return true;
  };

  const isGameApproved = (gameId: string): boolean => {
    if (role !== "kid" || !kidData) return true;
    return kidData.allowedGames?.includes(gameId) ?? false;
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

  // Fetch user teams for team selector
  const fetchUserTeams = async () => {
    if (!user) return;
    setLoadingTeams(true);
    try {
      const groupsSnap = await getDoc(doc(db, "users", user.uid));
      if (groupsSnap.exists()) {
        const teamIds = groupsSnap.data().groups || [];
        const teamsData = await Promise.all(
          teamIds.map(async (groupId: string) => {
            const groupSnap = await getDoc(doc(db, "groups", groupId));
            return groupSnap.exists()
              ? { id: groupId, ...groupSnap.data() }
              : null;
          }),
        );
        setUserTeams(teamsData.filter(Boolean));
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
    } finally {
      setLoadingTeams(false);
    }
  };

  // Handle creating session with team selection
  const handleCreateSessionClick = (game: Game) => {
    if (teamId) {
      // Already have teamId, directly create session
      createSession(game);
    } else {
      // Need to select team first
      setGameToCreate(game);
      setShowTeamSelector(true);
      fetchUserTeams();
    }
  };

  // Create session in selected team
  const createSessionInTeam = async (selectedTeamId: string, game: Game) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "groups", selectedTeamId, "sessions"), {
        gameId: game.id,
        gameName: game.name,
        gameImage: game.image,
        startTime: Timestamp.fromDate(new Date()),
        proposedBy: user.uid,
        proposedByName: user.displayName,
        status: "proposed",
        responses: {
          [user.uid]: { status: "accepted", note: "Created from search" },
        },
      });
      setShowTeamSelector(false);
      setGameToCreate(null);
      alert("Gaming session created successfully!");
    } catch (err) {
      console.error("Error creating session:", err);
      alert("Failed to create session");
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

  const exploreGames = useCallback(
    async (pageNum = 1) => {
      const requestId = ++latestRequestRef.current;
      setLoading(true);
      try {
        let url = `/api/games?page=${pageNum}`;
        if (role === "kid" && kidData?.restrictedMode) {
          const age = getAgeFromBirthDate(kidData.birthDate);
          if (age) url += `&userAge=${age}`;
        }
        if (sortBy) url += `&sortBy=${sortBy}`;
        if (selectedGenres.length > 0)
          url += `&genres=${selectedGenres.join(",")}`;
        if (selectedPlatforms.length > 0)
          url += `&platforms=${selectedPlatforms.join(",")}`;
        if (multiplatformOnly) url += `&multiplatformOnly=true`;
        if (multiplayerOnly) url += `&multiplayerOnly=true`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("API error");
        const data = await response.json();
        if (requestId !== latestRequestRef.current) return;

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
          if (requestId !== latestRequestRef.current) return;

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
          if (requestId !== latestRequestRef.current) return;

          if (pageNum === 1) {
            setGames(defaultGames);
            setRecommendation(defaultGames[0]);
          } else {
            setGames((prev) => [...prev, ...defaultGames]);
          }
        }
      } finally {
        if (requestId === latestRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [
      role,
      kidData,
      sortBy,
      selectedGenres,
      selectedPlatforms,
      multiplatformOnly,
      multiplayerOnly,
    ],
  );

  const searchGames = useCallback(
    async (query: string, pageNum = 1) => {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        await exploreGames(pageNum);
        return;
      }

      const requestId = ++latestRequestRef.current;
      setLoading(true);
      try {
        let url = `/api/games?search=${encodeURIComponent(normalizedQuery)}&page=${pageNum}`;
        if (role === "kid" && kidData?.restrictedMode) {
          const age = getAgeFromBirthDate(kidData.birthDate);
          if (age) url += `&userAge=${age}`;
        }
        if (sortBy) url += `&sortBy=${sortBy}`;
        if (selectedGenres.length > 0)
          url += `&genres=${selectedGenres.join(",")}`;
        if (selectedPlatforms.length > 0)
          url += `&platforms=${selectedPlatforms.join(",")}`;
        if (multiplatformOnly) url += `&multiplatformOnly=true`;
        if (multiplayerOnly) url += `&multiplayerOnly=true`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("API error");
        const data = await response.json();
        if (requestId !== latestRequestRef.current) return;

        if (pageNum === 1) {
          setGames(data);
        } else {
          setGames((prev) => [...prev, ...data]);
        }
      } catch (err) {
        console.error("Search error:", err);
        // Fallback to Gemini if backend API fails
        try {
          const prompt = `Act as a game database API. Search for games matching "${normalizedQuery}". 
        Return a JSON array of exactly 6 game objects with: id (string), name, description (short), platforms (array), genres (array), image (picsum.photos/seed/{name}/600/400), rating (0-100), releaseDate, isChildFriendly (boolean).
        Filter results based on: ${role === "kid" && kidData?.restrictedMode ? "ONLY child-friendly games" : "all games"}.`;

          const geminiResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
          });

          const text = geminiResponse.text || "";
          const cleanedText = text.replace(/```json|```/g, "").trim();
          const fallbackGames = JSON.parse(cleanedText);
          if (requestId !== latestRequestRef.current) return;

          if (pageNum === 1) {
            setGames(fallbackGames);
          } else {
            setGames((prev) => [...prev, ...fallbackGames]);
          }
        } catch (geminiErr) {
          console.error("Gemini fallback error:", geminiErr);
          if (requestId !== latestRequestRef.current) return;

          // Don't fall back to explore for search - just show empty results
          if (pageNum === 1) {
            setGames([]);
          }
        }
      } finally {
        if (requestId === latestRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [
      role,
      kidData,
      exploreGames,
      sortBy,
      selectedGenres,
      selectedPlatforms,
      multiplatformOnly,
      multiplayerOnly,
    ],
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
    if (hasSubmittedSearch) {
      void searchGames(submittedSearchQuery, nextPage);
    } else {
      void exploreGames(nextPage);
    }
  };

  useEffect(() => {
    if (kidData) {
      setWishlistIds(kidData.wishlist?.map((g: any) => g.id) || []);
    }
  }, [kidData]);

  useEffect(() => {
    if (initialQuery === lastInitialQueryRef.current) return;

    lastInitialQueryRef.current = initialQuery;
    setSearchQuery(initialQuery);
    setSubmittedSearchQuery(initialQuery.trim());
    setShowRecommendationSection(!initialQuery.trim());
    setPage(1);
  }, [initialQuery]);

  // Re-run the active search whenever the applied query, filters, or user context changes.
  useEffect(() => {
    setPage(1);

    if (hasSubmittedSearch) {
      void searchGames(submittedSearchQuery, 1);
    } else {
      void exploreGames(1);
    }
  }, [hasSubmittedSearch, submittedSearchQuery, searchGames, exploreGames]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextQuery = searchQuery.trim();
    setShowRecommendationSection(false);
    setPage(1);

    if (nextQuery === submittedSearchQuery) {
      if (nextQuery) {
        void searchGames(nextQuery, 1);
      } else {
        void exploreGames(1);
      }
      return;
    }

    setSubmittedSearchQuery(nextQuery);
  };

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
      {recommendation && !hasSubmittedSearch && showRecommendationSection && (
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

      <form
        onSubmit={handleSearchSubmit}
        className="relative group mb-8 mx-auto max-w-7xl"
      >
        <div className="absolute inset-0 bg-plaeen-green/20 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for games..."
          className="w-full rounded-2xl border-2 border-white/10 bg-plaeen-purple/20 px-8 py-6 text-xl font-bold text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all relative z-10 backdrop-blur-xl"
        />
        <div className="space-x-2">
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
              }}
              className="absolute right-16 top-1/2 -translate-y-1/2 h-12 w-12 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 hover:scale-95 flex items-center justify-center transition-all z-20"
              title="Clear search"
            >
              <X size={24} />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-xl bg-plaeen-green text-black flex items-center justify-center hover:scale-95 transition-transform z-20 shadow-[0_0_15px_rgba(118,233,0,0.5)]"
          >
            <Search size={24} />
          </button>
        </div>
      </form>

      <div className="mx-auto max-w-7xl mb-12">
        <div
          ref={filterContainerRef}
          className="flex flex-wrap justify-between items-center gap-6"
        >
          {/* Left Side - Filters and Toggle */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Genre - Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() =>
                  setOpenDropdown(openDropdown === "genre" ? null : "genre")
                }
                className={cn(
                  "px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap",
                  selectedGenres.length > 0
                    ? "bg-plaeen-green/20 border-plaeen-green text-plaeen-green"
                    : openDropdown === "genre"
                      ? "bg-plaeen-green/20 border-plaeen-green text-plaeen-green"
                      : "bg-white/5 border-white/10 text-white/40 hover:text-plaeen-green hover:border-plaeen-green/50",
                )}
              >
                Genre
                {selectedGenres.length > 0 && ` (${selectedGenres.length})`}
                <ChevronDown size={12} />
              </button>
              {openDropdown === "genre" && (
                <div className="absolute top-full mt-1 left-0 bg-plaeen-dark border border-plaeen-green/30 rounded-lg shadow-lg z-50 max-h-80 flex flex-col overflow-hidden">
                  <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-thumb-rounded-full scrollbar-track-transparent flex-1">
                    {GENRES.map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => {
                          setSelectedGenres((prev) =>
                            prev.includes(genre.id)
                              ? prev.filter((g) => g !== genre.id)
                              : [...prev, genre.id],
                          );
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-left transition-all whitespace-nowrap flex items-center gap-3",
                          selectedGenres.includes(genre.id)
                            ? "bg-plaeen-green/20 text-plaeen-green"
                            : "text-white/60 hover:text-plaeen-green hover:bg-white/5",
                        )}
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                            selectedGenres.includes(genre.id)
                              ? "bg-plaeen-green border-plaeen-green shadow-[0_0_6px_rgba(118,233,0,0.4)]"
                              : "border-white/30",
                          )}
                        >
                          {selectedGenres.includes(genre.id) && (
                            <Check size={10} className="text-black" />
                          )}
                        </div>
                        {genre.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-0 border-t border-white/10">
                    <button
                      onClick={resetGenreFilters}
                      className="flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/60 transition-colors border-r border-white/10"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setOpenDropdown(null)}
                      className="flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-plaeen-green hover:bg-plaeen-green/10 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Platform - Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() =>
                  setOpenDropdown(
                    openDropdown === "platform" ? null : "platform",
                  )
                }
                className={cn(
                  "px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap",
                  selectedPlatforms.length > 0 || multiplatformOnly
                    ? "bg-plaeen-green/20 border-plaeen-green text-plaeen-green"
                    : openDropdown === "platform"
                      ? "bg-plaeen-green/20 border-plaeen-green text-plaeen-green"
                      : "bg-white/5 border-white/10 text-white/40 hover:text-plaeen-green hover:border-plaeen-green/50",
                )}
              >
                Platform
                {(selectedPlatforms.length > 0 || multiplatformOnly) &&
                  ` (${selectedPlatforms.length + (multiplatformOnly ? 1 : 0)})`}
                <ChevronDown size={12} />
              </button>
              {openDropdown === "platform" && (
                <div className="absolute top-full mt-1 left-0 bg-plaeen-dark border border-plaeen-green/30 rounded-lg shadow-lg z-50 max-h-80 flex flex-col overflow-hidden">
                  <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-thumb-rounded-full scrollbar-track-transparent flex-1">
                    <button
                      onClick={() => {
                        setMultiplatformOnly(!multiplatformOnly);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-left transition-all border-b border-white/10 whitespace-nowrap flex items-center gap-3",
                        multiplatformOnly
                          ? "bg-plaeen-green/20 text-plaeen-green"
                          : "text-white/60 hover:text-plaeen-green hover:bg-white/5",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                          multiplatformOnly
                            ? "bg-plaeen-green border-plaeen-green shadow-[0_0_6px_rgba(118,233,0,0.4)]"
                            : "border-white/30",
                        )}
                      >
                        {multiplatformOnly && (
                          <Check size={10} className="text-black" />
                        )}
                      </div>
                      Multiplatform
                    </button>
                    {PLATFORMS.map((platform) => (
                      <button
                        key={platform.id}
                        onClick={() => {
                          setSelectedPlatforms((prev) =>
                            prev.includes(platform.id)
                              ? prev.filter((p) => p !== platform.id)
                              : [...prev, platform.id],
                          );
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-left transition-all whitespace-nowrap flex items-center gap-3",
                          selectedPlatforms.includes(platform.id)
                            ? "bg-plaeen-green/20 text-plaeen-green"
                            : "text-white/60 hover:text-plaeen-green hover:bg-white/5",
                        )}
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                            selectedPlatforms.includes(platform.id)
                              ? "bg-plaeen-green border-plaeen-green shadow-[0_0_6px_rgba(118,233,0,0.4)]"
                              : "border-white/30",
                          )}
                        >
                          {selectedPlatforms.includes(platform.id) && (
                            <Check size={10} className="text-black" />
                          )}
                        </div>
                        {platform.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-0 border-t border-white/10">
                    <button
                      onClick={resetPlatformFilters}
                      className="flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/60 transition-colors border-r border-white/10"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setOpenDropdown(null)}
                      className="flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-plaeen-green hover:bg-plaeen-green/10 transition-colors"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Multiplayer - Toggle Switch */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setMultiplayerOnly(!multiplayerOnly);
                }}
                className={cn(
                  "relative inline-flex h-8 w-14 items-center rounded-full transition-all",
                  multiplayerOnly
                    ? "bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.3)]"
                    : "bg-white/10 border border-white/20",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md",
                    multiplayerOnly ? "translate-x-7" : "translate-x-1",
                  )}
                />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                Multiplayer Only
              </span>
            </div>
          </div>

          {/* Right Side - Sort Only */}
          <div className="flex items-center gap-6">
            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() =>
                  setOpenDropdown(openDropdown === "sort" ? null : "sort")
                }
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white/70 transition-colors"
              >
                Sort By:{" "}
                <span className="text-plaeen-green">{getSortLabel()}</span>
                <ChevronDown size={12} />
              </button>
              {openDropdown === "sort" && (
                <div className="absolute top-full mt-2 right-0 bg-plaeen-dark border border-white/20 rounded-lg overflow-hidden shadow-lg z-50">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSortBy(opt.value as any);
                        setOpenDropdown(null);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-left transition-all whitespace-nowrap",
                        sortBy === opt.value
                          ? "bg-plaeen-green/20 text-plaeen-green"
                          : "text-white/60 hover:text-white hover:bg-white/5",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clear All Filters Button - Below filters */}
        {(selectedGenres.length > 0 ||
          selectedPlatforms.length > 0 ||
          multiplatformOnly ||
          multiplayerOnly ||
          hasSubmittedSearch ||
          searchQuery.trim() ||
          sortBy !== "relevance") && (
          <div className="mt-4 flex justify-start">
            <Button
              onClick={clearAllFilters}
              type="button"
              variant="tertiary"
              size="sm"
              className="p-0 hover:text-red-500"
            >
              Clear All Filters
            </Button>
          </div>
        )}
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
                <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-4 group-hover:text-plaeen-green transition-colors">
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
                    <div className="flex gap-2">
                      {game.platforms.slice(0, 3).map((p) => (
                        <PlatformIcon
                          key={p}
                          platform={p}
                          className="h-5 w-5 opacity-70 hover:opacity-100 transition-opacity text-white/20 fill-white/20"
                          title={p}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {needsAccessRequest(game) ? (
                    <Button
                      onClick={() => requestGameAccess(game)}
                      disabled={isRequesting}
                      className="flex-1 font-bold uppercase tracking-widest text-[10px] py-3 bg-white/5 text-white/40 border border-white/10 hover:border-plaeen-green hover:text-plaeen-green transition-all"
                    >
                      Request Access
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleCreateSessionClick(game)}
                      variant="secondary"
                      size="sm"
                      className="flex-1 tracking-wider"
                    >
                      Create Session
                    </Button>
                  )}
                  <button
                    onClick={() => toggleWishlist(game)}
                    className={cn(
                      "h-14 w-14 rounded-xl flex items-center justify-center transition-all border",
                      wishlistIds.includes(game.id)
                        ? "bg-plaeen-green border-plaeen-green text-black shadow-[0_0_15px_rgba(118,233,0,0.4)]"
                        : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/30 hover:scale-95",
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
                    className="h-14 w-14 rounded-xl bg-white/5 border border-white/10 text-white/40 flex items-center justify-center hover:text-white hover:border-white/30 hover:scale-95 transition-all"
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
                        <PlatformIcon
                          platform={p}
                          className="h-8 w-8 opacity-70 hover:opacity-100 transition-opacity fill-white/20"
                        />
                        <span className="text-xs font-bold text-white/60 uppercase">
                          {p}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 space-y-4">
                    {needsAccessRequest(selectedGame) ? (
                      <Button
                        onClick={() => requestGameAccess(selectedGame)}
                        disabled={isRequesting}
                        className="w-full py-6 font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 hover:border-plaeen-green hover:text-plaeen-green gap-3"
                      >
                        <Shield size={20} /> Request Parent Approval
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleCreateSessionClick(selectedGame)}
                        className="w-full gap-3"
                        variant="primary"
                        size="sm"
                      >
                        <Plus size={20} /> Create Session
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

      {!loading && games.length === 0 && hasSubmittedSearch && (
        <div className="text-center py-20">
          <Gamepad2 size={64} className="mx-auto text-white/10 mb-6" />
          <p className="text-xl font-bold text-white/20 uppercase tracking-widest">
            No games found in this sector
          </p>
        </div>
      )}

      {/* Team Selector Modal */}
      {showTeamSelector && gameToCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <Card className="w-full max-w-2xl bg-plaeen-dark border-plaeen-green/30 p-8 shadow-[0_0_50px_rgba(118,233,0,0.1)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-4xl font-bold text-white uppercase tracking-tighter">
                Select Team
              </h2>
              <button
                onClick={() => {
                  setShowTeamSelector(false);
                  setGameToCreate(null);
                }}
                className="h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:scale-110 transition-transform border border-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-white/60 mb-6">
              Choose which team you want to add{" "}
              <span className="text-plaeen-green font-bold">
                {gameToCreate.name}
              </span>{" "}
              to:
            </p>

            {loadingTeams ? (
              <div className="flex items-center justify-center py-12 gap-4">
                <div className="h-8 w-8 border-4 border-plaeen-green border-t-transparent rounded-full animate-spin" />
                <span className="text-plaeen-green font-bold uppercase">
                  Loading teams...
                </span>
              </div>
            ) : userTeams.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/40 mb-4">No teams found</p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/teams")}
                  className="border-plaeen-green text-plaeen-green"
                >
                  Go to Teams
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 mb-8">
                {userTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => createSessionInTeam(team.id, gameToCreate)}
                    className="p-4 rounded-lg border-2 border-white/10 bg-white/5 text-left hover:border-plaeen-green hover:bg-plaeen-green/10 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-white group-hover:text-plaeen-green transition-colors uppercase">
                          {team.name || "Unnamed Team"}
                        </h3>
                        <p className="text-white/40 text-sm mt-1">
                          {team.members?.length || 0} members
                        </p>
                      </div>
                      <Plus
                        size={20}
                        className="text-white/40 group-hover:text-plaeen-green transition-colors"
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setShowTeamSelector(false);
                setGameToCreate(null);
              }}
              className="w-full border-white/20 text-white"
            >
              Cancel
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
