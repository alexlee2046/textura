"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Material } from "@/types/material";

interface FabricPopoverProps {
  fabric: Material;
  children: ReactNode;
}

export function FabricPopover({ fabric, children }: FabricPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverH = 340; // approx height: 256 img + padding + text
    const centerX = Math.min(
      Math.max(rect.left + rect.width / 2 - 140, 8), // 140 = half of 280px popover width
      window.innerWidth - 288 // keep 8px from right edge
    );

    if (rect.top > popoverH) {
      // Show above
      setPos({ bottom: window.innerHeight - rect.top + 8, left: centerX });
    } else {
      // Show below
      setPos({ top: rect.bottom + 8, left: centerX });
    }
  }, []);

  const open = useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const close = useCallback(() => setIsOpen(false), []);

  // ESC key + scroll → close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onScroll = () => close();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen, close]);

  return (
    <>
      <div ref={triggerRef} onClick={() => (isOpen ? close() : open())} className="cursor-pointer">
        {children}
      </div>
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Transparent backdrop */}
                <motion.div
                  key="fabric-popover-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-50"
                  onClick={close}
                />
                {/* Popover */}
                <motion.div
                  key="fabric-popover"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="fixed z-50 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-2xl shadow-xl p-3"
                  style={{
                    ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }),
                    left: pos.left,
                    width: 280,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={fabric.imageUrl ?? ""}
                    alt={fabric.color ?? fabric.name}
                    className="w-64 h-64 rounded-xl object-cover mx-auto"
                  />
                  <div className="mt-2 text-center">
                    <p className="text-xs text-zinc-400 uppercase tracking-wide">
                      {fabric.name}
                    </p>
                    <p className="text-sm font-bold text-zinc-800">{fabric.color ?? ""}</p>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
