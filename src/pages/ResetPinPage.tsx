import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Heading, Text, Label } from "@/components/atoms";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Card } from "../components/molecules/Card";
import { Button } from "../components/atoms/Button";
import { Shield, Check, ArrowRight, Lock } from "lucide-react";
import { motion } from "framer-motion";

export const ResetPinPage = () => {
  const [searchParams] = useSearchParams();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const navigate = useNavigate();
  const token = searchParams.get("token");

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Invalid or missing reset token.");
        setIsValidating(false);
        return;
      }

      // In a real app, you'd check the 'pinResets' collection for the token and matching userId
      // For this demo/request, we assume the token is just the userId for simplicity of logic demonstration
      // but we still fetch the user to make sure they exist
      try {
        const userDoc = await getDoc(doc(db, "users", token));
        if (userDoc.exists()) {
          setUserId(token);
        } else {
          setError("This reset link is invalid or has expired.");
        }
      } catch (err) {
        setError("Security system error. Please try again later.");
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    if (!userId) return;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        guardianPin: newPin,
      });
      setIsSuccess(true);
    } catch (err) {
      setError("Failed to update secure PIN. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-plaeen-dark flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-plaeen-green border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 font-bold uppercase  text-xs">
            Decrypting Protocol...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-plaeen-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 p-8 flex justify-center z-10">
        <img src="/logo/logo.png" alt="Plaeen" className="h-12 w-auto" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-plaeen-purple/20 border-white/10 p-10 backdrop-blur-2xl">
          {isSuccess ? (
            <div className="text-center space-y-8">
              <div className="h-20 w-20 bg-plaeen-green rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(118,233,0,0.5)]">
                <Check size={40} className="text-black" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white uppercase  mb-2">
                  PIN <span className="text-plaeen-green">Updated</span>
                </h2>
                <p className="text-white/40 text-[10px] font-bold uppercase ">
                  Access protocols have been reset
                </p>
              </div>
              <p className="text-white/60 text-sm font-medium ">
                Your new parental PIN has been successfully saved to the
                encrypted mainframe. You can now access your profile.
              </p>
              <Button
                onClick={() => navigate("/select-profile")}
                className="w-full py-6 font-bold uppercase  shadow-[0_0_30px_rgba(118,233,0,0.3)] flex items-center justify-center gap-2"
              >
                Go to Profile Selection <ArrowRight size={18} />
              </Button>
            </div>
          ) : error ? (
            <div className="text-center space-y-8">
              <Shield
                size={64}
                className="text-red-500 mx-auto"
                opacity={0.5}
              />
              <div>
                <h2 className="text-3xl font-bold text-white uppercase  mb-2">
                  Protocol <span className="text-red-500">Error</span>
                </h2>
                <p className="text-white/40 text-[10px] font-bold uppercase ">
                  Security breach or timeout
                </p>
              </div>
              <p className="text-red-400/80 text-sm font-bold uppercase ">
                {error}
              </p>
              <Button
                onClick={() => navigate("/select-profile")}
                variant="outline"
                className="w-full border-white/10 text-white/40 hover:text-white uppercase  py-6"
              >
                Back to Logistics
              </Button>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="text-center">
                <Lock size={48} className="text-plaeen-green mx-auto mb-6" />
                <h2 className="text-3xl font-bold text-white uppercase  mb-2">
                  New <span className="text-plaeen-green">PIN</span>
                </h2>
                <p className="text-white/40 text-[10px] font-bold uppercase ">
                  Configure administrative access
                </p>
              </div>

              <form onSubmit={handleReset} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-plaeen-green uppercase  ml-1">
                      New 4-Digit PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={newPin}
                      placeholder="••••"
                      onChange={(e) =>
                        setNewPin(e.target.value.replace(/\D/g, ""))
                      }
                      className="w-full bg-white/5 border-2 border-white/5 rounded-2xl px-6 py-5 text-2xl text-center font-bold  text-white focus:border-plaeen-green focus:outline-none transition-all placeholder:text-white/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-plaeen-green uppercase  ml-1">
                      Confirm PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={confirmPin}
                      placeholder="••••"
                      onChange={(e) =>
                        setConfirmPin(e.target.value.replace(/\D/g, ""))
                      }
                      className="w-full bg-white/5 border-2 border-white/5 rounded-2xl px-6 py-5 text-2xl text-center font-bold  text-white focus:border-plaeen-green focus:outline-none transition-all placeholder:text-white/10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || newPin.length !== 4}
                  className="w-full py-6 font-bold uppercase  shadow-[0_0_30px_rgba(118,233,0,0.3)]"
                >
                  {isSubmitting ? "Updating Core..." : "Update Parental PIN"}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-plaeen-green/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
};
