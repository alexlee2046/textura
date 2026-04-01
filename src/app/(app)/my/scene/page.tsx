// src/app/scene/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

import { Download, RotateCcw, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";

import { postShareToMiniProgram } from "@/lib/miniProgramShare";

import ProductUploader, { ProductEntry, makeEmptyProduct } from "@/features/scene/ProductUploader";
import SceneSetup, { SceneParams, defaultSceneParams, GenerationMode } from "@/features/scene/SceneSetup";
import dynamic from "next/dynamic";
import type { PlacedProduct } from "@/features/scene/LayoutEditor";
const LayoutEditor = dynamic(() => import("@/features/scene/LayoutEditor"), {
  ssr: false,
  loading: () => <div className="w-full aspect-square bg-zinc-100 rounded-2xl animate-pulse" />,
});
import { compositeOnRoom, ProductForComposite } from "@/lib/sceneComposite";

const MODE_CREDITS: Record<GenerationMode, number> = {
  "gemini-direct": 2,
  "gemini-3.1-direct": 4,
  "flux-gemini": 5,
};

type WizardStep = 1 | 2 | 3 | 4 | 5;

function buildLayoutDesc(placements: PlacedProduct[], products: ProductEntry[]): string {
  return placements.map((pl) => {
    const prod = products.find((p) => p.id === pl.id);
    const name = pl.name || prod?.name || "item";
    const side = pl.fx < 0.33 ? "left" : pl.fx > 0.66 ? "right" : "center";
    const depth = pl.fy < 0.33 ? "front" : pl.fy > 0.66 ? "back" : "middle";
    return `- ${name}: ${side} ${depth} of room${pl.rotation ? `, rotated ${pl.rotation}°` : ""}`;
  }).join("\n");
}

export default function ScenePage() {
  const t = useTranslations("ScenePage");
  const { user } = useUser();

  const [step, setStep] = useState<WizardStep>(1);
  const [products, setProducts] = useState<ProductEntry[]>([makeEmptyProduct()]);
  const [sceneParams, setSceneParams] = useState<SceneParams>(defaultSceneParams);
  const [placements, setPlacements] = useState<PlacedProduct[]>([]);
  const [progressMsg, setProgressMsg] = useState("");
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const readyProducts = products.filter((p) => p.file !== null);

  const canProceed =
    step === 1 ? readyProducts.length > 0 :
    step === 2 ? !!(sceneParams.roomType && sceneParams.style) :
    step === 3 ? placements.length > 0 :
    false;

  // Fetch credits on login
  useEffect(() => {
    if (!user?.id) return;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => { if (typeof d.credits === "number") setCredits(d.credits); })
      .catch(() => {});
  }, [user?.id]);

  const handleGenerate = async () => {
    setStep(4);
    setErrorMsg(null);
    try {
      if (sceneParams.mode === "gemini-direct" || sceneParams.mode === "gemini-3.1-direct") {
        await runGeminiDirect();
      } else {
        await runFluxGemini();
      }
    } catch (err: unknown) {
      setErrorMsg(`${t("errorPrefix")}${err instanceof Error ? err.message : "Generation failed"}`);
      setStep(3);
    }
  };

  const runGeminiDirect = async () => {
    setProgressMsg(t("generatingDirect"));
    const form = new FormData();
    if (sceneParams.mode === "gemini-3.1-direct") {
      form.append("geminiModel", "google/gemini-3.1-flash-image-preview");
    }
    const productMeta = readyProducts.map((p) => ({ name: p.name, width: p.width, depth: p.depth, height: p.height }));
    form.append("productMeta", JSON.stringify(productMeta));
    form.append("sceneParams", JSON.stringify({
      roomType: sceneParams.roomType, style: sceneParams.style,
      colorPalette: sceneParams.colorPalette, lighting: sceneParams.lighting,
      roomWidthM: sceneParams.roomWidthM, roomDepthM: sceneParams.roomDepthM,
    }));
    form.append("layoutDesc", buildLayoutDesc(placements, products));
    for (const p of readyProducts) { if (p.file) form.append("products", p.file); }

    const res = await fetch("/api/scene/direct", { method: "POST", body: form });
    if (res.status === 402) throw new Error(t("insufficientCredits"));
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    const { imageUrl, creditsRemaining, shareHash } = await res.json() as { imageUrl: string; creditsRemaining: number; shareHash?: string };
    setResultImageUrl(imageUrl);
    if (typeof creditsRemaining === "number") setCredits(creditsRemaining);
    if (shareHash) {
      postShareToMiniProgram({ title: "看看 AI 帮我做的家居场景效果", shareHash });
    }
    setStep(5);
  };

  const runFluxGemini = async () => {
    setProgressMsg(t("generatingRoom"));
    const bgRes = await fetch("/api/scene/background", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomType: sceneParams.roomType, style: sceneParams.style,
        colorPalette: sceneParams.colorPalette, lighting: sceneParams.lighting,
        roomWidthM: sceneParams.roomWidthM, roomDepthM: sceneParams.roomDepthM,
      }),
    });
    if (bgRes.status === 402) throw new Error(t("insufficientCredits"));
    if (!bgRes.ok) { const d = await bgRes.json(); throw new Error(d.error); }
    const { roomBackground } = await bgRes.json() as { roomBackground: string };

    setProgressMsg(t("generatingComposite"));
    const productLayouts: ProductForComposite[] = readyProducts
      .map((p): ProductForComposite | null => {
        const pl = placements.find((x) => x.id === p.id);
        if (!pl || !p.previewUrl) return null;
        return {
          id: p.id,
          imageUrl: p.previewUrl,
          bgRemovedUrl: null,
          fx: pl.fx, fy: pl.fy, rotation: pl.rotation,
          realWidth: p.width, realDepth: p.depth, realHeight: p.height,
        };
      })
      .filter((x): x is ProductForComposite => x !== null);

    const compositeBlob = await compositeOnRoom(roomBackground, productLayouts, sceneParams.roomWidthM * 100);

    setProgressMsg(t("generatingEnhance"));
    const form = new FormData();
    form.append("composite", new File([compositeBlob], "composite.jpg", { type: "image/jpeg" }));
    for (const p of readyProducts) { if (p.file) form.append("products", p.file); }
    form.append("sceneDescription", `${sceneParams.style} ${sceneParams.roomType}, ${sceneParams.lighting} lighting`);

    const enhRes = await fetch("/api/scene/enhance", { method: "POST", body: form });
    if (enhRes.status === 402) throw new Error(t("insufficientCredits"));
    if (!enhRes.ok) { const d = await enhRes.json(); throw new Error(d.error); }
    const { imageUrl, creditsRemaining, shareHash } = await enhRes.json() as { imageUrl: string; creditsRemaining: number; shareHash?: string };
    setResultImageUrl(imageUrl);
    if (typeof creditsRemaining === "number") setCredits(creditsRemaining);
    if (shareHash) {
      postShareToMiniProgram({ title: "看看 AI 帮我做的家居场景效果", shareHash });
    }
    setStep(5);
  };

  const resetAll = () => {
    setStep(1); setProducts([makeEmptyProduct()]); setSceneParams(defaultSceneParams);
    setPlacements([]); setResultImageUrl(null); setErrorMsg(null); setProgressMsg("");
  };

  const handleDownload = () => {
    if (!resultImageUrl) return;
    const a = document.createElement("a"); a.href = resultImageUrl;
    a.download = `scene_${Date.now()}.jpg`; a.click();
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center pt-20 pb-6 px-4 sm:px-6 lg:px-8 overflow-x-hidden text-zinc-900 z-0">
      <div className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#f5f5f7]">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-100/60 blur-[130px] rounded-full opacity-70 animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-100/40 blur-[150px] rounded-full opacity-60" />
      </div>

      <div className="w-full max-w-3xl flex flex-col items-center z-10 space-y-5">
        <header className="text-center w-full space-y-1.5">
          <motion.h1 initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight inline-flex items-center gap-3"
          >
            <Sparkles className="w-9 h-9 text-zinc-600 shrink-0" />
            <span className="text-gradient">{t("title")}</span>
          </motion.h1>
          <p className="text-base text-zinc-500">{t("subtitle")}</p>
        </header>

        {(step === 1 || step === 2 || step === 3) && (
          <div className="flex items-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === s ? "bg-zinc-900 text-white scale-110" : step > s ? "bg-green-500 text-white" : "bg-zinc-100 text-zinc-400"
                }`}>
                  {step > s ? "✓" : s}
                </div>
                {s < 3 && <div className={`w-10 h-0.5 transition-colors ${step > s ? "bg-green-400" : "bg-zinc-200"}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        <AnimatePresence>
          {errorMsg && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-6 py-3 rounded-full bg-red-50 border border-red-200 text-red-600 text-sm"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <StepCard key="s1" title={`1. ${t("step1Label")}`}>
              <ProductUploader products={products} onChange={setProducts} />
            </StepCard>
          )}

          {step === 2 && (
            <StepCard key="s2" title={`2. ${t("step2Label")}`}>
              <SceneSetup params={sceneParams} onChange={setSceneParams} />
            </StepCard>
          )}

          {step === 3 && (
            <StepCard key="s3" title={`3. ${t("step3Label")}`}>
              <LayoutEditor
                products={products}
                placements={placements}
                onPlacementsChange={setPlacements}
                roomWidthM={sceneParams.roomWidthM}
                roomDepthM={sceneParams.roomDepthM}
              />
              <p className="text-xs text-center text-zinc-400">{t("creditsCost", { count: MODE_CREDITS[sceneParams.mode] })}</p>
            </StepCard>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="w-full flex flex-col items-center gap-6 py-20"
            >
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-t-2 border-zinc-400 rounded-full animate-spin" />
                <div className="absolute inset-2 border-r-2 border-blue-400 rounded-full animate-spin opacity-70"
                  style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
              </div>
              <p className="text-lg font-bold text-zinc-700 animate-pulse">{progressMsg}</p>
              <p className="text-sm text-zinc-400 mt-2">通常需要 10-20 秒</p>
            </motion.div>
          )}

          {step === 5 && resultImageUrl && (
            <motion.div key="s5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="w-full flex flex-col gap-5"
            >
              <div className="glass-panel rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                    <Sparkles className="w-4 h-4 text-green-500" />
                  </div>
                  <span className="font-bold text-zinc-900">{t("step3Label")} ✓</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={resetAll}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors text-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> {t("startOver")}
                  </button>
                  <button onClick={handleDownload}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold text-sm shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> {t("download")}
                  </button>
                </div>
              </div>
              {/* Product reference strip */}
              <div className="glass-panel rounded-2xl p-4">
                <p className="text-xs font-semibold text-zinc-400 mb-3 px-1">{t("productsUsed")}</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {readyProducts.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => setLightboxUrl(p.previewUrl)}
                      className="flex flex-col items-center gap-1.5 shrink-0 group"
                    >
                      <div className="w-32 h-32 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 group-hover:border-zinc-400 transition-colors">
                        <img src={p.previewUrl!} alt={p.name || "product"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      </div>
                      <span className="text-xs text-zinc-500 max-w-[128px] text-center truncate">
                        {p.name || `P${i + 1}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full rounded-3xl overflow-hidden glass-panel">
                <img src={resultImageUrl} alt="Generated scene" className="w-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(step === 1 || step === 2 || step === 3) && (
          <div className="flex justify-between w-full">
            <button
              onClick={() => step > 1 && setStep((s) => (s - 1) as WizardStep)}
              disabled={step === 1}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors disabled:opacity-30 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> {t("back")}
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as WizardStep)}
                disabled={!canProceed}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold shadow-sm transition-all disabled:opacity-30 text-sm"
              >
                {t("next")} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!canProceed}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold shadow-sm transition-all disabled:opacity-30 text-sm"
              >
                <Sparkles className="w-4 h-4" /> {t("generateBtn")}
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              src={lightboxUrl} alt="product"
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}
      className="w-full glass-panel rounded-3xl p-6 flex flex-col gap-4"
    >
      <h2 className="text-lg font-bold text-zinc-800">{title}</h2>
      {children}
    </motion.div>
  );
}
