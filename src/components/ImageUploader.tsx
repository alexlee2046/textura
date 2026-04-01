"use client";

import React, { useCallback, useState, useRef } from "react";
import { UploadCloud, ImageIcon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { compressImage } from "@/lib/compress-image";

interface ImageUploaderProps {
  maxImages?: number;
  hint?: string;
  onImagesChange: (files: File[], previewUrls: string[]) => void;
}

export default function ImageUploader({
  maxImages = 1,
  hint,
  onImagesChange,
}: ImageUploaderProps) {
  const t = useTranslations("ImageUploader");
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [maxExceededMsg, setMaxExceededMsg] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  // Accumulated files for multi-image mode
  const filesRef = useRef<File[]>([]);
  const urlsRef = useRef<string[]>([]);

  const processFiles = useCallback(
    async (inputFiles: FileList | File[]) => {
      const files = Array.from(inputFiles).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0) return;

      setSizeError(false);
      setMaxExceededMsg(null);

      if (maxImages === 1) {
        setIsCompressing(true);
        try {
          const result = await compressImage(files[0]);
          setIsCompressing(false);
          onImagesChange([result], [URL.createObjectURL(result)]);
        } catch {
          setIsCompressing(false);
          setSizeError(true);
        }
        return;
      }

      const currentCount = filesRef.current.length;
      const remaining = maxImages - currentCount;
      if (remaining <= 0) return;

      const toProcess = files.slice(0, remaining);
      if (files.length > remaining) {
        setMaxExceededMsg(t("maxExceeded", { max: maxImages }));
        setTimeout(() => setMaxExceededMsg(null), 3000);
      }

      setIsCompressing(true);
      const processed: { file: File; url: string }[] = [];

      for (const file of toProcess) {
        try {
          const result = await compressImage(file);
          processed.push({ file: result, url: URL.createObjectURL(result) });
        } catch {
          // Skip files that fail compression
        }
      }

      setIsCompressing(false);
      if (processed.length === 0) return;

      const newFiles = [...filesRef.current, ...processed.map((p) => p.file)];
      const newUrls = [...urlsRef.current, ...processed.map((p) => p.url)];
      filesRef.current = newFiles;
      urlsRef.current = newUrls;
      setFileCount(newFiles.length);
      onImagesChange(newFiles, newUrls);
    },
    [maxImages, onImagesChange, t],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input so selecting the same file again triggers onChange
      e.target.value = "";
    }
  };

  const isAtMax = maxImages > 1 && fileCount >= maxImages;

  return (
    <motion.div
      initial={{ opacity: 1, scale: 1 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex flex-col gap-2"
    >
      <div
        className={`relative w-full aspect-video md:aspect-[21/9] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 border-2 overflow-hidden
          ${
            isAtMax
              ? "border-zinc-200 bg-zinc-50 cursor-not-allowed opacity-60"
              : isDragging
                ? "border-blue-400 bg-blue-50 shadow-[0_0_30px_rgba(59,130,246,0.15)]"
                : sizeError
                  ? "border-red-300 bg-red-50/50"
                  : "border-zinc-200 bg-white/60 hover:border-zinc-400 hover:bg-white/90"
          }
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          multiple={maxImages > 1}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={handleFileChange}
          disabled={isCompressing || isAtMax}
        />

        <AnimatePresence initial={false} mode="wait">
          {isAtMax ? (
            <motion.div
              key="maxReached"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center text-zinc-400 pointer-events-none"
            >
              <ImageIcon className="w-12 h-12 mb-3" />
              <p className="font-medium text-base">{t("maxReached")}</p>
            </motion.div>
          ) : isDragging ? (
            <motion.div
              key="dragging"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center text-blue-400 pointer-events-none"
            >
              <UploadCloud className="w-16 h-16 mb-4 animate-bounce" />
              <p className="font-semibold text-lg">{t("dropHere")}</p>
            </motion.div>
          ) : isCompressing ? (
            <motion.div
              key="compressing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-zinc-500 pointer-events-none"
            >
              <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-400" />
              <p className="font-semibold text-base">{t("compressing")}</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center pointer-events-none"
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner border ${sizeError ? "bg-red-50 border-red-200" : "bg-zinc-100 border-zinc-200"}`}
              >
                <ImageIcon
                  className={`w-10 h-10 ${sizeError ? "text-red-400" : "text-zinc-400"}`}
                />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-zinc-700 mb-2">
                {t("clickOrDrag")}
              </h3>
              {sizeError ? (
                <p className="text-red-500 text-sm md:text-base text-center max-w-sm font-medium">
                  {t("fileTooLarge")}
                </p>
              ) : (
                <p className="text-zinc-500 text-sm md:text-base text-center max-w-sm">
                  {t("fileTypes")}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Glow effect on hover */}
        <div className="absolute inset-0 w-full h-full pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-700 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_0%,transparent_60%)]" />
      </div>

      {/* Hint text */}
      {hint && (
        <p className="text-xs text-zinc-400 text-center">{hint}</p>
      )}

      {/* Max exceeded toast */}
      <AnimatePresence>
        {maxExceededMsg && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-amber-600 text-center"
          >
            {maxExceededMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
