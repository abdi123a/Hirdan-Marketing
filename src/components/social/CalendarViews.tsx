import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getStatusStyle, formatPostStatus } from "@/lib/social/post-status";
import { WEEK_VIEW_SLOTS, type SocialPost } from "@/lib/social/types";
import { getWeekDays } from "@/pages/SocialPublishPage";

interface CalendarViewsProps {
  calendarView: "month" | "week" | "agenda";
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  calendarCells: (Date | null)[][];
  filteredPosts: SocialPost[];
  activePostId: string | null;
  setActivePostId: (id: string | null) => void;
  resetComposer: () => void;
  setComposerScheduledFor: (value: string) => void;
  setPublishNow: (value: boolean) => void;
  setIsComposerOpen: (open: boolean) => void;
  handleReschedulePost: (postId: string, date: Date) => void | Promise<void>;
  handleReschedulePostWithTime: (postId: string, date: Date, timeStr: string) => void | Promise<void>;
  getClientDetails: (clientId: string) => { name: string; company: string };
  getPlatformIcon: (platform?: string, className?: string) => React.ReactNode;
}

export default function CalendarViews({
  calendarView,
  calendarDate,
  setCalendarDate,
  calendarCells,
  filteredPosts,
  activePostId,
  setActivePostId,
  resetComposer,
  setComposerScheduledFor,
  setPublishNow,
  setIsComposerOpen,
  handleReschedulePost,
  handleReschedulePostWithTime,
  getClientDetails,
  getPlatformIcon,
}: CalendarViewsProps) {
  const openQuickAddAt = (date: Date, hours: number, minutes: number) => {
    resetComposer();
    const ld = new Date(date);
    ld.setHours(hours, minutes);
    const lDate = new Date(ld.getTime() - ld.getTimezoneOffset() * 60000);
    setComposerScheduledFor(lDate.toISOString().slice(0, 16));
    setPublishNow(false);
    setIsComposerOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-base text-foreground capitalize">
            {calendarView === "month" && calendarDate.toLocaleString("default", { month: "long", year: "numeric" })}
            {calendarView === "week" && `Week of ${getWeekDays(calendarDate)[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
            {calendarView === "agenda" && "Post Agenda"}
          </h3>
          <div className="flex border border-border/50 rounded-lg p-0.5 bg-muted/20">
            <Button variant="ghost" size="icon" onClick={() => {
              if (calendarView === "month") setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
              else if (calendarView === "week") { const d = new Date(calendarDate); d.setDate(d.getDate() - 7); setCalendarDate(d); }
              else { const d = new Date(calendarDate); d.setDate(d.getDate() - 30); setCalendarDate(d); }
            }} className="h-7 w-7 rounded-md">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCalendarDate(new Date())} className="h-7 text-[11px] font-bold px-2 rounded-md">Today</Button>
            <Button variant="ghost" size="icon" onClick={() => {
              if (calendarView === "month") setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
              else if (calendarView === "week") { const d = new Date(calendarDate); d.setDate(d.getDate() + 7); setCalendarDate(d); }
              else { const d = new Date(calendarDate); d.setDate(d.getDate() + 30); setCalendarDate(d); }
            }} className="h-7 w-7 rounded-md">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {/* Status Legend */}
        <div className="hidden md:flex items-center gap-2 text-[9px] font-bold text-muted-foreground">
          {(["DRAFT", "AWAITING_APPROVAL", "SCHEDULED", "PUBLISHED"] as const).map(s => {
            const ss = getStatusStyle(s);
            return (
              <span key={s} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${ss.text} ${ss.bg} ${ss.border}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                {s.replace(/_/g, " ")}
              </span>
            );
          })}
        </div>
      </div>

      {/* Month View */}
      {calendarView === "month" && (
        <Card className="border border-border/60 shadow-sm bg-card rounded-xl overflow-hidden p-0">
          <div className="grid grid-cols-7 bg-muted/10 text-center py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 border-l border-border/20 divide-x divide-y divide-border/20">
            {calendarCells.map((week, wI) =>
              week.map((cellDate, dI) => {
                if (!cellDate) return <div key={`e-${wI}-${dI}`} className="min-h-32 bg-muted/10" />;
                // filteredPosts (not raw posts) so the shared filter bar
                // (client/platform/status/campaign/type/search/date) applies
                // here the same way it does in the Posts and Agenda views.
                const postsForDay = filteredPosts.filter(p => {
                  if (!p.scheduledFor) return false;
                  const d = new Date(p.scheduledFor);
                  return d.getDate() === cellDate.getDate() && d.getMonth() === cellDate.getMonth() && d.getFullYear() === cellDate.getFullYear();
                });
                const uniqueClients = new Set(postsForDay.map(p => p.clientId)).size;
                const isToday = cellDate.toDateString() === new Date().toDateString();
                const shown = postsForDay.slice(0, 3);
                const overflow = Math.max(0, postsForDay.length - 3);
                return (
                  <div
                    key={cellDate.toISOString()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const pid = e.dataTransfer.getData("postId"); if (pid) handleReschedulePost(pid, cellDate); }}
                    className={`group min-h-32 p-2 flex flex-col hover:bg-muted/10 transition-all cursor-default relative ${isToday ? "bg-primary/5 ring-inset ring-1 ring-primary/20" : "bg-card"}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[11px] font-bold select-none ${isToday ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] leading-none" : "text-muted-foreground/70"}`}>
                        {cellDate.getDate()}
                      </span>
                      <button
                        onClick={() => openQuickAddAt(cellDate, 10, 0)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10 rounded p-0.5 cursor-pointer shrink-0"
                        title="Quick add"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {shown.map(p => {
                        const client = getClientDetails(p.clientId);
                        const timeStr = p.scheduledFor ? new Date(p.scheduledFor).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
                        const ss = getStatusStyle(p.status);
                        const dashed = p.status === "DRAFT" ? "border-dashed" : "border-solid";
                        return (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={e => e.dataTransfer.setData("postId", p.id)}
                            onClick={e => { e.stopPropagation(); setActivePostId(p.id); }}
                            className={`text-[9px] font-semibold px-1.5 py-1 rounded border flex items-center gap-1 cursor-grab hover:shadow-sm active:cursor-grabbing truncate ${ss.text} ${ss.bg} ${ss.border} ${dashed} ${activePostId === p.id ? "ring-1 ring-primary/40" : ""}`}
                            title={`${client.company}: ${p.caption}`}
                          >
                            <span className="text-[8px] font-black opacity-50 shrink-0 tabular-nums">{timeStr}</span>
                            <span className="truncate flex-1">{client.company || client.name}</span>
                            <div className="flex gap-0.5 shrink-0 ml-0.5">
                              {p.destinations.slice(0, 2).map(d => <span key={d.id}>{getPlatformIcon(d.platform, "h-2 w-2")}</span>)}
                            </div>
                          </div>
                        );
                      })}
                      {overflow > 0 && (
                        <div className="text-[8px] font-bold text-muted-foreground/60 text-center pt-0.5 hover:text-primary transition-colors cursor-pointer select-none">
                          +{overflow} more
                        </div>
                      )}
                    </div>
                    {postsForDay.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-border/20 flex justify-between text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wide select-none">
                        <span>{postsForDay.length} post{postsForDay.length !== 1 ? "s" : ""}</span>
                        <span>{uniqueClients} client{uniqueClients !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {/* Week View */}
      {calendarView === "week" && (
        <Card className="border border-border/60 shadow-sm bg-card rounded-xl overflow-hidden p-0">
          <div className="grid grid-cols-8 divide-x divide-border/30">
            <div className="flex flex-col divide-y divide-border/20 bg-muted/10 text-muted-foreground text-[10px] font-bold text-center select-none pt-[42px]">
              {WEEK_VIEW_SLOTS.map(h => (
                <div key={h} className="h-24 flex items-center justify-center">{h}</div>
              ))}
            </div>
            {getWeekDays(calendarDate).map(dayDate => {
              const isToday = dayDate.toDateString() === new Date().toDateString();
              return (
                <div key={dayDate.toISOString()} className="flex flex-col divide-y divide-border/20">
                  <div className={`p-2 text-center border-b border-border/30 text-xs font-bold ${isToday ? "bg-primary text-primary-foreground" : "bg-muted/5 text-muted-foreground"}`}>
                    <div>{dayDate.toLocaleDateString(undefined, { weekday: "short" })}</div>
                    <div className="text-[10px] font-semibold mt-0.5">{dayDate.getDate()}</div>
                  </div>
                  {WEEK_VIEW_SLOTS.map(hourStr => {
                    const postsInSlot = filteredPosts.filter(p => {
                      if (!p.scheduledFor) return false;
                      const d = new Date(p.scheduledFor);
                      const matchDate = d.getDate() === dayDate.getDate() && d.getMonth() === dayDate.getMonth() && d.getFullYear() === dayDate.getFullYear();
                      if (!matchDate) return false;
                      const hr = d.getHours();
                      const slotHr = parseInt(hourStr.split(":")[0]);
                      return hr >= slotHr && hr < slotHr + 2;
                    });
                    return (
                      <div
                        key={hourStr}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const pid = e.dataTransfer.getData("postId"); if (pid) handleReschedulePostWithTime(pid, dayDate, hourStr); }}
                        className="h-24 p-1 bg-card hover:bg-muted/5 relative group flex flex-col gap-1 overflow-y-auto select-none"
                      >
                        <button
                          onClick={() => {
                            const [hrs] = hourStr.split(":").map(Number);
                            openQuickAddAt(dayDate, hrs, 0);
                          }}
                          className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10 rounded p-0.5 cursor-pointer z-10"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                        {postsInSlot.map(p => {
                          const client = getClientDetails(p.clientId);
                          const ss = getStatusStyle(p.status);
                          return (
                            <div key={p.id} draggable onDragStart={e => e.dataTransfer.setData("postId", p.id)} onClick={() => setActivePostId(p.id)}
                              className={`text-[8px] font-bold p-1 border rounded truncate cursor-grab active:cursor-grabbing ${ss.text} ${ss.bg} ${ss.border} ${activePostId === p.id ? "ring-1 ring-primary/40" : ""}`}>
                              {client.company || client.name}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Agenda View */}
      {calendarView === "agenda" && (
        <Card className="border border-border/60 shadow-sm bg-card rounded-xl p-5">
          {filteredPosts.filter(p => p.scheduledFor).length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground italic">No scheduled posts in agenda.</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(
                filteredPosts.filter(p => p.scheduledFor).reduce((acc, p) => {
                  const key = new Date(p.scheduledFor!).toDateString();
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(p);
                  return acc;
                }, {} as Record<string, SocialPost[]>)
              ).map(([dateStr, postsList]) => (
                <div key={dateStr}>
                  <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider border-b border-border/30 pb-2 mb-3 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {dateStr}
                    <span className="ml-auto text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold">{postsList.length} posts</span>
                  </h4>
                  <div className="space-y-2">
                    {postsList.map(p => {
                      const client = getClientDetails(p.clientId);
                      const time = new Date(p.scheduledFor!).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                      const ss = getStatusStyle(p.status);
                      return (
                        <div key={p.id} onClick={() => setActivePostId(p.id)}
                          className={`p-3 bg-muted/10 border rounded-xl flex items-center justify-between cursor-pointer transition-colors hover:border-primary/30 ${activePostId === p.id ? "border-primary/50 bg-primary/5" : "border-border/40"}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground bg-muted border px-2.5 py-1 rounded-lg shrink-0 tabular-nums">{time}</span>
                            <div>
                              <div className="font-bold text-xs text-foreground">{client.company || client.name}</div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{p.caption}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex gap-1">
                              {p.destinations.map(d => <span key={d.id}>{getPlatformIcon(d.platform, "h-3.5 w-3.5")}</span>)}
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-full ${ss.text} ${ss.bg} ${ss.border}`}>
                              {formatPostStatus(p.status)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
