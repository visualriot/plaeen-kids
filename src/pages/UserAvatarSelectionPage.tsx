import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Check, Loader2 } from "lucide-react";
import { Heading, Text, Label, Button } from "@/components/atoms";
import { auth, db } from "@/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { useProfile } from "@/contexts/ProfileContext";

export const UserAvatarSelectionPage = () => {
  const [user] = useAuthState(auth);
  const { activeKid } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const returnTo = queryParams.get("returnTo") || "/profile";
  const kidUidFromQuery = queryParams.get("kidUid");

  const [isUpdating, setIsUpdating] = useState(false);

  // Use either the kidUid from URL (for management mode) or the currently active kid
  const targetUid = kidUidFromQuery || activeKid?.uid || user?.uid;

  // 80 avatars for users
  const avatars = Array.from(
    { length: 80 },
    (_, i) =>
      `/avatars/user/avatar_user_${String(i + 1).padStart(2, "0")}.webp`,
  );

  const handleSelect = async (avatar: string) => {
    if (!user || !targetUid) return;

    setIsUpdating(true);
    try {
      // Update Firestore user document
      await updateDoc(doc(db, "users", targetUid), {
        photoURL: avatar,
      });

      // Update public profile - only if it exists
      try {
        const publicDocRef = doc(db, "users_public", targetUid);
        const publicDoc = await getDoc(publicDocRef);
        if (publicDoc.exists()) {
          await updateDoc(publicDocRef, {
            photoURL: avatar,
          });
        }
      } catch (publicErr) {
        console.warn("Public profile update skipped or failed:", publicErr);
        // We don't block the whole process if public profile update fails
        // as long as the main user doc updated.
      }

      navigate(returnTo);
    } catch (err) {
      console.error("Error updating avatar in Firestore:", err);
      if ((err as any).code === "permission-denied") {
        alert(
          "Permission denied. You can only change your own avatar or your children's avatars.",
        );
      } else {
        alert("Failed to update avatar. Please try again.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <Button
        onClick={() => navigate(-1)}
        variant="back"
        className="group gap-1"
      >
        <ChevronLeft size={16} />
        <span className="group-hover:translate-x-1  transition-all ease-in-out duration-200">
          Back
        </span>
      </Button>

      <div className="mb-12 space-y-5">
        <Heading level={1} variant="display">
          Select <span className="text-plaeen-green">Avatar</span>
        </Heading>

        <Text variant="subtitle">
          Choose your identity for the Plaeen network
        </Text>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {avatars.map((avatar, index) => (
          <button
            key={index}
            onClick={() => handleSelect(avatar)}
            className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-white/5 bg-white/5 hover:border-plaeen-green transition-all"
          >
            <img
              src={avatar}
              alt={`Avatar ${index + 1}`}
              className="h-full w-full object-cover group-hover:scale-110 transition-transform"
            />
            <div className="absolute inset-0 bg-plaeen-green/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {isUpdating ? (
                <Loader2 className="animate-spin text-white" size={32} />
              ) : (
                <Check className="text-white" size={32} />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
