import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { auth, db } from '@/firebase';
import { collection, query, where, onSnapshot, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Plus, Edit2, X, Check, UserPlus, Sparkles, Trash2, Settings, Shield, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  imageURL?: string;
  adminIds: string[];
  members: string[];
}

interface Friend {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
}

const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ruby',
];

import { useProfile } from '@/contexts/ProfileContext';

export const TeamsPage = () => {
  const [user] = useAuthState(auth);
  const { role, activeKid: kidData, parentProfile } = useProfile();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ type: 'leave' | 'delete', teamId: string } | null>(null);
  
  // Create Team State
  const [teamName, setTeamName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [members, setMembers] = useState<Friend[]>([]); // New state for member management
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const activeUid = kidData ? kidData.uid : user?.uid;

  useEffect(() => {
    if (!activeUid) return;

    const isParent = role === 'parent';
    const q = query(
      collection(db, 'groups'), 
      where(isParent ? 'parentIds' : 'members', 'array-contains', activeUid)
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allTeams = snapshot.docs
        .map(docSnap => {
          const data = docSnap.data() as any;
          const adminIds = data.adminIds || (data.ownerId ? [data.ownerId] : []);
          return { id: docSnap.id, ...data, adminIds } as Team;
        })
        .filter(t => (t.members || []).includes(activeUid) || (t.adminIds || []).includes(activeUid));
      
      setTeams(allTeams);
      setLoading(false);

      // Extract all member UIDs from all teams to fetch their basic profiles
      const allMemberIds = Array.from(new Set(allTeams.flatMap(t => t.members || [])));
      if (allMemberIds.length > 0) {
        // Fetch public profiles for member management in modal
        const membersQuery = query(collection(db, 'users_public'), where('uid', 'in', allMemberIds));
        const membersSnap = await getDocs(membersQuery);
        setMembers(membersSnap.docs.map(d => d.data() as any));
      }
    });

    // Fetch friends for the modal
    const fetchFriends = async () => {
      if (!activeUid) return;
      const userDoc = await getDoc(doc(db, 'users', activeUid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friends || [];
        if (friendIds.length > 0) {
          const friendsQuery = query(collection(db, 'users_public'), where('uid', 'in', friendIds));
          const friendsSnap = await getDocs(friendsQuery);
          setFriends(friendsSnap.docs.map(d => d.data() as Friend));
        } else {
          setFriends([]);
        }
      }
    };
    fetchFriends();

    return () => unsubscribe();
  }, [activeUid]);

  const handleCreateTeam = async () => {
    if (!activeUid || !teamName.trim()) return;

    // Check for duplicate names for this user
    const nameExists = teams.some(t => t.name.toLowerCase() === teamName.trim().toLowerCase());
    if (nameExists) {
      alert(`You already have a team named "${teamName}". Please choose a different name.`);
      return;
    }

    try {
      const parentId = kidData?.parentId || user?.uid;
      let groupId = '';

      // Send invitations
      const finalInvites = [...selectedFriends];
        const docRef = await addDoc(collection(db, 'groups'), {
          name: teamName,
          ownerId: activeUid,
          members: [activeUid],
          adminIds: [activeUid],
          pendingMembers: finalInvites,
          parentIds: [parentId],
          isPublic: false,
          games: [],
          imageURL: selectedAvatar,
          createdAt: new Date().toISOString()
        });
        groupId = docRef.id;

      // Send notifications ONLY to the newly invited friends
      const notificationPromises = finalInvites.map(friendId => 
        addDoc(collection(db, 'notifications'), {
          userId: friendId,
          type: 'team_invite',
          title: 'Team Invitation',
          message: `${kidData?.displayName || 'A friend'} (@${kidData?.username || 'unknown'}) invited you to join the team "${teamName}"`,
          data: {
            groupId: groupId,
            teamName: teamName,
            invitedBy: activeUid,
            invitedByName: kidData?.displayName || 'A friend'
          },
          read: false,
          createdAt: new Date().toISOString()
        })
      );
      await Promise.all(notificationPromises);

      setIsModalOpen(false);
      setTeamName('');
      setSelectedFriends([]);
      setSelectedAvatar(AVATARS[0]);
    } catch (err) {
      console.error('Error saving team:', err);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      const batch = writeBatch(db);
      
      // Delete the group itself
      batch.delete(doc(db, 'groups', teamId));
      
      // Cleanup associated notifications (invites)
      const q = query(
        collection(db, 'notifications'), 
        where('type', '==', 'team_invite'),
        where('data.groupId', '==', teamId)
      );
      const inviteSnaps = await getDocs(q);
      inviteSnaps.forEach(d => {
        batch.delete(d.ref);
      });

      await batch.commit();

      setTeams(prev => prev.filter(t => t.id !== teamId));
      setConfirmModal(null);
    } catch (err) {
      console.error('Error deleting team:', err);
      setConfirmModal(null);
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!activeUid) return;
    try {
      await updateDoc(doc(db, 'groups', teamId), {
        members: arrayRemove(activeUid),
        adminIds: arrayRemove(activeUid)
      });
      setTeams(prev => prev.filter(t => t.id !== teamId));
      setConfirmModal(null);
    } catch (err) {
      console.error('Error leaving team:', err);
    }
  };

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    try {
      await updateDoc(doc(db, 'groups', teamId), {
        members: arrayRemove(memberId),
        adminIds: arrayRemove(memberId)
      });
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const handleToggleAdmin = async (teamId: string, memberId: string, isCurrentlyAdmin: boolean) => {
    try {
      await updateDoc(doc(db, 'groups', teamId), {
        adminIds: isCurrentlyAdmin ? arrayRemove(memberId) : arrayUnion(memberId)
      });
    } catch (err) {
      console.error('Error toggling admin:', err);
    }
  };

  const toggleFriend = (uid: string) => {
    setSelectedFriends(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center">Loading...</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-20 text-center">
      <div className="flex flex-col items-center justify-center gap-6 mb-20">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-6xl font-bold text-white uppercase tracking-tighter">
            Who are you <span className="text-plaeen-green">playing</span> with?
          </h1>
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest mt-4",
              isEditMode ? "text-plaeen-green" : "text-white/20 hover:text-white"
            )}
          >
            <Edit2 size={14} /> {isEditMode ? 'Done' : 'Edit teams'}
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-12">
          <div className="relative group">
            <div className="absolute inset-0 bg-plaeen-green/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
              onClick={() => setIsModalOpen(true)}
              className="relative flex h-64 w-64 items-center justify-center rounded-[2.5rem] bg-plaeen-purple/20 border-2 border-dashed border-white/10 transition-all hover:scale-105 hover:border-plaeen-green group"
            >
              <Plus size={64} className="text-white/10 group-hover:text-plaeen-green transition-colors" />
            </button>
          </div>
          <Button onClick={() => setIsModalOpen(true)} size="lg" className="px-12 py-8 text-xl font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            Add new team
          </Button>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-6xl mx-auto">
          {teams.map((team) => {
            const alias = (kidData?.teamAliases?.[team.id]) || (parentProfile?.teamAliases?.[team.id]);
            const displayName = alias || team.name;

            const cardContent = (
              <Card className="p-0 overflow-hidden border-none bg-transparent hover:bg-transparent transition-all">
                <div className="relative aspect-square max-w-[200px] mx-auto overflow-hidden rounded-[2rem] border-2 border-transparent group-hover:border-plaeen-green group-hover:shadow-[0_0_30px_rgba(118,233,0,0.2)] transition-all duration-500">
                  <img
                    src={team.imageURL || `https://picsum.photos/seed/${team.id}/600/600`}
                    alt={displayName}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-plaeen-dark via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                  
                  {isEditMode ? (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-3 opacity-100 transition-opacity p-2">
                      <Link 
                        to={`/teams/${team.id}/settings`}
                        className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-xl shrink-0"
                        title="Team Settings"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings size={20} />
                      </Link>
                      
                      {/* Leave Button: visible if not admin, OR if admin but multiple admins exist */}
                      {(!(team.adminIds || []).includes(activeUid || '') || (team.adminIds || []).length > 1) && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmModal({ type: 'leave', teamId: team.id });
                          }}
                          className="h-10 w-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-xl shrink-0"
                          title="Leave Team"
                        >
                          <LogOut size={20} />
                        </button>
                      )}

                      {/* Delete Button: only for admins */}
                      {(team.adminIds || []).includes(activeUid || '') && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmModal({ type: 'delete', teamId: team.id });
                          }}
                          className="h-10 w-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-xl shrink-0"
                          title="Delete Team"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Sparkles size={40} className="text-plaeen-green animate-pulse" />
                    </div>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-bold text-white uppercase tracking-tight group-hover:text-plaeen-green transition-colors">
                  {displayName}
                </h3>
              </Card>
            );

            if (isEditMode) {
              return (
                <div key={team.id} className="group relative">
                  {cardContent}
                </div>
              );
            }

            return (
              <Link key={team.id} to={`/teams/${team.id}`} className="group relative">
                {cardContent}
              </Link>
            );
          })}
        </div>
      )}

      {teams.length > 0 && (
        <div className="mt-16 flex justify-center">
          <Button 
            onClick={() => {
              setTeamName('');
              setSelectedAvatar(AVATARS[0]);
              setIsModalOpen(true);
            }}
            className="px-12 py-6 text-lg font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(118,233,0,0.3)] bg-plaeen-green text-black hover:scale-105 transition-transform"
          >
            Add new team
          </Button>
        </div>
      )}

      {/* Confirmation Modals */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          {(() => {
            const team = teams.find(t => t.id === confirmModal.teamId);
            const isDeleting = confirmModal.type === 'delete';
            
            return (
              <Card className="w-full max-w-md bg-plaeen-dark border-red-500/30 p-10 text-center">
                <div className={cn(
                  "h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-6",
                  isDeleting ? "bg-red-500/10" : "bg-amber-500/10"
                )}>
                  {isDeleting ? <Trash2 size={32} className="text-red-500" /> : <LogOut size={32} className="text-amber-500" />}
                </div>
                <h2 className="text-2xl font-bold text-white uppercase tracking-tighter mb-4">
                  {isDeleting ? 'Delete Team?' : 'Leave Team?'}
                </h2>
                <p className="text-white/40 text-sm mb-8 font-bold uppercase tracking-widest leading-relaxed">
                  {isDeleting 
                    ? "This will permanently remove the team and all its history." 
                    : "You will no longer be able to access this team's sessions and games."}
                </p>
                <div className="flex gap-4">
                  <Button 
                    onClick={() => isDeleting ? handleDeleteTeam(confirmModal.teamId) : handleLeaveTeam(confirmModal.teamId)}
                    className={cn(
                      "flex-1 py-6 font-bold uppercase tracking-widest",
                      isDeleting ? "bg-red-500 hover:bg-red-600 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"
                    )}
                  >
                    Confirm
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 border-white/10 text-white hover:bg-white/5 py-6 font-bold uppercase tracking-widest"
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            );
          })()}
        </div>
      )}

      {/* Create Team Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-plaeen-dark border-plaeen-green/30 p-12 shadow-[0_0_50px_rgba(118,233,0,0.1)]">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-4xl font-bold text-white uppercase tracking-tighter">
                  Create New Team
                </h2>
                {role === 'kid' && (
                  <div className="flex items-center gap-2 mt-2 text-plaeen-green font-bold uppercase tracking-widest text-[10px]">
                    <Shield size={12} /> Kid-Safe Private Team
                  </div>
                )}
              </div>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                }} 
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={32} />
              </button>
            </div>

            <div className="space-y-10 text-left">
              {/* Avatar Selection */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-6">Select Team Avatar</label>
                <div className="flex flex-wrap gap-6">
                  {AVATARS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`relative h-20 w-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                        selectedAvatar === avatar ? 'border-plaeen-green scale-110 shadow-[0_0_20px_rgba(118,233,0,0.4)]' : 'border-white/10 opacity-40 hover:opacity-100 hover:border-white/30'
                      }`}
                    >
                      <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
                      {selectedAvatar === avatar && (
                        <div className="absolute inset-0 bg-plaeen-green/10 flex items-center justify-center">
                          <Check size={24} className="text-plaeen-green" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-4">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. DUMBLEDORE'S ARMY"
                  className="w-full rounded-2xl border-2 border-white/10 bg-white/5 px-8 py-6 text-xl font-bold text-white uppercase focus:outline-none focus:border-plaeen-green transition-all"
                />
              </div>

              {/* Add Friends */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.4em] text-plaeen-green mb-6">Add Friends</label>
                {friends.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center">
                    <p className="text-sm font-bold text-white/20 uppercase tracking-widest">No friends found in this sector</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6 max-h-64 overflow-y-auto pr-4 custom-scrollbar">
                    {friends.map((friend) => (
                      <button
                        key={friend.uid}
                        onClick={() => toggleFriend(friend.uid)}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 ${
                          selectedFriends.includes(friend.uid)
                            ? 'bg-plaeen-green/10 border-plaeen-green text-plaeen-green shadow-[0_0_15px_rgba(118,233,0,0.2)]'
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/30'
                        }`}
                      >
                        <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} className="h-10 w-10 rounded-full" />
                        <div className="flex flex-col text-left truncate">
                          <span className="text-sm font-bold uppercase truncate">{friend.displayName}</span>
                          <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest truncate">@{friend.username}</span>
                        </div>
                        {selectedFriends.includes(friend.uid) ? <Check size={20} className="ml-auto" /> : <Plus size={20} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-8">
                <Button 
                  onClick={handleCreateTeam} 
                  className="w-full py-8 text-xl font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(118,233,0,0.3)]" 
                  disabled={!teamName.trim()}
                >
                  Create Team
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
