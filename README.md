# Losto

Paste an AI chat share link or a blog post and Losto keeps the whole thing on
your phone - every answer, code block, table, formula and diagram. It stays
readable with no signal, no account, and nothing kept on a server.

Built for the case where you work through a question bank with an assistant at
home, then need those answers on campus where the wifi gives up.

How Losto fetches, and the reasoning behind it, is written down in
[`FETCHING.md`](./FETCHING.md).

Built by [DoodleByte Studio](https://doodlebytestudio.in), Chennai.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Public landing page |
| `/library` | The app. PWA `start_url`, so an installed Losto opens straight here |
| `/import` | Add a chat, by link or pasted text. Also the Android share target |
| `/receive` | Take a chat from a phone next to you - scan a code, or open a `.losto` file |
| `/chat?id=` | Reader, full-screen |
| `/study` · `/study/session?id=` | Study hub and a running card session |
| `/search` · `/collections` · `/settings` | Full-text search, subjects, settings |
| `/legal` | Privacy notice and terms |
| `/offline` | Shown by the service worker when a page was never cached |
| `/api/extract` · `/api/asset` | The only server-side code: fetch a page, proxy a media file |

## How it works

1. **Add** - paste a link on `/import`. `/api/extract` fetches it, because a
   browser cannot fetch another origin directly. Nothing is stored server-side.
2. **Store** - parsed messages go into IndexedDB. Metadata and message bodies
   live in separate object stores, so a library of hundreds of chats lists
   instantly without deserialising every answer. Media is stored as blobs.
3. **Read** - a service worker precaches the app shell, so every route opens
   offline and the reader renders the original markdown exactly as written.

## Features

**Importing**

- One link or ten at once, with a live preview before anything is saved.
- **Export file** - drop in `conversations.json` from ChatGPT's or Claude's own
  export and the whole history lands at once, parsed on the device.
- **Paste text** for anything that cannot be fetched. `You said:` /
  `<assistant> said:` markers are split back into questions and answers. When a
  link cannot be read, Losto says why, shows the copy steps for that assistant
  and puts the cursor in the paste field.
- Android **share target** - send a link straight from an assistant app or the
  browser.
- File it into a subject and add tags as you save.

**Library**

- Cards or list, sorted by recent, last opened, title, length or oldest.
- Filter by subject, source or favourites; quick text filter over the list.
- **Pick up where you left off** for anything part-read.
- Cards show a cover thumbnail, the source's own icon, tags, reading time,
  stored media count and a reading-progress bar. A chat with a checklist shows
  how much of it you have ticked off instead of a turn count.

**Reader**

- Reading progress, a tickable checklist of every question, and
  resume-where-you-stopped.
- Text size, sans/serif/mono, chat or document layout, optional reasoning traces.
- Copy any answer, pin the important ones, open the original.
- Images with click-to-enlarge, video and audio with controls, player cards.

**Checklist**

- Every question in a chat on its own line, each with a box to tick once you
  have studied it. Ticks are stored with the chat, so they survive a reload and
  travel in a backup.
- One turn holding a whole question bank becomes one row per question rather
  than one row for the turn. That is the case it exists for: a forty-question
  paste is two messages and forty things to revise.
- **It reads the answer, not just the question.** A bank copied out of a Word or
  PDF table arrives as one flat paragraph with the numbering buried
  mid-sentence - `… K2 CO1 2 Identify the composition … K2 CO1 3 State the …` -
  and no line starts with a number. The assistant lays it back out properly
  before answering, so that restatement is what the checklist reads when the
  question itself has no usable list.
- A numbered line in an answer counts as a question when it is a heading, a line
  that is entirely bold, or a line with prose under it - and only the strongest
  of those forms present is used, so the numbered list *inside* each answer is
  not mistaken for more questions. Consecutive numbered lines are a list of
  steps, not a question bank, and are left alone either way.
- **A question may wrap.** A bank copied out of a PDF keeps the page's line
  breaks, so a question runs across two or three lines and often leaves its
  number stranded on a line of its own. Each item continues until a blank line
  or the next number, and bare carriage returns count as line endings the way
  Markdown counts them.
- A list that starts at something other than 1 has lost its opening entries, so
  the answer's own list is used instead.
- Questions are **grouped by the heading they sit under**, so a bank spanning
  three modules reads as three sections with their own counts, and the numbering
  matches what is written in the answer rather than running 1-40.
- Tapping a row jumps to that question's answer, or to its module when the
  answer marks questions in bold rather than as headings.
- Progress shows on the library card and in the study list, so you can see what
  is left without opening anything.

**Study mode**

- Every question you asked becomes a card: read it, reveal the answer, mark it
  known or for review.
- Shuffle, restart, or replay only the ones you flagged. Keyboard driven -
  space reveals, arrows move.
- Finishes with a confidence score and a known/to-review split.

**Sharing, with no internet**

- **Send to a friend** in a chat's options packs it into one `.losto` file -
  messages, pictures, tags and the credit line - and hands it to the phone's own
  share sheet, so it goes by AirDrop, Quick Share or Bluetooth. None of those
  need a connection, and nothing passes through a server.
- **Or show a code.** The same bundle without its media becomes a QR code the
  other phone scans on `/receive`. Anything past one screenful cycles as a loop
  of frames; a missed frame comes back around. A fifteen-question chat gzips to
  about 600 bytes, which is two frames.
- **Seven digits on both screens.** The code is a hash of the bundle, so sender
  and receiver see the same number when they are holding the same thing. It is
  a check, not an address - see [Why there is no pairing code](#why-there-is-no-pairing-code).
- Nothing is written until the receiver sees what they are getting and taps
  keep. Duplicates are skipped.

**Everything else**

- **Full-text search** across every saved answer, with snippets, offline.
- **Subjects** with colours and symbols, plus a starter set for common modules.
- **Backup** - export the library as one JSON file, restore it anywhere.
  Duplicates are skipped. `/receive` reads a backup too, not just a bundle.
- **Export a chat** as Markdown.
- **Installable** to the home screen, with an offline page and an offline banner.

## What it reads

| Source | How it is read | Status |
| --- | --- | --- |
| **Your own export file** | `conversations.json` from ChatGPT or Claude, read in the browser | Whole history |
| Pasted text | Split back into questions and answers, media and all | Always available |
| ChatGPT | The public `/share/<id>` page, decoding its React Router stream payload | Fetched |
| Blogs, docs, Medium | Scored article extraction with metadata and media | Fetched |
| Claude | `claude.ai/share/<id>`, the one path its robots.txt allows | Tried, falls back |
| Gemini, Grok, DeepSeek, Copilot, Le Chat | Article extraction against the share page | Tried, falls back |
| Perplexity | Not fetched. Their terms address automated extraction directly | Paste, or export |
| ChatGPT generated images | Not published by OpenAI - see [Media](#media) | Add the file yourself |

### Your own export is the best route

Every assistant will hand you your own data if you ask. That file is the import
with nothing to weigh up - you asked your provider, they gave it to you, and
Losto reads it off the device. No fetching, no share link, no endpoint, no terms
to interpret, and it brings a whole history rather than one conversation.

- **ChatGPT** - Settings → Data controls → Export data
- **Claude** - Settings → Privacy → Export data

Unzip what arrives and pick `conversations.json` on **Add a chat → Export file**.
It is parsed in the browser by [`lib/exports.ts`](./lib/exports.ts), which
imports nothing from the fetching code: the file never reaches a server, and the
whole thing works offline. Branching ChatGPT threads follow the branch you kept,
and hidden scaffolding turns are dropped.

### Try, then fall back

Losto attempts every source, along the one path that source's own robots.txt
permits, and never anywhere else. What decides success is not policy but page
construction: ChatGPT ships the conversation inside the share page, so it can be
read. Claude and most other assistants assemble the chat in your browser after
load, so the page a server receives is an empty shell - there is genuinely
nothing there to save.

Measured rather than assumed. A Claude share page is 104 KB of HTML with no
`chat_messages` anywhere in it; a Gemini share page is 833 KB whose visible text
is the fifty-six characters of its sign-in chrome. Both are shells. For those,
the export file above brings the whole history across instead.

When a fetch comes back empty, blocked or unsupported, Losto says which of those
happened, shows the copy steps for that assistant, and puts the cursor in the
paste field. Copying from your own browser session is access you already have,
and the paste handling keeps formatting, code, tables and maths.

Every source also carries a `fetchable` flag in `lib/sources.ts`. Setting it to
`false` stops Losto contacting that source at all - the refusal happens in
`extractChat` **before any request is made** - and sends readers straight to the
paste route. Nothing else has to change, which makes it a workable answer if a
provider ever objects. The reasoning behind all of this, including where it sits
against terms of service and copyright, is in [`FETCHING.md`](./FETCHING.md).

## Articles

Paste a blog post, a docs page or a tutorial and Losto scores the page to find
the block holding the writing, drops the navigation, share widgets, newsletter
boxes and comment threads, then keeps:

- **Code blocks** with their language - most of the value of a technical post.
  Any `<pre>` counts, not just `<pre><code>`, because several publishers style
  code with spans and no `<code>` element at all.
- **Author, publication and date**, from Open Graph, JSON-LD or the byline.
- **The canonical URL**, so the saved copy points at the real address.
- **Images**, including lazy-loaded (`data-src`), responsive (`srcset` - widest
  candidate wins) and `<picture>` sources.
- **Animations and clips** - GIF/WebP as images, and the silent looping
  `<video>` most blogs use for animations, stored with its poster frame.

Every saved article opens with a credit line naming the author, the publication
and the original link.

## Passing a chat to someone next to you

Two phones in the same room, neither with a connection, one of them holding the
chat. `/receive` takes it across.

### Why there is no pairing code

A seven-digit code that *finds* the other device would need something to resolve
it - and a page in a browser cannot be that something. It cannot listen on a
socket, cannot advertise over Bluetooth, cannot answer a discovery request.
Every product that pairs by code has a rendezvous server doing the introduction,
which Losto does not have and could not reach with the internet off anyway.

So the code does the one thing it honestly can: it is a hash of the bundle, and
both sides display it. Matching numbers mean both phones are holding the same
bytes. It verifies; it does not connect.

### What carries the bytes

| Route | Carries | Needs |
| --- | --- | --- |
| The phone's share sheet | Everything, pictures included | AirDrop, Quick Share, Bluetooth - no internet |
| A QR code on screen | The words, not the pictures | A camera, and nothing else at all |

The bundle is gzipped JSON with the media base64'd inside it, so a shared chat
reads offline on arrival rather than showing broken pictures. Text compresses
about seven times over, which is what makes the QR route practical: a chat of
fifteen questions and answers comes to roughly 600 bytes, or two frames. Longer
ones cycle as a loop until the far side has every piece, and above 60 KB Losto
says so and sends you to the file instead.

Receiving is deliberately two steps. Losto shows the code, the titles and
whether media came with it, and writes nothing until you agree.

## Media

Diagrams are often the answer, so Losto stores the bytes rather than the link.
Assistant media URLs are signed and expire within hours; a saved chat that only
remembered the URL would show holes a day later, and nothing at all offline.

1. Extraction rewrites every picture, clip and player in the markdown to a
   `losto-asset:<id>` reference and returns the media list with the messages.
2. The browser cannot fetch those cross-origin, so `/api/asset` proxies them -
   media content types only, size-capped, private addresses refused.
3. The bytes land in IndexedDB. The reader resolves each reference to a `blob:`
   URL, so pictures and video work with the network off.

Downloads run **in the background**: the chat is readable the moment it is
saved and the pictures fill in behind it. Anything still missing falls back to
the original link while online, and shows a labelled placeholder when not.

| Kind | Behaviour |
| --- | --- |
| Images | Stored and shown inline, click to enlarge, caption from alt text or the generation prompt |
| Video / audio | Stored and played from the local copy with normal controls |
| YouTube, Vimeo, Loom | Poster frame stored for offline; the play button opens the original, which needs a connection |
| ChatGPT generated images | **Not published by OpenAI.** A share link viewed while signed out shows no generated images at all. Losto still finds them, marks the spot and explains why |

Controls live in Settings → Pictures and video: all media, images only, or off,
plus a per-file size cap. A single chat can retry through **Re-download media**.

### Adding a picture yourself

Where media cannot be fetched, the placeholder offers **Add from device**. The
file is stored under the same asset id the markdown already points at, so the
picture appears exactly where it belongs and works offline from then on. This is
the only way to keep a ChatGPT-generated diagram, and it doubles as a way to
attach a screenshot or a photo of handwritten notes.

### Source icons

Three things can fill the tile, in that order.

1. **A mark bundled with the app**, for ChatGPT, Claude, Gemini and Wikipedia.
   These are in `public/icons/` and mapped in [`lib/logos.ts`](./lib/logos.ts) -
   by source for the assistants, by hostname for Wikipedia. They are precached
   by the service worker, so they are on screen from the first frame and with no
   connection.
2. **The icon fetched from the site itself**, read from the page's own
   `<link rel="icon">` (largest declared size wins, `apple-touch-icon`
   preferred) and stored alongside the chat. This covers every blog without
   bundling anything and stays right through a rebrand.
3. **A tinted monogram**, when a site serves no icon and none ships with the
   app - Grok and DeepSeek among them.

No third-party favicon service is used at any point: that would hand someone
else a log of every site a reader saves.

The bundled marks sit on a white tile rather than the surface colour. They are
dark shapes on transparent backgrounds, and on a dark tile in dark mode they
would simply disappear.

The bundled files are the providers' own trademarks, included to say where a
saved item came from. They are not redrawn, and they carry no suggestion of
affiliation - see [`/legal`](./app/legal/page.tsx) and
[`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md).

## Being a good citizen

Losto fetches from other people's servers, so it behaves like a well-run bot
rather than a scraper:

- **It identifies itself first.** The default agent is
  `Mozilla/5.0 (compatible; LostoReader/1.0; +<info url>) user-initiated-fetch`.
- **It reads robots.txt before every page**, honours `Allow`/`Disallow`
  precedence and `Crawl-delay`, re-checks after a cross-host redirect, and
  refuses politely when a path is off limits.
- **Pictures on a permitted page are not checked again.** robots.txt governs
  crawling documents; no browser consults it before loading an image or a site
  icon, and neither does Losto. Media is still relayed one file at a time, only
  for a page you asked for, size-capped, content-type checked, rate-limited, and
  never from a private address.
- **Compatibility retry.** A few sites - Medium and ChatGPT among them - answer
  anything that is not a browser with a `403`. When that happens Losto asks once
  more as a plain browser, and **says so on the saved item**. This applies to
  pages and to media alike, so an article cannot arrive with its illustrations
  missing. `LOSTO_STRICT_UA=1` disables the retry in both places.
- **It never crawls.** One URL per request, only when a person pastes it.
- **It does not bypass anything** - no paywalls, no logins, no bot challenges.
- **It rate-limits itself**: 30 extractions and 300 media files a minute per
  caller, and backs off when a host answers `429`.
- **It keeps attribution attached** to every saved article and chat.
- **It never asks for an account.** Losto has no field for a provider password,
  never reads a cookie, token or browser profile, and cannot see anything that
  needs a login. Nothing in it can reach a private conversation history - the
  only ways in are your own export file, your own paste, and a link you give it.
- **It uses no private endpoints.** Only the public share page a provider serves
  to anyone. Internal file APIs and undocumented REST endpoints were removed in
  favour of saying plainly when something cannot be read.

The full reasoning - robots.txt versus terms of service versus copyright, what
Losto claims and what it does not, and the known risks - is in
[`FETCHING.md`](./FETCHING.md).

## Configuration

Copy [`.env.example`](./.env.example) to `.env.local`, or paste the same keys
into your host's environment settings. All are optional except the effective
date, which `/legal` requires before it will present itself as a valid notice.
`NEXT_PUBLIC_*` values are inlined at build time, so changing one needs a
rebuild.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_LOSTO_OPERATOR` | `DoodleByte Studio` | Publisher named in the privacy notice |
| `NEXT_PUBLIC_LOSTO_CONTACT` | `doodlebyte.studio@gmail.com` | Where data requests go |
| `NEXT_PUBLIC_LOSTO_GRIEVANCE` | same as contact | Grievance contact the DPDP Act requires |
| `NEXT_PUBLIC_LOSTO_JURISDICTION` | `Chennai, Tamil Nadu, India` | Governing law |
| **`NEXT_PUBLIC_LOSTO_EFFECTIVE`** | *unset* | **Required.** Effective date, e.g. `24 August 2026` |
| `LOSTO_BOT_NAME` | `LostoReader` | Name used in the user agent and robots matching |
| `LOSTO_BOT_URL` | a GitHub URL | Where a site owner lands from the user agent. **Point this at a page that exists** |
| `LOSTO_USER_AGENT` | the honest agent | Overrides the agent entirely |
| `LOSTO_STRICT_UA` | unset | `1` disables the browser retry, for pages and media alike |
| `LOSTO_ASSET_HOSTS` | unset | Comma-separated allow list for the media proxy |
| `NODE_OPTIONS` | unset | Recommended: `--max-http-header-size=65536`. Node rejects responses whose headers exceed 16 KB, and some large sites - Google among them - send more. Without it those pages cannot be read at all |

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
Any Next.js host is fine. Serve it over HTTPS or the service worker and install
prompt will not activate.

After deploying, check `/legal` shows no warning banner, `/robots.txt` returns
200, and `/api/asset` returns `400` rather than `404`.

## Before releasing publicly

1. **Set `NEXT_PUBLIC_LOSTO_EFFECTIVE`.** Until it exists, `/legal` shows a
   warning instead of pretending to be a valid notice.
2. **Have the notice reviewed.** `/legal` is drafted around India's DPDP Act,
   2023 and this app's local-first architecture. Add accounts, sync, payments or
   analytics and it stops being accurate. `FETCHING.md` records the fetching
   position on the same assumptions and must be reviewed with it.
3. **Choose a licence** and add a `LICENSE` file. Every dependency is permissive
   (MIT, BSD, ISC, Apache-2.0, 0BSD, CC-BY-4.0) with no copyleft, so the choice
   is unconstrained.
4. **Keep `THIRD-PARTY-NOTICES.md` shipped and current.** It attributes 144
   packages plus four SIL Open Font License typefaces, which those licences
   require. Regenerate whenever dependencies change.
5. **Point `LOSTO_BOT_URL` at a real page.** It is the address every fetched
   site sees in Losto's user agent. The default is a GitHub URL that may not
   resolve, and an identifying agent whose link 404s is worse than no link at
   all - `/legal` explains who is fetching and how to object, so it is the
   obvious target.
6. **Check your host's logging.** Losto stores nothing, but a platform's default
   access logs record IP addresses. The notice describes this - make sure the
   description matches reality.
7. **Install the PWA on a real phone and test airplane mode.** Offline is the
   central promise; verify it on hardware before claiming it.

## Design

The interface follows the [Beautiful UI](https://www.beautifului.dev) system:
OKLCH surface/ink/line tokens, hairline-ring shadows instead of borders, tight
negative letter-spacing and a small type scale. Typefaces are Plus Jakarta Sans
for the interface, Bricolage Grotesque for display, JetBrains Mono for code, and
Newsreader for the serif reading mode. The landing page is built from the same
tokens as the app rather than a separate template.

## Privacy

The only network request Losto makes on your behalf is fetching a link you
paste. The response goes straight to your device. There is no account, no
analytics, no tracking and no server-side storage. Delete a chat and it is gone;
uninstall and everything goes with it.
