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
 * Gets a consistent avatar path for a user.
 * For guardians with Google photos: returns the photo URL
 * For others without a custom photo: returns the default avatar
 */
export const getUserAvatar = (photoURL: string | null | undefined) => {
  if (photoURL) {
    // If it's a valid photo URL (not a placeholder), use it
    if (!photoURL.includes("dicebear.com")) {
      return photoURL;
    }
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

export const BIRTH_DATE_MIN = "1950-01-01";

export const validateBirthDate = (value: string): string | null => {
  if (!value) return "Date of birth is required";
  const date = new Date(value + "T00:00:00");
  if (isNaN(date.getTime())) return "Invalid date";
  if (date < new Date("1950-01-01T00:00:00")) return "Date of birth cannot be before 1950";
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) return "Date of birth cannot be in the future";
  return null;
};

export const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function formatName(name: string): string {
  if (!name) return name;
  // Get first name only (before space if there's one)
  const firstName = name.split(" ")[0];
  // If the name is already all uppercase, leave it alone
  if (firstName === firstName.toUpperCase() && firstName.length > 1)
    return firstName;
  // Otherwise, capitalize the first letter and keep the rest as is
  return firstName.charAt(0).toUpperCase() + firstName.slice(1);
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
