import { Button } from "@/components/Button";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  addDoc,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import React, { useEffect, useState, useRef } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  ChevronLeft,
  Check,
  Plus,
  Shield,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, getUserAvatar, getRandomTeamAvatar } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import type { Friend, AvatarCategory } from "@/lib/types";

const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: "adventure",
    name: "Adventure",
    avatars: Array.from(
      { length: 11 },
      (_, i) =>
        `/avatars/teams/avatar_team_${String(i + 1).padStart(2, "0")}.webp`,
    ),
  },
  {
    id: "retro",
    name: "Retro",
    avatars: Array.from(
      { length: 11 },
      (_, i) =>
        `/avatars/teams/avatar_team_${String(i + 12).padStart(2, "0")}.webp`,
    ),
  },
  {
    id: "build",
    name: "Build",
    avatars: Array.from(
      { length: 11 },
      (_, i) =>
        `/avatars/teams/avatar_team_${String(i + 23).padStart(2, "0")}.webp`,
    ),
  },
  {
    id: "fantasy",
    name: "Fantasy",
    avatars: Array.from(
      { length: 11 },
      (_, i) =>
        `/avatars/teams/avatar_team_${String(i + 34).padStart(2, "0")}.webp`,
    ),
  },
  {
    id: "space",
    name: "Space",
    avatars: Array.from(
      { length: 11 },
      (_, i) =>
        `/avatars/teams/avatar_team_${String(i + 45).padStart(2, "0")}.webp`,
    ),
  },
  {
    id: "sport",
    name: "Sport",
    avatars: Array.from(
      { length: 11 },
      (_, i) =>
        `/avatars/teams/avatar_team_${String(i + 56).padStart(2, "0")}.webp`,
    ),
  },
];

