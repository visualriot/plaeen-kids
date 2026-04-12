import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { auth, db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, limit, orderBy, updateDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Clock, Gamepad2, Users, Calendar, Bell, ChevronRight, Play, Star, Square, Shield, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface KidData {
  uid: string;
  displayName: string;
  parentId: string;
  screenTime: {
    dailyAllowance: number;
    usedToday: number;
  };
  allowedGames: string[];
}

interface Session {
  id: string;
  gameName: string;
  startTime: any;
  status: string;
}

export const KidDashboard = () => {
  const [user] = useAuthState(auth);
  const [kidData, setKidData] = useState<KidData | null>(null);
  const [nextSession, setNextSession] = useState<Session | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  
  // Session Tracking State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    if (!user) return;

    const unsubscribeKid = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setKidData({ uid: doc.id, ...doc.data() } as KidData);
      }
    });

    const qApprovals = query(
      collection(db, 'approvals'), 
      where('childId', '==', user.uid), 
      where('status', '==', 'pending'),
      limit(3)
    );
    const unsubscribeApprovals = onSnapshot(qApprovals, (snapshot) => {
      setPendingApprovals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeKid();
      unsubscribeApprovals();
    };
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive && sessionStartTime) {
      interval = setInterval(async () => {
        const now = Date.now();
        const diffMinutes = Math.floor((now - sessionStartTime) / 60000);
        
        if (diffMinutes > elapsedMinutes) {
          setElapsedMinutes(diffMinutes);
          
          // Update usedToday in Firestore
          if (user && kidData) {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              'screenTime.usedToday': (kidData.screenTime.usedToday || 0) + 1
            });
          }

          // Check for warnings
          const remaining = (kidData?.screenTime.dailyAllowance || 0) - (kidData?.screenTime.usedToday || 0);
          if (remaining === 15 && kidData?.parentId) {
            await addDoc(collection(db, 'notifications'), {
              userId: kidData.parentId,
              title: 'Time Warning',
              message: `${kidData.displayName} has 15 minutes left.`,
              type: 'time_warning',
              childId: user?.uid,
              childName: kidData.displayName,
              createdAt: serverTimestamp(),
              read: false
            });
          }
          
          if (remaining <= 0) {
            handleStopSession();
          }
        }
      }, 60000); // Check every minute
    }
    return () => clearInterval(interval);
  }, [isSessionActive, sessionStartTime, elapsedMinutes, kidData, user]);

  const handleStartSession = async () => {
    if (!user || !kidData) return;
    if ((kidData.screenTime.usedToday || 0) >= (kidData.screenTime.dailyAllowance || 0)) {
      alert('You have no screen time left today!');
      return;
    }

    setIsSessionActive(true);
    setSessionStartTime(Date.now());
    setElapsedMinutes(0);

    // Notify parent
    if (kidData.parentId) {
      await addDoc(collection(db, 'notifications'), {
        userId: kidData.parentId,
        title: 'Session Started',
        message: `${kidData.displayName} started a gaming session.`,
        type: 'session_start',
        childId: user.uid,
        childName: kidData.displayName,
        createdAt: serverTimestamp(),
        read: false
      });
    }
  };

  const handleStopSession = async () => {
    setIsSessionActive(false);
    setSessionStartTime(null);
    setElapsedMinutes(0);

    // Notify parent
    if (user && kidData?.parentId) {
      await addDoc(collection(db, 'notifications'), {
        userId: kidData.parentId,
        title: 'Session Ended',
        message: `${kidData.displayName} ended their gaming session.`,
        type: 'session_end',
        childId: user.uid,
        childName: kidData.displayName,
        createdAt: serverTimestamp(),
        read: false
      });
    }
  };

  if (!kidData) return <div className="flex h-screen items-center justify-center">Initializing Hub...</div>;

  const remainingTime = kidData.screenTime.dailyAllowance - kidData.screenTime.usedToday;
  const timePercent = (remainingTime / kidData.screenTime.dailyAllowance) * 100;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-12">
        <h1 className="text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
          Welcome, <span className="text-plaeen-green">{kidData.displayName}</span>
        </h1>
        <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">Your Gaming Hub is Online</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Main Stats */}
        <div className="lg:col-span-2 space-y-12">
          {/* Screen Time Card */}
          <Card className="bg-plaeen-purple/20 border-plaeen-green/30 p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock size={120} className="text-plaeen-green" />
            </div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-4 flex items-center gap-2">
                    <Clock size={14} /> Screen Time Status
                  </h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-7xl font-bold text-white tracking-tighter">{remainingTime}</span>
                    <span className="text-xl font-bold text-white/40 uppercase tracking-widest">Minutes Left</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  {isSessionActive ? (
                    <Button 
                      onClick={handleStopSession}
                      className="bg-red-500 text-white font-bold uppercase tracking-widest text-[10px] px-8 py-4 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                    >
                      <Square size={14} className="mr-2" /> Stop Session
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleStartSession}
                      disabled={remainingTime <= 0}
                      className="bg-plaeen-green text-black font-bold uppercase tracking-widest text-[10px] px-8 py-4 shadow-[0_0_20px_rgba(118,233,0,0.4)]"
                    >
                      <Play size={14} className="mr-2" /> Start Session
                    </Button>
                  )}
                  <Button className="bg-white/5 border border-white/10 text-white hover:bg-white/10 font-bold uppercase tracking-widest text-[10px] px-8 py-4">
                    Request More Time
                  </Button>
                </div>
              </div>

              <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-1">
                <div 
                  className="h-full bg-plaeen-green rounded-full shadow-[0_0_15px_rgba(118,233,0,0.5)] transition-all duration-1000"
                  style={{ width: `${timePercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-bold uppercase tracking-widest text-white/20">
                <span>0m Used</span>
                <span>{kidData.screenTime.dailyAllowance}m Limit</span>
              </div>
            </div>
          </Card>

          {/* Quick Actions Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <Link to="/teams">
              <Card className="bg-white/5 border-white/10 p-8 hover:border-plaeen-green/50 transition-all text-center group">
                <div className="h-16 w-16 mx-auto bg-plaeen-green/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-plaeen-green group-hover:text-black transition-all">
                  <Users size={32} />
                </div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-2">My Teams</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Play with friends</p>
              </Card>
            </Link>
            <Link to="/search">
              <Card className="bg-white/5 border-white/10 p-8 hover:border-plaeen-green/50 transition-all text-center group">
                <div className="h-16 w-16 mx-auto bg-plaeen-green/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-plaeen-green group-hover:text-black transition-all">
                  <Gamepad2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-2">Explore</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Find new games</p>
              </Card>
            </Link>
            <Link to="/calendar">
              <Card className="bg-white/5 border-white/10 p-8 hover:border-plaeen-green/50 transition-all text-center group">
                <div className="h-16 w-16 mx-auto bg-plaeen-green/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-plaeen-green group-hover:text-black transition-all">
                  <Calendar size={32} />
                </div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-2">Schedule</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Plan sessions</p>
              </Card>
            </Link>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-12">
          {/* Next Session */}
          <section className="space-y-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
              <Play size={16} /> Next Session
            </h2>
            <Card className="bg-white/5 border-white/10 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Gamepad2 size={64} />
              </div>
              {isSessionActive ? (
                <div className="animate-pulse">
                  <p className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest mb-2">Active Session</p>
                  <p className="text-2xl font-bold text-white uppercase tracking-tight mb-4">Playing Now</p>
                  <div className="flex items-center gap-2 text-white/40 font-bold uppercase tracking-widest text-[10px]">
                    <Clock size={12} /> {elapsedMinutes}m elapsed
                  </div>
                </div>
              ) : nextSession ? (
                <div>
                  <p className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest mb-2">{nextSession.gameName}</p>
                  <p className="text-2xl font-bold text-white uppercase tracking-tight mb-4">Starting Soon</p>
                  <div className="flex items-center gap-2 text-white/40 font-bold uppercase tracking-widest text-[10px]">
                    <Clock size={12} /> {format(nextSession.startTime.toDate(), 'HH:mm')}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-4">No sessions planned</p>
                  <Link to="/calendar">
                    <Button variant="outline" size="sm" className="border-white/10 text-white/40 hover:text-plaeen-green text-[8px] font-bold uppercase tracking-widest">
                      Create One
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          </section>

          {/* Request Status */}
          <section className="space-y-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
              <Bell size={16} /> Request Status
            </h2>
            <div className="space-y-4">
              {pendingApprovals.map(req => (
                <Card key={req.id} className="bg-white/5 border-white/10 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">
                        {req.type === 'game' ? 'Game Access' : req.type === 'friend' ? 'Friend Request' : 'Extra Time'}
                      </p>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">Pending Approval</p>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                  </div>
                </Card>
              ))}
              {pendingApprovals.length === 0 && (
                <p className="text-center py-8 text-white/10 text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">No pending requests</p>
              )}
            </div>
          </section>

          {/* Approved Games */}
          <section className="space-y-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
              <Star size={16} /> Top Games
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {kidData.allowedGames.slice(0, 4).map(gameId => (
                <div key={gameId} className="aspect-square rounded-xl bg-white/5 border border-white/10 overflow-hidden group cursor-pointer">
                  <img 
                    src={`https://picsum.photos/seed/${gameId}/200`} 
                    alt="Game" 
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
              <Link to="/search" className="aspect-square rounded-xl border border-dashed border-white/10 flex items-center justify-center hover:border-plaeen-green/50 transition-all group">
                <Plus size={24} className="text-white/10 group-hover:text-plaeen-green" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
