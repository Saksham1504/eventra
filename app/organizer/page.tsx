"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { getOrganizerSummary, getMyEvents, OrganizerSummary, EventItem } from "@/lib/eventra-api"
import { BarChart2, Calendar, Loader2, Plus, TrendingUp } from "lucide-react"

export default function OrganizerHub() {
  const { token } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<OrganizerSummary | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    Promise.all([getOrganizerSummary(token), getMyEvents(token)])
      .then(([sum, evts]) => { setSummary(sum); setEvents(evts) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Organizer Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Overview of your events and performance.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BarChart2 className="size-5 text-primary" />
              <h2 className="text-sm font-medium">Tickets Sold</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{summary?.tickets_sold ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              <h2 className="text-sm font-medium">Revenue</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">Rs.{summary?.revenue?.toLocaleString() ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              <h2 className="text-sm font-medium">Published Events</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{summary?.events_published ?? 0}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            onClick={() => router.push("/organizer/events/new")}
            className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Create New Event
          </button>
          <button
            onClick={() => router.push("/organizer/checkin")}
            className="flex items-center gap-2 rounded-2xl bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground hover:bg-secondary/90"
          >
            <BarChart2 className="size-4" /> QR Check-In
          </button>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-foreground">Your Events</h2>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">You have not created any events yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div>
                    <p className="font-medium text-foreground">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ev.start_time).toLocaleDateString()} - {new Date(ev.end_time).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/organizer/events/${ev.id}/analytics`)}
                    className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                  >
                    Analytics
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
