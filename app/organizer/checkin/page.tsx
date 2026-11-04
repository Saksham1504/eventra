"use client"

import React, { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { getMyEvents, EventItem, checkInToken } from "@/lib/eventra-api"
import { Loader2, AlertCircle, CheckCircle2, XCircle, Camera } from "lucide-react"

export default function QRCheckInPage() {
  const { token } = useAuth()
  const router = useRouter()
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'invalid'>('idle')
  const videoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    getMyEvents(token)
      .then(setEvents)
      .catch(console.error)
  }, [token])

  const startScanner = async () => {
    if (!videoRef.current) return
    setScanning(true)
    const { Html5Qrcode } = await import('html5-qrcode')
    const qr = new Html5Qrcode(videoRef.current.id)
    try {
      await qr.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (decodedText) => {
        qr.stop().then(() => setScanning(false))
        handleScanned(decodedText)
      })
    } catch (e) {
      console.error(e)
      setScanning(false)
    }
  }

  const handleScanned = async (tokenStr: string) => {
    if (!token) return
    setResult(tokenStr)
    try {
      const res = await checkInToken(selectedEventId, tokenStr, token)
      if (res.result === 'ADMITTED') {
        setStatus('success')
      } else if (res.result === 'ALREADY_USED') {
        setStatus('error')
      } else {
        setStatus('invalid')
      }
    } catch (e) {
      setStatus('invalid')
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Please sign in to use the scanner.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">QR Check‑In</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an event and scan attendee QR codes.</p>

        <div className="mt-6">
          <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Event *</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="" disabled>Select event</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>

        {selectedEventId && (
          <div className="mt-6">
            {scanning ? (
              <div id="qr-scanner" ref={videoRef} className="w-full h-64" />
            ) : (
              <button
                onClick={startScanner}
                className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Camera className="size-4" /> Start Scan
              </button>
            )}
          </div>
        )}

        {status !== 'idle' && (
          <div className="mt-4 rounded-xl p-4 text-sm flex items-center gap-2 "
            style={{
              backgroundColor: status === 'success' ? 'rgba(16,185,129,0.1)' : status === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
              color: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#eab308'
            }}
          >
            {status === 'success' ? <CheckCircle2 className="size-5" /> : status === 'error' ? <XCircle className="size-5" /> : <AlertCircle className="size-5" />}
            <span>{status === 'success' ? 'Check‑in successful' : status === 'error' ? 'Ticket already used' : 'Invalid or unknown token'}</span>
          </div>
        )}
      </main>
    </div>
  )
}
