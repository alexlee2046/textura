/**
 * Client-side image compression via canvas.
 *
 * Resizes images that exceed `maxWidth` (preserving aspect ratio) and
 * re-encodes as JPEG at the given quality. Returns the original File
 * unchanged when no resize is needed and the file is already small enough.
 *
 * Works in WeChat's in-app browser and all modern mobile browsers.
 */
const DEFAULT_MAX_WIDTH = 2048;
const DEFAULT_QUALITY = 0.85;

export async function compressImage(
  file: File,
  maxWidth = DEFAULT_MAX_WIDTH,
  quality = DEFAULT_QUALITY,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // No resize needed — both dimensions within bounds
      if (width <= maxWidth && height <= maxWidth) {
        resolve(file);
        return;
      }

      const ratio = Math.min(maxWidth / width, maxWidth / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          resolve(
            new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
