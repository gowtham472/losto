import { ImageResponse } from "next/og";
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Losto - keep AI chats and articles, read them with no signal";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    renderOgImage({
      title: "Losto",
      subtitle: "Save AI chats and articles. Read them with the signal off.",
    }),
    { ...size },
  );
}
