"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

import dynamic from "next/dynamic";
import { useUser } from "@/hooks/useUser";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import ShareModal from "@/components/ShareModal";

const Inline3DViewer = dynamic(() => import("@/components/Inline3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[4/3] flex items-center justify-center bg-zinc-100 rounded-2xl">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
    </div>
  ),
});

import { getFabricInfo, prefetchFabricInfo } from "@/lib/fabricMap";
import { MODEL3D_ACTIVE_STATUSES } from "@/lib/model3d-constants";
import { timeAgo } from "@/lib/timeAgo";
import { downloadImage } from "@/lib/download";
import {

  Download,
  Share2,
  Trash2,
  History,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Loader2,
  Box,
} from "lucide-react";

// --- Suspense wrapper (required for useSearchParams) ---

export default function HistoryPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      }
    >
      <HistoryPage />
    </Suspense>
  );
}

// --- Types ---

interface GenerationRecord {
  id: string;
  type: string;
  mode: string;
  creditCost: number;
  inputImageUrl: string;
  resultImageUrl: string;
  fabricId: string | null;
  shareHash: string | null;
  metadata: Record<string, unknown> | null;
  sceneParams: string | null;
  modelUrl?: string | null;
  createdAt: string;
}

type TabType = null | "fabric" | "multi-fabric" | "scene" | "3d";

const TABS: { key: TabType; labelKey: string }[] = [
  { key: null, labelKey: "tabAll" },
  { key: "fabric", labelKey: "tabFabric" },
  { key: "multi-fabric", labelKey: "tabMultiFabric" },
  { key: "scene", labelKey: "tabScene" },
  { key: "3d", labelKey: "tab3D" },
];

const MODE_LABELS: Record<string, string> = {
  standard: "modeStandard",
  pro: "modePro",
  ultra: "modeUltra",
  "gemini-direct": "modeStandard",
  "gemini-3.1-flash-image-preview": "modePro",
  "gemini-3.1-direct": "modePro",
  "flux-gemini": "modeExperimental",
  quick: "modeStandard",
  precision: "modePro",
};

const TYPE_BADGE: Record<string, { bg: string; text: string; labelKey: string }> = {
  fabric: { bg: "bg-blue-100", text: "text-blue-700", labelKey: "tabFabric" },
  "multi-fabric": { bg: "bg-purple-100", text: "text-purple-700", labelKey: "tabMultiFabric" },
  scene: { bg: "bg-green-100", text: "text-green-700", labelKey: "tabScene" },
  "3d": { bg: "bg-orange-100", text: "text-orange-700", labelKey: "tab3D" },
};

const STATUS_3D_BADGE: Record<string, { bg: string; text: string; label: string; pulse?: boolean }> = {
  enhancing: { bg: "bg-blue-100", text: "text-blue-600", label: "优化中...", pulse: true },
  pending: { bg: "bg-blue-100", text: "text-blue-600", label: "排队中...", pulse: true },
  processing: { bg: "bg-blue-100", text: "text-blue-600", label: "生成中...", pulse: true },
  downloading: { bg: "bg-blue-100", text: "text-blue-600", label: "下载模型中...", pulse: true },
  completed: { bg: "bg-green-100", text: "text-green-700", label: "已完成" },
  failed: { bg: "bg-red-100", text: "text-red-600", label: "生成失败" },
  refunded: { bg: "bg-zinc-100", text: "text-zinc-500", label: "已退款" },
};

function get3DStatus(record: GenerationRecord): string {
  return (record.metadata as { status?: string })?.status ?? "";
}

function is3DCompleted(record: GenerationRecord): boolean {
  return get3DStatus(record) === "completed";
}

const IN_PROGRESS_STATUSES = new Set<string>([...MODEL3D_ACTIVE_STATUSES, "enhancing"]);

function is3DInProgress(record: GenerationRecord): boolean {
  return IN_PROGRESS_STATUSES.has(get3DStatus(record));
}

