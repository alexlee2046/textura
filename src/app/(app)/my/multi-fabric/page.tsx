"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

import Image from "next/image";
import { useUser } from "@/hooks/useUser";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import ImageUploader from "@/components/ImageUploader";
import ImageCropper, { type AspectRatioOption } from "@/components/ImageCropper";
import FabricSelector from "@/components/FabricSelector";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import ShareModal from "@/components/ShareModal";
import { postShareToMiniProgram } from "@/lib/miniProgramShare";
import { microUrl, type Fabric } from "@/data/fabrics";
import type { Region } from "@/lib/multi-fabric-schemas";
import {
  Download,
  RotateCcw,
  Sparkles,
  RefreshCw,
  X,
  Share2,
  Layers,
} from "lucide-react";
type Step = "UPLOAD" | "CROP" | "DETECT" | "ASSIGN" | "GENERATE" | "RESULT";

type Quality = "pro" | "ultra";
const CREDIT_MAP: Record<Quality, number> = { pro: 4, ultra: 8 };

const WIZARD_STEPS: { key: Step[]; label_zh: string; label_en: string }[] = [
  { key: ["UPLOAD", "CROP"], label_zh: "上传", label_en: "Upload" },
  { key: ["DETECT"], label_zh: "识别区域", label_en: "Detect" },
  { key: ["ASSIGN"], label_zh: "选择面料", label_en: "Assign" },
  { key: ["GENERATE", "RESULT"], label_zh: "生成", label_en: "Generate" },
];

