"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR, toPaise } from "@/lib/money";
import { useRepository } from "@/lib/repository/provider";
import { CALENDAR_EVENT_TYPES, type CalendarEvent, type CalendarEventInput, type CalendarEventType } from "@/lib/wealth-types";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";

/** Expands recurring events into concrete occurrences for display. */
function occurrences(e: CalendarEvent, horizonDays: number, today: string): string[] {
  const dates: string[] = [];
  const stepDays = e.recurrence === "monthly" ? 30 : e.recurrence === "quarterly" ? 91 : 365;
  const base = new Date(`${e.eventDate}T00:00:00Z`);
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + horizonDays);
  let cursor = e.recurrence === "none" ? base : (base > end ? base : new Date(Math.max(base.getTime(), end.getTime() - stepDays * 86400000 * 3)));
  void base;
  let first = new Date(`${e.eventDate}T00:00:00Z`);
  if (e.recurrence !== "none") {
    // step forward from the event date until within horizon
    while (first.getTime() < end.getTime() && dates.length < 6) {
      if (first.toISOString().slice(0, 10) >= today) dates.push(first.toISOString().slice(0, 10));
      if (e.recurrence === "monthly") first.setUTCMonth(first.getUTCMonth() + 1);
      else if (e.recurrence === "quarterly") first.setUTCMonth(first.getUTCMonth() + 3);
      else first.setUTCFullYear(first.getUTCFullYear() + 1);
    }
  } else if (e.eventDate >= today) {
    dates.push(e.eventDate);
  }
  void stepDays; void cursor;
  return dates;
}

export default function CalendarPage() {
  const repo = useRepository();
  const [rows, setRows] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("rent");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState<CalendarEventInput["recurrence"]>("monthly");
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await repo.wealth.listCalendarEvents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load calendar");
    }
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  const upcoming = (rows ?? [])
    .flatMap((e) => occurrences(e, 60, today).map((d) => ({ event: e, date: d })))
    .sort((a, b) => a.date.localeCompare(b.date));

  async function create(e2: React.FormEvent) {
    e2.preventDefault();
    setError(null);
    try {
      const input: CalendarEventInput = {
        title: title.trim(), eventType, eventDate, recurrence,
        amountPaise: amount ? toPaise(amount) : null, notes: null,
      };
      if (!input.title) throw new Error("Give the event a title");
      await repo.wealth.createCalendarEvent(input);
      setTitle(""); setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid value");
    }
  }

  return (
    <div>
      <PageHeader
        title="Financial Calendar"
        subtitle="Salary, rent, bills, EMIs, SIPs, FD maturities and card due dates — recurring events expand automatically."
      />
      {error && <p className="mb-4 rounded-lg bg-dangersoft px-4 py-3 text-sm text-danger">{error}</p>}

      <Card className="mb-8 max-w-2xl">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="c-title">Title</Label><Input id="c-title" required placeholder="e.g. Flat rent" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label htmlFor="c-type">Type</Label><Select id="c-type" value={eventType} onChange={(e) => setEventType(e.target.value as CalendarEventType)}>{CALENDAR_EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label htmlFor="c-date">First date</Label><Input id="c-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></div>
            <div><Label htmlFor="c-rec">Repeats</Label><Select id="c-rec" value={recurrence} onChange={(e) => setRecurrence(e.target.value as CalendarEventInput["recurrence"])}><option value="none">Never</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></Select></div>
            <div><Label htmlFor="c-amt">Amount (₹, optional)</Label><Input id="c-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <Button type="submit">Add event</Button>
        </form>
      </Card>

      {rows === null ? null : upcoming.length === 0 ? (
        <EmptyState title="Nothing scheduled in the next 60 days" description="Add your recurring obligations — the calendar expands them into upcoming dates." />
      ) : (
        <ul className="space-y-2">
          {upcoming.slice(0, 30).map(({ event, date }) => (
            <li key={`${event.id}-${date}`} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <span>
                <span className="font-semibold">{event.title}</span>
                <span className="text-muted"> · {CALENDAR_EVENT_TYPES.find((t) => t.value === event.eventType)?.label}</span>
                {event.recurrence !== "none" && <Badge tone="info">{event.recurrence}</Badge>}
              </span>
              <span className="flex items-center gap-3">
                {event.amountPaise !== null && <span className="font-semibold tabular-nums">{formatINR(event.amountPaise)}</span>}
                <span className="tabular-nums text-muted">{date}</span>
                <button onClick={async () => { if (confirm(`Delete "${event.title}"?`)) { await repo.wealth.deleteCalendarEvent(event.id); await load(); } }} className="text-xs font-semibold text-danger hover:underline">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
