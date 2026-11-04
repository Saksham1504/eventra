"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getUnreadNotificationCount } from "@/lib/eventra-api"
import {
  Bell,
  Calendar,
  CheckSquare,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  QrCode,
  Shield,
  Ticket,
  TicketCheck,
  User,
} from "lucide-react"

export function Navigation() {
  const pathname = usePathname()
  const { user, token, logout, setDevUser } = useAuth()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [showRoleMenu, setShowRoleMenu] = useState(false)

  useEffect(() => {
    if (!token) return
    let isMounted = true
    getUnreadNotificationCount(token)
      .then((c) => {
        if (isMounted) setUnreadCount(c)
      })
      .catch(() => {})
    const interval = setInterval(() => {
      getUnreadNotificationCount(token)
        .then((c) => {
          if (isMounted) setUnreadCount(c)
        })
        .catch(() => {})
    }, 15000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [token])

  const isLinkActive = (path: string) => {
    if (path === "/events" && (pathname === "/" || pathname === "/events")) return true
    return pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/events" className="flex items-center gap-2.5 group">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <TicketCheck className="size-5" />
            </span>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-foreground">eventra</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground -mt-1">
                Campus Events
              </span>
            </div>
          </Link>

          {/* Primary Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/events"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isLinkActive("/events")
                  ? "bg-secondary text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Calendar className="size-4" />
              Explore
            </Link>

            {user && (
              <>
                <Link
                  href="/tickets"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isLinkActive("/tickets")
                      ? "bg-secondary text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Ticket className="size-4" />
                  My Tickets
                </Link>

                <Link
                  href="/history"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isLinkActive("/history")
                      ? "bg-secondary text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <CheckSquare className="size-4" />
                  Bookings
                </Link>

                {(user.role === "ORGANIZER" || user.role === "ADMIN") && (
                  <>
                    <Link
                      href="/organizer"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        pathname.startsWith("/organizer") && !pathname.includes("checkin")
                          ? "bg-secondary text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <LayoutDashboard className="size-4" />
                      Organizer
                    </Link>

                    <Link
                      href="/organizer/checkin"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        pathname === "/organizer/checkin"
                          ? "bg-secondary text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <QrCode className="size-4 text-emerald-600" />
                      QR Scanner
                    </Link>
                  </>
                )}

                {user.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      isLinkActive("/admin")
                        ? "bg-secondary text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Shield className="size-4 text-amber-600" />
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>

        {/* Right Nav: Notifications & Profile / Dev Role Switcher */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Notifications */}
              <Link
                href="/notifications"
                className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Notifications"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              {/* Dev Switcher & Role pill */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/70 transition-all shadow-xs"
                >
                  <span
                    className={`size-2 rounded-full ${
                      user.role === "ADMIN"
                        ? "bg-amber-500"
                        : user.role === "ORGANIZER"
                        ? "bg-emerald-500"
                        : "bg-blue-500"
                    }`}
                  />
                  <span className="font-semibold">{user.name.split(" ")[0]}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-bold text-muted-foreground">
                    {user.role}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </button>

                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-xl z-50 text-popover-foreground">
                    <div className="px-3 py-2 border-b border-border/60">
                      <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>

                    <div className="py-1">
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Demo Role Switcher
                      </p>
                      <button
                        onClick={() => {
                          setDevUser("student1")
                          setShowRoleMenu(false)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center justify-between hover:bg-secondary transition-colors ${
                          user.role === "STUDENT" ? "font-semibold text-primary bg-secondary/40" : ""
                        }`}
                      >
                        <span>Student (Student 1)</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 px-1 rounded">STUDENT</span>
                      </button>
                      <button
                        onClick={() => {
                          setDevUser("tech")
                          setShowRoleMenu(false)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center justify-between hover:bg-secondary transition-colors ${
                          user.role === "ORGANIZER" ? "font-semibold text-primary bg-secondary/40" : ""
                        }`}
                      >
                        <span>Organizer (ACM Chapter)</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 px-1 rounded">ORGANIZER</span>
                      </button>
                      <button
                        onClick={() => {
                          setDevUser("admin")
                          setShowRoleMenu(false)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center justify-between hover:bg-secondary transition-colors ${
                          user.role === "ADMIN" ? "font-semibold text-primary bg-secondary/40" : ""
                        }`}
                      >
                        <span>Campus Admin</span>
                        <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 px-1 rounded">ADMIN</span>
                      </button>
                    </div>

                    <div className="border-t border-border/60 pt-1 mt-1">
                      {user.role === "STUDENT" && (
                        <Link
                          href="/organizer/apply"
                          onClick={() => setShowRoleMenu(false)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
                        >
                          <LayoutDashboard className="size-3.5" />
                          Apply as Organizer
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          logout()
                          setShowRoleMenu(false)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <LogOut className="size-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
