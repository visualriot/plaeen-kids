import React, { useState, useEffect } from "react";
import { Card } from "@/components/molecules/Card";
import { Heading, Text, Label, Button } from "@/components/atoms";
import { auth, db } from "@/firebase";
import {
  doc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Info,
  Check,
  RotateCcw,
  Zap,
  CalendarCheck2,
} from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isSameWeek,
} from "date-fns";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { handleFirestoreError } from "@/lib/firestoreUtils";

type AvailabilityState = "unavailable" | "recurring" | "once";

export const KidCalendarPage = () => {
  const [user] = useAuthState(auth);
  const { activeKid, parentProfile, role } = useProfile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [teamSessions, setTeamSessions] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const firstDay = parentProfile?.firstDayOfWeek === "Sun" ? 0 : 1;
  const weekStart = startOfWeek(currentDate, { weekStartsOn: firstDay as any });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }).map((_, i) => i);

  const [groupIds, setGroupIds] = useState<string[]>([]);

  // 1. Listen for Groups the kid belongs to
  useEffect(() => {
    if (!activeKid?.uid) return;

    const isParentViewer = role === "parent" && !!activeKid.parentId;

    // Parent should query by parentIds, kid should query by members
    const qGroups = query(
      collection(db, "groups"),
      where(
        isParentViewer ? "parentIds" : "members",
        "array-contains",
        isParentViewer ? activeKid.parentId : activeKid.uid,
      ),
    );

    const unsubGroups = onSnapshot(
      qGroups,
      (snapshot) => {
        try {
          // If parent viewer, we might get ALL kids' groups, so we filter by activeKid.uid
          const filteredDocs = isParentViewer
            ? snapshot.docs.filter((d) =>
                d.data().members?.includes(activeKid.uid),
              )
            : snapshot.docs;
          setGroupIds(filteredDocs.map((d) => d.id));
        } catch (err) {
          console.error("Error processing groups snapshot:", err);
        }
      },
      (err) => handleFirestoreError(err, "list", "groups"),
    );

    return () => unsubGroups();
  }, [activeKid?.uid, role]);

  // 2. Fetch sessions whenever groupIds change
  useEffect(() => {
    if (groupIds.length === 0) {
      setTeamSessions([]);
      return;
    }

    let isMounted = true;

    const fetchAllSessions = async () => {
      try {
        const fetchPromises = groupIds.map(async (gid) => {
          const qSessions = query(
            collection(db, "groups", gid, "sessions"),
            where("status", "in", ["scheduled", "proposed"]),
          );
          const snap = await getDocs(qSessions);
          return snap.docs.map((d) => ({
            id: d.id,
            groupId: gid,
            ...d.data(),
          }));
        });

        const results = await Promise.all(fetchPromises);
        if (isMounted) {
          const all = results.flat();
          // Filter out sessions rejected by the active kid
          const filtered = all.filter((s: any) => {
            const resp = activeKid ? s.responses?.[activeKid.uid] : undefined;
            return !resp || resp.status !== "rejected";
          });
          setTeamSessions(filtered);
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      }
    };

    fetchAllSessions();
    return () => {
      isMounted = false;
    };
  }, [groupIds]);

  const getSlotState = (day: Date, hour: number): AvailabilityState => {
    if (!activeKid?.availability) return "unavailable";

    const dayIdx = day.getDay();
    const dateKey = format(day, "yyyy-MM-dd");
    const recurringKey = `${dayIdx}_${hour}`;
    const onceKey = `${dateKey}_${hour}`;

    if (activeKid.availability.once?.[onceKey]) return "once";
    if (activeKid.availability.recurring?.[recurringKey]) return "recurring";

    return "unavailable";
  };

  const toggleSlot = async (day: Date, hour: number) => {
    if (!activeKid || isUpdating) return;

    const currentState = getSlotState(day, hour);
    const dayIdx = day.getDay();
    const dateKey = format(day, "yyyy-MM-dd");
    const recurringKey = `${dayIdx}_${hour}`;
    const onceKey = `${dateKey}_${hour}`;

    const newAvailability = {
      recurring: { ...(activeKid.availability?.recurring || {}) },
      once: { ...(activeKid.availability?.once || {}) },
    };

    if (currentState === "unavailable") {
      // Toggle to recurring
      newAvailability.recurring[recurringKey] = true;
    } else if (currentState === "recurring") {
      // Toggle to once
      delete newAvailability.recurring[recurringKey];
      newAvailability.once[onceKey] = true;
    } else {
      // Toggle to unavailable
      delete newAvailability.once[onceKey];
    }

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", activeKid.uid), {
        availability: newAvailability,
      });
    } catch (err) {
      console.error("Error updating availability:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleDay = async (day: Date) => {
    if (!activeKid || isUpdating) return;

    const dayIdx = day.getDay();
    const dateKey = format(day, "yyyy-MM-dd");

    // Check if entire day is one state
    const states = hours.map((h) => getSlotState(day, h));
    const allRecurring = states.every((s) => s === "recurring");
    const allOnce = states.every((s) => s === "once");
    const allUnavailable = states.every((s) => s === "unavailable");

    const newAvailability = {
      recurring: { ...(activeKid.availability?.recurring || {}) },
      once: { ...(activeKid.availability?.once || {}) },
    };

    let targetState: AvailabilityState = "recurring";
    if (allRecurring) targetState = "once";
    else if (allOnce) targetState = "unavailable";

    hours.forEach((hour) => {
      const rKey = `${dayIdx}_${hour}`;
      const oKey = `${dateKey}_${hour}`;

      delete newAvailability.recurring[rKey];
      delete newAvailability.once[oKey];

      if (targetState === "recurring") newAvailability.recurring[rKey] = true;
      if (targetState === "once") newAvailability.once[oKey] = true;
    });

    setIsUpdating(true);
    await updateDoc(doc(db, "users", activeKid.uid), {
      availability: newAvailability,
    });
    setIsUpdating(false);
  };

  const toggleHour = async (hour: number) => {
    if (!activeKid || isUpdating) return;

    // Check across all currently visible days
    const states = days.map((d) => getSlotState(d, hour));
    const allRecurring = states.every((s) => s === "recurring");
    const allOnce = states.every((s) => s === "once");

    let targetState: AvailabilityState = "recurring";
    if (allRecurring) targetState = "once";
    else if (allOnce) targetState = "unavailable";

    const newAvailability = {
      recurring: { ...(activeKid.availability?.recurring || {}) },
      once: { ...(activeKid.availability?.once || {}) },
    };

    days.forEach((day) => {
      const dayIdx = day.getDay();
      const dateKey = format(day, "yyyy-MM-dd");
      const rKey = `${dayIdx}_${hour}`;
      const oKey = `${dateKey}_${hour}`;

      delete newAvailability.recurring[rKey];
      delete newAvailability.once[oKey];

      if (targetState === "recurring") newAvailability.recurring[rKey] = true;
      if (targetState === "once") newAvailability.once[oKey] = true;
    });

    setIsUpdating(true);
    await updateDoc(doc(db, "users", activeKid.uid), {
      availability: newAvailability,
    });
    setIsUpdating(false);
  };

  if (!activeKid) return null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
        <div>
          <Heading
            level={1}
            className="drop-shadow-[0_0_30_rgba(118,233,0,0.3)]"
          >
            Your <span className="text-plaeen-green">Calendar</span>
          </Heading>
          <Text variant="caption" className="mt-2">
            Manage your availability and team sessions
          </Text>
        </div>

        <div className="flex items-center gap-6 bg-white/5 border border-white/10 p-4 rounded-3xl">
          <button
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-plaeen-green transition-all"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center px-4 min-w-[180px]">
            <p className="text-[10px] font-bold text-plaeen-green uppercase  mb-1">
              {format(weekStart, "MMM yyyy")}
            </p>
            <p className="text-sm font-bold text-white uppercase ">
              Week {format(currentDate, "w")}
            </p>
          </div>

          <button
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
            className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-plaeen-green transition-all"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <Card className="bg-white/5 border-white/10 p-4 lg:p-10 overflow-hidden relative">
        <div className="w-full">
          <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-0.5 mb-6 md:gap-3">
            <div />
            {hours.map((h) => (
              <button
                key={h}
                onClick={() => toggleHour(h)}
                className="text-center text-[8px] md:text-[10px] font-bold text-white/20 hover:text-plaeen-green transition-colors uppercase py-2"
              >
                {h}h
              </button>
            ))}
          </div>

          {/* Calendar Rows */}
          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            return (
              <div
                key={dayKey}
                className="grid grid-cols-[80px_repeat(24,1fr)] gap-0.5 mb-0.5 md:mb-3 md:gap-3 items-center"
              >
                <button
                  onClick={() => toggleDay(day)}
                  className="text-left text-[8px] md:text-[10px] font-bold text-white/40 hover:text-white transition-colors uppercase  md: group flex items-center gap-1"
                >
                  <span className="w-12 md:w-16">{format(day, "EEE d")}</span>
                  <RotateCcw
                    size={12}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-plaeen-green"
                  />
                </button>

                {hours.map((hour) => {
                  const state = getSlotState(day, hour);
                  const session = teamSessions.find((s) => {
                    const sDate = s.startTime.toDate();
                    return isSameDay(sDate, day) && sDate.getHours() === hour;
                  });

                  const hasResponded = session?.responses?.[activeKid.uid];
                  const shouldBlink =
                    session?.status === "proposed" && !hasResponded;

                  return (
                    <div
                      key={hour}
                      onClick={() => toggleSlot(day, hour)}
                      className={cn(
                        "aspect-square rounded-lg transition-all cursor-pointer border border-transparent relative group hover:scale-95",
                        shouldBlink && "animate-blink-glow",
                        session?.status === "scheduled"
                          ? "bg-plaeen-green shadow-[0_0_20px_rgba(118,233,0,0.6)] z-20 border-white/60"
                          : session?.status === "proposed"
                            ? "bg-amber-400 border-2 border-white/40 shadow-[0_0_15px_rgba(251,191,36,0.3)] z-10"
                            : state === "recurring"
                              ? "bg-plaeen-green/40 shadow-[0_0_10px_rgba(118,233,0,0.1)] border-plaeen-green/20"
                              : state === "once"
                                ? "bg-plaeen-green/20 border-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.1)]"
                                : "bg-white/5 hover:bg-white/10",
                      )}
                    >
                      {session && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-plaeen-dark border border-white/10 px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap z-50 pointer-events-none shadow-2xl">
                          <p className="text-[10px] font-bold text-plaeen-purple uppercase  mb-1">
                            Team Session
                          </p>
                          <p className="text-xs font-bold text-white uppercase">
                            {session.gameName || "Gaming"}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-x-12 gap-y-6">
          <div className="flex items-center gap-4">
            <div className="h-6 w-6 rounded-lg bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.4)]" />
            <div>
              <p className="text-xs font-bold text-white uppercase ">
                Available (Recurring)
              </p>
              <p className="text-[10px] text-white/20 font-bold uppercase ">
                Repeats every week
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-6 w-6 rounded-lg bg-plaeen-green/40 border-2 border-plaeen-green" />
            <div>
              <p className="text-xs font-bold text-white uppercase ">
                Available (Once)
              </p>
              <p className="text-[10px] text-white/20 font-bold uppercase ">
                Only for this date
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-6 w-6 rounded-lg bg-[#9333ea] border-2 border-white/60 shadow-[0_0_20px_rgba(147,51,234,0.6)]" />
            <div>
              <p className="text-xs font-bold text-white uppercase ">
                Scheduled Session
              </p>
              <p className="text-[10px] text-white/20 font-bold uppercase ">
                Team gaming event
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-6 w-6 rounded-lg bg-white/5" />
            <div>
              <p className="text-xs font-bold text-white uppercase ">
                Unavailable
              </p>
              <p className="text-[10px] text-white/20 font-bold uppercase ">
                Default state
              </p>
            </div>
          </div>
        </div>

        {/* Tip */}
        <div className="mt-8 flex items-center gap-3 p-4 rounded-xl bg-plaeen-green/5 border border-plaeen-green/20">
          <Info size={16} className="text-plaeen-green shrink-0" />
          <p className="text-[10px] font-bold text-white/60 uppercase  ">
            Click on a day or hour label to bulk toggle entire columns or rows.
          </p>
        </div>
      </Card>

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-plaeen-green/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
};

const Plus = ({ size, className }: { size: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
