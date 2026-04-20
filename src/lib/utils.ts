import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_USER_AVATAR = "/avatars/user/avatar_user_01.webp";
export const DEFAULT_TEAM_AVATAR = "/avatars/teams/avatar_team_01.webp";

export const getRandomUserAvatar = () => {
  const randomNum = Math.floor(Math.random() * 80) + 1;
  return `/avatars/user/avatar_user_${String(randomNum).padStart(2, "0")}.webp`;
};

export const getRandomTeamAvatar = () => {
  const randomNum = Math.floor(Math.random() * 66) + 1;
  return `/avatars/teams/avatar_team_${String(randomNum).padStart(2, "0")}.webp`;
};

export const getRandomTeamAvatars = (count: number = 6) => {
  const avatars: string[] = [];
  const totalAvatars = 66;
  const indices = new Set<number>();

  while (indices.size < Math.min(count, totalAvatars)) {
    indices.add(Math.floor(Math.random() * totalAvatars) + 1);
  }

  return Array.from(indices).map(
    (num) => `/avatars/teams/avatar_team_${String(num).padStart(2, "0")}.webp`,
  );
};

/**
 * Gets a consistent default avatar path for a user based on their UID if no photoURL exists.
 */
export const getUserAvatar = (photoURL: string | null | undefined) => {
  if (photoURL && !photoURL.includes("dicebear.com")) {
    return photoURL;
  }
  return DEFAULT_USER_AVATAR;
};

/**
 * Gets a consistent default avatar path for a team based on their imageURL if no imageURL exists.
 */
export const getTeamAvatar = (imageURL: string | null | undefined) => {
  if (imageURL && !imageURL.includes("dicebear.com")) {
    return imageURL;
  }
  return DEFAULT_TEAM_AVATAR;
};

export function formatName(name: string): string {
  if (!name) return name;
  // If the name is already all uppercase, leave it alone
  if (name === name.toUpperCase() && name.length > 1) return name;
  // Otherwise, capitalize the first letter and keep the rest as is
  return name.charAt(0).toUpperCase() + name.slice(1);
}
export function safeToDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "number") return new Date(timestamp);
  if (typeof timestamp === "string") return new Date(timestamp);
  return new Date();
}
export function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
