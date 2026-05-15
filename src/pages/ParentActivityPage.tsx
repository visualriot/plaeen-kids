import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Clock,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Bell,
  ArrowUpDown,
  Filter,
  User,
  Search,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, subDays, isAfter, isToday } from "date-fns";
import { cn, formatName, safeToDate } from "@/lib/utils";
import { handleFirestoreError } from "@/lib/firestoreUtils";
import type { Notification, KidProfile } from "@/lib/types";

export const ParentActivityPage = () => {
  const [user] = useAuthState(auth);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "kid">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterByKid, setFilterByKid] = useState<string | null>(null);
  const [filterByType, setFilterByType] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const navigate = useNavigate();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    // Fetch more notifications for better summary stats
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(200),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification),
        );
      },
      (error) => handleFirestoreError(error, "list", "notifications"),
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "users"), where("parentId", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setKids(
          snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }) as KidProfile),
        );
      },
      (error) => handleFirestoreError(error, "list", "users"),
    );

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "notifications", n.id), { read: true });
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const filteredAndSortedNotifications = useMemo(() => {
    return notifications
      .filter((n) => !filterByKid || n.childId === filterByKid)
      .filter((n) => !filterByType || n.type === filterByType)
      .filter((n) => !showUnreadOnly || !n.read)
      .sort((a, b) => {
        if (sortBy === "date") {
          const dateA = safeToDate(a.createdAt);
          const dateB = safeToDate(b.createdAt);
          return sortOrder === "desc"
            ? dateB.getTime() - dateA.getTime()
            : dateA.getTime() - dateB.getTime();
        } else {
          const nameA = a.childName || "";
          const nameB = b.childName || "";
          return sortOrder === "desc"
            ? nameB.localeCompare(nameA)
            : nameA.localeCompare(nameB);
        }
      });
  }, [
    notifications,
    sortBy,
    sortOrder,
    filterByKid,
    filterByType,
    showUnreadOnly,
  ]);

  const groupedNotifications = useMemo(() => {
    const groups: { title: string; items: Notification[] }[] = [];

    if (filteredAndSortedNotifications.length === 0) return groups;

    if (sortBy === "date") {
      const today = filteredAndSortedNotifications.filter(
        (n) => n.createdAt && isToday(safeToDate(n.createdAt)),
      );
      const thisWeek = filteredAndSortedNotifications.filter(
        (n) =>
          n.createdAt &&
          !isToday(safeToDate(n.createdAt)) &&
          isAfter(safeToDate(n.createdAt), subDays(new Date(), 7)),
      );
      const older = filteredAndSortedNotifications.filter(
        (n) =>
          n.createdAt &&
          !isAfter(safeToDate(n.createdAt), subDays(new Date(), 7)),
      );

      if (sortOrder === "desc") {
        if (today.length > 0) groups.push({ title: "Today", items: today });
        if (thisWeek.length > 0)
          groups.push({ title: "Last 7 Days", items: thisWeek });
        if (older.length > 0) groups.push({ title: "Older", items: older });
      } else {
        if (older.length > 0) groups.push({ title: "Older", items: older });
        if (thisWeek.length > 0)
          groups.push({ title: "Last 7 Days", items: thisWeek });
        if (today.length > 0) groups.push({ title: "Today", items: today });
      }
    } else {
      // Group by kid
      const kidsInNotifs = Array.from(
        new Set(filteredAndSortedNotifications.map((n) => n.childName)),
      ) as string[];
      if (sortOrder === "asc") {
        kidsInNotifs.sort();
      } else {
        kidsInNotifs.sort().reverse();
      }

      kidsInNotifs.forEach((kidName) => {
        const items = filteredAndSortedNotifications.filter(
          (n) => n.childName === kidName,
        );
        groups.push({ title: kidName, items });
      });
    }

    return groups;
  }, [filteredAndSortedNotifications, sortBy, sortOrder]);

  const summaryStats = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);

    return kids.map((kid) => {
      const kidNotifications = notifications.filter(
        (n) => n.childId === kid.uid,
      );

      const warningsLast30Days = kidNotifications.filter(
        (n) =>
          n.type === "time_warning" &&
          n.createdAt &&
          isAfter(safeToDate(n.createdAt), thirtyDaysAgo),
      ).length;

      // Calculate sessions today (started and finished)
      // We look for session_end or time_warning notifications from today that have a duration
      const finishedSessionsToday = kidNotifications.filter(
        (n) =>
          (n.type === "session_end" || n.type === "time_warning") &&
          n.createdAt &&
          isToday(safeToDate(n.createdAt)) &&
          n.duration !== undefined,
      );

      const totalMinutesPlayedToday = finishedSessionsToday.reduce(
        (acc, n) => acc + (n.duration || 0),
        0,
      );

      return {
        ...kid,
        warningsLast30Days,
        sessionsToday: finishedSessionsToday.length,
        totalMinutesPlayedToday,
      };
    });
  }, [kids, notifications]);

  const toggleSort = (type: "date" | "kid") => {
    if (sortBy === type) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(type);
      setSortOrder("desc");
    }
  };

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilterByKid(null);
    setFilterByType(null);
    setShowUnreadOnly(false);
  };

  const handleFilterChange = (value: string) => {
    if (value === "all") {
      setFilterByKid(null);
      setFilterByType(null);
      setShowUnreadOnly(false);
    } else if (value === "unread") {
      setFilterByKid(null);
      setFilterByType(null);
      setShowUnreadOnly(true);
    } else if (value === "warnings") {
      setFilterByKid(null);
      setFilterByType("time_warning");
      setShowUnreadOnly(false);
    } else if (value.startsWith("kid:")) {
      const kidId = value.split(":")[1];
      setFilterByKid(kidId);
      setFilterByType(null);
      setShowUnreadOnly(false);
    }
  };

  const currentFilterValue = useMemo(() => {
    if (!filterByKid && !filterByType && !showUnreadOnly) return "all";
    if (!filterByKid && !filterByType && showUnreadOnly) return "unread";
    if (!filterByKid && filterByType === "time_warning") return "warnings";
    if (filterByKid && !filterByType) return `kid:${filterByKid}`;
    return "";
  }, [filterByKid, filterByType, showUnreadOnly]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <button
        onClick={() => navigate("/parent-dashboard")}
        className="flex items-center gap-2 text-white/40 hover:text-plaeen-green font-bold uppercase  text-[10px] mb-8 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Guardian Hub
      </button>

      <div className="mb-12">
        <h1 className="font-display text-6xl font-bold text-white uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(118,233,0,0.3)]">
          Activity <span className="text-plaeen-green">Log</span>
        </h1>
        <p className="text-white/40 font-bold uppercase  text-xs mt-2">
          Real-time Monitoring & History
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-[10px] font-bold uppercase  text-plaeen-green flex items-center gap-3">
              <Bell size={16} />{" "}
              {filterByType === "time_warning"
                ? "Warning History"
                : "Recent Notifications"}
              {filterByKid &&
                ` • ${kids.find((k) => k.uid === filterByKid)?.displayName}`}
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={markAllAsRead}
                disabled={notifications.filter((n) => !n.read).length === 0}
                className="px-3 py-2 rounded-lg text-[9px] font-bold uppercase  bg-white/5 border border-white/10 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              >
                Mark All Read
              </button>

              <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                <button
                  onClick={() => toggleSort("date")}
                  title="Sort by Date"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${sortBy === "date" ? "bg-plaeen-green text-black" : "text-white/40 hover:text-white"}`}
                >
                  <Clock size={12} />
                  <span className="text-[9px] font-bold uppercase ">Date</span>
                  {sortBy === "date" && (
                    <span className="text-[8px]">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => toggleSort("kid")}
                  title="Sort by Kid"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${sortBy === "kid" ? "bg-plaeen-green text-black" : "text-white/40 hover:text-white"}`}
                >
                  <User size={12} />
                  <span className="text-[9px] font-bold uppercase ">Kid</span>
                  {sortBy === "kid" && (
                    <span className="text-[8px]">
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              </div>

              <div className="relative group">
                <select
                  value={currentFilterValue}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="appearance-none bg-white/5 border border-white/10 text-white text-[9px] font-bold uppercase  pl-8 pr-10 py-2 rounded-lg focus:outline-none focus:border-plaeen-green transition-all cursor-pointer hover:bg-white/10"
                >
                  <option value="all" className="bg-[#0A0514] text-white">
                    All Activity
                  </option>
                  <option value="unread" className="bg-[#0A0514] text-white">
                    Unread Only
                  </option>
                  <option value="warnings" className="bg-[#0A0514] text-white">
                    All Warnings
                  </option>
                  <optgroup
                    label="Filter by Kid"
                    className="bg-[#0A0514] text-white/40 text-[8px] uppercase"
                  >
                    {kids.map((kid) => (
                      <option
                        key={kid.uid}
                        value={`kid:${kid.uid}`}
                        className="bg-[#0A0514] text-white"
                      >
                        {kid.displayName}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <Filter
                  size={10}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-plaeen-green transition-colors"
                />
                <ChevronDown
                  size={10}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none group-hover:text-plaeen-green transition-colors"
                />
              </div>

              {(filterByKid || filterByType || showUnreadOnly) && (
                <button
                  onClick={clearFilters}
                  className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                  title="Clear Filters"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-12">
            {groupedNotifications.map((group) => (
              <div key={group.title} className="space-y-6">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center gap-4 group"
                >
                  <span className="text-[10px] font-bold text-white/20 uppercase  whitespace-nowrap group-hover:text-plaeen-green transition-colors">
                    {group.title}
                  </span>
                  <div className="h-px w-full bg-white/5 group-hover:bg-plaeen-green/20 transition-colors" />
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-white/10 group-hover:text-plaeen-green transition-all",
                      collapsedGroups.has(group.title)
                        ? "-rotate-90"
                        : "rotate-0",
                    )}
                  />
                </button>

                {!collapsedGroups.has(group.title) && (
                  <div className="space-y-4">
                    {group.items.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => !notif.read && markAsRead(notif.id)}
                        className="cursor-pointer"
                      >
                        <Card
                          className={`bg-white/5 border-white/10 p-6 transition-all hover:bg-white/[0.07] ${!notif.read ? "border-l-4 border-l-plaeen-green" : "opacity-60"}`}
                        >
                          <div className="flex justify-between items-start gap-6">
                            <div className="flex gap-4">
                              <div
                                className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                                  notif.type === "session_start"
                                    ? "bg-plaeen-green/10 text-plaeen-green"
                                    : notif.type === "session_end"
                                      ? "bg-white/10 text-white"
                                      : "bg-red-500/10 text-red-500"
                                }`}
                              >
                                {notif.type === "session_start" ? (
                                  <Play size={24} />
                                ) : notif.type === "session_end" ? (
                                  <Square size={24} />
                                ) : (
                                  <AlertTriangle size={24} />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="text-[10px] font-bold text-plaeen-green uppercase ">
                                    {notif.childName}
                                  </span>
                                  <span className="text-[8px] text-white/20 uppercase ">
                                    •{" "}
                                    {notif.createdAt
                                      ? format(
                                          safeToDate(notif.createdAt),
                                          "MMM d, HH:mm",
                                        )
                                      : "Just now"}
                                  </span>
                                </div>
                                <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-1">
                                  {notif.title}
                                </h3>
                                <p className="text-sm text-white/40">
                                  {notif.message}
                                </p>

                                {notif.type === "time_warning" &&
                                  (() => {
                                    return (
                                      <div className="mt-4 pt-4 border-t border-white/5">
                                        {!notif.read ? (
                                          <div className="flex items-center gap-3">
                                            <Button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const targetId =
                                                  notif.approvalId || notif.id;
                                                navigate(
                                                  `/parent/overtime-decision/${targetId}`,
                                                );
                                              }}
                                              className="bg-plaeen-green text-black text-[9px] font-bold uppercase  px-4 py-2 h-auto"
                                            >
                                              Handle Decision
                                            </Button>
                                            <span className="text-[8px] font-bold text-red-500 uppercase  animate-pulse">
                                              Action Required
                                            </span>
                                          </div>
                                        ) : (
                                          <p className="text-[10px] font-bold text-white/60 uppercase ">
                                            Status:{" "}
                                            <span className="text-plaeen-green">
                                              {notif.decision?.message ||
                                                "No action taken"}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                              </div>
                            </div>
                            {!notif.read && (
                              <div className="h-2 w-2 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)]" />
                            )}
                          </div>
                        </Card>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {groupedNotifications.length === 0 && (
              <Card className="bg-white/5 border-dashed border-white/10 p-12 text-center">
                <p className="text-white/20 font-bold uppercase ">
                  No activity matches your filters
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 text-plaeen-green text-[10px] font-bold uppercase  hover:underline"
                >
                  Clear all filters
                </button>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-[10px] font-bold uppercase  text-white/40 flex items-center gap-3">
            <Clock size={16} /> Summary
          </h2>

          <div className="space-y-6">
            <Card className="bg-white/5 border-white/10 p-8">
              <p className="text-[10px] font-bold text-white/20 uppercase  mb-6">
                Total Sessions Today
              </p>
              <div className="space-y-4">
                {summaryStats.map((kid) => (
                  <div
                    key={kid.uid}
                    className="flex justify-between items-end border-b border-white/5 pb-4 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-xs font-bold text-white uppercase ">
                        {kid.displayName}
                      </p>
                      <p className="text-[10px] text-white/40 uppercase ">
                        {kid.sessionsToday} Sessions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-plaeen-green">
                        {kid.totalMinutesPlayedToday}m
                      </p>
                      <p className="text-[8px] text-white/20 uppercase ">
                        Played Today
                      </p>
                    </div>
                  </div>
                ))}
                {summaryStats.length === 0 && (
                  <p className="text-xs text-white/20 italic">
                    No kids linked yet
                  </p>
                )}
              </div>
            </Card>

            <Card className="bg-white/5 border-white/10 p-8">
              <p className="text-[10px] font-bold text-white/20 uppercase  mb-6">
                Warnings Triggered (30d)
              </p>
              <div className="space-y-4">
                {summaryStats.map((kid) => (
                  <button
                    key={kid.uid}
                    onClick={() => {
                      setFilterByKid(kid.uid);
                      setFilterByType("time_warning");
                      setShowUnreadOnly(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full flex justify-between items-center group hover:bg-white/5 p-2 -m-2 rounded-xl transition-all"
                  >
                    <div className="text-left">
                      <p className="text-xs font-bold text-white uppercase  group-hover:text-plaeen-green transition-colors">
                        {kid.displayName}
                      </p>
                      <p className="text-[8px] text-white/20 uppercase ">
                        Click to view history
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`px-3 py-1 rounded-full text-[10px] font-bold ${kid.warningsLast30Days > 5 ? "bg-red-500 text-white" : kid.warningsLast30Days > 0 ? "bg-yellow-500 text-black" : "bg-white/5 text-white/20"}`}
                      >
                        {kid.warningsLast30Days}
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-white/20 group-hover:text-plaeen-green transition-colors"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
