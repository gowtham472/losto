import {
  ArrowRight,
  CloudOff,
  FileDown,
  GraduationCap,
  ImageIcon,
  Link2,
  Search,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/AppShell";
import { STUDIO } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Losto — read your AI chats with no signal",
  description:
    "Paste a ChatGPT, Claude or blog link and keep the whole thing on your phone. Built for students whose campus wifi gives up right when they need their notes.",
  openGraph: {
    title: "Losto — read your AI chats with no signal",
    description:
      "Save ChatGPT answers, Claude chats and tech articles to your phone. Works in airplane mode. Nothing leaves your device.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-page">
      <SiteNav />
      <Hero />
      <Problem />
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
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5 lg:px-8">
        <Wordmark />
        <nav className="ml-auto hidden items-center gap-6 sm:flex">
          <a href="#how" className="text-[13px] text-ink-2 transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#sources" className="text-[13px] text-ink-2 transition-colors hover:text-ink">
            What it reads
          </a>
          <a href="#privacy" className="text-[13px] text-ink-2 transition-colors hover:text-ink">
            Privacy
          </a>
        </nav>
        <Link
          href="/library"
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control bg-ink px-3 text-[13px] font-semibold text-page shadow-btn transition-opacity hover:opacity-90 sm:ml-0"
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
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-inset px-2.5 py-1 text-[11.5px] font-medium text-ink-2 shadow-hairline">
            <CloudOff size={11} strokeWidth={2.3} />
            Works with the wifi off
          </span>

          <h1 className="mt-5 font-display text-[38px] font-bold leading-[1.05] tracking-[-0.04em] text-ink sm:text-[52px] lg:text-[58px]">
            Your AI answers,
            <br />
            <span className="text-ink-3">on your phone.</span>
          </h1>

          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-2 sm:text-[16px]">
            You spend an evening working through a question bank with ChatGPT. Next morning the
            campus wifi drops and none of it is there. Losto takes a share link and keeps the whole
            conversation — every answer, table, formula and diagram — on your device.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/library"
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent px-5 text-[14px] font-semibold text-accent-fg shadow-btn transition-opacity hover:opacity-90"
            >
              Start saving chats
              <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <a
              href="#how"
              className="inline-flex h-11 items-center gap-2 rounded-control bg-surface px-5 text-[14px] font-medium text-ink shadow-btn transition-colors hover:bg-hover"
            >
              See how it works
            </a>
          </div>

          <p className="mt-5 text-[12.5px] text-ink-3">
            Free. No account. Nothing uploaded anywhere.
          </p>
        </div>

        <LibraryPreview />
      </div>
    </section>
  );
}

/**
 * A miniature of the real library, built from the same tokens the app uses
 * rather than a screenshot — so it stays honest and themes with the page.
 */
function LibraryPreview() {
  const items = [
    { mark: "GPT", tone: "var(--brand-chatgpt)", title: "Thermodynamics — Unit 3 solved", meta: "18 turns · 12 min", progress: 62 },
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
        Airplane mode — still readable
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Problem() {
  const facts = [
    ["Share links expire", "Delete the chat and the link dies. Your notes go with it."],
    ["Images vanish first", "Generated diagrams are signed URLs that stop working within hours."],
    ["Screenshots are useless", "You cannot search them, copy the code, or read them at any size."],
  ];

  return (
    <section className="border-y border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8 lg:py-20">
        <h2 className="max-w-[22ch] font-display text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">
          A bookmark is not a backup.
        </h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-card bg-line shadow-hairline sm:grid-cols-3">
          {facts.map(([title, body]) => (
            <div key={title} className="bg-surface p-5">
              <p className="text-[13.5px] font-semibold tracking-[-0.015em] text-ink">{title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Copy the share link",
      body: "In ChatGPT or Claude, hit Share and copy. Or grab the URL of any blog post or docs page.",
    },
    {
      n: "02",
      title: "Paste it into Losto",
      body: "It pulls the full conversation — questions, answers, code blocks, tables, LaTeX — and copies every picture onto your device before the links expire.",
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
    ["ChatGPT", "Full conversation, code, tables, maths", "yes"],
    ["Claude", "Full conversation, artifacts, thinking", "yes"],
    ["Blogs, docs, Medium", "Article text, code blocks, images, author and date", "yes"],
    ["ChatGPT images", "OpenAI does not publish these in share links — add the file yourself in one tap", "partial"],
    ["Perplexity", "Blocks all software from reading threads — paste the text instead", "no"],
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
          Some sites will not hand their content to software, and Losto does not pretend otherwise
          or try to sneak around them. Where something cannot be fetched, it tells you why and
          offers the paste-it-yourself route.
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
          Add it to your home screen and it behaves like any other app — except it keeps working
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
          <p>ChatGPT, Claude and Perplexity are trademarks of their respective owners.</p>
        </div>
      </div>
    </footer>
  );
}
