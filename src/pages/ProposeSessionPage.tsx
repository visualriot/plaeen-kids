import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '@/firebase';
import { doc, collection, addDoc, getDoc, getDocs, query, where, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  ChevronLeft,
  Shield,
  Gamepad2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface GroupGame {
  id: string;
  name: string;
  image: string;
}

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  screenTime?: {
    dailyAllowance: number;
    usedToday: number;
  };
}

export const ProposeSessionPage = () => {
  const { teamId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const { role, activeKid: kidData, parentProfile } = useProfile();
  
  const [team, setTeam] = useState<any>(null);
  const [teamGames, setTeamGames] = useState<GroupGame[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selectedGame, setSelectedGame] = useState<GroupGame | null>(null);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [proposalNote, setProposalNote] = useState('');
  const [loading, setLoading] = useState(true);

  const day = searchParams.get('day');
  const hour = parseInt(searchParams.get('hour') || '0');

  const activeUid = kidData ? kidData.uid : user?.uid;

  useEffect(() => {
    if (!teamId || !day || isNaN(hour)) {
      navigate('/teams');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch Team
        const teamDoc = await getDoc(doc(db, 'groups', teamId));
        if (!teamDoc.exists()) {
          navigate('/teams');
          return;
        }
        const teamData = { id: teamDoc.id, ...teamDoc.data() };
        setTeam(teamData);

        // Fetch Games
        const gamesSnap = await getDocs(collection(db, 'groups', teamId, 'games'));
        const games = gamesSnap.docs.map(d => ({ id: d.id, ...d.data() } as GroupGame));
        setTeamGames(games);
        if (games.length > 0) setSelectedGame(games[0]);

        // Fetch Members (for allowance checks)
        const memberProfiles: UserProfile[] = [];
        const memberIds = (teamData as any).members || [];
        for (const mid of memberIds) {
          const mDoc = await getDoc(doc(db, 'users', mid));
          if (mDoc.exists()) {
            memberProfiles.push({ uid: mDoc.id, ...mDoc.data() } as UserProfile);
          }
        }
        setMembers(memberProfiles);

      } catch (err) {
        console.error('Error fetching data for proposal:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, day, hour]);

  const handlePropose = async () => {
    if (!teamId || !activeUid || !selectedGame || !day) return;
    
    try {
      const [y, m, d] = day.split('-').map(Number);
      const startTime = new Date(y, m - 1, d, hour, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + sessionDuration * 60000);

      const sessionData = {
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        gameImage: selectedGame.image,
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        duration: sessionDuration,
        proposedBy: activeUid,
        proposedByName: kidData?.displayName || user?.displayName || parentProfile?.displayName || 'Anonymous',
        status: 'proposed',
        notes: proposalNote.trim(),
        responses: {
          [activeUid]: { status: 'accepted', note: proposalNote.trim() }
        },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'groups', teamId, 'sessions'), sessionData);
      
      // Navigate back
      navigate(`/teams/${teamId}`);
    } catch (err) {
      console.error('Error proposing session:', err);
      alert('Failed to propose session. Please try again.');
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-white font-bold uppercase tracking-widest">Loading Proposal Intel...</div>;

  return (
    <div className="min-h-screen bg-plaeen-dark pt-24 pb-20 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-6 mb-12">
          <button 
            onClick={() => navigate(`/teams/${teamId}`)}
            className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-4xl md:text-6xl font-bold text-white uppercase tracking-tighter">
              Propose <span className="text-plaeen-green">Session</span>
            </h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mt-2">
              Team: <span className="text-white">{team?.name}</span>
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Left: Summary & Progress */}
          <div className="lg:col-span-1 space-y-8">
             {selectedGame ? (
                <div className="relative group rounded-3xl overflow-hidden aspect-video shadow-2xl">
                  <img src={selectedGame.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark to-transparent opacity-60" />
                  <div className="absolute bottom-6 left-6">
                    <p className="text-[10px] font-bold text-plaeen-green uppercase tracking-[0.3em] mb-1">Selected Game</p>
                    <h3 className="text-2xl font-bold text-white uppercase tracking-tight">{selectedGame.name}</h3>
                  </div>
                </div>
              ) : (
                <div className="aspect-video rounded-3xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest text-center px-4">Select a game</p>
                </div>
              )}

              <Card className="bg-white/5 border-white/10 p-8 space-y-6">
                 <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-plaeen-green/10 flex items-center justify-center text-plaeen-green shrink-0">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Target Date</p>
                    <p className="text-lg font-bold text-white uppercase">{day ? format(new Date(day.replace(/-/g, '/')), 'EEEE, MMM d') : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-plaeen-purple/10 flex items-center justify-center text-plaeen-purple shrink-0">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Time Slot</p>
                    <p className="text-lg font-bold text-white uppercase">{hour}:00 <span className="text-white/20 text-xs ml-1">(Local)</span></p>
                  </div>
                </div>
              </Card>

              {/* Team Readiness */}
              <div className="space-y-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40 px-2">Team Readiness</h2>
                <div className="grid gap-3">
                  {members.map(member => {
                    const allowance = member.screenTime?.dailyAllowance || 0;
                    const used = member.screenTime?.usedToday || 0;
                    const remaining = allowance - used;
                    const isShort = remaining < sessionDuration;
                    
                    return (
                      <div key={member.uid} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <img src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} className="h-8 w-8 rounded-full border border-white/10" />
                          <span className="text-xs font-bold text-white uppercase truncate max-w-[120px]">{member.displayName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isShort ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 rounded-full">
                              <AlertTriangle size={12} className="text-amber-500" />
                              <span className="text-[10px] font-bold text-amber-500 uppercase">Short</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-plaeen-green/10 rounded-full">
                              <Sparkles size={12} className="text-plaeen-green" />
                              <span className="text-[10px] font-bold text-plaeen-green uppercase">Ready</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>

          {/* Right: Options & Interaction */}
          <div className="lg:col-span-2 space-y-12">
            {/* Game Selection */}
            <section>
               <div className="flex items-center justify-between mb-6">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
                  <Gamepad2 size={16} /> Choose Your Game
                </h2>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{teamGames.length} Available</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {teamGames.map(game => (
                  <button 
                    key={game.id}
                    onClick={() => setSelectedGame(game)}
                    className={cn(
                      "p-3 rounded-[2rem] border-2 transition-all text-left relative group",
                      selectedGame?.id === game.id ? "bg-plaeen-green border-plaeen-green shadow-[0_0_30px_rgba(118,233,0,0.3)]" : "bg-white/5 border-white/5 hover:border-white/20"
                    )}
                  >
                    <img src={game.image} className="aspect-video w-full rounded-2xl object-cover mb-3" />
                    <p className={cn(
                      "text-sm font-bold uppercase tracking-tight truncate px-2",
                      selectedGame?.id === game.id ? "text-black" : "text-white/60"
                    )}>{game.name}</p>
                    {selectedGame?.id === game.id && (
                      <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-black flex items-center justify-center">
                        <Sparkles size={12} className="text-plaeen-green" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* Duration Selector */}
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40 mb-6">Session Duration</h2>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                {[30, 45, 60, 90, 120, 180].map(duration => (
                  <button
                    key={duration}
                    onClick={() => setSessionDuration(duration)}
                    className={cn(
                      "py-6 rounded-2xl border-2 font-bold transition-all uppercase tracking-widest",
                      sessionDuration === duration 
                        ? "bg-plaeen-purple border-plaeen-purple text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]" 
                        : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                    )}
                  >
                    <span className="text-xl">{duration >= 60 ? `${duration/60}h` : `${duration}m`}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Note Section */}
            <section>
              <div className="relative group">
                <label className="absolute -top-3 left-8 px-3 bg-plaeen-dark text-[10px] font-bold text-plaeen-green uppercase tracking-[0.4em] z-10">Add Session Goal</label>
                <textarea 
                  value={proposalNote}
                  onChange={(e) => setProposalNote(e.target.value)}
                  placeholder="What's the mission? (e.g. Grinding for level 50!)"
                  className="w-full bg-white/5 border-2 border-white/10 rounded-[2.5rem] p-8 pt-10 text-white placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all h-40 text-lg font-bold"
                />
              </div>
            </section>

            <div className="pt-6">
              <Button 
                onClick={handlePropose} 
                disabled={!selectedGame}
                className="w-full py-10 text-2xl font-bold uppercase tracking-[0.2em] shadow-[0_0_50px_rgba(118,233,0,0.3)] bg-plaeen-green text-black hover:scale-[1.02] transition-transform group"
              >
                <Sparkles size={32} className="mr-4 group-hover:rotate-12 transition-transform" />
                Broadcast Proposal
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
