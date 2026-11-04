"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { getEventAnalytics, EventAnalytics } from "@/lib/eventra-api"
import { Loader2, BarChart2, LineChart, TrendingUp } from "lucide-react"

export default function EventAnalyticsPage() {
  const { token } = useAuth()
  const router = useRouter()
  const params = useParams()
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const eventId = typeof params === 'object' && params.id ? (params.id as string) : ''

  useEffect(() => {
    if (!token || !eventId) return
    getEventAnalytics(eventId, token)
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token, eventId])

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

  if (!analytics) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Failed to load analytics.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Event Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">Performance insights for this event.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BarChart2 className="size-5 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Tickets Sold</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{analytics.total_tickets_sold}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Revenue</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">₹{analytics.revenue?.toLocaleString() ?? 0}</p>
          </div>
        </div>

        {/* Additional charts could be added here using a chart library */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Ticket Type Breakdown</h2>
          <ul className="mt-3 space-y-2">
            {analytics.ticket_type_stats.map((tt) => (
              <li key={tt.title} className="flex justify-between text-sm text-foreground">
                <span>{tt.title}</span>
                <span>{tt.sold} / {tt.capacity} sold</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
