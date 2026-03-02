interface Member {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
}

const roleColors: Record<string, string> = {
  owner: "text-accent",
  write: "text-green-500",
  read: "text-text-muted",
};

export function MemberSidebar({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
        Members
        <span className="text-text-muted ml-1.5">{members.length}</span>
      </h3>
      <div className="space-y-0.5">
        {members.map((member) => {
          const displayName = member.displayName || member.username;
          const initial = displayName[0].toUpperCase();
          const isCurrentUser = member.userId === currentUserId;

          return (
            <div
              key={member.userId}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-bg-elevated/50 transition-colors duration-100"
            >
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-medium text-accent">
                    {initial}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-primary truncate">
                    {displayName}
                  </span>
                  {isCurrentUser && (
                    <span className="text-[8px] font-mono text-text-muted">
                      (you)
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`text-[8px] font-mono font-medium uppercase tracking-wider ${roleColors[member.role] ?? roleColors.read}`}
              >
                {member.role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
