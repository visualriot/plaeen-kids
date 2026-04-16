import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, limit, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Bell, X, Check, Trash2, MoreVertical, Shield, Users, UserPlus, Star, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { formatName, safeToDate } from '../lib/utils';
import { format } from 'date-fns';

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

interface NotificationPanelProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ userId, isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId || !isOpen) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    return () => unsubscribe();
  }, [userId, isOpen]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleTeamInvite = async (notif: any, accept: boolean) => {
    try {
      if (accept) {
        await updateDoc(doc(db, 'groups', notif.data.teamId), {
          members: arrayUnion(userId)
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

    onClose();

    // Navigation logic
    switch (notif.type) {
      case 'friend_request':
        navigate('/friends');
        break;
      case 'friend_accepted':
        navigate('/friends');
        break;
      case 'team_invite':
        navigate('/notifications');
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
        // Default to dashboard if unknown
        navigate(userId.startsWith('kid_') ? '/kid-dashboard' : '/parent-dashboard');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'decision': return <Shield size={16} className="text-plaeen-purple" />;
      case 'team_invite': return <Users size={16} className="text-plaeen-green" />;
      case 'friend_request': return <UserPlus size={16} className="text-amber-500" />;
      case 'friend_accepted': return <Star size={16} className="text-plaeen-green" />;
      case 'game_approval': return <Gamepad2 size={16} className="text-plaeen-green" />;
      default: return <Bell size={16} className="text-white/40" />;
    }
  };

  const requiresAction = (type: string) => {
    return ['friend_request', 'team_invite', 'overtime'].includes(type);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute right-0 top-full mt-2 w-80 md:w-96 rounded-2xl bg-plaeen-dark border border-white/10 shadow-2xl z-[70] overflow-hidden backdrop-blur-xl"
        >
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Notifications</h3>
          </div>

            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <Bell size={32} className="mx-auto text-white/5 mb-4" />
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">All clear</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`group relative p-4 hover:bg-white/5 transition-all cursor-pointer ${!notif.read ? 'bg-plaeen-green/5' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="flex gap-4">
                        <div className="mt-1 h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className={`text-[10px] font-bold uppercase tracking-tight truncate ${!notif.read ? 'text-white' : 'text-white/60'}`}>
                              {formatName(notif.title)}
                            </p>
                            <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest shrink-0">
                              {notif.createdAt ? format(safeToDate(notif.createdAt), 'HH:mm') : 'Just now'}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/40 font-medium leading-relaxed mb-3">
                            {notif.message}
                          </p>

                          {/* Action Buttons for specific types */}
                          {notif.type === 'team_invite' && !notif.read && (
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                onClick={() => handleTeamInvite(notif, true)}
                                className="bg-plaeen-green text-black text-[8px] font-bold uppercase tracking-widest px-3 py-1.5 h-auto"
                              >
                                Accept
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleTeamInvite(notif, false)}
                                className="border-white/10 text-white/40 text-[8px] font-bold uppercase tracking-widest px-3 py-1.5 h-auto"
                              >
                                Decline
                              </Button>
                            </div>
                          )}

                          {notif.type === 'friend_request' && !notif.read && (
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => navigate('/friends')}
                                className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 text-[8px] font-bold uppercase tracking-widest px-3 py-1.5 h-auto"
                              >
                                View Request
                              </Button>
                            </div>
                          )}
                        </div>
                        {!notif.read && (
                          <div className="shrink-0 mt-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-white/5 bg-white/5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[8px] font-bold uppercase tracking-widest text-white/40 hover:text-white"
                onClick={() => {
                  onClose();
                  navigate('/notifications');
                }}
              >
                View All Notifications
              </Button>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
};
