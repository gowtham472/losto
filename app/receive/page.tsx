import type { Metadata } from "next";
import { ReceiveView } from "@/components/ReceiveView";

export const metadata: Metadata = {
  title: "Receive a chat",
  description: "Take a saved chat from someone next to you, with no internet.",
  robots: { index: false, follow: false },
};

export default function ReceivePage() {
  return <ReceiveView />;
}
