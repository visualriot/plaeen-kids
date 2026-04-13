import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { auth, db } from '@/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Shield, Clock, Gamepad2, Users, Trash2, Save, ArrowLeft, Plus, X, Search, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KidProfile {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  screenTime: {
    dailyAllowance: number;
    usedToday: number;
    weeklyAllowance?: number;
    usedWeekly?: number;
    monthlyAllowance?: number;
    usedMonthly?: number;
    accumulatedTime?: number;
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
  const [dailyAllowance, setDailyAllowance] = useState(60);
  const [allowanceType, setAllowanceType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [restrictedDays, setRestrictedDays] = useState<string[]>([]);
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const [gameSearch, setGameSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!childId) return;

    const unsubscribe = onSnapshot(doc(db, 'users', childId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as KidProfile;
        setKid(data);
        setDailyAllowance(data.screenTime?.dailyAllowance || 60);
        setAllowanceType((data.screenTime as any)?.allowanceType || 'daily');
        setRestrictedDays((data.screenTime as any)?.restrictedDays || []);
        setAccumulatedTime(data.screenTime?.accumulatedTime || 0);
      }
    });

    return () => unsubscribe();
  }, [childId]);

  const handleSaveSettings = async () => {
    if (!childId || !kid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', childId), {
        'screenTime.dailyAllowance': dailyAllowance,
        'screenTime.allowanceType': allowanceType,
        'screenTime.restrictedDays': restrictedDays,
        'screenTime.accumulatedTime': accumulatedTime
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
      const newGames = (kid.allowedGames || []).filter(id => id !== gameId);
      await updateDoc(doc(db, 'users', childId), {
        allowedGames: newGames
      });
    } catch (err) {
      console.error('Error removing game:', err);
    }
  };

  if (!kid) return <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">Loading Profile...</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <button 
        onClick={() => navigate('/parent-dashboard')}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green font-bold uppercase tracking-widest text-[10px] mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Guardian Hub
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
            <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-1">@{kid.username}</p>
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
            <Clock size={16} /> Screen Time Control
          </h2>
          <Card className="bg-white/5 border-white/10 p-8 space-y-10">
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 block">Allowance</label>
                <div className="relative">
                  <select 
                    value={allowanceType}
                    onChange={(e) => setAllowanceType(e.target.value as any)}
                    className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2 pr-10 text-[10px] font-bold uppercase tracking-widest text-plaeen-green focus:outline-none focus:border-plaeen-green/50 cursor-pointer transition-all backdrop-blur-xl"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2376e900'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                      backgroundSize: '1rem'
                    }}
                  >
                    <option value="daily" className="bg-plaeen-dark text-white">Daily</option>
                    <option value="weekly" className="bg-plaeen-dark text-white">Weekly</option>
                    <option value="monthly" className="bg-plaeen-dark text-white">Monthly</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <input 
                  type="range"
                  min="0"
                  max={allowanceType === 'daily' ? 480 : allowanceType === 'weekly' ? 3360 : 14400}
                  step={allowanceType === 'daily' ? 15 : 60}
                  value={dailyAllowance}
                  onChange={(e) => setDailyAllowance(parseInt(e.target.value))}
                  className="flex-1 accent-plaeen-green h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer"
                />
                <input 
                  type="number"
                  value={dailyAllowance}
                  onChange={(e) => setDailyAllowance(parseInt(e.target.value) || 0)}
                  className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xl font-bold text-white text-center focus:outline-none focus:border-plaeen-green/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">min</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-4 block">Restricted Days (No Play)</label>
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <button
                    key={day}
                    onClick={() => {
                      setRestrictedDays(prev => 
                        prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                      );
                    }}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border-2",
                      restrictedDays.includes(day)
                        ? "bg-red-500/20 border-red-500 text-red-500"
                        : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-8 border-t border-white/5">
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-4 block">Bonus / Accumulated Time</label>
              <div className="flex items-center gap-4">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setAccumulatedTime(Math.max(0, accumulatedTime - 5))}
                  className="border-white/10 text-white/40"
                >
                  -5m
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-bold text-white">{accumulatedTime}m</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setAccumulatedTime(accumulatedTime + 5)}
                  className="border-white/10 text-white/40"
                >
                  +5m
                </Button>
              </div>
            </div>
          </Card>

          <Card className="bg-plaeen-purple/10 border-plaeen-purple/20 p-8">
            <div className="flex items-center gap-4 mb-4">
              <Zap size={20} className="text-plaeen-purple" />
              <h3 className="text-xs font-bold text-white uppercase tracking-tight">Auto-Accumulation</h3>
            </div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
              Unused screen time will automatically roll over to the next period.
            </p>
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
            {(kid.allowedGames || []).map(gameId => (
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
