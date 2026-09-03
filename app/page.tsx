import {
  ArrowRight,
  ListChecks,
  ShieldCheck,
  Smartphone,
  Users,
  WifiOff,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/AppShell";
import { ChecklistArt, HandoffArt, OfflineArt, Sky } from "@/components/Marketing";
import { SourceMark } from "@/components/SourceMark";
import { ThemeTease } from "@/components/ThemeTease";
import { STUDIO } from "@/lib/legal";
import { OG_LOCALE, SITE_NAME } from "@/lib/seo";
import { buildLandingJsonLd } from "@/lib/structured-data";
import type { SourceId } from "@/lib/types";

const TITLE = "Losto - save AI chats and articles to read offline";
const DESCRIPTION =
  "Paste a ChatGPT, Claude or Perplexity share link, or any blog post, and keep the whole thing on your phone - answers, code, tables and formulas. Built for students whose campus wifi gives up right when they need their notes.";
const SOCIAL_DESCRIPTION =
  "Save AI conversations and tech articles to your phone. Works in airplane mode. No account, and nothing leaves your device.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: OG_LOCALE,
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SOCIAL_DESCRIPTION,
  },
};

/**
 * The page in front of the app.
 *
 * `data-surface="marketing"` swaps the palette to the light azure system and
 * the body face to Sora, for this subtree only - see the block at the end of
 * globals.css. The azure sky gradient (the same one on the social card in
 * lib/og-image.tsx) carries the hero, the feature panels and the closing;
 * everything between them sits on white. The app itself is untouched.
 */
