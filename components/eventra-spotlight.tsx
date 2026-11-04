import Image from 'next/image'
import { BarChart3, QrCode, Sparkles, TicketCheck } from 'lucide-react'

export function EventraSpotlight() {
  return (
    <aside
      id="eventra-spotlight"
      aria-label="Eventra ticketing features"
      className="group relative isolate min-h-[570px] w-full overflow-hidden rounded-[2rem] bg-slate-950 shadow-[0_32px_90px_-46px_rgba(18,28,48,0.65)] sm:min-h-[620px] lg:min-h-[680px]"
    >
      <Image
        src="/eventra-campus-night.png"
        alt="Students gathering for a live music event on a campus lawn at dusk."
        fill
        priority
        sizes="(min-width: 1024px) 56vw, 100vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#111a2b]/50 via-[#101a2c]/10 to-[#0c1422]/90"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(145deg,rgba(71,116,200,0.14),transparent_44%,rgba(247,168,103,0.14))]"
      />

      <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-3 sm:inset-x-7 sm:top-7">
        <span className="rounded-full border border-white/20 bg-slate-950/30 px-3 py-2 text-[10px] font-semibold tracking-[0.18em] text-white/90 backdrop-blur-md">
          EVENTRA / CAMPUS NIGHTS
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/30 px-3 py-2 text-[10px] font-medium text-white/90 backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-brand-mint" aria-hidden="true" />
          Real-time availability
        </span>
      </div>

      <article className="absolute inset-x-4 bottom-4 rounded-[1.6rem] border border-white/15 bg-[#0b1423]/80 p-5 text-white shadow-2xl backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-7 lg:inset-x-7 lg:bottom-7">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-sky">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Made for your campus
        </div>
        <h2 className="mt-4 max-w-[16ch] text-[2rem] leading-[1.03] font-semibold tracking-[-0.05em] sm:text-[2.55rem]">
          A little more Eventra. A lot more campus.
        </h2>
        <p className="mt-2 max-w-[48ch] text-sm leading-6 text-white/70">
          Find your people, book in a few taps, and spend less time in line.
        </p>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/7 p-3.5 sm:p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-amber text-foreground">
            <TicketCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Demand-based pricing</p>
            <p className="mt-1 text-xs leading-5 text-white/65">
              Ticket prices rise 25% at every 20% capacity milestone.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/7 px-3 py-2 text-[11px] font-medium text-white/85">
            <QrCode className="size-3.5" aria-hidden="true" />
            Unique QR tickets
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/7 px-3 py-2 text-[11px] font-medium text-white/85">
            <BarChart3 className="size-3.5" aria-hidden="true" />
            Organizer analytics
          </span>
        </div>
      </article>
    </aside>
  )
}
