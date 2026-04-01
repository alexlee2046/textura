"use client";

import React from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface GenerationProgressProps {
  status:
    | "queued"
    | "running"
    | "downloading"
    | "completed"
    | "failed"
    | "refunded";
  progress: number;
  error?: string;
}

const STATUS_KEYS: Record<GenerationProgressProps["status"], string> = {
  queued: "gen.statusQueued",
  running: "gen.statusRunning",
  downloading: "gen.statusDownloading",
  completed: "gen.statusCompleted",
  failed: "gen.statusFailed",
  refunded: "gen.statusRefunded",
};

export default function GenerationProgress({
  status,
  progress,
  error,
}: GenerationProgressProps) {
  const t = useTranslations("Viewer");
  const isError = status === "failed" || status === "refunded";
  const isComplete = status === "completed";

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {isError ? (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
      ) : isComplete ? (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle className="h-8 w-8 text-emerald-500" />
        </div>
      ) : (
        <div className="relative mb-5 h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-200" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-pulse text-zinc-600" />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className={`text-lg font-semibold ${isError ? "text-red-600" : "text-zinc-900"}`}>
          {t(STATUS_KEYS[status])}
        </p>
        {!isError && !isComplete && (
          <>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">
              {Math.round(progress)}%
            </p>
            <p className="text-sm text-zinc-500">{t("gen.progressHint")}</p>
          </>
        )}
        {error && <p className="max-w-md text-sm leading-6 text-red-500">{error}</p>}
      </div>

      {!isError && (
        <div className="mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full bg-zinc-900 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
