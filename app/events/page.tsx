"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { EventItem, getCategories, listEvents } from "@/lib/eventra-api"
import { Calendar, MapPin, Search, Sparkles, Tag, TrendingUp, Users } from "lucide-react"

export default function EventsDiscoveryPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    listEvents({
      q: searchQuery || undefined,
      category: selectedCategory || undefined,
    })
      .then((data) => setEvents(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [searchQuery, selectedCategory])

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

  const getLowestPrice = (event: EventItem) => {
    if (!event.ticket_types || event.ticket_types.length === 0) return 0
    return Math.min(...event.ticket_types.map((t) => t.current_price))
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Banner */}
      <section className="relative overflow-hidden border-b border-border/60 bg-linear-to-b from-brand-sky/15 via-background to-background py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Real-time Dynamic Pricing
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Campus Events, Live & Direct
            </h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Discover hackathons, fests, workshops, and sports. Lock in tickets early before prices rise with campus demand.
            </p>
          </div>

          {/* Search & Filter bar */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events by title, venue, or keywords..."
                className="w-full rounded-xl border border-border bg-card/80 py-2.5 pl-10 pr-4 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedCategory("")}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  selectedCategory === ""
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "border border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pb-6 border-b border-border/60">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Featured Campus Experiences ({events.length})
          </h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-emerald-600" />
            Live prices update automatically
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-2xl border border-border/80 bg-muted/40"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center">
            <Calendar className="mx-auto size-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No events found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search query or category filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-6">
            {events.map((event) => {
              const lowestPrice = getLowestPrice(event)
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  {/* Banner */}
                  <div className="relative h-48 w-full overflow-hidden bg-muted">
                    {event.banner_url ? (
                      <img
                        src={event.banner_url}
                        alt={event.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/20 via-brand-sky/20 to-brand-amber/20">
                        <Tag className="size-10 text-primary/40" />
                      </div>
                    )}
                    {event.category && (
                      <span className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-xs">
                        {event.category}
                      </span>
                    )}
                    <span className="absolute top-3 right-3 rounded-full bg-emerald-500/90 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      {event.status}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-bold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {event.description || "Join fellow students for this upcoming campus gathering."}
                    </p>

                    <div className="mt-4 space-y-2 text-xs text-muted-foreground border-t border-border/60 pt-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-primary shrink-0" />
                        <span className="truncate">{formatDate(event.start_time)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-primary shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Starting at
                        </span>
                        <span className="text-base font-extrabold text-foreground">
                          ₹{lowestPrice.toFixed(0)}
                        </span>
                      </div>
                      <span className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs group-hover:bg-primary/90 transition-colors">
                        View & Book
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
