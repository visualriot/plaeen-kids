import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth } from "@/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
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
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/atoms";
import { useProfile } from "@/contexts/ProfileContext";
import { motion, AnimatePresence } from "framer-motion";
import { formatName, getUserAvatar } from "@/lib/utils";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import { NotificationPanel } from "@/components/organisms";

export const Navbar = () => {
  const [user] = useAuthState(auth);
  const { role, activeKid, parentProfile, isParentViewingKid, logoutProfile } =
    useProfile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const activeUid = activeKid?.uid || (role === "parent" ? user?.uid : null);

  const avatarUrl = activeKid
    ? activeKid.photoURL
    : parentProfile?.photoURL || user?.photoURL;
  const displayName = activeKid
    ? activeKid.displayName
    : parentProfile?.displayName || user?.displayName || "User";

  useEffect(() => {
    setUnreadCount(0);
    if (!activeUid) return;

    let q;
    if (isParentViewingKid) {
      q = query(
        collection(db, "notifications"),
        where("userId", "==", activeUid),
        where("parentId", "==", user?.uid),
        where("read", "==", false),
      );
    } else {
      q = query(
        collection(db, "notifications"),
        where("userId", "==", activeUid),
        where("read", "==", false),
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [activeUid, user, isParentViewingKid]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isUserMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
        isNotificationsOpen &&
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen, isNotificationsOpen]);

  const handleLogout = () => {
    auth.signOut();
    logoutProfile();
    navigate("/auth");
  };

  const handleSwitchProfile = () => {
    logoutProfile();
    navigate("/select-profile");
  };

  const kidNavLinks = [
    { name: "Hub", path: "/kid-dashboard", icon: LayoutDashboard },
    { name: "Teams", path: "/teams", icon: Users2 },
    { name: "Friends", path: "/friends", icon: Users },
    { name: "Games", path: "/my-games", icon: Gamepad2 },
  ];

  const parentNavLinks = [
    { name: "Guardian Hub", path: "/parent-dashboard", icon: Shield },
    { name: "Approvals", path: "/parent/approvals", icon: Bell },
    { name: "Activity", path: "/parent/activity", icon: Calendar },
  ];

  const navLinks = role === "kid" ? kidNavLinks : parentNavLinks;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-plaeen-dark/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo & Main Nav */}
        <div className="flex items-center gap-12">
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/logo/logo.png"
              alt="Plaeen"
              className="h-10 w-auto group-hover:scale-95 transition-transform"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-radius-md font-semibold text-sm uppercase tracking-widest transition-all ${
                  location.pathname === link.path
                    ? "text-plaeen-green "
                    : "text-neutral-300 hover:text-white"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          <div
            className="hidden md:flex items-center gap-2 relative"
            ref={notificationsRef}
          >
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`p-2 transition-colors relative ${isNotificationsOpen ? "text-plaeen-green" : "text-white/40 hover:text-white hover:scale-95 transition-all"}`}
            >
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]" />
              )}
            </button>

            {activeUid && (
              <NotificationPanel
                userId={activeUid}
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
              />
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="h-14 w-14 rounded-xl overflow-hidden border-2 border-plaeen-green/30">
                <img
                  src={getUserAvatar(avatarUrl)}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="hidden sm:block text-left pr-2">
                <p className=" font-bold text-white uppercase ">
                  {formatName(displayName)}
                </p>
                <p className="text-sm  text-white/60">
                  {role === "kid" ? "Gamer" : "Guardian"}
                </p>
              </div>
              <ChevronDown
                size={20}
                fill="currentColor"
                className={`text-white/80 font-bold transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-64 rounded-2xl bg-plaeen-dark border border-white/10 shadow-2xl p-2 z-[70] backdrop-blur-xl"
                >
                  <button
                    onClick={handleSwitchProfile}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium tracking-wider text-white/80 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <RefreshCw size={16} /> Switch Profile
                  </button>

                  <Link
                    to="/kid-calendar"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium tracking-wider text-white/80 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <Calendar size={16} /> Calendar
                  </Link>

                  <Link
                    to={role === "kid" ? "/profile" : "/parent/settings"}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium tracking-wider text-white/80 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <UserIcon size={16} /> Settings
                  </Link>

                  <div className="h-px bg-white/10 my-2 mx-4" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs !text-white/60 hover:!text-white hover:bg-red-400/5 transition-all"
                  >
                    <LogOut size={16} /> Sign out of Plaeen
                  </button>
                </motion.div>
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
        s
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-white/5 bg-plaeen-dark/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="p-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-4 p-4 rounded-2xl text-sm font-bold uppercase  transition-all ${
                    location.pathname === link.path
                      ? "text-plaeen-green bg-plaeen-green/10"
                      : "text-white/40 hover:text-white hover:bg-white/5"
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
