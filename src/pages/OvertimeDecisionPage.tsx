import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { db } from '@/firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, deleteDoc, increment, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { Clock, Shield, X, ArrowLeft, Zap, Bell, CheckCircle2 } from 'lucide-react';
import { format, isSameWeek, isSameMonth, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { useProfile } from '@/contexts/ProfileContext';

export const OvertimeDecisionPage = () => {
  const { approvalId } = useParams();
  const navigate = useNavigate();
  const { parentProfile } = useProfile();
  const [approval, setApproval] = useState<any>(null);
  const [kid, setKid] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deductionAmount, setDeductionAmount] = useState(0);
  const [deductionDate, setDeductionDate] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'));
  const [banDate, setBanDate] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'));
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!approvalId) return;

    // First, try to fetch the approval document directly
    const unsub = onSnapshot(doc(db, 'approvals', approvalId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setApproval({ id: snap.id, ...data });
        setDeductionAmount(data.data?.overtimeMinutes || 0);
        
        // Fetch kid data
        onSnapshot(doc(db, 'users', data.childId), (kidSnap) => {
          if (kidSnap.exists()) {
            setKid({ uid: kidSnap.id, ...kidSnap.data() });
          }
        }, (error) => {
          console.error('Firestore Error in kid listener (A):', error);
        });
      } else {
        // Fallback: If not found by ID, maybe the ID passed was a notificationId?
        // Try to find an approval that points to this notificationId
        const q = query(
          collection(db, 'approvals'), 
          where('notificationId', '==', approvalId),
          where('parentId', '==', parentProfile?.uid)
        );
        const qSnap = await getDocs(q);
        
        if (!qSnap.empty) {
          const d = qSnap.docs[0];
          const data = d.data();
          setApproval({ id: d.id, ...data });
          setDeductionAmount(data.data?.overtimeMinutes || 0);
          
          onSnapshot(doc(db, 'users', data.childId), (kidSnap) => {
            if (kidSnap.exists()) {
              setKid({ uid: kidSnap.id, ...kidSnap.data() });
            }
          }, (error) => {
            console.error('Firestore Error in kid listener (B):', error);
          });
        } else {
          // Truly not found
          console.error('Approval not found for ID:', approvalId);
          navigate('/parent-dashboard');
        }
      }
    }, async (error) => {
      // If we get a permission error, it might be because the document doesn't exist 
      // and the rules are strict. Try the fallback query immediately.
      console.warn('Approval listener failed, attempting fallback query...', error);
      
      const q = query(
        collection(db, 'approvals'), 
        where('notificationId', '==', approvalId),
        where('parentId', '==', parentProfile?.uid)
      );
      try {
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const d = qSnap.docs[0];
          const data = d.data();
          setApproval({ id: d.id, ...data });
          setDeductionAmount(data.data?.overtimeMinutes || 0);
          
          onSnapshot(doc(db, 'users', data.childId), (kidSnap) => {
            if (kidSnap.exists()) {
              setKid({ uid: kidSnap.id, ...kidSnap.data() });
            }
          });
        } else {
          console.error('Fallback query also failed or returned no results');
          navigate('/parent-dashboard');
        }
      } catch (fallbackErr) {
        console.error('Fallback query failed:', fallbackErr);
        navigate('/parent-dashboard');
      }
    });

    return () => unsub();
  }, [approvalId, navigate]);

  const handleDecision = async (action: 'forgive' | 'extract' | 'ban') => {
    if (!approval || !kid) return;
    setIsProcessing(true);

    try {
      const kidRef = doc(db, 'users', kid.uid);
      const decisionData: any = {
        type: 'overtime_decision',
        action,
        timestamp: serverTimestamp(),
        read: false
      };

      if (action === 'forgive') {
        // Calculate current daily allowance (including adjustments) to set usedToday to it
        const todayAdjSum = (kid.screenTime?.todayAdjustments || [])
          .reduce((acc: number, adj: any) => acc + (adj.type === 'reward' ? adj.minutes : -adj.minutes), 0);
        const currentAllowance = (kid.screenTime?.dailyAllowance || 60) + todayAdjSum;
        
        await updateDoc(kidRef, { 'screenTime.usedToday': currentAllowance });
        decisionData.message = "Your overtime was forgiven! No penalty applied.";
      } else if (action === 'extract') {
        const amount = deductionAmount || approval.data.overtimeMinutes;
        const newDeduction = { 
          date: deductionDate, 
          minutes: amount,
          id: Math.random().toString(36).substr(2, 9)
        };
        const currentDeductions = kid.screenTime?.scheduledDeductions || [];
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        const updates: any = {
          'screenTime.scheduledDeductions': [...currentDeductions, newDeduction]
        };

        // Update weekly and monthly adjustments if the date falls in the current period
        const firstDayOfWeekIndex = parentProfile?.firstDayOfWeek === 'Sun' ? 0 : 1;
        const deductionDateObj = parseISO(deductionDate);
        const now = new Date();
        const isThisWeek = isSameWeek(deductionDateObj, now, { weekStartsOn: firstDayOfWeekIndex });
        const isThisMonth = isSameMonth(deductionDateObj, now);

        if (isThisWeek) updates['screenTime.weeklyAdjustments'] = increment(-amount);
        if (isThisMonth) updates['screenTime.monthlyAdjustments'] = increment(-amount);

        // If deduction is for today, also add to todayAdjustments for immediate feedback
        if (deductionDate === todayStr) {
          updates['screenTime.todayAdjustments'] = arrayUnion({
            id: newDeduction.id,
            type: 'penalty',
            minutes: amount,
            reason: 'Overtime Penalty',
            timestamp: new Date().toISOString()
          });
          // Do NOT increment usedToday anymore, as we now subtract from allowance calculation
        }

        await updateDoc(kidRef, updates);
        decisionData.message = `${amount} minutes will be deducted on ${format(new Date(deductionDate), 'MMM do')}.`;
        decisionData.minutes = amount;
        decisionData.date = deductionDate;
      } else if (action === 'ban') {
        const currentBanned = kid.screenTime?.bannedDates || [];
        if (!currentBanned.includes(banDate)) {
          await updateDoc(kidRef, { 
            'screenTime.bannedDates': [...currentBanned, banDate] 
          });
        }
        decisionData.message = `Access restricted for ${format(new Date(banDate), 'MMM do')}.`;
        decisionData.date = banDate;
      }

      // Notify kid
      await addDoc(collection(db, 'notifications'), {
        userId: kid.uid,
        ...decisionData
      });

      // Update the original notification for the parent
      // We try multiple ways to find the correct notification to mark as handled
      const updatePayload = {
        handled: true,
        read: true,
        decision: {
          action,
          timestamp: new Date(),
          message: decisionData.message,
          date: decisionData.date || null
        }
      };

      let notifUpdated = false;

      // Path A: Use the notificationId stored in the approval
      if (approval.notificationId) {
        try {
          await updateDoc(doc(db, 'notifications', approval.notificationId), updatePayload);
          notifUpdated = true;
        } catch (e) {
          console.warn('Failed to update notification by notificationId', e);
        }
      }

      // Path B: If we were passed a notificationId as the URL param, update it directly
      if (!notifUpdated && approvalId && parentProfile) {
        try {
          const notifSnap = await getDocs(query(
            collection(db, 'notifications'), 
            where('__name__', '==', approvalId),
            where('userId', '==', parentProfile.uid)
          ));
          if (!notifSnap.empty) {
            await updateDoc(doc(db, 'notifications', approvalId), updatePayload);
            notifUpdated = true;
          }
        } catch (e) {
          // Ignore, might not be a notification ID
        }
      }

      // Path C: Fallback query by approvalId field in notifications
      if (!notifUpdated && parentProfile) {
        const parentNotifQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', parentProfile.uid),
          where('approvalId', '==', approval.id)
        );
        const parentNotifSnap = await getDocs(parentNotifQuery);
        if (!parentNotifSnap.empty) {
          await updateDoc(doc(db, 'notifications', parentNotifSnap.docs[0].id), updatePayload);
          notifUpdated = true;
        }
      }

      // Mark approval as handled (or delete it)
      await deleteDoc(doc(db, 'approvals', approval.id));
      
      setSuccess(true);
      setTimeout(() => navigate(`/parent/child/${kid.uid}`), 2000);
    } catch (err) {
      console.error('Error handling decision:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!approval || !kid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-plaeen-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-plaeen-green"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-plaeen-dark p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 bg-plaeen-green/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} className="text-plaeen-green" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">Decision Applied</h1>
          <p className="text-white/40">Redirecting you back to management...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-plaeen-dark p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Back</span>
          </button>
          <div className="text-right">
            <h1 className="text-2xl md:text-4xl font-display font-bold text-white uppercase tracking-tight">Overtime Decision</h1>
            <p className="text-plaeen-green text-[10px] font-bold uppercase tracking-[0.3em]">Action Required for {kid.displayName}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats Card */}
          <Card className="lg:col-span-1 bg-red-500/5 border-red-500/20 p-8 flex flex-col justify-center items-center text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
              <Clock size={32} className="text-red-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">Overtime Amount</p>
              <h2 className="text-6xl font-display font-bold text-white">{approval.data.overtimeMinutes}m</h2>
              <p className="text-white/40 text-xs mt-2">Exceeded daily allowance</p>
            </div>
          </Card>

          {/* Options Grid */}
          <div className="lg:col-span-2 space-y-6">
            {/* Forgive */}
            <Card className="bg-white/5 border-white/10 p-6 hover:border-plaeen-green/30 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-plaeen-green">
                    <Zap size={18} />
                    <h3 className="text-sm font-bold uppercase tracking-widest">Forgive Overtime</h3>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed max-w-md">
                    Resets today's remaining time to 0 without any further penalty. The overtime minutes won't be deducted from any pot.
                  </p>
                </div>
                <Button 
                  onClick={() => handleDecision('forgive')}
                  disabled={isProcessing}
                  className="bg-plaeen-green text-black hover:bg-plaeen-green/90 font-bold uppercase tracking-widest text-[10px] py-6 px-8"
                >
                  Forgive & Reset
                </Button>
              </div>
            </Card>

            {/* Extract */}
            <Card className="bg-white/5 border-white/10 p-6 hover:border-blue-500/30 transition-all">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-blue-400">
                  <Clock size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Extract Minutes</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Minutes to Deduct</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={deductionAmount}
                        onChange={(e) => setDeductionAmount(parseInt(e.target.value) || 0)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-2xl font-bold text-white focus:outline-none focus:border-blue-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/20 uppercase">min</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Select Date</label>
                    <input 
                      type="date"
                      value={deductionDate}
                      onChange={(e) => setDeductionDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <Button 
                  onClick={() => handleDecision('extract')}
                  disabled={isProcessing}
                  className="w-full bg-blue-500 text-white hover:bg-blue-600 font-bold uppercase tracking-widest text-[10px] py-6"
                >
                  Apply Deduction
                </Button>
              </div>
            </Card>

            {/* Ban */}
            <Card className="bg-white/5 border-white/10 p-6 hover:border-red-500/30 transition-all">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-red-500">
                  <Shield size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Ban the Day</h3>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Select Date to Ban</label>
                  <div className="flex gap-4">
                    <input 
                      type="date"
                      value={banDate}
                      onChange={(e) => setBanDate(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm font-bold text-white focus:outline-none focus:border-red-500/50"
                    />
                    <Button 
                      onClick={() => handleDecision('ban')}
                      disabled={isProcessing}
                      className="bg-red-500 text-white hover:bg-red-600 font-bold uppercase tracking-widest text-[10px] px-8"
                    >
                      Ban Date
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Dismiss */}
        <div className="pt-12 border-t border-white/5 flex justify-center">
          <button 
            onClick={async () => {
              if (window.confirm('Are you sure you want to dismiss this alert without taking any action?')) {
                await deleteDoc(doc(db, 'approvals', approval.id));
                navigate(`/parent/child/${kid.uid}`);
              }
            }}
            className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] hover:text-white transition-colors"
          >
            Dismiss Alert Without Action
          </button>
        </div>
      </div>
    </div>
  );
};
