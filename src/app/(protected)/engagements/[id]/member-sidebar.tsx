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
  coordinator: "text-purple-400",
};

function MemberRow({
  member,
  currentUserId,
}: {
  member: Member;
  currentUserId: string;
}) {
  const displayName = member.displayName || member.username;
  const initial = displayName[0].toUpperCase();
  const isCurrentUser = member.userId === currentUserId;
  const isCoordinator = member.role === "coordinator";

  return (
    <div
      className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-bg-elevated/50 transition-colors duration-100"
    >
      {member.avatarUrl ? (
        <img
          src={member.avatarUrl}
          alt=""
          className="w-6 h-6 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isCoordinator
            ? "bg-purple-500/10 border border-purple-500/20"
            : "bg-accent/10 border border-accent/20"
        }`}>
          <span className={`text-[9px] font-medium ${isCoordinator ? "text-purple-400" : "text-accent"}`}>
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
}

export function MemberSidebar({
  members,
  coordinators = [],
  currentUserId,
}: {
  members: Member[];
  coordinators?: Member[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
        Members
        <span className="text-text-muted ml-1.5">{members.length}</span>
      </h3>
      <div className="space-y-0.5">
        {members.map((member) => (
          <MemberRow key={member.userId} member={member} currentUserId={currentUserId} />
        ))}
      </div>

      {coordinators.length > 0 && (
        <>
          <div className="border-t border-border-default pt-3">
            <h3 className="text-[10px] font-mono font-medium text-purple-400 uppercase tracking-[0.15em]">
              Coordinators
              <span className="text-text-muted ml-1.5">{coordinators.length}</span>
            </h3>
          </div>
          <div className="space-y-0.5">
            {coordinators.map((member) => (
              <MemberRow key={member.userId} member={member} currentUserId={currentUserId} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
