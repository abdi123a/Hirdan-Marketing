import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Bell, CheckCheck, Trash2, AlertCircle, Info, CheckCircle, AlertTriangle, 
  ChevronRight, Inbox, Search, Filter, RefreshCw, Sparkles, ExternalLink,
  ArrowLeft, Check, Layers, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api-client";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { useAuthStore } from "@/lib/auth-store";
import type { Notification } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

type Category = 'ALL' | 'UNREAD' | 'ACTION_REQUIRED' | 'WARNING' | 'SUCCESS' | 'INFORMATION';

interface NotificationCounts {
  total: number;
  unread: number;
  byCategory: {
    ACTION_REQUIRED: number;
    INFORMATION: number;
    SUCCESS: number;
    WARNING: number;
  };
}

const CATEGORY_CONFIG = {
  ACTION_REQUIRED: {
    label: 'Action Required',
    icon: AlertCircle,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    ring: 'ring-rose-500/30',
    badgeBg: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
  INFORMATION: {
    label: 'Information',
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    ring: 'ring-blue-500/30',
    badgeBg: 'bg-blue-500',
    dot: 'bg-blue-500',
  },
  SUCCESS: {
    label: 'Success',
    icon: CheckCircle,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    ring: 'ring-emerald-500/30',
    badgeBg: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  WARNING: {
    label: 'Warning',
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    ring: 'ring-amber-500/30',
    badgeBg: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
} as const;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Category>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await apiFetch<NotificationCounts>('/notifications/counts');
      setCounts(res);
    } catch (err) {
      console.error('Failed to fetch notification counts', err);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'UNREAD') {
        params.set('unreadOnly', 'true');
      } else if (activeTab !== 'ALL') {
        params.set('category', activeTab);
      }
      const res = await apiFetch<{ notifications: Notification[] }>(`/notifications?${params}`);
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchCounts();
    fetchNotifications();
  }, [fetchCounts, fetchNotifications]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCounts();
    fetchNotifications();
  };

  const handleRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setCounts(prev => prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev);
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
      const removed = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (removed && !removed.read) {
        setCounts(prev => prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev);
      }
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const catParam = (activeTab !== 'ALL' && activeTab !== 'UNREAD') ? activeTab : undefined;
      await apiFetch('/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catParam ? { category: catParam } : {}),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      fetchCounts();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const handleNavigate = (url: string) => {
    const { user } = useAuthStore.getState();
    const isClient = user?.role === 'client';

    if (isClient) {
      if (url.includes("/invoices") || url.includes("/proformas")) {
        navigate("/client/portal?tab=financials");
      } else if (url.includes("/projects")) {
        navigate("/client/portal?tab=projects");
      } else if (url.includes("/subscriptions")) {
        navigate("/client/portal?tab=subscriptions");
      } else {
        navigate("/client/portal?tab=overview");
      }
    } else {
      let targetUrl = url;
      if (targetUrl.includes("/dashboard/reports/")) {
        targetUrl = "/dashboard/reports/monthly";
      }
      if (targetUrl.includes("/dashboard/proformas/")) {
        targetUrl = targetUrl.replace("/dashboard/proformas/", "/dashboard/proforma/");
      }

      const viewPatterns = [
        { key: "/dashboard/invoices/", replacement: "/dashboard/invoices/view/" },
        { key: "/dashboard/projects/", replacement: "/dashboard/projects/view/" },
        { key: "/dashboard/subscriptions/", replacement: "/dashboard/subscriptions/view/" },
        { key: "/dashboard/team/", replacement: "/dashboard/team/view/" },
        { key: "/dashboard/clients/", replacement: "/dashboard/clients/view/" },
        { key: "/dashboard/packages/", replacement: "/dashboard/packages/view/" },
        { key: "/dashboard/services/", replacement: "/dashboard/services/view/" },
        { key: "/dashboard/proforma/", replacement: "/dashboard/proforma/view/" },
      ];

      for (const pattern of viewPatterns) {
        if (targetUrl.includes(pattern.key) && !targetUrl.includes(pattern.replacement)) {
          const parts = targetUrl.split(pattern.key);
          if (parts.length === 2 && parts[1]) {
            const subPath = parts[1];
            if (!subPath.startsWith("view/") && !subPath.startsWith("edit/") && !subPath.startsWith("add")) {
              targetUrl = `${parts[0]}${pattern.replacement}${subPath}`;
              break;
            }
          }
        }
      }
      navigate(targetUrl);
    }
  };

  // Filter notifications based on search query
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const matchSearch = searchQuery.trim() === '' || 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchSearch) return false;
      if (activeTab === 'UNREAD') return !n.read;
      if (activeTab !== 'ALL') return n.category === activeTab;
      return true;
    });
  }, [notifications, searchQuery, activeTab]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: Notification[] } = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filteredNotifications.forEach(n => {
      const date = new Date(n.createdAt);
      if (isToday(date)) {
        groups.Today.push(n);
      } else if (isYesterday(date)) {
        groups.Yesterday.push(n);
      } else {
        groups.Earlier.push(n);
      }
    });

    return groups;
  }, [filteredNotifications]);

  const hasUnread = notifications.some(n => !n.read);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">
              Notification Center
            </h1>
            {counts && counts.unread > 0 && (
              <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-primary/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {counts.unread} Unread
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Stay informed with real-time updates across your projects, subscriptions, and system alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasUnread && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="gap-2 rounded-xl text-xs font-medium border-border/80 hover:bg-muted"
            >
              <CheckCheck className="h-4 w-4 text-primary" />
              Mark all as read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2 rounded-xl text-xs font-medium border-border/80 hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts?.total ?? 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bell className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unread</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts?.unread ?? 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action Required</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts?.byCategory.ACTION_REQUIRED ?? 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Warnings</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts?.byCategory.WARNING ?? 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border/40 overflow-x-auto">
            {[
              { key: 'ALL', label: 'All', count: counts?.total },
              { key: 'UNREAD', label: 'Unread', count: counts?.unread },
              { key: 'ACTION_REQUIRED', label: 'Action Required', count: counts?.byCategory.ACTION_REQUIRED },
              { key: 'WARNING', label: 'Warnings', count: counts?.byCategory.WARNING },
              { key: 'SUCCESS', label: 'Success', count: counts?.byCategory.SUCCESS },
              { key: 'INFORMATION', label: 'Info', count: counts?.byCategory.INFORMATION },
            ].map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as Category)}
                  className={`
                    flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200
                    ${isActive
                      ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }
                  `}
                >
                  {tab.label}
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span className={`
                      px-1.5 py-0.2 rounded-full text-[10px] font-bold min-w-[18px] text-center
                      ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
                    `}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-card border-border/60 rounded-xl text-xs focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Notifications Feed */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/80 bg-card/40 p-12 text-center">
            <div className="flex flex-col items-center gap-3 max-w-sm mx-auto">
              <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                <Inbox className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No notifications found</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {searchQuery
                  ? `No notifications matching "${searchQuery}". Try adjusting your search query.`
                  : activeTab === 'UNREAD'
                  ? "You're all caught up! There are no unread notifications at the moment."
                  : `There are currently no ${activeTab !== 'ALL' ? activeTab.toLowerCase().replace('_', ' ') : ''} notifications.`}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([groupName, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={groupName} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {groupName}
                    </span>
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {items.map(notif => {
                      const cfg = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.INFORMATION;
                      const Icon = cfg.icon;

                      return (
                        <motion.div
                          key={notif.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Card
                            onClick={() => {
                              if (!notif.read) handleRead(notif.id);
                              if (notif.actionUrl) handleNavigate(notif.actionUrl);
                            }}
                            className={`
                              group relative rounded-2xl border transition-all duration-200 overflow-hidden
                              ${!notif.read
                                ? 'bg-card border-border/80 shadow-sm ring-1 ring-primary/10 hover:border-primary/40'
                                : 'bg-card/40 border-border/40 hover:bg-card hover:border-border/80'
                              }
                              ${notif.actionUrl ? 'cursor-pointer' : 'cursor-default'}
                            `}
                          >
                            <CardContent className="p-4 flex items-start gap-4">
                              {/* Category Icon Badge */}
                              <div className={`shrink-0 p-2.5 rounded-xl ${cfg.bg} ${cfg.color} ring-1 ${cfg.ring}`}>
                                <Icon className="h-5 w-5" />
                              </div>

                              {/* Content Body */}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <h4 className={`text-sm font-semibold leading-snug ${!notif.read ? 'text-foreground font-bold' : 'text-foreground/80'}`}>
                                      {notif.title}
                                    </h4>
                                    {!notif.read && (
                                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground shrink-0 font-medium">
                                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                  </span>
                                </div>

                                <p className="text-xs text-muted-foreground leading-relaxed break-words">
                                  {notif.message}
                                </p>

                                {notif.actionUrl && (
                                  <div className="pt-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:underline">
                                    <span>View details</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </div>
                                )}
                              </div>

                              {/* Quick Actions */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                {!notif.read && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRead(notif.id);
                                    }}
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted"
                                    title="Mark as read"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(notif.id);
                                  }}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Dismiss"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
