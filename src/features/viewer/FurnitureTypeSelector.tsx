"use client";

import React from "react";
import { Sofa, GlassWater, Frame, Mountain, TreePine, Blend } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FurnitureType } from "@/lib/model3d-prompts";

interface FurnitureTypeSelectorProps {
  value: FurnitureType | undefined;
  onChange: (type: FurnitureType) => void;
}

const TYPES: { type: FurnitureType; labelKey: string; icon: React.ReactNode }[] = [
  { type: "upholstered", labelKey: "furniture.upholstered", icon: <Sofa className="w-5 h-5" /> },
  { type: "glass", labelKey: "furniture.glass", icon: <GlassWater className="w-5 h-5" /> },
  { type: "metal-frame", labelKey: "furniture.metalFrame", icon: <Frame className="w-5 h-5" /> },
  { type: "stone-top", labelKey: "furniture.stoneTop", icon: <Mountain className="w-5 h-5" /> },
  { type: "wood", labelKey: "furniture.wood", icon: <TreePine className="w-5 h-5" /> },
  { type: "mixed", labelKey: "furniture.mixed", icon: <Blend className="w-5 h-5" /> },
];

export default function FurnitureTypeSelector({
  value,
  onChange,
}: FurnitureTypeSelectorProps) {
  const t = useTranslations("Viewer");

  return (
    <div className="grid grid-cols-3 gap-3">
      {TYPES.map(({ type, labelKey, icon }) => {
        const isSelected = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`group flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 ${
              isSelected
                ? "border-zinc-900 bg-zinc-900 text-white shadow-md scale-[1.02]"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <div className={`transition-transform duration-200 ${isSelected ? 'scale-110 text-white' : 'text-zinc-500 group-hover:text-zinc-700'}`}>
              {icon}
            </div>
            <span className={`text-xs mt-2 font-medium ${isSelected ? 'text-zinc-100' : 'text-zinc-600 group-hover:text-zinc-900'}`}>{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
