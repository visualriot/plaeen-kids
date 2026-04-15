import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { auth, db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, Timestamp, addDoc, serverTimestamp, orderBy, limit, writeBatch } from 'firebase/firestore';
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
  const [hasPlayed5MinWarning, setHasPlayed5MinWarning] = useState(false);
  const [hasPlayed0MinWarning, setHasPlayed0MinWarning] = useState(false);
  const [lastOvertimeSoundMinute, setLastOvertimeSoundMinute] = useState(-1);
  const [isChoreModalOpen, setIsChoreModalOpen] = useState(false);
  const [choreTitle, setChoreTitle] = useState('');
  const [isSubmittingChore, setIsSubmittingChore] = useState(false);
  const [choreSuccess, setChoreSuccess] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
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
    const isParent = parentProfile?.role === 'parent';
    const q = isParent 
      ? query(collection(db, 'groups'), where('parentIds', 'array-contains', user.uid))
      : query(collection(db, 'groups'), where('members', 'array-contains', activeKid.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSessions: any[] = [];
      const relevantDocs = isParent 
        ? snapshot.docs.filter(doc => doc.data().members?.includes(activeKid.uid))
        : snapshot.docs;

      relevantDocs.forEach(groupDoc => {
        const groupData = groupDoc.data();
        // This is a simplified fetch, ideally sessions are in a subcollection or separate collection
        // For now, let's assume we fetch from a 'sessions' collection where groupId is in kid's groups
      });
    }, (error) => {
      console.error("Group listener error:", error);
    });

    return () => unsubscribe();
  }, [user, activeKid]);

  // Fetch notifications
  useEffect(() => {
    if (!user || !activeKid) return;

    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', activeKid.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Notification listener error:", error);
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

    // Check for banned dates
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const bannedDates = activeKid.screenTime?.bannedDates || [];
    if (bannedDates.includes(todayStr)) {
      setErrorMessage("Your access is restricted for today by your guardian.");
      return;
    }

    const usedToday = activeKid.screenTime?.usedToday || 0;
    const todayAdjSum = (activeKid.screenTime?.todayAdjustments || [])
      .reduce((acc: number, adj: any) => acc + (adj.type === 'reward' ? adj.minutes : -adj.minutes), 0);
    const allowanceTodayTotal = (activeKid.screenTime?.dailyAllowance || 0) + todayAdjSum;
    
    if (usedToday >= allowanceTodayTotal) {
      setErrorMessage('You have no screen time left today!');
      return;
    }

    const now = Date.now();
    setIsSessionActive(true);
    setSessionStartTime(now);
    setCurrentTime(now);
    setElapsedMinutes(0);
    setErrorMessage(null);
    setHasPlayed5MinWarning(false);
    setHasPlayed0MinWarning(false);
    setLastOvertimeSoundMinute(-1);

    // Update user document for live status
    await updateDoc(doc(db, 'users', activeKid.uid), {
      'screenTime.isSessionActive': true,
      'screenTime.sessionStartTime': now
    });

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

  const handleTeamInvite = async (notification: any, accept: boolean) => {
    if (!activeKid) return;
    try {
      const groupRef = doc(db, 'groups', notification.data.groupId);
      if (accept) {
        await updateDoc(groupRef, {
          members: arrayUnion(activeKid.uid),
          pendingMembers: arrayRemove(activeKid.uid)
        });
      } else {
        await updateDoc(groupRef, {
          pendingMembers: arrayRemove(activeKid.uid)
        });
      }
      // Mark notification as read
      await updateDoc(doc(db, 'notifications', notification.id), { read: true });
    } catch (err) {
      console.error('Error handling team invite:', err);
    }
  };

  const handleEndSession = async () => {
    if (!activeKid || !sessionStartTime) return;

    const endTime = Date.now();
    const durationMs = endTime - sessionStartTime;
    const durationMin = Math.ceil(durationMs / 60000); // Use ceil to be conservative with time
    
    // Get latest data from activeKid
    const currentAllowance = activeKid.screenTime?.dailyAllowance || 0;
    const currentUsed = activeKid.screenTime?.usedToday || 0;
    const remainingAtStart = Math.max(0, currentAllowance - currentUsed);
    
    // Calculate overtime
    const overtimeMin = Math.max(0, durationMin - remainingAtStart);

    try {
      const userRef = doc(db, 'users', activeKid.uid);
      let finalUsedToday = currentUsed + durationMin;
      let finalUsedWeekly = (activeKid.screenTime?.usedWeekly || 0) + durationMin;
      let finalUsedMonthly = (activeKid.screenTime?.usedMonthly || 0) + durationMin;

      // Rule: Overtime should not affect allowance until guardian decides
      // So we cap the usage at the allowance for now.
      if (overtimeMin > 0) {
        finalUsedToday = currentAllowance;
        finalUsedWeekly = (activeKid.screenTime?.usedWeekly || 0) + remainingAtStart;
        finalUsedMonthly = (activeKid.screenTime?.usedMonthly || 0) + remainingAtStart;
      }

      const updates: any = {
        'screenTime.usedToday': finalUsedToday,
        'screenTime.usedWeekly': finalUsedWeekly,
        'screenTime.usedMonthly': finalUsedMonthly,
        'screenTime.lastReset': serverTimestamp(),
        'screenTime.isSessionActive': false,
        'screenTime.sessionStartTime': null
      };

      await updateDoc(userRef, updates);

      // Save start time before clearing state
      const startTimeVal = sessionStartTime;

      setIsSessionActive(false);
      setSessionStartTime(null);
      setShowOvertimeWarning(false);

      if (activeKid.parentId && startTimeVal) {
        if (overtimeMin > 1) {
          // Use a batch to create both with cross-references
          const notifRef = doc(collection(db, 'notifications'));
          const approvalRef = doc(collection(db, 'approvals'));
          const batch = writeBatch(db);

          batch.set(notifRef, {
            userId: activeKid.parentId,
            type: 'time_warning',
            childId: activeKid.uid,
            childName: activeKid.displayName,
            title: 'Overtime Alert',
            message: `${activeKid.displayName} finished their session. (Overtime: ${overtimeMin}m - Action Required)`,
            duration: durationMin,
            overtime: overtimeMin,
            createdAt: serverTimestamp(),
            read: false,
            rewardEligible: false,
            handled: false,
            approvalId: approvalRef.id
          });

          batch.set(approvalRef, {
            parentId: activeKid.parentId,
            childId: activeKid.uid,
            childName: activeKid.displayName,
            type: 'overtime',
            title: `Overtime: ${overtimeMin}m`,
            status: 'pending',
            notificationId: notifRef.id,
            data: {
              overtimeMinutes: overtimeMin,
              sessionDuration: durationMin,
              allowanceAtStart: currentAllowance,
              usedAtStart: currentUsed
            },
            createdAt: serverTimestamp()
          });

          await batch.commit();
        } else {
          await addDoc(collection(db, 'notifications'), {
            userId: activeKid.parentId,
            type: 'session_end',
            childId: activeKid.uid,
            childName: activeKid.displayName,
            title: 'Session Ended',
            message: `${activeKid.displayName} finished their session.${overtimeMin > 0 ? ' (Within grace period)' : ''}`,
            duration: durationMin,
            overtime: overtimeMin,
            createdAt: serverTimestamp(),
            read: false,
            rewardEligible: overtimeMin === 0
          });
        }

        // Add to session history
        await addDoc(collection(db, 'sessions'), {
          childId: activeKid.uid,
          parentId: activeKid.parentId,
          startTime: new Timestamp(Math.floor(startTimeVal / 1000), 0),
          endTime: serverTimestamp(),
          duration: durationMin,
          overtime: overtimeMin,
          status: overtimeMin > 1 ? 'overtime_pending' : 'completed'
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
  
  const restrictedDays = (activeKid.screenTime as any)?.restrictedDays || [];
  const dailyAllowance = activeKid.screenTime?.dailyAllowance || 0;
  const todayAdjSum = (activeKid.screenTime?.todayAdjustments || [])
    .reduce((acc: number, adj: any) => acc + (adj.type === 'reward' ? adj.minutes : -adj.minutes), 0);
  
  const dailyAllowanceTotal = dailyAllowance + todayAdjSum;

  // Calculate Synced Allowances
  const weeklyAllowance = (dailyAllowance * (7 - restrictedDays.length)) + (activeKid.screenTime?.weeklyAdjustments || 0);
  
  // Monthly calculation: non-restricted days in current month
  const getMonthlyAllowance = () => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let total = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const dayName = format(new Date(now.getFullYear(), now.getMonth(), i), 'EEE');
      if (!restrictedDays.includes(dayName)) total += dailyAllowance;
    }
    return total + (activeKid.screenTime?.monthlyAdjustments || 0);
  };

  const allowance = screenTimeView === 'daily' ? dailyAllowanceTotal : 
                    screenTimeView === 'weekly' ? weeklyAllowance : 
                    getMonthlyAllowance();

  // Calculate precise remaining time
  const usedInSessionSeconds = isSessionActive && sessionStartTime ? Math.max(0, Math.floor((currentTime - sessionStartTime) / 1000)) : 0;
  const totalUsedSeconds = (used * 60) + usedInSessionSeconds;
  const totalAllowanceSeconds = allowance * 60;
  const remainingSecondsTotal = totalAllowanceSeconds - totalUsedSeconds;
  
  const isOvertime = remainingSecondsTotal < 0;
  const isTimeUp = remainingSecondsTotal <= 0;
  const absoluteRemainingSeconds = Math.abs(remainingSecondsTotal);
  const remainingMinutes = Math.floor(absoluteRemainingSeconds / 60);
  const remainingSecondsDisplay = absoluteRemainingSeconds % 60;

  const progress = Math.min(100, (totalUsedSeconds / totalAllowanceSeconds) * 100);

  // Reset Logic
  useEffect(() => {
    if (!activeKid || !user) return;

    const checkAndReset = async () => {
      const now = new Date();
      const lastReset = activeKid.screenTime?.lastReset?.toDate() || new Date(0);
      const updates: any = {};

      // Daily Reset
      if (format(now, 'yyyy-MM-dd') !== format(lastReset, 'yyyy-MM-dd')) {
        updates['screenTime.usedToday'] = 0;
        updates['screenTime.todayAdjustments'] = [];
        
        const todayStr = format(now, 'yyyy-MM-dd');
        const deductions = activeKid.screenTime?.scheduledDeductions || [];
        
        // Clean up old deductions (older than today)
        const activeDeductions = deductions.filter(d => d.date >= todayStr);
        if (activeDeductions.length !== deductions.length) {
          updates['screenTime.scheduledDeductions'] = activeDeductions;
        }

        // Apply scheduled deductions for today
        const todayDeductions = deductions.filter(d => d.date === todayStr);
        
        if (todayDeductions.length > 0) {
          const totalDeduction = todayDeductions.reduce((acc, d) => acc + d.minutes, 0);
          updates['screenTime.usedToday'] = totalDeduction;
          updates['screenTime.todayAdjustments'] = todayDeductions.map(d => ({
            id: d.id || Math.random().toString(36).substr(2, 9),
            type: 'penalty',
            minutes: d.minutes,
            reason: 'Scheduled Penalty',
            timestamp: new Date().toISOString()
          }));
        }

        // Clean up old banned dates
        const bannedDates = activeKid.screenTime?.bannedDates || [];
        const activeBanned = bannedDates.filter(d => d >= todayStr);
        if (activeBanned.length !== bannedDates.length) {
          updates['screenTime.bannedDates'] = activeBanned;
        }
        
        updates['screenTime.lastReset'] = serverTimestamp();
      }

      // Weekly Reset
      const firstDay = parentProfile?.firstDayOfWeek || 'Mon';
      const currentDay = format(now, 'EEE');
      
      // If today is the first day of week and we haven't reset this week yet
      const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
      if (currentDay === firstDay && (daysSinceReset >= 1 || format(now, 'yyyy-ww') !== format(lastReset, 'yyyy-ww'))) {
        updates['screenTime.usedWeekly'] = 0;
        updates['screenTime.weeklyAdjustments'] = 0;
      }

      // Monthly Reset
      if (now.getDate() === 1 && now.getMonth() !== lastReset.getMonth()) {
        updates['screenTime.usedMonthly'] = 0;
        updates['screenTime.monthlyAdjustments'] = 0;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', activeKid.uid), updates);
      }
    };

    checkAndReset();
  }, [activeKid?.uid, parentProfile?.firstDayOfWeek]);

  // Sound and Notification Logic
  useEffect(() => {
    if (!isSessionActive) {
      setShowOvertimeWarning(false);
      return;
    }

    // 5 Minute Warning
    if (!isOvertime && remainingMinutes === 5 && remainingSecondsDisplay === 0 && !hasPlayed5MinWarning) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      audio.play().catch(e => console.log('Audio play failed:', e));
      setHasPlayed5MinWarning(true);
    }

    // 0 Minute Warning (System Notification + Longer Sound)
    // Fix: Trigger exactly when remainingSecondsTotal hits 0
    if (remainingSecondsTotal === 0 && !hasPlayed0MinWarning) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Audio play failed:', e));
      setHasPlayed0MinWarning(true);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Time is Up!', {
          body: 'Your gaming session has ended. Please end your session now!',
          icon: '/logo.png',
          requireInteraction: true
        });
      }
    }

    // Overtime Recurring Sound (Every minute)
    if (isOvertime && remainingMinutes > 0 && remainingMinutes !== lastOvertimeSoundMinute && remainingSecondsDisplay === 0) {
      // Use a more urgent "hurry up" sound
      // If >= 5 minutes overtime, use a longer "buzz" sound
      const soundUrl = remainingMinutes >= 5 
        ? 'https://assets.mixkit.co/active_storage/sfx/1003/1003-preview.mp3' // Buzz/Alarm
        : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'; // Urgent beep
      
      const audio = new Audio(soundUrl);
      audio.play().catch(e => console.log('Audio play failed:', e));
      setLastOvertimeSoundMinute(remainingMinutes);
    }

    if (isOvertime && !showOvertimeWarning) {
      setShowOvertimeWarning(true);
    } else if (!isOvertime && showOvertimeWarning) {
      setShowOvertimeWarning(false);
    }
  }, [absoluteRemainingSeconds, isSessionActive, isOvertime, hasPlayed5MinWarning, hasPlayed0MinWarning, lastOvertimeSoundMinute, remainingMinutes, remainingSecondsDisplay, remainingSecondsTotal, showOvertimeWarning]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-6 py-12 relative z-0">
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
              onClick={() => {
                const today = format(new Date(), 'EEE');
                const restrictedDays = (activeKid.screenTime as any)?.restrictedDays || [];
                const usedToday = activeKid.screenTime?.usedToday || 0;
                const todayAdjSum = (activeKid.screenTime?.todayAdjustments || [])
                  .reduce((acc: number, adj: any) => acc + (adj.type === 'reward' ? adj.minutes : -adj.minutes), 0);
                const allowanceTodayTotal = (activeKid.screenTime?.dailyAllowance || 0) + todayAdjSum;

                if (restrictedDays.includes(today)) {
                  setErrorMessage("Today is a restricted day. No gaming sessions allowed!");
                  return;
                }
                if (usedToday >= allowanceTodayTotal) {
                  setErrorMessage('You have no screen time left today!');
                  return;
                }
                handleStartSession();
              }}
              disabled={restrictedDays.includes(format(new Date(), 'EEE')) || (activeKid.screenTime?.usedToday || 0) >= dailyAllowanceTotal}
              className={cn(
                "font-bold uppercase tracking-widest px-12 py-6 transition-transform",
                restrictedDays.includes(format(new Date(), 'EEE')) || (activeKid.screenTime?.usedToday || 0) >= dailyAllowanceTotal
                  ? "bg-white/5 text-white/20 cursor-not-allowed"
                  : "bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.4)] hover:scale-105"
              )}
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
                    className={cn(
                      "transition-colors duration-500",
                      isOvertime ? "text-red-500" : 
                      isTimeUp && !isSessionActive ? "text-white/10" :
                      remainingMinutes <= 5 ? "text-yellow-500" : 
                      "text-plaeen-green"
                    )}
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
                      isOvertime ? "text-red-500" : 
                      isTimeUp && !isSessionActive ? "text-white/20" : "text-white"
                    )}>
                      {isSessionActive ? (
                        `${isOvertime ? '-' : ''}${remainingMinutes}:${remainingSecondsDisplay.toString().padStart(2, '0')}`
                      ) : (
                        `${isOvertime ? '-' : ''}${remainingMinutes}`
                      )}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mt-1",
                      isOvertime ? "text-red-500/60" : 
                      isTimeUp && !isSessionActive ? "text-white/10" : "text-white/40"
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

            {/* Today's Adjustments Feedback */}
            {(() => {
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              const adjustments = [...(activeKid.screenTime?.todayAdjustments || [])];
              
              // Add scheduled deductions for today that aren't already in adjustments (for legacy support)
              const scheduledToday = (activeKid.screenTime?.scheduledDeductions || [])
                .filter(d => d.date === todayStr)
                .filter(d => !adjustments.some(a => a.id === d.id));
              
              scheduledToday.forEach(d => {
                adjustments.push({
                  id: d.id,
                  type: 'penalty',
                  minutes: d.minutes,
                  reason: 'Scheduled Penalty',
                  timestamp: new Date().toISOString()
                });
              });

              if (adjustments.length === 0) return null;

              return (
                <div className="mt-6 space-y-3">
                  {adjustments.map((adj, idx) => (
                    <motion.div
                      key={adj.id || idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-4 rounded-2xl border-2 flex items-center justify-between shadow-lg",
                        adj.type === 'penalty' 
                          ? "bg-red-500/10 border-red-500/20 text-red-500" 
                          : "bg-plaeen-green/10 border-plaeen-green/20 text-plaeen-green"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center",
                          adj.type === 'penalty' ? "bg-red-500/20" : "bg-plaeen-green/20"
                        )}>
                          {adj.type === 'penalty' ? <Clock size={16} /> : <Zap size={16} />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1">
                            {adj.minutes}m {adj.type} applied today
                          </p>
                          <p className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-60">
                            {adj.reason}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-black tracking-tighter">
                        {adj.type === 'penalty' ? '-' : '+'}{adj.minutes}m
                      </div>
                    </motion.div>
                  ))}
                </div>
              );
            })()}

            {Boolean(activeKid.screenTime?.accumulatedTime && activeKid.screenTime.accumulatedTime > 0) && (
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
              <Bell size={16} /> Notifications
            </h2>
            <div className="space-y-4">
              {notifications.map(notif => (
                <Card key={notif.id} className={cn(
                  "bg-white/5 border-white/10 p-4 transition-all",
                  !notif.read && "border-l-2 border-l-plaeen-green bg-plaeen-green/5"
                )}>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        notif.type === 'decision' ? "bg-plaeen-purple/10 text-plaeen-purple" : 
                        notif.type === 'team_invite' ? "bg-plaeen-green/10 text-plaeen-green" :
                        "bg-plaeen-green/10 text-plaeen-green"
                      )}>
                        {notif.type === 'decision' ? <Shield size={20} /> : 
                         notif.type === 'team_invite' ? <Users size={20} /> :
                         <Bell size={20} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white uppercase tracking-tight">{notif.title || 'Notification'}</p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{notif.message}</p>
                      </div>
                    </div>
                    
                    {notif.type === 'team_invite' && !notif.read && (
                      <div className="flex gap-2 pl-14">
                        <Button 
                          size="sm" 
                          onClick={() => handleTeamInvite(notif, true)}
                          className="bg-plaeen-green text-black text-[8px] font-bold uppercase tracking-widest px-4 py-2"
                        >
                          Accept
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleTeamInvite(notif, false)}
                          className="border-white/10 text-white/40 text-[8px] font-bold uppercase tracking-widest px-4 py-2"
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              {notifications.length === 0 && (
                <Card className="bg-white/5 border-dashed border-white/10 p-8 text-center">
                  <p className="text-white/20 font-bold uppercase tracking-widest">No new notifications</p>
                </Card>
              )}
            </div>
          </section>

          {( (activeKid.screenTime?.scheduledDeductions?.length || 0) > 0 || (activeKid.screenTime?.bannedDates?.length || 0) > 0 ) && (
            <section className="space-y-6">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-500 flex items-center gap-3">
                <Shield size={16} /> Active Penalties
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {activeKid.screenTime?.scheduledDeductions?.map((deduction, idx) => (
                  <Card key={`deduction-${idx}`} className="bg-red-500/5 border-red-500/20 p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <Clock size={20} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">-{deduction.minutes} Minutes</p>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Scheduled for {format(new Date(deduction.date + 'T12:00:00'), 'MMM d')}</p>
                    </div>
                  </Card>
                ))}
                {activeKid.screenTime?.bannedDates?.map((date, idx) => (
                  <Card key={`ban-${idx}`} className="bg-red-500/5 border-red-500/20 p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <Lock size={20} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">Access Restricted</p>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">On {format(new Date(date + 'T12:00:00'), 'MMM d')}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

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

      </div>

      {/* Chore Modal */}
      <AnimatePresence>
        {isChoreModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <div className="w-full max-w-md bg-plaeen-dark border border-plaeen-purple/30 p-10 rounded-2xl shadow-2xl">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overtime Warning Overlay */}
      <AnimatePresence>
        {showOvertimeWarning && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6 pointer-events-none"
          >
            <div className="bg-red-600 rounded-2xl p-6 shadow-2xl flex items-center justify-between pointer-events-auto relative overflow-hidden border border-red-500/50">
              {/* Solid background to prevent backdrop-blur artifacts from elements behind */}
              <div className="absolute inset-0 bg-red-600" />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
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
                className="bg-white text-red-600 hover:bg-white/90 font-bold uppercase tracking-widest text-[10px] px-6 relative z-10"
              >
                End Now
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
