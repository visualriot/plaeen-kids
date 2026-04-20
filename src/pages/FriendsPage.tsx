import React, { useState, useEffect } from "react";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Search, UserPlus, UserMinus, Check, X, Clock } from "lucide-react";
import { formatName, getUserAvatar } from "@/lib/utils";

import { handleFirestoreError } from "@/lib/firestoreUtils";

interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  parentId?: string;
}

interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName?: string;
  status: "pending" | "accepted" | "rejected";
}

import { useProfile } from "@/contexts/ProfileContext";

export const FriendsPage = () => {
  const [user] = useAuthState(auth);
  const {
    role,
    userRole,
    activeKid: kidData,
    parentProfile,
    isParentViewingKid,
    isLoading: profileLoading,
  } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const activeUid = kidData ? kidData.uid : user?.uid;

  // Sync parent email for searchability
  useEffect(() => {
    if (!user || user.isAnonymous || role !== "parent") return;
    const syncProfile = async () => {
      try {
        const publicRef = doc(db, "users_public", user.uid);
        const publicSnap = await getDoc(publicRef);
        if (publicSnap.exists()) {
          const data = publicSnap.data();
          if (!data.email && user.email) {
            await updateDoc(publicRef, { email: user.email.toLowerCase() });
          }
        }
      } catch (err) {
        console.warn("Failed to sync parent email:", err);
      }
    };
    syncProfile();
  }, [user, role]);

  useEffect(() => {
    if (!activeUid || !user || profileLoading) return;

    const qIncoming = isParentViewingKid
      ? query(
          collection(db, "friendRequests"),
          where("toId", "==", activeUid),
          where("toParentId", "==", user?.uid),
          where("status", "==", "pending"),
        )
      : query(
          collection(db, "friendRequests"),
          where("toId", "==", activeUid),
          where("status", "==", "pending"),
        );

    const unsubscribeIncoming = onSnapshot(
      qIncoming,
      (snapshot) => {
        const incoming = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as FriendRequest,
        );
        setRequests((prev) => {
          const outgoing = prev.filter((r) => r.fromId === activeUid);
          return [...incoming, ...outgoing];
        });
      },
      (error) => {
        console.error("Error with incoming friend requests query:", error);
        handleFirestoreError(error, "list", "friendRequests");
      },
    );

    // Listen to outgoing friend requests
    const qOutgoing = isParentViewingKid
      ? query(
          collection(db, "friendRequests"),
          where("fromId", "==", activeUid),
          where("fromParentId", "==", user?.uid),
          where("status", "==", "pending"),
        )
      : query(
          collection(db, "friendRequests"),
          where("fromId", "==", activeUid),
          where("status", "==", "pending"),
        );

    const unsubscribeOutgoing = onSnapshot(
      qOutgoing,
      (snapshot) => {
        const outgoing = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as FriendRequest,
        );
        setRequests((prev) => {
          const incoming = prev.filter((r) => r.toId === activeUid);
          return [...incoming, ...outgoing];
        });
      },
      (error) => {
        console.error("Error with outgoing friend requests query:", error);
        handleFirestoreError(error, "list", "friendRequests");
      },
    );

    // Listen to user's friends list
    const unsubscribeUser = onSnapshot(
      doc(db, "users", activeUid),
      async (docSnap) => {
        try {
          if (docSnap.exists()) {
            const friendIds = docSnap.data()?.friends || [];
            if (friendIds.length > 0) {
              const friendsQuery = query(
                collection(db, "users_public"),
                where("uid", "in", friendIds),
              );
              const friendsSnap = await getDocs(friendsQuery);
              setFriends(friendsSnap.docs.map((d) => d.data() as UserProfile));
            } else {
              setFriends([]);
            }
          }
        } catch (err) {
          console.error("Error processing friends snapshot:", err);
        }
      },
      (error) => handleFirestoreError(error, "get", `users/${activeUid}`),
    );

    return () => {
      unsubscribeIncoming();
      unsubscribeOutgoing();
      unsubscribeUser();
    };
  }, [activeUid, user, profileLoading, isParentViewingKid]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchResults([]);
    setMessage(null);
    try {
      const cleanSearch = searchQuery.toLowerCase().trim().replace(/^@/, "");

      // Check if it's an email search
      if (cleanSearch.includes("@") && cleanSearch.includes(".")) {
        // Search by email, without role filter to avoid potential index errors
        const parentQuery = query(
          collection(db, "users_public"),
          where("email", "==", cleanSearch),
        );
        const parentSnap = await getDocs(parentQuery);
        console.log(`Search for ${cleanSearch} found ${parentSnap.size} docs`);

        let parentDoc = parentSnap.docs.find((d) => d.data().role === "parent");

        // Secondary fallback: if nothing found in users_public, some old accounts might only be in users
        if (!parentDoc) {
          console.log("Searching fallback for email...");
          const fallbackQuery = query(
            collection(db, "users"),
            where("email", "==", cleanSearch),
            where("role", "==", "parent"),
          );
          const fallbackSnap = await getDocs(fallbackQuery);
          if (!fallbackSnap.empty) {
            parentDoc = fallbackSnap.docs[0];
          }
        }

        if (!parentDoc) {
          setMessage({
            text: `No guardian found with email: ${cleanSearch}. Note: If they just signed up, they must log in at least once to become searchable.`,
            type: "error",
          });
          setLoading(false);
          return;
        }

        const parentUid = parentDoc.id;
        const kidsQuery = query(
          collection(db, "users_public"),
          where("parentId", "==", parentUid),
          where("role", "==", "kid"),
        );
        const kidsSnap = await getDocs(kidsQuery);
        const results = kidsSnap.docs
          .map((doc) => doc.data() as UserProfile)
          .filter((u) => u.uid !== activeUid);
        setSearchResults(results);
        if (results.length === 0) {
          setMessage({
            text: "This guardian has no kids registered.",
            type: "error",
          });
        }
      } else {
        // Standard username search
        const q = query(
          collection(db, "users_public"),
          where("username", "==", cleanSearch),
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map((doc) => doc.data() as UserProfile)
          .filter((u) => u.uid !== activeUid);
        setSearchResults(results);
        if (results.length === 0) {
          setMessage({
            text: "No user found with that exact username.",
            type: "error",
          });
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      setMessage({ text: "Search failed. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (targetUser: UserProfile) => {
    if (!activeUid) return;
    try {
      // Check if a request already exists
      const existingQuery = isParentViewingKid
        ? query(
            collection(db, "friendRequests"),
            where("fromId", "==", activeUid),
            where("fromParentId", "==", user?.uid),
            where("toId", "==", targetUser.uid),
            where("status", "==", "pending"),
          )
        : query(
            collection(db, "friendRequests"),
            where("fromId", "==", activeUid),
            where("toId", "==", targetUser.uid),
            where("status", "==", "pending"),
          );
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) {
        setMessage({ text: "Request already pending.", type: "error" });
        return;
      }

      const parentId = kidData?.parentId || parentProfile?.uid || null;
      if (!parentId && activeUid !== user?.uid) {
        setMessage({
          text: "Profile data not fully loaded. Please refresh and try again.",
          type: "error",
        });
        return;
      }

      const docRef = await addDoc(collection(db, "friendRequests"), {
        fromId: activeUid,
        fromParentId: parentId,
        fromName:
          kidData?.displayName ||
          parentProfile?.displayName ||
          user?.displayName ||
          "Anonymous",
        toId: targetUser.uid,
        toParentId: targetUser.parentId || null,
        toName: targetUser.displayName,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Create notification for recipient
      await addDoc(collection(db, "notifications"), {
        userId: targetUser.uid,
        parentId: targetUser.parentId || null,
        fromId: activeUid,
        fromParentId: parentId,
        requestId: docRef.id,
        type: "friend_request",
        title: "New Friend Request",
        message: `${kidData?.displayName || parentProfile?.displayName || user?.displayName || "Anonymous"} wants to be friends!`,
        createdAt: serverTimestamp(),
        read: false,
      });

      setMessage({ text: "Request sent!", type: "success" });
    } catch (err) {
      console.error("Error sending request:", err);
    }
  };

  const handleRequest = async (request: FriendRequest, accept: boolean) => {
    if (!activeUid) return;
    try {
      const requestRef = doc(db, "friendRequests", request.id);
      if (accept) {
        await updateDoc(requestRef, { status: "accepted" });

        // Add to both users' friends lists
        await updateDoc(doc(db, "users", activeUid), {
          friends: arrayUnion(request.fromId),
        });
        await updateDoc(doc(db, "users", request.fromId), {
          friends: arrayUnion(activeUid),
        });

        // Create notification for sender
        const senderPublicDoc = await getDoc(
          doc(db, "users_public", request.fromId),
        );
        if (senderPublicDoc.exists()) {
          const senderData = senderPublicDoc.data();
          if (senderData.parentId) {
            await addDoc(collection(db, "notifications"), {
              userId: request.fromId,
              parentId: senderData.parentId,
              type: "friend_accepted",
              title: "Friend Request Accepted",
              message: `${kidData?.displayName || user?.displayName || "Anonymous"} accepted your friend request!`,
              createdAt: serverTimestamp(),
              read: false,
              fromId: activeUid,
            });
          }
        }
      } else {
        await updateDoc(requestRef, { status: "rejected" });
      }

      // Delete the corresponding notification
      const isParentViewingKid =
        role === "parent" && kidData && activeUid !== user?.uid;
      let notifQuery;
      if (isParentViewingKid) {
        notifQuery = query(
          collection(db, "notifications"),
          where("userId", "==", activeUid),
          where("parentId", "==", user?.uid),
          where("fromId", "==", request.fromId),
          where("type", "==", "friend_request"),
        );
      } else {
        notifQuery = query(
          collection(db, "notifications"),
          where("userId", "==", activeUid),
          where("fromId", "==", request.fromId),
          where("type", "==", "friend_request"),
        );
      }
      const notifSnap = await getDocs(notifQuery);
      const deletePromises = notifSnap.docs.map((d) =>
        deleteDoc(doc(db, "notifications", d.id)),
      );
      await Promise.all(deletePromises);
    } catch (err) {
      console.error("Error handling request:", err);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!activeUid) return;
    try {
      await updateDoc(doc(db, "users", activeUid), {
        friends: arrayRemove(friendId),
      });
      await updateDoc(doc(db, "users", friendId), {
        friends: arrayRemove(activeUid),
      });
      setConfirmDelete(null);
      setMessage({ text: "Friend removed.", type: "success" });
    } catch (err) {
      console.error("Error removing friend:", err);
      setMessage({ text: "Failed to remove friend.", type: "error" });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-12">Friends</h1>

      {message && (
        <div
          className={`mb-8 p-4 rounded-xl border font-bold uppercase tracking-widest text-xs ${
            message.type === "success"
              ? "bg-plaeen-green/10 border-plaeen-green/20 text-plaeen-green"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-12 lg:grid-cols-[1fr_350px]">
        <div className="space-y-12">
          {/* Search Section */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Search size={24} className="text-plaeen-green" /> Find Friends
            </h2>
            <div className="flex gap-4 mb-8">
              <input
                type="text"
                placeholder="Search by exact username (e.g. @aleks2)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 rounded-xl border border-white/10 bg-plaeen-purple/40 px-6 py-4 text-white focus:outline-none focus:border-plaeen-green"
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {searchResults.map((u) => (
                  <Card
                    key={u.uid}
                    className="flex items-center justify-between bg-white/5 border-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={getUserAvatar(u.photoURL)}
                        alt={u.displayName}
                        className="h-12 w-12 rounded-full border-2 border-plaeen-green/20"
                      />
                      <div>
                        <p className="font-bold text-white uppercase tracking-tight">
                          {formatName(u.displayName)}
                        </p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                          @{u.username}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 w-10 p-0 rounded-full border-plaeen-green/30 text-plaeen-green hover:bg-plaeen-green hover:text-black"
                      onClick={() => sendRequest(u)}
                    >
                      <UserPlus size={18} />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Friends List */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Check size={24} className="text-plaeen-green" /> Your Friends (
              {friends.length})
            </h2>
            {friends.length === 0 ? (
              <Card className="text-center py-12 bg-white/5 border-dashed border-white/20">
                <p className="text-white/40">
                  You haven't added any friends yet.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {friends.map((friend) => (
                  <Card
                    key={friend.uid}
                    className="flex items-center justify-between bg-white/5 border-white/10 group"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={getUserAvatar(friend.photoURL)}
                        alt={friend.displayName}
                        className="h-12 w-12 rounded-full border-2 border-plaeen-green/20"
                      />
                      <div>
                        <p className="font-bold text-white uppercase tracking-tight">
                          {formatName(friend.displayName)}
                        </p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                          @{friend.username}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(friend.uid)}
                      className="text-white/20 hover:text-red-500 transition-colors"
                    >
                      <UserMinus size={20} />
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar: Requests */}
        <aside className="space-y-8">
          {confirmDelete && (
            <Card className="bg-red-500/10 border-red-500/20">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">
                Remove Friend?
              </h3>
              <p className="text-xs text-white/60 mb-6">
                This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => removeFriend(confirmDelete)}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 border border-white/10"
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          <Card className="bg-plaeen-purple/20 border-plaeen-purple/40 sticky top-24">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Clock size={20} className="text-plaeen-green" /> Requests
            </h2>
            {requests.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">
                No pending requests
              </p>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => {
                  const isIncoming = req.toId === activeUid;
                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-sm font-medium text-white">
                          {isIncoming ? (
                            <>
                              <span className="text-plaeen-green">
                                {req.fromName}
                              </span>
                              <span className="text-white/40 ml-1">
                                Invited You
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-white/40 mr-1">
                                Sent to
                              </span>
                              <span className="text-plaeen-green">
                                {req.toName || "Friend"}
                              </span>
                            </>
                          )}
                        </p>
                        {!isIncoming && (
                          <span className="text-[8px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                            Pending
                          </span>
                        )}
                      </div>
                      {isIncoming && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-8 bg-plaeen-green text-black"
                            onClick={() => handleRequest(req, true)}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-8 border border-white/10"
                            onClick={() => handleRequest(req, false)}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
};
