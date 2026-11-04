"use client"

import React, { useEffect, useState, useRef } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { getMyTickets, TicketItem } from "@/lib/eventra-api"
import {
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  MapPin,
  QrCode,
  ShieldCheck,
  Ticket,
  XCircle,
} from "lucide-react"

function TicketCard({ ticket }: { ticket: TicketItem }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (canvasRef.current && ticket.qr_token) {
      QRCode.toCanvas(canvasRef.current, ticket.qr_token, {
        width: 180,
        margin: 2,
        color: {
          dark: "#1e293b",
          light: "#ffffff",
        },
      }).catch((err) => console.error("QR render error:", err))
    }
  }, [ticket.qr_token])

  const copyToken = () => {
    navigator.clipboard.writeText(ticket.qr_token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
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

  const isUsed = ticket.status === "USED"
  const isCancelled = ticket.status === "CANCELLED"

  return (
    <div className="relative flex flex-col md:flex-row overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm transition-all hover:shadow-md">
      {/* Ticket Details (Left) */}
      <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                ticket.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : ticket.status === "USED"
                  ? "bg-muted text-muted-foreground"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {ticket.status === "ACTIVE" ? "Valid for Entry" : ticket.status}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              #{ticket.id.slice(0, 8)}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-extrabold text-foreground sm:text-2xl">
            {ticket.event_title}
          </h3>

          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary shrink-0" />
              <span>{formatDate(ticket.start_time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary shrink-0" />
              <span>{ticket.venue}</span>
            </div>
            <div className="flex items-center gap-2">
              <Ticket className="size-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">{ticket.ticket_type_name}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border/60 pt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Issued: {new Date(ticket.issued_at).toLocaleDateString()}</span>
          {ticket.used_at && (
            <span className="text-emerald-600 font-medium">
              Admitted: {new Date(ticket.used_at).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Perforated Divider for Ticket Look */}
      <div className="relative hidden md:flex items-center">
        <div className="h-full border-r-2 border-dashed border-border" />
      </div>

      {/* QR Code Presentation (Right) */}
      <div className="border-t md:border-t-0 md:border-l border-border/60 bg-muted/20 p-6 md:p-8 flex flex-col items-center justify-center text-center">
        <div className="relative rounded-2xl bg-white p-3 shadow-sm border border-border/80">
          <canvas ref={canvasRef} className="rounded-lg" />
          {isUsed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/60 backdrop-blur-xs text-white">
              <CheckCircle2 className="size-10 text-emerald-400" />
              <span className="mt-1 text-xs font-bold uppercase tracking-wider">CHECKED IN</span>
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground max-w-[180px]">
          {isUsed
            ? "Ticket has already been verified at the door."
            : "Present this QR token at the event gate to check in."}
        </p>

        {/* Copy Token Button for test/scan usage */}
        <button
          onClick={copyToken}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <Copy className="size-3" />
          {copied ? "Token Copied!" : "Copy Token"}
        </button>
      </div>
    </div>
  )
}

export default function MyTicketsPage() {
  const { user, token } = useAuth()
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    getMyTickets(token)
      .then(setTickets)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />

      <main className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="pb-6 border-b border-border/60">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="size-3.5" />
            Verified Campus Passes
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">
            My Tickets ({tickets.length})
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All your confirmed bookings and door admission QR passes.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center">
            <Ticket className="mx-auto size-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No tickets yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You haven't reserved or booked tickets to any campus events yet.
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition-all"
            >
              Explore Campus Events
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
