import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/AppShell";
import { SearchView } from "@/components/SearchView";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <Suspense fallback={<PageHeader title="Search" subtitle="Loading…" />}>
      <SearchView />
    </Suspense>
  );
}
