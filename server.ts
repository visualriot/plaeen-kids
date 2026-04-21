import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rating to minimum age mapping
// ESRB: EC (3+), E (6+), E10+ (10+), T (13+), M (17+), AO (18+)
// PEGI: 3+, 7+, 12+, 16+, 18+
const RATING_AGE_MAP: Record<string, number> = {
  // ESRB ratings
  "EC - Early Childhood": 3,
  "E - Everyone": 6,
  "E10+ - Everyone 10+": 10,
  "T - Teen": 13,
  "M - Mature": 17,
  "AO - Adults Only": 18,
  // Simplified ESRB
  EC: 3,
  E: 6,
  "E10+": 10,
  T: 13,
  M: 17,
  AO: 18,
  // PEGI ratings
  "PEGI 3": 3,
  "PEGI 7": 7,
  "PEGI 12": 12,
  "PEGI 16": 16,
  "PEGI 18": 18,
  // Alternative formats
  Everyone: 6,
  "Everyone 10+": 10,
  Teen: 13,
  Mature: 17,
  "Adults Only": 18,
};

// Get minimum age from rating
function getMinAgeFromRating(ratingObj: any): number | null {
  if (!ratingObj) return null; // No rating available

  const ratingName = ratingObj.name || String(ratingObj);
  const minAge = RATING_AGE_MAP[ratingName];

  if (minAge !== undefined) return minAge;

  // Fallback: try to extract age from string (e.g., "PEGI 12" -> 12)
  const ageMatch = ratingName.match(/\d{1,2}/);
  if (ageMatch) {
    const extracted = parseInt(ageMatch[0]);
    if (extracted >= 3 && extracted <= 18) return extracted;
  }

  return null; // Unknown rating format
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // RAWG API Proxy
  app.get("/api/games", async (req, res) => {
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

      // Map sortBy to RAWG ordering parameter
      const orderingMap: Record<string, string> = {
        relevance: "relevance",
        "year-desc": "-released", // minus sign for descending (newest first)
        "year-asc": "released", // without minus for ascending (oldest first)
        recommendation: "-rating", // highest rated first
      };
      const ordering = orderingMap[String(sortBy)] || "relevance";

      // Function to fetch and transform games from RAWG
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
      const maxPages = search ? 100 : 50; // Fetch more pages when searching to handle filtering

      // Fetch games with pagination and filtering
      while (allGames.length < targetCount && currentRawgPage <= maxPages) {
        const fetchedGames = await fetchAndTransformGames(currentRawgPage);
        if (fetchedGames.length === 0) break;

        // Apply filters
        let filtered = fetchedGames;

        // Age filtering
        if (userAgeNum) {
          filtered = filtered.filter(
            (g: any) => g.minAge !== null && g.minAge <= userAgeNum,
          );
        }

        // Multiplatform filtering
        if (multiplatformOnly === "true") {
          filtered = filtered.filter((g: any) => g.platformsCount > 1);
        }

        // Multiplayer filtering
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

      // Extract the requested page from filtered results
      const startIdx = (pageNum - 1) * pageSizeNum;
      const endIdx = startIdx + pageSizeNum;
      allGames = allGames.slice(startIdx, endIdx);

      res.json(allGames);
    } catch (error) {
      console.error("RAWG API Error:", error);
      res.status(500).json({ error: "Failed to fetch games from RAWG" });
    }
  });

  // RAWG Game Details Proxy
  app.get("/api/games/:id", async (req, res) => {
    const { id } = req.params;
    const { userAge } = req.query;
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "RAWG_API_KEY is not configured" });
    }

    try {
      const response = await fetch(
        `https://api.rawg.io/api/games/${id}?key=${apiKey}`,
      );
      const game = await response.json();

      const minAge = getMinAgeFromRating(game.esrb_rating);
      res.json({
        id: game.id.toString(),
        slug: game.slug,
        name: game.name,
        description:
          game.description_raw ||
          game.description ||
          "No description available.",
        platforms: game.platforms?.map((p: any) => p.platform.name) || [],
        genres: game.genres?.map((g: any) => g.name) || [],
        image:
          game.background_image ||
          `https://picsum.photos/seed/${game.id}/600/400`,
        rating: Math.round(game.metacritic || game.rating * 20),
        releaseDate: game.released || "TBA",
        minAge: minAge,
        isChildFriendly: minAge !== null && minAge <= 13,
        esrb_rating: game.esrb_rating,
      });
    } catch (error) {
      console.error("RAWG API Error:", error);
      res.status(500).json({ error: "Failed to fetch game details from RAWG" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
