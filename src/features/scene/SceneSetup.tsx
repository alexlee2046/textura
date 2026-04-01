// src/features/scene/SceneSetup.tsx
"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon } from "lucide-react";

export type GenerationMode = "gemini-direct" | "gemini-3.1-direct" | "flux-gemini";

export interface SceneParams {
  roomType: string;
  style: string;
  colorPalette: string;
  lighting: string;
  referenceImageFile: File | null;
  referenceImageUrl: string | null;
  roomWidthM: number;
  roomDepthM: number;
  mode: GenerationMode;
}

export const defaultSceneParams: SceneParams = {
  roomType: "living",
  style: "modern",
  colorPalette: "",
  lighting: "natural",
  referenceImageFile: null,
  referenceImageUrl: null,
  roomWidthM: 5,
  roomDepthM: 4,
  mode: "gemini-direct",
};

const ROOM_TYPES = ["living", "bedroom", "dining", "study"] as const;
const STYLES = ["modern", "nordic", "luxury", "chinese", "industrial"] as const;
const LIGHTINGS = ["natural", "dusk", "night", "bright"] as const;

const MODE_CREDITS: Record<GenerationMode, number> = {
  "gemini-direct": 2,
  "gemini-3.1-direct": 4,
  "flux-gemini": 5,
};

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

interface Props { params: SceneParams; onChange: (p: SceneParams) => void; }

export default function SceneSetup({ params, onChange }: Props) {
  const t = useTranslations("SceneSetup");
  const refRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<SceneParams>) => onChange({ ...params, ...patch });

  return (
    <div className="flex flex-col gap-5">

      {/* Model selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-zinc-700">{t("modelLabel")}</label>
        <div className="grid grid-cols-3 gap-2">
          {(["gemini-direct", "gemini-3.1-direct", "flux-gemini"] as GenerationMode[]).map((m) => {
            const labelKey = m === "gemini-direct" ? "modelGeminiDirect" : m === "gemini-3.1-direct" ? "modelGemini31Direct" : "modelFluxGemini";
            const hintKey = m === "gemini-direct" ? "modelGeminiDirectHint" : m === "gemini-3.1-direct" ? "modelGemini31DirectHint" : "modelFluxGeminiHint";
            return (
              <button
                key={m}
                onClick={() => set({ mode: m })}
                className={`flex flex-col items-start gap-1 px-3 py-3 rounded-xl border text-left transition-colors ${
                  params.mode === m
                    ? "bg-zinc-900 border-zinc-900 text-white"
                    : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm">{t(labelKey as "modelGeminiDirect")}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    params.mode === m ? "bg-zinc-700 text-zinc-200" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {MODE_CREDITS[m]}c
                  </span>
                </div>
                <span className={`text-xs leading-snug ${params.mode === m ? "text-zinc-300" : "text-zinc-400"}`}>
                  {t(hintKey as "modelGeminiDirectHint")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Room type */}
      <Field label={t("roomType")}>
        <Chips
          options={ROOM_TYPES.map((k) => ({ value: k, label: t(`roomType${cap(k)}` as "roomTypeLiving") }))}
          value={params.roomType} onChange={(v) => set({ roomType: v })}
        />
      </Field>

      {/* Style */}
      <Field label={t("style")}>
        <Chips
          options={STYLES.map((k) => ({ value: k, label: t(`style${cap(k)}` as "styleModern") }))}
          value={params.style} onChange={(v) => set({ style: v })}
        />
      </Field>

      {/* Lighting */}
      <Field label={t("lighting")}>
        <Chips
          options={LIGHTINGS.map((k) => ({ value: k, label: t(`lighting${cap(k)}` as "lightingNatural") }))}
          value={params.lighting} onChange={(v) => set({ lighting: v })}
        />
      </Field>

      {/* Color palette */}
      <Field label={t("colorPalette")}>
        <input
          type="text" placeholder={t("colorPalettePlaceholder")} value={params.colorPalette}
          onChange={(e) => set({ colorPalette: e.target.value })}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </Field>

      {/* Room dimensions */}
      <Field label={`${t("roomWidth")} x ${t("roomDepth")}`}>
        <div className="flex items-center gap-3">
          <input type="number" min={2} max={20} step={0.5} value={params.roomWidthM}
            onChange={(e) => set({ roomWidthM: Number(e.target.value) })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <span className="text-zinc-400 shrink-0">x</span>
          <input type="number" min={2} max={20} step={0.5} value={params.roomDepthM}
            onChange={(e) => set({ roomDepthM: Number(e.target.value) })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>
      </Field>

      {/* Reference image */}
      <Field label={t("referenceImage")}>
        <div
          onClick={() => refRef.current?.click()}
          className="w-full h-24 rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center cursor-pointer hover:border-zinc-400 overflow-hidden bg-zinc-50"
        >
          {params.referenceImageUrl
            ? <img src={params.referenceImageUrl} alt="" className="h-full object-contain" />
            : <ImageIcon className="w-8 h-8 text-zinc-300" />
          }
          <input ref={refRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (params.referenceImageUrl) URL.revokeObjectURL(params.referenceImageUrl);
              set({ referenceImageFile: f, referenceImageUrl: URL.createObjectURL(f) });
            }} />
        </div>
      </Field>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-zinc-700">{label}</label>
      {children}
    </div>
  );
}

function Chips({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            value === o.value ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
