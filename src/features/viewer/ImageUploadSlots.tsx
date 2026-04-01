"use client";

import React, { useCallback, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import imageCompression from "browser-image-compression";
import type { GenerationMode } from "./ModeSelector";

export interface UploadImage {
  file: File;
  previewUrl: string;
}

interface ImageUploadSlotsProps {
  mode: GenerationMode;
  images: { slot1?: UploadImage; slot2?: UploadImage };
  onChange: (images: { slot1?: UploadImage; slot2?: UploadImage }) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ImageUploadSlots({
  mode,
  images,
  onChange,
}: ImageUploadSlotsProps) {
  const [isCompressing, setIsCompressing] = useState(false);
  const t = useTranslations("Viewer");

  const processFile = async (file: File): Promise<File> => {
    if (!file.type.startsWith("image/")) throw new Error("Not an image");
    if (file.size <= MAX_FILE_SIZE) return file;

    setIsCompressing(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 4.5,
        maxWidthOrHeight: 2560,
        useWebWorker: true,
        fileType: "image/jpeg",
      });
      return compressed;
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFile = async (slot: "slot1" | "slot2", file: File) => {
    const processed = await processFile(file);
    const current = images[slot];
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    const previewUrl = URL.createObjectURL(processed);
    onChange({ ...images, [slot]: { file: processed, previewUrl } });
  };

  const clearSlot = (slot: "slot1" | "slot2") => {
    const current = images[slot];
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    const newImages = { ...images };
    delete newImages[slot];
    onChange(newImages);
  };

  const UploadSlot = ({
    slot,
    label,
  }: {
    slot: "slot1" | "slot2";
    label: string;
  }) => {
    const image = images[slot];
    const inputRef = React.useRef<HTMLInputElement>(null);

    const onDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(slot, file);
      },
      [slot]
    );

    return (
      <div
        className={`relative border-2 border-dashed rounded-2xl overflow-hidden transition-colors ${
          image ? "border-zinc-300" : "border-zinc-200 hover:border-zinc-400"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(slot, file);
          }}
        />

        <AnimatePresence mode="wait">
          {image ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative aspect-square"
            >
              <img
                src={image.previewUrl}
                alt={label}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => clearSlot(slot)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 shadow-sm hover:bg-white"
              >
                <X className="w-4 h-4 text-zinc-600" />
              </button>
              <span className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/50 text-white text-xs">
                {label}
              </span>
            </motion.div>
          ) : (
            <motion.button
              key="upload"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => inputRef.current?.click()}
              disabled={isCompressing}
              className="w-full aspect-square flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
            >
              {isCompressing ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-400 border-t-transparent" />
              ) : (
                <>
                  <UploadCloud className="w-8 h-8 mb-2" />
                  <span className="text-sm">{label}</span>
                  <span className="text-xs mt-1">{t("imageUpload.clickOrDrag")}</span>
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className={`grid gap-4 ${mode === "precision" ? "grid-cols-2" : "grid-cols-1"}`}>
      <UploadSlot slot="slot1" label={mode === "precision" ? t("imageUpload.frontThreeQuarter") : t("imageUpload.mainView")} />
      {mode === "precision" && <UploadSlot slot="slot2" label={t("imageUpload.rearThreeQuarter")} />}
    </div>
  );
}
