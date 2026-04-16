import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, limit, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Bell, X, Check, Trash2, Shield, Users, UserPlus, Star, Gamepad2, ArrowLeft, Clock, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useProfile } from '../contexts/ProfileContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { formatName, safeToDate } from '../lib/utils';
import { format, isToday, isYesterday, subDays, isAfter } from 'date-fns';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  data?: any;
}

export const NotificationsPage = () => {
  const [user] = useAuthState(auth);
  const { activeKid, role } = useProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const navigate = useNavigate();

  const activeUid = activeKid?.uid || user?.uid;

  useEffect(() => {
    if (!activeUid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', activeUid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeUid]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setActiveMenu(null);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await handleMarkAsRead(n.id);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setActiveMenu(null);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleTeamInvite = async (notif: any, accept: boolean) => {
    try {
      if (accept) {
        await updateDoc(doc(db, 'groups', notif.data.teamId), {
          members: arrayUnion(activeUid)
        });
      }
      await deleteDoc(doc(db, 'notifications', notif.id));
    } catch (err) {
      console.error('Error handling team invite:', err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }

    // Navigation logic
    switch (notif.type) {
      case 'friend_request':
        navigate('/friends');
        break;
      case 'friend_accepted':
        navigate('/friends');
        break;
      case 'team_invite':
        // Already on notifications page, buttons are visible
        break;
      case 'decision':
        navigate('/kid-dashboard');
        break;
      case 'game_approval':
        navigate('/parent/approvals');
        break;
      case 'overtime':
        navigate(`/parent/overtime-decision/${notif.id}`);
        break;
      default:
        // Stay on page if no specific target
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'decision': return <Shield size={20} className="text-plaeen-purple" />;
      case 'team_invite': return <Users size={20} className="text-plaeen-green" />;
      case 'friend_request': return <UserPlus size={20} className="text-amber-500" />;
      case 'friend_accepted': return <Star size={20} className="text-plaeen-green" />;
      case 'game_approval': return <Gamepad2 size={20} className="text-plaeen-green" />;
      default: return <Bell size={20} className="text-white/40" />;
    }
  };

  const requiresAction = (type: string) => {
    return ['friend_request', 'team_invite', 'overtime'].includes(type);
  };

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const groupedNotifications = notifications.reduce((groups: any, notif) => {
    const date = safeToDate(notif.createdAt);
    const label = formatDateLabel(date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(notif);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-plaeen-green"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green font-bold uppercase tracking-widest text-[10px] mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            Inbox <span className="text-plaeen-green">Center</span>
          </h1>
          <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">Manage your alerts and invitations</p>
        </div>
        
        {notifications.some(n => !n.read) && (
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            className="border-white/10 text-white/40 hover:text-white hover:border-white/20 text-[10px] font-bold uppercase tracking-widest"
          >
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-12">
        {Object.keys(groupedNotifications).length === 0 ? (
          <Card className="bg-white/5 border-dashed border-white/10 p-20 text-center">
            <Bell size={48} className="mx-auto text-white/5 mb-6" />
            <p className="text-white/20 font-bold uppercase tracking-widest">Your inbox is empty</p>
          </Card>
        ) : (
          Object.entries(groupedNotifications).map(([label, items]: [string, any]) => (
            <div key={label} className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] whitespace-nowrap">
                  {label}
                </span>
                <div className="h-px w-full bg-white/5" />
              </div>

              <div className="space-y-4">
                {items.map((notif: Notification) => (
                  <Card 
                    key={notif.id}
                    className={`group relative bg-white/5 border-white/10 p-6 transition-all hover:bg-white/[0.07] ${!notif.read ? 'border-l-4 border-l-plaeen-green' : 'opacity-60'}`}
                  >
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex gap-6 flex-1" onClick={() => handleNotificationClick(notif)} style={{ cursor: 'pointer' }}>
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${
                          notif.type === 'decision' ? 'bg-plaeen-purple/10 text-plaeen-purple' :
                          notif.type === 'team_invite' ? 'bg-plaeen-green/10 text-plaeen-green' :
                          notif.type === 'friend_request' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-white/5 text-white/40'
                        }`}>
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest">{notif.title}</span>
                            <span className="text-[8px] text-white/20 uppercase tracking-widest">• {format(safeToDate(notif.createdAt), 'HH:mm')}</span>
                            {!notif.read && (
                              <span className="text-[8px] font-bold text-plaeen-green uppercase tracking-widest bg-plaeen-green/10 px-2 py-0.5 rounded">New</span>
                            )}
                          </div>
                          <p className="text-sm text-white/60 font-medium leading-relaxed mb-4">{notif.message}</p>
                          
                          {/* Action Buttons */}
                          {notif.type === 'team_invite' && !notif.read && (
                            <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                onClick={() => handleTeamInvite(notif, true)}
                                className="bg-plaeen-green text-black text-[10px] font-bold uppercase tracking-widest px-6 py-2"
                              >
                                Accept
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleTeamInvite(notif, false)}
                                className="border-white/10 text-white/40 text-[10px] font-bold uppercase tracking-widest px-6 py-2"
                              >
                                Decline
                              </Button>
                            </div>
                          )}

                          {notif.type === 'friend_request' && !notif.read && (
                            <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => navigate('/friends')}
                                className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 text-[10px] font-bold uppercase tracking-widest px-6 py-2"
                              >
                                View Request
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Options Menu */}
                      {!requiresAction(notif.type) && (
                        <div className="relative">
                          <button 
                            onClick={() => setActiveMenu(activeMenu === notif.id ? null : notif.id)}
                            className="p-2 text-white/20 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                          >
                            <MoreVertical size={20} />
                          </button>

                          <AnimatePresence>
                            {activeMenu === notif.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                  className="absolute right-0 mt-2 w-48 rounded-2xl bg-plaeen-dark border border-white/10 shadow-2xl p-1 z-20 overflow-hidden"
                                >
                                  {!notif.read && (
                                    <button
                                      onClick={() => handleMarkAsRead(notif.id)}
                                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-bold text-white/60 hover:text-plaeen-green hover:bg-plaeen-green/5 transition-all uppercase tracking-widest"
                                    >
                                      <Check size={14} /> Mark as Read
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(notif.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-bold text-red-400 hover:bg-red-400/5 transition-all uppercase tracking-widest"
                                  >
                                    <Trash2 size={14} /> Delete Alert
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
