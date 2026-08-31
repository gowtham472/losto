import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { Card, SectionTitle, Well } from "@/components/ui/primitives";
import { OPERATOR, isConfigured } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy and terms",
  description: "How Losto handles your data, and the terms you use it under.",
};

export default function LegalPage() {
  return (
    <>
      <PageHeader
        title="Privacy and terms"
        subtitle={`Effective ${OPERATOR.effectiveDate} · ${OPERATOR.jurisdiction}`}
      />

      <div className="mx-auto max-w-3xl space-y-7 px-4 pb-14 lg:px-8">
        {!isConfigured ? (
          <Well className="flex items-start gap-2.5 p-3">
            <AlertTriangle size={15} strokeWidth={2.1} className="mt-px shrink-0 text-orange" />
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              <strong className="font-semibold text-ink">Not ready to publish.</strong> The
              publisher name, contact address and effective date are still placeholders. Set them
              before release - a privacy notice without a reachable contact does not meet the DPDP
              Act&apos;s requirements.
            </p>
          </Well>
        ) : null}

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="01">The short version</SectionTitle>
          <Card className="space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-2">
            <p>
              Losto keeps everything you save in your own browser&apos;s storage on your own
              device. Your library is never uploaded, and there is no account to create. It is a
              reader: it fetches a page you paste, keeps a personal copy for you with its credit
              attached, and republishes nothing.
            </p>
            <p>
              The one time Losto touches the network on your behalf is when you paste a link: the
              app fetches that page so it can be read offline. The address you paste is used for
              that request and nothing else.
            </p>
            <p>
              Deleting a chat removes it, and its pictures, from the device. Clearing the app&apos;s
              data or uninstalling it erases everything.
            </p>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="02">What Losto does with a link</SectionTitle>
          <Card className="space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-2">
            <p>
              A browser cannot fetch another website directly, so when you paste a link the Losto
              server makes that one request for you. The page is turned into readable text on the
              way through and handed to your device. No copy is kept on the server, and no record of
              what you saved is written anywhere we can see.
            </p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>
                <strong className="font-semibold text-ink">One address at a time</strong>, only when
                you ask for it. Losto never crawls, never follows links and never re-fetches on a
                schedule.
              </li>
              <li>
                <strong className="font-semibold text-ink">robots.txt is read first</strong>, before
                every page. If a site asks automated tools to leave a path alone, Losto refuses it
                and tells you so. The pictures on a page it has already allowed are then loaded the
                way your browser loads them, which is also the way the site&apos;s own icon is
                fetched to show you where something came from.
              </li>
              <li>
                <strong className="font-semibold text-ink">It says who it is.</strong> The request
                identifies itself as Losto acting for a person, not as an anonymous browser, so any
                site can allow or refuse it deliberately.
              </li>
              <li>
                <strong className="font-semibold text-ink">It bypasses nothing</strong> - no logins,
                no paywalls, no bot checks. If a page is not public, Losto stops.
              </li>
            </ul>
            <p>
              Many assistants build the conversation inside your browser after the page loads, so a
              server receives an empty shell with nothing to save. When a link cannot be read, Losto
              says which reason applied and shows you how to copy the conversation across yourself.
            </p>
            <p>
              <strong className="font-semibold text-ink">Losto never asks for an account.</strong>{" "}
              It has no field for an AI provider&apos;s password, and it does not read or store
              authentication cookies, session tokens, access tokens or browser profiles. It cannot
              sign in as you, and it has no way to reach a conversation that is not either in a file
              you give it, text you paste, or a page the provider shows to anyone. The best way to
              bring your history across is the export your provider will give you on request, which
              Losto reads on this device without sending it anywhere.
            </p>
            <p>
              If you run a site and would rather Losto did not fetch it, write to {OPERATOR.email}.
              Sources can be switched off individually, and that is the response you should expect.
            </p>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="03">Who is responsible</SectionTitle>
          <Card className="space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-2">
            <p>
              <strong className="font-semibold text-ink">{OPERATOR.name}</strong> publishes Losto
              and is the Data Fiduciary for any personal data the service processes, as those terms
              are used in India&apos;s Digital Personal Data Protection Act, 2023.
            </p>
            <Field label="Contact" value={OPERATOR.email} />
            <Field label="Grievance Officer" value={OPERATOR.grievanceOfficer} />
            <p>
              Write to the address above with any question or complaint about your data. You will
              get a reply within {OPERATOR.responseDays} days. If the answer does not satisfy you,
              you may complain to the Data Protection Board of India.
            </p>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="04">What is processed, and why</SectionTitle>
          <Card className="divide-y divide-line">
            <Item
              title="Your saved library"
              purpose="So you can read your material without a connection."
              detail="Chats, articles, notes, tags, subjects, pictures and clips. Stored only in your browser's local database on your device. It is never transmitted to us and we cannot see it."
              basis="Not collected by us at all."
            />
            <Item
              title="Links you paste"
              purpose="To fetch the page you asked for."
              detail="The address is sent to the Losto server, used to make that one request, and returned to your device. It is not stored in a database or used to build a profile."
              basis="Your consent, given by pasting the link and asking for it to be saved."
            />
            <Item
              title="Ordinary connection records"
              purpose="Keeping the service running and secure."
              detail="Like any website, the hosting provider records the IP address, time and page of each request in its server logs. These are used only to operate the service and to stop abuse, and are kept for a short period before deletion."
              basis="Legitimate use - running and securing the service you asked for."
            />
            <Item
              title="Settings on your device"
              purpose="Remembering your theme, text size and reading preferences."
              detail="Held in your browser's local storage. Not personal data about you, and never sent anywhere."
              basis="Not collected by us at all."
            />
          </Card>
          <p className="mt-2.5 px-1 text-[12px] leading-relaxed text-ink-3">
            Losto has no advertising, no analytics, no tracking pixels, no third-party cookies and
            no data sharing or sale. Nothing is used to train any model.
          </p>
        </section>

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="05">Your rights</SectionTitle>
          <Card className="space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-2">
            <p>Under the DPDP Act you may:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>
                <strong className="font-semibold text-ink">Access</strong> a summary of your data.
                Because your library lives on your device, Settings → Export gives you the complete
                copy immediately.
              </li>
              <li>
                <strong className="font-semibold text-ink">Correct or complete</strong> it - every
                title, tag and note is editable in the app.
              </li>
              <li>
                <strong className="font-semibold text-ink">Erase</strong> it. Delete any chat, or
                use Settings → Delete everything. No request to us is needed, and nothing is
                retained elsewhere.
              </li>
              <li>
                <strong className="font-semibold text-ink">Nominate</strong> another person to
                exercise these rights if you die or become incapacitated. Because your data sits on
                your own device, this is handled by whoever can unlock the device.
              </li>
              <li>
                <strong className="font-semibold text-ink">Complain</strong> - to the contact above,
                and then to the Data Protection Board of India.
              </li>
              <li>
                <strong className="font-semibold text-ink">Withdraw consent</strong> at any time by
                not pasting further links, and by deleting what you have saved.
              </li>
            </ul>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="06">Children</SectionTitle>
          <Card className="space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-2">
            <p>
              The DPDP Act treats anyone under 18 as a child and requires verifiable parental
              consent before their personal data is processed. It also forbids tracking children
              and advertising to them.
            </p>
            <p>
              Losto is built so this question stays simple: it creates no account, asks for no name,
              age, email or phone number, builds no profile, shows no advertising and tracks nobody.
              A student&apos;s library never leaves their own device.
            </p>
            <p>
              If you are under 18, please use Losto with your parent or guardian&apos;s knowledge.
            </p>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="07">Content you save</SectionTitle>
          <Card className="space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-2">
            <p>
              Articles, conversations, pictures and clips you save stay the property of whoever
              created them. Losto makes a personal copy on your device for your own reading, keeps
              the author and the original link attached to it, and never republishes it.
            </p>
            <p>
              Please use it that way. Do not use Losto to copy material you are not allowed to
              read, to get around a paywall or login, or to republish someone else&apos;s work as
              your own. Losto will not fetch a page whose site asks automated tools to stay away and
              will not attempt to bypass any access control.
            </p>
            <p>
              Credit travels with the copy. Every saved article opens with its author, publication
              and date and links to the original address; every saved chat keeps its source and a
              link back; an exported Markdown file carries the same header. None of that can be
              stripped by accident, because it is part of what gets stored.
            </p>
            <p>
              <strong className="font-semibold text-ink">Passing a chat to someone next to you</strong>{" "}
              sends one copy to one person, device to device, over your phone&apos;s own radio or a
              code on the screen. It does not go through us and it is not uploaded anywhere. The
              credit line goes with it, and the person receiving it sees where it came from before
              they keep it. Use it the way you would hand over a photocopy - not as a way to
              publish someone else&apos;s work.
            </p>
            <p>
              <strong className="font-semibold text-ink">
                {OPERATOR.name} claims no ownership of anything you import.
              </strong>{" "}
              A saved conversation can contain your own words, an assistant&apos;s output, pictures
              you uploaded, quoted material belonging to somebody else, and information about other
              people. Saving it here changes none of that. You remain responsible for having the
              right to keep and to pass on what you save.
            </p>
            <p>
              If you own content that someone has saved and you believe it is being misused, write
              to {OPERATOR.email} and it will be looked into.
            </p>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="08">Terms of use</SectionTitle>
          <Card className="space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-2">
            <p>
              Losto is provided as-is, without warranty. It is a reading tool: it does not check
              whether what an AI assistant told you is correct, and you should not rely on saved
              answers as fact without checking them.
            </p>
            <p>
              Because your library is stored only on your device, it can be lost if you clear your
              browser data, uninstall the app, or lose the device. Export a backup from Settings if
              your material matters to you. {OPERATOR.name} is not liable for lost saved content.
            </p>
            <p>
              You remain responsible for how you use material you save, including for your
              institution&apos;s rules on academic honesty.
            </p>
            <p>These terms are governed by the laws of {OPERATOR.jurisdiction}.</p>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        <section>
          <SectionTitle index="09">Open-source components</SectionTitle>
          <Card className="space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-2">
            <p>
              Losto is built on open-source software and open-licensed typefaces, each of which
              remains under its own licence. The full list ships with the app in{" "}
              <code className="rounded bg-inset px-1 py-0.5 font-mono text-[11.5px] shadow-hairline">
                THIRD-PARTY-NOTICES.md
              </code>
              .
            </p>
            <p>
              Saved items show the icon of the site they came from, purely to tell you where
              something came from. Most are fetched from the site itself; a few - ChatGPT, Claude,
              Gemini and Wikipedia - are included with the app because their icon cannot be fetched
              reliably. Those logos are the trademarks of their owners, reproduced unaltered and
              used only to identify a source.
            </p>
            <p>
              <strong className="font-semibold text-ink">Losto is an independent application.</strong>{" "}
              It is not affiliated with, endorsed by, sponsored by or connected to OpenAI,
              Anthropic, Google, Perplexity or any other provider, and nothing in it should be read
              as suggesting otherwise. It is a reader for material you already have.
            </p>
          </Card>
        </section>

        <p className="px-1 text-[12px] text-ink-3">
          Questions about any of this: {OPERATOR.email} ·{" "}
          <Link href="/settings" className="underline">
            back to Settings
          </Link>
        </p>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex flex-wrap gap-x-2 text-[12.5px]">
      <span className="font-semibold text-ink">{label}:</span>
      <span className="font-mono text-ink-2">{value}</span>
    </p>
  );
}

function Item({
  title,
  purpose,
  detail,
  basis,
}: {
  title: string;
  purpose: string;
  detail: string;
  basis: string;
}) {
  return (
    <div className="space-y-1 p-4">
      <p className="text-[13px] font-semibold tracking-[-0.015em] text-ink">{title}</p>
      <p className="text-[12.5px] leading-relaxed text-ink-2">{detail}</p>
      <dl className="grid gap-x-3 gap-y-0.5 pt-1 text-[11.5px] sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold uppercase tracking-[0.05em] text-ink-3">Purpose</dt>
        <dd className="text-ink-2">{purpose}</dd>
        <dt className="font-semibold uppercase tracking-[0.05em] text-ink-3">Basis</dt>
        <dd className="text-ink-2">{basis}</dd>
      </dl>
    </div>
  );
}
