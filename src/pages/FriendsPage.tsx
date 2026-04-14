import React, { useState, useEffect } from 'react';
import { auth, db } from '@/firebase';
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
  getDoc
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Search, UserPlus, UserMinus, Check, X, Clock } from 'lucide-react';

interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
}

interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  status: 'pending' | 'accepted' | 'rejected';
}

import { useProfile } from '@/contexts/ProfileContext';

export const FriendsPage = () => {
  const [user] = useAuthState(auth);
  const { role, activeKid: kidData, parentProfile } = useProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const activeUid = kidData ? kidData.uid : user?.uid;

  useEffect(() => {
    if (!activeUid) return;

    // Listen to friend requests
    const q = query(collection(db, 'friendRequests'), where('toId', '==', activeUid), where('status', '==', 'pending'));
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest)));
    });

    // Listen to user's friends list
    const unsubscribeUser = onSnapshot(doc(db, 'users', activeUid), async (docSnap) => {
      if (docSnap.exists()) {
        const friendIds = docSnap.data()?.friends || [];
        if (friendIds.length > 0) {
          const friendsQuery = query(collection(db, 'users_public'), where('uid', 'in', friendIds));
          const friendsSnap = await getDocs(friendsQuery);
          setFriends(friendsSnap.docs.map(d => d.data() as UserProfile));
        } else {
          setFriends([]);
        }
      }
    });

    return () => {
      unsubscribeRequests();
      unsubscribeUser();
    };
  }, [activeUid]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchResults([]);
    setMessage(null);
    try {
      const cleanSearch = searchQuery.toLowerCase().trim().replace(/^@/, '');
      const q = query(
        collection(db, 'users_public'), 
        where('username', '==', cleanSearch)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => doc.data() as UserProfile).filter(u => u.uid !== activeUid);
      setSearchResults(results);
      if (results.length === 0) {
        setMessage({ text: 'No user found with that exact username.', type: 'error' });
      }
    } catch (err) {
      console.error('Search error:', err);
      setMessage({ text: 'Search failed. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (targetUser: UserProfile) => {
    if (!activeUid) return;
    try {
      if (role === 'kid' && kidData?.parentId) {
        // Create approval request for parent
        await addDoc(collection(db, 'approvals'), {
          parentId: kidData.parentId,
          childId: kidData.uid,
          childName: kidData.displayName || 'Anonymous',
          type: 'friend',
          status: 'pending',
          data: {
            friendId: targetUser.uid,
            friendName: targetUser.displayName
          },
          createdAt: serverTimestamp()
        });
        setMessage({ text: 'Friend request submitted for parent approval!', type: 'success' });
      } else {
        await addDoc(collection(db, 'friendRequests'), {
          fromId: activeUid,
          fromName: kidData?.displayName || user?.displayName || 'Anonymous',
          toId: targetUser.uid,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        setMessage({ text: 'Request sent!', type: 'success' });
      }
    } catch (err) {
      console.error('Error sending request:', err);
    }
  };

  const handleRequest = async (request: FriendRequest, accept: boolean) => {
    if (!activeUid) return;
    try {
      const requestRef = doc(db, 'friendRequests', request.id);
      if (accept) {
        await updateDoc(requestRef, { status: 'accepted' });
        
        // Add to both users' friends lists
        await updateDoc(doc(db, 'users', activeUid), {
          friends: arrayUnion(request.fromId)
        });
        await updateDoc(doc(db, 'users', request.fromId), {
          friends: arrayUnion(activeUid)
        });
      } else {
        await updateDoc(requestRef, { status: 'rejected' });
      }
    } catch (err) {
      console.error('Error handling request:', err);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!activeUid) return;
    try {
      await updateDoc(doc(db, 'users', activeUid), {
        friends: arrayRemove(friendId)
      });
      await updateDoc(doc(db, 'users', friendId), {
        friends: arrayRemove(activeUid)
      });
      setConfirmDelete(null);
      setMessage({ text: 'Friend removed.', type: 'success' });
    } catch (err) {
      console.error('Error removing friend:', err);
      setMessage({ text: 'Failed to remove friend.', type: 'error' });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="font-display text-5xl font-bold text-plaeen-green uppercase tracking-tight mb-12">
        Friends
      </h1>

      {message && (
        <div className={`mb-8 p-4 rounded-xl border font-bold uppercase tracking-widest text-xs ${
          message.type === 'success' ? 'bg-plaeen-green/10 border-plaeen-green/20 text-plaeen-green' : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
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
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 rounded-xl border border-white/10 bg-plaeen-purple/40 px-6 py-4 text-white focus:outline-none focus:border-plaeen-green"
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {searchResults.map((u) => (
                  <Card key={u.uid} className="flex items-center justify-between bg-white/5 border-white/10">
                    <div className="flex items-center gap-4">
                      <img 
                        src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                        alt={u.displayName} 
                        className="h-12 w-12 rounded-full border-2 border-plaeen-green/20"
                      />
                      <div>
                        <p className="font-bold text-white uppercase tracking-tight">{u.displayName}</p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">@{u.username}</p>
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
              <Check size={24} className="text-plaeen-green" /> Your Friends ({friends.length})
            </h2>
            {friends.length === 0 ? (
              <Card className="text-center py-12 bg-white/5 border-dashed border-white/20">
                <p className="text-white/40">You haven't added any friends yet.</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {friends.map((friend) => (
                  <Card key={friend.uid} className="flex items-center justify-between bg-white/5 border-white/10 group">
                    <div className="flex items-center gap-4">
                      <img 
                        src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} 
                        alt={friend.displayName} 
                        className="h-12 w-12 rounded-full border-2 border-plaeen-green/20"
                      />
                      <div>
                        <p className="font-bold text-white uppercase tracking-tight">{friend.displayName}</p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">@{friend.username}</p>
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
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Remove Friend?</h3>
              <p className="text-xs text-white/60 mb-6">This action cannot be undone.</p>
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
              <p className="text-sm text-white/40 text-center py-4">No pending requests</p>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div key={req.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-sm font-medium text-white mb-3">
                      <span className="text-plaeen-green">{req.fromName}</span> wants to be friends
                    </p>
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
                  </div>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
};
