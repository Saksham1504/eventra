"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { createEvent, createTicketType, publishEvent } from "@/lib/eventra-api"
import { Loader2, Plus, Send } from "lucide-react"

interface TicketTypeInput { name: string; base_price: number; capacity: number }

export default function NewEventPage() {
  const { token } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [venue, setVenue] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [description, setDescription] = useState("")

  const [ticketTypes, setTicketTypes] = useState<TicketTypeInput[]>([])
  const [ttName, setTtName] = useState("")
  const [ttBasePrice, setTtBasePrice] = useState("")
  const [ttCapacity, setTtCapacity] = useState("")

  const addTicketType = () => {
    if (!ttName.trim() || !ttBasePrice || !ttCapacity) return
    setTicketTypes([...ticketTypes, {
      name: ttName.trim(),
      base_price: parseFloat(ttBasePrice),
      capacity: parseInt(ttCapacity),
    }])
    setTtName(""); setTtBasePrice(""); setTtCapacity("")
  }

  const handleSubmit = async () => {
    if (!token) return
    setLoading(true); setError(null)
    try {
      const event = await createEvent({
        title, category, venue,
        banner_url: bannerUrl || undefined,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        description,
      }, token)
      for (const tt of ticketTypes) {
        await createTicketType(event.id, tt, token)
      }
      await publishEvent(event.id, token)
      router.push("/organizer")
    } catch (err: any) {
      setError(err.message || "Failed to create event")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Create New Event</h1>
        <p className="mt-2 text-sm text-muted-foreground">Fill in the details and add ticket types.</p>

        {error && (
          <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <section className="mt-6 space-y-4">
          {[
            { label: "Title *", value: title, set: setTitle, placeholder: "e.g. HackPulse 2027" },
            { label: "Category *", value: category, set: setCategory, placeholder: "Tech, Cultural, Sports..." },
            { label: "Venue *", value: venue, set: setVenue, placeholder: "Main Auditorium, DTU" },
            { label: "Banner URL", value: bannerUrl, set: setBannerUrl, placeholder: "https://..." },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">{label}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Start Time *</label>
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">End Time *</label>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Description</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm resize-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </section>

        {/* Ticket Types */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Ticket Types</h2>
          {ticketTypes.length > 0 && (
            <ul className="mt-3 space-y-2">
              {ticketTypes.map((tt, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                  <span className="font-medium">{tt.name}</span>
                  <span className="text-sm text-muted-foreground">Rs.{tt.base_price} &bull; {tt.capacity} seats</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <input type="text" placeholder="Name (e.g. General)" value={ttName}
              onChange={(e) => setTtName(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <input type="number" placeholder="Base price" value={ttBasePrice}
              onChange={(e) => setTtBasePrice(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <input type="number" placeholder="Capacity" value={ttCapacity}
              onChange={(e) => setTtCapacity(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <button onClick={addTicketType}
            className="mt-3 flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground hover:bg-secondary/80">
            <Plus className="size-4" /> Add Ticket Type
          </button>
        </section>

        <div className="mt-10 flex justify-end">
          <button
            disabled={loading || !title || !category || !venue || !startTime || !endTime || ticketTypes.length === 0}
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Create & Publish Event
          </button>
        </div>
      </main>
    </div>
  )
}
