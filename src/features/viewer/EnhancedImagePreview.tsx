"use client";

import React, { useState } from "react";
import { RefreshCw, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { GenerationMode } from "./ModeSelector";

interface EnhancedImagePreviewProps {
  mode: GenerationMode;
  imageUrl: string;
  imageUrl2?: string;
  enhanceCount: number;
  freeLimit: number;
  creditCost: number;
  userCredits: number;
  onRetry: (viewIndex: 1 | 2, feedback?: string) => void;
  onConfirm: () => void;
  loading?: boolean;
}

function RetryAction({
  label,
  loading,
  text,
  onClick,
}: {
  label: string;
  loading?: boolean;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {label}
      <span className="text-zinc-400">{text}</span>
    </button>
  );
}

export default function EnhancedImagePreview({
  mode,
  imageUrl,
  imageUrl2,
  enhanceCount,
  freeLimit,
  creditCost,
  userCredits,
  onRetry,
  onConfirm,
  loading,
}: EnhancedImagePreviewProps) {
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const t = useTranslations("Viewer");

  const remainingFree = Math.max(0, freeLimit - enhanceCount);
  const retryHint = enhanceCount >= freeLimit
    ? t("wizard.retryPaidHint")
    : t("wizard.retryFreeHint", { count: remainingFree });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">{t("wizard.reviewTitle")}</h3>
          <p className="text-sm text-zinc-500">
            {t("wizard.reviewDesc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFeedback((value) => !value)}
          className="text-sm font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-700 hover:underline"
        >
          {showFeedback ? t("wizard.collapseFeedback") : t("wizard.needMoreOptimization")}
        </button>
      </div>

      {showFeedback && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4"
        >
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={t("wizard.feedbackPlaceholder")}
            className="min-h-[84px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition-colors focus:border-zinc-400"
          />
          <div className="flex flex-wrap gap-2">
            {mode === "precision" ? (
              <>
                <RetryAction
                  label={t("wizard.retryFront")}
                  text={retryHint}
                  loading={loading}
                  onClick={() => onRetry(1, feedback || undefined)}
                />
                <RetryAction
                  label={t("wizard.retryRear")}
                  text={retryHint}
                  loading={loading}
                  onClick={() => onRetry(2, feedback || undefined)}
                />
              </>
            ) : (
              <RetryAction
                label={t("wizard.retryEnhance")}
                text={retryHint}
                loading={loading}
                onClick={() => onRetry(1, feedback || undefined)}
              />
            )}
          </div>
          <p className="text-xs leading-5 text-zinc-500">
            {t("wizard.retryPolicyNote")}
          </p>
        </motion.div>
      )}

      <div className={`grid gap-4 ${mode === "precision" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <img src={imageUrl} alt="Enhanced front preview" className="aspect-square w-full object-cover" />
          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
            {mode === "precision" ? t("wizard.frontThreeQuarter") : t("wizard.enhancedMainView")}
          </div>
        </div>
        {mode === "precision" && imageUrl2 && (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <img src={imageUrl2} alt="Enhanced rear preview" className="aspect-square w-full object-cover" />
            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
              {t("wizard.rearThreeQuarter")}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-2 text-sm text-zinc-600">
          <div className="flex items-center justify-between gap-4">
            <span>{t("wizard.submitCreditDeduction")}</span>
            <span className="flex items-center gap-1 font-semibold text-zinc-900">
              <Zap className="h-4 w-4 text-amber-500" />
              {creditCost}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>{t("wizard.currentBalance")}</span>
            <span className="font-medium text-zinc-900">
              <Zap className="inline h-3.5 w-3.5 text-amber-500" /> {userCredits}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading || userCredits < creditCost}
          className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {userCredits < creditCost ? t("wizard.insufficientCredits") : t("wizard.confirmGenerate3D")}
        </button>
      </div>
    </div>
  );
}
