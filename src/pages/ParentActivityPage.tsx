import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/molecules/Card";
import { Button } from "@/components/atoms/Button";
import { Toggle } from "@/components/atoms/Toggle";
import { Dropdown } from "@/components/atoms/Dropdown";
import { Heading, Text, Label } from "@/components/atoms";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  deleteDoc,
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
  MoreVertical,
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const navigate = useNavigate();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
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
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Error marking as read:", err);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
      );
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "notifications", n.id), { read: true });
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error("Error marking all as read:", err);
      setNotifications((prev) =>
        prev.map((n) => {
          const wasUnread = unread.find((u) => u.id === n.id);
          return wasUnread ? { ...n, read: false } : n;
        }),
      );
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
      const today = filteredAndSortedNotifications.filter((n) =>
        isToday(safeToDate(n.createdAt)),
      );
      const thisWeek = filteredAndSortedNotifications.filter(
        (n) =>
          !isToday(safeToDate(n.createdAt)) &&
          isAfter(safeToDate(n.createdAt), subDays(new Date(), 7)),
      );
      const older = filteredAndSortedNotifications.filter(
        (n) => !isAfter(safeToDate(n.createdAt), subDays(new Date(), 7)),
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
    const sevenDaysAgo = subDays(new Date(), 7);

    return kids.map((kid) => {
      const kidNotifications = notifications.filter(
        (n) => n.childId === kid.uid,
      );

      const warningsLast7Days = kidNotifications.filter(
        (n) =>
          n.type === "time_warning" &&
          n.createdAt &&
          isAfter(safeToDate(n.createdAt), sevenDaysAgo),
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
        warningsLast7Days,
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

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const handleMenuToggle = (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    e.stopPropagation();
    if (openMenuId === id) {
      setOpenMenuId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenuId(id);
  };

  const handleNotificationClick = (notif: Notification) => {
    if (notif.type === "time_warning" && !notif.read) {
      const targetId = notif.approvalId || notif.id;
      navigate(`/parent/overtime-decision/${targetId}`);
    } else if (!notif.read) {
      markAsRead(notif.id);
    }
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
      {openMenuId && (
        <div
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
          className="w-36 bg-plaeen-dark border border-white/10 rounded-lg shadow-xl z-[9999]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              markAsRead(openMenuId);
              setOpenMenuId(null);
            }}
            className="w-full text-left px-4 py-2 text-sm font-bold text-white/60 hover:text-white hover:bg-white/15 transition-colors border-b border-white/5 rounded-t-lg"
          >
            Mark as Read
          </button>
          <button
            onClick={() => {
              deleteNotification(openMenuId);
              setOpenMenuId(null);
            }}
            className="w-full text-left px-4 py-2 text-sm font-bold text-red-500 hover:text-red-400 hover:bg-red-500/15 transition-colors rounded-b-lg"
          >
            Delete
          </button>
        </div>
      )}
      <Button
        onClick={() => navigate("/parent-dashboard")}
        variant="back"
        className="flex items-center gap-2 mb-8 hover:gap-3"
      >
        <ArrowLeft size={14} /> Back to Guardian Hub
      </Button>

      <div className="mb-12">
        <h1>
          <span className="text-plaeen-green">Activity</span> Log
        </h1>
        <p className="note">Real-time Monitoring & History</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="flex items-center gap-3">
              <Bell size={16} />{" "}
              {filterByType === "time_warning"
                ? "Warning History"
                : "Recent Notifications"}
              {filterByKid &&
                ` • ${kids.find((k) => k.uid === filterByKid)?.displayName}`}
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <Dropdown
                label="Sort By:"
                options={[
                  { id: "date", name: "Date" },
                  { id: "kid", name: "Kid" },
                ]}
                selectedIds={[sortBy]}
                onSelectionChange={(selected) => {
                  if (selected.length > 0) {
                    toggleSort(selected[0] as "date" | "kid");
                  }
                }}
                variant="sort"
                isMultiple={false}
                showResetButton={false}
                showApplyButton={false}
                icon={<ArrowUpDown size={10} />}
                defaultValueId="date"
                width="w-12"
                className="mr-8"
              />
              <Dropdown
                label="Filter"
                options={[
                  { id: "all", name: "All Activity" },
                  { id: "unread", name: "Unread Only" },
                  { id: "warnings", name: "All Warnings" },
                  ...kids.map((kid) => ({
                    id: `kid:${kid.uid}`,
                    name: kid.displayName,
                  })),
                ]}
                selectedIds={[currentFilterValue]}
                onSelectionChange={(selected) => {
                  if (selected.length > 0) {
                    handleFilterChange(selected[0]);
                  }
                }}
                variant="filter"
                isMultiple={false}
                showResetButton={false}
                showApplyButton={false}
                icon={<Filter size={10} />}
                defaultValueId="all"
              />
            </div>
          </div>
          <div className="flex flex-col items-end w-full justify-end">
            <Button
              onClick={markAllAsRead}
              // disabled={notifications.filter((n) => !n.read).length === 0}
              variant="ghost"
              size="sm"
              className={`py-2 ${notifications.filter((n) => !n.read).length === 0 ? "hidden" : ""}`}
            >
              Mark All Read
            </Button>
          </div>

          {/* Grouped Notifications */}
          <div className="space-y-12">
            {groupedNotifications.map((group) => (
              <div key={group.title} className="space-y-6">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center gap-4 group"
                >
                  <span className="text-sm font-bold text-white/50 uppercase  whitespace-nowrap group-hover:text-plaeen-green transition-colors">
                    {group.title} ({group.items.length})
                  </span>
                  <div className="h-px w-full bg-white/15 group-hover:bg-plaeen-green/20 transition-colors" />
                  <ChevronDown
                    size={18}
                    className={cn(
                      "text-white/30 group-hover:text-plaeen-green transition-all",
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
                        className="cursor-pointer"
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <Card
                          className={`bg-white/5 border-white/10 p-6 transition-all hover:bg-white/[0.07] ${!notif.read ? "border-l-4 border-l-plaeen-green" : "opacity-60"}`}
                        >
                          <div className="flex justify-between items-start gap-6">
                            <div className="flex gap-4">
                              <div
                                className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
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
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold text-plaeen-green uppercase ">
                                    {notif.childName}
                                  </span>
                                  <span className="text-xs text-neutral-400">
                                    •
                                  </span>
                                  <span className="text-xs text-neutral-400">
                                    {notif.createdAt
                                      ? format(
                                          safeToDate(notif.createdAt),
                                          "MMM d, HH:mm",
                                        )
                                      : "Just now"}
                                  </span>
                                </div>
                                <h4>{notif.title}</h4>
                                <p className="text-sm text-neutral-200 font-light italic">
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
                            <div className="flex items-center gap-3">
                              {!notif.read && (
                                <div className="h-2 w-2 rounded-full bg-plaeen-green shadow-[0_0_10px_rgba(118,233,0,0.5)] flex-shrink-0" />
                              )}
                              <button
                                onClick={(e) => handleMenuToggle(e, notif.id)}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white flex-shrink-0"
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </div>
                        </Card>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {groupedNotifications.length === 0 && (
              <Card className="bg-white/5 border-dashed border-white/10 p-12 space-y-4 text-center">
                <p className="ghost-text">No activity matches your filters</p>
                <Button
                  onClick={clearFilters}
                  variant="tertiary"
                  size="sm"
                  className={`${!filterByKid && !filterByType && !showUnreadOnly ? "hidden" : ""}`}
                >
                  Clear all filters
                </Button>
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
              <h6>Total Sessions Today</h6>
              <div className="space-y-4">
                {summaryStats.map((kid) => (
                  <div
                    key={kid.uid}
                    className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white capitalize ">
                        {kid.displayName}
                      </p>
                      <p className="text-xs text-white/50 ">
                        {kid.sessionsToday >= 2
                          ? `${kid.sessionsToday} Sessions`
                          : kid.sessionsToday === 1
                            ? "1 Session"
                            : "No sessions today"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-plaeen-green">
                        {kid.totalMinutesPlayedToday} min
                      </p>
                      {/* <p className="text-xs text-white/50">Played Today</p> */}
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
              <h6>Warnings Triggered (7d)</h6>
              <div className="space-y-4 w-full">
                {summaryStats.filter((kid) => kid.warningsLast7Days > 0)
                  .length === 0 ? (
                  <p className="text-xs text-white/30 italic text-center py-4">
                    No warnings triggered
                  </p>
                ) : (
                  summaryStats.map(
                    (kid) =>
                      kid.warningsLast7Days > 0 && (
                        <button
                          key={kid.uid}
                          onClick={() => {
                            setFilterByKid(kid.uid);
                            setFilterByType("time_warning");
                            setShowUnreadOnly(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="w-full px-4 py-2 flex justify-between items-center group hover:bg-white/5 rounded-xl transition-all"
                        >
                          <div className="text-left space-y-1">
                            <p className="text-sm capitalize font-bold text-white  group-hover:text-plaeen-green transition-colors">
                              {kid.displayName}
                            </p>
                            <p className="text-xs text-white/40 ">
                              Click to view history
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div
                              className={`px-3 py-1 rounded-full text-[10px] font-bold ${kid.warningsLast7Days > 5 ? "bg-red-500 text-white" : kid.warningsLast7Days > 0 ? "bg-yellow-500 text-black" : "bg-white/5 text-white/20"}`}
                            >
                              {kid.warningsLast7Days}
                            </div>
                            <ChevronRight
                              size={14}
                              className="text-white/20 group-hover:text-plaeen-green transition-colors"
                            />
                          </div>
                        </button>
                      ),
                  )
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
