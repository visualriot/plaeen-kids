/**
 * Centralized type definitions for the Plaeen Kids app
 * Organized by domain to avoid duplication across pages and components
 */

// ============================================================================
// USER & PROFILE TYPES
// ============================================================================

export interface KidProfile {
  uid: string;
  displayName: string;
  username?: string;
  birthDate?: string;
  photoURL?: string;
  role?: "kid";
  parentId?: string;
  friends?: string[];
  streak?: {
    rewardClaimedToday: boolean;
    rewardMinutes: number | boolean;
    targetDays: number;
    count: number;
    history: Record<string, any>;
    lastUpdate: string;
  };
  screenTime: {
    dailyAllowance: number;
    usedToday: number;
    lastReset: any;
    weeklyAllowance?: number;
    usedWeekly?: number;
    monthlyAllowance?: number;
    usedMonthly?: number;
    weeklyAdjustments?: number;
    monthlyAdjustments?: number;
    accumulatedTime?: number;
    bannedDates?: string[];
    scheduledDeductions?: {
      id: string;
      date: string;
      minutes: number;
    }[];
    isSessionActive?: boolean;
    sessionStartTime?: number;
    todayAdjustments?: {
      id: string;
      type: "penalty" | "reward";
      minutes: number;
      reason: string;
      timestamp: string;
      isScheduled?: boolean;
      data?: any;
    }[];
  };
  allowedGames?: string[];
  restrictedMode?: boolean;
  wishlist?: string[];
  teamAliases?: Record<string, string>;
  availability?: {
    recurring?: Record<string, boolean>;
    once?: Record<string, boolean>;
  };
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  parentId?: string;
  availability?: {
    recurring?: Record<string, boolean>;
    once?: Record<string, boolean>;
  };
  screenTime?: {
    dailyAllowance: number;
    usedToday: number;
    lastReset: any;
  };
}

export interface ParentProfile {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  role: "parent";
}

// ============================================================================
// TEAM & GAME TYPES
// ============================================================================

export interface Team {
  id: string;
  name: string;
  members: string[];
  adminIds: string[];
  pendingMembers?: string[];
  ownerId: string;
  imageURL?: string;
  parentIds?: string;
  teamAvailability?: Record<string, string>;
}

export interface GroupGame {
  id: string;
  name: string;
  image: string;
  description: string;
  platforms: string[];
  genres: string[];
}

export interface Game {
  id: string;
  name: string;
  image: string;
  description?: string;
  platforms?: string[];
  genres?: string[];
}

export interface GameItem {
  id: string;
  name: string;
  image: string;
  addedAt?: string;
  status?: "pending" | "approved" | "denied";
}

export interface Session {
  id: string;
  gameId: string;
  gameName: string;
  gameImage?: string;
  description?: string;
  platforms?: string[];
  genres?: string[];
  startTime: any;
  endTime: any;
  duration: number; // in minutes
  proposedBy: string;
  proposedByName: string;
  status: "proposed" | "scheduled" | "ongoing" | "completed" | "cancelled";
  catalogEntry?: boolean;
  teamGoals?: string[];
  teamNotes?: string;
  responses?: Record<
    string,
    {
      status: "accepted" | "rejected" | "maybe";
      note?: string;
      guardianApprovalPending?: boolean;
      requestedAllowance?: number;
    }
  >;
  notes?: string;
}

export interface TeamEvent {
  id: string;
  type: "member_joined";
  userId: string;
  userName: string;
  createdAt: any;
}

// ============================================================================
// NOTIFICATION & APPROVAL TYPES
// ============================================================================

export interface Notification {
  id: string;
  userId?: string;
  childId?: string;
  childName?: string;
  parentId?: string;
  title: string;
  message: string;
  type:
    | "session_start"
    | "session_end"
    | "time_warning"
    | "approval_status"
    | "penalty"
    | string;
  read: boolean;
  createdAt: any;
  approvalId?: string;
  handled?: boolean;
  data?: any;
  groupId?: string;
  teamId?: string;
  fromId?: string;
  duration?: number;
  decision?: {
    action: "forgive" | "extract" | "ban";
    timestamp: any;
    message: string;
    date?: string | null;
  };
}

export interface ApprovalRequest {
  id: string;
  childId: string;
  childName: string;
  parentId?: string;
  type: "game" | "time" | "team" | "activity" | "overtime" | "friend";
  status: "pending" | "approved" | "denied";
  title?: string;
  rewardMinutes?: number;
  data: any;
  createdAt: any;
}

// ============================================================================
// FRIEND & SOCIAL TYPES
// ============================================================================

export interface Friend {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName?: string;
  status: "pending" | "accepted" | "rejected";
}

// ============================================================================
// UI & COMPONENT TYPES
// ============================================================================

export interface AvatarCategory {
  id: string;
  name: string;
  avatars: string[];
}

export interface KidForm {
  displayName: string;
  username: string;
  birthDate?: string;
  dailyAllowance: number;
  photoURL?: string;
}

export interface StreakData {
  count: number;
  targetDays: number;
  lastUpdate: string;
}

// ============================================================================
// AVAILABILITY TYPES
// ============================================================================

export type AvailabilityType = "available" | "unavailable" | "once";
export type AvailabilityState = "unavailable" | "recurring" | "once";

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface NotificationPanelProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface BonusTimeProps {
  childId: string;
}

export interface KidStreakWidgetProps {
  data?: StreakData;
  childId?: string;
}

export interface ProfileIdentityProps {
  profile: KidProfile | UserProfile;
  photoURL?: string;
  onSelectAvatar?: () => void;
}

export interface ScreenTimeAllowanceProps {
  allowance: number;
  used: number;
  unit?: "day" | "week" | "month";
}

export interface StreakRewardsProps {
  rewardMinutes?: number | boolean;
  rewardClaimedToday?: boolean;
  onClaimReward?: () => void;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}
