import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { auth, db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, setDoc, getDoc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  Plus, 
  Users, 
  Clock, 
  Gamepad2, 
  Bell, 
  Shield, 
  Lock, 
  Unlock, 
  ChevronRight, 
  Check, 
  X,
  Calendar,
  Zap,
  Star,
  Trophy,
  Activity
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useProfile } from '@/contexts/ProfileContext';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';

export const KidDashboard = () => {
  const [user] = useAuthState(auth);
  const { activeKid, parentProfile } = useProfile();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOvertimeWarning, setShowOvertimeWarning] = useState(false);
  const [isChoreModalOpen, setIsChoreModalOpen] = useState(false);
  const [choreTitle, setChoreTitle] = useState('');
  const [isSubmittingChore, setIsSubmittingChore] = useState(false);
  const [choreSuccess, setChoreSuccess] = useState(false);
  const [screenTimeView, setScreenTimeView] = useState<'daily' | 'weekly' | 'monthly'>((activeKid?.screenTime as any)?.allowanceType || 'daily');
  const navigate = useNavigate();

  useEffect(() => {
    if (activeKid?.screenTime) {
      setScreenTimeView((activeKid.screenTime as any).allowanceType || 'daily');
    }
  }, [activeKid?.uid]);

  // Request notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Timer for active session
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive]);

  useEffect(() => {
    if (!user || !activeKid) return;

    // Fetch upcoming sessions from groups the kid is in
    const q = query(collection(db, 'groups'), where('members', 'array-contains', activeKid.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSessions: any[] = [];
      snapshot.docs.forEach(groupDoc => {
        const groupData = groupDoc.data();
        // This is a simplified fetch, ideally sessions are in a subcollection or separate collection
        // For now, let's assume we fetch from a 'sessions' collection where groupId is in kid's groups
      });
    });

    return () => unsubscribe();
  }, [user, activeKid]);

  const handleStartSession = async () => {
    if (!activeKid) return;

    // Check for restricted days
    const today = format(new Date(), 'EEE'); // Mon, Tue, etc.
    const restrictedDays = (activeKid.screenTime as any)?.restrictedDays || [];
    if (restrictedDays.includes(today)) {
      setErrorMessage("Today is a restricted day. No gaming sessions allowed!");
      return;
    }

    const used = activeKid.screenTime?.usedToday || 0;
    const allowance = activeKid.screenTime?.dailyAllowance || 0;
    
    if (used >= allowance) {
      setErrorMessage('You have no screen time left today!');
      return;
    }

    setIsSessionActive(true);
    setSessionStartTime(Date.now());
    setElapsedMinutes(0);
    setErrorMessage(null);

    // Notify parent
    if (activeKid.parentId) {
      await addDoc(collection(db, 'notifications'), {
        userId: activeKid.parentId,
        type: 'session_start',
        childId: activeKid.uid,
        childName: activeKid.displayName,
        message: `${activeKid.displayName} started a gaming session.`,
        createdAt: serverTimestamp(),
        read: false
      });
    }
  };

  const handleEndSession = async () => {
    if (!activeKid || !sessionStartTime) return;

    const endTime = Date.now();
    const durationMs = endTime - sessionStartTime;
    const durationMin = Math.round(durationMs / 60000);
    
    // Calculate penalty if overtime > 5 mins
    const overtimeMin = Math.max(0, durationMin - (allowance - used));
    const penalty = overtimeMin > 5 ? overtimeMin : 0;

    try {
      const userRef = doc(db, 'users', activeKid.uid);
      const updates: any = {
        'screenTime.usedToday': (activeKid.screenTime?.usedToday || 0) + durationMin
      };

      if (penalty > 0) {
        // Deduct from accumulated time (can go negative as a debt)
        updates['screenTime.accumulatedTime'] = (activeKid.screenTime?.accumulatedTime || 0) - penalty;
      }

      await updateDoc(userRef, updates);

      setIsSessionActive(false);
      setSessionStartTime(null);
      setShowOvertimeWarning(false);

      if (activeKid.parentId) {
        await addDoc(collection(db, 'notifications'), {
          userId: activeKid.parentId,
          type: 'session_end',
          childId: activeKid.uid,
          childName: activeKid.displayName,
          message: `${activeKid.displayName} finished their session.${penalty > 0 ? ` (Penalty: -${penalty}m for overtime)` : ''}`,
          duration: durationMin,
          overtime: overtimeMin,
          penaltyApplied: penalty,
          createdAt: serverTimestamp(),
          read: false,
          rewardEligible: penalty === 0
        });
      }
    } catch (err) {
      console.error('Error ending session:', err);
    }
  };

  const handleAddChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKid || !choreTitle || isSubmittingChore) return;

    setIsSubmittingChore(true);
    try {
      await addDoc(collection(db, 'approvals'), {
        parentId: activeKid.parentId,
        childId: activeKid.uid,
        childName: activeKid.displayName,
        type: 'activity',
        title: choreTitle,
        status: 'pending',
        createdAt: serverTimestamp(),
        rewardMinutes: 0
      });

      setChoreSuccess(true);
      setChoreTitle('');
      setTimeout(() => {
        setIsChoreModalOpen(false);
        setChoreSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error adding chore:', err);
      setErrorMessage('Failed to send activity for approval. Please try again.');
    } finally {
      setIsSubmittingChore(false);
    }
  };

  if (!activeKid) return null;

  const used = screenTimeView === 'daily' ? (activeKid.screenTime?.usedToday || 0) : 
               screenTimeView === 'weekly' ? (activeKid.screenTime?.usedWeekly || 0) : 
               (activeKid.screenTime?.usedMonthly || 0);
  
  const allowance = screenTimeView === 'daily' ? (activeKid.screenTime?.dailyAllowance || 0) : 
                    screenTimeView === 'weekly' ? (activeKid.screenTime?.weeklyAllowance || 420) : 
                    (activeKid.screenTime?.monthlyAllowance || 1800);

  // Calculate precise remaining time
  const usedInSessionSeconds = isSessionActive && sessionStartTime ? Math.floor((currentTime - sessionStartTime) / 1000) : 0;
  const totalUsedSeconds = (used * 60) + usedInSessionSeconds;
  const totalAllowanceSeconds = allowance * 60;
  const remainingSecondsTotal = totalAllowanceSeconds - totalUsedSeconds;
  
  const isOvertime = remainingSecondsTotal < 0;
  const absoluteRemainingSeconds = Math.abs(remainingSecondsTotal);
  const remainingMinutes = Math.floor(absoluteRemainingSeconds / 60);
  const remainingSecondsDisplay = absoluteRemainingSeconds % 60;

  const progress = Math.min(100, (totalUsedSeconds / totalAllowanceSeconds) * 100);

  // Sound and Notification Logic
  useEffect(() => {
    if (!isSessionActive) {
      setShowOvertimeWarning(false);
      return;
    }

    if (isOvertime) {
      setShowOvertimeWarning(true);
      
      // Play sound every minute, or more frequently as 5min approaches
      const overtimeSeconds = absoluteRemainingSeconds;
      const shouldPlaySound = overtimeSeconds % 60 === 0 || (overtimeSeconds > 240 && overtimeSeconds % 10 === 0);

      if (shouldPlaySound) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = overtimeSeconds > 300 ? 1 : 0.5;
        audio.play().catch(e => console.log('Audio play failed:', e));
      }

      // Browser notification at the very start of overtime
      if (overtimeSeconds === 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Time is Up!', {
          body: 'Your gaming session has ended. You have 5 minutes to finish before penalties apply!',
          icon: '/logo.png',
          requireInteraction: true
        });
      }
    }
  }, [absoluteRemainingSeconds, isSessionActive, isOvertime]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            Welcome, <span className="text-plaeen-green">{activeKid.displayName}</span>
          </h1>
          <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">Your Gaming Hub is Online</p>
        </motion.div>

        <div className="flex gap-4">
          <Button 
            onClick={() => setIsChoreModalOpen(true)}
            variant="outline"
            className="border-plaeen-purple/30 text-plaeen-purple hover:bg-plaeen-purple/10 font-bold uppercase tracking-widest px-8 py-6"
          >
            <Zap size={20} className="mr-2" /> Log Activity
          </Button>
          {!isSessionActive ? (
            <Button 
              onClick={handleStartSession}
              className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-12 py-6 shadow-[0_0_20px_rgba(118,233,0,0.4)] hover:scale-105 transition-transform"
            >
              <Gamepad2 size={20} className="mr-2" /> Start Playing
            </Button>
          ) : (
            <Button 
              onClick={handleEndSession}
              className="bg-red-500 text-white font-bold uppercase tracking-widest px-12 py-6 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-105 transition-transform"
            >
              <X size={20} className="mr-2" /> End Session
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest text-center"
        >
          {errorMessage}
        </motion.div>
      )}

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-12">
        {/* Left Column: Screen Time & Stats */}
        <div className="space-y-12">
          <Card className="bg-white/5 border-white/10 p-8 relative overflow-hidden group">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Clock size={18} className="text-plaeen-green" /> Screen Time
              </h2>
              <div className="flex bg-white/5 rounded-lg p-1">
                {(['daily', 'weekly', 'monthly'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setScreenTimeView(v)}
                    className={`px-3 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all ${
                      screenTimeView === v ? 'bg-plaeen-green text-black' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="relative inline-flex items-center justify-center">
                <svg className="h-48 w-48 -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-white/5"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={552.92}
                    initial={{ strokeDashoffset: 552.92 }}
                    animate={{ strokeDashoffset: 552.92 - (552.92 * progress) / 100 }}
                    className="text-plaeen-green"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.div 
                    key={remainingSecondsTotal}
                    initial={isSessionActive ? { scale: 1.1, opacity: 0.5 } : {}}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center"
                  >
                    <span className={cn(
                      "font-bold tracking-tighter leading-none transition-colors",
                      isSessionActive ? "text-4xl" : "text-5xl",
                      isOvertime ? "text-red-500" : "text-white"
                    )}>
                      {isSessionActive ? (
                        `${isOvertime ? '-' : ''}${remainingMinutes}:${remainingSecondsDisplay.toString().padStart(2, '0')}`
                      ) : (
                        remainingMinutes
                      )}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mt-1",
                      isOvertime ? "text-red-500/60" : "text-white/40"
                    )}>
                      {isOvertime ? 'Overtime' : isSessionActive ? 'Remaining' : 'Minutes Left'}
                    </span>
                  </motion.div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Used Today</p>
                <p className="text-xl font-bold text-white">{used}m</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Allowance</p>
                <p className="text-xl font-bold text-plaeen-green">{allowance}m</p>
              </div>
            </div>

            {activeKid.screenTime?.accumulatedTime && activeKid.screenTime.accumulatedTime > 0 && (
              <div className="mt-6 p-4 rounded-2xl bg-plaeen-purple/10 border border-plaeen-purple/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star size={16} className="text-plaeen-purple" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Bonus Time</span>
                </div>
                <span className="text-sm font-bold text-plaeen-purple">+{activeKid.screenTime.accumulatedTime}m</span>
              </div>
            )}
          </Card>

          <Card className="bg-plaeen-purple/10 border-plaeen-purple/20 p-8">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Trophy size={18} className="text-plaeen-purple" /> Achievements
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
                <div className="h-10 w-10 rounded-lg bg-plaeen-green/20 flex items-center justify-center">
                  <Zap size={20} className="text-plaeen-green" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-tight">Early Finisher</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">5 Sessions on time</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Middle Column: Activity & Sessions */}
        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
              <Calendar size={16} /> Upcoming Sessions
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {sessions.length > 0 ? (
                sessions.map(session => (
                  <Card key={session.id} className="bg-white/5 border-white/10 p-6 hover:border-plaeen-green/30 transition-all">
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Session Details</p>
                  </Card>
                ))
              ) : (
                <Card className="md:col-span-2 bg-white/5 border-dashed border-white/10 p-12 text-center">
                  <p className="text-white/20 font-bold uppercase tracking-widest">No sessions planned yet</p>
                  <Button variant="ghost" className="mt-4 text-plaeen-green text-[10px] font-bold uppercase tracking-widest">
                    Invite Friends to Play
                  </Button>
                </Card>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
              <Activity size={16} /> Recent Activity
            </h2>
            <Card className="bg-white/5 border-white/10 p-8">
              <div className="space-y-6">
                <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-plaeen-green/10 flex items-center justify-center">
                      <Gamepad2 size={20} className="text-plaeen-green" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">Minecraft Session</p>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Today • 45 Minutes</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest">Completed</span>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </div>

      {/* Chore Modal */}
      <AnimatePresence>
        {isChoreModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <Card className="w-full max-w-md bg-plaeen-dark border-plaeen-purple/30 p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">Log Activity</h2>
                <button onClick={() => setIsChoreModalOpen(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
              </div>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-8 leading-relaxed">
                Tell your parents what you've done to earn extra screen time!
              </p>
              
              {choreSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 text-center"
                >
                  <div className="h-20 w-20 rounded-full bg-plaeen-green/20 flex items-center justify-center mx-auto mb-6">
                    <Check size={40} className="text-plaeen-green" />
                  </div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-2">Activity Sent!</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Waiting for parent approval</p>
                </motion.div>
              ) : (
                <form onSubmit={handleAddChore} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-purple mb-2 block">What did you do?</label>
                    <input 
                      type="text"
                      value={choreTitle}
                      onChange={(e) => setChoreTitle(e.target.value)}
                      placeholder="E.G. DID THE DISHES, CLEANED ROOM"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/10 focus:border-plaeen-purple focus:outline-none transition-all uppercase tracking-widest text-sm"
                      required
                      disabled={isSubmittingChore}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSubmittingChore}
                    className="w-full py-6 bg-plaeen-purple hover:bg-plaeen-purple/80 text-white font-bold uppercase tracking-widest"
                  >
                    {isSubmittingChore ? 'Sending...' : 'Send for Approval'}
                  </Button>
                </form>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Overtime Warning Overlay */}
      <AnimatePresence>
        {showOvertimeWarning && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-6"
          >
            <Card className="bg-red-500 border-red-400 p-6 shadow-[0_0_50px_rgba(239,68,68,0.4)] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center animate-pulse">
                  <Bell size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white uppercase tracking-tight">Time is Up!</p>
                  <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest">
                    {remainingMinutes < 5 
                      ? `Finish in ${5 - remainingMinutes}m to avoid penalty` 
                      : "Penalty applied! End session now"}
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleEndSession}
                className="bg-white text-red-500 hover:bg-white/90 font-bold uppercase tracking-widest text-[10px] px-6"
              >
                End Now
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
