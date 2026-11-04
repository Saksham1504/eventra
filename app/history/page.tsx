"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { BookingItem, getMyBookings } from "@/lib/eventra-api"
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Loader2,
  XCircle,
} from "lucide-react"

export default function BookingHistoryPage() {
  const { user, token } = useAuth()
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("")

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getMyBookings(token, statusFilter || undefined)
      .then(setBookings)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [token, statusFilter])

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />

      <main className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border/60">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Booking History
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review all past reservations, orders, and payment statuses.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {["", "CONFIRMED", "PENDING", "CANCELLED", "EXPIRED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === st
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                {st === "" ? "All" : st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-20 text-center">
            <History className="mx-auto size-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No bookings found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No orders matched your active filter.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
            <div className="divide-y divide-border/60">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          booking.status === "CONFIRMED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : booking.status === "PENDING"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {booking.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(booking.created_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <h4 className="mt-2 text-base font-bold text-foreground">
                      {booking.event_title || "Campus Event"}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {booking.ticket_type_name || "General Pass"} · {booking.quantity} Ticket(s)
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5">
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-foreground block">
                        ₹{Number(booking.total_amount).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ₹{Number(booking.unit_price).toFixed(2)}/each
                      </span>
                    </div>

                    {booking.status === "CONFIRMED" ? (
                      <Link
                        href="/tickets"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                      >
                        Tickets
                        <ExternalLink className="size-3" />
                      </Link>
                    ) : booking.status === "PENDING" ? (
                      <Link
                        href={`/bookings/${booking.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
                      >
                        Pay Now
                        <ExternalLink className="size-3" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
