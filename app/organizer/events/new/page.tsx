"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { createEvent, addTicketType, publishEvent, EventCreatePayload, TicketTypeCreatePayload } from "@/lib/eventra-api"
import { Loader2, Send, Calendar, Image, Tag, CalendarClock, Plus } from "lucide-react"

export default function NewEventPage() {
  const { token } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event fields
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [venue, setVenue] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [description, setDescription] = useState("")

  // Ticket types array
  const [ticketTypes, setTicketTypes] = useState<TicketTypeCreatePayload[]>([])
  const [ttTitle, setTtTitle] = useState("")
  const [ttBasePrice, setTtBasePrice] = useState(0)
  const [ttCapacity, setTtCapacity] = useState(0)

  const resetForm = () => {
    setTitle("")
    setCategory("")
    setVenue("")
    setBannerUrl("")
    setStartTime("")
    setEndTime("")
    setDescription("")
    setTicketTypes([])
    setTtTitle("")
    setTtBasePrice(0)
    setTtCapacity(0)
  }

  const handleAddTicketType = () => {
    if (!ttTitle.trim() || ttBasePrice <= 0 || ttCapacity <= 0) return
    setTicketTypes([...ticketTypes, { title: ttTitle.trim(), base_price: ttBasePrice, capacity: ttCapacity }])
    setTtTitle("")
    setTtBasePrice(0)
    setTtCapacity(0)
  }

  const handleSubmit = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const eventPayload: EventCreatePayload = {
        title,
        category,
        venue,
        banner_url: bannerUrl,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        description,
      }
      const event = await createEvent(eventPayload, token)
      // add ticket types
      for (const tt of ticketTypes) {
        await addTicketType(event.id, tt, token)
      }
      // publish
      await publishEvent(event.id, token)
      resetForm()
      router.push('/organizer')
    } catch (err: any) {
      setError(err.message || 'Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Please sign in to create an event.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Create New Event</h1>
        <p className="mt-2 text-sm text-muted-foreground">Fill in the details and add ticket types.</p>

        {error && (
          <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
            {error}
          </div>
        )}

        {/* Event Details Form */}
        <section className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Category *</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              placeholder="e.g. Tech, Cultural, Sports"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Venue *</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Banner URL (optional)</label>
            <input
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://example.com/banner.jpg"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Start Time *</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">End Time *</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </section>

        {/* Ticket Types Section */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Ticket Types</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add one or more ticket categories for this event.</p>
          <div className="mt-4 flex flex-col gap-3">
            {ticketTypes.map((tt, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div>
                  <p className="font-medium text-foreground">{tt.title}</p>
                  <p className="text-xs text-muted-foreground">₹{tt.base_price} • {tt.capacity} seats</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Ticket title"
              value={ttTitle}
              onChange={(e) => setTtTitle(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="number"
              placeholder="Base price"
              value={ttBasePrice || ''}
              onChange={(e) => setTtBasePrice(parseInt(e.target.value) || 0)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="number"
              placeholder="Capacity"
              value={ttCapacity || ''}
              onChange={(e) => setTtCapacity(parseInt(e.target.value) || 0)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={handleAddTicketType}
              className="mt-2 sm:mt-0 col-span-3 flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Add Ticket Type
            </button>
          </div>
        </section>

        {/* Submit */}
        <div className="mt-10 flex justify-end">
          <button
            disabled={loading || !title || !category || !venue || !startTime || !endTime || ticketTypes.length === 0}
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Create Event
          </button>
        </div>
      </main>
    </div>
  )
}
