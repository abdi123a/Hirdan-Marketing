import { 
  LayoutDashboard, Users, Briefcase, UserCircle, 
  Receipt, CreditCard, CalendarDays, Settings, LogOut, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clients", url: "/dashboard/clients", icon: Users },
  { title: "Projects", url: "/dashboard/projects", icon: Briefcase },
  { title: "Team", url: "/dashboard/team", icon: UserCircle },
  { title: "Invoices", url: "/dashboard/invoices", icon: Receipt },
  { title: "Subscriptions", url: "/dashboard/subscriptions", icon: CreditCard },
  { title: "Calendar", url: "/dashboard/calendar", icon: CalendarDays },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Logo & Toggle Header */}
      <SidebarHeader className="p-0">
        <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3 overflow-hidden">
            <img 
              src={hirdanLogo} 
              alt="Hirdan" 
              className={collapsed ? "h-8 w-8 object-contain" : "h-10 object-contain"} 
            />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-display font-bold text-sidebar-foreground tracking-wide">HIRDAN</span>
                <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Marketing</span>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-[0.15em] font-semibold mb-1">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="text-[13px]">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <NavLink 
                to="/dashboard/settings" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200" 
                activeClassName="text-sidebar-primary font-semibold"
              >
                <Settings className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="text-[13px]">Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to Site">
              <a href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200">
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="text-[13px]">Back to Site</span>}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
