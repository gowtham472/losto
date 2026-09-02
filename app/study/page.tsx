import type { Metadata } from "next";
import { StudyHubView } from "@/components/StudyHubView";

export const metadata: Metadata = { title: "Study", robots: { index: false, follow: false } };

export default function StudyPage() {
  return <StudyHubView />;
}
