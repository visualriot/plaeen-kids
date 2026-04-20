import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { TeamsPage } from "./pages/TeamsPage";
import { TeamDetailPage } from "./pages/TeamDetailPage";
import { TeamSettingsPage } from "./pages/TeamSettingsPage";
import { TeamGameDetailPage } from "./pages/TeamGameDetailPage";
import { GameSearchPage } from "./pages/GameSearchPage";
import { FriendsPage } from "./pages/FriendsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { MyGamesPage } from "./pages/MyGamesPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ParentDashboard } from "./pages/ParentDashboard";
import { KidDashboard } from "./pages/KidDashboard";
import { ChildManagementPage } from "./pages/ChildManagementPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { ParentActivityPage } from "./pages/ParentActivityPage";
import { OvertimeDecisionPage } from "./pages/OvertimeDecisionPage";
import { ProfileSelectionPage } from "./pages/ProfileSelectionPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ResetPinPage } from "./pages/ResetPinPage";
import { KidCalendarPage } from "./pages/KidCalendarPage";
import { ProposeSessionPage } from "./pages/ProposeSessionPage";
import { UserAvatarSelectionPage } from "./pages/UserAvatarSelectionPage";
import { TeamAvatarSelectionPage } from "./pages/TeamAvatarSelectionPage";
import { CreateTeamPage } from "./pages/CreateTeamPage";
import { ProfileProvider, useProfile } from "./contexts/ProfileContext";

import { ParentSettingsPage } from "./pages/ParentSettingsPage";

const ProtectedRoute = ({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole?: "parent" | "kid";
}) => {
  const [user, loading] = useAuthState(auth);
  const { role, isLoading, parentProfile } = useProfile();

  if (loading || isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">
        Loading...
      </div>
    );
  if (!user) return <Navigate to="/auth" />;

  if (
    parentProfile &&
    !parentProfile.onboardingComplete &&
    window.location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" />;
  }

  if (
    role === "none" &&
    window.location.pathname !== "/select-profile" &&
    window.location.pathname !== "/onboarding" &&
    window.location.pathname !== "/avatar-selection" &&
    window.location.pathname !== "/team-avatar-selection"
  ) {
    return <Navigate to="/select-profile" />;
  }

  // If role doesn't match the page's requirement
  if (allowedRole && role !== allowedRole) {
    if (role === "kid") return <Navigate to="/kid-dashboard" />;
    if (role === "parent") return <Navigate to="/parent-dashboard" />;
    return <Navigate to="/select-profile" />;
  }

  return <>{children}</>;
};

const Home = () => {
  const [user, loading] = useAuthState(auth);
  const { role, isLoading, parentProfile } = useProfile();

  if (loading || isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">
        Loading...
      </div>
    );

  if (!user) return <LandingPage />;

  if (parentProfile && !parentProfile.onboardingComplete)
    return <Navigate to="/onboarding" />;
  if (
    role === "none" ||
    window.location.pathname === "/avatar-selection" ||
    window.location.pathname === "/team-avatar-selection"
  )
    return <Navigate to="/select-profile" />;
  if (role === "kid") return <Navigate to="/kid-dashboard" />;
  if (role === "parent") return <Navigate to="/parent-dashboard" />;

  return <Navigate to="/select-profile" />;
};

export default function App() {
  return (
    <Router>
      <ProfileProvider>
        <AppContent />
      </ProfileProvider>
    </Router>
  );
}

function AppContent() {
  const [user, loading] = useAuthState(auth);
  const { role, isLoading } = useProfile();
  const location = useLocation();

  if (loading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/logo/logo.png"
            alt="Plaeen"
            className="h-12 w-auto animate-pulse"
          />
          <p className="text-white/40 font-bold uppercase tracking-widest text-xs">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Hide main navbar on auth, onboarding, and profile selection pages
  const isAuthPage = location.pathname === "/auth";
  const isOnboardingPage = location.pathname === "/onboarding";
  const isProfileSelectionPage = location.pathname === "/select-profile";
  const isAvatarSelectionPage =
    location.pathname === "/avatar-selection" ||
    location.pathname === "/team-avatar-selection";

  const showNavbar =
    user &&
    role !== "none" &&
    !isAuthPage &&
    !isOnboardingPage &&
    !isProfileSelectionPage &&
    !isAvatarSelectionPage;

  return (
    <div className="min-h-screen bg-plaeen-dark text-white font-sans selection:bg-plaeen-green selection:text-black">
      {showNavbar && <Navbar />}
      <main className="relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/onboarding"
            element={
              user || loading ? <OnboardingPage /> : <Navigate to="/auth" />
            }
          />
          <Route
            path="/select-profile"
            element={
              user || loading ? (
                <ProfileSelectionPage />
              ) : (
                <Navigate to="/auth" />
              )
            }
          />
          <Route path="/reset-pin" element={<ResetPinPage />} />
          <Route
            path="/kid-calendar"
            element={user ? <KidCalendarPage /> : <Navigate to="/auth" />}
          />
          <Route
            path="/notifications"
            element={user ? <NotificationsPage /> : <Navigate to="/auth" />}
          />

          {/* Kid Routes */}
          <Route
            path="/kid-dashboard"
            element={
              <ProtectedRoute allowedRole="kid">
                <KidDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute allowedRole="kid">
                <TeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/create"
            element={
              <ProtectedRoute allowedRole="kid">
                <CreateTeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamId"
            element={
              <ProtectedRoute allowedRole="kid">
                <TeamDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamId/settings"
            element={
              <ProtectedRoute allowedRole="kid">
                <TeamSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamId/games/:gameId"
            element={
              <ProtectedRoute allowedRole="kid">
                <TeamGameDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/:teamId/propose"
            element={
              <ProtectedRoute allowedRole="kid">
                <ProposeSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute allowedRole="kid">
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-games"
            element={
              <ProtectedRoute allowedRole="kid">
                <MyGamesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute allowedRole="kid">
                <GameSearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute allowedRole="kid">
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRole="kid">
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/avatar-selection"
            element={
              <ProtectedRoute>
                <UserAvatarSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team-avatar-selection"
            element={
              <ProtectedRoute>
                <TeamAvatarSelectionPage />
              </ProtectedRoute>
            }
          />

          {/* Parent Routes */}
          <Route
            path="/parent-dashboard"
            element={
              <ProtectedRoute allowedRole="parent">
                <ParentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/child/:childId"
            element={
              <ProtectedRoute allowedRole="parent">
                <ChildManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/overtime-decision/:approvalId"
            element={
              <ProtectedRoute allowedRole="parent">
                <OvertimeDecisionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/approvals"
            element={
              <ProtectedRoute allowedRole="parent">
                <ApprovalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/activity"
            element={
              <ProtectedRoute allowedRole="parent">
                <ParentActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/settings"
            element={
              <ProtectedRoute allowedRole="parent">
                <ParentSettingsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {!user || role === "none" ? null : (
        <footer className="mt-20 border-t border-white/10 py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src="/logo/logo.png" alt="Plaeen" className="h-8 w-auto" />
          </div>
          <div className="flex justify-center gap-8 text-xs font-medium text-white/40">
            <a href="#" className="hover:text-white">
              Cookie Policy
            </a>
            <a href="#" className="hover:text-white">
              Terms of Use
            </a>
            <a href="#" className="hover:text-white">
              Plaeen & Privacy
            </a>
            <a href="#" className="hover:text-white">
              Contact Us
            </a>
          </div>
          <p className="mt-8 text-[10px] text-white/20">
            2024 Plaeen. All Rights Reserved.
          </p>
        </footer>
      )}
    </div>
  );
}
