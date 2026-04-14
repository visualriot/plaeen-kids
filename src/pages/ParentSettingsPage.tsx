import React, { useState, useEffect } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useProfile } from '@/contexts/ProfileContext';
import { Shield, Lock, Check, X, ChevronLeft, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const ParentSettingsPage = () => {
  const { parentProfile, isLoading } = useProfile();
  const [pin, setPin] = useState('');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<'Mon' | 'Sun'>('Mon');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (parentProfile?.guardianPin) {
      setPin(parentProfile.guardianPin);
    }
    if (parentProfile?.firstDayOfWeek) {
      setFirstDayOfWeek(parentProfile.firstDayOfWeek);
    }
  }, [parentProfile]);

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">Loading...</div>;
  if (!parentProfile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', parentProfile.uid), {
        guardianPin: pin,
        firstDayOfWeek: firstDayOfWeek
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <button 
        onClick={() => navigate('/parent-dashboard')}
        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-12 font-bold uppercase tracking-widest text-[10px]"
      >
        <ChevronLeft size={16} /> Back to Guardian Hub
      </button>

      <div className="mb-12">
        <h1 className="text-5xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
          Security <span className="text-plaeen-green">Settings</span>
        </h1>
        <p className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs mt-2">Manage your parental access</p>
      </div>

      <Card className="bg-white/5 border-white/10 p-10">
        <div className="flex items-center gap-6 mb-12">
          <div className="h-16 w-16 rounded-2xl bg-plaeen-green/10 flex items-center justify-center">
            <Lock size={32} className="text-plaeen-green" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Parental PIN</h2>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Required for guardian profile access</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-12">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-4 block">4-Digit PIN</label>
              <input 
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-4xl font-bold tracking-[1em] text-white focus:border-plaeen-green focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-plaeen-green mb-4 block">First Day of Week</label>
              <div className="flex bg-white/5 rounded-2xl p-2 h-[88px]">
                {(['Mon', 'Sun'] as const).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setFirstDayOfWeek(day)}
                    className={cn(
                      "flex-1 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                      firstDayOfWeek === day ? "bg-plaeen-green text-black" : "text-white/40 hover:text-white"
                    )}
                  >
                    {day === 'Mon' ? 'Monday' : 'Sunday'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              type="submit" 
              disabled={isSaving || pin.length !== 4}
              className="bg-plaeen-green text-black font-bold uppercase tracking-widest px-12 py-6"
            >
              {isSaving ? 'Saving...' : 'Update PIN'}
            </Button>
            {success && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-plaeen-green font-bold uppercase tracking-widest text-[10px]"
              >
                <Check size={16} /> PIN Updated Successfully
              </motion.div>
            )}
          </div>
        </form>
      </Card>

      <div className="mt-12 p-8 rounded-3xl bg-plaeen-purple/5 border border-plaeen-purple/10">
        <div className="flex items-start gap-4">
          <Shield size={20} className="text-plaeen-purple mt-1" />
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-tight mb-2">Why use a PIN?</p>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
              A PIN prevents your children from accessing the Command Center and changing their own screen time limits or game approvals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