export default function LandingPage() {
  const jsonLd = buildLandingJsonLd();

  return (
    <div data-theme="light" data-surface="marketing" className="min-h-dvh bg-page text-ink">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has no JSX equivalent */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteNav />
      <Hero />
      <SourcesBar />
      <Features />
      <HowItWorks />
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
    { href: "#what", label: "What it does" },
    { href: "#how", label: "How it works" },
    { href: "#sources", label: "What it reads" },
    { href: "#privacy", label: "Privacy" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 lg:px-8">
        <Wordmark />
        <nav className="ml-auto hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <Link
          href="/library"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-control bg-accent px-4 text-[13px] font-semibold text-accent-fg transition-opacity hover:opacity-90 md:ml-0"
        >
          Open Losto
          <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="marketing-sky relative overflow-hidden">
      <Sky />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-center lg:gap-10 lg:px-8 lg:pb-32 lg:pt-24">
        <div className="animate-rise">
          <ThemeTease />

          <h1 className="mt-6 max-w-[16ch] font-display text-[42px] font-bold leading-[1.02] tracking-[-0.04em] text-white sm:text-[58px] lg:text-[64px]">
            Your answers,
            <br />
            <span className="text-white/70">with the signal off.</span>
          </h1>

          <p className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-white/85 sm:text-[16px]">
            You work through a question bank with an assistant at midnight. Next morning the campus
            wifi gives up and none of it is there. Losto takes the share link and keeps the whole
            conversation - every answer, table, formula and diagram - on your phone.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/library"
              className="inline-flex h-12 items-center gap-2 rounded-control bg-white px-6 text-[14.5px] font-semibold text-accent-ink shadow-btn transition-opacity hover:opacity-90"
            >
              Start saving chats
              <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <a
              href="#what"
              className="inline-flex h-12 items-center gap-2 rounded-control border border-white/35 bg-white/10 px-6 text-[14.5px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              See what it does
            </a>
          </div>

          <p className="mt-6 text-[12.5px] text-white/70">
            No account. Nothing leaves the device. Free, with nothing to cancel.
          </p>
        </div>

        <div
          className="animate-rise relative mx-auto w-full max-w-[280px] lg:max-w-none"
          style={{ animationDelay: "0.12s" }}
        >
          <OfflineArt className="w-full drop-shadow-[0_30px_80px_oklch(35%_0.12_255_/_0.55)]" />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

const SHOWN: { id: SourceId; label: string }[] = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "perplexity", label: "Perplexity" },
  { id: "grok", label: "Grok" },
  { id: "deepseek", label: "DeepSeek" },
];

function SourcesBar() {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-9 lg:flex-row lg:justify-between lg:px-8">
        <p className="shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          Keeps chats from
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          {SHOWN.map((source) => (
            <span
              key={source.id}
              className="flex items-center gap-2 opacity-80 transition-opacity hover:opacity-100"
            >
              <SourceMark source={source.id} size="sm" />
              <span className="text-[13px] font-medium text-ink-2">{source.label}</span>
            </span>
          ))}
          <span className="text-[13px] font-medium text-ink-3">and any blog</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Features() {
  return (
    <section id="what" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 lg:px-8 lg:py-28">
      <div className="max-w-[44ch]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-ink">
          What it does
        </p>
        <h2 className="mt-3 font-display text-[30px] font-bold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[38px]">
          Three things, properly.
        </h2>
      </div>

      <div className="mt-14 space-y-16 lg:space-y-24">
        <Feature
          icon={<WifiOff size={17} strokeWidth={2.2} />}
          title="It reads with nothing connected"
          body="Everything sits in your own browser on your own device - the words, the code blocks, the tables, the LaTeX, and the pictures as real files rather than links that expire within hours. Airplane mode, a basement lab, a train through a tunnel: it does not notice."
          art={<OfflineArt className="mx-auto h-[340px] w-auto" />}
          artLabel="No signal, full library"
          reverse
        />
        <Feature
          icon={<ListChecks size={17} strokeWidth={2.2} />}
          title="One answer becomes a checklist"
          body="Paste forty questions in one go and the reply comes back as a single message. Losto reads the numbering inside it and gives you forty rows to tick off as you study - grouped by module, each one jumping straight to its own answer."
          art={<ChecklistArt className="w-full" />}
          artLabel="One answer, split into its questions"
        />
        <Feature
          icon={<Users size={17} strokeWidth={2.2} />}
          title="It hands a chat to the phone beside you"
          body="One of you saves it, the rest get a copy - by AirDrop, Quick Share, or a code on the screen that the other phone's camera reads. No account, no upload, no internet at any point. Both screens show the same seven digits, so you know it arrived whole."
          art={<HandoffArt className="w-full" />}
          artLabel="Device to device, no network in between"
          reverse
        />
      </div>
    </section>
  );
}

function Feature({
  icon,
  title,
  body,
  art,
  artLabel,
  reverse,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  art: React.ReactNode;
  artLabel: string;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : undefined}>
        <span className="inline-flex size-10 items-center justify-center rounded-card bg-accent-tint text-accent-ink">
          {icon}
        </span>
        <h3 className="mt-5 max-w-[20ch] font-display text-[22px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[26px]">
          {title}
        </h3>
        <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-ink-2">{body}</p>
      </div>

      <figure className={reverse ? "lg:order-1" : undefined}>
        <div className="marketing-sky relative overflow-hidden rounded-well p-6 shadow-card sm:p-8">
          <Sky dim />
          <div className="relative flex items-center justify-center">{art}</div>
        </div>
        <figcaption className="mt-3 text-center text-[11.5px] text-ink-3">{artLabel}</figcaption>
      </figure>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Bring it across",
      body: "Hit Share in ChatGPT and paste the link. Or paste the text. Or drop in the export file your provider gives you, and a whole history lands at once.",
    },
    {
      n: "02",
      title: "It is taken apart properly",
      body: "Questions and answers, code with its language, tables, maths, and every picture copied onto the device before its link expires.",
    },
    {
      n: "03",
      title: "Read it anywhere",
      body: "Search the full text, tick questions off as you study them, or flip the whole thing into cards and quiz yourself.",
    },
  ];

  return (
    <section id="how" className="border-y border-line bg-canvas">
      <div className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 lg:px-8 lg:py-28">
        <h2 className="max-w-[22ch] font-display text-[30px] font-bold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[38px]">
          Three taps from a link to a library.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-well bg-line shadow-hairline sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="bg-surface p-6 lg:p-8">
              <span className="font-mono text-[11px] font-semibold text-accent-ink">{step.n}</span>
              <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-ink">
                {step.title}
              </h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{step.body}</p>
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
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-ink">
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
      <div className="marketing-sky relative overflow-hidden rounded-well px-6 py-14 text-center shadow-card sm:px-12">
        <Sky />
        <div className="relative">
          <Smartphone size={20} strokeWidth={2} className="mx-auto text-white/80" />
          <h2 className="mx-auto mt-5 max-w-[20ch] font-display text-[28px] font-bold leading-tight tracking-[-0.035em] text-white sm:text-[36px]">
            Save one chat and see.
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-[13.5px] leading-relaxed text-white/85">
            Add it to your home screen and it behaves like any other app - except it keeps working
            when the signal does not.
          </p>
          <Link
            href="/library"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-control bg-white px-6 text-[14px] font-semibold text-accent-ink shadow-btn transition-opacity hover:opacity-90"
          >
            Open Losto
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>
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
