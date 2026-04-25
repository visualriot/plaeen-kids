export interface TeamGameRecord {
  id: string;
  name: string;
  image: string;
  description: string;
  platforms: string[];
  genres: string[];
  teamGoals?: string[];
  teamNotes?: string;
}

export interface SessionBackedGameRecord {
  gameId?: string;
  gameName?: string;
  gameImage?: string;
  description?: string;
  platforms?: string[];
  genres?: string[];
  teamGoals?: string[];
  teamNotes?: string;
}

export const getTeamGameFromSession = (
  session: SessionBackedGameRecord,
): TeamGameRecord | null => {
  if (!session.gameId || !session.gameName) return null;

  return {
    id: session.gameId,
    name: session.gameName,
    image: session.gameImage || "https://picsum.photos/seed/game/600/400",
    description: session.description || "No description available.",
    platforms: Array.isArray(session.platforms) ? session.platforms : [],
    genres: Array.isArray(session.genres) ? session.genres : [],
    teamGoals: Array.isArray(session.teamGoals) ? session.teamGoals : [],
    teamNotes: typeof session.teamNotes === "string" ? session.teamNotes : "",
  };
};

export const mergeTeamGames = (
  games: TeamGameRecord[],
  sessions: SessionBackedGameRecord[],
): TeamGameRecord[] => {
  const merged = new Map<string, TeamGameRecord>();

  for (const game of games) {
    merged.set(game.id, game);
  }

  for (const session of sessions) {
    const sessionGame = getTeamGameFromSession(session);
    if (!sessionGame || merged.has(sessionGame.id)) continue;
    merged.set(sessionGame.id, sessionGame);
  }

  return Array.from(merged.values());
};
