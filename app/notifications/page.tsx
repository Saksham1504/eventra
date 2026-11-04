"use client"

import React, { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  getNotifications,
  markAllNotificationsRead,
  NotificationItem,
} from "@/lib/eventra-api"
import { Bell, CheckCheck, Loader2 } from "lucide-react"

export default function NotificationsPage() {
  const { token } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifs = () => {
    if (!token) return
    getNotifications(token)
      .then(setNotifications)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchNotifs()
  }, [token])

  const handleMarkAllRead = async () => {
    if (!token) return
    await markAllNotificationsRead(token)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <div className="flex items-center justify-between pb-6 border-b border-border/60">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Booking confirmations, organizer announcements, and ticket updates.
            </p>
          </div>

          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            <CheckCheck className="size-4 text-primary" />
            Mark all read
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center">
            <Bell className="mx-auto size-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">All caught up</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You have no new notifications at the moment.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-5 rounded-2xl border transition-all ${
                  n.is_read
                    ? "border-border/60 bg-card/60 opacity-80"
                    : "border-primary/30 bg-primary/5 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    {!n.is_read && <span className="size-2 rounded-full bg-primary" />}
                    {n.title}
                  </h4>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(n.created_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {n.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
