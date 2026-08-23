import type { Metadata } from "next";
import { Suspense } from "react";
import { StudySessionView } from "@/components/StudySessionView";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Study session" };

export default function StudySessionPage() {
  return (
    <Suspense fallback={<SessionFallback />}>
      <StudySessionView />
    </Suspense>
  );
}

function SessionFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 pt-16">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-28 w-full rounded-card" />
    </div>
  );
}
