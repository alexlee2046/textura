"use client";


import React, { useState, useCallback, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

const ASPECT_RATIOS = [
  { label: "16:9", value: 16 / 9, apiValue: "16:9" },
  { label: "4:3",  value: 4 / 3,  apiValue: "4:3" },
  { label: "3:2",  value: 3 / 2,  apiValue: "3:2" },
  { label: "1:1",  value: 1,      apiValue: "1:1" },
  { label: "3:4",  value: 3 / 4,  apiValue: "3:4" },
  { label: "9:16", value: 9 / 16, apiValue: "9:16" },
] as const;

export type AspectRatioOption = (typeof ASPECT_RATIOS)[number];

interface ImageCropperProps {
  imageUrl: string;
  onConfirm: (croppedFile: File, aspectRatio: AspectRatioOption) => void;
  onCancel: () => void;
}

async function cropImage(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92),
  );
  return new File([blob], "cropped.jpg", { type: "image/jpeg" });
}

export default function ImageCropper({ imageUrl, onConfirm, onCancel }: ImageCropperProps) {
  const t = useTranslations("ImageCropper");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioOption>(ASPECT_RATIOS[0]);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Auto-detect closest ratio on mount
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      let closest: AspectRatioOption = ASPECT_RATIOS[0];
      let minDiff = Infinity;
      for (const ar of ASPECT_RATIOS) {
        const diff = Math.abs(ar.value - ratio);
        if (diff < minDiff) {
          minDiff = diff;
          closest = ar;
        }
      }
      setSelectedRatio(closest);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;
    const file = await cropImage(imageUrl, croppedAreaPixels);
    onConfirm(file, selectedRatio);
  }, [croppedAreaPixels, imageUrl, onConfirm, selectedRatio]);

  // Keyboard shortcuts: Enter -> confirm, Escape -> cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleConfirm();
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleConfirm, onCancel]);

  return (
    <div className="flex flex-col gap-4">
      {/* Top toolbar: ratio pills (left) + action buttons (right) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-500 mr-1">{t("ratio")}</span>
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.label}
              onClick={() => {
                setSelectedRatio(ar);
                setZoom(1);
                setCrop({ x: 0, y: 0 });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                selectedRatio.label === ar.label
                  ? "bg-zinc-800 text-white border-zinc-800"
                  : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200"
              }`}
            >
              <span
                className={`inline-block rounded-sm ${
                  selectedRatio.label === ar.label ? "bg-white/60" : "bg-zinc-400/50"
                }`}
                style={{
                  width: ar.value >= 1 ? 16 : 16 * ar.value,
                  height: ar.value >= 1 ? 16 / ar.value : 16,
                }}
              />
              {ar.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors text-sm"
          >
            <X className="w-4 h-4" /> {t("cancel")}
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold shadow-sm transition-all text-sm"
          >
            <Check className="w-4 h-4" /> {t("confirm")}
          </button>
        </div>
      </div>

      {/* Cropper area */}
      <div className="relative w-full rounded-3xl overflow-hidden border border-zinc-200 bg-white/80 backdrop-blur" style={{ height: "min(65vh, 520px)" }}>
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={selectedRatio.value}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { borderRadius: "1.5rem" },
          }}
        />
      </div>
    </div>
  );
}

export { ASPECT_RATIOS };
