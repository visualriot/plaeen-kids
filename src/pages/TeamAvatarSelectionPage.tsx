import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Check, Loader2 } from "lucide-react";
import { db } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { AvatarCategory } from "@/lib/types";
import { Heading, Text, Label } from "@/components/atoms";

export const TeamAvatarSelectionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const returnTo = queryParams.get("returnTo") || "/teams";
  const teamId = queryParams.get("teamId");

  const [isUpdating, setIsUpdating] = useState(false);

  const AVATAR_CATEGORY_NAMES = [
    "Adventure",
    "Retro",
    "Build",
    "Fantasy",
    "Space",
    "Sport",
  ];
  const AVATARS_PER_CATEGORY = 11;

  const categories: AvatarCategory[] = AVATAR_CATEGORY_NAMES.map(
    (name, index) => ({
      id: String(index),
      name,
      avatars: Array.from({ length: AVATARS_PER_CATEGORY }, (_, i) => {
        const avatarNumber = index * AVATARS_PER_CATEGORY + i + 1;
        return `/avatars/teams/avatar_team_${String(avatarNumber).padStart(2, "0")}.webp`;
      }),
    }),
  );

  const handleSelect = async (avatar: string) => {
    if (!teamId) {
      // If no teamId provided, we can't save to DB directly, fallback to old behavior
      // But ideally we should always have a teamId if we want DB persistence
      sessionStorage.setItem("selectedTeamAvatar", avatar);
      navigate(returnTo);
      return;
    }

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "groups", teamId), {
        imageURL: avatar,
      });
      navigate(returnTo);
    } catch (err) {
      console.error("Error updating team avatar in Firestore:", err);
      alert("Failed to update team avatar. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green transition-colors mb-12"
      >
        <ChevronLeft size={16} />{" "}
        <Text variant="caption" as="span">
          Back
        </Text>
      </button>

      <div className="mb-12">
        <Heading level={1} variant="display" color="primary" className="mb-4">
          Team <span className="text-plaeen-green">Avatar</span>
        </Heading>
        <Text variant="caption" color="muted" as="p">
          Choose an icon for your squad
        </Text>
      </div>

      <div className="space-y-16">
        {categories.map((category) => (
          <section key={category.name}>
            <Heading
              level={2}
              variant="section"
              color="accent"
              className="mb-8"
            >
              {category.name}
            </Heading>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-4">
              {category.avatars.map((avatar, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(avatar)}
                  className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-white/5 bg-white/5 hover:border-plaeen-green transition-all"
                >
                  <img
                    src={avatar}
                    alt={`${category.name} ${index + 1}`}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-plaeen-green/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    {isUpdating ? (
                      <Loader2 className="animate-spin text-white" size={24} />
                    ) : (
                      <Check className="text-white" size={24} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
