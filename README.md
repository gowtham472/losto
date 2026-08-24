# Losto

Paste a ChatGPT, Claude or Perplexity share link and Losto pulls the whole
conversation onto your phone. It stays there - readable with no signal, no
account, and nothing kept on a server.

Built for the case where you generate answers to a question bank at home and
then need them on campus, where the wifi gives up.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Public landing page |
| `/library` | The app. PWA `start_url`, so an installed Losto opens straight here |
| `/chat?id=`, `/study/session?id=` | Reader and study session, both full-screen |
| `/legal` | Privacy notice and terms |

## How it works

1. **Add** - paste a share link on `/import`. A single Next.js route handler
   (`/api/extract`) fetches the conversation, because browsers cannot fetch
   another origin directly. Nothing is stored server-side.
2. **Store** - the parsed messages go into IndexedDB on the device. Metadata and
   message bodies live in separate object stores so a library of hundreds of
   chats lists instantly without deserialising every answer.
3. **Read** - a service worker precaches the app shell, so every route opens
   offline. The reader renders the original markdown: code blocks, tables, LaTeX
   and all.

## Features

- **Import** one link or ten at once, with a live preview before saving.
- **Pictures and video, kept offline** - see below.
- **Paste text** fallback for chats that cannot be fetched - `You said:` /
  `ChatGPT said:` markers are split back into questions and answers.
- **Subjects and tags** for grouping by module, paper or unit.
- **Study mode** turns each chat into question cards: read the question, reveal
  the answer, mark it known or for review, and get a confidence summary.
- **Full-text search** across every saved answer, offline.
- **Reader controls** - text size, sans/serif/mono, chat or document layout,
  optional reasoning traces, resume-where-you-left-off.
- **Backup** - export the whole library as JSON and restore it on another
  device. Duplicates are skipped on import.
- **Installable** - home-screen install, and on Android a share target so a link
  can go straight from the ChatGPT app into Losto.

## Source support

