import { useState, useEffect } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { auth, db } from "@/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Info,
  Save,
  RotateCcw,
} from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { cn } from "@/lib/utils";

type AvailabilityType = "available" | "unavailable" | "once";

export const CalendarPage = () => {
  const [user] = useAuthState(auth);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState<
    Record<string, AvailabilityType>
  >({});
  const [selectionMode, setSelectionMode] =
    useState<AvailabilityType>("available");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAvailability = async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setAvailability(userDoc.data().availability || {});
      }
      setLoading(false);
    };
    fetchAvailability();
  }, [user]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }).map((_, i) => i);

  const toggleSlot = (day: string, hour: number) => {
    const key = `${day}_${hour}`;
    const newAvailability = { ...availability };

    // Cycle through states: none -> available -> unavailable -> once -> none
    const current = newAvailability[key];
    if (!current) newAvailability[key] = "available";
    else if (current === "available") newAvailability[key] = "unavailable";
    else if (current === "unavailable") newAvailability[key] = "once";
    else delete newAvailability[key];

    setAvailability(newAvailability);
  };

  const toggleDay = (dayKey: string) => {
    const newAvailability = { ...availability };
    const dayHours = hours.map((h) => `${dayKey}_${h}`);
    const allSelected = dayHours.every(
      (key) => newAvailability[key] === selectionMode,
    );

    if (allSelected) {
      dayHours.forEach((key) => delete newAvailability[key]);
    } else {
      dayHours.forEach((key) => (newAvailability[key] = selectionMode));
    }
    setAvailability(newAvailability);
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        availability,
      });
      // Use a custom toast or just a simple state for success
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));

  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center">
        Loading...
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-wider">
            Your Calendar <span className="text-white/20 text-4xl ml-2">?</span>
          </h1>
          <p className="mt-2 text-white/40 font-bold  uppercase">
            Set your gaming availability
          </p>
        </div>
        <Button
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10 gap-2 font-bold uppercase "
        >
          Import calendars
        </Button>
      </div>

      <Card className="bg-plaeen-purple/20 border-none p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <CalendarIcon size={200} />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12 relative z-10">
          <div className="flex items-center gap-6">
            <button
              onClick={prevWeek}
              className="text-plaeen-green hover:scale-110 transition-transform"
            >
              <ChevronLeft size={32} />
            </button>
            <span className="text-3xl font-bold text-white tracking-tight">
              {format(days[0], "dd")}-{format(days[6], "dd.MM")}
            </span>
            <button
              onClick={nextWeek}
              className="text-plaeen-green hover:scale-110 transition-transform"
            >
              <ChevronRight size={32} />
            </button>
          </div>

          <div className="flex items-center gap-6 relative">
            <button className="text-plaeen-green hover:scale-110 transition-transform">
              <ChevronLeft size={32} />
            </button>
            <div
              className="flex items-center gap-3 text-3xl font-bold text-white tracking-tight cursor-pointer group"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
            >
              {format(currentDate, "MMMM yyyy")}
              <CalendarIcon
                size={28}
                className="text-plaeen-green group-hover:rotate-12 transition-transform"
              />
            </div>
            <button className="text-plaeen-green hover:scale-110 transition-transform">
              <ChevronRight size={32} />
            </button>

            {isPickerOpen && (
              <div className="absolute top-full right-0 mt-4 z-50">
                <Card className="bg-plaeen-dark/95 border-white/10 p-6 shadow-2xl backdrop-blur-xl">
                  <div className="grid grid-cols-7 gap-1">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d) => (
                      <div
                        key={d}
                        className="text-center text-[10px] font-bold text-white/40 mb-2"
                      >
                        {d}
                      </div>
                    ))}
                    {eachDayOfInterval({
                      start: startOfMonth(currentDate),
                      end: endOfMonth(currentDate),
                    }).map((day, i) => {
                      const isCurrentWeek = isSameDay(
                        startOfWeek(day, { weekStartsOn: 1 }),
                        startOfWeek(currentDate, { weekStartsOn: 1 }),
                      );
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setCurrentDate(day);
                            setIsPickerOpen(false);
                          }}
                          className={cn(
                            "h-10 w-10 rounded-lg text-xs font-bold transition-all relative group/day",
                            isSameDay(day, currentDate)
                              ? "bg-plaeen-green text-black"
                              : isCurrentWeek
                                ? "bg-white/10 text-white"
                                : "text-white/40 hover:bg-white/5",
                          )}
                        >
                          {format(day, "d")}
                          <div className="absolute inset-0 rounded-lg border-2 border-plaeen-green/0 group-hover/day:border-plaeen-green/20 transition-all pointer-events-none" />
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar pb-4">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[160px_repeat(24,1fr)] gap-3 mb-6">
              <div />
              {hours.map((h) => (
                <div
                  key={h}
                  className="text-center text-xs font-bold text-white/20"
                >
                  {h + 1}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayName = format(day, "EEEE").toUpperCase();
              const dayKey = format(day, "yyyy-MM-dd");
              const isDayFull = hours.every(
                (h) => availability[`${dayKey}_${h}`] === selectionMode,
              );

              return (
                <div
                  key={dayKey}
                  className="grid grid-cols-[160px_repeat(24,1fr)] gap-3 mb-3 items-center"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleDay(dayKey)}
                      className={cn(
                        "h-5 w-5 rounded border transition-all",
                        isDayFull
                          ? "bg-plaeen-green border-plaeen-green"
                          : "border-white/20 bg-white/5 hover:border-plaeen-green/50",
                      )}
                    />
                    <span className="text-sm font-bold text-white/40 ">
                      {dayName}
                    </span>
                  </div>
                  {hours.map((hour) => {
                    const key = `${dayKey}_${hour}`;
                    const status = availability[key];
                    return (
                      <div
                        key={hour}
                        onClick={() => toggleSlot(dayKey, hour)}
                        className={cn(
                          "h-8 rounded-lg transition-all cursor-pointer border border-transparent hover:scale-105",
                          status === "available"
                            ? "bg-plaeen-green shadow-[0_0_15px_rgba(118,233,0,0.3)]"
                            : status === "unavailable"
                              ? "bg-red-500/20 border-red-500/30"
                              : status === "once"
                                ? "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                : "bg-white/5 hover:bg-white/10",
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-wrap gap-8">
            <button
              onClick={() => setSelectionMode("available")}
              className={cn(
                "flex items-center gap-3 transition-all",
                selectionMode === "available"
                  ? "opacity-100 scale-105"
                  : "opacity-40 hover:opacity-60",
              )}
            >
              <div className="h-6 w-6 rounded-lg bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]" />
              <span className="text-sm font-bold text-white  uppercase">
                Always available
              </span>
            </button>
            <button
              onClick={() => setSelectionMode("unavailable")}
              className={cn(
                "flex items-center gap-3 transition-all",
                selectionMode === "unavailable"
                  ? "opacity-100 scale-105"
                  : "opacity-40 hover:opacity-60",
              )}
            >
              <div className="h-6 w-6 rounded-lg bg-red-500/50 border border-red-500" />
              <span className="text-sm font-bold text-white  uppercase">
                Always not available
              </span>
            </button>
            <button
              onClick={() => setSelectionMode("once")}
              className={cn(
                "flex items-center gap-3 transition-all",
                selectionMode === "once"
                  ? "opacity-100 scale-105"
                  : "opacity-40 hover:opacity-60",
              )}
            >
              <div className="h-6 w-6 rounded-lg bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              <span className="text-sm font-bold text-white  uppercase">
                Available once only
              </span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setAvailability({})}
              className="text-sm font-bold text-white/20 hover:text-white flex items-center gap-2 transition-colors uppercase "
            >
              <RotateCcw size={18} /> Revert changes
            </button>
            <Button
              onClick={handleSave}
              className="gap-2 px-8 py-4 text-sm font-bold uppercase "
            >
              <Save size={20} /> Save changes
            </Button>
          </div>
        </div>
      </Card>

      <p className="mt-6 text-center text-white/20 text-sm">
        Click on chosen slot to change availability
      </p>
    </div>
  );
};
