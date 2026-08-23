import type { Metadata } from "next";
import { CollectionsView } from "@/components/CollectionsView";

export const metadata: Metadata = { title: "Subjects" };

export default function CollectionsPage() {
  return <CollectionsView />;
}
