import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { auth, db } from "@/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        const newUser = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          role: "parent",
          linkedKids: [],
          friends: [],
          wishlist: [],
          availability: {},
          screenTime: {
            dailyAllowance: 120,
            usedToday: 0,
          },
        };
        await setDoc(doc(db, "users", user.uid), newUser);
        navigate("/parent-dashboard");
      } else {
        const userData = userDoc.data();
        if (userData?.role === "parent") {
          navigate("/parent-dashboard");
        } else {
          navigate("/kid-dashboard");
        }
      }
    } catch (err) {
      setError("Failed to sign in with Google");
      console.error(err);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        const userData = userDoc.data();
        if (userData?.role === "parent") {
          navigate("/parent-dashboard");
        } else {
          navigate("/kid-dashboard");
        }
      } else {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const newUser = {
          uid: result.user.uid,
          displayName: email.split("@")[0],
          email: email,
          role: "parent",
          linkedKids: [],
          friends: [],
          wishlist: [],
          availability: {},
          screenTime: {
            dailyAllowance: 120,
            usedToday: 0,
          },
        };
        await setDoc(doc(db, "users", result.user.uid), newUser);
        navigate("/parent-dashboard");
      }
    } catch (err) {
      setError("Authentication failed. Please check your credentials.");
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-[90vh] items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(118,233,0,0.05)_0%,transparent_50%)]" />

      <Card className="w-full max-w-md p-10 bg-plaeen-purple/20 border-white/10 backdrop-blur-2xl relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.3)]">
        <div className="flex justify-center mb-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.5)]">
            <span className="text-3xl font-bold">P</span>
          </div>
        </div>

        <h2 className="text-4xl font-bold text-center mb-2 uppercase tracking-tighter">
          Welcome to <span className="text-plaeen-green">Plaeen</span>
        </h2>
        <p className="text-white/40 text-center mb-10 font-bold uppercase tracking-[0.3em] text-[10px]">
          Access the futuristic gaming hub
        </p>

        <Button
          variant="outline"
          className="w-full flex items-center justify-center gap-4 mb-8 bg-white/5 border-white/10 text-white hover:bg-white/10 py-6 font-bold uppercase tracking-widest"
          onClick={handleGoogleSignIn}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-6 h-6"
          />
          Continue with Google
        </Button>

        <div className="relative flex items-center gap-6 mb-8">
          <div className="flex-1 h-[1px] bg-white/5" />
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
            or
          </span>
          <div className="flex-1 h-[1px] bg-white/5" />
        </div>

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
              className="w-full rounded-xl border-2 border-white/5 bg-white/5 pl-12 pr-4 py-5 text-white font-bold placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase tracking-widest text-sm"
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
              className="w-full rounded-xl border-2 border-white/5 bg-white/5 pl-12 pr-12 py-5 text-white font-bold placeholder:text-white/10 focus:border-plaeen-green focus:outline-none transition-all uppercase tracking-widest text-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center uppercase tracking-widest">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full py-6 font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(118,233,0,0.2)]"
          >
            {isLogin ? "Initialize Session" : "Create Profile"}
          </Button>
        </form>

        <div className="mt-10 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-bold text-white/40 hover:text-plaeen-green transition-all uppercase tracking-[0.2em]"
          >
            {isLogin
              ? "New to the sector? Create account"
              : "Already registered? Log in"}
          </button>
        </div>

        <div className="mt-10 pt-10 border-t border-white/5 text-center">
          <p className="text-[8px] text-white/20 uppercase tracking-[0.3em] leading-relaxed">
            By accessing the hub you agree to our{" "}
            <span className="text-white/40 underline cursor-pointer">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="text-white/40 underline cursor-pointer">
              Privacy Protocol
            </span>
          </p>
        </div>
      </Card>
    </div>
  );
};
