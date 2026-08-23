import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { Button, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Offline" };

/** Served by the service worker when a page was never cached. */
export default function OfflinePage() {
  return (
    <>
      <PageHeader title="Offline" subtitle="No connection right now." />
      <div className="mx-auto max-w-md px-4">
        <EmptyState
          icon={<CloudOff size={18} strokeWidth={2} />}
          title="This page needs a connection"
          description="Your saved chats do not - head back to the library and everything you have stored is still there."
          action={
            <Link href="/">
              <Button variant="primary">Open my library</Button>
            </Link>
          }
        />
      </div>
    </>
  );
}
