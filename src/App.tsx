import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase';
import { Navbar } from './components/Navbar';
import { Card } from './components/Card';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { TeamsPage } from './pages/TeamsPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { TeamGameDetailPage } from './pages/TeamGameDetailPage';
import { GameSearchPage } from './pages/GameSearchPage';
import { FriendsPage } from './pages/FriendsPage';
import { ProfilePage } from './pages/ProfilePage';
import { WishlistPage } from './pages/WishlistPage';
import { CalendarPage } from './pages/CalendarPage';
import { ParentDashboard } from './pages/ParentDashboard';
import { KidDashboard } from './pages/KidDashboard';
import { ChildManagementPage } from './pages/ChildManagementPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { ParentActivityPage } from './pages/ParentActivityPage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;

  return <>{children}</>;
};

const Home = () => {
  const [user, loading] = useAuthState(auth);
  const [role, setRole] = React.useState<string | null>(null);
  const [roleLoading, setRoleLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchRole = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        setRole(userDoc.data()?.role || 'parent');
      }
      setRoleLoading(false);
    };
    fetchRole();
  }, [user]);

  if (loading || (user && roleLoading)) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (!user) return <LandingPage />;
  
  return role === 'parent' ? <Navigate to="/parent-dashboard" /> : <Navigate to="/kid-dashboard" />;
};

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-plaeen-dark text-white font-sans selection:bg-plaeen-green selection:text-black">
        <Navbar />
        <main className="relative z-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/parent-dashboard"
              element={
                <ProtectedRoute>
                  <ParentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kid-dashboard"
              element={
                <ProtectedRoute>
                  <KidDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parent/child/:childId"
              element={
                <ProtectedRoute>
                  <ChildManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parent/approvals"
              element={
                <ProtectedRoute>
                  <ApprovalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parent/activity"
              element={
                <ProtectedRoute>
                  <ParentActivityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams"
              element={
                <ProtectedRoute>
                  <TeamsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams/:teamId"
              element={
                <ProtectedRoute>
                  <TeamDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams/:teamId/games/:gameId"
              element={
                <ProtectedRoute>
                  <TeamGameDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <FriendsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wishlist"
              element={
                <ProtectedRoute>
                  <WishlistPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <GameSearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        
        <footer className="mt-20 border-t border-white/10 py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-plaeen-green text-black">
              <span className="text-xl font-bold">P</span>
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white">PLAEEN</span>
          </div>
          <div className="flex justify-center gap-8 text-xs font-medium text-white/40">
            <a href="#" className="hover:text-white">Cookie Policy</a>
            <a href="#" className="hover:text-white">Terms of Use</a>
            <a href="#" className="hover:text-white">Plaeen & Privacy</a>
            <a href="#" className="hover:text-white">Contact Us</a>
          </div>
          <p className="mt-8 text-[10px] text-white/20">2024 Plaeen. All Rights Reserved.</p>
        </footer>
      </div>
    </Router>
  );
}
