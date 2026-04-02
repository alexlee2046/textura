"use client";
import { useTranslations } from "next-intl";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useDebounce } from "use-debounce";
import { Heart } from "lucide-react";
import type { Material, SeriesEntry } from "@/types/material";

type CategoryFilter = "All" | "Favorites" | "Fabric" | "Natural Fabric" | "Advanced" | "Leather";

type Screen = "series" | "colors";

function categoryBadgeClass(cat: string) {
  switch (cat) {
    case "Advanced":       return "bg-purple-500/20 text-purple-300";
    case "Natural Fabric": return "bg-green-500/20 text-green-300";
    case "Leather":        return "bg-yellow-500/20 text-yellow-300";
    default:               return "bg-blue-500/20 text-blue-300";
  }
}

function categoryBadgeClassLight(cat: string) {
  switch (cat) {
    case "Advanced":       return "bg-purple-100 text-purple-700";
    case "Natural Fabric": return "bg-green-100 text-green-700";
    case "Leather":        return "bg-amber-100 text-amber-700";
    default:               return "bg-blue-100 text-blue-700";
  }
}

function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-500 rounded-full animate-spin" />
    </div>
  );
}

interface FabricCardProps {
  fabric: Material;
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
  renderHeartButton: (fabricId: string) => React.ReactNode;
  renderCompareBadge: (fabricId: string) => React.ReactNode;
  variant?: "grid" | "expanded";
}

