import React, { useState, useEffect } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { auth, db } from "@/firebase";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { useProfile } from "@/contexts/ProfileContext";
import {
  Shield,
  Lock,
  Check,
  X,
  ChevronLeft,
  Calendar,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const ParentSettingsPage = () => {
  const { parentProfile, isLoading, logoutProfile } = useProfile();
  const [user] = useAuthState(auth);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<"Mon" | "Sun">("Mon");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Account Deletion State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<0 | 1 | 2>(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (parentProfile?.guardianPin) {
      setPin(parentProfile.guardianPin);
    }
    if (parentProfile?.firstDayOfWeek) {
      setFirstDayOfWeek(parentProfile.firstDayOfWeek);
    }
  }, [parentProfile]);

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-plaeen-dark text-white">
        Loading...
      </div>
    );
  if (!parentProfile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", parentProfile.uid), {
        guardianPin: pin,
        firstDayOfWeek: firstDayOfWeek,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePermanentDeletion = async () => {
    if (!parentProfile || !user) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      const kidIds = parentProfile.linkedKids || [];
      const uidsToDelete = [parentProfile.uid, ...kidIds];

      // Helper to handle "in" query limit of 10
      const chunkArray = (arr: string[], size: number) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const uidChunks = chunkArray(uidsToDelete, 10);

      // 1. Delete notifications
      // Query notifications where parent is the intended recipient or responsible parent
      const parentNotifSnap = await getDocs(
        query(
          collection(db, "notifications"),
          where("parentId", "==", parentProfile.uid),
        ),
      );
      parentNotifSnap.forEach((d) => batch.delete(d.ref));

      // Also delete notifications explicitly assigned to the parent's UID
      const ownNotifSnap = await getDocs(
        query(
          collection(db, "notifications"),
          where("userId", "==", parentProfile.uid),
        ),
      );
      ownNotifSnap.forEach((d) => batch.delete(d.ref));

      // 2. Delete approvals
      // Querying by parentId is guaranteed to work for parents
      const approvalParentSnap = await getDocs(
        query(
          collection(db, "approvals"),
          where("parentId", "==", parentProfile.uid),
        ),
      );
      approvalParentSnap.forEach((d) => batch.delete(d.ref));

      // 3. Delete sessions
      // Sessions also have parentId
      const sessionParentSnap = await getDocs(
        query(
          collection(db, "sessions"),
          where("parentId", "==", parentProfile.uid),
        ),
      );
      sessionParentSnap.forEach((d) => batch.delete(d.ref));

      // Also delete sessions where kidId matches (for complete cleanup if parentId was missing)
      if (kidIds.length > 0) {
        const kidChunks = chunkArray(kidIds, 10);
        for (const chunk of kidChunks) {
          const sessionKidSnap = await getDocs(
            query(collection(db, "sessions"), where("childId", "in", chunk)),
          );
          sessionKidSnap.forEach((d) => batch.delete(d.ref));
        }
      }

      // 4. Delete friends requests
      const frFromParentSnap = await getDocs(
        query(
          collection(db, "friendRequests"),
          where("fromParentId", "==", parentProfile.uid),
        ),
      );
      frFromParentSnap.forEach((d) => batch.delete(d.ref));
      const frToParentSnap = await getDocs(
        query(
          collection(db, "friendRequests"),
          where("toParentId", "==", parentProfile.uid),
        ),
      );
      frToParentSnap.forEach((d) => batch.delete(d.ref));

      // Also delete based on direct UID just in case (legacy or parent's own requests)
      const frOwnFromSnap = await getDocs(
        query(
          collection(db, "friendRequests"),
          where("fromId", "==", parentProfile.uid),
        ),
      );
      frOwnFromSnap.forEach((d) => batch.delete(d.ref));
      const frOwnToSnap = await getDocs(
        query(
          collection(db, "friendRequests"),
          where("toId", "==", parentProfile.uid),
        ),
      );
      frOwnToSnap.forEach((d) => batch.delete(d.ref));

      // 5. Delete users_public
      uidsToDelete.forEach((id) => {
        batch.delete(doc(db, "users_public", id));
      });

      // 6. Delete users (main profiles)
      uidsToDelete.forEach((id) => {
        batch.delete(doc(db, "users", id));
      });

      // 7. Delete groups owned by parent or kids
      const groupsOwnedSnap = await getDocs(
        query(collection(db, "groups"), where("ownerId", "in", uidsToDelete)),
      );
      groupsOwnedSnap.forEach((d) => batch.delete(d.ref));

      await batch.commit();

      // 8. Clear all memory and state
      logoutProfile();
      sessionStorage.clear();
      localStorage.clear();

      // 9. Delete Auth account or at least sign out
      try {
        // user.delete() is best but often requires fresh token
        await user.delete();
      } catch (authErr) {
        console.warn(
          "Auth deletion failed - usually requires fresh login. Signing out instead.",
          authErr,
        );
        await auth.signOut();
      }

      // 10. Redirect to landing page and force full state reset
      window.location.replace("/");
    } catch (err) {
      console.error("CRITICAL: Account deletion failed:", err);
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setDeleteConfirmStep(0);
      alert(
        "Account deletion failed. This usually happens due to security permissions or a lost connection. Your data might still be present.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <button
        onClick={() => navigate("/parent-dashboard")}
        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-12 font-bold uppercase  text-[10px]"
      >
        <ChevronLeft size={16} /> Back to Guardian Hub
      </button>

      <div className="mb-12">
        <h1 className="font-display text-5xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
          <span className="text-plaeen-green">Settings</span>
        </h1>
        <p className="text-white/40 font-bold uppercase  text-xs mt-2">
          Manage your parental access
        </p>
      </div>

      <Card className="bg-white/5 border-white/10 p-10">
        <div className="flex items-center gap-6 mb-12">
          <div className="h-16 w-16 rounded-2xl bg-plaeen-green/10 flex items-center justify-center">
            <Lock size={32} className="text-plaeen-green" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">
              Parental PIN
            </h2>
            <p className="text-white/40 text-xs font-bold uppercase  mt-1">
              Required for guardian profile access
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-12">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <label className="text-[10px] font-bold uppercase  text-plaeen-green mb-4 block">
                4-Digit PIN
              </label>
              <div className="relative group">
                <input
                  type={showPin ? "text" : "password"}
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="0000"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-4xl font-bold tracking-[1em] text-white focus:border-plaeen-green focus:outline-none transition-all pr-16"
                />
                <button
                  type="button"
                  onMouseDown={() => setShowPin(true)}
                  onMouseUp={() => setShowPin(false)}
                  onMouseLeave={() => setShowPin(false)}
                  onTouchStart={() => setShowPin(true)}
                  onTouchEnd={() => setShowPin(false)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 hover:text-plaeen-green transition-colors p-2"
                >
                  {showPin ? <EyeOff size={24} /> : <Eye size={24} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase  text-plaeen-green mb-4 block">
                First Day of Week
              </label>
              <div className="flex bg-white/5 rounded-2xl p-2 h-[88px]">
                {(["Mon", "Sun"] as const).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setFirstDayOfWeek(day)}
                    className={cn(
                      "flex-1 rounded-xl text-xs font-bold uppercase  transition-all",
                      firstDayOfWeek === day
                        ? "bg-plaeen-green text-black"
                        : "text-white/40 hover:text-white",
                    )}
                  >
                    {day === "Mon" ? "Monday" : "Sunday"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={isSaving || pin.length !== 4}
              className="bg-plaeen-green text-black font-bold uppercase  px-12 py-6"
            >
              {isSaving ? "Saving..." : "Update PIN"}
            </Button>
            {success && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-plaeen-green font-bold uppercase  text-[10px]"
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
            <p className="text-xs font-bold text-white uppercase tracking-tight mb-2">
              Why use a PIN?
            </p>
            <p className="text-white/40 text-[10px] font-bold uppercase  ">
              A PIN prevents your children from accessing the Command Center and
              changing their own screen time limits or game approvals.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-24 pt-12 border-t border-white/5">
        <div className="flex flex-col gap-6">
          <h2 className="text-[10px] font-bold uppercase  text-red-500 flex items-center gap-3">
            <Trash2 size={16} /> Danger Zone
          </h2>
          <Card className="bg-red-500/5 border-red-500/20 p-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tight">
                  Delete Account
                </h3>
                <p className="text-white/40 text-xs font-bold uppercase  mt-1">
                  Permanently remove all data for you and your kids
                </p>
              </div>
              <Button
                onClick={() => {
                  setIsDeleteDialogOpen(true);
                  setDeleteConfirmStep(1);
                }}
                variant="outline"
                className="border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold uppercase  text-[10px] py-4 px-8"
              >
                Delete Everything
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md"
            >
              <Card className="bg-plaeen-dark border-red-500/30 p-10 text-center overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500/20" />

                {deleteConfirmStep === 1 && (
                  <div className="space-y-8">
                    <div className="h-20 w-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto">
                      <AlertTriangle size={40} className="text-red-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white uppercase tracking-tighter mb-4">
                        First Warning
                      </h2>
                      <p className="text-white/40 text-sm font-bold uppercase  ">
                        Are you absolutely sure? This will delete your profile
                        and{" "}
                        <span className="text-red-500">
                          all {parentProfile.linkedKids?.length || 0} kid
                          accounts
                        </span>{" "}
                        associated with you.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <Button
                        onClick={() => setDeleteConfirmStep(2)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold uppercase  py-6"
                      >
                        I understand, proceed
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setIsDeleteDialogOpen(false)}
                        className="flex-1 text-white/40 hover:text-white font-bold uppercase  py-6"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {deleteConfirmStep === 2 && (
                  <div className="space-y-8">
                    <div className="h-20 w-20 rounded-3xl bg-red-500/20 flex items-center justify-center mx-auto animate-pulse">
                      <Trash2 size={40} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white uppercase tracking-tighter mb-4">
                        Final Confirmation
                      </h2>
                      <p className="text-white/60 text-xs font-bold uppercase   mb-4">
                        This action is{" "}
                        <span className="text-white">permanent</span> and cannot
                        be undone. All play history, approvals, and shared team
                        data will be wiped.
                      </p>
                      <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                        <p className="text-[10px] text-red-500 font-bold uppercase ">
                          Final check: You are deleting {parentProfile.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <Button
                        onClick={handlePermanentDeletion}
                        disabled={isDeleting}
                        className="w-full bg-white text-black hover:bg-red-500 hover:text-white font-bold uppercase  py-10 transition-all duration-500 text-lg shadow-[0_0_50px_rgba(255,255,255,0.1)]"
                      >
                        {isDeleting
                          ? "Erasing Data..."
                          : "Confirm Permanent Deletion"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setIsDeleteDialogOpen(false)}
                        disabled={isDeleting}
                        className="w-full text-white/40 hover:text-white font-bold uppercase  py-4"
                      >
                        Abort
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
