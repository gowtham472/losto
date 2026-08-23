import { Suspense } from "react";
import { PageHeader } from "@/components/AppShell";
import { ChatCardSkeleton } from "@/components/ChatCard";
import { LibraryView } from "@/components/LibraryView";

export default function HomePage() {
  return (
    <Suspense fallback={<LibraryFallback />}>
      <LibraryView />
    </Suspense>
  );
}

function LibraryFallback() {
  return (
    <>
      <PageHeader title="Library" subtitle="Loading your library…" />
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-2.5 px-4 sm:grid-cols-2 lg:px-8 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ChatCardSkeleton key={i} view="grid" />
        ))}
      </div>
    </>
  );
}
