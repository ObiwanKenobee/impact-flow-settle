import { createFileRoute } from "@tanstack/react-router";
import { InteractiveSuite } from "@/components/atlas/InteractiveSuite";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atlas Sanctum — The New Rails of Global Settlement" },
      {
        name: "description",
        content:
          "Atlas Sanctum is a cross-border settlement engine that synchronizes fiat liquidity with verified ecological impact — forests, carbon, water.",
      },
      { property: "og:title", content: "Atlas Sanctum — The New Rails of Global Settlement" },
      {
        property: "og:description",
        content:
          "Settlement infrastructure that moves money and verified planetary impact in the same transaction.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: Index,
});

const stackLayers = [
  {
    n: "01",
    title: "Fiat Forex",
    body: "Deep liquidity across G10 currencies via regulated institutional on-ramps. USD, EUR, GBP, KES — payroll, procurement, vendor settlement.",
  },
  {
    n: "02",
    title: "Stable Asset",
    body: "Tokenized deposits and asset-backed stable units act as the cross-border liquidity bridge between sovereign currencies.",
  },
  {
    n: "03",
    title: "Impact Asset",
    body: "Verified outcomes — carbon sequestered, water restored, forest hectares protected — receive unique digital identities and become investable.",
    accent: true,
  },
  {
    n: "04",
    title: "Settlement Engine",
    body: "The algorithmic core that routes currency, releases funds against IoT-verified outcomes, and distributes returns atomically.",
    dark: true,
  },
];

const timeline = [
  { era: "1300s — Venice", title: "Bills of Exchange", body: "The first modern bank credit and maritime trade finance." },
  { era: "1600s — Amsterdam", title: "Joint-Stock Ledger", body: "Unified coinage and the first central-bank-like settlement venue." },
  { era: "1800s — Chicago", title: "Commodity Futures", body: "Standardized grades turned physical goods into liquid, tradable contracts." },
  { era: "1900s — New York", title: "Equities & Clearing", body: "The electronic ledger and global capital markets infrastructure." },
  { era: "2010s — Crypto", title: "Digital Assets", body: "Atomic finality on programmable rails — but detached from physical truth." },
  { era: "Now — Atlas Sanctum", title: "Synchronous Impact Finality", body: "Money and verified planetary outcomes settled in the same transaction, for the first time.", accent: true },
];

