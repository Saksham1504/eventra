import { ArrowUpRight, ShieldCheck, TicketCheck } from 'lucide-react'
import { EventraLoginForm } from '@/components/eventra-login-form'
import { EventraSpotlight } from '@/components/eventra-spotlight'

export function EventraLoginPage() {
  return (
    <main id="top" className="relative isolate min-h-svh overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-36 -top-48 size-[34rem] rounded-full bg-brand-sky/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-64 -right-48 size-[38rem] rounded-full bg-brand-amber/15 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-5 pb-5 pt-4 sm:px-8 sm:pt-6 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <a
            href="#top"
            aria-label="Eventra home"
            className="inline-flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_rgba(37,52,91,0.45)]">
              <TicketCheck className="size-5" strokeWidth={2.1} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-[1.32rem] font-semibold leading-none tracking-[-0.055em]">eventra</span>
              <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Smart campus events
              </span>
            </span>
          </a>

          <a
            href="#eventra-spotlight"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="hidden sm:inline">Explore Eventra</span>
            <span className="sm:hidden">Explore</span>
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </header>

        <div className="grid grow items-center gap-12 py-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-14 lg:py-10 xl:gap-20">
          <section
            aria-labelledby="login-heading"
            className="mx-auto w-full max-w-[450px] lg:mx-0 lg:justify-self-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/75 px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="size-1.5 rounded-full bg-brand-mint" aria-hidden="true" />
              Discover · book · show up
            </div>

            <h1
              id="login-heading"
              className="max-w-[11ch] text-[2.85rem] leading-[1.02] font-semibold tracking-[-0.06em] text-foreground sm:text-[3.55rem]"
            >
              Welcome back<span className="text-primary">.</span>
            </h1>
            <p className="mt-4 max-w-[39ch] text-[15px] leading-7 text-muted-foreground sm:text-base">
              One sign-in gets you closer to the events and people that make campus feel like yours.
            </p>

            <EventraLoginForm />

            <div className="mt-8 flex items-start gap-3 border-t border-border/70 pt-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <ShieldCheck className="size-[18px]" aria-hidden="true" />
              </span>
              <p className="pt-0.5 text-sm leading-6 text-muted-foreground">
                Your ticket is unique to you, ready for a quick QR scan at the door.
              </p>
            </div>
          </section>

          <EventraSpotlight />
        </div>

        <footer className="flex flex-col gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Eventra. Made for campus life.</p>
          <p className="font-medium tracking-[0.12em]">DISCOVER · BOOK · BELONG</p>
        </footer>
      </div>
    </main>
  )
}
