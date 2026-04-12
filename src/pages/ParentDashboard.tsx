import React, { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { auth, db } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, getDoc, Timestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Plus, Users, Clock, Gamepad2, Bell, Shield, Lock, Unlock, ChevronRight, Check, X } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';

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
  type: 'friend' | 'game' | 'time' | 'team';
  status: 'pending' | 'approved' | 'denied';
  data: any;
  createdAt: any;
}

export const ParentDashboard = () => {
  const [user] = useAuthState(auth);
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isAddKidOpen, setIsAddKidOpen] = useState(false);
  const [newKidName, setNewKidName] = useState('');
  const [newKidEmail, setNewKidEmail] = useState('');
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
    if (!user || !newKidName || !newKidEmail) return;

    try {
      // In a real app, we'd use a cloud function to create the auth user.
      // For this MVP, we'll just create the firestore doc.
      // The kid will "log in" with this email.
      const kidUid = `kid_${Math.random().toString(36).substr(2, 9)}`;
      const kidData = {
        uid: kidUid,
        displayName: newKidName,
        email: newKidEmail,
        role: 'kid',
        parentId: user.uid,
        screenTime: {
          dailyAllowance: 60, // Default 1 hour
          usedToday: 0,
          lastReset: Timestamp.now()
        },
        allowedGames: [],
        friends: [],
        wishlist: [],
        availability: {}
      };

      await updateDoc(doc(db, 'users', user.uid), {
        linkedKids: arrayUnion(kidUid)
      });

      await addDoc(collection(db, 'users'), kidData);
      
      setIsAddKidOpen(false);
      setNewKidName('');
      setNewKidEmail('');
    } catch (err) {
      console.error('Error creating kid account:', err);
    }
  };

  const handleApproval = async (id: string, status: 'approved' | 'denied') => {
    try {
      await updateDoc(doc(db, 'approvals', id), { status });
      // Additional logic for applying the approval (e.g. adding friend) would be here
    } catch (err) {
      console.error('Error updating approval:', err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            Command <span className="text-plaeen-green">Center</span>
          </h1>
          <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">Parental Oversight & Management</p>
        </div>
        <Button 
          onClick={() => setIsAddKidOpen(true)}
          className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-8 py-6 shadow-[0_0_20px_rgba(118,233,0,0.4)]"
        >
          <Plus size={20} className="mr-2" /> Register Kid
        </Button>
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
                          {kid.screenTime.dailyAllowance - kid.screenTime.usedToday}m Remaining
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
                          <Gamepad2 size={12} className="text-plaeen-green" />
                          {kid.allowedGames.length} Games Allowed
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-4">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-white/10 text-white/40 hover:text-plaeen-green">
                        <Lock size={16} />
                      </Button>
                      <Button variant="outline" size="sm" className="border-white/10 text-white/40 hover:text-plaeen-green">
                        <Unlock size={16} />
                      </Button>
                    </div>
                    <Link to={`/parent/child/${kid.uid}`}>
                      <Button className="bg-white/5 border border-white/10 text-white hover:bg-plaeen-green hover:text-black font-bold uppercase tracking-widest text-[10px] px-6">
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
              {approvals.slice(0, 3).map(req => (
                <Card key={req.id} className="bg-white/5 border-white/10 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[8px] font-bold text-plaeen-green uppercase tracking-widest mb-1">{req.childName}</p>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">
                        {req.type === 'friend' ? 'New Friend Request' : 
                         req.type === 'game' ? 'Game Access Request' :
                         req.type === 'time' ? 'Extra Time Request' : 'Team Invite'}
                      </p>
                    </div>
                    <p className="text-[8px] text-white/20 uppercase tracking-widest">{format(req.createdAt.toDate(), 'HH:mm')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleApproval(req.id, 'approved')}
                      className="flex-1 bg-plaeen-green/10 text-plaeen-green border border-plaeen-green/20 hover:bg-plaeen-green hover:text-black py-1"
                    >
                      <Check size={14} />
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleApproval(req.id, 'denied')}
                      className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white py-1"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </Card>
              ))}
              {approvals.length === 0 && (
                <p className="text-center py-8 text-white/10 text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">All clear</p>
              )}
            </div>
          </section>

          {/* Activity Snapshot */}
          <section className="space-y-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green flex items-center gap-3">
              <Users size={16} /> Activity Snapshot
            </h2>
            <Card className="bg-white/5 border-white/10 p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total Time Today</span>
                  <span className="text-sm font-bold text-white">124m</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Active Sessions</span>
                  <span className="text-sm font-bold text-plaeen-green">2</span>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <Link to="/parent/activity">
                    <Button variant="outline" className="w-full border-white/10 text-white/40 hover:text-plaeen-green text-[10px] font-bold uppercase tracking-widest py-4">
                      Full Activity Report
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </section>
        </div>
      </div>

      {/* Add Kid Modal */}
      {isAddKidOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
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
                <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-2 block">Login Email</label>
                <input 
                  type="email"
                  value={newKidEmail}
                  onChange={(e) => setNewKidEmail(e.target.value)}
                  placeholder="KID'S EMAIL"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase tracking-widest text-sm"
                  required
                />
              </div>
              <Button type="submit" className="w-full py-6 font-bold uppercase tracking-widest">
                Create Account
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
