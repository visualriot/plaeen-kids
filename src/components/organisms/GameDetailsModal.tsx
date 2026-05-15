import React from "react";
import { X, Star, Gamepad2, Tag, Plus, Share2, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../atoms/Button";
import { useNavigate } from "react-router-dom";

interface TeamWithSession {
  id: string;
  name: string;
  sessionId: string;
  imageURL?: string;
}

/**
 * @component GameDetailsModal
 * @atomic organism
 * @figma GameDetailsModal (Components / Organisms / GameDetailsModal)
 *
 * @tokens
 *   shadow-2xl, radius-xl, radius-full, radius-sm
 *
 * @states default, hover
 * @transitions all 200ms ease
 */
interface GameDetailsModalProps {
  game: any;
  isOpen: boolean;
  onClose: () => void;
  teams?: TeamWithSession[];
  onCreateSession?: () => void;
  onRecommend?: () => void;
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  game,
  isOpen,
  onClose,
  teams = [],
  onCreateSession,
  onRecommend,
}) => {
  const navigate = useNavigate();

  if (!game) return null;

  const handleTagClick = (tag: string) => {
    navigate(`/search?tag=${encodeURIComponent(tag)}`);
    onClose();
  };

  const handleGenreClick = (genre: string) => {
    navigate(`/search?genre=${encodeURIComponent(genre)}`);
    onClose();
  };

  const handlePlatformClick = (platform: string) => {
    navigate(`/search?platform=${encodeURIComponent(platform)}`);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pt-20"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-plaeen-dark border border-white/10 rounded-radius-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto relative my-auto"
            style={{
              boxShadow: "var(--shadow-2xl)",
              scrollbarWidth: "thin",
              scrollbarColor: "#3a3a3a #1a1a1a",
            }}
          >
            <div className="game-details-modal" style={{ maxHeight: "85vh" }}>
              {/* Cover Image Background Section */}
              {game.image && (
                <div
                  className="relative w-full"
                  style={{
                    paddingBottom: "35%",
                    backgroundImage: `url(${game.image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {/* Close Button - Fixed positioning */}
                  <button
                    onClick={onClose}
                    className="absolute top-8 right-8 z-99 bg-gray-800/10 hover:bg-gray-800/40 rounded-radius-full p-3 transition-all border border-gray-800/20 hover:text-white/50 text-gray-800"
                  >
                    <X size={16} className="" />
                  </button>
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 z-1 bg-linear-to-t from-plaeen-dark via-plaeen-dark/80 to-transparent" />
                </div>
              )}

              {/* Content Section - Normal Flow */}
              <div className="relative z-40 p-8 space-y-8 -mt-32">
                {/* Title & Rating Row */}
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <h1 className="text-5xl font-bold text-white mb-2">
                      {game.name}
                    </h1>
                    {game.releaseDate && (
                      <p className="text-xs text-white/50 font-semibold uppercase ">
                        Released: {new Date(game.releaseDate).getFullYear()}
                      </p>
                    )}
                  </div>
                  {game.rating && (
                    <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg shrink-0 border border-white/10">
                      <Star size={18} className="text-white/60" />
                      <span className="text-lg font-bold text-white">
                        {(game.rating / 20).toFixed(1)}/5
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {game.description &&
                  game.description !== "No description available." && (
                    <div>
                      <h2 className="text-sm font-semibold text-white/60 uppercase  mb-3">
                        About
                      </h2>
                      <p className="text-white/70  text-sm">
                        {game.description}
                      </p>
                    </div>
                  )}

                {/* Platforms Section */}
                {game.platforms && game.platforms.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-white/60 uppercase  mb-3 flex items-center gap-2">
                      <Gamepad2 size={16} className="text-white/40" /> Platforms
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {game.platforms.map((platform: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => handlePlatformClick(platform)}
                          className="bg-white/8 text-white px-3 py-1 rounded-radius-sm text-xs font-semibold hover:bg-white/15 transition-all border border-white/10"
                        >
                          {platform}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Genres Section */}
                {game.genres && game.genres.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-white/60 uppercase  mb-3 flex items-center gap-2">
                      <Tag size={16} className="text-white/40" /> Genres
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {game.genres.map((genre: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => handleGenreClick(genre)}
                          className="bg-white/8 text-white px-3 py-1 rounded-radius-sm text-xs font-semibold hover:bg-white/15 transition-all border border-white/10"
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {game.tags && game.tags.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-white/60 uppercase  mb-3">
                      Tags
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {game.tags
                        .slice(0, 10)
                        .map((tag: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => handleTagClick(tag)}
                            className="text-white/60 hover:text-white/80 transition-colors text-xs cursor-pointer"
                          >
                            #{tag}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Teams Playing This Game */}
                {teams && teams.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-white/60 uppercase  mb-3 flex items-center gap-2">
                      <Gamepad2 size={16} className="text-white/40" /> Playing
                      with Teams
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {teams.map((team) => (
                        <button
                          key={team.id}
                          onClick={() =>
                            navigate(
                              `/teams/${team.id}/games/${game.id}?sessionId=${team.sessionId}`,
                            )
                          }
                          className="bg-white/8 text-white px-3 py-1 rounded-radius-sm text-xs font-semibold hover:bg-white/15 transition-all border border-white/10 flex items-center gap-1"
                        >
                          <Play size={12} fill="white" /> {team.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {onCreateSession && (
                    <Button
                      onClick={onCreateSession}
                      className="flex-1 bg-white/10 text-white font-semibold hover:bg-white/20 py-3 border border-white/20 flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Create Session
                    </Button>
                  )}
                  {onRecommend && (
                    <Button
                      onClick={onRecommend}
                      className="flex-1 bg-white/10 text-white font-semibold hover:bg-white/20 py-3 border border-white/20 flex items-center justify-center gap-2"
                    >
                      <Share2 size={16} /> Recommend
                    </Button>
                  )}
                </div>
              </div>

              {/* Fallback when no image */}
              {!game.image && (
                <div className="p-8 space-y-8">
                  {/* Title & Rating Row */}
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <h1 className="text-5xl font-bold text-white mb-2">
                        {game.name}
                      </h1>
                      {game.releaseDate && (
                        <p className="text-xs text-white/50 font-semibold uppercase ">
                          Released: {new Date(game.releaseDate).getFullYear()}
                        </p>
                      )}
                    </div>
                    {game.rating && (
                      <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg shrink-0 border border-white/10">
                        <Star size={18} className="text-white/60" />
                        <span className="text-lg font-bold text-white">
                          {(game.rating / 20).toFixed(1)}/5
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {game.description &&
                    game.description !== "No description available." && (
                      <div>
                        <h2 className="text-sm font-semibold text-white/60 uppercase  mb-3">
                          About
                        </h2>
                        <p className="text-white/70  text-sm">
                          {game.description}
                        </p>
                      </div>
                    )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    {onCreateSession && (
                      <Button
                        onClick={onCreateSession}
                        className="flex-1 bg-white/10 text-white font-semibold hover:bg-white/20 py-3 border border-white/20 flex items-center justify-center gap-2"
                      >
                        <Plus size={16} /> Create Session
                      </Button>
                    )}
                    {onRecommend && (
                      <Button
                        onClick={onRecommend}
                        className="flex-1 bg-white/10 text-white font-semibold hover:bg-white/20 py-3 border border-white/20 flex items-center justify-center gap-2"
                      >
                        <Share2 size={16} /> Recommend
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
