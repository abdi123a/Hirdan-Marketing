import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, CheckCheck, AlertCircle, Info, CheckCircle, AlertTriangle, ChevronRight, Inbox, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { apiFetch } from "@/lib/api-client";
import { formatDistanceToNow } from "date-fns";
import { useAuthStore } from "@/lib/auth-store";
import type { Notification } from "@/lib/store";

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
    label: 'Action',
    icon: AlertCircle,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    ring: 'ring-rose-500/20',
    dot: 'bg-rose-500',
  },
  INFORMATION: {
    label: 'Info',
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    ring: 'ring-blue-500/20',
    dot: 'bg-blue-500',
  },
  SUCCESS: {
    label: 'Success',
    icon: CheckCircle,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  WARNING: {
    label: 'Warning',
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-500',
  },
} as const;

function NotificationItem({
  notif,
  onRead,
  onDelete,
  onNavigate,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const cfg = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.INFORMATION;
  const Icon = cfg.icon;

  const handleClick = () => {
    if (!notif.read) onRead(notif.id);
    if (notif.actionUrl) onNavigate(notif.actionUrl);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group relative flex items-start gap-3.5 p-3.5 transition-all duration-200 border-b border-border/40 last:border-b-0
        ${!notif.read ? 'bg-primary/[0.03] hover:bg-primary/[0.06]' : 'bg-transparent hover:bg-muted/40'}
        ${notif.actionUrl ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {/* Category Icon */}
      <div className={`shrink-0 mt-0.5 p-2 rounded-xl ${cfg.bg} ${cfg.color} ring-1 ${cfg.ring}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content Body */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs leading-snug ${!notif.read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
            {notif.title}
          </p>
          <span className="text-[10px] font-medium text-muted-foreground shrink-0 mt-0.5">
            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {notif.message}
        </p>

        {notif.actionUrl && (
          <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-primary group-hover:underline">
            <span>View details</span>
            <ChevronRight className="h-2.5 w-2.5" />
          </div>
        )}
      </div>

      {/* Unread indicator & Delete action */}
      <div className="flex flex-col items-center justify-between gap-2 shrink-0 self-stretch">
        {!notif.read && (
          <div className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse mt-1`} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notif.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-muted"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>('ALL');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await apiFetch<NotificationCounts>('/notifications/counts');
      setCounts(res);
    } catch { /* silent */ }
  }, []);

  const fetchNotifications = useCallback(async (category?: Category) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category === 'UNREAD') {
        params.set('unreadOnly', 'true');
      } else if (category && category !== 'ALL') {
        params.set('category', category);
      }
      const res = await apiFetch<{ notifications: Notification[] }>(`/notifications?${params}`);
      setNotifications(res.notifications || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const handleRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setCounts(prev => prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev);
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
      const removed = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (removed && !removed.read) {
        setCounts(prev => prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev);
      }
    } catch { /* silent */ }
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
      console.error(err);
    }
  };

  const handleNavigate = (url: string) => {
    setOpen(false);
    const { user } = useAuthStore.getState();
    const isClient = user?.role === "client";

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

  const goToFullNotificationsPage = () => {
    setOpen(false);
    const { user } = useAuthStore.getState();
    if (user?.role === 'client') {
      navigate('/client/portal?tab=notifications');
    } else {
      navigate('/dashboard/notifications');
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  useEffect(() => {
    if (open) fetchNotifications(activeTab);
  }, [open, activeTab, fetchNotifications]);

  const unread = counts?.unread ?? 0;
  const filtered = notifications;
  const hasUnreadInTab = filtered.some(n => !n.read);

  const tabs: { key: Category; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: counts?.total ?? 0 },
    { key: 'UNREAD', label: 'Unread', count: unread },
    { key: 'ACTION_REQUIRED', label: 'Action', count: counts?.byCategory.ACTION_REQUIRED ?? 0 },
    { key: 'WARNING', label: 'Warning', count: counts?.byCategory.WARNING ?? 0 },
    { key: 'SUCCESS', label: 'Success', count: counts?.byCategory.SUCCESS ?? 0 },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id="notification-bell-btn"
          className={`
            relative h-9 w-9 rounded-xl transition-all duration-200 flex items-center justify-center group outline-none
            ${open ? 'bg-primary/10 text-primary ring-2 ring-primary/20' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}
          `}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 transition-transform group-hover:scale-105" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-background animate-pulse">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] sm:w-[420px] max-w-[calc(100vw-24px)] p-0 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm text-foreground">Notifications</span>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold ring-1 ring-rose-500/20">
                {unread} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {hasUnreadInTab && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-7 px-2 text-[11px] font-medium text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-lg"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark read</span>
              </Button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 p-2 border-b border-border/40 bg-muted/10 overflow-x-auto">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all duration-150
                  ${isActive
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }
                `}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`
                    px-1.5 py-0.2 rounded-full text-[9px] font-bold min-w-[16px] text-center
                    ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
                  `}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/30">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs">Loading notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 px-6 flex flex-col items-center text-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Inbox className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-xs font-semibold text-foreground mt-1">All clear!</p>
              <p className="text-[11px] text-muted-foreground">
                {activeTab === 'ALL'
                  ? 'No notifications yet.'
                  : `No ${activeTab.toLowerCase().replace('_', ' ')} notifications.`}
              </p>
            </div>
          ) : (
            filtered.map(notif => (
              <NotificationItem
                key={notif.id}
                notif={notif}
                onRead={handleRead}
                onDelete={handleDelete}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-border/50 bg-muted/20 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground pl-1 font-medium">
            Showing {filtered.length} of {counts?.total ?? filtered.length}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToFullNotificationsPage}
            className="h-7 px-3 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-xl"
          >
            <span>View all notifications</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
