import type { Metadata } from "next";
import { Suspense } from "react";
import { ReaderView } from "@/components/ReaderView";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Reading", robots: { index: false, follow: false } };

export default function ChatPage() {
  return (
    <Suspense fallback={<ReaderFallback />}>
      <ReaderView />
    </Suspense>
  );
}

function ReaderFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-16">
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="space-y-2 pt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-full" />
        ))}
      </div>
    </div>
  );
}
