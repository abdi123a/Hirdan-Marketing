import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Search, LogOut } from "lucide-react";
import { SidebarMobileTrigger } from "@/components/ui/sidebar";
import hirdanLogo from "@/assets/hirdan-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { useAgencyStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api-client";
import { NotificationCenter } from "./NotificationCenter";

export default function DashboardLayout() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user, logout } = useAuthStore();
  const { settings, fetchSettings, fetchAllData } = useAgencyStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isLandingEditor =
    location.pathname === "/dashboard/settings" &&
    new URLSearchParams(location.search).get("tab") === "landing-page";

  useEffect(() => {
    fetchSettings();
    fetchAllData();
  }, [fetchSettings, fetchAllData]);

  // Appearance is now handled globally by AgencyAppearanceManager in App.tsx

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      toast({
        title: "Searching...",
        description: `Looking for "${searchQuery}" across your agency database.`,
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Get initials from the team lead or settings
  const adminName = settings.agencyName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SidebarProvider open={!isLandingEditor}>
      <div className="min-h-screen flex w-full bg-background font-sans">
        {!isLandingEditor && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          {!isLandingEditor && <header className="shrink-0 sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
            <div className="h-14 md:h-16 flex items-center justify-between gap-2 px-4 md:px-6">
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                {/* Mobile Sidebar Toggle & Logo */}
                <div className="flex items-center gap-2 md:hidden shrink-0">
                  <SidebarMobileTrigger />
                  <div className="h-6 w-px bg-border/60 mx-0.5 shrink-0" />
                  <img
                    src={settings.logo || hirdanLogo}
                    alt={settings.agencyName}
                    className="h-11 w-auto max-w-[160px] object-contain"
                  />
                </div>

                <form onSubmit={handleSearch} className="relative hidden md:block group max-w-md min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Search anything..."
                    className="pl-9 w-72 max-w-full bg-muted/50 border-border/50 focus:bg-card rounded-xl h-9 text-sm transition-all focus:w-80"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </form>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <NotificationCenter />
                <div className="w-px h-6 bg-border mx-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 pl-1 hover:opacity-80 transition-opacity outline-none">
                      <Avatar className="h-9 w-9 ring-2 ring-primary/10 hover:ring-primary/30 transition-all cursor-pointer">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-display font-bold">{adminName}</AvatarFallback>
                      </Avatar>
                      <div className="hidden md:block text-left">
                        <p className="text-sm font-semibold text-foreground leading-none">{user?.email || 'Admin'}</p>
                        <p className="text-xs text-muted-foreground mt-1">Administrator</p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{settings.agencyName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/dashboard/settings')} className="cursor-pointer">
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <form onSubmit={handleSearch} className="relative md:hidden px-4 pb-3 pt-0 border-t border-border/40 bg-card/90">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search anything..."
                className="pl-9 w-full bg-muted/50 border-border/50 focus:bg-card rounded-xl h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
          </header>}
          <main className={isLandingEditor ? "flex-1 overflow-auto min-w-0" : "flex-1 overflow-auto p-4 md:p-6 lg:p-8 min-w-0"}>
            <Suspense
              fallback={
                <div className="flex flex-col gap-6 animate-pulse w-full">
                  {/* Header/Title Skeleton */}
                  <div className="flex flex-col gap-2">
                    <div className="h-8 w-48 bg-muted/60 rounded-lg" />
                    <div className="h-4 w-80 bg-muted/40 rounded-lg" />
                  </div>
                  {/* Cards/Stats Grid Skeleton */}
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="h-32 bg-muted/50 rounded-xl" />
                    <div className="h-32 bg-muted/50 rounded-xl" />
                    <div className="h-32 bg-muted/50 rounded-xl" />
                  </div>
                  {/* Main Content Area Skeleton */}
                  <div className="h-[300px] w-full bg-muted/40 rounded-xl" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
