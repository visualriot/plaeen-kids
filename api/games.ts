import { VercelRequest, VercelResponse } from "@vercel/node";

// Rating to minimum age mapping
const RATING_AGE_MAP: Record<string, number> = {
  "EC - Early Childhood": 3,
  "E - Everyone": 6,
  "E10+ - Everyone 10+": 10,
  "T - Teen": 13,
  "M - Mature": 17,
  "AO - Adults Only": 18,
  EC: 3,
  E: 6,
  "E10+": 10,
  T: 13,
  M: 17,
  AO: 18,
  "PEGI 3": 3,
  "PEGI 7": 7,
  "PEGI 12": 12,
  "PEGI 16": 16,
  "PEGI 18": 18,
  Everyone: 6,
  "Everyone 10+": 10,
  Teen: 13,
  Mature: 17,
  "Adults Only": 18,
};

function getMinAgeFromRating(ratingObj: any): number | null {
  if (!ratingObj) return null;

  const ratingName = ratingObj.name || String(ratingObj);
  const minAge = RATING_AGE_MAP[ratingName];

  if (minAge !== undefined) return minAge;

  const ageMatch = ratingName.match(/\d{1,2}/);
  if (ageMatch) {
    const extracted = parseInt(ageMatch[0]);
    if (extracted >= 3 && extracted <= 18) return extracted;
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const {
    search,
    page = 1,
    page_size = 6,
    genres,
    platforms,
    userAge,
    sortBy = "relevance",
    multiplatformOnly,
    multiplayerOnly,
  } = req.query;

  const apiKey = process.env.RAWG_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "RAWG_API_KEY is not configured" });
  }

  try {
    const userAgeNum = userAge ? parseInt(String(userAge)) : undefined;
    const pageNum = parseInt(String(page));
    const pageSizeNum = parseInt(String(page_size));

    const orderingMap: Record<string, string> = {
      relevance: "relevance",
      "year-desc": "-released",
      "year-asc": "released",
      recommendation: "-rating",
    };
    const ordering = orderingMap[String(sortBy)] || "relevance";

    const fetchAndTransformGames = async (pageNo: number) => {
      let url = `https://api.rawg.io/api/games?key=${apiKey}&page=${pageNo}&page_size=40&ordering=${ordering}`;

      if (search) url += `&search=${search}`;
      if (genres) url += `&genres=${genres}`;
      if (platforms) url += `&platforms=${platforms}`;

      const response = await fetch(url);
      const data = await response.json();

      return data.results.map((game: any) => {
        const minAge = getMinAgeFromRating(game.esrb_rating);
        return {
          id: game.id.toString(),
          slug: game.slug,
          name: game.name,
          description: game.description_raw || "No description available.",
          platforms: game.platforms?.map((p: any) => p.platform.name) || [],
          platformsCount: game.platforms?.length || 0,
          genres: game.genres?.map((g: any) => g.name) || [],
          tags: game.tags?.map((t: any) => t.name) || [],
          image:
            game.background_image ||
            `https://picsum.photos/seed/${game.id}/600/400`,
          rating: Math.round(game.metacritic || game.rating * 20),
          releaseDate: game.released || "TBA",
          minAge: minAge,
          isChildFriendly: minAge !== null && minAge <= 13,
          esrb_rating: game.esrb_rating,
        };
      });
    };

    let allGames: any[] = [];
    const targetCount = pageNum * pageSizeNum;
    let currentRawgPage = 1;
    const maxPages = search ? 100 : 50;

    while (allGames.length < targetCount && currentRawgPage <= maxPages) {
      const fetchedGames = await fetchAndTransformGames(currentRawgPage);
      if (fetchedGames.length === 0) break;

      let filtered = fetchedGames;

      if (userAgeNum) {
        filtered = filtered.filter(
          (g: any) => g.minAge !== null && g.minAge <= userAgeNum,
        );
      }

      if (multiplatformOnly === "true") {
        filtered = filtered.filter((g: any) => g.platformsCount > 1);
      }

      if (multiplayerOnly === "true") {
        filtered = filtered.filter((g: any) => {
          const multiplayerKeywords = [
            "multiplayer",
            "co-op",
            "co op",
            "online",
          ];
          const tags = g.tags.map((t: string) => t.toLowerCase());
          const genres = g.genres.map((gen: string) => gen.toLowerCase());
          const name = g.name.toLowerCase();

          return (
            multiplayerKeywords.some(
              (kw) =>
                tags.includes(kw) || genres.includes(kw) || name.includes(kw),
            ) ||
            tags.some((t: string) =>
              multiplayerKeywords.some((kw) => t.includes(kw)),
            )
          );
        });
      }

      allGames.push(...filtered);
      currentRawgPage++;
    }

    const startIdx = (pageNum - 1) * pageSizeNum;
    const endIdx = startIdx + pageSizeNum;
    allGames = allGames.slice(startIdx, endIdx);

    res.json(allGames);
  } catch (error) {
    console.error("RAWG API Error:", error);
    res.status(500).json({ error: "Failed to fetch games from RAWG" });
  }
}