| Source | How it is read | Status |
| --- | --- | --- |
| ChatGPT | The public `/share/<id>` page, decoding its React Router payload | Allowed by `Allow: /share/` in their robots.txt |
| Claude | The public `/share/<uuid>` page | `/share/` is permitted; `/api/*` is not, so it is not used |
| Perplexity | `perplexity.ai/rest/thread/<slug>` | Cloudflare blocks server-side requests - the app detects this and points you at Paste text |
| Tech blogs and docs | Scored article extraction with metadata and media | See [Articles](#articles) |
| Anything else | Embedded-JSON sniffing, then readable-article extraction | Best effort, flagged in the UI |

Both assistants expose a private JSON API that would be easier to parse. Both
sit behind a `Disallow` in the site's robots.txt, so Losto reads the page they
publish instead.

## Articles

Paste a blog post, a docs page or a tutorial and Losto scores the page to find
the block that actually holds the writing, drops the navigation, share widgets,
newsletter boxes and comment threads, then keeps:

- **Code blocks** with their language, which is most of the value of a tech post
- **Author, publication and date**, read from Open Graph, JSON-LD or the byline
- **The canonical URL**, so the saved copy points at the real address
- **Images**, including lazy-loaded (`data-src`), responsive (`srcset` - the
  widest candidate wins) and `<picture>` sources
- **Animations and clips** - GIF/WebP as images, and the silent looping `<video>`
  most blogs use, stored and replayed locally with its poster frame

Every saved article opens with a credit line naming the author, the publication
and the original link.

### Source icons

Saved items are marked with the real icon of the site they came from — ChatGPT's,
Claude's, or the blog's. The icon is read from the page's own `<link rel="icon">`
(largest declared size wins, `apple-touch-icon` preferred) and stored alongside
the chat, so it still shows with no connection.

Two deliberate choices here. No third-party favicon service is used, because that
would hand someone else a log of every site a reader saves. And nothing is
hand-traced: using each publisher's own icon keeps the mark accurate, keeps
working when a company rebrands, and avoids shipping redrawn trademarks. A
tinted monogram stands in until the icon arrives, or if a site serves none.

Every failure path gives a specific reason (deleted, never shared publicly,
rate-limited, bot-blocked) and offers the manual paste route.

## Media

Diagrams and generated images are often the answer, so Losto stores the bytes
rather than the link. Assistant media URLs are signed and expire within hours; a
saved chat that only remembered the URL would show holes a day later, and
nothing at all with no signal.

1. Extraction rewrites every picture, clip and player in the markdown to a
   `losto-asset:<id>` reference and returns the media list alongside the
   messages.
2. The browser cannot fetch those cross-origin, so `/api/asset` proxies them —
   media content types only, size-capped, private addresses refused. Set
   `LOSTO_ASSET_HOSTS` to a comma-separated list to narrow it further.
3. The bytes land in IndexedDB. The reader resolves each reference to a `blob:`
   URL, so images and video play with the network off.

Downloads run **in the background** — the chat is readable the moment it is
saved, and the pictures fill in behind it. Anything still missing falls back to
the original link while you are online, and shows a labelled placeholder when
you are not.

| Kind | Behaviour |
| --- | --- |
| Images | Stored and rendered inline, click to enlarge, caption from the alt text or the generation prompt |
| Video / audio | Stored and played from the local copy with normal controls |
| YouTube, Vimeo, Loom | The poster frame is stored for offline; the play button opens the original, which needs a connection |
| ChatGPT generated images | **Not published by OpenAI.** A share link viewed while signed out shows no generated images at all — verified in a real browser. Losto still finds them, marks the spot, explains why, and offers to take the file from your device |

Controls live in Settings → Pictures and video: copy all media, images only, or
nothing, plus a per-file size cap. Individual chats can retry through
**Re-download media** in the chat menu.

### Adding a picture yourself

Where media cannot be fetched, the placeholder offers **Add from device**. Pick
the file and it is stored under the same asset id the markdown already points
at, so the picture appears exactly where it belongs and works offline from then
on. This is the only way to keep a ChatGPT-generated diagram, and it doubles as
a way to attach a screenshot or a photo of handwritten notes.

## Running it

```bash
pnpm install
```

```bash
pnpm dev
```

The service worker only registers in production builds, so test offline
behaviour against a real build:

```bash
pnpm build && pnpm start
```

## Deploying

Losto needs a Node runtime for `/api/extract` - a static export will not work.
Any Next.js host (Vercel, Fly, a VPS) is fine. Serve it over HTTPS or the
service worker and install prompt will not activate.

## Design

The interface follows the [Beautiful UI](https://www.beautifului.dev) system:
OKLCH surface/ink/line tokens, hairline-ring shadows instead of borders, tight
negative letter-spacing and a small type scale. Typefaces are Plus Jakarta Sans
for the interface, Bricolage Grotesque for display, JetBrains Mono for code, and
Newsreader for the serif reading mode.

## Privacy

The only network request Losto makes on your behalf is fetching a link you
paste. The response goes straight to your device. There is no account, no
analytics and no server-side storage.

## Being a good citizen

Losto fetches from other people's servers, so it behaves like a well-run bot
rather than a scraper:

- **It identifies itself first.** The user agent is
  `Mozilla/5.0 (compatible; LostoReader/1.0; +<info url>) user-initiated-fetch`,
  not a fake browser. Override with `LOSTO_USER_AGENT`, `LOSTO_BOT_NAME` and
  `LOSTO_BOT_URL`.
- **It reads robots.txt** before every page and every media file, honours
  `Allow`/`Disallow` precedence and `Crawl-delay`, re-checks after a cross-host
  redirect, and refuses politely when a path is off limits.
- **Compatibility retry.** A few sites — Medium among them — answer anything
  that is not a browser with a `403`, even on paths their own robots.txt allows
  for `*`. When robots.txt permits a page but the site refuses the identified
  request, Losto asks once more as a plain browser and **says so on the saved
  item**. robots.txt is treated as the site's real policy; the `403` as a
  heuristic. Set `LOSTO_STRICT_UA=1` to disable the retry and always stay
  identified, accepting that those sites will not import.
- **It never crawls.** One URL per request, only when a person pastes it. No
  link-following, no bulk jobs, no scheduled re-fetching.
- **It does not bypass anything** — no paywalls, no logins, no bot challenges.
  When it meets one, it says so and offers Paste text.
- **It rate-limits itself** per caller: 30 extractions and 300 media files a
  minute, and it backs off when a host answers `429`.
- **It keeps attribution attached** to every saved article.

## Before releasing publicly

The repository ships the pieces, but a few of them need real values and a
lawyer's eye — this is engineering work, not legal advice.

1. **Fill in the operator details.** `lib/legal.ts` reads
   `NEXT_PUBLIC_LOSTO_OPERATOR`, `NEXT_PUBLIC_LOSTO_CONTACT`,
   `NEXT_PUBLIC_LOSTO_GRIEVANCE`, `NEXT_PUBLIC_LOSTO_JURISDICTION` and
   `NEXT_PUBLIC_LOSTO_EFFECTIVE`. Until they are set, `/legal` shows a warning
   banner instead of pretending to be a valid notice.
2. **Have the notice reviewed.** `/legal` is drafted around India's DPDP Act,
   2023 and this app's local-first architecture. If you add accounts, sync,
   payments or analytics, it stops being accurate and must be rewritten.
3. **Choose a licence** for your own code and add a `LICENSE` file. Every
   dependency is permissive (MIT, BSD, ISC, Apache-2.0, 0BSD, CC-BY-4.0) with no
   copyleft, so the choice is entirely yours.
4. **Keep `THIRD-PARTY-NOTICES.md` shipped and current.** It attributes 142
   packages plus four SIL Open Font License typefaces, which those licences
   require. Regenerate it whenever dependencies change.
5. **Check your host's logging.** Losto stores nothing, but a platform's default
   access logs record IP addresses. The notice describes this; make sure the
   description matches what your host actually does.
