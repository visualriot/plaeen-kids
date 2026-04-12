import { Link, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { auth, db } from '@/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Bell, User, Settings, Calendar, Users, LogOut, LayoutDashboard, Shield, Activity, CheckCircle, Search } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const Navbar = () => {
  const [user] = useAuthState(auth);
  const [role, setRole] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRole = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        setRole(userDoc.data()?.role || 'parent');
      }
    };
    fetchRole();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-plaeen-dark/50 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-plaeen-green text-black shadow-[0_0_15px_rgba(118,233,0,0.4)]">
            <span className="text-2xl font-bold">P</span>
          </div>
          <span className="font-display text-2xl font-bold tracking-tight text-white uppercase tracking-tighter">PLAEEN</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {user && role === 'parent' && (
            <>
              <Link to="/parent-dashboard" className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 hover:text-plaeen-green transition-colors">Dashboard</Link>
              <Link to="/parent/approvals" className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 hover:text-plaeen-green transition-colors">Approvals</Link>
              <Link to="/parent/activity" className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 hover:text-plaeen-green transition-colors">Activity</Link>
            </>
          )}
          {user && role === 'kid' && (
            <>
              <Link to="/kid-dashboard" className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 hover:text-plaeen-green transition-colors">Hub</Link>
              <Link to="/teams" className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 hover:text-plaeen-green transition-colors">Teams</Link>
              <Link to="/friends" className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 hover:text-plaeen-green transition-colors">Friends</Link>
              <Link to="/search" className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70 hover:text-plaeen-green transition-colors">Explore</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button className="relative rounded-full p-2 hover:bg-white/10 transition-colors">
                <Bell size={20} className="text-white/70" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-plaeen-green shadow-[0_0_8px_rgba(118,233,0,0.8)]" />
              </button>
              
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-plaeen-green/30 bg-white/5 overflow-hidden hover:border-plaeen-green transition-all shadow-[0_0_10px_rgba(118,233,0,0.2)]"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User size={20} className="text-white/70" />
                  )}
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-64 origin-top-right rounded-2xl border border-white/10 bg-plaeen-dark/95 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-3 border-b border-white/5 mb-2">
                      <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest truncate">{role === 'parent' ? 'Parent Account' : 'Kid Account'}</p>
                    </div>
                    
                    {role === 'parent' ? (
                      <>
                        <Link 
                          to="/parent-dashboard" 
                          className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-plaeen-green rounded-xl transition-all"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <Shield size={16} /> Command Center
                        </Link>
                        <Link 
                          to="/parent/approvals" 
                          className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-plaeen-green rounded-xl transition-all"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <CheckCircle size={16} /> Approvals
                        </Link>
                        <Link 
                          to="/parent/activity" 
                          className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-plaeen-green rounded-xl transition-all"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <Activity size={16} /> Activity
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link 
                          to="/kid-dashboard" 
                          className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-plaeen-green rounded-xl transition-all"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <LayoutDashboard size={16} /> My Hub
                        </Link>
                        <Link 
                          to="/teams" 
                          className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-plaeen-green rounded-xl transition-all"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <Users size={16} /> My Teams
                        </Link>
                        <Link 
                          to="/search" 
                          className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-plaeen-green rounded-xl transition-all"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <Search size={16} /> Explore
                        </Link>
                      </>
                    )}
                    
                    <Link 
                      to="/profile" 
                      className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-plaeen-green rounded-xl transition-all"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Settings size={16} /> Settings
                    </Link>
                    
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <button 
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <LogOut size={16} /> Terminate Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="font-bold uppercase tracking-widest px-6">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};
