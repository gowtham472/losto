import {
  ArrowRight,
  BarChart3,
  CloudOff,
  FileDown,
  GraduationCap,
  ImageIcon,
  Link2,
  Search,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/AppShell";
import { STUDIO } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Losto - save AI chats and articles to read offline",
  description:
    "Paste a ChatGPT, Claude or Perplexity share link, or any blog post, and keep the whole thing on your phone - answers, code, tables and formulas. Built for students whose campus wifi gives up right when they need their notes.",
  openGraph: {
    title: "Losto - save AI chats and articles to read offline",
    description:
      "Save AI conversations and tech articles to your phone. Works in airplane mode. No account, and nothing leaves your device.",
    type: "website",
  },
};

/**
 * The marketing page is pinned to the dark palette regardless of the
 * visitor's app theme - every color below still resolves through the same
 * surface/ink/line tokens the app uses, just with `data-theme="dark"`
 * scoped to this subtree so it cascades to every utility class inside.
 */
export default function LandingPage() {
  return (
    <div data-theme="dark" className="min-h-dvh bg-page">
      <SiteNav />
      <Hero />
      <SourcesBar />
      <Signal />
      <HowItWorks />
      <Features />
      <Sources />
      <Privacy />
      <Closing />
      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SiteNav() {
  const links = [
    { href: "#how", label: "How it works" },
    { href: "#sources", label: "What it reads" },
    { href: "#privacy", label: "Privacy" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 lg:px-8">
        <Wordmark />
        <nav className="ml-4 hidden items-center gap-1 sm:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <Link
          href="/library"
          className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-page shadow-btn transition-opacity hover:opacity-90"
        >
          Open Losto
          <ArrowRight size={13} strokeWidth={2.5} />
        </Link>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="landing-grid pointer-events-none absolute inset-0" />
      <PlusMarks />
      <SignalLine />

      <div className="relative mx-auto max-w-3xl px-5 pb-4 pt-16 text-center lg:px-8 lg:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-2 shadow-hairline">
          <CloudOff size={11} strokeWidth={2.4} className="text-accent" />
          Works with the wifi off
        </span>

        <h1 className="mx-auto mt-6 max-w-[15ch] font-display text-[40px] font-bold leading-[1.05] tracking-[-0.04em] text-ink sm:text-[54px] lg:text-[62px]">
          Your AI answers,
          <br />
          <span className="text-ink-3">on your phone.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-[50ch] text-[15px] leading-relaxed text-ink-2 sm:text-[16px]">
          You spend an evening working through a question bank with ChatGPT. Next morning the
          campus wifi drops and none of it is there. Losto takes the share link and keeps the whole
          conversation - every answer, table, formula and diagram - on your device.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/library"
            className="inline-flex h-11 items-center gap-2 rounded-control bg-ink px-5 text-[14px] font-semibold text-page shadow-btn transition-opacity hover:opacity-90"
          >
            Start saving chats
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
          <a
            href="#how"
            className="inline-flex h-11 items-center gap-2 rounded-control bg-surface px-5 text-[14px] font-medium text-ink shadow-hairline transition-colors hover:bg-hover"
          >
            See how it works
          </a>
        </div>

        <p className="mt-5 text-[12.5px] text-ink-3">
          Free. No account. Nothing uploaded anywhere.
        </p>
      </div>

      <div className="relative mx-auto max-w-md px-5 pb-20 pt-10 lg:pb-28 lg:pt-14">
        <LibraryPreview />
      </div>
    </section>
  );
}

/** A handful of faint crosshairs marking grid intersections, like the reference. */
function PlusMarks() {
  const positions = [
    "left-[8%] top-12",
    "right-[9%] top-8",
    "left-[14%] top-[210px]",
    "right-[15%] top-[260px]",
  ];

  return (
    <>
      {positions.map((pos) => (
        <svg
          key={pos}
          aria-hidden
          viewBox="0 0 12 12"
          className={`pointer-events-none absolute hidden size-3 text-line-strong sm:block ${pos}`}
        >
          <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
        </svg>
      ))}
    </>
  );
}

/** A stepped line dropping to zero, echoing the "wifi drops mid-answer" story. */
function SignalLine() {
  const points: [number, number][] = [
    [16, 20],
    [96, 20],
    [96, 64],
    [156, 64],
    [156, 112],
    [216, 112],
    [216, 156],
    [276, 156],
  ];

  return (
    <svg
      aria-hidden
      viewBox="0 0 300 200"
      className="pointer-events-none absolute right-[2%] top-10 hidden h-[190px] w-[240px] opacity-60 lg:right-[6%] lg:block"
    >
      <path
        d={points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {points.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x - 3}
          y={y - 3}
          width="6"
          height="6"
          rx="1.5"
          fill="var(--page)"
          stroke="var(--accent)"
          strokeWidth="1.3"
        />
      ))}
      <circle cx={276} cy={156} r="4.5" fill="var(--accent)" />
    </svg>
  );
}

/**
 * A miniature of the real library, built from the same tokens the app uses
 * rather than a screenshot - so it stays honest and themes with the page.
 */
function LibraryPreview() {
  const items = [
    { mark: "GPT", tone: "var(--brand-chatgpt)", title: "Thermodynamics - Unit 3 solved", meta: "18 turns · 12 min", progress: 62 },
    { mark: "CL", tone: "var(--brand-claude)", title: "Why does RuBisCO lose specificity?", meta: "6 turns · 4 min", progress: 100 },
    { mark: "WEB", tone: "var(--brand-manual)", title: "Scaling ArchUnit with Nebula", meta: "2,542 words · 6 code blocks", progress: 24 },
  ];

  return (
    <div className="relative">
      <div className="rounded-well bg-canvas p-3 shadow-raised">
        <div className="flex items-center gap-1.5 px-1 pb-3 pt-1">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="ml-2 font-mono text-[10px] text-ink-3">Library · 3 saved</span>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.title} className="rounded-card bg-surface p-3 shadow-card">
              <div className="flex items-start gap-2.5">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-[8px] font-mono text-[9.5px] font-semibold"
                  style={{
                    color: item.tone,
                    background: `color-mix(in oklch, ${item.tone} 14%, var(--surface))`,
                    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${item.tone} 22%, transparent)`,
                  }}
                >
                  {item.mark}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold tracking-[-0.015em] text-ink">
                    {item.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-ink-3">{item.meta}</p>
                </div>
              </div>
              <span className="mt-2.5 block h-[3px] overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${item.progress}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      <span className="absolute -bottom-3 -left-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink shadow-overlay">
        <span className="size-1.5 rounded-full bg-green" />
        Airplane mode - still readable
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** An honest stand-in for a "trusted by" logo bar - what Losto actually reads from. */
function SourcesBar() {
  const items = [
    { label: "ChatGPT", tone: "var(--brand-chatgpt)" },
    { label: "Claude", tone: "var(--brand-claude)" },
    { label: "Perplexity", tone: "var(--brand-perplexity)" },
    { label: "Blogs & docs", tone: "var(--brand-manual)" },
    { label: "Anything you paste", tone: "var(--brand-manual)" },
  ];

  return (
    <div className="border-y border-line bg-page">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-8 lg:flex-row lg:justify-between lg:px-8">
        <p className="shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          Saves from
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {items.map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-2 opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0"
            >
              <span className="size-2 rounded-full" style={{ background: item.tone }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Signal() {
  const points: { title: string; body?: string }[] = [
    { title: "Share links expire" },
    { title: "Images vanish first" },
    { title: "Screenshots are useless" },
    {
      title: "Losto keeps the copy",
      body: "Every answer, code block, table and diagram - copied to your device the moment you paste the link, before anything can expire.",
    },
  ];

  return (
    <section className="border-b border-line bg-canvas">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-16 lg:py-24">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            The problem
          </p>
          <h2 className="mt-3 font-display text-[30px] font-bold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[38px]">
            A bookmark
            <br />
            is not
            <br />a backup.
          </h2>

          <ol className="mt-8">
            {points.map((point) => (
              <li
                key={point.title}
                className={`relative border-l-2 py-3.5 pl-5 ${point.body ? "border-accent" : "border-line-strong"}`}
              >
                <span
                  className={`absolute -left-[5px] top-4 size-2 rounded-full ${point.body ? "bg-accent" : "bg-line-strong"}`}
                />
                <p
                  className={`text-[14px] tracking-[-0.01em] ${
                    point.body ? "font-semibold text-ink" : "font-medium text-ink-2"
                  }`}
                >
                  {point.title}
                </p>
                {point.body && (
                  <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-ink-2">
                    {point.body}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-center pb-16 lg:pb-0">
          <SignalCard />
        </div>
      </div>
    </section>
  );
}

/** A floating stat card plus two message bubbles, mirroring the reference's product mockup. */
function SignalCard() {
  const rows = [
    { label: "ChatGPT", tone: "var(--brand-chatgpt)", value: 12 },
    { label: "Claude", tone: "var(--brand-claude)", value: 9 },
    { label: "Blogs & docs", tone: "var(--brand-manual)", value: 5 },
  ];
  const max = Math.max(...rows.map((row) => row.value));

  return (
    <div className="relative mx-auto max-w-[380px] pb-20">
      <div className="rounded-well bg-canvas p-4 shadow-raised">
        <div className="flex items-center justify-between px-1 pb-3">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">Saved this week</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-inset px-2 py-1 text-[10.5px] font-medium text-ink-2">
            <BarChart3 size={11} strokeWidth={2.2} />
            Last 7 days
          </span>
        </div>
        <div className="space-y-2.5 rounded-card bg-surface p-3.5 shadow-card">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-[76px] shrink-0 text-[11.5px] font-medium text-ink-2">
                {row.label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-inset">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(row.value / max) * 100}%`, background: row.tone }}
                />
              </span>
              <span className="w-4 shrink-0 text-right font-mono text-[11px] tabnums text-ink-3">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-2 -left-4 w-[220px] rounded-card bg-surface p-3 shadow-overlay">
        <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] text-orange">
          <WifiOff size={11} strokeWidth={2.4} />
          Signal lost - 9:14 PM
        </p>
        <p className="mt-2 text-[12px] leading-snug text-ink">Wifi just dropped mid-question.</p>
      </div>

      <div className="absolute bottom-[-52px] right-0 w-[200px] rounded-card bg-surface p-3 shadow-overlay">
        <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] text-green">
          <span className="size-1.5 rounded-full bg-green" />
          Already saved
        </p>
        <p className="mt-2 text-[12px] leading-snug text-ink">Reading it offline - nothing lost.</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Copy the share link",
      body: "Hit Share in ChatGPT, Claude or Perplexity and copy the link. Or grab the URL of any blog post or docs page.",
    },
    {
      n: "02",
      title: "Paste it into Losto",
      body: "It pulls the full conversation - questions, answers, code blocks, tables, LaTeX - and copies every picture onto your device before the links expire.",
    },
    {
      n: "03",
      title: "Read it anywhere",
      body: "On the bus, in a basement lab, mid-flight. Search the full text, or flip it into question cards and quiz yourself.",
    },
  ];

  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 lg:px-8 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            How it works
          </p>
          <h2 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">
            Three steps, then it is yours.
          </h2>
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
            No extension to install, no account to make. Losto is a web app you can add to your home
            screen.
          </p>
        </div>

        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.n} className="flex gap-4 rounded-card bg-surface p-5 shadow-card">
              <span className="font-mono text-[11px] font-semibold tabnums text-ink-3">
                {step.n}
              </span>
              <div>
                <p className="text-[14px] font-semibold tracking-[-0.015em] text-ink">
                  {step.title}
                </p>
                <p className="mt-1.5 max-w-[58ch] text-[13px] leading-relaxed text-ink-2">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Features() {
  const features = [
    {
      icon: CloudOff,
      title: "Genuinely offline",
      body: "The whole app is cached, not just the text. Open it in airplane mode and every saved chat, diagram and clip is there.",
    },
    {
      icon: ImageIcon,
      title: "Pictures kept, not linked",
      body: "Diagrams, screenshots and video are copied into your device's storage at import. When the original link expires, yours still works.",
    },
    {
      icon: GraduationCap,
      title: "Study mode",
      body: "Every question you asked becomes a card. Read it, reveal the answer, mark it known or for review, and get a confidence score.",
    },
    {
      icon: Search,
      title: "Search inside answers",
      body: "Full-text search across everything you have saved, with matching snippets. Works with no connection.",
    },
    {
      icon: Link2,
      title: "Blogs and docs too",
      body: "Paste a tech article and Losto keeps the writing and the code blocks, drops the nav and newsletter boxes, and credits the author.",
    },
    {
      icon: FileDown,
      title: "Yours to take",
      body: "Export any chat as Markdown, or the whole library as one JSON file. No lock-in, no export fee, no account to delete.",
    },
  ];

  return (
    <section className="border-y border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
        <h2 className="max-w-[24ch] font-display text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">
          Built for the way you actually revise.
        </h2>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-card bg-surface p-5 shadow-card">
              <feature.icon size={17} strokeWidth={2} className="text-accent" />
              <p className="mt-3.5 text-[14px] font-semibold tracking-[-0.015em] text-ink">
                {feature.title}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/** Being specific about the limits is more useful than claiming everything works. */
function Sources() {
  const rows = [
    ["ChatGPT share links", "Full conversation, code, tables, maths, images", "yes"],
    ["Blogs, docs, Medium", "Article text, code blocks, images, author and date", "yes"],
    ["Pasted text", "Anything you copy yourself, split back into questions and answers", "yes"],
    ["Claude, Perplexity and the rest", "Tried first. Most build the chat in your browser, so Losto shows you how to paste it across", "partial"],
    ["ChatGPT images", "OpenAI does not publish these in share links - add the file yourself in one tap", "partial"],
    ["Logins, paywalls, bot checks", "Never. Losto obeys robots.txt and bypasses no access control, ever", "no"],
  ];

  const dot = (state: string) =>
    state === "yes" ? "bg-green" : state === "partial" ? "bg-orange" : "bg-ink-3";

  return (
    <section id="sources" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 lg:px-8 lg:py-24">
      <div className="max-w-[52ch]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          What it reads
        </p>
        <h2 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">
          Including what it cannot.
        </h2>
        <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
          Losto reads one link at a time, only when you paste it, and only where the site&apos;s own
          robots.txt allows. Plenty of chats are assembled inside your browser and are not in the
          page at all. When a link cannot be read, Losto says so and walks you through copying it
          across, which takes a few seconds.
        </p>
      </div>

      <div className="mt-9 overflow-hidden rounded-card shadow-card">
        <table className="w-full border-collapse bg-surface text-left">
          <thead>
            <tr className="bg-inset">
              <th className="px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-2">
                Source
              </th>
              <th className="px-5 py-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-2">
                What you get
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, detail, state]) => (
              <tr key={name} className="border-t border-line">
                <td className="whitespace-nowrap px-5 py-3.5 align-top">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <span className={`size-1.5 shrink-0 rounded-full ${dot(state)}`} />
                    {name}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-[13px] leading-relaxed text-ink-2">{detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Privacy() {
  const points = [
    "No account, no sign-up, no email address.",
    "Your library never leaves your browser's storage.",
    "No analytics, no tracking pixels, no third-party cookies.",
    "Nothing is used to train anything.",
  ];

  return (
    <section id="privacy" className="border-y border-line bg-canvas">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <ShieldCheck size={20} strokeWidth={2} className="text-green" />
          <h2 className="mt-4 font-display text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">
            There is no server holding your notes.
          </h2>
          <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed text-ink-2">
            The only request Losto makes on your behalf is fetching a link you paste, and the result
            goes straight to your device. Delete a chat and it is gone. Uninstall and everything
            goes with it. That is the whole design, not a setting you have to find.
          </p>
          <Link
            href="/legal"
            className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink hover:underline"
          >
            Read the privacy notice
            <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        </div>

        <ul className="space-y-px overflow-hidden rounded-card bg-line shadow-hairline">
          {points.map((point) => (
            <li key={point} className="bg-surface px-5 py-4 text-[13.5px] text-ink">
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Closing() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-28">
      <div className="rounded-well bg-surface px-6 py-14 text-center shadow-card sm:px-12">
        <Smartphone size={20} strokeWidth={2} className="mx-auto text-ink-3" />
        <h2 className="mx-auto mt-5 max-w-[20ch] font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-ink sm:text-[36px]">
          Save one chat and see.
        </h2>
        <p className="mx-auto mt-4 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-2">
          Add it to your home screen and it behaves like any other app - except it keeps working
          when the signal does not.
        </p>
        <Link
          href="/library"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-control bg-accent px-6 text-[14px] font-semibold text-accent-fg shadow-btn transition-opacity hover:opacity-90"
        >
          Open Losto
          <ArrowRight size={15} strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-[34ch] text-[12.5px] leading-relaxed text-ink-2">
            An offline reading library for the answers you actually need again.
          </p>
        </div>

        <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
          <nav className="flex flex-col gap-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Losto
            </p>
            <Link href="/library" className="text-[13px] text-ink-2 hover:text-ink">
              Open the app
            </Link>
            <Link href="/import" className="text-[13px] text-ink-2 hover:text-ink">
              Add a chat
            </Link>
            <Link href="/legal" className="text-[13px] text-ink-2 hover:text-ink">
              Privacy and terms
            </Link>
          </nav>

          <div className="flex flex-col gap-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Built by
            </p>
            <a
              href={STUDIO.site}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[13px] font-semibold text-ink hover:underline"
            >
              {STUDIO.name}
            </a>
            <p className="max-w-[28ch] text-[12.5px] leading-relaxed text-ink-3">
              {STUDIO.tagline}
            </p>
            <a
              href={`mailto:${STUDIO.email}`}
              className="text-[12.5px] text-ink-2 hover:text-ink"
            >
              {STUDIO.email}
            </a>
            <p className="text-[12.5px] text-ink-3">{STUDIO.city}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-[11.5px] text-ink-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>
            © {new Date().getFullYear()} {STUDIO.name}. Losto stores everything on your device.
          </p>
          <p>
            ChatGPT, Claude, Perplexity and other product names belong to their owners, who neither
            endorse nor are affiliated with Losto.
          </p>
        </div>
      </div>
    </footer>
  );
}
