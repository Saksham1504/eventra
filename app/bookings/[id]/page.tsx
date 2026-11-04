"use client"

import React, { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  BookingItem,
  cancelBooking,
  checkoutPayment,
  getBooking,
  mockConfirmPayment,
  mockFailPayment,
  PaymentItem,
} from "@/lib/eventra-api"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  XCircle,
} from "lucide-react"

export default function BookingCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const bookingId = resolvedParams.id
  const router = useRouter()
  const { user, token } = useAuth()

  const [booking, setBooking] = useState<BookingItem | null>(null)
  const [payment, setPayment] = useState<PaymentItem | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Load booking and initiate checkout
  useEffect(() => {
    if (!token) return

    getBooking(bookingId, token)
      .then(async (b) => {
        setBooking(b)
        if (b.status === "CONFIRMED") {
          setIsSuccess(true)
        } else if (b.status === "PENDING") {
          // Initialize payment session
          try {
            const p = await checkoutPayment(b.id, token)
            setPayment(p)
          } catch (err) {
            console.error("Failed to initialize payment:", err)
          }
        }
      })
      .catch((err) => {
        console.error(err)
        setErrorMsg(err.message || "Could not retrieve booking details.")
      })
      .finally(() => setLoading(false))
  }, [bookingId, token])

  // 10-Minute Hold Countdown Timer
  useEffect(() => {
    if (!booking || booking.status !== "PENDING" || !booking.expires_at) return

    const calculateRemaining = () => {
      const expiry = new Date(booking.expires_at!).getTime()
      const now = Date.now()
      const diffSeconds = Math.max(0, Math.floor((expiry - now) / 1000))
      return diffSeconds
    }

    setTimeLeft(calculateRemaining())

    const interval = setInterval(() => {
      const remaining = calculateRemaining()
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        setBooking((prev) => (prev ? { ...prev, status: "EXPIRED" } : null))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [booking])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleMockPay = async (success: boolean) => {
    if (!token || !payment) return
    setPaying(true)
    setErrorMsg(null)

    try {
      if (success) {
        const res = await mockConfirmPayment(payment.id, token)
        setBooking(res.booking)
        setIsSuccess(true)
      } else {
        await mockFailPayment(payment.id, token)
        setErrorMsg("Payment simulated failure. You can retry before the 10-minute hold expires.")
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Payment completion failed")
    } finally {
      setPaying(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!token || !booking) return
    if (!confirm("Are you sure you want to release your held tickets?")) return
    try {
      await cancelBooking(booking.id, token)
      router.push("/events")
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to cancel reservation")
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

  if (!booking) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto max-w-xl py-20 text-center">
          <AlertCircle className="mx-auto size-12 text-destructive" />
          <h2 className="mt-4 text-xl font-bold">Booking Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMsg || "Unable to locate this reservation."}</p>
          <Link href="/events" className="mt-6 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white">
            Return to Events
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />

      <main className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        {/* Success State */}
        {isSuccess ? (
          <div className="rounded-3xl border border-emerald-500/30 bg-card p-8 text-center shadow-lg">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60">
              <CheckCircle2 className="size-10" />
            </div>
            <h1 className="mt-5 text-2xl font-extrabold text-foreground sm:text-3xl">
              Booking Confirmed!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your tickets have been reserved and your unique entry QR code has been generated.
            </p>

            <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-muted/40 p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booking ID</span>
                <span className="font-mono font-semibold">{booking.id.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event</span>
                <span className="font-semibold">{booking.event_title || "Campus Event"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Passes</span>
                <span className="font-semibold">{booking.quantity}x {booking.ticket_type_name || "General"}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-bold text-foreground">
                <span>Total Paid</span>
                <span>₹{Number(booking.total_amount).toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/tickets"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
              >
                <Ticket className="size-4" />
                View My Tickets & QR
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center justify-center rounded-2xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-secondary transition-all"
              >
                Browse More Events
              </Link>
            </div>
          </div>
        ) : booking.status === "EXPIRED" ? (
          /* Expired State */
          <div className="rounded-3xl border border-destructive/30 bg-card p-8 text-center shadow-lg">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-10" />
            </div>
            <h1 className="mt-5 text-2xl font-extrabold text-foreground sm:text-3xl">
              Reservation Expired
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The 10-minute hold window for these tickets expired. The seats have been released back to other students.
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-primary/90"
            >
              Find Events & Try Again
            </Link>
          </div>
        ) : (
          /* Active 10-minute Hold & Checkout */
          <div className="space-y-6">
            {/* Hold Banner */}
            <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <Clock className="size-5 text-amber-600 animate-spin" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Tickets Held in Your Cart</h3>
                  <p className="text-xs text-muted-foreground">Seats reserved exclusively for you</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xl font-extrabold text-amber-600">
                  {timeLeft !== null ? formatCountdown(timeLeft) : "--:--"}
                </span>
                <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                  Remaining
                </span>
              </div>
            </div>

            {/* Order Card */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-bold text-foreground pb-4 border-b border-border/60">
                Order Summary
              </h2>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-bold text-foreground">{booking.event_title || "Campus Event"}</h4>
                    <span className="text-xs text-muted-foreground">
                      {booking.ticket_type_name || "General Pass"} · {booking.quantity} Ticket(s)
                    </span>
                  </div>
                  <span className="font-bold text-foreground">
                    ₹{Number(booking.total_amount).toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-border/60 pt-3 flex justify-between text-xs text-muted-foreground">
                  <span>Unit Price</span>
                  <span>₹{Number(booking.unit_price).toFixed(2)} / ticket</span>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Booking Fee & Taxes</span>
                  <span className="text-emerald-600 font-semibold">₹0.00 (Waived)</span>
                </div>

                <div className="border-t border-border/80 pt-3 flex justify-between text-base font-extrabold text-foreground">
                  <span>Total Payable</span>
                  <span>₹{Number(booking.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Options */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground pb-3 border-b border-border/60 flex items-center justify-between">
                <span>Select Payment Method</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  Sandbox Active
                </span>
              </h3>

              {errorMsg && (
                <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="mt-5 space-y-4">
                {/* Mock Pay Button */}
                <button
                  disabled={paying || (timeLeft !== null && timeLeft <= 0)}
                  onClick={() => handleMockPay(true)}
                  className="w-full flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/5 p-4 hover:bg-primary/10 transition-all text-left group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                      <CreditCard className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        Simulate Instant Payment
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Mock confirm booking and issue ticket QR immediately
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs">
                    {paying ? <Loader2 className="size-4 animate-spin" /> : "Pay ₹" + Number(booking.total_amount).toFixed(0)}
                  </div>
                </button>

                {/* Simulate Failure option for testing */}
                <button
                  disabled={paying}
                  onClick={() => handleMockPay(false)}
                  className="w-full text-center text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
                >
                  Simulate failed payment attempt (retains reservation)
                </button>
              </div>

              {/* Cancel Reservation */}
              <div className="mt-6 border-t border-border/60 pt-4 text-center">
                <button
                  onClick={handleCancelBooking}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel reservation & release seats
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
