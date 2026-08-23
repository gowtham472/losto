# Losto

Paste a ChatGPT, Claude or Perplexity share link and Losto pulls the whole
conversation onto your phone. It stays there - readable with no signal, no
account, and nothing kept on a server.

Built for the case where you generate answers to a question bank at home and
then need them on campus, where the wifi gives up.

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
| ChatGPT | `chatgpt.com/backend-api/share/<id>`, falling back to the page's embedded conversation | Works server-side without a session |
| Claude | `claude.ai/api/chat_snapshots/<uuid>`, falling back to the page | Works server-side without a session |
| Perplexity | `perplexity.ai/rest/thread/<slug>` | Endpoint exists, but Cloudflare blocks server-side requests - the app detects this and points you at Paste text |
| Anything else | Embedded-JSON sniffing, then readable-article extraction | Best effort, flagged in the UI |

Every failure path gives a specific reason (deleted, never shared publicly,
rate-limited, bot-blocked) and offers the manual paste route.

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
