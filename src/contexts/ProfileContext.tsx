import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';

interface KidProfile {
  uid: string;
  displayName: string;
  username: string;
  role: 'kid';
  parentId: string;
  photoURL?: string;
  screenTime: {
    dailyAllowance: number;
    usedToday: number;
    weeklyAllowance?: number;
    usedWeekly?: number;
    monthlyAllowance?: number;
    usedMonthly?: number;
    weeklyAdjustments?: number;
    monthlyAdjustments?: number;
    accumulatedTime?: number;
    bannedDates?: string[];
    scheduledDeductions?: { date: string; minutes: number }[];
    isSessionActive?: boolean;
    sessionStartTime?: number;
    todayAdjustments?: {
      id: string;
      type: 'penalty' | 'reward';
      minutes: number;
      reason: string;
      timestamp: string;
    }[];
  };
  allowedGames: string[];
  teamAliases?: Record<string, string>;
}

interface ProfileContextType {
  activeKid: KidProfile | null;
  parentProfile: {
    uid: string;
    displayName: string;
    email: string;
    role: 'parent';
    onboardingComplete?: boolean;
    guardianPin?: string;
    firstDayOfWeek?: 'Mon' | 'Sun';
    linkedKids: string[];
    teamAliases?: Record<string, string>;
  } | null;
  role: 'parent' | 'kid' | 'none';
  setActiveKid: (kidId: string | null) => void;
  isParentAuthenticated: boolean;
  setParentAuthenticated: (val: boolean) => void;
  isLoading: boolean;
  logoutProfile: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user] = useAuthState(auth);
  const [activeKidId, setActiveKidId] = useState<string | null>(sessionStorage.getItem('activeKidId'));
  const [activeKid, setActiveKid] = useState<KidProfile | null>(null);
  const [parentProfile, setParentProfile] = useState<any | null>(null);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(sessionStorage.getItem('isParentAuth') === 'true');
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

    setParentLoading(true);
    const unsubscribeParent = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setParentProfile({ uid: docSnap.id, ...data });
        
        // If the user is actually a kid account (direct login)
        if (data.role === 'kid') {
          setActiveKid({ uid: docSnap.id, ...data } as KidProfile);
        }
      }
      setParentLoading(false);
    });

    return () => unsubscribeParent();
  }, [user]);

  useEffect(() => {
    if (!activeKidId || (parentProfile?.role === 'kid')) {
      if (parentProfile?.role !== 'kid') {
        setActiveKid(null);
      }
      setKidLoading(false);
      return;
    }

    setKidLoading(true);
    const unsubscribeKid = onSnapshot(doc(db, 'users', activeKidId), (docSnap) => {
      if (docSnap.exists()) {
        setActiveKid({ uid: docSnap.id, ...docSnap.data() } as KidProfile);
      } else {
        setActiveKid(null);
        sessionStorage.removeItem('activeKidId');
      }
      setKidLoading(false);
    });

    return () => unsubscribeKid();
  }, [activeKidId, parentProfile]);

  const handleSetActiveKid = (kidId: string | null) => {
    if (kidId) {
      setKidLoading(true);
    }
    setActiveKidId(kidId);
    setIsParentAuthenticated(false);
    sessionStorage.removeItem('isParentAuth');
    if (kidId) {
      sessionStorage.setItem('activeKidId', kidId);
    } else {
      sessionStorage.removeItem('activeKidId');
    }
  };

  const handleSetParentAuthenticated = (val: boolean) => {
    setIsParentAuthenticated(val);
    if (val) {
      sessionStorage.setItem('isParentAuth', 'true');
      setActiveKidId(null);
      sessionStorage.removeItem('activeKidId');
    } else {
      sessionStorage.removeItem('isParentAuth');
    }
  };

  const logoutProfile = () => {
    setActiveKidId(null);
    setIsParentAuthenticated(false);
    sessionStorage.removeItem('activeKidId');
    sessionStorage.removeItem('isParentAuth');
  };

  const role = React.useMemo(() => {
    if (activeKidId || sessionStorage.getItem('activeKidId')) return 'kid';
    if (isParentAuthenticated || sessionStorage.getItem('isParentAuth') === 'true') return 'parent';
    return 'none';
  }, [activeKidId, isParentAuthenticated]);

  const isLoading = parentLoading || kidLoading;

  return (
    <ProfileContext.Provider value={{ 
      activeKid, 
      parentProfile, 
      role, 
      setActiveKid: handleSetActiveKid,
      isParentAuthenticated,
      setParentAuthenticated: handleSetParentAuthenticated,
      isLoading,
      logoutProfile
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
