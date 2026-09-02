import { ImageResponse } from "next/og";
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Losto - keep AI chats and articles, read them with no signal";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    renderOgImage({
      eyebrow: "Works with the wifi off",
      title: "Your AI answers, on your phone.",
      subtitle: "Save a ChatGPT, Claude or Perplexity link and keep it - offline, for good.",
    }),
    { ...size },
  );
}
