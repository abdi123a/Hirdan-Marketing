import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, CheckCheck, Trash2, AlertCircle, Info, CheckCircle, AlertTriangle, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { formatDistanceToNow } from "date-fns";
import { useAuthStore } from "@/lib/auth-store";
import type { Notification } from "@/lib/store";

// ─── Types ─────────────────────────────────────────────────────────

type Category = 'ALL' | 'ACTION_REQUIRED' | 'INFORMATION' | 'SUCCESS' | 'WARNING';

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

// ─── Category config ───────────────────────────────────────────────

const CATEGORY_CONFIG = {
  ACTION_REQUIRED: {
    label: 'Action Required',
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-l-red-500',
    badgeBg: 'bg-red-500',
    dot: 'bg-red-500',
  },
  INFORMATION: {
    label: 'Information',
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-l-blue-500',
    badgeBg: 'bg-blue-500',
    dot: 'bg-blue-500',
  },
  SUCCESS: {
    label: 'Success',
    icon: CheckCircle,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-l-emerald-500',
    badgeBg: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  WARNING: {
    label: 'Warning',
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-l-orange-500',
    badgeBg: 'bg-orange-500',
    dot: 'bg-orange-500',
  },
} as const;

// ─── Bell badge color (highest priority unread) ─────────────────────

function getBellColor(counts: NotificationCounts | null) {
  if (!counts || counts.unread === 0) return null;
  if (counts.byCategory.ACTION_REQUIRED > 0) return 'bg-red-500';
  if (counts.byCategory.WARNING > 0) return 'bg-orange-500';
  if (counts.byCategory.INFORMATION > 0) return 'bg-blue-500';
  if (counts.byCategory.SUCCESS > 0) return 'bg-emerald-500';
  return 'bg-red-500';
}

// ─── Single notification item ────────────────────────────────────────

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
        group relative flex gap-3 p-4 border-l-[3px] transition-all duration-200
        ${cfg.border}
        ${!notif.read ? cfg.bg : 'bg-transparent hover:bg-muted/30'}
        ${notif.actionUrl ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {/* Category icon */}
      <div className={`shrink-0 mt-0.5 p-1.5 rounded-lg ${cfg.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-semibold leading-snug ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
            {notif.title}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {notif.message}
        </p>
        {notif.actionUrl && (
          <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${cfg.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
            View details <ChevronRight className="h-2.5 w-2.5" />
          </div>
        )}
      </div>

      {/* Unread dot + delete */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        {!notif.read && (
          <div className={`w-2 h-2 rounded-full ${cfg.dot} mt-1`} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notif.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main NotificationCenter ─────────────────────────────────────────

export function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>('ALL');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // ─── Fetch counts (cheap, runs every 30s) ────────────────────────
  const fetchCounts = useCallback(async () => {
    try {
      const res = await apiFetch<{ total: number; unread: number; byCategory: any }>('/notifications/counts');
      setCounts(res);
    } catch { /* silent */ }
  }, []);

  // ─── Fetch full notification list (only when panel opens) ────────
  const fetchNotifications = useCallback(async (category?: Category) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category && category !== 'ALL') params.set('category', category);
      const res = await apiFetch<{ notifications: Notification[] }>(`/notifications?${params}`);
      setNotifications(res.notifications || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  // ─── Mark as read ───────────────────────────────────────────────
  const handleRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setCounts(prev => prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev);
    } catch { /* silent */ }
  };

  // ─── Delete ─────────────────────────────────────────────────────
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

  // ─── Mark all read in current tab ─────────────────────────────
  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTab !== 'ALL' ? { category: activeTab } : {}),
      });
      setNotifications(prev => prev.map(n =>
        (activeTab === 'ALL' || n.category === activeTab) ? { ...n, read: true } : n
      ));
      fetchCounts();
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Navigate and close ─────────────────────────────────────────
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
      } else if (url.includes("/documents")) {
        navigate("/client/portal?tab=documents");
      } else {
        navigate("/client/portal?tab=overview");
      }
    } else {
      navigate(url);
    }
  };

  // ─── Click outside to close ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ─── Initial load + polling ──────────────────────────────────────
  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  // ─── Fetch notifications when panel opens or tab changes ─────────
  useEffect(() => {
    if (open) fetchNotifications(activeTab);
  }, [open, activeTab, fetchNotifications]);

  const bellColor = getBellColor(counts);
  const unread = counts?.unread ?? 0;

  // Filtered based on tab (notifications already filtered server-side)
  const filtered = notifications;
  const hasUnreadInTab = filtered.some(n => !n.read);

  const tabs: { key: Category; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: unread },
    { key: 'ACTION_REQUIRED', label: 'Action', count: counts?.byCategory.ACTION_REQUIRED ?? 0 },
    { key: 'WARNING', label: 'Warning', count: counts?.byCategory.WARNING ?? 0 },
    { key: 'SUCCESS', label: 'Success', count: counts?.byCategory.SUCCESS ?? 0 },
    { key: 'INFORMATION', label: 'Info', count: counts?.byCategory.INFORMATION ?? 0 },
  ];

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        id="notification-bell-btn"
        onClick={() => setOpen(v => !v)}
        className="relative h-9 w-9 rounded-xl hover:bg-muted transition-colors flex items-center justify-center group"
        aria-label="Notifications"
      >
        <Bell className={`h-[18px] w-[18px] transition-colors ${open ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
        {unread > 0 && (
          <span className={`absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full ${bellColor} text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-card animate-bounce`}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-12 z-50 w-[380px] md:w-[420px] rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Notification Center</span>
              {unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasUnreadInTab && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
              <button onClick={() => setOpen(false)} className="ml-2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 px-2 pt-2 pb-1 border-b border-border/40 bg-muted/10 overflow-x-auto">
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              const cfg = tab.key !== 'ALL' ? CATEGORY_CONFIG[tab.key] : null;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all duration-150
                    ${isActive
                      ? 'bg-card shadow-sm text-foreground border border-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }
                  `}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`
                      px-1 py-0.5 rounded-full text-[9px] font-bold text-white min-w-[16px] text-center leading-tight
                      ${cfg ? cfg.badgeBg : 'bg-muted-foreground'}
                    `}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          <div className="max-h-[440px] overflow-y-auto divide-y divide-border/30">
            {loading ? (
              <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs">Loading notifications…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 flex flex-col items-center gap-3 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
                  <Inbox className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-medium text-foreground/70">All clear!</p>
                  <p className="text-[11px] text-muted-foreground">
                    {activeTab === 'ALL' ? 'No notifications yet.' : `No ${activeTab.toLowerCase().replace('_', ' ')} notifications.`}
                  </p>
                </div>
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
          {filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{filtered.length} notifications</span>
              <button
                onClick={() => {
                  fetchNotifications(activeTab);
                }}
                className="text-[10px] text-primary hover:underline font-medium"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
