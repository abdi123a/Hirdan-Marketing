import {
  LayoutDashboard, Users, Briefcase, UserCircle, LayoutGrid,
  Receipt, CreditCard, CalendarDays, Settings, LogOut, PanelLeftClose, PanelLeft,
  FileText, Package, Zap, Mail, Share2, Presentation, BarChart3, Wallet,
  FolderHeart, UploadCloud, Puzzle, Sparkles, Inbox
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuthStore } from "@/lib/auth-store";
import { useAgencyStore } from "@/lib/store";
import { useMailboxes } from "@/lib/email/hooks";
import hirdanLogo from "@/assets/hirdan-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "AI Assistant", url: "/dashboard/ai-assistant", icon: Sparkles },
  { title: "Clients", url: "/dashboard/clients", icon: Users },
  { title: "Projects", url: "/dashboard/projects", icon: Briefcase },
  { title: "Team", url: "/dashboard/team", icon: UserCircle },
  { title: "Email Center", url: "/dashboard/email", icon: Inbox },
  { title: "HR Documents", url: "/dashboard/hr", icon: FolderHeart },
  { title: "Proforma", url: "/dashboard/proforma", icon: FileText },
  { title: "Invoices", url: "/dashboard/invoices", icon: Receipt },
  { title: "Subscriptions", url: "/dashboard/subscriptions", icon: CreditCard },
  { title: "Social Media", url: "/dashboard/social-media", icon: Share2 },
  { title: "Strategy Decks", url: "/dashboard/social-media/presentation", icon: Presentation },
  { title: "File Transfer", url: "/dashboard/transfers", icon: UploadCloud },
  { title: "Monthly Reports", url: "/dashboard/reports/monthly", icon: Presentation },
  { title: "Financial Reports", url: "/dashboard/reports/financial", icon: BarChart3 },
  { title: "Expenses", url: "/dashboard/expenses", icon: Wallet },
  { title: "Packages", url: "/dashboard/packages", icon: Package },
  { title: "Services", url: "/dashboard/services", icon: Zap },
  { title: "Email List", url: "/dashboard/leads", icon: Mail },
  { title: "Calendar", url: "/dashboard/calendar", icon: CalendarDays },
];


export function AppSidebar() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { user, logout } = useAuthStore();
  const { settings } = useAgencyStore();
  const navigate = useNavigate();
  const { data: mailboxes = [] } = useMailboxes();
  const totalUnreadMail = mailboxes.reduce((sum, m) => sum + (m.unreadCount ?? 0), 0);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const allowedItems = mainItems.filter(item => {
    if (item.url === "/dashboard/hr") {
      return user?.role === 'admin' || user?.role === 'manager';
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Logo */}
      <SidebarHeader className="p-0">
        <div className={`flex items-center ${collapsed ? "justify-center py-5" : "justify-center py-6"}`}>
          <img
            src={settings.logo || hirdanLogo}
            alt={settings.agencyName}
            className={collapsed ? "h-9 w-9 object-contain" : "h-14 object-contain"}
          />
        </div>
        <SidebarSeparator />
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className={collapsed ? "px-1.5 py-3" : "px-3 py-3"}>
        <SidebarGroup className={collapsed ? "p-0" : ""}>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/35 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 px-3">
              Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className={collapsed ? "items-center gap-1.5" : "gap-0.5"}>
              {allowedItems.map((item) => {
                if (item.url === "/dashboard/social-media") {
                  if (collapsed) {
                    return (
                      <SidebarMenuItem key={item.title} className="flex justify-center">
                        <SidebarMenuButton asChild tooltip={item.title}>
                          <NavLink
                            to="/dashboard/social-media/publish"
                            className="flex items-center justify-center w-10 h-10 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                            activeClassName="bg-sidebar-accent text-sidebar-primary"
                          >
                            <item.icon className="h-[18px] w-[18px] shrink-0" />
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  } else {
                    return (
                      <div key={item.title} className="w-full flex flex-col gap-1 py-1">
                        <div className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-[0.15em] mb-1 px-3 mt-2 flex items-center gap-2">
                          <item.icon className="h-3.5 w-3.5" />
                          {item.title}
                        </div>
                        <div className="flex flex-col gap-0.5 pl-2.5 ml-2 border-l border-sidebar-border/40">
                          <NavLink
                            to="/dashboard/social-media/analyze"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 text-[13px]"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                            <span>Analyze</span>
                          </NavLink>
                          <NavLink
                            to="/dashboard/social-media/publish"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 text-[13px]"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <Share2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Publish</span>
                          </NavLink>
                          <NavLink
                            to="/dashboard/social-media/accounts"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 text-[13px]"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            <span>Accounts</span>
                          </NavLink>
                        </div>
                      </div>
                    );
                  }
                }

                const isEmailCenter = item.url === "/dashboard/email";

                return (
                  <SidebarMenuItem key={item.title} className={collapsed ? "flex justify-center" : ""}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className={
                          collapsed
                            ? "relative flex items-center justify-center w-10 h-10 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                            : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                        }
                        activeClassName={
                          collapsed
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "bg-sidebar-accent text-sidebar-primary font-medium"
                        }
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="text-[13px] flex-1">{item.title}</span>}
                        {isEmailCenter && totalUnreadMail > 0 && (
                          collapsed ? (
                            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                            </span>
                          ) : (
                            <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                              {totalUnreadMail}
                            </span>
                          )
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-0 mt-auto">
        <SidebarSeparator />
        <div className={collapsed ? "px-1.5 py-3" : "px-3 py-3"}>
          <SidebarMenu className={collapsed ? "items-center gap-1.5" : "gap-0.5"}>
            <SidebarMenuItem className={collapsed ? "flex justify-center" : ""}>
              <SidebarMenuButton asChild tooltip="Settings">
                <NavLink
                  to="/dashboard/settings"
                  className={
                    collapsed
                      ? "flex items-center justify-center w-10 h-10 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                      : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                  }
                  activeClassName="text-sidebar-primary"
                >
                  <Settings className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="text-[13px]">Settings</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem className={collapsed ? "flex justify-center" : ""}>
              <SidebarMenuButton asChild tooltip="Sign Out">
                <button
                  onClick={handleLogout}
                  className={
                    collapsed
                      ? "flex items-center justify-center w-10 h-10 rounded-xl text-sidebar-foreground/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                      : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                  }
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="text-[13px]">Sign Out</span>}
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        <SidebarSeparator />
        {/* Version badge */}
        {!collapsed && (
          <div className="px-4 py-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-sidebar-foreground/30 bg-sidebar-accent/40 px-2 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              v{settings.appVersion || '1.0.0'}
            </span>
          </div>
        )}
        {!isMobile && (
          <div className={`flex ${collapsed ? "justify-center" : "justify-end px-3"} py-3`}>
            <button
              onClick={toggleSidebar}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
