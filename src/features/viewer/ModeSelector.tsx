"use client";

import React from "react";
import { Layers3, Sparkles, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

export type GenerationMode = "quick" | "precision";

interface ModeSelectorProps {
  value: GenerationMode;
  onChange: (mode: GenerationMode) => void;
  quickCredits: number;
  precisionCredits: number;
}

export default function ModeSelector({
  value,
  onChange,
  quickCredits,
  precisionCredits,
}: ModeSelectorProps) {
  const t = useTranslations("Viewer");

  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        type="button"
        onClick={() => onChange("quick")}
        className={`group relative flex flex-col rounded-2xl border p-5 text-left transition-all duration-300 ${
          value === "quick"
            ? "border-zinc-900 bg-white ring-2 ring-zinc-900 shadow-md"
            : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
        }`}
      >
        <div className="mb-4 flex w-full items-start justify-between">
          <span className={`rounded-xl p-2.5 transition-colors ${value === "quick" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"}`}>
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700">
            <Zap className="h-3.5 w-3.5" />
            <span>{quickCredits}</span>
          </div>
        </div>
        <span className="text-base font-bold tracking-tight text-zinc-900">Quick</span>
        <span className="mt-1 block text-sm font-medium text-zinc-500">{t("gen.modeQuickSubtitle")}</span>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {t("gen.modeQuickDesc")}
        </p>
      </button>

      <button
        type="button"
        onClick={() => onChange("precision")}
        className={`group relative flex flex-col rounded-2xl border p-5 text-left transition-all duration-300 ${
          value === "precision"
            ? "border-zinc-900 bg-white ring-2 ring-zinc-900 shadow-md"
            : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
        }`}
      >
        <div className="mb-4 flex w-full items-start justify-between">
          <span className={`rounded-xl p-2.5 transition-colors ${value === "precision" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"}`}>
            <Layers3 className="h-5 w-5" />
          </span>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700">
            <Zap className="h-3.5 w-3.5" />
            <span>{precisionCredits}</span>
          </div>
        </div>
        <span className="text-base font-bold tracking-tight text-zinc-900">Precision</span>
        <span className="mt-1 block text-sm font-medium text-zinc-500">{t("gen.modePrecisionSubtitle")}</span>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {t("gen.modePrecisionDesc")}
        </p>
      </button>
    </div>
  );
}
