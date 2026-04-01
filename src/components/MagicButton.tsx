"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

type Quality = "standard" | "pro";

interface MagicButtonProps {
  onApply: (quality: Quality) => void;
  disabled?: boolean;
  loadingQuality?: Quality | null;
}

export default function MagicButton({ onApply, disabled = false, loadingQuality = null }: MagicButtonProps) {
  const t = useTranslations("MagicButton");

  const isDisabled = () => disabled || loadingQuality !== null;
  const isLoading = (q: Quality) => loadingQuality === q;

  const btnClass = () => `
    relative overflow-hidden flex-1 px-4 py-4 rounded-xl font-bold text-base tracking-wide transition-all duration-300
    ${isDisabled()
      ? "bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200"
      : "bg-zinc-900 text-white shadow-[0_0_40px_rgba(0,0,0,0.12)] hover:shadow-[0_0_60px_rgba(0,0,0,0.2)] border border-zinc-800"}
  `;

  return (
    <div className="flex gap-2 w-full">
      {(["standard", "pro"] as Quality[]).map((q) => (
        <motion.button
          key={q}
          whileHover={isDisabled() ? {} : { scale: 1.02 }}
          whileTap={isDisabled() ? {} : { scale: 0.98 }}
          onClick={() => onApply(q)}
          disabled={isDisabled()}
          className={btnClass()}
        >
          {!isDisabled() && (
            <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-xl">
              <div className="absolute inset-0 w-[200%] h-full animate-shimmer opacity-20" />
            </div>
          )}
          <div className="relative flex items-center justify-center gap-2 z-10">
            {isLoading(q) ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t("loading")}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t(q === "standard" ? "applyStandard" : "applyPro")}</span>
              </>
            )}
          </div>
        </motion.button>
      ))}
    </div>
  );
}
