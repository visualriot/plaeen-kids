import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { Heading, Text, Label } from "@/components/atoms";
import { auth, db } from "@/firebase";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "signin"; // "signin" or "signup"
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isSignUp = mode === "signup";

  const createUserProfile = async (user: any) => {
    const newUser = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split("@")[0] || "Parent",
      email: user.email,
      photoURL: user.photoURL,
      role: "parent",
      onboardingComplete: false,
      linkedKids: [],
      friends: [],
      wishlist: [],
      availability: {},
    };
    await setDoc(doc(db, "users", user.uid), newUser, { merge: true });

    // Create public profile
    await setDoc(
      doc(db, "users_public", user.uid),
      {
        uid: user.uid,
        displayName: newUser.displayName,
        photoURL: newUser.photoURL,
        role: "parent",
      },
      { merge: true },
    );
  };

  const handleNavigateAfterAuth = async (user: any) => {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    if (!userData?.onboardingComplete) {
      navigate("/onboarding");
    } else if (userData?.role === "parent") {
      navigate("/select-profile");
    } else {
      navigate("/kid-dashboard");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await createUserProfile(user);
      }
      await handleNavigateAfterAuth(user);
    } catch (err) {
      const error = err as any;
      const errorMessage =
        error?.code === "auth/cancelled-popup-request"
          ? "Sign in was cancelled"
          : error?.code === "auth/popup-blocked"
            ? "Pop-up was blocked. Please allow pop-ups and try again"
            : "Failed to sign in with Google";
      setError(errorMessage);
      console.error("Google Sign In Error Code:", error?.code);
    }
  };

  const handleGameCenterSignIn = async () => {
    try {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await createUserProfile(user);
      }
      await handleNavigateAfterAuth(user);
    } catch (err) {
      const error = err as any;
      const errorMessage =
        error?.code === "auth/cancelled-popup-request"
          ? "Sign in was cancelled"
          : error?.code === "auth/popup-blocked"
            ? "Pop-up was blocked. Please allow pop-ups and try again"
            : "Failed to sign in with Game Center";
      setError(errorMessage);
      console.error("Game Center Sign In Error Code:", error?.code);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isSignUp) {
        // Sign Up mode
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await createUserProfile(result.user);
        navigate("/onboarding");
      } else {
        // Sign In mode
        const result = await signInWithEmailAndPassword(auth, email, password);
        await handleNavigateAfterAuth(result.user);
      }
    } catch (err) {
      const error = err as any;
      let errorMessage =
        "Authentication failed. Please check your credentials.";

      if (error?.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error?.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error?.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists.";
      } else if (error?.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Use at least 6 characters.";
      }

      setError(errorMessage);
      console.error("Auth Error Code:", error?.code);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 relative overflow-hidden">
      <nav className="absolute top-0 w-full z-50 px-6 py-8 flex justify-between items-center max-w-7xl left-1/2 -translate-x-1/2">
        <div className="flex flex-row items-center gap-2 z-30">
          <img src="/logo/logo.svg" alt="Plaeen" className="h-12" />
          <img src="/logo/text.svg" alt="Plaeen text" className="h-8 w-auto" />
        </div>
      </nav>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <img
          src="/backgrounds/bg_auth_01.png"
          alt="Background"
          className="h-full w-full object-cover object-[50%_100%] opacity-80 scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-plaeen-dark opacity-70" />
        {/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(0,0,0,1)_100%)]" /> */}
      </div>
      {/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(118,233,0,0.05)_0%,transparent_50%)]" /> */}

      <Card className="w-full max-w-md p-10 space-y-4">
        <Heading level={2} className="mb-6">
          {isSignUp ? (
            <>
              <span className="text-white">Sign Up for</span> Plaeen
            </>
          ) : (
            <>
              <span className="text-plaeen-green">Sign In</span>
            </>
          )}
        </Heading>

        {/* Social Sign-In Options */}
        <Button
          type="button"
          variant="glass"
          className="w-full flex items-center justify-center gap-4 mb-4"
          size="md"
          onClick={handleGoogleSignIn}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-6 h-6"
          />
          Continue with Google
        </Button>

        <Button
          type="button"
          variant="glass"
          className="w-full flex items-center justify-center gap-4 mb-8"
          onClick={handleGameCenterSignIn}
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/9/96/Game_Center_icon.svg"
            alt="Game Center"
            className="w-6 h-6"
          />
          Continue with Game Center
        </Button>

        <div className="relative flex items-center gap-6 mb-8">
          <div className="flex-1 h-[1px] bg-white/15" />
          <Text variant="caption" as="span" className="text-white/80">
            or
          </Text>
          <div className="flex-1 h-[1px] bg-white/15" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-6">
          <div className="relative group">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-plaeen-green transition-colors"
              size={20}
            />
            <input
              type="email"
              placeholder="EMAIL ADDRESS"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border-2 border-white/5 bg-white/5 pl-12 pr-4 py-5 text-white font-bold placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase text-sm"
              required
            />
          </div>

          <div className="relative group">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-plaeen-green transition-colors"
              size={20}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border-2 border-white/5 bg-white/5 pl-12 pr-12 py-5 text-white font-bold placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase text-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
            >
              {showPassword ? <Eye size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-center">
              <Text variant="caption" className="!text-red-400">
                {error}
              </Text>
            </div>
          )}

          <Button
            type="submit"
            className="w-full py-6 font-bold uppercase shadow-[0_0_20px_rgba(118,233,0,0.2)]"
          >
            {isSignUp ? "Create Account >" : "Sign In"}
          </Button>
        </form>

        {/* Footer Links */}
        <div className="mt-10 text-center">
          {isSignUp ? (
            <Text as="div" variant="body" color="secondary">
              Already have an account?{" "}
              <Button
                onClick={() => navigate("/auth?mode=signin")}
                variant="tertiary"
                className="p-0 !text-white hover:!text-plaeen-green"
              >
                Sign In
              </Button>
            </Text>
          ) : (
            <Text as="div" variant="body" color="secondary">
              New to Plaeen?{" "}
              <Button
                onClick={() => navigate("/auth?mode=signup")}
                variant="tertiary"
                className="p-0 !text-white hover:!text-plaeen-green"
              >
                Sign Up Now
              </Button>
            </Text>
          )}
        </div>

        {isSignUp && (
          <div className="mt-10 pt-10 border-t border-white/20 text-center">
            <Text variant="caption" color="secondary">
              By creating an account, you agree to the{" "}
              <span className="text-white/80 hover:underline transition-all ease-in-out cursor-pointer">
                Terms of Service
              </span>
              .
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};
