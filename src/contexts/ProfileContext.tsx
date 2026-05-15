import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, onSnapshot, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import type { KidProfile } from "@/lib/types";

interface ProfileContextType {
  activeKid: KidProfile | null;
  parentProfile: {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string | null;
    role: "parent" | "kid"; // Could be a kid account too
    onboardingComplete?: boolean;
    guardianPin?: string;
    firstDayOfWeek?: "Mon" | "Sun";
    linkedKids: string[];
    teamAliases?: Record<string, string>;
  } | null;
  role: "parent" | "kid" | "none"; // Effective UI role
  userRole: "parent" | "kid" | "none"; // Actual account role
  isParentViewingKid: boolean;
  setActiveKid: (kidId: string | null) => void;
  isParentAuthenticated: boolean;
  setParentAuthenticated: (val: boolean) => void;
  isLoading: boolean;
  logoutProfile: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user] = useAuthState(auth);
  const [activeKidId, setActiveKidId] = useState<string | null>(
    localStorage.getItem("activeKidId"),
  );
  const [activeKid, setActiveKid] = useState<KidProfile | null>(null);
  const [parentProfile, setParentProfile] = useState<any | null>(null);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(
    localStorage.getItem("isParentAuth") === "true",
  );
  const [parentLoading, setParentLoading] = useState(true);
  const [kidLoading, setKidLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setParentProfile(null);
      setActiveKid(null);
      setParentLoading(false);
      setKidLoading(false);
      setIsParentAuthenticated(false);
      return;
    }

    // Sync parent email to users_public once for searchability
    const syncProfile = async () => {
      if (!user || user.isAnonymous) return;
      try {
        const parentRef = doc(db, "users", user.uid);
        const parentSnap = await getDoc(parentRef);

        if (parentSnap.exists()) {
          const parentData = parentSnap.data();
          if (parentData.role === "parent" && user.email) {
            const emailLower = user.email.toLowerCase();
            const publicRef = doc(db, "users_public", user.uid);
            const publicSnap = await getDoc(publicRef);

            if (parentData.email !== emailLower) {
              await updateDoc(parentRef, { email: emailLower });
            }

            if (publicSnap.exists()) {
              if (publicSnap.data().email !== emailLower) {
                await updateDoc(publicRef, { email: emailLower });
              }
            } else {
              await setDoc(publicRef, {
                uid: user.uid,
                displayName:
                  parentData.displayName || user.displayName || "Parent",
                email: emailLower,
                role: "parent",
              });
            }
          }
        }
      } catch (err) {
        console.warn("Email sync failed (silent error):", err);
      }
    };
    syncProfile();

    setParentLoading(true);
    const unsubscribeParent = onSnapshot(
      doc(db, "users", user.uid),
      async (docSnap) => {
        try {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setParentProfile({ uid: docSnap.id, ...data });

            if (data.role === "kid") {
              setActiveKid({ uid: docSnap.id, ...data } as KidProfile);
              setKidLoading(false);
            }
          }
          setParentLoading(false);
        } catch (err) {
          console.error("Error processing parent profile snapshot:", err);
          setParentLoading(false);
        }
      },
      (error) => {
        console.warn(
          "Permission denied for parent profile, user might be new or logging out:",
          error.message,
        );
        setParentLoading(false);
      },
    );

    return () => unsubscribeParent();
  }, [user]);

  useEffect(() => {
    if (!activeKidId || parentProfile?.role === "kid") {
      if (parentProfile?.role !== "kid") {
        setActiveKid(null);
      }
      setKidLoading(false);
      return;
    }

    setKidLoading(true);
    const unsubscribeKid = onSnapshot(
      doc(db, "users", activeKidId),
      (docSnap) => {
        try {
          if (docSnap.exists()) {
            setActiveKid({ uid: docSnap.id, ...docSnap.data() } as KidProfile);
          } else {
            setActiveKid(null);
            localStorage.removeItem("activeKidId");
          }
          setKidLoading(false);
        } catch (err) {
          console.error("Error processing kid profile snapshot:", err);
          setKidLoading(false);
        }
      },
      (error) => {
        console.warn("Permission denied for kid profile:", error.message);
        setKidLoading(false);
      },
    );

    return () => unsubscribeKid();
  }, [activeKidId, parentProfile]);

  const handleSetActiveKid = (kidId: string | null) => {
    if (kidId) {
      setKidLoading(true);
    }
    setActiveKidId(kidId);
    setIsParentAuthenticated(false);
    localStorage.removeItem("isParentAuth");
    if (kidId) {
      localStorage.setItem("activeKidId", kidId);
    } else {
      localStorage.removeItem("activeKidId");
    }
  };

  const handleSetParentAuthenticated = (val: boolean) => {
    setIsParentAuthenticated(val);
    if (val) {
      localStorage.setItem("isParentAuth", "true");
      setActiveKidId(null);
      localStorage.removeItem("activeKidId");
    } else {
      localStorage.removeItem("isParentAuth");
    }
  };

  const logoutProfile = () => {
    setActiveKidId(null);
    setIsParentAuthenticated(false);
    localStorage.removeItem("activeKidId");
    localStorage.removeItem("isParentAuth");
  };

  const userRole = React.useMemo(() => {
    return parentProfile?.role || "none";
  }, [parentProfile]);

  const role = React.useMemo(() => {
    // If it's a kid account, role is always kid
    if (userRole === "kid") return "kid";
    // If it's a parent account and a kid is selected, effective role is kid
    if (activeKidId) return "kid";
    // If parent is authenticated, role is parent
    if (isParentAuthenticated) return "parent";
    // Initial state or switch profile state
    return "none";
  }, [activeKidId, isParentAuthenticated, userRole]);

  const isLoading = parentLoading || kidLoading;

  const isParentViewingKid = React.useMemo(() => {
    return userRole === "parent" && !!activeKidId;
  }, [userRole, activeKidId]);

  return (
    <ProfileContext.Provider
      value={{
        activeKid,
        parentProfile,
        role,
        userRole,
        isParentViewingKid,
        setActiveKid: handleSetActiveKid,
        isParentAuthenticated,
        setParentAuthenticated: handleSetParentAuthenticated,
        isLoading,
        logoutProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};
