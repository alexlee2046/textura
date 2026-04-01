"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles, X, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import EnhancedImagePreview from "./EnhancedImagePreview";
import GenerationProgress from "./GenerationProgress";
import { MODEL3D_CREDIT_COST, MODEL3D_FREE_ENHANCE_LIMIT } from "@/lib/model3d-constants";
import { useModel3DGeneration } from "./wizard/useModel3DGeneration";
import WizardStepSetup from "./wizard/WizardStepSetup";
import WizardStepSelecting from "./wizard/WizardStepSelecting";
import type { Model3DWizardProps, WizardStep } from "./wizard/types";

export type { WizardStep };
export type { WizardStatus } from "./wizard/types";

const STEP_BADGE_KEYS: { key: WizardStep; labelKey: string }[] = [
  { key: "setup", labelKey: "wizard.stepSetup" },
  { key: "detecting", labelKey: "wizard.stepDetecting" },
  { key: "selecting", labelKey: "wizard.stepSelecting" },
  { key: "enhancing", labelKey: "wizard.stepEnhancing" },
  { key: "review", labelKey: "wizard.stepReview" },
  { key: "generating", labelKey: "wizard.stepGenerating" },
];

const stepOrder: Record<WizardStep, number> = {
  setup: 0,
  detecting: 1,
  selecting: 2,
  enhancing: 3,
  review: 4,
  generating: 5,
};

export default function Model3DWizard({
  userCredits,
  onClose,
  onModelLoaded,
  onCreditsChange,
  onRefreshCredits,
}: Model3DWizardProps) {
  const gen = useModel3DGeneration({
    onClose,
    onModelLoaded,
    onCreditsChange,
    onRefreshCredits,
  });
  const t = useTranslations("Viewer");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/88 shadow-2xl backdrop-blur-xl"
      >
        {/* ---- Header ---- */}
        <div className="border-b border-zinc-200/80 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-500">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em]">
                  3D Generation
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                  {t("wizard.headerTitle")}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {t("wizard.headerSubtitle")}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-500 sm:inline-flex sm:items-center sm:gap-1.5 shadow-sm">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                {userCredits}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-zinc-100 p-2.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ---- Step badges ---- */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {STEP_BADGE_KEYS.map((badge, index) => {
              const isActive = gen.step === badge.key;
              const isDone = stepOrder[gen.step] > index;
              return (
                <div key={badge.key} className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-900 text-white shadow"
                        : isDone
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-sm font-medium transition-colors ${
                      isActive ? "text-zinc-900" : isDone ? "text-zinc-900" : "text-zinc-400"
                    }`}
                  >
                    {t(badge.labelKey)}
                  </span>
                  {index < STEP_BADGE_KEYS.length - 1 && (
                    <div className={`ml-1 h-px w-6 sm:w-8 ${isDone ? "bg-zinc-300" : "bg-zinc-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Body ---- */}
        <div className="overflow-y-auto px-6 py-6">
          {gen.checkingActive ? (
            <div className="flex justify-center items-center py-24 min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : (
            <>
              <AnimatePresence mode="wait" initial={false}>
                {gen.step === "setup" && (
                  <WizardStepSetup
                    mode={gen.mode}
                    onModeChange={gen.setMode}
                    furnitureType={gen.furnitureType}
                    onFurnitureTypeChange={gen.setFurnitureType}
                    dimensions={gen.dimensions}
                    onDimensionsChange={gen.setDimensions}
                    images={gen.images}
                    onImagesChange={gen.setImages}
                    userCredits={userCredits}
                    canProceed={gen.canProceed}
                    loading={gen.loading}
                    onStartDetect={gen.handleStartDetect}
                  />
                )}

                {gen.step === "detecting" && (
                  <motion.div
                    key="detecting"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex min-h-[24rem] flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50/70 px-6 py-10 text-center"
                  >
                    <div className="relative mb-6 h-20 w-20">
                      <div className="absolute inset-0 rounded-full border-2 border-zinc-200" />
                      <div className="absolute inset-0 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="h-7 w-7 text-zinc-600" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-zinc-900">{t("wizard.detectingTitle")}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                      {t("wizard.detectingSubtitle")}
                    </p>
                  </motion.div>
                )}

                {gen.step === "selecting" && (
                  <WizardStepSelecting
                    previewUrl={gen.images.slot1?.previewUrl}
                    detectedRegions={gen.detectedRegions}
                    selectedRegionId={gen.selectedRegionId}
                    onSelectRegion={(id) => {
                      gen.setSelectedRegionId(id);
                      const region = gen.detectedRegions.find((r) => r.id === id);
                      if (region) {
                        gen.setFurnitureType(region.furnitureType as import("@/lib/model3d-prompts").FurnitureType);
                      }
                    }}
                    furnitureType={gen.furnitureType}
                    onFurnitureTypeChange={gen.setFurnitureType}
                    loading={gen.loading}
                    onStartEnhance={gen.handleStartEnhance}
                    onBack={() => gen.setStep("setup")}
                  />
                )}

                {gen.step === "enhancing" && (
                  <motion.div
                    key="enhancing"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex min-h-[24rem] flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50/70 px-6 py-10 text-center"
                  >
                    <div className="relative mb-6 h-20 w-20">
                      <div className="absolute inset-0 rounded-full border-2 border-zinc-200" />
                      <div className="absolute inset-0 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="h-7 w-7 text-zinc-600" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-zinc-900">{gen.optimizingLabel}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                      {t("wizard.enhancingSubtitle")}
                    </p>
                  </motion.div>
                )}

                {gen.step === "review" && gen.enhancedImageUrl && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <EnhancedImagePreview
                      mode={gen.mode}
                      imageUrl={gen.enhancedImageUrl}
                      imageUrl2={gen.enhancedImage2Url}
                      enhanceCount={gen.enhanceCount}
                      freeLimit={MODEL3D_FREE_ENHANCE_LIMIT[gen.mode]}
                      creditCost={MODEL3D_CREDIT_COST[gen.mode]}
                      userCredits={userCredits}
                      onRetry={gen.handleRetryEnhance}
                      onConfirm={gen.handleConfirmGenerate}
                      loading={gen.loading}
                    />
                  </motion.div>
                )}

                {gen.step === "generating" && (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-3xl border border-zinc-200 bg-zinc-50/70 px-6 py-8"
                  >
                    <GenerationProgress status={gen.status} progress={gen.progress} error={gen.error} />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {gen.error && gen.step !== "generating" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                  >
                    {gen.error}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
