import {
  RefreshCw,
  Briefcase,
  CalendarClock,
  Users,
  FolderKanban,
  Share2,
  Inbox,
  UploadCloud,
  Wallet,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  UserCog,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { cardBase, SectionHeading, QuickAction, KpiCard, DashboardHero, toneChip, type ToneKey } from "./shared";

export type StaffDashboardProps = {
  greeting: string;
  firstName: string;
  todayLabel: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onAddExpense: () => void;
  activeProjectsCount: number;
  activeClientsCount: number;
  activeTeamCount: number;
  upcomingEvents: {
    id: string;
    title: string;
    subtitle: string;
    date: Date;
    tone: ToneKey;
    icon: React.ElementType;
    link: string;
  }[];
  activeProjects: {
    id: string;
    name: string;
    client?: string;
    dueDate?: string;
    progress: number;
  }[];
  activities: { colorType: string; action: string; subject: string; time: Date; link: string }[];
  teamSnapshot: {
    active: number;
    onLeave: number;
    pending: number;
    workload: { id: string; name: string; count: number }[];
    maxLoad: number;
  };
  dueLabel: (date: Date) => { text: string; overdue: boolean };
  canWriteExpense: boolean;
  canWriteProject: boolean;
  canWriteSocial: boolean;
  canWriteEmail: boolean;
  canWriteTransfer: boolean;
  canReadTeam: boolean;
  canReadClients: boolean;
  canReadCalendar: boolean;
  canReadProjects: boolean;
};

export function StaffWorkDashboard(p: StaffDashboardProps) {
  const quickActions = [
    p.canWriteProject && { icon: FolderKanban, label: "Projects", to: "/dashboard/projects", tone: "purple" as const },
    p.canReadCalendar && { icon: CalendarClock, label: "Calendar", to: "/dashboard/calendar", tone: "primary" as const },
    p.canWriteEmail && { icon: Inbox, label: "Email", to: "/dashboard/email", tone: "blue" as const },
    p.canWriteSocial && { icon: Share2, label: "Social", to: "/dashboard/social-media/publish", tone: "cyan" as const },
    p.canWriteTransfer && { icon: UploadCloud, label: "Files", to: "/dashboard/transfers", tone: "gold" as const },
    p.canWriteExpense && { icon: Wallet, label: "Add Expense", onClick: p.onAddExpense, tone: "red" as const },
    p.canReadClients && { icon: Users, label: "Clients", to: "/dashboard/clients", tone: "primary" as const },
  ].filter(Boolean) as { icon: React.ElementType; label: string; to?: string; onClick?: () => void; tone: ToneKey }[];

  const kpiCards = [
    p.canReadProjects && {
      label: "Active projects",
      value: String(p.activeProjectsCount),
      to: "/dashboard/projects",
      icon: Briefcase,
      tone: "purple" as const,
      hint: "In progress right now",
    },
    p.canReadCalendar && {
      label: "Coming up",
      value: String(p.upcomingEvents.length),
      to: "/dashboard/calendar",
      icon: CalendarClock,
      tone: "gold" as const,
      hint: "Next 14 days",
    },
    p.canReadClients
      ? {
          label: "Active clients",
          value: String(p.activeClientsCount),
          to: "/dashboard/clients",
          icon: Users,
          tone: "primary" as const,
          hint: "Visible in your CRM",
        }
      : p.canReadTeam
        ? {
            label: "Team online",
            value: String(p.activeTeamCount),
            to: "/dashboard/team",
            icon: UserCog,
            tone: "green" as const,
            hint: "Active team members",
          }
        : null,
  ].filter(Boolean) as {
    label: string;
    value: string;
    to: string;
    icon: React.ElementType;
    tone: ToneKey;
    hint: string;
  }[];

  return (
    <div className="w-full space-y-6 md:space-y-8 pb-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <DashboardHero
        eyebrow={p.todayLabel}
        title={
          <>
            {p.greeting}, {p.firstName}
          </>
        }
        subtitle="Your work dashboard — projects, deadlines, and tools you can access."
        actions={
          <Button
            variant="outline"
            onClick={p.onRefresh}
            disabled={p.isRefreshing}
            className="rounded-xl text-xs font-bold h-10 px-4 bg-white/10 border-white/20 hover:bg-white/20 text-white backdrop-blur-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${p.isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {kpiCards.length > 0 && (
        <section>
          <div
            className={`grid gap-3 md:gap-4 ${
              kpiCards.length === 1
                ? "grid-cols-1 max-w-sm"
                : kpiCards.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            }`}
          >
            {kpiCards.map((card) => (
              <KpiCard key={card.label} {...card} />
            ))}
          </div>
        </section>
      )}

      {quickActions.length > 0 && (
        <section>
          <SectionHeading icon={ClipboardList} title="Your tools" subtitle="Jump to what you use most" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-3">
            {quickActions.map((qa) => (
              <QuickAction key={qa.label} {...qa} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading icon={CalendarClock} title="Needs your focus" subtitle="Upcoming work and live projects" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
          <div className={`${cardBase} p-4 sm:p-5 flex flex-col min-h-[280px]`}>
            <div className="flex items-center justify-between mb-4 gap-2">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary shrink-0" /> Upcoming
              </h4>
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                14 days
              </span>
            </div>
            {p.upcomingEvents.length > 0 ? (
              <div className="space-y-3 flex-1">
                {p.upcomingEvents.map((ev) => {
                  const due = p.dueLabel(ev.date);
                  return (
                    <Link key={ev.id} to={ev.link} className="flex items-center gap-3 group">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneChip[ev.tone]}`}>
                        <ev.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{ev.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{ev.subtitle}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${
                          due.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {due.text}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-10 text-muted-foreground">
                <CheckCircle2 className="w-7 h-7 opacity-40 mb-2" />
                <p className="text-xs font-medium">Nothing urgent in the next two weeks</p>
              </div>
            )}
          </div>

          {p.canReadProjects ? (
            <div className={`${cardBase} p-4 sm:p-5 flex flex-col min-h-[280px]`}>
              <div className="flex items-center justify-between mb-4 gap-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-violet-600 shrink-0" /> Active projects
                </h4>
                <Link to="/dashboard/projects" className="text-[11px] font-semibold text-primary shrink-0">
                  All
                </Link>
              </div>
              {p.activeProjects.length > 0 ? (
                <div className="space-y-4 flex-1">
                  {p.activeProjects.map((proj) => {
                    const due = proj.dueDate ? p.dueLabel(new Date(proj.dueDate)) : null;
                    return (
                      <Link key={proj.id} to={`/dashboard/projects/view/${proj.id}`} className="block group">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{proj.name}</p>
                            {proj.client && <p className="text-[11px] text-muted-foreground truncate">{proj.client}</p>}
                          </div>
                          {due && (
                            <span
                              className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${
                                due.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {due.text}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={proj.progress}
                            className="h-1.5 bg-muted flex-1"
                            indicatorClassName={proj.progress >= 50 ? "bg-primary" : proj.progress < 30 ? "bg-destructive" : "bg-secondary"}
                          />
                          <span className="text-[10px] font-bold text-muted-foreground w-8 text-right tabular-nums">{proj.progress}%</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-10 text-muted-foreground">
                  <Briefcase className="w-7 h-7 opacity-30 mb-2" />
                  <p className="text-xs font-medium">No active projects in view</p>
                </div>
              )}
            </div>
          ) : (
            <div className={`${cardBase} p-4 sm:p-5 flex flex-col items-center justify-center min-h-[280px] text-muted-foreground`}>
              <FolderKanban className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-xs font-medium">Project access not granted</p>
            </div>
          )}
        </div>
      </section>

      {(p.canReadTeam || p.activities.length > 0) && (
        <section>
          <div className={`grid gap-4 md:gap-5 ${p.canReadTeam && p.activities.length > 0 ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
            {p.canReadTeam && (
              <div className={`${cardBase} p-4 sm:p-5`}>
                <SectionHeading icon={UserCog} title="Team pulse" />
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-lg bg-muted/60 p-2.5 text-center">
                    <p className="text-lg font-black tabular-nums leading-none">{p.teamSnapshot.active}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground mt-1">Active</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2.5 text-center">
                    <p className="text-lg font-black tabular-nums text-secondary leading-none">{p.teamSnapshot.onLeave}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground mt-1">On leave</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2.5 text-center">
                    <p className="text-lg font-black tabular-nums text-orange-500 leading-none">{p.teamSnapshot.pending}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground mt-1">Pending</p>
                  </div>
                </div>
                {p.teamSnapshot.workload.length > 0 ? (
                  <div className="space-y-2.5">
                    {p.teamSnapshot.workload.map((w) => (
                      <div key={w.id} className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold truncate w-24 shrink-0">{w.name}</span>
                        <Progress
                          value={p.teamSnapshot.maxLoad > 0 ? (w.count / p.teamSnapshot.maxLoad) * 100 : 0}
                          className="h-1.5 bg-muted flex-1"
                          indicatorClassName="bg-emerald-500"
                        />
                        <span className="text-[10px] font-bold text-muted-foreground w-4 text-right">{w.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No active task load data</p>
                )}
              </div>
            )}

            {p.activities.length > 0 && (
              <div className={`${cardBase} p-4 sm:p-5`}>
                <SectionHeading icon={FileText} title="Recent activity" />
                <div className="space-y-3">
                  {p.activities.slice(0, 8).map((act, i) => (
                    <Link key={i} to={act.link} className="flex items-center gap-3 group">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          act.colorType === "primary" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                        }`}
                      >
                        {act.colorType === "primary" ? <Users className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{act.subject}</p>
                        <p className="text-[11px] text-muted-foreground">{act.action}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(act.time)} ago</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
