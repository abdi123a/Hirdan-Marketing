import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Inbox, MailOpen, Send, Reply, Eye, MousePointerClick, AlertTriangle, Clock, Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { initials, avatarColor, listTime } from '@/lib/email/format';
import {
  useMailboxes, useAnalyticsOverview, useAnalyticsVolume, useAnalyticsByMailbox, useTopSenders,
  useAgents, useDepartments, useActivity,
} from '@/lib/email/hooks';
import { StatusBadge } from '@/components/email/StatusBadge';
import { Bot } from 'lucide-react';

const SENT = '#6366f1';
const RECEIVED = '#10b981';

function fmtDuration(mins: number): string {
  if (!mins) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function EmailAnalyticsPage() {
  const navigate = useNavigate();
  const [mailboxId, setMailboxId] = useState<string | undefined>();
  const [days, setDays] = useState(30);

  const { data: mailboxes = [] } = useMailboxes();
  const { data: overview, isLoading } = useAnalyticsOverview(mailboxId);
  const { data: volume = [] } = useAnalyticsVolume(days, mailboxId);
  const { data: byMailbox = [] } = useAnalyticsByMailbox();
  const { data: topSenders = [] } = useTopSenders(mailboxId);
  const { data: agents = [] } = useAgents(mailboxId);
  const { data: departments = [] } = useDepartments();
  const { data: activity = [] } = useActivity(mailboxId);

  const c = overview?.cards;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/email')} title="Back to Email Center">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Email analytics</h1>
          <p className="text-sm text-muted-foreground">Delivery, engagement and volume across your mailboxes.</p>
        </div>
        <Select value={mailboxId ?? 'all'} onValueChange={(v) => setMailboxId(v === 'all' ? undefined : v)}>
          <SelectTrigger className="h-9 w-[180px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All mailboxes</SelectItem>
            {mailboxes.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading || !c ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card icon={<Inbox className="h-4 w-4" />} label="Inbox" value={c.inbox} />
            <Card icon={<MailOpen className="h-4 w-4" />} label="Unread" value={c.unread} accent={c.unread > 0} />
            <Card icon={<Send className="h-4 w-4" />} label="Sent today" value={c.todaySent} />
            <Card icon={<Reply className="h-4 w-4" />} label="Replies" value={c.replies} />
            <Card icon={<Eye className="h-4 w-4" />} label="Open rate" value={`${c.openRate}%`} />
            <Card icon={<MousePointerClick className="h-4 w-4" />} label="Click rate" value={`${c.clickRate}%`} />
            <Card icon={<AlertTriangle className="h-4 w-4" />} label="Bounce rate" value={`${c.bounceRate}%`} />
            <Card icon={<Clock className="h-4 w-4" />} label="Avg response" value={fmtDuration(c.avgResponseMinutes)} />
          </div>

          {/* Volume chart */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Volume — sent vs received</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={volume} margin={{ left: -20, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={SENT} stopOpacity={0.35} /><stop offset="95%" stopColor={SENT} stopOpacity={0} /></linearGradient>
                  <linearGradient id="gRecv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={RECEIVED} stopOpacity={0.35} /><stop offset="95%" stopColor={RECEIVED} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => String(d).slice(5)} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="received" name="Received" stroke={RECEIVED} fill="url(#gRecv)" strokeWidth={2} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke={SENT} fill="url(#gSent)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Mailbox comparison */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">By mailbox</p>
              {byMailbox.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={byMailbox} margin={{ left: -20, right: 8, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="displayName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="received" name="Received" fill={RECEIVED} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="sent" name="Sent" fill={SENT} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top senders */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Top senders</p>
              {topSenders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No inbound mail yet</p>
              ) : (
                <div className="space-y-1.5">
                  {topSenders.map((s) => (
                    <div key={s.email} className="flex items-center gap-2.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(s.email)}`}>
                        {initials(null, s.email)}
                      </div>
                      <span className="flex-1 truncate text-sm">{s.email}</span>
                      <span className="text-xs font-medium text-muted-foreground">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Who's responding (agent performance) + Department */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="mb-1 text-sm font-semibold">Who's sending</p>
              <p className="mb-3 text-xs text-muted-foreground">Emails sent per team member across accessible mailboxes.</p>
              {agents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No sent emails yet</p>
              ) : (
                <div className="space-y-1.5">
                  {agents.map((a) => (
                    <div key={a.userId ?? 'automated'} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${a.automated ? 'bg-slate-400' : avatarColor(a.name)}`}>
                        {a.automated ? <Bot className="h-3.5 w-3.5" /> : initials(a.name)}
                      </div>
                      <span className="flex-1 truncate text-sm">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{a.openRate}% open</span>
                      <span className="w-10 text-right text-sm font-semibold">{a.sent}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold">By department</p>
              {departments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={departments} layout="vertical" margin={{ left: 12, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="received" name="Received" fill={RECEIVED} radius={[0, 3, 3, 0]} />
                    <Bar dataKey="sent" name="Sent" fill={SENT} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent activity — who sent what */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-sm font-semibold">Recent sent — by whom</p>
            <p className="mb-3 text-xs text-muted-foreground">Audit log of outgoing messages and the team member who sent each.</p>
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">Sent by</th>
                      <th className="pb-2 pr-3 font-medium">Mailbox</th>
                      <th className="pb-2 pr-3 font-medium">To</th>
                      <th className="pb-2 pr-3 font-medium">Subject</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((a) => (
                      <tr key={a.id} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 pr-3">
                          <span className="inline-flex items-center gap-1.5">
                            {a.automated && <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className={a.automated ? 'text-muted-foreground' : 'font-medium'}>{a.agent}</span>
                          </span>
                        </td>
                        <td className="py-1.5 pr-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.mailbox?.color || '#6366f1' }} />
                            {a.mailbox?.displayName}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate py-1.5 pr-3 text-muted-foreground">{a.to}</td>
                        <td className="max-w-[220px] truncate py-1.5 pr-3">{a.subject || '(no subject)'}</td>
                        <td className="py-1.5 pr-3"><StatusBadge status={a.status} /></td>
                        <td className="whitespace-nowrap py-1.5 text-xs text-muted-foreground">{listTime(a.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`mt-1.5 text-2xl font-semibold ${accent ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}
