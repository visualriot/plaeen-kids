import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  Gamepad2, 
  Users, 
  Calendar, 
  Heart, 
  Search, 
  Bell, 
  User as UserIcon,
  LogOut,
  Shield,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  Users2,
  Compass,
  RefreshCw
} from 'lucide-react';
import { Button } from './Button';
import { useProfile } from '../contexts/ProfileContext';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar = () => {
  const [user] = useAuthState(auth);
  const { role, activeKid, logoutProfile } = useProfile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    auth.signOut();
    logoutProfile();
    navigate('/auth');
  };

  const handleSwitchProfile = () => {
    logoutProfile();
    navigate('/select-profile');
  };

  const kidNavLinks = [
    { name: 'Hub', path: '/kid-dashboard', icon: LayoutDashboard },
    { name: 'Teams', path: '/teams', icon: Users2 },
    { name: 'Friends', path: '/friends', icon: Users },
    { name: 'My Games', path: '/my-games', icon: Gamepad2 },
  ];

  const parentNavLinks = [
    { name: 'Guardian Hub', path: '/parent-dashboard', icon: Shield },
    { name: 'Approvals', path: '/parent/approvals', icon: Bell },
    { name: 'Activity', path: '/parent/activity', icon: Calendar },
  ];

  const navLinks = role === 'kid' ? kidNavLinks : parentNavLinks;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-plaeen-dark/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo & Main Nav */}
        <div className="flex items-center gap-12">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="Plaeen" className="h-10 w-auto group-hover:scale-110 transition-transform" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  location.pathname === link.path 
                    ? 'text-plaeen-green bg-plaeen-green/10' 
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <button className="p-2 text-white/40 hover:text-white transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]" />
            </button>
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 p-1 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="h-10 w-10 rounded-xl overflow-hidden border-2 border-plaeen-green/30">
                <img 
                  src={activeKid?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                  alt="Profile" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="hidden sm:block text-left pr-2">
                <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-none mb-1">
                  {activeKid?.displayName || user?.displayName || 'User'}
                </p>
                <p className="text-[8px] font-bold text-plaeen-green uppercase tracking-widest leading-none">
                  {role === 'kid' ? 'Gamer' : 'Guardian'}
                </p>
              </div>
              <ChevronDown size={14} className={`text-white/20 mr-2 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-64 rounded-2xl bg-plaeen-dark border border-white/10 shadow-2xl p-2 z-20 backdrop-blur-xl"
                  >
                    <div className="p-4 border-b border-white/5 mb-2">
                      <p className="text-xs font-bold text-white uppercase tracking-widest">Account Settings</p>
                    </div>
                    
                    <button 
                      onClick={handleSwitchProfile}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/60 hover:text-plaeen-green hover:bg-plaeen-green/5 transition-all uppercase tracking-widest"
                    >
                      <RefreshCw size={16} /> Switch Profile
                    </button>
                    
                    <Link 
                      to={role === 'kid' ? '/profile' : '/parent/settings'}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest"
                    >
                      <UserIcon size={16} /> Settings
                    </Link>

                    <div className="h-px bg-white/5 my-2 mx-4" />

                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-400/5 transition-all uppercase tracking-widest"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 text-white/40 hover:text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-white/5 bg-plaeen-dark/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="p-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-4 p-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all ${
                    location.pathname === link.path 
                      ? 'text-plaeen-green bg-plaeen-green/10' 
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <link.icon size={20} />
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
