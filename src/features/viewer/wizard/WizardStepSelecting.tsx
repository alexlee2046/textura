"use client";

import React from "react";
import { Loader2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import FurnitureTypeSelector from "../FurnitureTypeSelector";
import type { Model3DRegion } from "@/lib/model3d-schemas";
import type { FurnitureType } from "@/lib/model3d-prompts";

interface WizardStepSelectingProps {
  previewUrl: string | undefined;
  detectedRegions: Model3DRegion[];
  selectedRegionId: string | null;
  onSelectRegion: (id: string) => void;
  furnitureType: FurnitureType | undefined;
  onFurnitureTypeChange: (t: FurnitureType | undefined) => void;
  loading: boolean;
  onStartEnhance: () => void;
  onBack: () => void;
}

export default function WizardStepSelecting({
  previewUrl,
  detectedRegions,
  selectedRegionId,
  onSelectRegion,
  furnitureType,
  onFurnitureTypeChange,
  loading,
  onStartEnhance,
  onBack,
}: WizardStepSelectingProps) {
  const t = useTranslations("Viewer");

  return (
    <motion.div
      key="selecting"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col gap-6"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 bg-black">
          {previewUrl && (
            <img src={previewUrl} alt="Detected" className="h-full w-full object-contain opacity-60" />
          )}
          <div className="absolute inset-0 pointer-events-none">
            {detectedRegions.map((region) => {
              const [ymin, xmin, ymax, xmax] = region.box_2d;
              const isSelected = selectedRegionId === region.id;
              return (
                <button
                  key={region.id}
                  style={{
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    width: `${(xmax - xmin) / 10}%`,
                    height: `${(ymax - ymin) / 10}%`,
                    pointerEvents: "auto",
                  }}
                  onClick={() => onSelectRegion(region.id)}
                  className={`absolute flex items-start justify-start border-2 transition-all group ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10 z-10 p-2"
                      : "border-white/40 bg-white/5 hover:border-white hover:bg-white/10 p-1"
                  }`}
                >
                  <span className={`text-[10px] font-bold px-1 rounded ${
                    isSelected ? "bg-amber-500 text-white" : "bg-black/60 text-white group-hover:bg-black/80"
                  }`}>
                    {region.label_zh || region.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="space-y-4">
            <h3 className="font-semibold text-zinc-900">{t("wizard.selectTitle")}</h3>
            <p className="text-xs leading-relaxed text-zinc-500">
              {t("wizard.selectDesc")}
            </p>

            {selectedRegionId ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">{t("wizard.selected")}</p>
                <p className="text-sm text-amber-800">
                  {detectedRegions.find(r => r.id === selectedRegionId)?.label_zh}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-center">
                <p className="text-xs text-zinc-400">{t("wizard.noneSelected")}</p>
              </div>
            )}

            <section className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-zinc-900">{t("wizard.confirmMaterialType")}</h4>
              <FurnitureTypeSelector value={furnitureType} onChange={onFurnitureTypeChange} />
            </section>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onStartEnhance}
              disabled={!selectedRegionId || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {t("wizard.nextStartEnhance")}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full text-center text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              {t("wizard.backToModifyImage")}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
