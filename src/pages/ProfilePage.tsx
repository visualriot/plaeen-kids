import React, { useState, useEffect } from 'react';
import { auth, db } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { User, Monitor, Smartphone, Cpu, ShieldCheck, Check, Camera, Save, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut, updateProfile } from 'firebase/auth';

const SYSTEMS = [
  { id: 'pc', name: 'PC', icon: Monitor },
  { id: 'ps5', name: 'PlayStation 5', icon: Cpu },
  { id: 'xbox', name: 'Xbox Series X', icon: Cpu },
  { id: 'switch', name: 'Nintendo Switch', icon: Smartphone },
  { id: 'mobile', name: 'Mobile', icon: Smartphone },
];

export const ProfilePage = () => {
  const [user] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [restrictedMode, setRestrictedMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setDisplayName(data.displayName || user.displayName || '');
        setPhotoURL(data.photoURL || user.photoURL || '');
        setSelectedSystems(data.systems || []);
        setRestrictedMode(data.restrictedMode || false);
      }
      setLoading(false);
    };

    fetchUser();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName,
        photoURL
      });

      // Update Firestore user document
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        photoURL,
        systems: selectedSystems,
        restrictedMode
      });

      // Update public profile if it exists
      const publicDoc = await getDoc(doc(db, 'users_public', user.uid));
      if (publicDoc.exists()) {
        await updateDoc(doc(db, 'users_public', user.uid), {
          displayName,
          photoURL
        });
      }

      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSystem = (id: string) => {
    setSelectedSystems(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-12">
        <h1 className="font-display text-5xl font-bold text-white uppercase tracking-tight mb-2">
          Account <span className="text-plaeen-green">Settings</span>
        </h1>
        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Manage your profile and preferences</p>
      </div>

      <div className="grid gap-8">
        {/* Profile Info */}
        <Card className="p-8 bg-plaeen-purple/20 border-white/10">
          <div className="flex flex-col md:flex-row gap-10">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="h-32 w-32 rounded-full border-4 border-plaeen-green/30 overflow-hidden bg-white/5 group-hover:border-plaeen-green transition-all shadow-[0_0_20px_rgba(118,233,0,0.2)]">
                  {photoURL ? (
                    <img src={photoURL} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User size={64} className="mx-auto mt-8 text-white/20" />
                  )}
                </div>
                <button className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-plaeen-green text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                  <Camera size={20} />
                </button>
              </div>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Profile Avatar</p>
            </div>

            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border-2 border-white/5 bg-white/5 px-6 py-4 text-white font-bold focus:border-plaeen-green focus:outline-none transition-all"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-2">Avatar URL</label>
                <input
                  type="text"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full rounded-xl border-2 border-white/5 bg-white/5 px-6 py-4 text-white font-bold focus:border-plaeen-green focus:outline-none transition-all"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Systems */}
        <Card className="p-8 bg-plaeen-purple/20 border-white/10">
          <h2 className="text-xl font-bold text-white uppercase tracking-tight mb-6 flex items-center gap-2">
            <Monitor size={20} className="text-plaeen-green" /> Gaming Systems
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {SYSTEMS.map((system) => {
              const Icon = system.icon;
              const isSelected = selectedSystems.includes(system.id);
              return (
                <button
                  key={system.id}
                  onClick={() => toggleSystem(system.id)}
                  className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 ${
                    isSelected
                      ? 'bg-plaeen-green/10 border-plaeen-green text-plaeen-green shadow-[0_0_20px_rgba(118,233,0,0.2)]'
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/30'
                  }`}
                >
                  <Icon size={32} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-center">{system.name}</span>
                  {isSelected && <Check size={16} className="absolute top-2 right-2" />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-8 bg-plaeen-purple/20 border-white/10">
          <h2 className="text-xl font-bold text-white uppercase tracking-tight mb-6 flex items-center gap-2">
            <ShieldCheck size={20} className="text-plaeen-green" /> Preferences
          </h2>
          <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10">
            <div>
              <p className="font-bold text-white uppercase tracking-tight">Restricted Mode (Child Friendly)</p>
              <p className="text-xs text-white/40 mt-1">Only show child-friendly games and private groups</p>
            </div>
            <button
              onClick={() => setRestrictedMode(!restrictedMode)}
              className={`h-8 w-14 rounded-full p-1 transition-colors duration-300 ${
                restrictedMode ? 'bg-plaeen-green' : 'bg-white/10'
              }`}
            >
              <div className={`h-6 w-6 rounded-full bg-white transition-transform duration-300 ${
                restrictedMode ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1 py-6 text-lg font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(118,233,0,0.3)]"
          >
            {saving ? 'Saving...' : (
              <span className="flex items-center gap-2 justify-center">
                <Save size={20} /> Save Changes
              </span>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSignOut}
            className="sm:w-48 py-6 text-lg font-bold uppercase tracking-widest border-red-500/30 text-red-500 hover:bg-red-500/10"
          >
            <LogOut size={20} className="mr-2" /> Log Out
          </Button>
        </div>
      </div>
    </div>
  );
};
