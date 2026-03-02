import Link from "next/link";
import { getUsers } from "../actions";
import { UserRow } from "./user-row";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allUsers = await getUsers();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors duration-100 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Admin
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Administration
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          User Management
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {allUsers.length} registered user{allUsers.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Users Table */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-border-default">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            User
          </span>
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider w-20 text-center">
            Status
          </span>
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider w-16 text-center">
            2FA
          </span>
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider w-28 text-right">
            Actions
          </span>
        </div>

        {/* User Rows */}
        {allUsers.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isSelf={user.id === session.userId}
          />
        ))}

        {allUsers.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-text-muted">
            No users found
          </div>
        )}
      </div>
    </div>
  );
}
