import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { auth, db } from '@/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, getDoc, addDoc, deleteDoc, Timestamp, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Plus, Edit2, X, ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, Trash2, Bell, UserPlus, Gamepad2, Sparkles, Check, HelpCircle, MessageSquare, RotateCcw, Clock, Shield, Settings } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isAfter, subDays } from 'date-fns';
import { cn, safeToDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Team {
  id: string;
  name: string;
  members: string[];
  adminIds: string[];
  pendingMembers?: string[];
  ownerId: string;
  imageURL?: string;
  teamAvailability?: Record<string, string>;
}

interface GroupGame {
  id: string;
  name: string;
  image: string;
  description: string;
  platforms: string[];
  genres: string[];
}

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  availability?: Record<string, string>;
}

interface Session {
  id: string;
  gameId: string;
  gameName: string;
  gameImage?: string;
  startTime: any;
  proposedBy: string;
  proposedByName: string;
  status: 'proposed' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  responses?: Record<string, { status: 'accepted' | 'rejected' | 'maybe', note?: string }>;
}

import { useProfile } from '@/contexts/ProfileContext';

interface TeamEvent {
  id: string;
  type: 'member_joined';
  userId: string;
  userName: string;
  createdAt: any;
}

const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ruby',
];

export const TeamDetailPage = () => {
  const { teamId } = useParams();
  const [user] = useAuthState(auth);
  const { role, activeKid: kidData, parentProfile } = useProfile();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [teamGames, setTeamGames] = useState<GroupGame[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [dismissedEvents, setDismissedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isProposeOpen, setIsProposeOpen] = useState(false);
  const [isResponseOpen, setIsResponseOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string, hour: number } | null>(null);
  const [selectedGame, setSelectedGame] = useState<GroupGame | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [proposalNote, setProposalNote] = useState('');
  const navigate = useNavigate();

  const activeUid = kidData ? kidData.uid : user?.uid;

  useEffect(() => {
    if (!teamId) return;

    const unsubscribe = onSnapshot(doc(db, 'groups', teamId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Team;
        const adminIds = data.adminIds || (data.ownerId ? [data.ownerId] : []);
        setTeam({ id: docSnap.id, ...data, adminIds });
      } else {
        navigate('/teams');
      }
      setLoading(false);
    });

    const sessionsUnsubscribe = onSnapshot(collection(db, 'groups', teamId, 'sessions'), (snapshot) => {
      setSessions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
    });

    const gamesUnsubscribe = onSnapshot(collection(db, 'groups', teamId, 'games'), (snapshot) => {
      setTeamGames(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GroupGame)));
    });

    const eventsUnsubscribe = onSnapshot(
      query(collection(db, 'groups', teamId, 'events'), orderBy('createdAt', 'desc'), limit(10)),
      (snapshot) => {
        setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TeamEvent)));
      }
    );

    return () => {
      unsubscribe();
      sessionsUnsubscribe();
      gamesUnsubscribe();
      eventsUnsubscribe();
    };
  }, [teamId, navigate]);

  useEffect(() => {
    if (!team?.members) return;

    const q = query(collection(db, 'users'), where('uid', 'in', team.members));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setMembers(membersData);
    });

    return () => unsubscribe();
  }, [team?.members]);

  useEffect(() => {
    if (!team?.pendingMembers || team.pendingMembers.length === 0) {
      setPendingMembers([]);
      return;
    }

    const q = query(collection(db, 'users_public'), where('uid', 'in', team.pendingMembers));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    return () => unsubscribe();
  }, [team?.pendingMembers]);

  useEffect(() => {
    if (!activeUid) return;
    const fetchFriends = async () => {
      const userDoc = await getDoc(doc(db, 'users', activeUid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friends || [];
        const nonMemberFriends = friendIds.filter((id: string) => 
          !team?.members.includes(id) && !(team?.pendingMembers || []).includes(id)
        );
        if (nonMemberFriends.length > 0) {
          const friendsQuery = query(collection(db, 'users_public'), where('uid', 'in', nonMemberFriends));
          const friendsSnap = await getDocs(friendsQuery);
          setFriends(friendsSnap.docs.map(d => d.data() as UserProfile));
        } else {
          setFriends([]);
        }
      }
    };
    fetchFriends();
  }, [activeUid, team?.members]);

  useEffect(() => {
    if (teamGames.length > 0 && !selectedGame) {
      setSelectedGame(teamGames[0]);
    }
  }, [teamGames]);

  const addMember = async (memberId: string) => {
    if (!teamId || !team) return;
    
    // Check if already a member or already has a pending invitation
    if (team.members.includes(memberId) || (team.pendingMembers || []).includes(memberId)) {
      return; 
    }

    try {
      // Find the friend's record to get their name
      const friend = friends.find(f => f.uid === memberId);
      
      await updateDoc(doc(db, 'groups', teamId), {
        pendingMembers: arrayUnion(memberId)
      });

      // Send notification for invitation
      await addDoc(collection(db, 'notifications'), {
        userId: memberId,
        type: 'team_invite',
        title: 'Team Invitation',
        message: `${kidData?.displayName || parentProfile?.displayName || 'A friend'} invited you to join the team "${team.name}"`,
        data: {
          groupId: teamId,
          teamName: team.name,
          invitedBy: activeUid,
          invitedByName: kidData?.displayName || parentProfile?.displayName || 'A friend'
        },
        read: false,
        createdAt: serverTimestamp()
      });

      setIsAddMemberOpen(false);
    } catch (err) {
      console.error('Error adding member:', err);
    }
  };

  const proposeSession = async () => {
    if (!teamId || !activeUid || !selectedSlot || !selectedGame) return;
    
    const startTime = new Date(selectedSlot.day);
    startTime.setHours(selectedSlot.hour, 0, 0, 0);

    try {
      await addDoc(collection(db, 'groups', teamId, 'sessions'), {
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        gameImage: selectedGame.image,
        startTime: Timestamp.fromDate(startTime),
        proposedBy: activeUid,
        proposedByName: kidData?.displayName || user?.displayName || 'Anonymous',
        status: 'proposed',
        responses: {
          [activeUid]: { status: 'accepted', note: proposalNote }
        }
      });
      setIsProposeOpen(false);
      setSelectedSlot(null);
      setProposalNote('');
    } catch (err) {
      console.error('Error proposing session:', err);
    }
  };

  const respondToSession = async (status: 'accepted' | 'rejected' | 'maybe', note: string, sessionId?: string) => {
    const targetSessionId = sessionId || selectedSession?.id;
    if (!teamId || !activeUid || !targetSessionId) return;
    try {
      await updateDoc(doc(db, 'groups', teamId, 'sessions', targetSessionId), {
        [`responses.${activeUid}`]: { status, note }
      });
      setIsResponseOpen(false);
      setSelectedSession(null);
    } catch (err) {
      console.error('Error responding:', err);
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }).map((_, i) => i);

  if (loading || !team) return <div className="flex h-[60vh] items-center justify-center text-white font-bold uppercase tracking-widest">Loading Team Data...</div>;

  const headerImage = teamGames.length > 0 ? teamGames[0].image : 'https://picsum.photos/seed/gaming/1920/1080';

  const activeEvents = events.filter(e => {
    if (dismissedEvents.includes(e.id)) return false;
    const created = safeToDate(e.createdAt);
    return isAfter(created, subDays(new Date(), 1));
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Team Events Banners */}
      <div className="space-y-2 mb-8">
        <AnimatePresence>
          {activeEvents.map(event => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, height: 0, mb: 0 }}
              animate={{ opacity: 1, height: 'auto', mb: 8 }}
              exit={{ opacity: 0, height: 0, mb: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between bg-plaeen-green/10 border border-plaeen-green/20 rounded-2xl p-4 cursor-pointer hover:bg-plaeen-green/20 transition-all"
                   onClick={() => setDismissedEvents(prev => [...prev, event.id])}>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)] animate-pulse" />
                  <p className="text-xs font-bold text-white uppercase tracking-widest">
                    <span className="text-plaeen-green">{event.userName}</span> joined the team!
                  </p>
                </div>
                <X size={16} className="text-white/20 hover:text-white transition-colors" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header Section */}
      <div className="relative h-[400px] rounded-[3rem] overflow-hidden mb-12 group">
        <img src={headerImage} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark via-plaeen-dark/40 to-transparent" />
        
        <div className="absolute inset-0 p-12 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-8xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
                {((kidData?.teamAliases?.[team.id]) || (parentProfile?.teamAliases?.[team.id])) || team.name}
              </h1>
              <div className="mt-6 flex items-center gap-4">
                <Button 
                  onClick={() => navigate(`/search?teamId=${teamId}`)}
                  className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-8 py-6 shadow-[0_0_20px_rgba(118,233,0,0.4)]"
                >
                  <Plus size={20} className="mr-2" /> Add Session
                </Button>
                <Button 
                  onClick={() => navigate(`/teams/${teamId}/settings`)}
                  variant="outline" 
                  className="border-white/20 text-white hover:bg-white/10 font-bold uppercase tracking-widest px-8 py-6"
                >
                  <Settings size={20} className="mr-2" /> Team Settings
                </Button>
              </div>
            </div>

            <Card className="bg-black/40 backdrop-blur-xl border-white/10 p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-plaeen-green flex items-center justify-center text-black shadow-[0_0_15px_rgba(118,233,0,0.5)]">
                <Bell size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-widest">Notifications</p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">
                  {sessions.filter(s => s.status === 'proposed' && !s.responses?.[user?.uid || '']).length} Pending Invites
                </p>
              </div>
            </Card>
          </div>

            <div className="flex items-end justify-between">
              <div className="flex flex-wrap gap-4">
                {[...members].sort((a, b) => {
                  const aIsAdmin = team.adminIds?.includes(a.uid);
                  const bIsAdmin = team.adminIds?.includes(b.uid);
                  if (aIsAdmin && !bIsAdmin) return -1;
                  if (!aIsAdmin && bIsAdmin) return 1;
                  return 0;
                }).map((member) => (
                  <div key={member.uid} className="relative group/member">
                    <div className={cn(
                      "h-14 w-14 rounded-full border-2 p-1 bg-plaeen-dark shadow-[0_0_15px_rgba(118,233,0,0.2)]",
                      team.adminIds?.includes(member.uid) ? "border-plaeen-green" : "border-white/10"
                    )}>
                      <img
                        src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`}
                        alt={member.displayName}
                        className="h-full w-full rounded-full object-cover"
                      />
                      {team.adminIds?.includes(member.uid) && (
                        <div className="absolute -top-1 -right-1 bg-plaeen-green rounded-full p-1 shadow-lg">
                          <Shield size={10} className="text-black" />
                        </div>
                      )}
                    </div>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-plaeen-dark border border-white/10 px-3 py-1 rounded-lg opacity-0 group-hover/member:opacity-100 transition-opacity whitespace-nowrap z-20">
                      <p className="text-[10px] font-bold text-white uppercase tracking-widest">
                        {member.displayName} {team.adminIds?.includes(member.uid) && '(Admin)'}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Pending Members */}
                {pendingMembers.map((member) => (
                  <div key={member.uid} className="relative group/member">
                    <div className="h-14 w-14 rounded-full border-2 border-white/10 p-1 bg-plaeen-dark/60 opacity-60">
                      <img
                        src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`}
                        alt={member.displayName}
                        className="h-full w-full rounded-full object-cover grayscale"
                      />
                      <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-1 shadow-lg">
                        <Clock size={10} className="text-white" />
                      </div>
                    </div>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-plaeen-dark border border-white/10 px-3 py-1 rounded-lg opacity-0 group-hover/member:opacity-100 transition-opacity whitespace-nowrap z-20">
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{member.displayName} (Pending)</p>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={() => setIsAddMemberOpen(true)}
                  className="h-14 w-14 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center text-white/20 hover:border-plaeen-green hover:text-plaeen-green transition-all"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-12">
        {/* Games Played Section */}
        <div className="lg:col-span-1 space-y-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
            <Gamepad2 size={16} /> Games Played
          </h2>
          <div className="space-y-4">
            {teamGames.map(game => (
              <Link key={game.id} to={`/teams/${teamId}/games/${game.id}`}>
                <Card className="group relative overflow-hidden p-0 border-white/5 bg-white/5 hover:border-plaeen-green/30 transition-all mb-4">
                  <div className="aspect-video relative">
                    <img src={game.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight group-hover:text-plaeen-green transition-colors">
                        {game.name}
                      </h3>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
            <Button 
              variant="outline" 
              onClick={() => navigate(`/search?teamId=${teamId}`)}
              className="w-full py-8 border-dashed border-white/10 text-white/20 hover:text-plaeen-green hover:border-plaeen-green transition-all uppercase tracking-widest font-bold"
            >
              <Plus size={20} className="mr-2" /> Add Game
            </Button>
          </div>
        </div>

        {/* Game Proposals Section */}
        <div className="lg:col-span-4 space-y-8 mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-purple flex items-center gap-3">
              <Sparkles size={16} /> Game Proposals
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {sessions.filter(s => s.status === 'proposed' && !s.startTime).map(proposal => {
              const votes = Object.values(proposal.responses || {}).filter((r: any) => r.status === 'accepted').length;
              const hasVoted = proposal.responses?.[activeUid || '']?.status === 'accepted';

              return (
                <Card key={proposal.id} className="bg-white/5 border-white/10 p-6 group hover:border-plaeen-purple/30 transition-all">
                  <div className="aspect-video rounded-xl overflow-hidden mb-4">
                    <img src={proposal.gameImage} className="w-full h-full object-cover" />
                  </div>
                  <h3 className="text-lg font-bold text-white uppercase mb-2">{proposal.gameName}</h3>
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-6">Proposed by {proposal.proposedByName}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-plaeen-purple transition-all" 
                          style={{ width: `${Math.min((votes / (team.members.length || 1)) * 100, 100)}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-bold text-plaeen-purple">{votes}/{team.members.length}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant={hasVoted ? 'outline' : 'default'}
                      className={hasVoted ? 'border-plaeen-purple text-plaeen-purple' : 'bg-plaeen-purple text-white'}
                      onClick={() => respondToSession(hasVoted ? 'rejected' : 'accepted', '', proposal.id)}
                    >
                      {hasVoted ? 'Voted' : 'Vote'}
                    </Button>
                  </div>
                </Card>
              );
            })}
            {sessions.filter(s => s.status === 'proposed' && !s.startTime).length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                <p className="text-white/20 font-bold uppercase tracking-widest text-xs">No active game proposals</p>
              </div>
            )}
          </div>
        </div>

        {/* Unified Calendar Section */}
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
              <CalendarIcon size={16} /> Unified Schedule
            </h2>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="text-white/20 hover:text-plaeen-green transition-colors">
                <ChevronLeft size={24} />
              </button>
              <span className="text-sm font-bold text-white uppercase tracking-widest">
                {format(days[0], 'MMM d')} - {format(days[6], 'MMM d')}
              </span>
              <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="text-white/20 hover:text-plaeen-green transition-colors">
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <Card className="bg-white/5 border-white/10 p-8 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-[120px_repeat(24,1fr)] gap-2 mb-6">
                  <div />
                  {hours.map(h => (
                    <div key={h} className="text-center text-[10px] font-bold text-white/20">{h}</div>
                  ))}
                </div>

                {days.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  return (
                    <div key={dayKey} className="grid grid-cols-[120px_repeat(24,1fr)] gap-2 mb-2 items-center">
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        {format(day, 'EEE d')}
                      </div>
                      {hours.map(hour => {
                        const slotKey = `${dayKey}_${hour}`;
                        const session = sessions.find(s => {
                          const sDate = s.startTime.toDate();
                          return isSameDay(sDate, day) && sDate.getHours() === hour;
                        });

                        // Check team availability (mocked or from teamAvailability field)
                        const isAvailable = team.teamAvailability?.[slotKey] === 'available';
                        const isProposedByMe = session?.proposedBy === user?.uid;

                        return (
                          <div
                            key={hour}
                            onClick={() => {
                              if (session) {
                                setSelectedSession(session);
                                setIsResponseOpen(true);
                              } else {
                                setSelectedSlot({ day: dayKey, hour });
                                setIsProposeOpen(true);
                              }
                            }}
                            className={cn(
                              "h-8 rounded-lg transition-all cursor-pointer border border-transparent relative group",
                              session?.status === 'scheduled' ? "bg-plaeen-green shadow-[0_0_15px_rgba(118,233,0,0.5)]" :
                              session?.status === 'proposed' ? (isProposedByMe ? "bg-plaeen-green/20 border-plaeen-green/40" : "bg-plaeen-green/40 border-plaeen-green") :
                              isAvailable ? "bg-plaeen-green/10 border-plaeen-green/20 hover:bg-plaeen-green/30" : "bg-white/5 hover:bg-white/10"
                            )}
                          >
                            {session && (
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-plaeen-dark border border-white/10 px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30 pointer-events-none">
                                <p className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest">{session.gameName}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-8 pt-8 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Scheduled</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-plaeen-green/40 border border-plaeen-green" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Proposed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-plaeen-green/20 border border-plaeen-green/40" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Proposed by you</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-plaeen-green/10 border border-plaeen-green/20" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Team Available</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <Card className="w-full max-w-md bg-plaeen-dark border-plaeen-green/30 p-10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">Add Player</h2>
              <button onClick={() => setIsAddMemberOpen(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              {friends.map(friend => (
                <div key={friend.uid} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-4">
                    <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} className="h-10 w-10 rounded-full" />
                    <span className="font-bold text-white uppercase text-sm">{friend.displayName}</span>
                  </div>
                  <Button size="sm" onClick={() => addMember(friend.uid)}>Invite</Button>
                </div>
              ))}
              {friends.length === 0 && <p className="text-center py-8 text-white/20 font-bold uppercase tracking-widest">No friends to invite</p>}
            </div>
          </Card>
        </div>
      )}

      {isProposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <Card className="w-full max-w-2xl bg-plaeen-dark border-plaeen-green/30 p-10">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-bold text-white uppercase tracking-tighter">Propose Session</h2>
              <button onClick={() => setIsProposeOpen(false)} className="text-white/40 hover:text-white"><X size={32} /></button>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-4 block">Select Game</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {teamGames.map(game => (
                    <button 
                      key={game.id}
                      onClick={() => setSelectedGame(game)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all text-left group",
                        selectedGame?.id === game.id ? "bg-plaeen-green/10 border-plaeen-green" : "bg-white/5 border-white/10 hover:border-white/30"
                      )}
                    >
                      <img src={game.image} className="aspect-video w-full rounded-lg object-cover mb-3" />
                      <p className={cn(
                        "text-xs font-bold uppercase tracking-tight",
                        selectedGame?.id === game.id ? "text-plaeen-green" : "text-white/60"
                      )}>{game.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-sm font-bold text-white uppercase tracking-widest mb-2">Time slot</p>
                  <p className="text-2xl font-bold text-plaeen-green">
                    {selectedSlot ? format(new Date(selectedSlot.day), 'EEEE, MMM d') : ''} @ {selectedSlot?.hour}:00
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2 block">Add a note</label>
                  <textarea 
                    value={proposalNote}
                    onChange={(e) => setProposalNote(e.target.value)}
                    placeholder="e.g. Let's finish the raid!"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all h-24"
                  />
                </div>
              </div>
              <Button onClick={proposeSession} className="w-full py-6 font-bold uppercase tracking-widest">
                Confirm proposal
              </Button>
            </div>
          </Card>
        </div>
      )}

      {isResponseOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <Card className="w-full max-w-2xl bg-plaeen-dark border-plaeen-green/30 p-10 shadow-[0_0_50px_rgba(118,233,0,0.1)]">
            <div className="flex justify-between items-center mb-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-2">Session Proposed by <span className="text-white">{selectedSession.proposedByName}</span></p>
                <h2 className="text-5xl font-bold text-white uppercase tracking-tighter">{selectedSession.gameName}</h2>
              </div>
              <button onClick={() => setIsResponseOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={32} /></button>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-6 block">Invitees</label>
                <div className="space-y-4">
                  {members.map(member => {
                    const response = selectedSession.responses?.[member.uid];
                    return (
                      <div key={member.uid} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-4">
                          <img src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} className="h-10 w-10 rounded-full" />
                          <span className="font-bold text-white uppercase text-sm">{member.displayName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {response?.status === 'accepted' ? <Check className="text-plaeen-green" size={20} /> :
                           response?.status === 'rejected' ? <X className="text-red-500" size={20} /> :
                           response?.status === 'maybe' ? <HelpCircle className="text-yellow-500" size={20} /> :
                           <div className="h-5 w-5 rounded-full border-2 border-white/10" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-6 block">Notes</label>
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {Object.entries(selectedSession.responses || {}).map(([uid, res]: [string, any]) => {
                    const responder = members.find(m => m.uid === uid);
                    if (!res.note) return null;
                    return (
                      <div key={uid} className="p-4 rounded-2xl bg-white/5 border-l-4 border-plaeen-green">
                        <p className="text-[10px] font-bold text-plaeen-green uppercase mb-1">{responder?.displayName}</p>
                        <p className="text-sm text-white/80">"{res.note}"</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Button 
                onClick={() => respondToSession('accepted', '')}
                className="bg-plaeen-green text-black font-bold uppercase tracking-widest py-6"
              >
                Accept
              </Button>
              <Button 
                variant="outline"
                onClick={() => respondToSession('maybe', '')}
                className="border-white/20 text-white hover:bg-white/10 font-bold uppercase tracking-widest py-6"
              >
                Maybe
              </Button>
              <Button 
                variant="ghost"
                onClick={() => respondToSession('rejected', '')}
                className="text-red-400 hover:bg-red-500/10 font-bold uppercase tracking-widest py-6"
              >
                Decline
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
