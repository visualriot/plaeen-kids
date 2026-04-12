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
  photoURL?: string;
}

interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export const FriendsPage = () => {
  const [user] = useAuthState(auth);
  const [role, setRole] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchRole = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setRole(data.role || 'parent');
        setParentId(data.parentId || null);
      }
    };
    fetchRole();

    // Listen to friend requests
    const q = query(collection(db, 'friendRequests'), where('toId', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest)));
    });

    // Listen to user's friends list
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const friendIds = docSnap.data().friends || [];
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
  }, [user]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users_public'), 
        where('displayName', '>=', searchQuery),
        where('displayName', '<=', searchQuery + '\uf8ff')
      );
      const snapshot = await getDocs(q);
      setSearchResults(snapshot.docs.map(doc => doc.data() as UserProfile).filter(u => u.uid !== user?.uid));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (targetUser: UserProfile) => {
    if (!user) return;
    try {
      if (role === 'kid' && parentId) {
        // Create approval request for parent
        await addDoc(collection(db, 'approvals'), {
          parentId: parentId,
          childId: user.uid,
          childName: user.displayName || 'Anonymous',
          type: 'friend',
          status: 'pending',
          data: {
            friendId: targetUser.uid,
            friendName: targetUser.displayName
          },
          createdAt: serverTimestamp()
        });
        alert('Friend request submitted for parent approval!');
      } else {
        await addDoc(collection(db, 'friendRequests'), {
          fromId: user.uid,
          fromName: user.displayName || 'Anonymous',
          toId: targetUser.uid,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        alert('Request sent!');
      }
    } catch (err) {
      console.error('Error sending request:', err);
    }
  };

  const handleRequest = async (request: FriendRequest, accept: boolean) => {
    if (!user) return;
    try {
      const requestRef = doc(db, 'friendRequests', request.id);
      if (accept) {
        await updateDoc(requestRef, { status: 'accepted' });
        
        // Add to both users' friends lists
        await updateDoc(doc(db, 'users', user.uid), {
          friends: arrayUnion(request.fromId)
        });
        await updateDoc(doc(db, 'users', request.fromId), {
          friends: arrayUnion(user.uid)
        });
      } else {
        await updateDoc(requestRef, { status: 'rejected' });
      }
    } catch (err) {
      console.error('Error handling request:', err);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayRemove(friendId)
      });
      await updateDoc(doc(db, 'users', friendId), {
        friends: arrayRemove(user.uid)
      });
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="font-display text-5xl font-bold text-plaeen-green uppercase tracking-tight mb-12">
        Friends
      </h1>

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
                placeholder="Search by name..."
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
                        className="h-12 w-12 rounded-full"
                      />
                      <span className="font-bold text-white">{u.displayName}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-10 w-10 p-0 rounded-full"
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
                        className="h-12 w-12 rounded-full"
                      />
                      <span className="font-bold text-white">{friend.displayName}</span>
                    </div>
                    <button 
                      onClick={() => removeFriend(friend.uid)}
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
        <aside>
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
