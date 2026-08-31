# How Losto fetches, and why

This is the reasoning behind the one part of Losto that touches other people's
servers. It is written down so the position is deliberate rather than assumed,
and so it can be revisited when the facts change.

<!-- **This is not legal advice.** It is the considered engineering position of
DoodleByte Studio. Anyone relying on it commercially should have it reviewed. -->

## What Losto actually does

A person pastes a link they already have. Losto fetches that one address, turns
it into readable text, and stores it in that person's own browser on their own
device. Then it stops.

- One URL per request, only ever when a person asks for it.
- No crawling, no link-following, no bulk jobs, no scheduled re-fetching.
- Nothing is stored on any server. There is no account and no database of saved
  material.
- Nothing is redistributed, republished, resold, or used to train anything.
- No access control is bypassed: no logins, no paywalls, no bot challenges.

The nearest familiar comparisons are **Ctrl+S**, *Print to PDF*, a browser
reading list, and the read-later tools that have operated commercially for
fifteen years. The user ends up with a copy of something they were already
shown.

## The line Losto does not cross

Stated first, because it is the part that matters most and the part a reader
should be able to check.

Losto has **no way to reach a private conversation history**, and this is
structural rather than a promise. There is no field for a provider password, no
code that reads a cookie, token or browser profile, no browser automation, no
dependency capable of driving a logged-in session, and no use of a provider's
internal APIs. The only things it can read are a file you already have, text you
paste, and a page a provider serves to anyone who asks.

Three things were removed once it became clear they crossed that line:

- **OpenAI's internal file endpoints** (`/backend-api/…`, `/public-api/…`,
  `/backend-anon/…`), which Losto used to try to resolve generated images.
  Undocumented, covered by chatgpt.com's catch-all `Disallow: /`, and they
  refuse an unauthenticated caller in any case.
- **Session-cookie capture and replay.** The page fetcher kept the cookies a
  site handed back and sent them on follow-up requests. They were an anonymous
  server's own cookies, never a reader's, but holding a consumer AI site's
  session is not something a reading tool should be doing at all.
- **Perplexity's `/rest/thread/` endpoint.** Undocumented, and their terms speak
  to automated extraction directly. Perplexity is now `fetchable: false`.

None of the three worked. Every one of them was pure exposure.

## Prefer the file over the fetch

The best import is the one with nothing to argue about: a provider's own export,
which the reader requests from the provider and Losto reads off the device. No
fetching, no share link, no endpoint, no terms to weigh - and it carries a whole
history rather than one conversation. ChatGPT and Claude both offer one, and
Losto reads them in the browser without a server involved.

Everything below concerns the narrower case where a reader pastes a public link
instead.

## The four layers, and where we stand

### 1. Criminal law

India's IT Act, 2000 ss.43 and 66 concern accessing a computer resource
*without the permission of the owner*. Losto reads public, unauthenticated
addresses that anyone can open, circumvents nothing, and causes no damage or
loss. We do not consider this to be engaged.

### 2. Copyright

The user makes a single personal copy of material they were lawfully shown, for
their own reading and study. That sits close to the centre of fair dealing under
s.52(1)(a) of the Copyright Act, 1957. In most cases the user is the author of
the conversation anyway.

