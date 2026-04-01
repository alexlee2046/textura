import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useTranslations } from "next-intl";
import type { GenerationMode } from "../ModeSelector";
import type { UploadImage } from "../ImageUploadSlots";
import type { FurnitureType } from "@/lib/model3d-prompts";
import type { Model3DRegion } from "@/lib/model3d-schemas";
import {
  toWizardStatus,
  type EnhanceResponse,
  type GenerateResponse,
  type Model3DGenerationState,
  type Model3DWizardProps,
  type StatusResponse,
  type WizardStatus,
  type WizardStep,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3000;

// ---------------------------------------------------------------------------
// Utilities (internal)
// ---------------------------------------------------------------------------

async function readError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function cropImage(
  file: File,
  box: [number, number, number, number],
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Gemini boxes are [ymin, xmin, ymax, xmax] in 0-1000
      const [ymin, xmin, ymax, xmax] = box;
      let x = (xmin / 1000) * img.width;
      let y = (ymin / 1000) * img.height;
      let w = ((xmax - xmin) / 1000) * img.width;
      let h = ((ymax - ymin) / 1000) * img.height;

      // Add 15% padding
      const padW = w * 0.15;
      const padH = h * 0.15;
      x = Math.max(0, x - padW);
      y = Math.max(0, y - padH);
      w = Math.min(img.width - x, w + padW * 2);
      h = Math.min(img.height - y, h + padH * 2);

      if (w < 1 || h < 1) {
        URL.revokeObjectURL(img.src);
        reject(new Error("Detected region too small to crop"));
        return;
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) {
            resolve(
              new File([blob], "cropped-target.jpg", { type: "image/jpeg" }),
            );
          } else {
            reject(new Error("Canvas toBlob failed"));
          }
        },
        "image/jpeg",
        0.9,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image for cropping"));
    };
    img.src = URL.createObjectURL(file);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useModel3DGeneration({
  onClose: _onClose,
  onModelLoaded,
  onCreditsChange,
  onRefreshCredits,
}: Omit<Model3DWizardProps, "userCredits">): Model3DGenerationState {
  const t = useTranslations("Viewer");

  // --- core state ---
  const [step, setStep] = useState<WizardStep>("setup");
  const [mode, setMode] = useState<GenerationMode>("quick");
  const [furnitureType, setFurnitureType] = useState<FurnitureType>();
  const [dimensions, setDimensions] = useState({
    width: 800,
    depth: 600,
    height: 900,
  });
  const [images, setImages] = useState<{
    slot1?: UploadImage;
    slot2?: UploadImage;
  }>({});

  const [generationId, setGenerationId] = useState<string>();
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string>();
  const [enhancedImage2Url, setEnhancedImage2Url] = useState<string>();
  const [enhanceCount, setEnhanceCount] = useState(0);
  const [inputImageUrl, setInputImageUrl] = useState<string>();

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<WizardStatus>("queued");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [optimizingLabel, setOptimizingLabel] = useState(t("wizard.optimizingMainView"));
  const [checkingActive, setCheckingActive] = useState(true);

  // Detection states
  const [detectedRegions, setDetectedRegions] = useState<Model3DRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const pollTimeoutRef = useRef<number | null>(null);

  // Stable refs for callbacks — prevents pollStatus/checkActive from
  // re-creating on parent re-render
  const onCreditsChangeRef = useRef(onCreditsChange);
  const onModelLoadedRef = useRef(onModelLoaded);
  const onRefreshCreditsRef = useRef(onRefreshCredits);
  useEffect(() => {
    onCreditsChangeRef.current = onCreditsChange;
  }, [onCreditsChange]);
  useEffect(() => {
    onModelLoadedRef.current = onModelLoaded;
  }, [onModelLoaded]);
  useEffect(() => {
    onRefreshCreditsRef.current = onRefreshCredits;
  }, [onRefreshCredits]);

  // Store a stable ref to t so pollStatus doesn't recreate
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const applyCredits = useCallback((nextCredits?: number | null) => {
    if (typeof nextCredits === "number") {
      onCreditsChangeRef.current?.(nextCredits);
    }
  }, []);

  // --- cleanup poll timeout ---
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  // --- revoke object URLs when images change ---
  const prevUrlsRef = useRef<{ slot1?: string; slot2?: string }>({});
  useEffect(() => {
    const prev = prevUrlsRef.current;
    const curr = {
      slot1: images.slot1?.previewUrl,
      slot2: images.slot2?.previewUrl,
    };

    // Revoke only URLs that were replaced (no longer displayed)
    if (prev.slot1 && prev.slot1 !== curr.slot1) URL.revokeObjectURL(prev.slot1);
    if (prev.slot2 && prev.slot2 !== curr.slot2) URL.revokeObjectURL(prev.slot2);
    prevUrlsRef.current = curr;

    return () => {
      if (curr.slot1) URL.revokeObjectURL(curr.slot1);
      if (curr.slot2) URL.revokeObjectURL(curr.slot2);
    };
  }, [images]);

  // --- derived ---
  const canProceed = !!images.slot1 && (mode === "quick" || !!images.slot2);

  // --- pollStatus ---
  const pollStatus = useCallback(
    async (gid: string) => {
      try {
        const response = await fetch(`/api/model3d/status/${gid}`);
        if (!response.ok)
          throw new Error(await readError(response, tRef.current("statusQueryFailed")));
        const data = (await response.json()) as StatusResponse;

        setStatus(toWizardStatus(data.status));
        setProgress(data.progress ?? 0);
        applyCredits(data.creditsRemaining);

        if (data.status === "completed" && data.modelUrl) {
          const fileResponse = await fetch(data.modelUrl);
          if (!fileResponse.ok) throw new Error(tRef.current("modelDownloadFailed"));
          const blob = await fileResponse.blob();
          const file = new File([blob], "model.glb", {
            type: "model/gltf-binary",
          });
          setStatus("completed");
          setLoading(false);
          onModelLoadedRef.current(file, gid);
          return;
        }

        if (data.status === "failed" || data.status === "refunded") {
          setError(
            data.error ??
              (data.status === "refunded"
                ? tRef.current("generationFailedRefunded")
                : tRef.current("generationFailed")),
          );
          setStep("review");
          setLoading(false);
          if (typeof data.creditsRemaining !== "number") {
            void onRefreshCreditsRef.current?.();
          }
          return;
        }

        pollTimeoutRef.current = window.setTimeout(() => {
          void pollStatus(gid);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        setError(err instanceof Error ? err.message : tRef.current("statusQueryFailed"));
        setStep("review");
        setLoading(false);
        void onRefreshCreditsRef.current?.();
      }
    },
    [applyCredits],
  );

  // --- resume active generation on mount ---
  useEffect(() => {
    async function checkActive() {
      try {
        const res = await fetch("/api/model3d/active");
        if (res.ok) {
          const data = await res.json();
          if (data.active) {
            const active = data.active;
            setGenerationId(active.id);
            setMode(active.mode as GenerationMode);
            setFurnitureType(active.furnitureType as FurnitureType);
            if (active.dimensions && typeof active.dimensions === "object") {
              const d = active.dimensions as {
                width?: number;
                depth?: number;
                height?: number;
              };
              setDimensions({
                width: d.width ?? 800,
                depth: d.depth ?? 600,
                height: d.height ?? 900,
              });
            }
            setEnhancedImageUrl(active.enhancedImageUrl || undefined);
            setEnhancedImage2Url(active.enhancedImage2Url || undefined);
            setEnhanceCount(active.enhanceCount || 0);
            setInputImageUrl(active.inputImageUrl || undefined);

            if (active.status === "enhancing") {
              setStep("review");
            } else {
              setStep("generating");
              setStatus(toWizardStatus(active.status));
              setProgress(0);
              pollStatus(active.id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch active 3d generation", err);
      } finally {
        setCheckingActive(false);
      }
    }
    checkActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pollStatus is stable via refs, mount-only
  }, []);

  // --- actions ---

  const handleStartDetect = async () => {
    if (!images.slot1?.file) return;

    setError(undefined);
    setLoading(true);
    setStep("detecting");

    try {
      const form = new FormData();
      form.append("image", images.slot1.file);

      const resp = await fetch("/api/model3d/detect", {
        method: "POST",
        body: form,
      });
      if (!resp.ok) throw new Error(await readError(resp, t("detectFailed")));
      const data = await resp.json();

      const regions = data.regions || [];
      if (regions.length === 0) {
        setError(t("noFurnitureDetected"));
        setStep("setup");
        return;
      }
      setDetectedRegions(regions);
      setStep("selecting");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detectError"));
      setStep("setup");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEnhance = async () => {
    if (!images.slot1?.file) return;

    const selectedRegion = detectedRegions.find(
      (r) => r.id === selectedRegionId,
    );
    // If we have a selection, use the suggested type if none selected manually
    const finalType =
      furnitureType || selectedRegion?.furnitureType || "mixed";

    setError(undefined);
    setLoading(true);
    setStep("enhancing");
    setOptimizingLabel(t("wizard.optimizingMainView"));

    try {
      // Use cropped image if we have a selection
      let mainFile = images.slot1.file;
      if (selectedRegion) {
        setOptimizingLabel(t("wizard.croppingTarget"));
        mainFile = await cropImage(images.slot1.file, selectedRegion.box_2d);
      }

      const form1 = new FormData();
      form1.append("image", mainFile);
      form1.append("width", dimensions.width.toString());
      form1.append("depth", dimensions.depth.toString());
      form1.append("height", dimensions.height.toString());
      form1.append("furnitureType", finalType);
      form1.append("mode", mode);
      form1.append("viewIndex", "1");

      const resp1 = await fetch("/api/model3d/enhance", {
        method: "POST",
        body: form1,
      });
      if (!resp1.ok) throw new Error(await readError(resp1, t("enhanceFailed")));
      const data1 = (await resp1.json()) as EnhanceResponse;

      setGenerationId(data1.generationId);
      setEnhancedImageUrl(data1.imageUrl);
      setEnhanceCount(data1.enhanceCount);
      applyCredits(data1.creditsRemaining);

      if (mode === "precision" && images.slot2?.file) {
        setOptimizingLabel(t("wizard.optimizingRearView"));

        const form2 = new FormData();
        form2.append("image", images.slot2.file);
        form2.append("width", dimensions.width.toString());
        form2.append("depth", dimensions.depth.toString());
        form2.append("height", dimensions.height.toString());
        form2.append("furnitureType", finalType);
        form2.append("mode", mode);
        form2.append("viewIndex", "2");
        form2.append("generationId", data1.generationId);

        const resp2 = await fetch("/api/model3d/enhance", {
          method: "POST",
          body: form2,
        });
        if (!resp2.ok)
          throw new Error(await readError(resp2, t("enhanceView2Failed")));
        const data2 = (await resp2.json()) as EnhanceResponse;

        setEnhancedImage2Url(data2.imageUrl);
        setEnhanceCount(data2.enhanceCount);
        applyCredits(data2.creditsRemaining);
      }

      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("enhanceError"));
      setStep("setup");
    } finally {
      setLoading(false);
    }
  };

  const handleRetryEnhance = async (
    viewIndex: 1 | 2,
    feedback?: string,
  ) => {
    if (!generationId || !furnitureType) return;

    let targetImage: File | undefined =
      viewIndex === 1 ? images.slot1?.file : images.slot2?.file;

    // If original File object was lost (page refresh / restore from DB),
    // download from COS
    if (!targetImage && inputImageUrl) {
      try {
        const resp = await fetch(inputImageUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          targetImage = new File([blob], "restored-input.webp", {
            type: blob.type || "image/webp",
          });
        }
      } catch {
        // fallthrough — will hit early return below
      }
    }

    const previousImageUrl =
      viewIndex === 1 ? enhancedImageUrl : enhancedImage2Url;
    if (!targetImage || !previousImageUrl) return;

    setError(undefined);
    setLoading(true);

    try {
      const form = new FormData();
      form.append("image", targetImage);
      form.append("width", dimensions.width.toString());
      form.append("depth", dimensions.depth.toString());
      form.append("height", dimensions.height.toString());
      form.append("furnitureType", furnitureType);
      form.append("mode", mode);
      form.append("viewIndex", String(viewIndex));
      form.append("generationId", generationId);
      form.append("previousImageUrl", previousImageUrl);
      if (feedback) {
        form.append("feedback", feedback);
      }

      const response = await fetch("/api/model3d/enhance", {
        method: "POST",
        body: form,
      });
      if (!response.ok)
        throw new Error(await readError(response, t("retryEnhanceFailed")));
      const data = (await response.json()) as EnhanceResponse;

      if (viewIndex === 1) {
        setEnhancedImageUrl(data.imageUrl);
      } else {
        setEnhancedImage2Url(data.imageUrl);
      }

      setEnhanceCount(data.enhanceCount);
      applyCredits(data.creditsRemaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("retryEnhanceFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!generationId) return;

    setError(undefined);
    setLoading(true);
    setStep("generating");
    setStatus("queued");
    setProgress(0);

    try {
      const response = await fetch("/api/model3d/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          idempotencyKey: nanoid(21),
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, t("submitTaskFailed")));
      }

      const data = (await response.json()) as GenerateResponse;
      applyCredits(data.creditsRemaining);
      setStatus(toWizardStatus(data.status));
      void pollStatus(generationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitFailed"));
      setStep("review");
      setLoading(false);
      void onRefreshCredits?.();
    }
  };

  return {
    step,
    status,
    loading,
    checkingActive,
    error,
    optimizingLabel,

    mode,
    setMode,
    furnitureType,
    setFurnitureType,
    dimensions,
    setDimensions,
    images,
    setImages,

    detectedRegions,
    selectedRegionId,
    setSelectedRegionId,
    setStep,

    generationId,
    enhancedImageUrl,
    enhancedImage2Url,
    enhanceCount,
    progress,

    canProceed,

    handleStartDetect,
    handleStartEnhance,
    handleRetryEnhance,
    handleConfirmGenerate,
  };
}
