import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { auth, db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Check, X, Bell, UserPlus, Gamepad2, Clock, Users, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { cn, formatName, safeToDate } from '@/lib/utils';
import { handleFirestoreError } from '@/lib/firestoreUtils';

interface ApprovalRequest {
  id: string;
  childId: string;
  childName: string;
  type: 'game' | 'time' | 'team' | 'overtime' | 'activity';
  status: 'pending' | 'approved' | 'denied';
  data: any;
  createdAt: any;
  title?: string;
}

export const ApprovalsPage = () => {
  const [user] = useAuthState(auth);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [penalties, setPenalties] = useState<{[key: string]: number}>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'approvals'), where('parentId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setApprovals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRequest)));
    }, (error) => handleFirestoreError(error, 'list', 'approvals'));

    return () => unsubscribe();
  }, [user]);

  const handleAction = async (request: ApprovalRequest, status: 'approved' | 'denied') => {
    try {
      await updateDoc(doc(db, 'approvals', request.id), { status });

      if (status === 'approved') {
        if (request.type === 'game') {
          await updateDoc(doc(db, 'users', request.childId), {
            allowedGames: arrayUnion(request.data.gameId)
          });
        } else if (request.type === 'time') {
          const kidDoc = await getDoc(doc(db, 'users', request.childId));
          const currentAllowance = kidDoc.data()?.screenTime?.dailyAllowance || 60;
          await updateDoc(doc(db, 'users', request.childId), {
            'screenTime.dailyAllowance': currentAllowance + (request.data.requestedMinutes || request.data.minutes || 30)
          });
          
          // If it was for a specific session, we might want to update that session too,
          // but just increasing the allowance is enough for the kid to then "Accept" the session.
        }
      } else if (status === 'denied' && request.type === 'overtime') {
        // Punishment logic
        const penalty = penalties[request.id] || request.data.overtimeMinutes || 0;
        const kidDoc = await getDoc(doc(db, 'users', request.childId));
        const currentAccumulated = kidDoc.data()?.screenTime?.accumulatedTime || 0;
        
        await updateDoc(doc(db, 'users', request.childId), {
          'screenTime.accumulatedTime': currentAccumulated - penalty
        });

        // Update notification to kid about punishment
        await addDoc(collection(db, 'notifications'), {
          userId: request.childId,
          parentId: user.uid,
          type: 'penalty',
          title: 'Overtime Penalty',
          message: `A penalty of ${penalty} minutes has been deducted from your screen time for overtime.`,
          createdAt: serverTimestamp(),
          read: false
        });
      }

      // Send notification to kid for other types
      if (request.type !== 'overtime') {
        await addDoc(collection(db, 'notifications'), {
          userId: request.childId,
          parentId: user.uid,
          type: 'approval_status',
          title: `Request ${status}`,
          message: `Your request for ${request.type === 'game' ? request.data.gameName : request.type} has been ${status}.`,
          createdAt: serverTimestamp(),
          read: false,
          status: status,
          requestType: request.type
        });
      } else if (status === 'approved') {
        await addDoc(collection(db, 'notifications'), {
          userId: request.childId,
          parentId: user.uid,
          type: 'approval_status',
          title: 'Overtime Forgiven',
          message: 'Your parent has forgiven your overtime session. No penalty applied!',
          createdAt: serverTimestamp(),
          read: false,
          status: 'approved'
        });
      }
    } catch (err) {
      console.error('Error processing approval:', err);
    }
  };

  const pending = approvals.filter(a => a.status === 'pending');
  const history = approvals.filter(a => a.status !== 'pending').sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <button 
        onClick={() => navigate('/parent-dashboard')}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green font-bold uppercase tracking-widest text-[10px] mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Guardian Hub
      </button>

      <div className="mb-12">
        <h1 className="text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
          Approval <span className="text-plaeen-green">Queue</span>
        </h1>
        <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">Review and Authorize Requests</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Pending Requests */}
        <div className="lg:col-span-2 space-y-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
            <Bell size={16} /> Pending Action ({pending.length})
          </h2>
          
          <div className="grid gap-6">
            {pending.map(req => (
              <Card key={req.id} className="bg-white/5 border-white/10 p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                  <div className="flex gap-6">
                    <div className="h-16 w-16 rounded-2xl bg-plaeen-green/10 flex items-center justify-center text-plaeen-green border border-plaeen-green/20">
                      {req.type === 'friend' ? <UserPlus size={32} /> : 
                       req.type === 'game' ? <Gamepad2 size={32} /> :
                       req.type === 'time' ? <Clock size={32} /> : 
                       req.type === 'overtime' ? <AlertTriangle size={32} /> : <Users size={32} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest">{req.childName}</span>
                        <span className="text-[8px] text-white/20 uppercase tracking-widest">• {format(safeToDate(req.createdAt), 'MMM d, HH:mm')}</span>
                      </div>
                      <h3 className="text-2xl font-bold text-white uppercase tracking-tight mb-2">
                        {req.type === 'friend' ? `Friend Request: ${req.data.friendName}` : 
                         req.type === 'game' ? `Access to ${req.data.gameName}` :
                         req.type === 'time' ? `Extra Time: +${req.data.minutes}m` : 
                         req.type === 'overtime' ? `Overtime Alert: ${req.data.overtimeMinutes}m` :
                         req.type === 'activity' ? `Activity: ${req.title}` : `Join Team: ${req.data.teamName}`}
                      </h3>
                      
                      {req.type === 'overtime' && (
                        <div className="mt-4 space-y-4">
                          <p className="text-xs text-white/40 font-medium">
                            {req.childName} exceeded their allowance by {req.data.overtimeMinutes} minutes. 
                            Total session duration: {req.data.sessionDuration}m.
                          </p>
                          <div className="flex items-center gap-4">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/20">Penalty (Min):</label>
                            <input 
                              type="number"
                              value={penalties[req.id] ?? req.data.overtimeMinutes}
                              onChange={(e) => setPenalties(prev => ({...prev, [req.id]: parseInt(e.target.value) || 0}))}
                              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs font-bold text-white focus:outline-none focus:border-plaeen-green/50"
                            />
                          </div>
                        </div>
                      )}
                      
                      {req.type === 'game' && req.data.image && (
                        <div className="mt-6 flex flex-col md:flex-row gap-6 bg-white/5 rounded-2xl p-6 border border-white/5">
                          <img 
                            src={req.data.image} 
                            alt={req.data.gameName} 
                            className="h-32 w-48 object-cover rounded-xl shadow-2xl"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-3">
                              <span className="px-3 py-1 rounded-full bg-plaeen-green/10 border border-plaeen-green/20 text-plaeen-green text-[8px] font-bold uppercase tracking-widest">
                                {req.data.rating ? `Metascore: ${req.data.rating}%` : 'Rating: N/A'}
                              </span>
                              {req.data.esrbRating && (
                                <span className="px-3 py-1 rounded-full bg-plaeen-purple/10 border border-plaeen-purple/20 text-plaeen-purple text-[8px] font-bold uppercase tracking-widest">
                                  ESRB: {req.data.esrbRating}
                                </span>
                              )}
                              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[8px] font-bold uppercase tracking-widest">
                                {req.data.genres ? req.data.genres.join(', ') : 'No Genre'}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/60 leading-relaxed line-clamp-3 mb-4">
                              {req.data.description || 'No description available.'}
                            </p>
                            <a 
                              href={`https://rawg.io/games/${req.data.slug || req.data.gameId}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-[8px] font-bold text-plaeen-green uppercase tracking-widest hover:underline"
                            >
                              View on RAWG.io <Gamepad2 size={12} />
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {req.type !== 'game' && (
                        <p className="text-xs text-white/40 font-medium">{req.data.reason || req.title || 'No additional details provided.'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 w-full md:w-auto">
                    <Button 
                      onClick={() => handleAction(req, 'denied')}
                      variant="outline"
                      className="flex-1 md:flex-none border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-bold uppercase tracking-widest text-[10px] px-8"
                    >
                      <X size={16} className="mr-2" /> {req.type === 'overtime' ? 'Punish' : 'Deny'}
                    </Button>
                    <Button 
                      onClick={() => handleAction(req, 'approved')}
                      className="flex-1 md:flex-none bg-plaeen-green text-black font-bold uppercase tracking-widest text-[10px] px-8 shadow-[0_0_15px_rgba(118,233,0,0.3)]"
                    >
                      <Check size={16} className="mr-2" /> {req.type === 'overtime' ? 'Forgive' : 'Approve'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {pending.length === 0 && (
              <Card className="bg-white/5 border-dashed border-white/10 p-12 text-center">
                <p className="text-white/20 font-bold uppercase tracking-widest">No pending requests</p>
              </Card>
            )}
          </div>
        </div>

        {/* History */}
        <div className="space-y-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40 flex items-center gap-3">
            <Clock size={16} /> Recent History
          </h2>
          <div className="space-y-4">
            {history.slice(0, 10).map(req => (
              <Card key={req.id} className="bg-white/5 border-white/10 p-4 opacity-60">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{req.childName}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-widest ${req.status === 'approved' ? 'text-plaeen-green' : 'text-red-500'}`}>
                    {req.status}
                  </span>
                </div>
                <p className="text-xs font-bold text-white uppercase tracking-tight">
                  {req.type === 'game' ? req.data.gameName : 
                   req.type === 'friend' ? req.data.friendName : 
                   req.type === 'time' ? `+${req.data.minutes}m` : 
                   req.type === 'overtime' ? `Overtime: ${req.data.overtimeMinutes}m` :
                   req.data.teamName}
                </p>
                <p className="text-[8px] text-white/20 uppercase tracking-widest mt-2">{format(req.createdAt.toDate(), 'MMM d, HH:mm')}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
