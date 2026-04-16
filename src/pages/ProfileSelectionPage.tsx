import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useProfile } from '../contexts/ProfileContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Lock, LogOut, Pencil, Settings, Shield, User, X, Camera, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn, calculateAge, formatName } from '../lib/utils';
import { validateUsername } from '@/lib/validation';

interface KidProfile {
  uid: string;
  displayName: string;
  username: string;
  birthDate?: string;
  photoURL?: string;
}

export const ProfileSelectionPage = () => {
  const [user] = useAuthState(auth);
  const { parentProfile, setActiveKid, setParentAuthenticated, logoutProfile } = useProfile();
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [isManageMode, setIsManageMode] = useState(false);
  const [editingKid, setEditingKid] = useState<KidProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (parentProfile && !parentProfile.onboardingComplete) {
      navigate('/onboarding');
    }
  }, [parentProfile, navigate]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users'), where('parentId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setKids(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as KidProfile)));
    });

    return () => unsubscribe();
  }, [user]);

  const handleParentClick = () => {
    if (!parentProfile?.guardianPin) {
      // If no PIN set, allow entry but maybe prompt to set one later
      setParentAuthenticated(true);
      navigate('/parent-dashboard');
    } else {
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === (parentProfile?.guardianPin || '0000')) {
      setParentAuthenticated(true);
      navigate('/parent-dashboard');
    } else {
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 500);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    logoutProfile();
    navigate('/auth');
  };

  const handleEditClick = (kid: KidProfile) => {
    setEditingKid(kid);
    setEditName(kid.displayName);
    setEditUsername((kid as any).username || '');
    setEditAvatar(kid.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${kid.uid}`);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingKid || !user) return;
    if (!editName || !editUsername) {
      setEditError('Name and username are required');
      return;
    }

    const validation = validateUsername(editUsername);
    if (!validation.isValid) {
      setEditError(validation.error || 'Invalid username');
      return;
    }

    setIsSaving(true);
    try {
      const cleanUsername = editUsername.toLowerCase().trim().replace(/^@/, '');
      
      // Check if username is taken (if changed)
      if (cleanUsername !== (editingKid as any).username?.toLowerCase()) {
        const q = query(collection(db, 'users_public'), where('username', '==', cleanUsername));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setEditError('Username already taken');
          setIsSaving(false);
          return;
        }
      }

      const updates = {
        displayName: editName,
        username: cleanUsername,
        photoURL: editAvatar
      };

      await updateDoc(doc(db, 'users', editingKid.uid), updates);
      await updateDoc(doc(db, 'users_public', editingKid.uid), {
        displayName: editName,
        username: cleanUsername,
        photoURL: editAvatar
      });

      setEditingKid(null);
      setIsManageMode(false);
    } catch (err) {
      console.error('Save error:', err);
      setEditError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const AVATAR_SEEDS = ['Felix', 'Aneka', 'Caleb', 'Jocelyn', 'Max', 'Luna', 'Leo', 'Milo'];

  return (
    <div className="min-h-screen bg-plaeen-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-10">
        <img src="/logo.png" alt="Plaeen" className="h-12 w-auto" />
        <div className="flex gap-4">
          <button onClick={handleLogout} className="text-white/40 hover:text-white transition-colors flex items-center gap-2 font-bold uppercase tracking-widest text-xs">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center z-10"
      >
        <h1 className="text-5xl md:text-7xl font-bold text-white uppercase tracking-tighter mb-16">
          Who's <span className="text-plaeen-green">playing?</span>
        </h1>

        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {/* Kids Profiles */}
          {kids.map((kid) => (
            <motion.button
              key={kid.uid}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (isManageMode) {
                  handleEditClick(kid);
                } else {
                  setActiveKid(kid.uid);
                  navigate('/kid-dashboard');
                }
              }}
              className="group flex flex-col items-center gap-6 relative"
            >
              <div className={cn(
                "relative h-32 w-32 md:h-44 md:w-44 rounded-[2rem] overflow-hidden border-4 transition-all duration-300 shadow-2xl",
                isManageMode ? "border-plaeen-green" : "border-transparent group-hover:border-plaeen-green"
              )}>
                <img 
                  src={kid.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${kid.uid}`} 
                  alt={kid.displayName}
                  className="h-full w-full object-cover"
                />
                <div className={cn(
                  "absolute inset-0 transition-colors flex items-center justify-center",
                  isManageMode ? "bg-black/40" : "bg-plaeen-green/0 group-hover:bg-plaeen-green/10"
                )}>
                  {isManageMode && (
                    <div className="bg-plaeen-green text-black p-3 rounded-2xl shadow-lg">
                      <Pencil size={24} />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl md:text-2xl font-bold text-white/60 group-hover:text-white uppercase tracking-widest transition-colors">
                  {formatName(kid.displayName)}
                </span>
                <span className="text-xs md:text-sm font-bold text-white/20 group-hover:text-white/30 lowercase tracking-widest transition-colors">
                  @{kid.username} {kid.birthDate && `• ${calculateAge(kid.birthDate)}Y`}
                </span>
              </div>
            </motion.button>
          ))}

          {/* Parent Profile */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleParentClick}
            className="group flex flex-col items-center gap-6"
          >
            <div className="relative h-32 w-32 md:h-44 md:w-44 rounded-[2rem] bg-white/5 border-4 border-transparent group-hover:border-white/40 flex items-center justify-center transition-all duration-300 shadow-2xl">
              <Shield size={64} className="text-white/20 group-hover:text-white/60 transition-colors" />
              <div className="absolute top-4 right-4 h-8 w-8 rounded-full bg-plaeen-purple/40 flex items-center justify-center border border-white/10">
                <Lock size={14} className="text-white/60" />
              </div>
            </div>
            <span className="text-xl md:text-2xl font-bold text-white/60 group-hover:text-white uppercase tracking-widest transition-colors">
              Guardian
            </span>
          </motion.button>
        </div>

        <div className="mt-24 flex flex-col items-center gap-4">
          <Button 
            variant="outline" 
            className={cn(
              "uppercase tracking-[0.3em] text-[10px] px-12 py-4 transition-all",
              isManageMode ? "bg-plaeen-green text-black border-plaeen-green" : "border-white/10 text-white/40 hover:text-white"
            )}
            onClick={() => setIsManageMode(!isManageMode)}
          >
            {isManageMode ? 'Done Managing' : 'Manage Profiles'}
          </Button>
          {isManageMode && (
            <p className="text-[10px] font-bold text-plaeen-green uppercase tracking-widest animate-pulse">
              Select a profile to edit
            </p>
          )}
        </div>
      </motion.div>

      {/* PIN Modal */}
      <AnimatePresence>
        {editingKid && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl"
          >
            <Card className="w-full max-w-2xl bg-plaeen-purple/20 border-white/10 p-8 md:p-12 relative overflow-hidden">
              <button 
                onClick={() => setEditingKid(null)}
                className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"
              >
                <X size={32} />
              </button>

              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-white uppercase tracking-tighter mb-2">Edit <span className="text-plaeen-green">Profile</span></h2>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">Personalize your gaming identity</p>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                {/* Avatar Selection */}
                <div className="space-y-6">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green">Choose Avatar</label>
                  <div className="relative group">
                    <div className="h-48 w-48 mx-auto rounded-[2.5rem] overflow-hidden border-4 border-plaeen-green shadow-2xl">
                      <img src={editAvatar} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {AVATAR_SEEDS.map(seed => {
                      const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                      return (
                        <button
                          key={seed}
                          onClick={() => setEditAvatar(url)}
                          className={cn(
                            "h-12 w-12 rounded-xl overflow-hidden border-2 transition-all",
                            editAvatar === url ? "border-plaeen-green scale-110" : "border-white/5 hover:border-white/20"
                          )}
                        >
                          <img src={url} alt={seed} className="h-full w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Info Fields */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green">Display Name</label>
                    <input 
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full rounded-xl border-2 border-white/5 bg-white/5 px-6 py-4 text-white font-bold focus:border-plaeen-green focus:outline-none transition-all uppercase tracking-widest"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green">Username</label>
                    <input 
                      type="text"
                      value={editUsername}
                      onChange={e => {
                        const val = e.target.value;
                        setEditUsername(val);
                        if (val) {
                          const v = validateUsername(val);
                          setEditError(v.isValid ? '' : v.error || 'Invalid username');
                        } else {
                          setEditError('');
                        }
                      }}
                      className={cn(
                        "w-full rounded-xl border-2 bg-white/5 px-6 py-4 text-white font-bold focus:outline-none transition-all uppercase tracking-widest",
                        editError && editError !== 'Name and username are required' && editError !== 'Username already taken' && editError !== 'Failed to save changes'
                          ? "border-red-500 focus:border-red-500" 
                          : "border-white/5 focus:border-plaeen-green"
                      )}
                    />
                  </div>

                  {editError && (
                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">
                      {editError}
                    </p>
                  )}

                  <div className="pt-4">
                    <Button 
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="w-full py-6 shadow-[0_0_30px_rgba(118,233,0,0.3)]"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {showPinModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl"
          >
            <div className="w-full max-w-sm text-center">
              <button 
                onClick={() => setShowPinModal(false)}
                className="absolute top-8 right-8 text-white/40 hover:text-white"
              >
                <X size={32} />
              </button>

              <Shield size={48} className="text-plaeen-green mx-auto mb-8" />
              <h2 className="text-3xl font-bold text-white uppercase tracking-tighter mb-4">Parental Access</h2>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-12">Enter your 4-digit PIN</p>

              <form onSubmit={handlePinSubmit} className="space-y-12">
                <div className="flex justify-center gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div 
                      key={i}
                      className={`h-16 w-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold transition-all duration-300 ${
                        pinError ? 'border-red-500 animate-shake' : 
                        pin.length > i ? 'border-plaeen-green text-white bg-plaeen-green/10' : 'border-white/10 text-white/20'
                      }`}
                    >
                      {pin.length > i ? '•' : ''}
                    </div>
                  ))}
                </div>

                <input 
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPin(val);
                    if (val.length === 4) {
                      // Auto submit
                      if (val === (parentProfile?.guardianPin || '0000')) {
                        setParentAuthenticated(true);
                        navigate('/parent-dashboard');
                      } else {
                        setPinError(true);
                        setPin('');
                        setTimeout(() => setPinError(false), 500);
                      }
                    }
                  }}
                  className="opacity-0 absolute"
                />

                <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">
                  Forgot PIN? Contact Support
                </p>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-plaeen-green/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
};
