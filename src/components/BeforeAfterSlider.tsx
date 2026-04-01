"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import SafeImage from "@/components/SafeImage";
import { motion } from "framer-motion";
import { ChevronsLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  aspectRatio?: number;
  variant?: "light" | "dark";
  priority?: boolean;
}

export default function BeforeAfterSlider({ beforeImage, afterImage, aspectRatio = 16 / 9, variant = "dark", priority = false }: BeforeAfterSliderProps) {
  const t = useTranslations("BeforeAfterSlider");
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("touchend", handleUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleUp]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`relative w-full rounded-3xl overflow-hidden cursor-crosshair select-none border-2 ${
        variant === "light"
          ? "border-zinc-200/80 shadow-lg"
          : "border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.05)]"
      }`}
      style={{ aspectRatio }}
      ref={containerRef}
      onMouseDown={(e) => { setIsDragging(true); handleMove(e.clientX); }}
      onTouchStart={(e) => { setIsDragging(true); handleMove(e.touches[0].clientX); }}
    >
      {/* After image — full size, always visible underneath */}
      <div className="absolute inset-0">
        <SafeImage src={afterImage} alt="After" fill className="object-cover" unoptimized priority={priority} />
      </div>

      {/* Before image — full size, clipped on the right by clipPath */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <SafeImage src={beforeImage} alt="Before" fill className="object-cover" unoptimized priority={priority} />
      </div>

      {/* Divider line + handle */}
      <div
        className="absolute inset-y-0 z-20 flex items-center justify-center group"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className={`absolute inset-y-0 w-0.5 -ml-[1px] ${variant === "light" ? "bg-zinc-400/60" : "bg-white/60"}`} />
        <div className="absolute inset-y-0 w-6 -ml-3 cursor-ew-resize" />
        <div className={`w-10 h-10 -ml-5 backdrop-blur-xl rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-transform duration-150 group-hover:scale-110 group-active:scale-95 ${
          variant === "light"
            ? "bg-white/80 border border-zinc-300 text-zinc-600"
            : "bg-white/10 border border-white/30 text-white"
        }`}>
          <ChevronsLeftRight className="w-5 h-5 opacity-80" />
        </div>
      </div>

      {/* Labels */}
      <div className={`absolute bottom-4 left-4 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium tracking-widest uppercase ${
        variant === "light"
          ? "bg-white/80 border border-zinc-200 text-zinc-600"
          : "bg-black/40 border border-white/10 text-white/90"
      }`}>
        {t("before")}
      </div>
      <div className={`absolute bottom-4 right-4 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium tracking-widest uppercase ${
        variant === "light"
          ? "bg-white/80 border border-zinc-200 text-zinc-600"
          : "bg-black/40 border border-white/10 text-white/90"
      }`}>
        {t("after")}
      </div>
    </motion.div>
  );
}
