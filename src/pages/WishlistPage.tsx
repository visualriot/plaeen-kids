import React, { useState, useEffect } from 'react';
import { auth, db } from '@/firebase';
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Heart, Trash2, ExternalLink, Gamepad2 } from 'lucide-react';

interface WishlistItem {
  id: string;
  name: string;
  image: string;
  addedAt: string;
}

export const WishlistPage = () => {
  const [user] = useAuthState(auth);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setWishlist(docSnap.data().wishlist || []);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const removeFromWishlist = async (gameId: string) => {
    if (!user) return;
    try {
      const itemToRemove = wishlist.find(item => item.id === gameId);
      if (itemToRemove) {
        await updateDoc(doc(db, 'users', user.uid), {
          wishlist: arrayRemove(itemToRemove)
        });
      }
    } catch (err) {
      console.error('Error removing from wishlist:', err);
    }
  };

  const handleViewDetails = (gameName: string) => {
    navigate(`/search?q=${encodeURIComponent(gameName)}`);
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center">Loading...</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between mb-12">
        <h1 className="font-display text-5xl font-bold text-plaeen-green uppercase tracking-tight">
          My Wishlist
        </h1>
        <div className="flex items-center gap-2 text-white/40">
          <Heart size={24} className="text-red-500 fill-red-500" />
          <span className="font-bold uppercase tracking-widest">{wishlist.length} Games</span>
        </div>
      </div>

      {wishlist.length === 0 ? (
        <Card className="text-center py-20 bg-white/5 border-dashed border-white/20">
          <Gamepad2 size={64} className="mx-auto text-white/10 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Your wishlist is empty</h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            Explore new games and add them to your wishlist to keep track of what you want to play next!
          </p>
          <Button onClick={() => navigate('/search')}>Explore Games</Button>
        </Card>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {wishlist.map((game) => (
            <Card key={game.id} className="p-0 overflow-hidden border-none bg-transparent group">
              <div className="relative aspect-video overflow-hidden rounded-2xl mb-4">
                <img
                  src={game.image}
                  alt={game.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                  <Button 
                    size="sm" 
                    className="w-full gap-2"
                    onClick={() => handleViewDetails(game.name)}
                  >
                    <ExternalLink size={16} /> View Details
                  </Button>
                </div>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-plaeen-green group-hover:text-white transition-colors uppercase tracking-tight">
                    {game.name}
                  </h3>
                  <p className="text-[10px] font-bold text-white/20 mt-1 uppercase tracking-widest">Added on {new Date(game.addedAt).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => removeFromWishlist(game.id)}
                  className="text-white/20 hover:text-red-500 transition-colors p-2"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
