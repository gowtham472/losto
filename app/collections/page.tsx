import type { Metadata } from "next";
import { CollectionsView } from "@/components/CollectionsView";

export const metadata: Metadata = { title: "Subjects", robots: { index: false, follow: false } };

export default function CollectionsPage() {
  return <CollectionsView />;
}