To keep it there, Losto never strips provenance: every saved article carries a
credit line with the author, the publication and the original link, and every
saved chat keeps its source and a link back. See [Credit and citation](#credit-and-citation).

### 3. Terms of service

This is the real constraint, and it is a **contract** matter rather than a
criminal one.

Anthropic's consumer terms forbid accessing the Services "through automated or
non-human means, whether through a bot, script, or otherwise", and forbid
crawling or scraping them. OpenAI's terms forbid using "any automated or
programmatic method to extract data or output from the Services, including
scraping, web harvesting, or web data extraction" outside their API.

Read literally, a server-side fetch of a share link is contrary to both.

Three things temper that, and none of them make it disappear:

- **The remedy for breaching a contract is that the other side stops serving
  you.** There is no loss here to compensate - a student reading their own
  conversation offline costs the provider nothing.
- **Losto's server never agreed to those terms.** They bind the person who
  signed up. Browsewrap terms are weakly enforceable against a party who never
  accepted them. That is a defence, not a shield.
- **The specific signal points the other way.** OpenAI's robots.txt carries an
  explicit `Allow: /share/` while blocking almost everything else with a
  catch-all `Disallow: /`. They made share pages machine-readable on purpose.
  A general anti-scraping clause aimed at bulk harvesters sits awkwardly beside
  a deliberate, path-specific permission. That tension is the provider's to
  resolve; we read the specific signal as the more meaningful one.

**We do not claim Losto is permitted by these terms.** We claim the activity is
narrow, non-commercial in effect, causes no loss, and is the kind of thing the
remedy is disproportionate to. That is a judgement, and it is recorded here so
it can be argued with.

### 4. robots.txt

Not law - a voluntary convention, and the clearest machine-readable statement of
what a site wants automated clients to do. Losto follows it for the thing it
governs:

- Read before every **page** fetch. `Allow`/`Disallow` longest-match precedence,
  `*` and `$` wildcards, `Crawl-delay` honoured, re-checked after a cross-host
  redirect. A disallowed path is refused and the reader is told why.
- **Not** re-checked for the pictures on a page it already permitted. robots.txt
  is a crawling protocol: it governs which documents an automated client may go
  and read. No browser consults it before loading an image, a stylesheet or a
  site icon, and treating a subresource of a page the reader asked for as a
  separate crawl would be a misreading of it. Those fetches stay bounded by
  everything else - one file, one page, size-capped, content-type checked,
  rate-limited, never a private address.

That distinction is stated plainly rather than glossed, because the honest
version of this document is worth more than a tidier one. Anyone who disagrees
with the reading has `LOSTO_ASSET_HOSTS` to narrow it and the `fetchable` switch
to stop a source entirely.

Where a site's robots.txt and its terms disagree, we follow robots.txt, because
it is the instruction actually addressed to software.

## Being a good citizen

- **Honest identity.** The agent is
  `Mozilla/5.0 (compatible; LostoReader/1.0; +<info url>) user-initiated-fetch`,
  not a fake browser. A site can allow or refuse it deliberately.
- **Compatibility retry.** A few sites answer anything non-browser with a `403`
  even on paths their own robots.txt allows. Where the site refuses the
  identified request, Losto retries once as a browser and says so on the saved
  item. This covers pages and the pictures on them equally - including the site
  icon, which is the mark a publisher puts out for every browser to display and
  which Losto shows purely to say where something came from.
  `LOSTO_STRICT_UA=1` disables this.
- **Rate limits.** 30 extractions and 300 media files a minute per caller, with
  backoff when a host answers `429`.
- **No bypassing.** Paywalls, logins and bot challenges end the attempt.

## What happens when a link cannot be read

Some conversations are assembled in the reader's browser and simply are not in
the page - Claude and most assistant share links work this way. Others sit
behind a bot check that refuses any server.

In both cases Losto shows the reader how to copy the conversation across and
puts the cursor in the paste field. It keeps formatting, code, tables and maths,
and splits `You said:` / `… said:` markers back into questions and answers.

That route has no ambiguity at all: the person is reading their own chat in
their own browser and copying it, which is access they plainly have.

## Credit and citation

- Saved **articles** open with a credit line naming the author, the publication
  and the date, and link to the canonical URL.
- Saved **chats** keep the source, the model where known, and a link back to the
  original, shown in the reader and on every card.
- Source **icons** come from each publisher's own site, never a third-party
  favicon service - nothing about a reader's library is disclosed to anyone.
- Exported Markdown carries the same credit header.
- Third-party software and typefaces are attributed in
  [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md).
- Product names and marks belong to their owners. Losto is not affiliated with,
  endorsed by, or connected to any of them.

## Passing a copy to someone else

Losto can hand a saved chat to another phone in the same room - by the phone's
own share sheet, or as a QR code. This is worth stating separately, because it
is not the same act as keeping a personal copy, and the reasoning above does not
stretch to cover it unexamined.

What it is: one person giving one copy to one person standing next to them, of
material both of them could have opened themselves. Device to device, over the
phone's own radio or a camera. Nothing is uploaded, nothing is published, there
is no server in the path and no copy is retained anywhere but on the two
devices. It is a classmate handing over a photocopy, not a distribution channel.

What keeps it there:

- **Attribution travels.** The author, publication, date and original link are
  part of the bundle. The receiver's copy shows the same credit line the
  sender's does, and it cannot be dropped in transit.
- **No reach beyond the room.** The transports are deliberately short-range and
  one-to-one. There is no link to post, no upload, no group send.
- **The receiver is told what they are taking**, including where it came from,
  and nothing is written until they agree.

What it is not, and must not become: a way to publish. If sharing ever grows a
link, a feed, a public index or a many-recipient send, it stops being a private
copy passed between two people and this section is wrong - rewrite it rather
than stretching it.

## If a source objects

Every source carries a `fetchable` flag in [`lib/sources.ts`](./lib/sources.ts).
Setting it to `false` stops Losto contacting that source at all - the refusal
happens before any request is made - and readers are sent to the copy-and-paste
route instead. Nothing else has to change, and everything already saved keeps
working.

That is the intended response to a complaint or a block: flip the flag, ship,
and talk. The contact for that is on [`/legal`](./app/legal/page.tsx).

## Known risks, honestly

- **Most likely by far:** a provider rate-limits or IP-blocks the deployment.
  This is an availability problem, not a legal one, and the kill switch above is
  the answer.
- **Possible:** a cease-and-desist. The answer is the same, plus a reply.
- **Unlikely:** litigation. There are no damages to recover, the activity is
  non-commercial in effect, and the cost of bringing a claim would exceed
  anything recoverable by orders of magnitude.

## If Losto ever changes shape

This reasoning depends on the app being local-first, personal, non-commercial
and non-redistributing. Adding accounts, cloud sync, public sharing of saved
material, advertising against fetched content, or bulk import would break the
argument. In that case this document and `/legal` must be rewritten, not
patched.
