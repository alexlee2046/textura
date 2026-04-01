// src/lib/sceneComposite.ts

export interface ProductForComposite {
  id: string;
  /** data URL or object URL of the product image (may still have white background) */
  imageUrl: string;
  /** optional: data URL with bg removed -- if null, use imageUrl as-is */
  bgRemovedUrl: string | null;
  /** floor-plan coords 0-1, fy=0 front, fy=1 back */
  fx: number;
  fy: number;
  rotation: number; // 0 | 90 | 180 | 270
  realWidth: number;  // cm
  realDepth: number;  // cm
  realHeight: number; // cm
}

const CANVAS_W = 1344;
const CANVAS_H = 768;
const HORIZON_Y = CANVAS_H * 0.33;
const ASSUMED_CEILING_CM = 250;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Composite product images onto a room background using simple perspective projection.
 * Products with fy closer to 1 appear smaller and higher (further back).
 * Returns a JPEG Blob.
 */
export function compositeOnRoom(
  roomBackground: string,
  products: ProductForComposite[],
  roomWidthCm: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d")!;

    // Sort back-to-front so closer items render on top
    const sorted = [...products].sort((a, b) => a.fy - b.fy);

    // Load background + all product images in parallel
    Promise.all([
      loadImage(roomBackground),
      ...sorted.map((p) => loadImage(p.bgRemovedUrl ?? p.imageUrl)),
    ]).then(([bg, ...productImgs]) => {
      ctx.drawImage(bg, 0, 0, CANVAS_W, CANVAS_H);

      sorted.forEach((p, i) => {
        const img = productImgs[i];
        const t = p.fy;
        const scale = lerp(1.0, 0.25, t);
        const pixelW = (p.realWidth / roomWidthCm) * CANVAS_W * scale;
        const pixelH = (p.realHeight / ASSUMED_CEILING_CM) * CANVAS_H * scale;
        const baseX = p.fx * CANVAS_W;
        const baseY = lerp(CANVAS_H * 0.95, HORIZON_Y, t);

        ctx.save();
        ctx.translate(baseX, baseY);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.drawImage(img, -pixelW / 2, -pixelH, pixelW, pixelH);
        ctx.restore();
      });

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("canvas.toBlob failed"));
        },
        "image/jpeg",
        0.92,
      );
    }).catch(reject);
  });
}
