"use client";

import { useState } from "react";
import { UserPlus, MoreHorizontal, Crown, Shield, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const INPUT =
  "w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors placeholder:text-muted-foreground";
const SELECT =
  "px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-colors";

type Role = "owner" | "admin" | "member" | "viewer";

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "invited";
  joined: string;
}

const INITIAL_MEMBERS: Member[] = [
  {
    id: "1",
    name: "Alex Johnson",
    email: "alex@company.com",
    role: "owner",
    status: "active",
    joined: "Jan 2026",
  },
  {
    id: "2",
    name: "Sam Rivera",
    email: "sam@company.com",
    role: "admin",
    status: "active",
    joined: "Feb 2026",
  },
  {
    id: "3",
    name: "Jordan Lee",
    email: "jordan@company.com",
    role: "member",
    status: "invited",
    joined: "May 2026",
  },
];

const ROLE_META: Record<
  Role,
  { label: string; icon: React.ElementType; cls: string }
> = {
  owner: { label: "Owner", icon: Crown, cls: "text-warning bg-warning/10" },
  admin: { label: "Admin", icon: Shield, cls: "text-primary bg-primary/10" },
  member: { label: "Member", icon: Eye, cls: "text-muted-foreground bg-muted" },
  viewer: { label: "Viewer", icon: Eye, cls: "text-muted-foreground bg-muted" },
};

function RoleBadge({ role }: { role: Role }) {
  const { label, icon: Icon, cls } = ROLE_META[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
        cls,
      )}
    >
      <Icon className="size-3" /> {label}
    </span>
  );
}

export default function TeamPage() {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function handleInvite() {
    if (!inviteEmail.trim()) return;
    const newMember: Member = {
      id: Date.now().toString(),
      name: inviteEmail.split("@")[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      status: "invited",
      joined: "May 2026",
    };
    setMembers((prev) => [...prev, newMember]);
    setInviteEmail("");
    toast({
      message: `Invitation sent to ${inviteEmail.trim()}.`,
      variant: "success",
    });
  }

  function handleRemove(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setOpenMenu(null);
    toast({ message: "Member removed.", variant: "info" });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite team members and manage their access level.
        </p>
      </div>

      {/* Invite */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          Invite a member
        </h2>
        <div className="flex gap-2">
          <input
            className={cn(INPUT, "flex-1")}
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          />
          <select
            className={SELECT}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={handleInvite}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shrink-0"
          >
            <UserPlus className="size-4" /> Invite
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Admins can manage agents and settings. Members can view and test.
          Viewers are read-only.
        </p>
      </section>

      {/* Members list */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Members{" "}
            <span className="text-muted-foreground font-normal">
              ({members.length})
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left text-xs font-semibold text-muted-foreground px-6 py-3">
                  Member
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">
                  Role
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">
                  Joined
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary select-none">
                          {m.name.slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {m.name}
                        </p>
                        <p className="text-xs text-muted-foreground leading-tight">
                          {m.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
                        m.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {m.status === "active" ? "Active" : "Invited"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    {m.joined}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {m.role !== "owner" && (
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setOpenMenu(openMenu === m.id ? null : m.id)
                          }
                          className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                        {openMenu === m.id && (
                          <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-10 w-36">
                            <button
                              onClick={() => {
                                setMembers((prev) =>
                                  prev.map((x) =>
                                    x.id === m.id
                                      ? {
                                          ...x,
                                          role:
                                            x.role === "admin"
                                              ? "member"
                                              : "admin",
                                        }
                                      : x,
                                  ),
                                );
                                setOpenMenu(null);
                                toast({
                                  message: "Role updated.",
                                  variant: "success",
                                });
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                            >
                              {m.role === "admin"
                                ? "Demote to member"
                                : "Promote to admin"}
                            </button>
                            <button
                              onClick={() => handleRemove(m.id)}
                              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
