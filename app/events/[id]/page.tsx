"use client"

import React, { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  createBooking,
  EventItem,
  getEvent,
  getWsBaseUrl,
  TicketTypeItem,
} from "@/lib/eventra-api"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  MapPin,
  ShieldCheck,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react"

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const eventId = resolvedParams.id
  const router = useRouter()
  const { user, token } = useAuth()

  const [event, setEvent] = useState<EventItem | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketTypeItem[]>([])
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "offline">("connecting")
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(null)

  // Fetch initial event data
  useEffect(() => {
    getEvent(eventId, token)
      .then((data) => {
        setEvent(data)
        setTicketTypes(data.ticket_types || [])
        if (data.ticket_types && data.ticket_types.length > 0) {
          setSelectedTicketTypeId(data.ticket_types[0].id)
        }
      })
      .catch((err) => {
        console.error("Failed to load event:", err)
      })
      .finally(() => setLoading(false))
  }, [eventId, token])

  // WebSocket for Live Price & Remaining Seat Updates
  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout
    let pingInterval: NodeJS.Timeout

    function connectWs() {
      try {
        const wsUrl = `${getWsBaseUrl()}/ws/events/${eventId}`
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          setWsStatus("live")
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send("ping")
            }
          }, 20000)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.ticket_types) {
              setTicketTypes(data.ticket_types)
              setLastPriceUpdate(new Date().toLocaleTimeString())
            }
          } catch (err) {
            console.error("Error processing live event update:", err)
          }
        }

        ws.onerror = () => {
          setWsStatus("offline")
        }

        ws.onclose = () => {
          setWsStatus("offline")
          clearInterval(pingInterval)
          reconnectTimer = setTimeout(connectWs, 5000)
        }
      } catch (err) {
        setWsStatus("offline")
      }
    }

    connectWs()

    return () => {
      clearInterval(pingInterval)
      clearTimeout(reconnectTimer)
      if (ws) ws.close()
    }
  }, [eventId])

  const selectedTicket = ticketTypes.find((t) => t.id === selectedTicketTypeId)
  const remainingSeats = selectedTicket
    ? selectedTicket.remaining ?? selectedTicket.capacity - selectedTicket.sold_count - selectedTicket.reserved_count
    : 0

  const handleBookNow = async () => {
    if (!token) {
      router.push("/")
      return
    }
    if (!selectedTicketTypeId) return

    setBookingLoading(true)
    setBookingError(null)

    const idempotencyKey = `bkg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    try {
      const booking = await createBooking(selectedTicketTypeId, quantity, idempotencyKey, token)
      router.push(`/bookings/${booking.id}`)
    } catch (err: any) {
      setBookingError(err.message || "Failed to reserve ticket. It may have just sold out.")
    } finally {
      setBookingLoading(false)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

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

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto max-w-xl py-20 text-center">
          <AlertCircle className="mx-auto size-12 text-destructive" />
          <h2 className="mt-4 text-xl font-bold">Event Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">The requested event could not be found or has ended.</p>
          <Link href="/events" className="mt-6 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white">
            Back to Events
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to all events
          </Link>

          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs">
            <span
              className={`size-2 rounded-full ${
                wsStatus === "live"
                  ? "bg-emerald-500 animate-pulse"
                  : wsStatus === "connecting"
                  ? "bg-amber-500 animate-ping"
                  : "bg-muted-foreground"
              }`}
            />
            <span className="font-medium text-foreground">
              {wsStatus === "live" ? "Live Demand Sync" : "Syncing..."}
            </span>
            {lastPriceUpdate && (
              <span className="text-[10px] text-muted-foreground border-l border-border pl-2">
                updated {lastPriceUpdate}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-border bg-muted shadow-sm">
              {event.banner_url ? (
                <img src={event.banner_url} alt={event.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-tr from-primary/20 via-brand-sky/20 to-brand-amber/20">
                  <Tag className="size-16 text-primary/40" />
                </div>
              )}
              {event.category && (
                <span className="absolute top-4 left-4 rounded-full bg-background/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-foreground shadow-sm">
                  {event.category}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {event.title}
              </h1>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 border-y border-border/70 py-5 text-sm">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase text-muted-foreground block">
                      Date & Time
                    </span>
                    <span className="font-medium text-foreground">{formatDate(event.start_time)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="size-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase text-muted-foreground block">
                      Venue Location
                    </span>
                    <span className="font-medium text-foreground">{event.venue}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-base font-bold text-foreground">About this Event</h3>
                <div className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {event.description || "No further details provided."}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-3xl border border-border/80 bg-card p-6 shadow-lg">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <h2 className="text-lg font-bold text-foreground">Book Passes</h2>
                <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full">
                  <Flame className="size-3.5 fill-amber-500" />
                  Dynamic
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Select Ticket Type
                </label>
                {ticketTypes.map((tt) => {
                  const isSelected = selectedTicketTypeId === tt.id
                  const available = (tt.remaining ?? tt.capacity - tt.sold_count - tt.reserved_count) > 0
                  const isPriceUp = tt.current_price > tt.base_price

                  return (
                    <div
                      key={tt.id}
                      onClick={() => available && setSelectedTicketTypeId(tt.id)}
                      className={`relative rounded-2xl border p-4 cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : available
                          ? "border-border/70 hover:border-border hover:bg-muted/40"
                          : "border-border/40 opacity-50 cursor-not-allowed bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{tt.name}</span>
                        <div className="text-right">
                          <span className="text-base font-extrabold text-foreground">
                            ₹{Number(tt.current_price).toFixed(0)}
                          </span>
                          {isPriceUp && (
                            <span className="block text-[10px] text-amber-600 font-semibold flex items-center justify-end gap-0.5">
                              <TrendingUp className="size-3" />
                              base ₹{Number(tt.base_price).toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {available
                            ? `${tt.remaining ?? tt.capacity - tt.sold_count - tt.reserved_count} seats left`
                            : "Sold Out"}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {Math.round((tt.sold_count / tt.capacity) * 100)}% booked
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.round((tt.sold_count / tt.capacity) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {selectedTicket && remainingSeats > 0 && (
                <div className="mt-5 border-t border-border/60 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Quantity (max 4)
                    </span>
                    <div className="flex items-center gap-2 border border-border rounded-xl p-1 bg-background">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          disabled={n > remainingSeats}
                          onClick={() => setQuantity(n)}
                          className={`size-7 rounded-lg text-xs font-bold transition-colors ${
                            quantity === n
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-muted/50 p-3.5 text-xs space-y-2">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Rate per ticket</span>
                      <span>₹{Number(selectedTicket.current_price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground text-sm border-t border-border/60 pt-2">
                      <span>Total Amount</span>
                      <span>₹{(Number(selectedTicket.current_price) * quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {bookingError && (
                <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{bookingError}</span>
                </div>
              )}

              <div className="mt-6">
                <button
                  disabled={bookingLoading || remainingSeats <= 0}
                  onClick={handleBookNow}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bookingLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Holding Seats...
                    </>
                  ) : remainingSeats <= 0 ? (
                    "Sold Out"
                  ) : (
                    `Reserve & Checkout (10m Hold)`
                  )}
                </button>
              </div>

              <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground justify-center">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>Seats held securely for 10 minutes upon reservation.</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
