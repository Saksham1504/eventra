"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { useAuth } from "@/lib/auth-context"
import { applyOrganizer, getMyOrganizerProfile, OrganizerProfile } from "@/lib/eventra-api"
import { AlertCircle, CheckCircle2, Clock, Loader2, Send } from "lucide-react"

export default function ApplyOrganizerPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [clubName, setClubName] = useState("")
  const [description, setDescription] = useState("")
  const [existing, setExisting] = useState<OrganizerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    getMyOrganizerProfile(token)
      .then((p) => setExisting(p))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !clubName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const profile = await applyOrganizer(clubName.trim(), description.trim(), token)
      setExisting(profile)
    } catch (err: any) {
      setError(err.message || "Failed to submit application")
    } finally {
      setSubmitting(false)
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

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Become an Organizer
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Register your student club or society to host campus events on Eventra.
        </p>

        {existing ? (
          <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <div className={`mx-auto grid size-14 place-items-center rounded-full ${
              existing.verification_status === "APPROVED"
                ? "bg-emerald-100 text-emerald-600"
                : existing.verification_status === "PENDING"
                ? "bg-amber-100 text-amber-600"
                : "bg-destructive/10 text-destructive"
            }`}>
              {existing.verification_status === "APPROVED" ? (
                <CheckCircle2 className="size-8" />
              ) : (
                <Clock className="size-8" />
              )}
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">
              {existing.verification_status === "APPROVED"
                ? "You're Approved!"
                : existing.verification_status === "PENDING"
                ? "Application Under Review"
                : "Application Rejected"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Club: <span className="font-semibold text-foreground">{existing.club_name}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Status: <span className="font-bold uppercase">{existing.verification_status}</span>
            </p>
            {existing.verification_status === "APPROVED" && (
              <button
                onClick={() => router.push("/organizer")}
                className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
              >
                Go to Organizer Dashboard
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Club / Society Name *
              </label>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                required
                placeholder="e.g. ACM Student Chapter"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What does your club do? What events do you plan to host?"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !clubName.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Submit Application
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