function FabricCard({ fabric, isSelected, disabled, onClick, renderHeartButton, renderCompareBadge, variant = "grid" }: FabricCardProps) {
  const isExpanded = variant === "expanded";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col ${isExpanded ? "" : "rounded-xl overflow-hidden"} transition-all duration-200 cursor-pointer text-left ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      } ${isSelected ? (isExpanded ? "scale-[1.03]" : "ring-2 ring-zinc-800 scale-[1.03]") : "hover:scale-[1.02] hover:ring-1 hover:ring-zinc-300"} ${isExpanded ? "group" : ""}`}
    >
      <div className={`relative aspect-square w-full ${isExpanded ? "rounded-2xl overflow-hidden" : ""} ${
        isExpanded ? (isSelected ? "ring-2 ring-zinc-900/40 shadow-lg" : "ring-1 ring-zinc-100 group-hover:ring-zinc-300 shadow-sm") : ""
      }`}>
        <Image
          src={fabric.imageUrl ?? ""}
          alt={fabric.color ?? fabric.name}
          fill
          className="object-cover"
          unoptimized
          loading="lazy"
          sizes={isExpanded ? "120px" : "80px"}
        />
        {renderHeartButton(fabric.id)}
        {renderCompareBadge(fabric.id)}
      </div>
      <div className={isExpanded ? "mt-2 text-center" : "px-1.5 py-1 bg-white/90"}>
        <p className={`${isExpanded ? "text-xs font-medium truncate w-full" : "text-[10px] font-semibold text-zinc-800 truncate"} ${
          isSelected && isExpanded ? "text-zinc-900 font-semibold" : isExpanded ? "text-zinc-600" : ""
        }`}>{fabric.color}</p>
        {!isExpanded && <p className="text-[9px] text-zinc-500 truncate">{fabric.name}</p>}
      </div>
    </button>
  );
}

function LazySeriesCard({ series, onClick, categoryBadgeClass, t }: {
  series: SeriesEntry;
  onClick: () => void;
  categoryBadgeClass: (cat: string) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className="flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:ring-1 hover:ring-zinc-300 text-left bg-white shadow-sm"
    >
      <div className="relative aspect-square w-full bg-zinc-100">
        {visible && (
          <Image
            src={series.representativeImage ?? ""}
            alt={series.name}
            fill
            className="object-cover"
            unoptimized
            loading="lazy"
            sizes="160px"
          />
        )}
        <span className={`absolute top-1.5 left-1.5 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded backdrop-blur-sm ${categoryBadgeClass(series.category)}`}>
          {series.category}
        </span>
      </div>
      <div className="px-2 py-1.5">
        <p className="text-xs font-bold text-zinc-800 truncate">{series.name}</p>
        <p className="text-[10px] text-zinc-500">{series.colorCount} {t("colors")}</p>
      </div>
    </button>
  );
}

interface FabricSelectorProps {
  orgSlug: string;
  selectedMaterial: Material | null;
  onSelect: (material: Material) => void;
  // Compare mode props
  compareMode?: boolean;
  compareSelection?: Set<string>;
  onCompareToggle?: (material: Material) => void;
  maxCompare?: number;
}

export default function FabricSelector({
  orgSlug: _orgSlug,
  selectedMaterial,
  onSelect,
  compareMode = false,
  compareSelection,
  onCompareToggle,
  maxCompare = 5,
}: FabricSelectorProps) {
  const t = useTranslations("FabricSelector");
  const [screen, setScreen] = useState<Screen>("series");
  const [activeSeries, setActiveSeries] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Favorites state with localStorage persistence
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("fabric_favorites");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [favoriteFabrics, setFavoriteFabrics] = useState<Material[]>([]);
  const favoritesAbortRef = useRef<AbortController | null>(null);

  const toggleFavorite = useCallback((fabricId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(fabricId)) next.delete(fabricId);
      else next.add(fabricId);
      localStorage.setItem("fabric_favorites", JSON.stringify([...next]));
      return next;
    });
  }, []);

  // API-driven state
  const [allSeries, setAllSeries] = useState<SeriesEntry[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const [seriesColors, setSeriesColors] = useState<Material[]>([]);
  const [colorsLoading, setColorsLoading] = useState(false);

  const [debouncedQuery] = useDebounce(searchQuery.trim().toLowerCase(), 300);
  const [searchResults, setSearchResults] = useState<Material[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const isSearching = searchQuery.trim().length > 0;

  // Abort controller refs for cancelling in-flight requests
  const seriesAbortRef = useRef<AbortController | null>(null);
  const colorsAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Lock body scroll when colors panel is open
  useEffect(() => {
    if (screen === "colors") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [screen]);

  // Fetch series list
  const fetchSeries = useCallback(async (category: CategoryFilter) => {
    seriesAbortRef.current?.abort();
    const controller = new AbortController();
    seriesAbortRef.current = controller;

    setSeriesLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "All") params.set("category", category);
      const res = await fetch(`/api/my/materials/series?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!controller.signal.aborted) {
        setAllSeries(data.series ?? []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) setAllSeries([]);
    } finally {
      if (!controller.signal.aborted) setSeriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (categoryFilter === "Favorites") return; // handled by favorites effect
    fetchSeries(categoryFilter);
  }, [categoryFilter, fetchSeries]);

  // Fetch favorite fabrics when "Favorites" filter is active
  useEffect(() => {
    if (categoryFilter !== "Favorites") {
      setFavoriteFabrics([]);
      return;
    }
    if (favorites.size === 0) {
      setFavoriteFabrics([]);
      setSeriesLoading(false);
      return;
    }
    favoritesAbortRef.current?.abort();
    const controller = new AbortController();
    favoritesAbortRef.current = controller;

    setSeriesLoading(true);
    const idsParam = [...favorites].join(",");
    fetch(`/api/my/materials/search?ids=${encodeURIComponent(idsParam)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!controller.signal.aborted) {
          setFavoriteFabrics(Array.isArray(data) ? data : []);
        }
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) setFavoriteFabrics([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSeriesLoading(false);
      });
  }, [categoryFilter, favorites]);

  // Fetch colors for active series
  const fetchColors = useCallback(async (seriesName: string) => {
    colorsAbortRef.current?.abort();
    const controller = new AbortController();
    colorsAbortRef.current = controller;

    setColorsLoading(true);
    try {
      const res = await fetch(
        `/api/my/materials/search?series=${encodeURIComponent(seriesName)}&limit=100`,
        { signal: controller.signal },
      );
      const data = await res.json();
      if (!controller.signal.aborted) {
        setSeriesColors(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) setSeriesColors([]);
    } finally {
      if (!controller.signal.aborted) setColorsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeSeries) {
      setSeriesColors([]);
      setColorsLoading(false);
      return;
    }
    fetchColors(activeSeries);
  }, [activeSeries, fetchColors]);

  // Fetch search results (debounced)
  const fetchSearch = useCallback(async (query: string) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/my/materials/search?q=${encodeURIComponent(query)}&limit=50`,
        { signal: controller.signal },
      );
      const data = await res.json();
      if (!controller.signal.aborted) {
        setSearchResults(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!controller.signal.aborted) setSearchResults([]);
    } finally {
      if (!controller.signal.aborted) setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    fetchSearch(debouncedQuery);
  }, [debouncedQuery, fetchSearch]);

  const openSeries = useCallback((name: string) => {
    setActiveSeries(name);
    setScreen("colors");
  }, []);

  const goBack = useCallback(() => {
    setScreen("series");
    setActiveSeries(null);
  }, []);

  const activeSeriesEntry = activeSeries
    ? allSeries.find((s) => s.name === activeSeries) ?? null
    : null;

  const selectedFabricId = selectedMaterial?.id ?? null;

  /** Whether the compare max has been reached and this fabric is NOT selected */
  const isCompareDisabled = (fabricId: string) =>
    compareMode && compareSelection && compareSelection.size >= maxCompare && !compareSelection.has(fabricId);

  /** Handle click on a fabric card: route to compare or single-select */
  const handleFabricClick = (fabric: Material) => {
    if (compareMode && onCompareToggle) {
      onCompareToggle(fabric);
    } else {
      onSelect(fabric);
    }
  };

  /** Render the heart favorite button overlay for a fabric card */
  const renderHeartButton = (fabricId: string) => {
    if (compareMode) return null; // hide heart in compare mode to avoid clutter
    const isFav = favorites.has(fabricId);
    return (
      <button
        onClick={(e) => toggleFavorite(fabricId, e)}
        className="absolute top-1 right-1 p-1 z-10 rounded-full transition-colors"
        aria-label={isFav ? t("removeFavorite") : t("addFavorite")}
      >
        <Heart
          className={`w-3.5 h-3.5 transition-colors ${
            isFav
              ? "fill-red-500 text-red-500"
              : "text-white/60 hover:text-red-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          }`}
        />
      </button>
    );
  };

  const compareIndexMap = useMemo(() => {
    if (!compareSelection) return new Map<string, number>();
    const map = new Map<string, number>();
    let i = 1;
    for (const id of compareSelection) {
      map.set(id, i++);
    }
    return map;
  }, [compareSelection]);

  /** Render the compare badge overlay for a fabric card */
  const renderCompareBadge = (fabricId: string) => {
    if (!compareMode) return null;
    const isInCompare = compareSelection?.has(fabricId);
    return (
      <div
        className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold z-10 ${
          isInCompare
            ? "bg-zinc-800 border-zinc-800 text-white"
            : "bg-white/80 border-zinc-300 text-zinc-400"
        }`}
      >
        {isInCompare && compareIndexMap.get(fabricId)}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">

      {/* Search bar */}
      <div className="relative shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (screen === "colors") setScreen("series");
          }}
          placeholder={t("searchPlaceholder")}
          className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2 pl-9 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors text-xs">✕</button>
        )}
      </div>

      {/* Compare mode hint */}
      {compareMode && compareSelection && compareSelection.size === 0 && (
        <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 shrink-0">
          {t("compareHint")}
        </p>
      )}

      {/* Category filter chips */}
      {!isSearching && screen === "series" && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {(["All", "Favorites", "Fabric", "Natural Fabric", "Advanced", "Leather"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all duration-200 cursor-pointer inline-flex items-center gap-0.5 ${
                categoryFilter === c
                  ? c === "Favorites" ? "bg-red-500 text-white" : "bg-zinc-800 text-white"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
              }`}
            >
              {c === "Favorites" && <Heart className="w-3 h-3" fill={categoryFilter === c ? "currentColor" : "none"} />}
              {c === "Favorites" ? t("favorites") : c}
              {c === "Favorites" && favorites.size > 0 && (
                <span className={`ml-0.5 text-[9px] ${categoryFilter === c ? "text-white/80" : "text-zinc-400"}`}>
                  {favorites.size}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main scrollable area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <AnimatePresence mode="wait" initial={false}>

          {isSearching && (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {searchLoading ? (
                <LoadingSpinner />
              ) : searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-zinc-600 text-sm">{t("noResults")} &quot;{searchQuery}&quot;</div>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 mb-2">{searchResults.length} {t("results")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {searchResults.map((fabric) => (
                      <FabricCard
                        key={fabric.id}
                        fabric={fabric}
                        isSelected={!!(compareMode ? compareSelection?.has(fabric.id) : fabric.id === selectedFabricId)}
                        disabled={!!isCompareDisabled(fabric.id)}
                        onClick={() => handleFabricClick(fabric)}
                        renderHeartButton={renderHeartButton}
                        renderCompareBadge={renderCompareBadge}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {!isSearching && screen === "series" && categoryFilter === "Favorites" && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {seriesLoading ? (
                <LoadingSpinner />
              ) : favoriteFabrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
                  <Heart className="w-8 h-8" />
                  <p className="text-sm">{t("noFavorites")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {favoriteFabrics.map((fabric) => (
                    <FabricCard
                      key={fabric.id}
                      fabric={fabric}
                      isSelected={!!(compareMode ? compareSelection?.has(fabric.id) : fabric.id === selectedFabricId)}
                      disabled={!!isCompareDisabled(fabric.id)}
                      onClick={() => handleFabricClick(fabric)}
                      renderHeartButton={renderHeartButton}
                      renderCompareBadge={renderCompareBadge}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {!isSearching && screen === "series" && categoryFilter !== "Favorites" && (
            <motion.div
              key="series"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {seriesLoading ? (
                <LoadingSpinner />
              ) : allSeries.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-zinc-600 text-sm">{t("noSeriesMatch")}</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {allSeries.map((series) => (
                    <LazySeriesCard
                      key={series.name}
                      series={series}
                      onClick={() => openSeries(series.name)}
                      categoryBadgeClass={categoryBadgeClass}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {!isSearching && screen === "colors" && (
            <motion.div key="colors-placeholder" initial={{ opacity: 0 }} animate={{ opacity: 0 }} className="h-1" />
          )}

        </AnimatePresence>
      </div>

      {/* Selected preview bar (panel, hidden when colors overlay open) */}
      {selectedMaterial && screen !== "colors" && (
        <div className="shrink-0 flex items-center gap-2.5 px-3 py-2 bg-zinc-100 rounded-xl border border-zinc-200">
          <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
            <Image src={selectedMaterial.imageUrl ?? ""} alt={selectedMaterial.color ?? selectedMaterial.name} fill className="object-cover" unoptimized sizes="32px" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-800 truncate">{selectedMaterial.name} · {selectedMaterial.color}</p>
            <p className="text-[10px] text-zinc-500 truncate">{selectedMaterial.category}</p>
          </div>
          <span className="ml-auto text-green-400 shrink-0">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </span>
        </div>
      )}

      {/* Portal: immersive expanded color panel */}
      {typeof window !== "undefined" && createPortal(
        <AnimatePresence>
          {screen === "colors" && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={goBack}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              />
              <motion.div
                key="expanded-panel"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="fixed inset-x-6 inset-y-8 z-50 bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-zinc-100">
                  <button
                    onClick={goBack}
                    className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="m15 18-6-6 6-6"/>
                    </svg>
                  </button>
                  <span className="text-lg font-bold text-zinc-900 tracking-wide">{activeSeries}</span>
                  {activeSeriesEntry && (
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${categoryBadgeClassLight(activeSeriesEntry.category)}`}>
                      {activeSeriesEntry.category}
                    </span>
                  )}
                  <span className="ml-auto text-sm text-zinc-400">{seriesColors.length} {t("colors")}</span>
                </div>

                {/* 4-column color grid */}
                <div className="flex-1 overflow-y-auto p-6">
                  {colorsLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      {seriesColors.map((fabric) => (
                        <FabricCard
                          key={fabric.id}
                          fabric={fabric}
                          isSelected={!!(compareMode ? compareSelection?.has(fabric.id) : fabric.id === selectedFabricId)}
                          disabled={!!isCompareDisabled(fabric.id)}
                          onClick={() => {
                            if (compareMode && onCompareToggle) {
                              onCompareToggle(fabric);
                            } else {
                              onSelect(fabric);
                              goBack();
                            }
                          }}
                          renderHeartButton={renderHeartButton}
                          renderCompareBadge={renderCompareBadge}
                          variant="expanded"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected preview bar (light theme) */}
                {selectedMaterial && (
                  <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-t border-zinc-100 bg-zinc-50">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-zinc-200">
                      <Image src={selectedMaterial.imageUrl ?? ""} alt={selectedMaterial.color ?? selectedMaterial.name} fill className="object-cover" unoptimized sizes="36px" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{selectedMaterial.name} · {selectedMaterial.color}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{selectedMaterial.category}</p>
                    </div>
                    <span className="ml-auto text-green-500 shrink-0">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </span>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
