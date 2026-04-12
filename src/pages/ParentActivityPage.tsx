import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { auth, db } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Clock, Play, Square, AlertTriangle, CheckCircle2, ArrowLeft, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'session_start' | 'session_end' | 'time_warning';
  childName: string;
  createdAt: any;
  read: boolean;
}

export const ParentActivityPage = () => {
  const [user] = useAuthState(auth);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <button 
        onClick={() => navigate('/parent-dashboard')}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green font-bold uppercase tracking-widest text-[10px] mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Command Center
      </button>

      <div className="mb-12">
        <h1 className="text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
          Activity <span className="text-plaeen-green">Log</span>
        </h1>
        <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">Real-time Monitoring & History</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
            <Bell size={16} /> Recent Notifications
          </h2>
          
          <div className="space-y-4">
            {notifications.map(notif => (
              <div 
                key={notif.id} 
                onClick={() => !notif.read && markAsRead(notif.id)}
                className="cursor-pointer"
              >
                <Card 
                  className={`bg-white/5 border-white/10 p-6 transition-all ${!notif.read ? 'border-l-4 border-l-plaeen-green' : 'opacity-60'}`}
                >
                  <div className="flex justify-between items-start gap-6">
                    <div className="flex gap-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                        notif.type === 'session_start' ? 'bg-plaeen-green/10 text-plaeen-green' :
                        notif.type === 'session_end' ? 'bg-white/10 text-white' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {notif.type === 'session_start' ? <Play size={24} /> :
                         notif.type === 'session_end' ? <Square size={24} /> :
                         <AlertTriangle size={24} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest">{notif.childName}</span>
                          <span className="text-[8px] text-white/20 uppercase tracking-widest">• {notif.createdAt ? format(notif.createdAt.toDate(), 'HH:mm') : 'Just now'}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-1">{notif.title}</h3>
                        <p className="text-sm text-white/40">{notif.message}</p>
                      </div>
                    </div>
                    {!notif.read && (
                      <div className="h-2 w-2 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]" />
                    )}
                  </div>
                </Card>
              </div>
            ))}
            {notifications.length === 0 && (
              <Card className="bg-white/5 border-dashed border-white/10 p-12 text-center">
                <p className="text-white/20 font-bold uppercase tracking-widest">No activity recorded yet</p>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40 flex items-center gap-3">
            <Clock size={16} /> Summary
          </h2>
          <Card className="bg-white/5 border-white/10 p-8">
            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Total Sessions Today</p>
                <p className="text-4xl font-bold text-white">
                  {notifications.filter(n => n.type === 'session_start' && n.createdAt && format(n.createdAt.toDate(), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                </p>
              </div>
              <div className="pt-8 border-t border-white/5">
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Warnings Triggered</p>
                <p className="text-4xl font-bold text-red-500">{notifications.filter(n => n.type === 'time_warning').length}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
