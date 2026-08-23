import type { Metadata } from "next";
import { StudyHubView } from "@/components/StudyHubView";

export const metadata: Metadata = { title: "Study" };

export default function StudyPage() {
  return <StudyHubView />;
}
