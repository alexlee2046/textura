"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Download, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { isWechat } from "@/lib/shareUtils";

interface PosterPreviewProps {
  shareHash: string;
  onClose: () => void;
}

type Status = "loading" | "ready" | "error";

export default function PosterPreview({ shareHash, onClose }: PosterPreviewProps) {
  const t = useTranslations("HomePage");
  const [status, setStatus] = useState<Status>("loading");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  const didInit = useRef(false);

  const generate = useCallback(async () => {
    setStatus("loading");
    setErrorCode(null);
    try {
      const res = await fetch("/api/poster/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareHash }),
      });

      if (!res.ok) {
        setErrorCode(res.status);
        setStatus("error");
        return;
      }

      const data = await res.json();
      setPosterUrl(data.posterUrl);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [shareHash]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async () => {
    if (!posterUrl) return;
    try {
      const res = await fetch(posterUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poster_${shareHash}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail
    }
  };

  const errorMessage =
    errorCode === 403
      ? t("posterLoginRequired")
      : errorCode === 503
        ? t("posterServerBusy")
        : t("posterError");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="flex flex-col items-center gap-4 max-w-md w-full px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "loading" && (
          <div className="w-full aspect-[9/16] rounded-2xl bg-zinc-800 animate-shimmer flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">{t("posterLoading")}</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="w-full aspect-[9/16] rounded-2xl bg-zinc-800 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-zinc-400">
              <p className="text-sm">{errorMessage}</p>
              {errorCode !== 403 && (
                <button
                  onClick={generate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t("posterRetry")}
                </button>
              )}
            </div>
          </div>
        )}

        {status === "ready" && posterUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl}
              alt="Poster"
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />

            {isWechat ? (
              <p className="text-zinc-400 text-sm text-center">
                {t("posterSaveGuide")}
              </p>
            ) : (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                {t("downloadPoster")}
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
