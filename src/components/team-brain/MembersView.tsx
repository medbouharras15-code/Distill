"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { Check, ChevronLeft, Close, Crown, Doc, Plus, Shield, Users } from "@/lib/icons";
import { ComingSoonToast, useComingSoonToast } from "./ComingSoonToast";
import { TEAM_BRAIN_MEMBERS, TEAM_BRAIN_ROLE_CONFIG, TEAM_BRAIN_WORKSPACE } from "@/lib/teamBrainMockData";
import type { TeamBrainMember } from "@/lib/teamBrainMockData";

type MembersTab = "members" | "roles";

const ROLE_ICONS = { admin: Crown, manager: Users, member: Doc };

const PERMISSIONS_BY_ROLE = (role: keyof typeof TEAM_BRAIN_ROLE_CONFIG) => [
  { label: "Poser des questions", allowed: true },
  { label: "Ajouter des docs", allowed: true },
  { label: "Voir tous les projets", allowed: role === "admin" },
  { label: "Inviter des membres", allowed: role !== "member" },
  { label: "Gérer les rôles", allowed: role === "admin" },
  { label: "Docs privés des autres", allowed: false },
];

function MemberCard({ member }: { member: TeamBrainMember }) {
  const rc = TEAM_BRAIN_ROLE_CONFIG[member.role];
  return (
    <Card className="flex items-center gap-4 p-4">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
        style={{ background: member.color }}
      >
        {member.initials}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{member.name}</span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white"
            style={{ background: rc.color }}
          >
            {rc.label}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{member.projects.join(" · ")}</div>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-[11px] text-muted-foreground">{member.joinedAt}</div>
      </div>
    </Card>
  );
}

/** Vue membres & permissions de la démo Team Brain — "Inviter" reste
 * décoratif (pas de vraie logique d'ajout/retrait, conformément au plan
 * validé : aucune permission réelle n'est appliquée nulle part dans
 * l'app). */
export function MembersView({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<MembersTab>("members");
  const { visible: comingSoonVisible, trigger: triggerComingSoon } = useComingSoonToast();

  return (
    <div className="mx-auto max-w-[720px] animate-fade px-5 py-8 md:px-10 md:py-12">
      <ComingSoonToast visible={comingSoonVisible} />
      <button
        type="button"
        onClick={onBack}
        className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft size={15} /> Workspace
      </button>

      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-tight text-foreground">Membres & permissions</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {TEAM_BRAIN_MEMBERS.length} membres · {TEAM_BRAIN_WORKSPACE.name}
          </p>
        </div>
        <button
          type="button"
          onClick={triggerComingSoon}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white shadow-[var(--shadow-sm)] transition hover:-translate-y-px"
          style={{ background: "linear-gradient(135deg, var(--team), var(--team-2))" }}
        >
          <Plus size={15} /> Inviter
        </button>
      </div>

      <div className="mb-5 flex gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-sm)]">
        {([
          ["members", "Membres"],
          ["roles", "Rôles & accès"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex-1 rounded-xl py-2 text-[13.5px] font-medium transition-all duration-200 ${
              activeTab === id ? "bg-foreground text-background shadow-[var(--shadow-sm)]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "members" && (
        <div className="animate-fade space-y-2">
          {TEAM_BRAIN_MEMBERS.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-[13px]">
            <Shield size={16} className="mt-0.5 shrink-0" style={{ color: "var(--team)" }} />
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Documents privés</span> — même les Admins ne peuvent pas
              voir le contenu des notes marquées comme privées par un autre membre. Team Brain ne les cite jamais dans
              ses réponses.
            </div>
          </div>
        </div>
      )}

      {activeTab === "roles" && (
        <div className="animate-fade space-y-3">
          {(Object.entries(TEAM_BRAIN_ROLE_CONFIG) as [keyof typeof TEAM_BRAIN_ROLE_CONFIG, (typeof TEAM_BRAIN_ROLE_CONFIG)[keyof typeof TEAM_BRAIN_ROLE_CONFIG]][]).map(
            ([role, rc]) => {
              const RoleIcon = ROLE_ICONS[role];
              const memberCount = TEAM_BRAIN_MEMBERS.filter((m) => m.role === role).length;
              return (
                <Card key={role} className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                      style={{ background: rc.color }}
                    >
                      <RoleIcon size={17} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{rc.label}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {memberCount} membre{memberCount > 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-muted-foreground">{rc.desc}</p>

                      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {PERMISSIONS_BY_ROLE(role).map(({ label, allowed }) => (
                          <div
                            key={label}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px]"
                            style={{
                              background: allowed ? "color-mix(in srgb, var(--team) 8%, var(--secondary))" : "var(--secondary)",
                              color: allowed ? "color-mix(in srgb, var(--team) 80%, var(--foreground))" : "var(--muted-foreground)",
                            }}
                          >
                            {allowed ? <Check size={11} style={{ color: "var(--team)" }} /> : <Close size={11} className="opacity-50" />}
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