function Index() {
  return (
    <div className="bg-background text-foreground font-body">
      {/* Nav */}
      <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-display font-extrabold tracking-tighter text-xl">ATLAS SANCTUM</span>
            <div className="hidden md:flex gap-6 text-[11px] font-mono tracking-widest uppercase text-muted-foreground">
              <a href="#infrastructure" className="hover:text-foreground transition-colors">The Infrastructure</a>
              <a href="#stack" className="hover:text-foreground transition-colors">Settlement Stack</a>
              <a href="#engine" className="hover:text-foreground transition-colors">Live Engine</a>
              <a href="#history" className="hover:text-foreground transition-colors">History</a>
            </div>
          </div>
          <button className="px-4 py-1.5 bg-foreground text-background text-[11px] font-mono tracking-widest uppercase hover:bg-accent transition-colors cursor-pointer">
            Connect Node
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        {/* Hero */}
        <section className="pt-24 pb-32 border-b border-border">
          <div className="max-w-3xl animate-reveal">
            <div className="inline-block px-2 py-0.5 border border-accent/30 text-accent font-mono text-[10px] tracking-widest uppercase mb-8">
              Strategic Brief 001
            </div>
            <h1 className="text-6xl md:text-8xl font-display font-extrabold tracking-tight leading-[0.9] mb-10 text-balance">
              The New Rails of Global <span className="text-accent">Settlement</span>.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed text-pretty">
              Atlas Sanctum is the first unified settlement engine that bridges fiat forex liquidity with verified impact assets — forests, carbon, water — collapsing the distance between financial value and ecological reality.
            </p>
          </div>
        </section>

        {/* What is Settlement */}
        <section id="infrastructure" className="py-24 grid grid-cols-1 md:grid-cols-12 gap-12 border-b border-border">
          <div className="md:col-span-5 space-y-6">
            <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-[0.2em]">What Is Settlement</div>
            <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">The last mile of value.</h2>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              Settlement is the actual movement of value after a transaction. Who verifies receipt, in what currency, with what guarantee. Most fintechs touch payments. The deeper opportunity is the rail beneath them.
            </p>
            <div className="pt-4 border-t border-border font-mono text-[11px] text-muted-foreground leading-relaxed">
              <div className="text-foreground mb-2">FLOW</div>
              Agreement &nbsp;→&nbsp; Payment &nbsp;→&nbsp; <span className="text-accent">Settlement</span>
            </div>
          </div>

          <div className="md:col-span-7 grid gap-4">
            <RailCard
              label="System A"
              tag="SWIFT / CORRESPONDENT"
              tagTone="legacy"
              width="w-1/3"
              barTone="legacy"
              meta={["Latency: 48–72h", "Cost: High"]}
            />
            <RailCard
              label="System B"
              tag="FOREX BRIDGE"
              tagTone="neutral"
              width="w-2/3"
              barTone="neutral"
              meta={["Latency: Hours", "Cost: Medium"]}
            />
            <RailCard
              label="System C"
              tag="ATLAS SETTLEMENT"
              tagTone="atlas"
              width="w-full"
              barTone="atlas"
              meta={["Latency: Instant", "Impact: Integrated"]}
            />
          </div>
        </section>

        {/* Money + Impact diagram */}
        <section className="py-32 border-b border-border">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <span className="font-mono text-[10px] uppercase text-accent tracking-[0.3em]">The Difference</span>
              <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mt-4 mb-6 text-balance">
                Traditional finance settles money. Atlas settles outcomes.
              </h2>
              <p className="text-muted-foreground leading-relaxed max-w-md">
                The value being settled is no longer only currency. It is also carbon restored, water recovered, forests protected, communities served — each with a verifiable digital identity.
              </p>
            </div>

            <div className="border border-border bg-card p-8 font-mono text-xs leading-7 text-muted-foreground">
              <div className="text-foreground mb-4">SETTLES</div>
              <Row label="Traditional Finance" value="Money" />
              <Row label="Crypto Networks" value="Money + Tokens" />
              <Row label="Atlas Sanctum" value="Money + Impact + Trust + Verification" accent />
              <div className="mt-8 pt-6 border-t border-border text-[10px] uppercase tracking-widest">
                Outcome Asset → Investor Return
              </div>
            </div>
          </div>
        </section>

        {/* 4-Layer Stack */}
        <section id="stack" className="py-32">
          <div className="text-center mb-20">
            <span className="font-mono text-[10px] uppercase text-accent tracking-[0.3em]">Architecture</span>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mt-4">The 4-Layer Settlement Stack</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 -mx-px">
            {stackLayers.map((l, i) => (
              <div
                key={l.n}
                className="p-8 border border-border -ml-px -mt-px flex flex-col items-center text-center space-y-4 hover:bg-stone-tint transition-colors animate-reveal"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                <div
                  className={`size-10 border grid place-items-center font-mono text-sm ${
                    l.dark
                      ? "bg-foreground text-background border-foreground"
                      : l.accent
                      ? "border-accent text-accent"
                      : "border-border"
                  }`}
                >
                  {l.n}
                </div>
                <h3 className="font-display font-bold">{l.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[24ch]">{l.body}</p>
              </div>
            ))}
          </div>

          {/* Engine flow */}
          <div className="mt-20 p-8 border border-border bg-card">
            <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-[0.2em] mb-6">Settlement Engine — Routing</div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 font-mono text-[11px] text-foreground">
              {["Investor funds project", "AI routes FX", "Funds released", "IoT verifies outcome", "Impact asset minted", "Returns distributed"].map((step, i) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-muted-foreground leading-snug">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Suite */}
        <section id="engine" className="py-32 border-t border-border">
          <InteractiveSuite />
        </section>

        {/* History */}
        <section id="history" className="py-32 border-t border-border">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-4 md:sticky md:top-24 h-fit">
              <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-[0.3em]">Historical Lineage</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mt-4 mb-6">
                Every era is defined by its settlement.
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The largest financial markets in history emerged when society discovered a new asset class. To control the rails is to define the value of the era.
              </p>
            </div>
            <div className="md:col-span-8 space-y-12 border-l border-border pl-12">
              {timeline.map((t) => (
                <div key={t.era} className="relative">
                  <div
                    className={`absolute -left-[53px] top-1.5 size-2.5 rounded-full ${
                      t.accent ? "bg-accent ring-4 ring-accent/15" : "bg-border"
                    }`}
                  />
                  <span className={`font-mono text-xs ${t.accent ? "text-accent" : "text-muted-foreground"}`}>{t.era}</span>
                  <h4 className="text-xl font-display font-bold mt-2">{t.title}</h4>
                  <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 mb-20 bg-foreground text-background overflow-hidden relative">
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative z-10 text-center px-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">Limited Beta</span>
            <h2 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight mt-4 mb-8 text-balance">
              Architecting a new world order.
            </h2>
            <p className="text-white/60 max-w-xl mx-auto mb-10 text-pretty">
              Atlas Sanctum is currently in limited beta for development finance institutions, sovereign funds, and impact-aligned capital.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-4 bg-accent text-white font-mono text-xs tracking-widest uppercase hover:brightness-110 transition-all cursor-pointer">
                Inquire for Access
              </button>
              <button className="px-8 py-4 border border-white/20 text-white font-mono text-xs tracking-widest uppercase hover:bg-white/10 transition-all cursor-pointer">
                Read the Whitepaper
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            © 2026 Atlas Sanctum Infrastructure Group
          </div>
          <div className="flex gap-8 font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            <a href="#" className="hover:text-foreground">Terminals</a>
            <a href="#" className="hover:text-foreground">Security</a>
            <a href="#" className="hover:text-foreground">Compliance</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-border last:border-0">
      <span className="text-[11px] uppercase tracking-widest">{label}</span>
      <span className={accent ? "text-accent text-sm" : "text-foreground text-sm"}>{value}</span>
    </div>
  );
}

type Tone = "legacy" | "neutral" | "atlas";
function RailCard({
  label,
  tag,
  tagTone,
  width,
  barTone,
  meta,
}: {
  label: string;
  tag: string;
  tagTone: Tone;
  width: string;
  barTone: Tone;
  meta: [string, string];
}) {
  const tagClass =
    tagTone === "legacy"
      ? "bg-red-50 text-red-700"
      : tagTone === "atlas"
      ? "bg-accent/10 text-accent"
      : "bg-stone-tint text-muted-foreground";
  const barClass =
    barTone === "legacy" ? "bg-muted-foreground" : barTone === "atlas" ? "bg-accent animate-line" : "bg-foreground/60";
  return (
    <div className="p-6 border border-border bg-card hover:border-accent/30 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{label}</span>
        <span className={`px-2 py-0.5 text-[10px] font-mono tracking-wide ${tagClass}`}>{tag}</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full ${width} ${barClass}`} />
      </div>
      <div className="mt-4 flex justify-between text-[11px] font-mono text-muted-foreground">
        <span>{meta[0]}</span>
        <span>{meta[1]}</span>
      </div>
    </div>
  );
}
