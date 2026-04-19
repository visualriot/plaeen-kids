# Firestore Security Specification - Plaeen

## 1. Data Invariants
- **User Profiles**: Every kid profile must have a `parentId`. Parents can manage their linked kids.
- **Groups**: Access is restricted to members and their parents.
- **Sessions**: Belong to a group. Only group members can view or manage them.
- **Approvals**: Requests from kids to parents. Accessible only by the involved kid and their parent.
- **Notifications**: Personal messages. Accessible only by the recipient or their parent.

## 2. The "Dirty Dozen" Payloads (Attack Vectors)

### Identity & Privilege Escalation
1. **Self-Promotion**: A kid tries to update their own `role` to 'parent'.
2. **Allowance Theft**: A kid tries to increase their own `dailyAllowance` without approval.
3. **Orphaned Session**: Proposing a session with a `groupId` that doesn't exist or the user doesn't belong to.
4. **Member Hijack**: Adding another user to a group without being an admin.
5. **Approval Forge**: A kid creating an `approval` document that is already marked as 'approved'.

### Unauthorized Access (Data Leaks)
6. **Teammate PII Probe**: A teammate trying to read the `email` of another teammate (if stored in `users`).
7. **Global Notif Scraping**: An authenticated user trying to list *all* notifications in the system.
8. **Group Lurking**: A user trying to read a group they aren't a member of.
9. **Parent Snooping**: A parent trying to read profiles of kids not linked to them.

### State & Integrity
10. **Session Outcome Cheat**: A non-proposer trying to delete or finish a session.
11. **Negative Time**: Setting `usedToday` or `dailyAllowance` to a negative number.
12. **Future Reset**: Setting `lastReset` to a future timestamp.

## 3. Test Runner (Conceptual)
`firestore.rules.test.ts` should verify:
- `users/{kidId}`: `get` fails for non-teammate/non-parent.
- `notifications`: `list` without `where('userId', '==', auth.uid)` fails.
- `approvals`: `update` fails if status changes from 'pending' to 'approved' by the kid.
