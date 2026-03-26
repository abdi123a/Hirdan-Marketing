import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

const events = [
  { id: 1, title: "Client Call — TechStart", date: "2026-03-26", time: "10:00 AM", type: "Meeting" },
  { id: 2, title: "SEO Report Due", date: "2026-03-27", time: "5:00 PM", type: "Deadline" },
  { id: 3, title: "Team Standup", date: "2026-03-26", time: "9:00 AM", type: "Meeting" },
  { id: 4, title: "Social Media Review", date: "2026-03-28", time: "2:00 PM", type: "Review" },
  { id: 5, title: "Invoice Due — MediaCo", date: "2026-03-30", time: "EOD", type: "Deadline" },
  { id: 6, title: "Sprint Planning", date: "2026-03-31", time: "11:00 AM", type: "Meeting" },
  { id: 7, title: "Content Delivery — Nova", date: "2026-04-02", time: "3:00 PM", type: "Deadline" },
];

const typeColor = (t: string) =>
  t === "Meeting" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
  t === "Deadline" ? "bg-red-100 text-red-700 hover:bg-red-100" :
  "bg-amber-100 text-amber-700 hover:bg-amber-100";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [currentDate] = useState(new Date(2026, 2, 1)); // March 2026
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const today = 26;

  const getEventsForDay = (day: number) => {
    const dateStr = `2026-03-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.date === dateStr);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-1">Schedule and upcoming events</p>
        </div>
        <Button variant="hero" className="gap-2"><Plus className="h-4 w-4" /> Add Event</Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">March 2026</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px">
              {daysOfWeek.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {blanks.map((b) => (
                <div key={`blank-${b}`} className="aspect-square p-1" />
              ))}
              {days.map((day) => {
                const dayEvents = getEventsForDay(day);
                return (
                  <div
                    key={day}
                    className={`aspect-square p-1 rounded-lg border text-sm transition-colors cursor-pointer hover:bg-accent ${
                      day === today ? "bg-primary/10 border-primary" : "border-transparent"
                    }`}
                  >
                    <span className={`text-xs font-medium ${day === today ? "text-primary" : "text-foreground"}`}>{day}</span>
                    {dayEvents.length > 0 && (
                      <div className="mt-0.5">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div key={e.id} className="w-full h-1 rounded-full bg-secondary mt-0.5" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-1 h-full min-h-[40px] rounded-full bg-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{e.date} · {e.time}</p>
                    <Badge className={`mt-1.5 ${typeColor(e.type)}`}>{e.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
