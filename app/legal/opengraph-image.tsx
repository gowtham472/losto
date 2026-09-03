import { ImageResponse } from "next/og";
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Losto - privacy notice and terms";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    renderOgImage({
      title: "Privacy and terms",
      subtitle: "Everything you save stays on your device. No account, no server-side copy.",
    }),
    { ...size },
  );
}
