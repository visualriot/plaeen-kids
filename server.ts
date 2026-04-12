import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // RAWG API Proxy
  app.get("/api/games", async (req, res) => {
    const { search, page = 1, page_size = 6, genres, platforms } = req.query;
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "RAWG_API_KEY is not configured" });
    }

    try {
      let url = `https://api.rawg.io/api/games?key=${apiKey}&page=${page}&page_size=${page_size}`;
      
      if (search) url += `&search=${search}`;
      if (genres) url += `&genres=${genres}`;
      if (platforms) url += `&platforms=${platforms}`;

      const response = await fetch(url);
      const data = await response.json();
      
      // Transform RAWG data to our app's format
      const games = data.results.map((game: any) => ({
        id: game.id.toString(),
        slug: game.slug,
        name: game.name,
        description: game.description_raw || "No description available.",
        platforms: game.platforms?.map((p: any) => p.platform.name) || [],
        genres: game.genres?.map((g: any) => g.name) || [],
        image: game.background_image || `https://picsum.photos/seed/${game.id}/600/400`,
        rating: Math.round(game.metacritic || game.rating * 20),
        releaseDate: game.released || "TBA",
        isChildFriendly: !game.esrb_rating || ["Everyone", "Everyone 10+", "Teen"].includes(game.esrb_rating.name)
      }));

      res.json(games);
    } catch (error) {
      console.error("RAWG API Error:", error);
      res.status(500).json({ error: "Failed to fetch games from RAWG" });
    }
  });

  // RAWG Game Details Proxy
  app.get("/api/games/:id", async (req, res) => {
    const { id } = req.params;
    const apiKey = process.env.RAWG_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "RAWG_API_KEY is not configured" });
    }

    try {
      const response = await fetch(`https://api.rawg.io/api/games/${id}?key=${apiKey}`);
      const game = await response.json();
      
      res.json({
        id: game.id.toString(),
        slug: game.slug,
        name: game.name,
        description: game.description_raw || game.description || "No description available.",
        platforms: game.platforms?.map((p: any) => p.platform.name) || [],
        genres: game.genres?.map((g: any) => g.name) || [],
        image: game.background_image || `https://picsum.photos/seed/${game.id}/600/400`,
        rating: Math.round(game.metacritic || game.rating * 20),
        releaseDate: game.released || "TBA",
        isChildFriendly: !game.esrb_rating || ["Everyone", "Everyone 10+", "Teen"].includes(game.esrb_rating.name)
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
