"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";

interface DimensionInputProps {
  value: { width: number; depth: number; height: number };
  onChange: (value: { width: number; depth: number; height: number }) => void;
  min?: number;
  max?: number;
}

export default function DimensionInput({
  value,
  onChange,
  min = 100,
  max = 5000,
}: DimensionInputProps) {
  const resetKey = `${value.width}-${value.depth}-${value.height}`;

  return (
    <DimensionInputFields
      key={resetKey}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
    />
  );
}

function DimensionInputFields({
  value,
  onChange,
  min,
  max,
}: Required<DimensionInputProps>) {
  const t = useTranslations("Viewer");
  const [draft, setDraft] = useState(() => ({
    width: String(value.width || ""),
    depth: String(value.depth || ""),
    height: String(value.height || ""),
  }));

  const handleDraftChange = (field: keyof typeof value, raw: string) => {
    setDraft((current) => ({
      ...current,
      [field]: raw.replace(/[^\d]/g, ""),
    }));
  };

  const commitValue = (field: keyof typeof value) => {
    const parsed = Number.parseInt(draft[field], 10);
    const nextValue = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, min), max)
      : value[field] || min;

    setDraft((current) => ({
      ...current,
      [field]: String(nextValue),
    }));

    if (nextValue !== value[field]) {
      onChange({ ...value, [field]: nextValue });
    }
  };

  const fields: { key: keyof typeof value; labelKey: string }[] = [
    { key: "width", labelKey: "dim.width" },
    { key: "depth", labelKey: "dim.depth" },
    { key: "height", labelKey: "dim.height" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {fields.map(({ key, labelKey }) => (
        <label key={key} className="relative flex flex-col">
          <span className="mb-1.5 text-xs font-medium text-zinc-500">
            {t(labelKey)}
          </span>
          <div className="relative flex items-center overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-900/10">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="next"
              autoComplete="off"
              value={draft[key]}
              onChange={(e) => handleDraftChange(key, e.target.value)}
              onBlur={() => commitValue(key)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="w-full bg-transparent px-3 py-2 text-base font-semibold text-zinc-900 outline-none placeholder:text-zinc-300"
              placeholder="0"
            />
            <span className="absolute right-3 text-[10px] font-bold text-zinc-400 pointer-events-none select-none">
              mm
            </span>
          </div>
        </label>
      ))}
      <div className="col-span-3 mt-1.5 flex justify-between px-1">
        <span className="text-[11px] text-zinc-400">{t("dim.suggestedRange")} {min} - {max} mm</span>
      </div>
    </div>
  );
}
