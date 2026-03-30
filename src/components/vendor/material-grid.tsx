"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MATERIAL_CATEGORIES } from "@/lib/constants";
import { MaterialCard } from "./material-card";

type Material = {
  id: string;
  name: string;
  color: string | null;
  imageUrl: string | null;
};

const ALL_CATEGORY = { key: "", label: "全部" } as const;

type MaterialGridProps = {
  orgSlug: string;
  selectedId: string | null;
  onSelect: (material: Material) => void;
};

export function MaterialGrid({
  orgSlug,
  selectedId,
  onSelect,
}: MaterialGridProps) {
  const [category, setCategory] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ org_slug: orgSlug });
        if (category) params.set("category", category);
        const res = await fetch(`/api/materials?${params}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMaterials(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("加载失败，请稍后重试");
        }
      } finally {
        setLoading(false);
      }
    },
    [orgSlug, category],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMaterials(controller.signal);
    return () => controller.abort();
  }, [fetchMaterials]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[ALL_CATEGORY, ...MATERIAL_CATEGORIES].map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setCategory(cat.key)}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              category === cat.key
                ? "bg-primary text-primary-foreground"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-1.5 h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center text-destructive">{error}</div>
      ) : materials.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          暂无材质
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {materials.map((m) => (
            <MaterialCard
              key={m.id}
              id={m.id}
              name={m.name}
              color={m.color}
              imageUrl={m.imageUrl}
              selected={selectedId === m.id}
              onClick={() => onSelect(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
