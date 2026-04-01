"use client";

import React from "react";
import { Loader2, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import ModeSelector, { type GenerationMode } from "../ModeSelector";
import FurnitureTypeSelector from "../FurnitureTypeSelector";
import DimensionInput from "../DimensionInput";
import ImageUploadSlots, { type UploadImage } from "../ImageUploadSlots";
import { MODEL3D_CREDIT_COST } from "@/lib/model3d-constants";
import type { FurnitureType } from "@/lib/model3d-prompts";

interface WizardStepSetupProps {
  mode: GenerationMode;
  onModeChange: (m: GenerationMode) => void;
  furnitureType: FurnitureType | undefined;
  onFurnitureTypeChange: (t: FurnitureType | undefined) => void;
  dimensions: { width: number; depth: number; height: number };
  onDimensionsChange: (d: { width: number; depth: number; height: number }) => void;
  images: { slot1?: UploadImage; slot2?: UploadImage };
  onImagesChange: (imgs: { slot1?: UploadImage; slot2?: UploadImage }) => void;
  userCredits: number;
  canProceed: boolean;
  loading: boolean;
  onStartDetect: () => void;
}

export default function WizardStepSetup({
  mode,
  onModeChange,
  furnitureType,
  onFurnitureTypeChange,
  dimensions,
  onDimensionsChange,
  images,
  onImagesChange,
  userCredits,
  canProceed,
  loading,
  onStartDetect,
}: WizardStepSetupProps) {
  const t = useTranslations("Viewer");

  return (
    <motion.div
      key="setup"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]"
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{t("wizard.selectModeTitle")}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {t("wizard.selectModeDesc")}
            </p>
          </div>
          <ModeSelector
            value={mode}
            onChange={onModeChange}
            quickCredits={MODEL3D_CREDIT_COST.quick}
            precisionCredits={MODEL3D_CREDIT_COST.precision}
          />
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{t("wizard.furnitureTypeTitle")}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {t("wizard.furnitureTypeDesc")}
            </p>
          </div>
          <FurnitureTypeSelector value={furnitureType} onChange={onFurnitureTypeChange} />
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{t("wizard.uploadViewTitle")}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {mode === "precision"
                ? t("wizard.uploadViewDescPrecision")
                : t("wizard.uploadViewDescQuick")}
            </p>
          </div>
          <ImageUploadSlots mode={mode} images={images} onChange={onImagesChange} />
        </section>
      </div>

      <aside className="space-y-6 rounded-3xl border border-zinc-200/80 bg-zinc-50/50 p-6 shadow-sm">
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{t("wizard.physicalDimensions")}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {t("wizard.physicalDimensionsDesc")}
            </p>
          </div>
          <DimensionInput value={dimensions} onChange={onDimensionsChange} />
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-zinc-600">
            <span className="font-medium">{t("wizard.creditDeduction")}</span>
            <span className="flex items-center gap-1.5 font-bold text-zinc-900">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-lg">{MODEL3D_CREDIT_COST[mode]}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>{t("wizard.currentBalance")}</span>
            <span className="font-medium text-zinc-900">
              <Zap className="inline h-3.5 w-3.5 text-amber-500" /> {userCredits}
            </span>
          </div>
          <div className="w-full h-px bg-zinc-100" />
          <div className="text-[11px] leading-5 text-zinc-500">
            {mode === "precision"
              ? t("wizard.precisionHint")
              : t("wizard.quickHint")}
          </div>
        </section>

        <button
          type="button"
          onClick={onStartDetect}
          disabled={!canProceed || loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-zinc-900/20 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {t("wizard.goSelectFurniture")}
        </button>
      </aside>
    </motion.div>
  );
}
