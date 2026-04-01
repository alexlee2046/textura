"use client";

import { QRCode } from "react-qrcode-logo";
import { X, Copy, Check, MoreHorizontal, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { isWechat, isMobile } from "@/lib/shareUtils";
import PosterPreview from "@/components/PosterPreview";

export interface ShareGeneration {
  shareHash: string;
  type: string;
}

interface ShareModalProps {
  shareUrl: string;
  onClose: () => void;
  generation?: ShareGeneration;
}

const POSTER_TYPES = new Set(["fabric", "multi-fabric"]);

export default function ShareModal({ shareUrl, onClose, generation }: ShareModalProps) {
  const t = useTranslations("HomePage");
  const [copied, setCopied] = useState(false);
  const [showPoster, setShowPoster] = useState(false);

  const canPoster = generation && POSTER_TYPES.has(generation.type);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const posterButton = canPoster ? (
    <button
      onClick={() => setShowPoster(true)}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-sm font-medium transition-colors"
    >
      <ImageIcon className="w-4 h-4" />
      {isWechat ? t("generatePoster") : t("downloadPoster")}
    </button>
  ) : null;

  // Poster preview overlay
  if (showPoster && generation) {
    return (
      <PosterPreview
        shareHash={generation.shareHash}
        onClose={() => setShowPoster(false)}
      />
    );
  }

  // WeChat: guide user to tap ··· menu + poster button
  if (isWechat) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-14 right-3 w-64"
          >
            <div className="absolute -top-1.5 right-5 w-3 h-3 bg-white rotate-45 border-l border-t border-zinc-200/80" />
            <div className="relative bg-white rounded-xl px-4 py-4 border border-zinc-200/80 shadow-xl space-y-3">
              <p className="text-sm text-zinc-700 leading-relaxed text-center">
                {t("wechatShareGuide1")}
                <span className="inline-flex items-center mx-1 px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200/60 align-middle">
                  <MoreHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                </span>
                {t("wechatShareGuide2")}
              </p>
              <p className="text-xs text-zinc-400 text-center">
                {t("wechatShareOptions")}
              </p>
              {posterButton}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Mobile non-WeChat: copy link + poster
  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 max-w-sm w-full mx-4 border border-zinc-200/80 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-zinc-900">{t("share")}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? t("linkCopied") : t("copyLink")}
            </button>
            {posterButton}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Desktop: QR code + copy link + poster
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 max-w-sm w-full mx-4 border border-zinc-200/80 shadow-2xl space-y-3"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-zinc-900">{t("share")}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center p-4 bg-white rounded-xl">
            <QRCode
              value={shareUrl}
              size={200}
              qrStyle="dots"
              eyeRadius={8}
              bgColor="transparent"
            />
          </div>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t("linkCopied") : t("copyLink")}
          </button>
          {posterButton}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
