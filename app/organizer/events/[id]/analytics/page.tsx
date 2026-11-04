"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { getEventAnalytics, EventAnalytics } from "@/lib/eventra-api"
import { BarChart2, Loader2, TrendingUp, Users } from "lucide-react"

export default function EventAnalyticsPage() {
  const { token } = useAuth()
  const params = useParams()
  const eventId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string)
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

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
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{analytics.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Event Analytics</p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BarChart2 className="size-5 text-primary" />
              <h2 className="text-sm font-medium">Tickets Sold</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{analytics.totals.tickets_sold}</p>
            <p className="text-xs text-muted-foreground">of {analytics.totals.capacity} capacity</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              <h2 className="text-sm font-medium">Revenue</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">Rs.{analytics.totals.revenue?.toLocaleString() ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <h2 className="text-sm font-medium">Checked In</h2>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{analytics.totals.checked_in}</p>
            <p className="text-xs text-muted-foreground">{analytics.totals.attendance_rate_percent}% attendance</p>
          </div>
        </div>

        {/* Ticket type breakdown */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-foreground">Ticket Type Breakdown</h2>
          <div className="mt-4 space-y-3">
            {analytics.ticket_types.map((tt) => {
              const pct = tt.capacity > 0 ? Math.round((tt.sold / tt.capacity) * 100) : 0
              return (
                <div key={tt.ticket_type_id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{tt.name}</span>
                    <span className="text-sm text-muted-foreground">{tt.sold} / {tt.capacity} sold</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Current price: Rs.{tt.current_price}</span>
                    <span>Revenue: Rs.{tt.revenue?.toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Sales by day */}
        {analytics.sales_by_day?.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-foreground">Sales by Day</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Tickets</th>
                    <th className="px-4 py-3 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.sales_by_day.map((day) => (
                    <tr key={day.date} className="border-t border-border">
                      <td className="px-4 py-2">{day.date}</td>
                      <td className="px-4 py-2">{day.tickets}</td>
                      <td className="px-4 py-2">Rs.{day.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