/** Poll the newest in-progress 3D record. Accepts a primitive ID to avoid re-triggering on every records update. */
function use3DPolling(
  inProgressId: string | null,
  onUpdate: (id: string, data: { status: string; modelUrl?: string; progress?: number }) => void
) {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!inProgressId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/model3d/status/${inProgressId}`);
        if (!res.ok) return;
        const data = await res.json();
        onUpdate(inProgressId, {
          status: data.status,
          modelUrl: data.modelUrl,
          progress: data.progress,
        });
      } catch {
        // Silently ignore polling errors
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [inProgressId, onUpdate]);
}

const PAGE_SIZE = 20;

// --- Component ---

function HistoryPage() {
  const t = useTranslations("HistoryPage");
  const tScene = useTranslations("ScenePage");
  const { user } = useUser();
  const searchParams = useSearchParams();

  // Tab state from URL param
  const initialType = (searchParams.get("type") as TabType) ?? null;
  const [activeTab, setActiveTab] = useState<TabType>(initialType);

  // Data
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shareModalData, setShareModalData] = useState<{
    shareUrl: string;
    generation?: { shareHash: string; type: string };
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handlePollingUpdate = useCallback(
    (id: string, data: { status: string; modelUrl?: string }) => {
      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        if (idx === -1) return prev;
        const existing = prev[idx];
        const oldStatus = (existing.metadata as { status?: string })?.status;
        const newModelUrl = data.modelUrl ?? existing.modelUrl;
        if (oldStatus === data.status && existing.modelUrl === newModelUrl) return prev;
        const updated = {
          ...existing,
          modelUrl: newModelUrl,
          metadata: { ...existing.metadata, status: data.status },
        };
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      });
      if (data.status === "completed") {
        cacheRef.current = {};
      }
    },
    []
  );

  const inProgressId = records.find((r) => r.type === "3d" && is3DInProgress(r))?.id ?? null;
  use3DPolling(inProgressId, handlePollingUpdate);

  // Cache per tab
  const cacheRef = useRef<Record<string, { records: GenerationRecord[]; total: number; page: number }>>({});
  const expandedRef = useRef<HTMLDivElement | null>(null);

  // --- Data fetching ---

  const fetchRecords = useCallback(
    async (tabType: TabType, pageNum: number, append = false) => {
      if (!user) return;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (tabType) params.set("type", tabType);
        params.set("page", String(pageNum));
        params.set("limit", String(PAGE_SIZE));

        const res = await fetch(`/api/generations?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const fetched: GenerationRecord[] = data.generations ?? [];

        // 预取面料名称（异步，不阻塞渲染）
        const fabricIds = fetched.map((r) => r.fabricId).filter(Boolean) as string[];
        if (fabricIds.length > 0) prefetchFabricInfo(fabricIds).catch(() => {});

        if (append) {
          setRecords((prev) => [...prev, ...fetched]);
        } else {
          setRecords(fetched);
        }
        setTotal(data.total ?? 0);
        setPage(pageNum);

        // Update cache
        const cacheKey = tabType ?? "__all__";
        if (append) {
          const prev = cacheRef.current[cacheKey];
          cacheRef.current[cacheKey] = {
            records: [...(prev?.records ?? []), ...fetched],
            total: data.total,
            page: pageNum,
          };
        } else {
          cacheRef.current[cacheKey] = { records: fetched, total: data.total, page: pageNum };
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id]
  );

  // Initial fetch & tab switch
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const cacheKey = activeTab ?? "__all__";
    const cached = cacheRef.current[cacheKey];
    if (cached) {
      setRecords(cached.records);
      setTotal(cached.total);
      setPage(cached.page);
      setLoading(false);
    } else {
      fetchRecords(activeTab, 1);
    }
    setExpandedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id, fetchRecords]);

  // --- Handlers ---

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  const handleLoadMore = () => {
    fetchRecords(activeTab, page + 1, true);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    // Scroll into view after animation
    setTimeout(() => {
      expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 300);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/generations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setTotal((prev) => prev - 1);
        setExpandedId(null);
        // Invalidate all tab caches (deleted record may appear in "全部" + its type tab)
        cacheRef.current = {};
      }
    } catch {
      // Network error — silently fail, record stays in list
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // --- Card helpers ---

  const getCardTitle = (record: GenerationRecord): string => {
    if (record.type === "3d") {
      const modeSuffix = record.mode === "precision" ? "Precision" : "Quick";
      const meta = record.metadata as { status?: string };
      const s = meta?.status;
      const statusStr = s === "completed" ? "完成" : s === "failed" ? "失败" : s === "refunded" ? "退款" : "处理中";
      return `3D 模型 - ${modeSuffix} (${statusStr})`;
    }
    if (record.type === "fabric" && record.fabricId) {
      const info = getFabricInfo(record.fabricId);
      return info ? `${info.name} · ${info.color}` : record.fabricId;
    }
    if (record.type === "multi-fabric" && record.metadata) {
      const assignments = (record.metadata as { assignments?: unknown[] }).assignments;
      const count = Array.isArray(assignments) ? assignments.length : 0;
      return t("regions", { count });
    }
    if (record.type === "scene" && record.sceneParams) {
      try {
        const params = JSON.parse(record.sceneParams);
        const room = params.roomType ? tScene(`roomType${params.roomType.charAt(0).toUpperCase() + params.roomType.slice(1)}`) : "";
        const style = params.style ? tScene(`style${params.style.charAt(0).toUpperCase() + params.style.slice(1)}`) : "";
        return [room, style].filter(Boolean).join(" · ");
      } catch {
        return "";
      }
    }
    return "";
  };

  const getModeLabel = (mode: string): string => {
    const key = MODE_LABELS[mode];
    return key ? t(key) : mode;
  };

  // --- Render ---

  const remaining = total - records.length;
  const hasMore = remaining > 0;

  return (
    <main className="min-h-screen relative flex flex-col items-center pt-20 pb-6 px-4 sm:px-6 lg:px-8 overflow-x-hidden text-zinc-900 z-0">
      {/* Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#f5f5f7]">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-100/60 blur-[130px] rounded-full opacity-70 animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-100/40 blur-[150px] rounded-full opacity-60" />
      </div>

      <div className="w-full max-w-3xl flex flex-col items-center z-10 space-y-5">
        {/* Header */}
        <header className="text-center w-full space-y-1.5">
          <motion.h1
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight inline-flex items-center gap-3"
          >
            <History className="w-9 h-9 text-zinc-600 shrink-0" />
            <span className="text-gradient">{t("title")}</span>
          </motion.h1>
        </header>

        {/* Loading state while user is being resolved */}
        {!user ? (
          <div className="w-full flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide w-full justify-center">
              {TABS.map((tab) => (
                <button
                  key={tab.labelKey}
                  onClick={() => handleTabChange(tab.key)}
                  className={`relative px-4 py-1.5 text-sm font-medium rounded-full border transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? "bg-zinc-800 text-white border-zinc-800"
                      : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-zinc-800 rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>

            {/* Total count */}
            {!loading && total > 0 && (
              <p className="text-xs text-zinc-400">{t("totalRecords", { count: total })}</p>
            )}

            {/* Content */}
            <AnimatePresence mode="wait">
              {loading ? (
                /* Skeleton */
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-panel rounded-2xl overflow-hidden">
                      <div className="aspect-video bg-zinc-200/60 animate-shimmer" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 w-32 rounded bg-zinc-200/60 animate-shimmer" />
                        <div className="h-3 w-20 rounded bg-zinc-200/60 animate-shimmer" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : records.length === 0 ? (
                /* Empty state */
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-zinc-400 w-full"
                >
                  {(() => {
                    const config: Record<string, { icon: any; msg: string; cta: string; href: string }> = {
                      fabric: { icon: Sparkles, msg: t("noFabricRecords"), cta: t("ctaFabric"), href: "/app" },
                      "multi-fabric": { icon: Layers, msg: t("noMultiFabricRecords"), cta: t("ctaMultiFabric"), href: "/app/multi-fabric" },
                      scene: { icon: ImageIcon, msg: t("noSceneRecords"), cta: t("ctaScene"), href: "/app/scene" },
                      "3d": { icon: Box, msg: "暂无 3D 生成记录", cta: "去体验 3D 生成", href: "/app" },
                    };
                    const c = activeTab ? config[activeTab] : null;
                    const Icon = c?.icon ?? History;
                    return (
                      <>
                        <Icon className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm mb-4">{c?.msg ?? t("noRecords")}</p>
                        <Link
                          href={c?.href ?? "/"}
                          className="px-4 py-2 text-sm rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 font-medium transition-colors"
                        >
                          {c?.cta ?? t("ctaStart")}
                        </Link>
                      </>
                    );
                  })()}
                </motion.div>
              ) : (
                /* Records grid */
                <motion.div
                  key={`records-${activeTab ?? "all"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {records.map((record) => {
                    const isExpanded = expandedId === record.id;
                    const badge = TYPE_BADGE[record.type];
                    return (
                      <div key={record.id} className={`${isExpanded ? "md:col-span-2" : ""}`}>
                        <motion.div
                          layout
                          className="glass-panel rounded-2xl overflow-hidden cursor-pointer hover:border-zinc-300 transition-colors"
                          onClick={() => handleToggleExpand(record.id)}
                        >
                          {/* Thumbnail */}
                          <div className="aspect-video relative overflow-hidden bg-zinc-100">
                            {record.resultImageUrl ? (
                              <img
                                src={record.resultImageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Box className="w-12 h-12 text-zinc-300" />
                              </div>
                            )}
                            {record.type === "3d" && !is3DCompleted(record) && STATUS_3D_BADGE[get3DStatus(record)] && (
                              <div className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_3D_BADGE[get3DStatus(record)].bg} ${STATUS_3D_BADGE[get3DStatus(record)].text} ${STATUS_3D_BADGE[get3DStatus(record)].pulse ? "animate-pulse" : ""}`}>
                                {STATUS_3D_BADGE[get3DStatus(record)].label}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-3 space-y-1">
                            <p className="text-sm font-semibold text-zinc-800 truncate">
                              {getCardTitle(record)}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <span>{getModeLabel(record.mode)}</span>
                              <span>·</span>
                              <span>{timeAgo(record.createdAt, t)}</span>
                            </div>
                            {/* Type badge — only in "全部" tab */}
                            {activeTab === null && badge && (
                              <span
                                className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.bg} ${badge.text}`}
                              >
                                {t(badge.labelKey)}
                              </span>
                            )}
                          </div>
                        </motion.div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              ref={expandedRef}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="pt-3 space-y-3">
                                {/* Content: 3D viewer or Before/After */}
                                {record.type === "3d" ? (
                                  is3DCompleted(record) && record.modelUrl ? (
                                    <div className="glass-panel rounded-2xl overflow-hidden">
                                      <Inline3DViewer modelUrl={record.modelUrl} />
                                    </div>
                                  ) : is3DInProgress(record) ? (
                                    <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-3">
                                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                      <p className="text-sm text-zinc-500">
                                        {STATUS_3D_BADGE[get3DStatus(record)]?.label ?? "处理中..."}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-3">
                                      <Box className="w-8 h-8 text-zinc-300" />
                                      <p className="text-sm text-zinc-400">
                                        {STATUS_3D_BADGE[get3DStatus(record)]?.label ?? "不可用"}
                                      </p>
                                    </div>
                                  )
                                ) : (
                                  <div className="glass-panel rounded-2xl overflow-hidden">
                                    <BeforeAfterSlider
                                      beforeImage={record.inputImageUrl}
                                      afterImage={record.resultImageUrl}
                                    />
                                  </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex items-center gap-2 justify-end">
                                  {record.type === "3d" && is3DCompleted(record) && record.modelUrl ? (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          downloadImage(record.resultImageUrl, `generation_${Date.now()}.jpg`);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-sm font-medium transition-colors"
                                      >
                                        <ImageIcon className="w-4 h-4" />
                                        {t("download")}
                                      </button>
                                      <a
                                        href={record.modelUrl}
                                        download={`model_${Date.now()}.glb`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-sm font-medium transition-colors"
                                      >
                                        <Box className="w-4 h-4" />
                                        GLB
                                      </a>
                                    </>
                                  ) : record.type !== "3d" || is3DCompleted(record) ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadImage(record.resultImageUrl, `generation_${Date.now()}.jpg`);
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-sm font-medium transition-colors"
                                    >
                                      <Download className="w-4 h-4" />
                                      {t("download")}
                                    </button>
                                  ) : null}
                                  {record.shareHash && (record.type !== "3d" || is3DCompleted(record)) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const prefix = record.type === "3d" ? "/m/" : "/r/";
                                        const isPosterType = record.type === "fabric" || record.type === "multi-fabric";
                                        setShareModalData({
                                          shareUrl: `${window.location.origin}${prefix}${record.shareHash}`,
                                          generation: isPosterType ? {
                                            shareHash: record.shareHash!,
                                            type: record.type,
                                          } : undefined,
                                        });
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 text-sm font-medium transition-colors"
                                    >
                                      <Share2 className="w-4 h-4" />
                                      {t("share")}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmId(record.id);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm font-medium transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {t("delete")}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Load more */}
            {!loading && hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("loading")}
                  </>
                ) : (
                  t("loadMoreRemaining", { count: remaining })
                )}
              </button>
            )}

            {!loading && !hasMore && records.length > 0 && (
              <p className="text-xs text-zinc-300">{t("allLoaded")}</p>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 max-w-sm w-full mx-4 border border-zinc-200/80 shadow-2xl text-center space-y-4"
            >
              <p className="text-sm text-zinc-700">{t("deleteConfirm")}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 text-sm font-medium transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
                >
                  {t("delete")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {shareModalData && (
          <ShareModal
            shareUrl={shareModalData.shareUrl}
            generation={shareModalData.generation}
            onClose={() => setShareModalData(null)}
          />
        )}
      </AnimatePresence>

    </main>
  );
}