export const CreateTeamPage = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const {
    role,
    activeKid: kidData,
    parentProfile,
    isLoading: profileLoading,
  } = useProfile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [nameError, setNameError] = useState("");
  const [activeCategory, setActiveCategory] = useState(AVATAR_CATEGORIES[0].id);
  const [selectedAvatar, setSelectedAvatar] = useState(getRandomTeamAvatar());
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeUid = kidData ? kidData.uid : user?.uid;

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      // Check initially and after category change
      setTimeout(checkScroll, 100);
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, [activeCategory]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const fetchFriends = async () => {
      if (!activeUid) return;
      const userDoc = await getDoc(doc(db, "users", activeUid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friends || [];
        if (friendIds.length > 0) {
          const friendsQuery = query(
            collection(db, "users_public"),
            where("uid", "in", friendIds),
          );
          const friendsSnap = await getDocs(friendsQuery);
          setFriends(friendsSnap.docs.map((d) => d.data() as Friend));
        }
      }
    };
    fetchFriends();
  }, [activeUid]);

  const handleCreateTeam = async () => {
    setNameError("");
    if (!activeUid || !teamName.trim()) return;

    setIsSubmitting(true);
    try {
      const isActuallyParent = role === "parent";
      const parentId = kidData?.parentId || parentProfile?.uid;

      const q = query(
        collection(db, "groups"),
        where(
          isActuallyParent ? "parentIds" : "members",
          "array-contains",
          isActuallyParent ? parentId : activeUid,
        ),
      );
      const snapshot = await getDocs(q);
      const nameExists = snapshot.docs.some(
        (doc) =>
          doc.data().name.toLowerCase() === teamName.trim().toLowerCase(),
      );

      if (nameExists) {
        setNameError("This name is already used by another team.");
        setIsSubmitting(false);
        return;
      }

      const finalInvites = [...selectedFriends];
      const docRef = await addDoc(collection(db, "groups"), {
        name: teamName,
        ownerId: activeUid,
        members: [activeUid],
        adminIds: [activeUid],
        pendingMembers: finalInvites,
        parentIds: [parentId],
        isPublic: false,
        games: [],
        imageURL: selectedAvatar,
        createdAt: new Date().toISOString(),
      });

      const groupId = docRef.id;

      const notificationPromises = finalInvites.map((friendId) =>
        addDoc(collection(db, "notifications"), {
          userId: friendId,
          type: "team_invite",
          title: "Team Invitation",
          message: `${kidData?.displayName || "A friend"} (@${kidData?.username || "unknown"}) invited you to join the team "${teamName}"`,
          data: {
            groupId: groupId,
            teamName: teamName,
            invitedBy: activeUid,
            invitedByName: kidData?.displayName || "A friend",
          },
          read: false,
          createdAt: new Date().toISOString(),
        }),
      );
      await Promise.all(notificationPromises);

      navigate("/teams");
    } catch (err) {
      console.error("Error saving team:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFriend = (uid: string) => {
    setSelectedFriends((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const currentAvatars =
    AVATAR_CATEGORIES.find((c) => c.id === activeCategory)?.avatars || [];

  if (profileLoading) return null;

  return (
    <div className="min-h-screen bg-plaeen-dark pt-24 pb-32 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-left mb-12">
          <button
            onClick={() => navigate("/teams")}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors font-bold uppercase  text-[10px] mb-6"
          >
            <ChevronLeft size={14} /> Back to Teams
          </button>
          <h1 className="text-white">
            Create <span className="text-plaeen-green">Team</span>
          </h1>
          {role === "kid" && (
            <div className="flex items-center gap-2 mt-4 text-plaeen-green font-bold uppercase  text-[10px]">
              <Shield size={14} /> Private & Kid-Safe
            </div>
          )}
        </div>

        <div className="space-y-20 text-left">
          {/* Section 1: Name */}
          <section>
            <label>What is the name of your team?</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setNameError("");
              }}
              placeholder="ENTER TEAM NAME..."
              className={cn(
                "w-full rounded-2xl border-2 bg-white/5 px-6 py-5 text-xl md:text-3xl font-black text-white uppercase focus:outline-none transition-all placeholder:text-white/5",
                nameError
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-white/5 focus:border-plaeen-green focus:bg-plaeen-green/5 shadow-2xl",
              )}
            />
            {nameError && (
              <p className="mt-3 text-xs font-bold text-red-500 uppercase ">
                {nameError}
              </p>
            )}
          </section>

          {/* Section 2: Friends */}
          <section>
            <label>Add friends to play with</label>
            {friends.length === 0 ? (
              <div className="p-12 rounded-3xl bg-white/5 border-2 border-dashed border-white/5 text-center">
                <p className="text-xs font-bold text-white/20 uppercase ">
                  No friends found yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {friends.map((friend) => (
                  <button
                    key={friend.uid}
                    onClick={() => toggleFriend(friend.uid)}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300",
                      selectedFriends.includes(friend.uid)
                        ? "bg-plaeen-green/10 border-plaeen-green text-plaeen-green shadow-[0_0_20px_rgba(118,233,0,0.1)]"
                        : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10",
                    )}
                  >
                    <img
                      src={getUserAvatar(friend.photoURL)}
                      className="h-14 w-14 rounded-full border-2 border-inherit"
                    />
                    <div className="flex flex-col text-left truncate">
                      <span className="text-base font-black uppercase truncate">
                        {friend.displayName}
                      </span>
                      <span className="text-[10px] opacity-40 font-bold  truncate">
                        @{friend.username}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "ml-auto h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedFriends.includes(friend.uid)
                          ? "bg-plaeen-green border-plaeen-green text-black"
                          : "border-white/20 text-white/20",
                      )}
                    >
                      {selectedFriends.includes(friend.uid) ? (
                        <Check size={14} />
                      ) : (
                        <Plus size={14} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Identity */}
          <section>
            <div className="flex flex-col gap-6 mb-8">
              <label>Select team avatar</label>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-plaeen-green uppercase ">
                  Select Collection:
                </p>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
                      }}
                      className={cn(
                        "px-5 py-2.5 rounded-full text-[10px] font-black uppercase  transition-all border-2 cursor-pointer",
                        activeCategory === cat.id
                          ? "bg-plaeen-green border-plaeen-green text-black shadow-lg"
                          : "bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white",
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative group/scroll-container -mx-4 px-4">
              {/* Left Arrow */}
              {canScrollLeft && (
                <button
                  onClick={() => scroll("left")}
                  className="hidden md:flex absolute left-0 top-0 bottom-8 w-24 z-20 items-center justify-start pl-8 bg-gradient-to-r from-plaeen-dark via-plaeen-dark/90 to-transparent opacity-0 group-hover/scroll-container:opacity-100 transition-opacity duration-300 text-white hover:text-plaeen-green cursor-pointer"
                >
                  <ChevronLeft size={48} strokeWidth={2.5} />
                </button>
              )}

              {/* Right Arrow */}
              {canScrollRight && (
                <button
                  onClick={() => scroll("right")}
                  className="hidden md:flex absolute right-0 top-0 bottom-8 w-24 z-20 items-center justify-end pr-8 bg-gradient-to-l from-plaeen-dark via-plaeen-dark/90 to-transparent opacity-0 group-hover/scroll-container:opacity-100 transition-opacity duration-300 text-white hover:text-plaeen-green cursor-pointer"
                >
                  <ChevronRight size={48} strokeWidth={2.5} />
                </button>
              )}

              <div
                ref={scrollRef}
                className="relative overflow-x-auto flex gap-5 py-6 px-4 pb-8 snap-x snap-mandatory scrollbar-hide"
              >
                {currentAvatars.map((avatar) => (
                  <button
                    key={avatar}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={cn(
                      "relative cursor-pointer h-36 w-36 md:h-48 md:w-48 shrink-0 rounded-2xl overflow-hidden border-2 transition-all duration-300 snap-center hover:scale-[1.05] hover:border-white/40 opacity-100",
                      selectedAvatar === avatar
                        ? "border-plaeen-green ring-4 ring-plaeen-green/20 z-10 shadow-2xl scale-[1.02]"
                        : "border-white/5",
                    )}
                  >
                    <img
                      src={avatar}
                      alt="Team Option"
                      className="h-full w-full object-cover"
                    />
                    {selectedAvatar === avatar && (
                      <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-plaeen-green flex items-center justify-center shadow-2xl border-2 border-black">
                        <Check size={18} className="text-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[10px] font-bold text-white/40 uppercase  text-center">
              ← Scroll or swipe for more options →
            </p>
          </section>

          {/* Footer Button */}
          <div className="pt-16 border-t border-white/5">
            <Button
              onClick={handleCreateTeam}
              className="w-full py-8 text-2xl font-black cursor-pointer uppercase  rounded-2xl shadow-2xl transition-transform active:scale-[0.98]"
              disabled={!teamName.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin text-black" size={32} />
              ) : (
                "Create Team"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
