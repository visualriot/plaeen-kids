export const RESERVED_USERNAMES = [
  "admin",
  "support",
  "api",
  "system",
  "null",
  "parent",
  "guardian",
];

export const validateUsername = (
  username: string,
): { isValid: boolean; error?: string } => {
  const clean = username.toLowerCase().trim().replace(/^@/, "");

  if (clean.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters." };
  }

  if (clean.length > 25) {
    return { isValid: false, error: "Username must be at most 25 characters." };
  }

  // Allowed characters: letters, numbers, hyphen, underscore, dot
  if (!/^[a-z0-9._-]+$/.test(clean)) {
    return {
      isValid: false,
      error: "Only letters, numbers, dots, hyphens, and underscores allowed.",
    };
  }

  // Must start and end with a letter or number
  if (!/^[a-z0-9]/.test(clean) || !/[a-z0-9]$/.test(clean)) {
    return {
      isValid: false,
      error: "Username must start and end with a letter or number.",
    };
  }

  // No consecutive symbols
  if (/[._-]{2,}/.test(clean)) {
    return {
      isValid: false,
      error: "Consecutive symbols (.., __, --) are not allowed.",
    };
  }

  // Reserved usernames
  if (RESERVED_USERNAMES.includes(clean)) {
    return { isValid: false, error: "This username is reserved." };
  }

  return { isValid: true };
};
