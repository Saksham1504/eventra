"use client"

import React, { useEffect, useState, useRef } from "react"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { getMyEvents, EventItem, checkInTicket } from "@/lib/eventra-api"
import { AlertCircle, Camera, CheckCircle2, XCircle } from "lucide-react"

export default function QRCheckInPage() {
  const { token } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error" | "invalid">("idle")
  const [statusMsg, setStatusMsg] = useState("")
  const [manualToken, setManualToken] = useState("")
  const scannerDivId = "qr-scanner-div"

  useEffect(() => {
    if (!token) return
    getMyEvents(token).then(setEvents).catch(console.error)
  }, [token])

  const handleScanned = async (tokenStr: string) => {
    if (!token || !selectedEventId) return
    setManualToken(tokenStr)
    try {
      const res = await checkInTicket(selectedEventId, tokenStr, "Main Gate", token)
      if (res.result === "ADMITTED") {
        setStatus("success")
        setStatusMsg(`Admitted: ${res.attendee_name ?? "Attendee"} — ${res.ticket_type ?? ""}`)
      } else if (res.result === "ALREADY_USED") {
        setStatus("error")
        setStatusMsg(`Already used at ${res.used_at ? new Date(res.used_at).toLocaleTimeString() : "earlier"}`)
      } else {
        setStatus("invalid")
        setStatusMsg(res.message)
      }
    } catch (e: any) {
      setStatus("invalid")
      setStatusMsg(e.message ?? "Check-in failed")
    }
  }

  const startScanner = async () => {
    if (!selectedEventId) return
    setScanning(true)
    setStatus("idle")
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const qr = new Html5Qrcode(scannerDivId)
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decoded) => {
          await qr.stop()
          setScanning(false)
          await handleScanned(decoded)
        },
        () => {}
      )
    } catch (e) {
      console.error(e)
      setScanning(false)
    }
  }

  const statusColors = {
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    error: "bg-red-500/10 text-red-600 border-red-200",
    invalid: "bg-amber-500/10 text-amber-600 border-amber-200",
    idle: "",
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">QR Check-In</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an event and scan attendee QR codes.</p>

        <div className="mt-6">
          <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => { setSelectedEventId(e.target.value); setStatus("idle") }}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
          >
            <option value="" disabled>Select an event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>

        {selectedEventId && (
          <div className="mt-6 space-y-4">
            {/* Camera scanner */}
            <div id={scannerDivId} className={scanning ? "w-full rounded-xl overflow-hidden" : "hidden"} />

            {!scanning && (
              <button
                onClick={startScanner}
                className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Camera className="size-4" /> Start Camera Scan
              </button>
            )}

            {/* Manual token input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Or paste QR token manually..."
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
              />
              <button
                onClick={() => handleScanned(manualToken)}
                disabled={!manualToken.trim()}
                className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                Check In
              </button>
            </div>
          </div>
        )}

        {status !== "idle" && (
          <div className={`mt-6 flex items-start gap-3 rounded-xl border p-4 ${statusColors[status]}`}>
            {status === "success" ? (
              <CheckCircle2 className="size-5 mt-0.5 shrink-0" />
            ) : status === "error" ? (
              <XCircle className="size-5 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="size-5 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {status === "success" ? "Check-in Successful!" : status === "error" ? "Already Used" : "Invalid Ticket"}
              </p>
              <p className="text-sm mt-0.5">{statusMsg}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
