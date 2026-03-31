import { prisma } from "@/lib/prisma";
import { getImageBuffer } from "@/lib/image-fetch";
import { SITE_URL } from "@/lib/constants";
import sharp from "sharp";
import QRCode from "qrcode";

export const contentType = "image/jpeg";
export const size = { width: 1200, height: 630 };

const OG_W = 1200;
const OG_H = 630;
const BAR_H = 60;
const IMG_H = OG_H - BAR_H; // 570

type MaterialSnapshot = {
  name?: string;
  vendorSlug?: string;
};

export default async function Image({
  params,
}: {
  params: Promise<{ shareHash: string }>;
}) {
  const { shareHash } = await params;

  try {
    const gen = await prisma.generation.findUnique({
      where: { shareHash },
      select: {
        inputImageUrl: true,
        resultImageUrl: true,
        materialSnapshot: true,
        organization: {
          select: { name: true, slug: true, logoUrl: true },
        },
      },
    });
    if (!gen) throw new Error("Not found");

    const snapshot = gen.materialSnapshot as MaterialSnapshot;

    // --- Main image: before/after side-by-side ---
    let mainImage: Buffer;
    try {
      const [inputBuf, resultBuf] = await Promise.all([
        getImageBuffer(gen.inputImageUrl),
        getImageBuffer(gen.resultImageUrl),
      ]);

      const halfW = OG_W / 2;
      const beforeHalf = await sharp(inputBuf)
        .resize(halfW, IMG_H, { fit: "cover", position: "centre" })
        .toBuffer();
      const afterHalf = await sharp(resultBuf)
        .resize(halfW, IMG_H, { fit: "cover", position: "centre" })
        .toBuffer();

      // Divider line (2px white)
      const divider = Buffer.from(
        `<svg width="2" height="${IMG_H}"><rect width="2" height="${IMG_H}" fill="white"/></svg>`,
      );

      mainImage = await sharp({
        create: {
          width: OG_W,
          height: IMG_H,
          channels: 4,
          background: { r: 245, g: 245, b: 247, alpha: 255 },
        },
      })
        .composite([
          { input: beforeHalf, top: 0, left: 0 },
          { input: afterHalf, top: 0, left: halfW },
          { input: divider, top: 0, left: halfW - 1 },
        ])
        .toBuffer();
    } catch {
      // Input unavailable -- fall back to result-only
      const resultBuf = await getImageBuffer(gen.resultImageUrl);
      mainImage = await sharp(resultBuf)
        .resize(OG_W, IMG_H, { fit: "cover", position: "centre" })
        .toBuffer();
    }

    // --- QR Code ---
    const vendorSlug = snapshot.vendorSlug ?? gen.organization?.slug;
    const qrUrl = vendorSlug ? `${SITE_URL}/v/${vendorSlug}` : SITE_URL;
    let qrImage: Buffer | null = null;
    try {
      const qrPng = await QRCode.toBuffer(qrUrl, {
        width: 44,
        margin: 1,
        color: { dark: "#FFFFFF", light: "#00000000" },
      });
      // QR is already generated at width:44, no resize needed
      qrImage = await sharp(qrPng).png().toBuffer();
    } catch {
      // QR generation failed -- skip
    }

    // --- Vendor logo ---
    let logoImage: Buffer | null = null;
    if (gen.organization?.logoUrl) {
      try {
        const logoBuf = await getImageBuffer(gen.organization.logoUrl, 3000);
        logoImage = await sharp(logoBuf)
          .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
      } catch {
        // Logo fetch failed -- skip
      }
    }

    // --- Brand bar ---
    const materialLabel = snapshot.name ?? "AI Material Visualization";
    const orgLabel = gen.organization?.name ?? "";

    // Determine left text offset based on whether we have a logo
    const textLeftOffset = logoImage ? 52 : 16;

    const barSvg = Buffer.from(
      `<svg width="${OG_W}" height="${BAR_H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${OG_W}" height="${BAR_H}" fill="rgb(24,24,27)"/>
        <text x="${textLeftOffset}" y="26" font-size="18" font-family="sans-serif"
              fill="white" font-weight="600">${escapeXml(orgLabel ? `${orgLabel} | ${materialLabel}` : materialLabel)}</text>
        <text x="${textLeftOffset}" y="46" font-size="13" font-family="sans-serif"
              fill="rgba(255,255,255,0.6)">Textura — AI Material Visualization</text>
      </svg>`,
    );
    const barBuffer = await sharp(barSvg).png().toBuffer();

    // --- Composite final image ---
    const composites: sharp.OverlayOptions[] = [
      { input: mainImage, top: 0, left: 0 },
      { input: barBuffer, top: IMG_H, left: 0 },
    ];

    if (logoImage) {
      composites.push({
        input: logoImage,
        top: IMG_H + Math.round((BAR_H - 32) / 2),
        left: 14,
      });
    }

    if (qrImage) {
      composites.push({
        input: qrImage,
        top: IMG_H + Math.round((BAR_H - 44) / 2),
        left: OG_W - 44 - 14,
      });
    }

    const jpegBuffer = await sharp({
      create: {
        width: OG_W,
        height: OG_H,
        channels: 4,
        background: { r: 245, g: 245, b: 247, alpha: 255 },
      },
    })
      .composite(composites)
      .jpeg({ quality: 85 })
      .toBuffer();

    return new Response(new Uint8Array(jpegBuffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    // Fallback: solid placeholder
    const fallback = await sharp({
      create: {
        width: OG_W,
        height: OG_H,
        channels: 3,
        background: { r: 245, g: 245, b: 247 },
      },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    return new Response(new Uint8Array(fallback), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}

/** Escape special XML characters for safe SVG text injection. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
