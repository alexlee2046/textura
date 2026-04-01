"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Download,
  RotateCcw,
  Ruler,
  Scissors,
  X,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useUser } from "@/hooks/useUser";
import { postShareToMiniProgram } from "@/lib/miniProgramShare";
import { compressImage } from "@/lib/compress-image";
import { downloadImage } from "@/lib/download";
import { downloadBlob } from "@/lib/downloadBlob";
import ImageUploader from "@/components/ImageUploader";
import ImageCropper from "@/components/ImageCropper";
import type { AspectRatioOption } from "@/components/ImageCropper";

type Step = "UPLOAD" | "GENERATE" | "RESULT";
type Quality = "standard" | "pro";

interface ImageEntry {
  file: File;
  previewUrl: string;
  croppedFile?: File;
  croppedUrl?: string;
}

const MAX_IMAGES = 3;

export default function OrthographicPage() {
  const t = useTranslations("OrthographicPage");
  const { user } = useUser();

  const [step, setStep] = useState<Step>("UPLOAD");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Quality | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [dimWidth, setDimWidth] = useState("");
  const [dimDepth, setDimDepth] = useState("");
  const [dimHeight, setDimHeight] = useState("");
  const [cropIndex, setCropIndex] = useState<number | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);

  const handleImagesChange = useCallback(
    (files: File[], previewUrls: string[]) => {
      const entries: ImageEntry[] = files.map((file, i) => ({
        file,
        previewUrl: previewUrls[i],
      }));
      setImages(entries);
      setStep("GENERATE");
      setErrorMsg(null);
    },
    [],
  );

  const handleRemoveImage = useCallback(
    (index: number) => {
      setImages((prev) => {
        const entry = prev[index];
        URL.revokeObjectURL(entry.previewUrl);
        if (entry.croppedUrl) URL.revokeObjectURL(entry.croppedUrl);
        const next = prev.filter((_, i) => i !== index);
        if (next.length === 0) {
          setStep("UPLOAD");
        }
        return next;
      });
    },
    [],
  );

  const handleCropConfirm = useCallback(
    (croppedFile: File, _ar: AspectRatioOption) => {
      if (cropIndex === null) return;
      setImages((prev) =>
        prev.map((entry, i) => {
          if (i !== cropIndex) return entry;
          if (entry.croppedUrl) URL.revokeObjectURL(entry.croppedUrl);
          return {
            ...entry,
            croppedFile,
            croppedUrl: URL.createObjectURL(croppedFile),
          };
        }),
      );
      setCropIndex(null);
    },
    [cropIndex],
  );

  const handleAddMore = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      e.target.value = "";

      const remaining = MAX_IMAGES - images.length;
      const toProcess = Array.from(fileList)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining);

      const newEntries: ImageEntry[] = [];
      for (const file of toProcess) {
        const result = await compressImage(file);
        newEntries.push({
          file: result,
          previewUrl: URL.createObjectURL(result),
        });
      }

      if (newEntries.length > 0) {
        setImages((prev) => [...prev, ...newEntries]);
      }
    },
    [images.length],
  );

  const handleGenerate = async (quality: Quality) => {
    if (images.length === 0) return;

    const hasAny = dimWidth || dimDepth || dimHeight;
    const hasAll = dimWidth && dimDepth && dimHeight;
    if (hasAny && !hasAll) {
      setErrorMsg(t("dimensionsIncomplete"));
      return;
    }

    setGenerating(quality);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      images.forEach((entry, i) => {
        formData.append(`image_${i}`, entry.croppedFile ?? entry.file);
      });
      formData.append("quality", quality);
      if (dimWidth) formData.append("width", dimWidth);
      if (dimDepth) formData.append("depth", dimDepth);
      if (dimHeight) formData.append("height", dimHeight);

      const res = await fetch("/api/orthographic", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.status === 402) {
        setErrorMsg(t("insufficientCredits"));
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setResultUrl(data.imageUrl);
      if (data.shareHash) {
        postShareToMiniProgram({
          title: "看看这个正交投影图效果",
          shareHash: data.shareHash,
        });
      }
      setStep("RESULT");
    } catch (e) {
      setErrorMsg(
        t("errorPrefix") + (e instanceof Error ? e.message : "Unknown error"),
      );
    } finally {
      setGenerating(null);
    }
  };

  const handleStartOver = () => {
    for (const entry of images) {
      URL.revokeObjectURL(entry.previewUrl);
      if (entry.croppedUrl) URL.revokeObjectURL(entry.croppedUrl);
    }
    setStep("UPLOAD");
    setImages([]);
    setResultUrl(null);
    setErrorMsg(null);
    setDimWidth("");
    setDimDepth("");
    setDimHeight("");
    setCropIndex(null);
  };

  const handleDownload = (format: "png" | "svg" | "pdf" | "dxf") => {
    if (!resultUrl || exporting) return;

    if (format === "png") {
      downloadImage(resultUrl, `orthographic_${Date.now()}.webp`);
      return;
    }

    setExporting(format);
    fetch("/api/orthographic/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: resultUrl, format }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Export failed");
        }
        const blob = await res.blob();
        downloadBlob(blob, blob.type, `orthographic_${Date.now()}.${format}`);
      })
      .catch((e) => {
        setErrorMsg(
          t("errorPrefix") +
            (e instanceof Error ? e.message : "Export failed"),
        );
      })
      .finally(() => setExporting(null));
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <Ruler className="w-5 h-5 text-zinc-500" />
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {t("title")}
            </h1>
          </div>
          <p className="text-sm text-zinc-500">{t("subtitle")}</p>
        </motion.div>

        {/* Error toast */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <AnimatePresence mode="wait">
          {step === "UPLOAD" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <ImageUploader
                maxImages={MAX_IMAGES}
                hint={t("uploadHint")}
                onImagesChange={handleImagesChange}
              />
            </motion.div>
          )}

          {step === "GENERATE" && images.length > 0 && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              {/* Same-product reminder */}
              {images.length > 1 && (
                <p className="text-xs text-amber-600 text-center">
                  {t("sameProductReminder")}
                </p>
              )}

              {/* Thumbnail row */}
              <div className="glass-panel rounded-2xl p-4">
                <div className="flex flex-wrap gap-4 justify-center">
                  {images.map((entry, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-zinc-200 bg-white">
                        <img
                          src={entry.croppedUrl ?? entry.previewUrl}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setCropIndex(i)}
                          disabled={generating !== null}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                        >
                          <Scissors className="w-3 h-3" />
                          {t("cropBtn")}
                        </button>
                        <button
                          onClick={() => handleRemoveImage(i)}
                          disabled={generating !== null}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          {t("removeBtn")}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add more button */}
                  {images.length < MAX_IMAGES && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => addInputRef.current?.click()}
                        disabled={generating !== null}
                        className="w-28 h-28 rounded-xl border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 hover:border-zinc-400 hover:text-zinc-500 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-6 h-6 mb-1" />
                        <span className="text-xs">{t("addMore")}</span>
                      </button>
                      <input
                        ref={addInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleAddMore}
                      />
                      <div className="h-[26px]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Dimension inputs */}
              <div className="glass-panel rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">
                    {t("dimensionsTitle")}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {t("dimensionsHint")}
                  </span>
                </div>
                <div className="flex gap-3">
                  {(
                    [
                      ["widthLabel", dimWidth, setDimWidth],
                      ["depthLabel", dimDepth, setDimDepth],
                      ["heightLabel", dimHeight, setDimHeight],
                    ] as const
                  ).map(([labelKey, value, setter]) => (
                    <div key={labelKey} className="flex-1">
                      <label className="block text-xs text-zinc-500 mb-1">
                        {t(labelKey)}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="9999"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          disabled={generating !== null}
                          placeholder="—"
                          className="w-full px-3 py-2 pr-10 rounded-lg border border-zinc-200 bg-white/80 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                          {t("unitMm")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality buttons */}
              <div className="flex gap-3">
                {(["standard", "pro"] as Quality[]).map((q) => {
                  const isLoading = generating === q;
                  const isDisabled = generating !== null;
                  return (
                    <motion.button
                      key={q}
                      whileHover={isDisabled ? {} : { scale: 1.02 }}
                      whileTap={isDisabled ? {} : { scale: 0.98 }}
                      onClick={() => handleGenerate(q)}
                      disabled={isDisabled}
                      className={`relative overflow-hidden flex-1 px-4 py-4 rounded-xl font-bold text-base tracking-wide transition-all duration-300 ${
                        isDisabled
                          ? "bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200"
                          : "bg-zinc-900 text-white shadow-[0_0_40px_rgba(0,0,0,0.12)] hover:shadow-[0_0_60px_rgba(0,0,0,0.2)] border border-zinc-800"
                      }`}
                    >
                      {!isDisabled && (
                        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-xl">
                          <div className="absolute inset-0 w-[200%] h-full animate-shimmer opacity-20" />
                        </div>
                      )}
                      <div className="relative flex items-center justify-center gap-2 z-10">
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{t("generating")}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>
                              {q === "standard"
                                ? t("standardBtn")
                                : t("proBtn")}
                            </span>
                          </>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Back button */}
              <button
                onClick={handleStartOver}
                disabled={generating !== null}
                className="w-full text-sm text-zinc-500 hover:text-zinc-700 py-2 transition-colors disabled:opacity-50"
              >
                {t("reupload")}
              </button>
            </motion.div>
          )}

          {step === "RESULT" && resultUrl && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <div className="glass-panel rounded-2xl p-4">
                <img
                  src={resultUrl}
                  alt="Orthographic drawing"
                  className="w-full rounded-xl"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleStartOver}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-200 bg-white/80 text-zinc-700 hover:bg-zinc-50 transition-colors text-sm font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t("startOver")}
                </button>
                {(["png", "svg", "pdf", "dxf"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => handleDownload(fmt)}
                    disabled={exporting !== null}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {exporting === fmt ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Crop modal */}
      {cropIndex !== null && images[cropIndex] && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <ImageCropper
              imageUrl={images[cropIndex].previewUrl}
              onConfirm={handleCropConfirm}
              onCancel={() => setCropIndex(null)}
            />
          </div>
        </div>
      )}

    </div>
  );
}
