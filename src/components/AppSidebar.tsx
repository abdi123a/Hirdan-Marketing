import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, Briefcase, UserCircle, Receipt, CreditCard, CalendarDays,
  Settings, LogOut, PanelLeftClose, PanelLeft, FileText, Package, Zap, Mail, Share2,
  Presentation, BarChart3, Wallet, FolderHeart, UploadCloud, Sparkles, Inbox, ChevronDown,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuthStore } from "@/lib/auth-store";
import { useAgencyStore } from "@/lib/store";
import { useMailboxes } from "@/lib/email/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { type ModuleKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import hirdanLogo from "@/assets/hirdan-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  module: ModuleKey;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { title: "Overview", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
      { title: "AI Assistant", url: "/dashboard/ai-assistant", icon: Sparkles, module: "ai_assistant" },
      { title: "Calendar", url: "/dashboard/calendar", icon: CalendarDays, module: "calendar" },
      { title: "Email Center", url: "/dashboard/email", icon: Inbox, module: "email" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { title: "Clients", url: "/dashboard/clients", icon: Users, module: "clients" },
      { title: "Projects", url: "/dashboard/projects", icon: Briefcase, module: "projects" },
      { title: "Email List", url: "/dashboard/leads", icon: Mail, module: "leads" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { title: "Invoices", url: "/dashboard/invoices", icon: Receipt, module: "invoices" },
      { title: "Proforma", url: "/dashboard/proforma", icon: FileText, module: "proforma" },
      { title: "Subscriptions", url: "/dashboard/subscriptions", icon: CreditCard, module: "subscriptions" },
      { title: "Expenses", url: "/dashboard/expenses", icon: Wallet, module: "expenses" },
      { title: "Financial Reports", url: "/dashboard/reports/financial", icon: BarChart3, module: "financial_reports" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { title: "Team", url: "/dashboard/team", icon: UserCircle, module: "team" },
      { title: "HR Documents", url: "/dashboard/hr", icon: FolderHeart, module: "hr" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [
      { title: "Social Media", url: "/dashboard/social-media", icon: Share2, module: "social_media" },
      { title: "Strategy Decks", url: "/dashboard/social-media/presentation", icon: Presentation, module: "strategy_decks" },
      { title: "Monthly Reports", url: "/dashboard/reports/monthly", icon: Presentation, module: "monthly_reports" },
    ],
  },
  {
    id: "tools",
    label: "Catalog & tools",
    items: [
      { title: "Packages", url: "/dashboard/packages", icon: Package, module: "packages" },
      { title: "Services", url: "/dashboard/services", icon: Zap, module: "services" },
      { title: "File Transfer", url: "/dashboard/transfers", icon: UploadCloud, module: "transfers" },
    ],
  },
];

const OPEN_GROUPS_KEY = "hirdan-sidebar-open-groups";

const DEFAULT_OPEN = Object.fromEntries(NAV_GROUPS.map((g) => [g.id, true]));

function groupContainsPath(group: NavGroup, pathname: string) {
  return group.items.some((item) => {
    if (item.url === "/dashboard") return pathname === "/dashboard";
    return pathname === item.url || pathname.startsWith(`${item.url}/`);
  });
}

function NavItemLink({
  item,
  collapsed,
  badge,
}: {
  item: NavItem;
  collapsed: boolean;
  badge?: number;
}) {
  return (
    <SidebarMenuItem className={collapsed ? "flex justify-center" : ""}>
      <SidebarMenuButton asChild tooltip={item.title}>
        <NavLink
          to={item.url}
          end={item.url === "/dashboard"}
          className={
            collapsed
              ? "relative flex items-center justify-center !size-10 !p-0 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
              : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
          }
          activeClassName={
            collapsed
              ? "bg-sidebar-accent text-sidebar-primary"
              : "bg-sidebar-accent text-sidebar-primary font-medium"
          }
        >
          <item.icon className={collapsed ? "h-[18px] w-[18px] shrink-0" : "h-4 w-4 shrink-0"} />
          {!collapsed && (
            <span className="text-[13px] font-medium tracking-normal flex-1">{item.title}</span>
          )}
          {typeof badge === "number" && badge > 0 && (
            collapsed ? (
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            ) : (
              <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {badge}
              </span>
            )
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpen } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { logout } = useAuthStore();
  const { settings } = useAgencyStore();
  const { canRead, permissions } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const hasEmailAccess = canRead("email");
  const { data: mailboxes = [] } = useMailboxes(hasEmailAccess);
  const totalUnreadMail = hasEmailAccess
    ? mailboxes.reduce((sum, m) => sum + (m.unreadCount ?? 0), 0)
    : 0;

  // Prefer labeled sidebar so each user clearly sees only their modules
  useEffect(() => {
    if (!isMobile) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => canRead(item.module)),
    })).filter((group) => group.items.length > 0);
  }, [canRead, permissions]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(OPEN_GROUPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        const merged = { ...DEFAULT_OPEN, ...parsed };
        // If a prior session closed everything, reopen — empty nav feels broken
        const anyOpen = NAV_GROUPS.some((g) => merged[g.id] !== false);
        return anyOpen ? merged : { ...DEFAULT_OPEN };
      }
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_OPEN };
  });

  // Ensure the active route's section is open on navigation
  useEffect(() => {
    const active = visibleGroups.find((g) => groupContainsPath(g, location.pathname));
    if (!active) return;
    setOpenGroups((prev) => {
      if (prev[active.id]) return prev;
      const next = { ...prev, [active.id]: true };
      try {
        localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const canSettings = canRead("settings");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-0">
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "justify-center px-2 py-4" : "justify-between px-4 py-5"
          )}
        >
          {collapsed && !isMobile ? (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="group/logo relative h-11 w-11 flex items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <img
                src={settings.favicon || settings.logo || hirdanLogo}
                alt={settings.agencyName}
                className="pointer-events-none h-9 w-9 object-contain transition-opacity duration-150 ease-out group-hover/logo:opacity-0 group-focus-visible/logo:opacity-0"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl text-sidebar-foreground/70 opacity-0 transition-[opacity,background-color,color] duration-150 ease-out group-hover/logo:opacity-100 group-hover/logo:bg-sidebar-accent group-hover/logo:text-sidebar-foreground group-focus-visible/logo:opacity-100 group-focus-visible/logo:bg-sidebar-accent">
                <PanelLeft className="h-4 w-4" />
              </span>
            </button>
          ) : (
            <>
              <img
                src={settings.logo || hirdanLogo}
                alt={settings.agencyName}
                className="h-14 w-auto max-w-[168px] object-contain object-left"
              />
              {!isMobile && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-[opacity,color,background-color] duration-150 opacity-0 hover:opacity-100 focus-visible:opacity-100"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
        <SidebarSeparator />
      </SidebarHeader>

      <SidebarContent className={collapsed ? "px-1.5 py-2" : "px-3 py-3"}>
        {visibleGroups.map((group) => {
          // Icon-collapsed rail always shows item icons (sections hide)
          const isOpen = collapsed || openGroups[group.id] !== false;
          const isActiveGroup = groupContainsPath(group, location.pathname);

          return (
            <SidebarGroup key={group.id} className={collapsed ? "p-0 mb-1" : "p-0 mb-2"}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-1.5 mb-0.5 rounded-md text-left transition-colors duration-150",
                    "hover:bg-sidebar-accent/50",
                    isActiveGroup ? "text-sidebar-foreground/75" : "text-sidebar-foreground/45"
                  )}
                >
                  <span className="text-[12px] font-medium tracking-tight">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200 ease-out",
                      isOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
              )}

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden min-h-0">
                  <SidebarGroupContent>
                    <SidebarMenu className={collapsed ? "items-center gap-1" : "gap-0.5"}>
                      {group.items.map((item) => {
                        if (item.url === "/dashboard/social-media" && !collapsed) {
                          return (
                            <div key={item.title} className="w-full flex flex-col gap-0.5 py-0.5">
                              <NavItemLink item={item} collapsed={false} />
                              <div className="flex flex-col gap-0.5 pl-2 ml-4 border-l border-sidebar-border/35">
                                <NavLink
                                  to="/dashboard/social-media/analyze"
                                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150 text-[12px] font-medium"
                                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                                >
                                  <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                                  <span>Analyze</span>
                                </NavLink>
                                <NavLink
                                  to="/dashboard/social-media/publish"
                                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150 text-[12px] font-medium"
                                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                                >
                                  <Share2 className="h-3.5 w-3.5 shrink-0" />
                                  <span>Publish</span>
                                </NavLink>
                                <NavLink
                                  to="/dashboard/social-media/accounts"
                                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150 text-[12px] font-medium"
                                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                                >
                                  <Users className="h-3.5 w-3.5 shrink-0" />
                                  <span>Accounts</span>
                                </NavLink>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <NavItemLink
                            key={item.title}
                            item={item}
                            collapsed={collapsed}
                            badge={item.url === "/dashboard/email" ? totalUnreadMail : undefined}
                          />
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </div>
              </div>
            </SidebarGroup>
          );
        })}

        {!collapsed && visibleGroups.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-sidebar-foreground/50 leading-relaxed">
              No modules assigned. Ask an admin to grant access.
            </p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-0 mt-auto">
        <SidebarSeparator />
        <div className={collapsed ? "px-1.5 py-2.5" : "px-3 py-2.5"}>
          <SidebarMenu className={collapsed ? "items-center gap-1" : "gap-0.5"}>
            {canSettings && (
              <SidebarMenuItem className={collapsed ? "flex justify-center" : ""}>
                <SidebarMenuButton asChild tooltip="Settings">
                  <NavLink
                    to="/dashboard/settings"
                    className={
                      collapsed
                        ? "flex items-center justify-center !size-10 !p-0 rounded-xl text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
                        : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
                    }
                    activeClassName="text-sidebar-primary"
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="text-[13px] font-medium">Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem className={collapsed ? "flex justify-center" : ""}>
              <SidebarMenuButton asChild tooltip="Sign Out">
                <button
                  type="button"
                  onClick={handleLogout}
                  className={
                    collapsed
                      ? "flex items-center justify-center !size-10 !p-0 rounded-xl text-sidebar-foreground/55 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150"
                      : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/55 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150"
                  }
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="text-[13px] font-medium">Sign Out</span>}
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
