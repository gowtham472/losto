import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/AppShell";
import { ImportView } from "@/components/ImportView";

export const metadata: Metadata = { title: "Add a chat", robots: { index: false, follow: false } };

export default function ImportPage() {
  return (
    <Suspense fallback={<PageHeader title="Add a chat" subtitle="Loading…" />}>
      <ImportView />
    </Suspense>
  );
}
