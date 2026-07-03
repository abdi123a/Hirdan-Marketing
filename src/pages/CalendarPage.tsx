import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Briefcase, FileText, Layers } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAgencyStore } from "@/lib/store";
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const typeColor = (t: string) =>
  t === "Deadline" ? "bg-red-100 text-red-700 border-red-200" :
  t === "Invoice" ? "bg-amber-100 text-amber-700 border-amber-200" :
  t === "Subscription End" ? "bg-blue-100 text-blue-700 border-blue-200" :
  "bg-primary/10 text-primary border-primary/20";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const { toast } = useToast();
  const navigate = useNavigate();
  const { projects, invoices, subscriptions, fetchProjects, fetchInvoices, fetchSubscriptions } = useAgencyStore();

  useEffect(() => {
    fetchProjects();
    fetchInvoices();
    fetchSubscriptions();
  }, [fetchProjects, fetchInvoices, fetchSubscriptions]);

  const events = useMemo(() => {
    interface CalendarEvent {
      id: string;
      title: string;
      subtitle: string;
      date: string;
      type: string;
    }
    const allEvents: CalendarEvent[] = [];
    
    projects.forEach(p => {
      if (p.dueDate && p.status !== 'Completed' && p.status !== 'Archived') {
        allEvents.push({ id: `proj-${p.id}`, title: p.name, subtitle: p.client, date: p.dueDate, type: "Deadline" });
      }
    });

    invoices.forEach(i => {
      if (i.dueDate && i.status !== 'Paid') {
        allEvents.push({ id: `inv-${i.id}`, title: `Invoice Due - ${formatCurrency(i.amount)}`, subtitle: i.client, date: i.dueDate, type: "Invoice" });
      }
    });

    subscriptions.forEach(s => {
      if (s.endDate && s.endDate !== 'N/A' && s.status === 'Active') {
        allEvents.push({ id: `sub-${s.id}`, title: `Subscription End - ${s.plan}`, subtitle: s.client, date: s.endDate, type: "Subscription End" });
      }
    });

    // sort by date
    return allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [projects, invoices, subscriptions]);

  const daysInMonth = getDaysInMonth(currentDate);
  const startDay = getDay(startOfMonth(currentDate));
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startDay }, (_, i) => i);
  
  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
  const todayDay = today.getDate();

  const getEventsForDay = (day: number) => {
    const dateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), day), 'yyyy-MM-dd');
    return events.filter((e) => e.date === dateStr);
  };

  const currentMonthEvents = useMemo(() => {
    const monthStr = format(currentDate, 'yyyy-MM');
    return events.filter(e => e.date.startsWith(monthStr));
  }, [events, currentDate]);

  const handleEventClick = (eventId: string) => {
    if (eventId.startsWith('proj-')) {
      navigate(`/dashboard/projects/view/${eventId.replace('proj-', '')}`);
    } else if (eventId.startsWith('inv-')) {
      navigate(`/dashboard/invoices/view/${eventId.replace('inv-', '')}`);
    } else if (eventId.startsWith('sub-')) {
      navigate(`/dashboard/subscriptions/view/${eventId.replace('sub-', '')}`);
    }
  };

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-1 text-sm">Schedule and upcoming events</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Event
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Create New</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/dashboard/projects/add")}>
              <Briefcase className="h-4 w-4" /> Project Deadline
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/dashboard/invoices/add")}>
              <FileText className="h-4 w-4" /> Invoice Date
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate("/dashboard/subscriptions/add")}>
              <Layers className="h-4 w-4" /> Subscription End Reminder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <Card className="border-border/50 shadow-sm h-fit">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">{format(currentDate, 'MMMM yyyy')}</CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {daysOfWeek.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {blanks.map((b) => (
                <div key={`blank-${b}`} className="min-h-[80px] p-2 bg-muted/20 rounded-md border border-transparent" />
              ))}
              {days.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isToday = isCurrentMonth && day === todayDay;
                return (
                  <div
                    key={day}
                    className={`min-h-[80px] p-2 rounded-md border transition-all duration-200 ${
                      isToday 
                        ? "bg-primary/[0.03] border-primary/30 shadow-sm" 
                        : "bg-card border-border/50 hover:border-primary/20 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 rounded-sm font-medium">{dayEvents.length}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div 
                          key={e.id} 
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate border cursor-pointer hover:brightness-95 transition-all ${typeColor(e.type)}`}
                          onClick={() => handleEventClick(e.id)}
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1 font-medium">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="font-display text-lg">Events in {format(currentDate, 'MMMM')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentMonthEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">No events scheduled.</div>
              ) : (
                currentMonthEvents.map((e) => (
                  <div 
                    key={e.id} 
                    className="flex flex-col gap-1 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => handleEventClick(e.id)}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{e.title}</p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 rounded ${typeColor(e.type)}`}>{e.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{e.subtitle}</p>
                    <p className="text-xs text-muted-foreground mt-1 bg-muted w-fit px-2 py-0.5 rounded-md">
                      {formatDate(e.date)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
