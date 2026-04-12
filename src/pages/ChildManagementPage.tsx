import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { auth, db } from '@/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Shield, Clock, Gamepad2, Users, Trash2, Save, ArrowLeft, Plus, X, Search } from 'lucide-react';

interface KidProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  screenTime: {
    dailyAllowance: number;
    usedToday: number;
    lastReset: any;
  };
  allowedGames: string[];
  friends: string[];
}

export const ChildManagementPage = () => {
  const { childId } = useParams();
  const [user] = useAuthState(auth);
  const [kid, setKid] = useState<KidProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [allowance, setAllowance] = useState(60);
  const [gameSearch, setGameSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!childId) return;

    const unsubscribe = onSnapshot(doc(db, 'users', childId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as KidProfile;
        setKid(data);
        setAllowance(data.screenTime.dailyAllowance);
      }
    });

    return () => unsubscribe();
  }, [childId]);

  const handleSaveSettings = async () => {
    if (!childId || !kid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', childId), {
        'screenTime.dailyAllowance': allowance
      });
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const removeGame = async (gameId: string) => {
    if (!childId || !kid) return;
    try {
      const newGames = kid.allowedGames.filter(id => id !== gameId);
      await updateDoc(doc(db, 'users', childId), {
        allowedGames: newGames
      });
    } catch (err) {
      console.error('Error removing game:', err);
    }
  };

  if (!kid) return <div className="flex h-screen items-center justify-center">Loading Profile...</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <button 
        onClick={() => navigate('/parent-dashboard')}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green font-bold uppercase tracking-widest text-[10px] mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Command Center
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 rounded-3xl border-2 border-plaeen-green p-1 bg-plaeen-dark shadow-[0_0_30px_rgba(118,233,0,0.2)]">
            <img
              src={kid.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${kid.uid}`}
              alt={kid.displayName}
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
          <div>
            <h1 className="text-5xl font-bold text-white uppercase tracking-tighter">{kid.displayName}</h1>
            <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-1">{kid.email}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Button 
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-8 py-6 shadow-[0_0_20px_rgba(118,233,0,0.4)]"
          >
            <Save size={20} className="mr-2" /> {isSaving ? 'Syncing...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Screen Time Settings */}
        <div className="space-y-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
            <Clock size={16} /> Screen Time
          </h2>
          <Card className="bg-white/5 border-white/10 p-8">
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-4 block">Daily Allowance (Minutes)</label>
                <div className="flex items-center gap-6">
                  <input 
                    type="range"
                    min="0"
                    max="480"
                    step="15"
                    value={allowance}
                    onChange={(e) => setAllowance(parseInt(e.target.value))}
                    className="flex-1 accent-plaeen-green"
                  />
                  <span className="text-3xl font-bold text-white w-20 text-right">{allowance}m</span>
                </div>
              </div>
              
              <div className="pt-8 border-t border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Used Today</span>
                  <span className="text-sm font-bold text-white">{kid.screenTime.usedToday}m</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]"
                    style={{ width: `${(kid.screenTime.usedToday / allowance) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Allowed Games */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
              <Gamepad2 size={16} /> Approved Games
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
              <input 
                type="text"
                placeholder="SEARCH GAMES..."
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white focus:border-plaeen-green focus:outline-none transition-all w-64"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {kid.allowedGames.map(gameId => (
              <Card key={gameId} className="bg-white/5 border-white/10 p-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-plaeen-dark overflow-hidden">
                    <img src={`https://picsum.photos/seed/${gameId}/100`} alt="Game" className="h-full w-full object-cover opacity-50" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">Game ID: {gameId}</p>
                    <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Approved</p>
                  </div>
                </div>
                <button 
                  onClick={() => removeGame(gameId)}
                  className="p-2 text-white/10 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            ))}
            <button className="border-2 border-dashed border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-white/10 hover:text-plaeen-green hover:border-plaeen-green/30 transition-all group">
              <Plus size={32} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Add New Game</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
