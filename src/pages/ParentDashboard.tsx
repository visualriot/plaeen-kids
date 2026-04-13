import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { auth, db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, setDoc, getDoc, Timestamp, deleteDoc, increment } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Plus, Users, Clock, Gamepad2, Bell, Shield, Lock, Unlock, ChevronRight, Check, X, Star, Zap, Trash2, Settings } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useProfile } from '@/contexts/ProfileContext';
import { motion, AnimatePresence } from 'framer-motion';

interface KidProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  screenTime: {
    dailyAllowance: number;
    usedToday: number;
    lastReset: any;
  };
  allowedGames: string[];
  role: 'kid';
}

interface ApprovalRequest {
  id: string;
  childId: string;
  childName: string;
  type: 'friend' | 'game' | 'time' | 'team' | 'activity';
  status: 'pending' | 'approved' | 'denied';
  title?: string;
  rewardMinutes?: number;
  data: any;
  createdAt: any;
}

export const ParentDashboard = () => {
  const [user] = useAuthState(auth);
  const { setActiveKid, setParentAuthenticated } = useProfile();
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isAddKidOpen, setIsAddKidOpen] = useState(false);
  const [newKidName, setNewKidName] = useState('');
  const [newKidUsername, setNewKidUsername] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [rewardMinutes, setRewardMinutes] = useState(5);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users'), where('parentId', '==', user.uid));
    const unsubscribeKids = onSnapshot(q, (snapshot) => {
      setKids(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as KidProfile)));
    });

    const qApprovals = query(collection(db, 'approvals'), where('parentId', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribeApprovals = onSnapshot(qApprovals, (snapshot) => {
      setApprovals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRequest)));
    });

    return () => {
      unsubscribeKids();
      unsubscribeApprovals();
    };
  }, [user]);

  const createKidAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newKidName || !newKidUsername) return;

    try {
      const kidUid = `kid_${Math.random().toString(36).substr(2, 9)}`;
      const kidData = {
        uid: kidUid,
        displayName: newKidName,
        username: newKidUsername.toLowerCase().replace(/\s+/g, ''),
        role: 'kid',
        parentId: user.uid,
        screenTime: {
          dailyAllowance: 60,
          usedToday: 0,
          lastReset: Timestamp.now()
        },
        allowedGames: [],
        friends: [],
        wishlist: [],
        availability: {}
      };

      await setDoc(doc(db, 'users', user.uid), {
        linkedKids: arrayUnion(kidUid)
      }, { merge: true });

      await setDoc(doc(db, 'users', kidUid), kidData, { merge: true });

      await setDoc(doc(db, 'users_public', kidUid), {
        uid: kidUid,
        displayName: kidData.displayName,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${kidUid}`,
        role: 'kid',
        parentId: user.uid
      }, { merge: true });
      
      setIsAddKidOpen(false);
      setNewKidName('');
      setNewKidUsername('');
    } catch (err) {
      console.error('Error creating kid account:', err);
    }
  };

  const handleApproval = async (id: string, status: 'approved' | 'denied', reward: number = 0) => {
    try {
      const req = approvals.find(a => a.id === id);
      if (!req) return;

      await updateDoc(doc(db, 'approvals', id), { 
        status,
        rewardMinutes: reward
      });

      if (status === 'approved' && reward > 0) {
        await updateDoc(doc(db, 'users', req.childId), {
          'screenTime.dailyAllowance': increment(reward)
        });
      }

      setSelectedApproval(null);
    } catch (err) {
      console.error('Error updating approval:', err);
    }
  };

  const handleSwitchProfile = (kidId: string) => {
    setActiveKid(kidId);
    navigate('/kid-dashboard');
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16">
        <div>
          <h1 className="text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            Guardian <span className="text-plaeen-green">Hub</span>
          </h1>
          <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">Parental Oversight & Management</p>
        </div>
        <div className="flex gap-4">
          <Link to="/parent/settings">
            <Button variant="outline" className="border-white/10 text-white/40 hover:text-white py-6">
              <Settings size={20} />
            </Button>
          </Link>
          <Button 
            onClick={() => setIsAddKidOpen(true)}
            className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-8 py-6 shadow-[0_0_20px_rgba(118,233,0,0.4)]"
          >
            <Plus size={20} className="mr-2" /> Register Kid
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        {/* Kids List */}
        <div className="lg:col-span-2 space-y-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
            <Shield size={16} /> Linked Accounts
          </h2>
          
          <div className="grid gap-6">
            {kids.map(kid => (
              <Card key={kid.uid} className="bg-white/5 border-white/10 p-8 hover:border-plaeen-green/30 transition-all group">
                <div className="flex flex-col md:flex-row justify-between gap-8">
                  <div className="flex gap-6">
                    <div className="h-20 w-20 rounded-2xl border-2 border-plaeen-green p-1 bg-plaeen-dark shadow-[0_0_15px_rgba(118,233,0,0.2)]">
                      <img
                        src={kid.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${kid.uid}`}
                        alt={kid.displayName}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white uppercase tracking-tight mb-2 group-hover:text-plaeen-green transition-colors">
                        {kid.displayName}
                      </h3>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
                          <Clock size={12} className="text-plaeen-green" />
                          {Math.max(0, (kid.screenTime?.dailyAllowance || 0) - (kid.screenTime?.usedToday || 0))}m Remaining
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
                          <Gamepad2 size={12} className="text-plaeen-green" />
                          {(kid.allowedGames || []).length} Games Allowed
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-4">
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleSwitchProfile(kid.uid)}
                        className="bg-plaeen-green text-black font-bold uppercase tracking-widest text-[10px] px-6"
                      >
                        Switch to Profile
                      </Button>
                    </div>
                    <Link to={`/parent/child/${kid.uid}`}>
                      <Button variant="outline" className="border-white/10 text-white/40 hover:text-plaeen-green font-bold uppercase tracking-widest text-[10px] px-6">
                        Manage <ChevronRight size={14} className="ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
            {kids.length === 0 && (
              <Card className="bg-white/5 border-dashed border-white/10 p-12 text-center">
                <p className="text-white/20 font-bold uppercase tracking-widest">No kid accounts registered yet</p>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar: Approvals & Activity */}
        <div className="space-y-12">
          {/* Pending Approvals */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
                <Bell size={16} /> Pending Approvals
              </h2>
              <Link to="/parent/approvals" className="text-[8px] font-bold uppercase tracking-widest text-white/20 hover:text-plaeen-green transition-colors">View All</Link>
            </div>
            
            <div className="space-y-4">
              {approvals.map(req => (
                <Card key={req.id} className="bg-white/5 border-white/10 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[8px] font-bold text-plaeen-green uppercase tracking-widest mb-1">{req.childName}</p>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">
                        {req.type === 'activity' ? `Activity: ${req.title}` : 
                         req.type === 'friend' ? `Friend: ${req.data.friendName}` : 
                         req.type === 'game' ? `Game: ${req.data.gameName}` : 'Team Invite'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {req.type === 'game' && (
                      <Button 
                        size="sm" 
                        onClick={() => navigate('/parent/approvals')}
                        className="w-full bg-white/5 text-white/40 border border-white/10 hover:border-plaeen-green hover:text-plaeen-green py-2 font-bold uppercase tracking-widest text-[8px]"
                      >
                        See Game Details
                      </Button>
                    )}
                    <div className="flex gap-2">
                      {req.type === 'activity' ? (
                        <Button 
                          size="sm" 
                          onClick={() => setSelectedApproval(req)}
                          className="flex-1 bg-plaeen-purple/10 text-plaeen-purple border border-plaeen-purple/20 hover:bg-plaeen-purple hover:text-white py-2 font-bold uppercase tracking-widest text-[8px]"
                        >
                          Review & Reward
                        </Button>
                      ) : (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleApproval(req.id, 'approved')}
                            className="flex-1 bg-plaeen-green/10 text-plaeen-green border border-plaeen-green/20 hover:bg-plaeen-green hover:text-black py-2"
                          >
                            <Check size={14} />
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleApproval(req.id, 'denied')}
                            className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white py-2"
                          >
                            <X size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {approvals.length === 0 && (
                <p className="text-center py-8 text-white/10 text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">All clear</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Reward Modal */}
      <AnimatePresence>
        {selectedApproval && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <Card className="w-full max-w-md bg-plaeen-dark border-plaeen-purple/30 p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">Approve Activity</h2>
                <button onClick={() => setSelectedApproval(null)} className="text-white/40 hover:text-white"><X size={24} /></button>
              </div>
              <div className="mb-8">
                <p className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest mb-2">{selectedApproval.childName} says:</p>
                <p className="text-xl font-bold text-white uppercase tracking-tight italic">"{selectedApproval.title}"</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-purple mb-4 block">Allocate Screen Time Reward</label>
                  <div className="flex items-center justify-between gap-4">
                    {[5, 10, 15, 30].map(min => (
                      <button
                        key={min}
                        onClick={() => setRewardMinutes(min)}
                        className={`flex-1 py-4 rounded-xl font-bold transition-all ${
                          rewardMinutes === min ? 'bg-plaeen-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        {min}m
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button 
                    onClick={() => handleApproval(selectedApproval.id, 'approved', rewardMinutes)}
                    className="flex-1 py-6 bg-plaeen-green text-black font-bold uppercase tracking-widest"
                  >
                    Approve +{rewardMinutes}m
                  </Button>
                  <Button 
                    onClick={() => handleApproval(selectedApproval.id, 'denied')}
                    variant="outline"
                    className="flex-1 py-6 border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold uppercase tracking-widest"
                  >
                    Deny
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Kid Modal */}
      <AnimatePresence>
        {isAddKidOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <Card className="w-full max-w-md bg-plaeen-dark border-plaeen-green/30 p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">Register Kid</h2>
                <button onClick={() => setIsAddKidOpen(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={createKidAccount} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-2 block">Display Name</label>
                  <input 
                    type="text"
                    value={newKidName}
                    onChange={(e) => setNewKidName(e.target.value)}
                    placeholder="KID'S NAME"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase tracking-widest text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-2 block">Username</label>
                  <input 
                    type="text"
                    value={newKidUsername}
                    onChange={(e) => setNewKidUsername(e.target.value)}
                    placeholder="KID_USERNAME"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase tracking-widest text-sm"
                    required
                  />
                </div>
                <Button type="submit" className="w-full py-6 font-bold uppercase tracking-widest">
                  Create Account
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