function StepIndicator({ currentStep, locale }: { currentStep: Step; locale: string }) {
  const currentIdx = WIZARD_STEPS.findIndex((s) => s.key.includes(currentStep));

  return (
    <div className="flex items-center justify-center gap-1 w-full max-w-md mx-auto">
      {WIZARD_STEPS.map((ws, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div
                className={`flex-1 h-px max-w-8 ${isDone ? "bg-zinc-800" : "bg-zinc-200"}`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : isDone
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-200 text-zinc-400"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isActive ? "font-semibold text-zinc-800" : "text-zinc-400"
                }`}
              >
                {locale === "zh" ? ws.label_zh : ws.label_en}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function MultiFabricPage() {
  const locale = useLocale();
  const t = useTranslations("multiFabric");
  const { user } = useUser();

  // --- wizard state ---
  const [step, setStep] = useState<Step>("UPLOAD");

  // upload / crop
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | null>(null);

  // product hint (optional)
  const [productHint, setProductHint] = useState("");
  const [maxRegions, setMaxRegions] = useState(6);

  // detection
  const [regions, setRegions] = useState<Region[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectSlow, setDetectSlow] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // assignment
  const [assignments, setAssignments] = useState<Record<number, Fabric | null>>({});
  const [activeFabricRegion, setActiveFabricRegion] = useState<number | null>(null);

  // generation
  const [generating, setGenerating] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [shareHash, setShareHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shareModalData, setShareModalData] = useState<{
    shareUrl: string;
    generation?: { shareHash: string; type: string };
  } | null>(null);

  // credits
  const [credits, setCredits] = useState<number | null>(null);
  const handleGenerateRef = useRef<(q: Quality) => void>(() => {});
  const runDetectionRef = useRef<(file: File) => void>(() => {});

  // abort controller ref for detection
  const detectAbortRef = useRef<AbortController | null>(null);

  // --- effects ---

  // Revoke object URLs on unmount / change
  useEffect(() => {
    return () => {
      if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    };
  }, [rawImageUrl]);

  useEffect(() => {
    return () => {
      if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    };
  }, [croppedUrl]);

  // Fetch credits on mount
  useEffect(() => {
    if (user) {
      fetch("/api/credits")
        .then((r) => r.json())
        .then((d) => {
          if (typeof d.credits === "number") setCredits(d.credits);
        });
    }
  }, [user]);

  // --- handlers ---

  const handleImageSelected = (file: File, previewUrl: string) => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageUrl(previewUrl);
    setStep("CROP");
  };

  const handleCropConfirm = (file: File, aspectRatio: AspectRatioOption) => {
    if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    setCroppedFile(file);
    setCroppedUrl(URL.createObjectURL(file));
    setSelectedAspectRatio(aspectRatio.apiValue);
    setStep("DETECT");
    runDetection(file);
  };

  const handleCropCancel = () => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageUrl(null);
    setStep("UPLOAD");
  };

  // --- detection ---

  const runDetection = useCallback(async (imageFile: File) => {
    detectAbortRef.current?.abort();
    const controller = new AbortController();
    detectAbortRef.current = controller;

    setDetecting(true);
    setDetectSlow(false);
    setDetectError(null);

    // Show slow message after 8s
    const slowTimer = setTimeout(() => setDetectSlow(true), 8000);

    // Abort after 15s
    const abortTimer = setTimeout(() => controller.abort(), 15000);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (productHint.trim()) {
        formData.append("productHint", productHint.trim());
      }
      formData.append("maxRegions", String(maxRegions));

      const res = await fetch("/api/multi-fabric/detect", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Detection failed");
      }

      const data = await res.json();
      const detectedRegions: Region[] = data.regions ?? data;

      if (!Array.isArray(detectedRegions) || detectedRegions.length === 0) {
        setDetectError(t("noRegions"));
        setStep("DETECT");
        return;
      }

      setRegions(detectedRegions);
      // Initialize all assignments to null
      const initial: Record<number, Fabric | null> = {};
      for (const r of detectedRegions) {
        initial[r.id] = null;
      }
      setAssignments(initial);
      setStep("ASSIGN");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setDetectError(t("noRegions"));
      } else {
        setDetectError(
          err instanceof Error ? err.message : t("noRegions")
        );
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      setDetecting(false);
      setDetectSlow(false);
    }
  }, [t, productHint, maxRegions]);
  runDetectionRef.current = runDetection;

  const handleReDetect = () => {
    if (!croppedFile) return;
    setAssignments({});
    setRegions([]);
    setStep("DETECT");
    runDetection(croppedFile);
  };

  // --- generation ---

  const hasAnyAssignment = Object.values(assignments).some((f) => f !== null);

  const handleGenerate = async (quality: Quality = "pro") => {
    if (!croppedFile || !hasAnyAssignment) return;

    setGenerating(true);
    setErrorMsg(null);
    setStep("GENERATE");

    try {
      const formData = new FormData();
      formData.append("image", croppedFile);
      formData.append("quality", quality);
      if (selectedAspectRatio) {
        formData.append("aspectRatio", selectedAspectRatio);
      }

      // Build assignments payload
      const assignmentsList = Object.entries(assignments)
        .filter(([, fabric]) => fabric !== null)
        .map(([regionId, fabric]) => ({
          regionId: Number(regionId),
          fabricId: fabric!.id,
        }));

      formData.append("regions", JSON.stringify(regions));
      formData.append("assignments", JSON.stringify(assignmentsList));

      // Server reads swatch images from filesystem — no client upload needed

      const res = await fetch("/api/multi-fabric/generate", {
        method: "POST",
        body: formData,
      });

      if (res.status === 402) {
        setErrorMsg(t("insufficientCredits"));
        setStep("ASSIGN");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setResultImageUrl(data.imageUrl);
      if (typeof data.creditsRemaining === "number") {
        setCredits(data.creditsRemaining);
      }
      if (data.shareHash) {
        setShareHash(data.shareHash);
        postShareToMiniProgram({
          title: "多区域换料效果，你觉得怎么样",
          shareHash: data.shareHash,
        });
      }
      setStep("RESULT");
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setStep("ASSIGN");
    } finally {
      setGenerating(false);
    }
  };
  handleGenerateRef.current = handleGenerate;

  // --- utility ---

  const handleDownload = () => {
    if (!resultImageUrl) return;
    const link = document.createElement("a");
    link.href = resultImageUrl;
    link.download = `multi_fabric_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!shareHash) return;
    const url = `${window.location.origin}/r/${shareHash}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // User cancelled or not supported — fall through to modal
      }
    }
    setShareModalData({
      shareUrl: url,
      generation: { shareHash, type: "multi-fabric" },
    });
  };

  const resetFlow = () => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    setStep("UPLOAD");
    setRawImageUrl(null);
    setCroppedFile(null);
    setCroppedUrl(null);
    setSelectedAspectRatio(null);
    setRegions([]);
    setAssignments({});
    setActiveFabricRegion(null);
    setDetecting(false);
    setDetectSlow(false);
    setDetectError(null);
    setGenerating(false);
    setResultImageUrl(null);
    setShareHash(null);
    setErrorMsg(null);
  };

  // --- render ---

  return (
    <main className="min-h-screen relative flex flex-col items-center pt-20 pb-6 px-4 sm:px-6 lg:px-8 overflow-x-hidden text-zinc-900 z-0">
      {/* Light Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#f5f5f7]">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-100/60 blur-[130px] rounded-full opacity-70 animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-100/40 blur-[150px] rounded-full opacity-60" />
      </div>

      <div className="w-full max-w-3xl flex flex-col items-center z-10 space-y-5">
        {/* Top Navigation Bar */}
        <header className="text-center w-full space-y-1.5">
          <motion.h1
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight inline-flex items-center gap-3"
          >
            <Layers className="w-9 h-9 text-zinc-600 shrink-0" />
            <span className="text-gradient">{t("title")}</span>
          </motion.h1>
          <p className="text-base text-zinc-500">{t("subtitle")}</p>
        </header>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} locale={locale} />

        {/* Error Toast */}
        <AnimatePresence initial={false}>
          {errorMsg && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="px-6 py-3 rounded-full bg-red-50 border border-red-200 text-red-600 text-sm"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detection settings — visible during UPLOAD and CROP */}
        {(step === "UPLOAD" || step === "CROP") && (
          <div className="w-full glass-panel rounded-2xl px-4 py-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">
                {locale === "zh" ? "产品类型（可选，帮助精准识别）" : "Product type (optional, helps focus detection)"}
              </label>
              <input
                type="text"
                value={productHint}
                onChange={(e) => setProductHint(e.target.value)}
                placeholder={locale === "zh" ? "例如：沙发、椅子、床" : "e.g., sofa, chair, bed"}
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-white/60 text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">
                {locale === "zh" ? "识别区域数（最多 12）" : "Number of regions to detect (max 12)"}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={maxRegions}
                  onChange={(e) => setMaxRegions(Number(e.target.value))}
                  className="flex-1 accent-zinc-700"
                />
                <span className="text-sm font-semibold text-zinc-700 w-6 text-center">{maxRegions}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                {locale === "zh"
                  ? "区域越多识别越细致，但生成时每个区域都需要分配面料"
                  : "More regions = finer detection, but each region needs a fabric assigned"}
              </p>
            </div>
          </div>
        )}

        {/* Wizard Steps */}
        <AnimatePresence mode="wait">
          {/* UPLOAD */}
          {step === "UPLOAD" && (
            <motion.div
              key="step-upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="w-full glass-panel p-2 rounded-3xl"
            >
              <ImageUploader onImagesChange={([f], [u]) => handleImageSelected(f, u)} />
            </motion.div>
          )}

          {/* CROP */}
          {step === "CROP" && rawImageUrl && (
            <motion.div
              key="step-crop"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <ImageCropper
                imageUrl={rawImageUrl}
                onConfirm={handleCropConfirm}
                onCancel={handleCropCancel}
              />
            </motion.div>
          )}

          {/* DETECT */}
          {step === "DETECT" && (
            <motion.div
              key="step-detect"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-6 py-20"
            >
              {detecting ? (
                <>
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-t-2 border-zinc-400 rounded-full animate-spin" />
                    <div
                      className="absolute inset-2 border-r-2 border-blue-400 rounded-full animate-spin opacity-70"
                      style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                    />
                  </div>
                  <p className="text-lg font-bold text-zinc-700 animate-pulse">
                    {detectSlow ? t("detectingSlow") : t("detecting")}
                  </p>
                </>
              ) : detectError ? (
                <>
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-6 py-3">
                    {detectError}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => croppedFile && runDetection(croppedFile)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold text-sm shadow-sm transition-all"
                    >
                      <RefreshCw className="w-4 h-4" /> {t("reDetect")}
                    </button>
                    <button
                      onClick={resetFlow}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors text-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> {t("startOver")}
                    </button>
                  </div>
                </>
              ) : null}
            </motion.div>
          )}

          {/* ASSIGN */}
          {step === "ASSIGN" && (
            <motion.div
              key="step-assign"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="w-full flex flex-col gap-4"
            >
              {/* Source image preview */}
              {croppedUrl && (
                <div className="w-full rounded-2xl overflow-hidden glass-panel">
                  <img
                    src={croppedUrl}
                    alt="Source"
                    className="w-full max-h-64 object-contain"
                  />
                </div>
              )}

              {/* Region header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-800">
                  {t("regionsFound", { count: regions.length })}
                </h2>
                <button
                  onClick={handleReDetect}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-500 transition-colors"
                  title={t("reDetectWarn")}
                >
                  <RefreshCw className="w-3 h-3" /> {t("reDetect")}
                </button>
              </div>

              {/* Region list */}
              <div className="glass-panel rounded-2xl divide-y divide-zinc-100">
                {regions.map((region) => {
                  const assignedFabric = assignments[region.id] ?? null;
                  return (
                    <div
                      key={region.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      {/* Region badge */}
                      <span className="w-7 h-7 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {region.id}
                      </span>

                      {/* Region info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 truncate">
                          {locale === "zh" && region.label_zh ? region.label_zh : region.label}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">
                          {region.material_type}
                        </p>
                      </div>

                      {/* Fabric assignment */}
                      {assignedFabric ? (
                        <div className="flex items-center gap-2">
                          <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-zinc-200 shrink-0">
                            <Image
                              src={microUrl(assignedFabric.image)}
                              alt={assignedFabric.color}
                              fill
                              className="object-cover"
                              unoptimized
                              sizes="36px"
                            />
                          </div>
                          <div className="min-w-0 max-w-[100px]">
                            <p className="text-xs font-medium text-zinc-700 truncate">
                              {assignedFabric.color}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setAssignments((prev) => ({
                                ...prev,
                                [region.id]: null,
                              }))
                            }
                            className="p-1 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                            aria-label={t("keepOriginal")}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveFabricRegion(region.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
                        >
                          {t("assignFabric")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Generate buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => handleGenerate("pro")}
                  disabled={!hasAnyAssignment}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-700 text-white hover:bg-zinc-600 font-bold shadow-sm transition-all disabled:opacity-30 text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Pro · {CREDIT_MAP.pro} &#x26A1;
                </button>
                <button
                  onClick={() => handleGenerate("ultra")}
                  disabled={!hasAnyAssignment}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold shadow-sm transition-all disabled:opacity-30 text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Ultra · {CREDIT_MAP.ultra} &#x26A1;
                </button>
              </div>
            </motion.div>
          )}

          {/* GENERATE */}
          {step === "GENERATE" && (
            <motion.div
              key="step-generate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-6 py-20"
            >
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-t-2 border-zinc-400 rounded-full animate-spin" />
                <div
                  className="absolute inset-2 border-r-2 border-blue-400 rounded-full animate-spin opacity-70"
                  style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                />
              </div>
              <p className="text-lg font-bold text-zinc-700 animate-pulse">
                {t("generating")}
              </p>
            </motion.div>
          )}

          {/* RESULT */}
          {step === "RESULT" && croppedUrl && resultImageUrl && (
            <motion.div
              key="step-result"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", type: "spring", bounce: 0.3 }}
              className="w-full flex flex-col gap-6"
            >
              {/* Result header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel px-6 py-4 rounded-2xl w-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                    <Sparkles className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">{t("result")}</h2>
                    <p className="text-sm text-zinc-500">
                      {t("regionsFound", { count: regions.length })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                  <button
                    onClick={() => {
                      setResultImageUrl(null);
                      setShareHash(null);
                      setErrorMsg(null);
                      setStep("ASSIGN");
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors text-sm"
                  >
                    <RefreshCw className="w-4 h-4" /> {t("reassign")}
                  </button>
                  <button
                    onClick={handleShare}
                    disabled={!shareHash}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors text-sm disabled:opacity-50"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold shadow-sm transition-all text-sm"
                  >
                    <Download className="w-4 h-4" /> {t("download")}
                  </button>
                </div>
              </div>

              {/* Assigned fabrics summary strip */}
              <div className="glass-panel rounded-2xl p-4">
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {regions
                    .filter((r) => assignments[r.id] !== null)
                    .map((region) => {
                      const fabric = assignments[region.id]!;
                      return (
                        <div
                          key={region.id}
                          className="flex flex-col items-center gap-1.5 shrink-0"
                        >
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-zinc-200">
                            <Image
                              src={microUrl(fabric.image)}
                              alt={fabric.color}
                              fill
                              className="object-cover"
                              unoptimized
                              sizes="48px"
                            />
                          </div>
                          <span className="text-[10px] text-zinc-500 max-w-[60px] text-center truncate">
                            {region.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Before / After slider */}
              <div className="w-full flex justify-center pb-6">
                <BeforeAfterSlider
                  beforeImage={croppedUrl}
                  afterImage={resultImageUrl}
                />
              </div>

              {/* Start over */}
              <div className="flex justify-center pb-12">
                <button
                  onClick={resetFlow}
                  className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors underline underline-offset-4"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                  {t("startOver")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fabric Selector Modal (for region assignment) */}
      <AnimatePresence>
        {activeFabricRegion !== null && (
          <motion.div
            key="fabric-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={() => setActiveFabricRegion(null)}
          >
            <motion.div
              key="fabric-modal-panel"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    {t("assignFabric")}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {(() => {
                      const r = regions.find((r) => r.id === activeFabricRegion);
                      return r ? (locale === "zh" && r.label_zh ? r.label_zh : r.label) : "";
                    })()}
                  </p>
                </div>
                <button
                  onClick={() => setActiveFabricRegion(null)}
                  className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Fabric selector */}
              <div className="flex-1 overflow-y-auto p-4">
                <FabricSelector
                  selectedFabric={
                    activeFabricRegion !== null
                      ? assignments[activeFabricRegion] ?? null
                      : null
                  }
                  onSelect={(fabric: Fabric) => {
                    if (activeFabricRegion !== null) {
                      setAssignments((prev) => ({
                        ...prev,
                        [activeFabricRegion]: fabric,
                      }));
                      setActiveFabricRegion(null);
                    }
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {shareModalData && (
          <ShareModal
            shareUrl={shareModalData.shareUrl}
            generation={shareModalData.generation}
            onClose={() => setShareModalData(null)}
          />
        )}
      </AnimatePresence>

    </main>
  );
}
