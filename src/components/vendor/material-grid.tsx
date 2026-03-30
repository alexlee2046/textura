"use client";

import { useCallback, useEffect, useState } from "react";
import { MaterialCard } from "./material-card";

type Material = {
  id: string;
  name: string;
  category: string;
  color: string | null;
  imageUrl: string | null;
};

const CATEGORIES = [
  { key: "", label: "全部" },
  { key: "fabric", label: "布料" },
  { key: "leather", label: "皮料" },
  { key: "wood", label: "木皮" },
  { key: "stone", label: "石材" },
  { key: "tile", label: "瓷砖" },
  { key: "carpet", label: "地毯" },
  { key: "wallpaper", label: "墙纸" },
  { key: "metal", label: "金属" },
];

type MaterialGridProps = {
  orgSlug: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function MaterialGrid({
  orgSlug,
  selectedId,
  onSelect,
}: MaterialGridProps) {
  const [category, setCategory] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ org_slug: orgSlug });
      if (category) params.set("category", category);
      const res = await fetch(`/api/materials?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } finally {
      setLoading(false);
    }
  }, [orgSlug, category]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setCategory(cat.key)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              category === cat.key
                ? "bg-primary text-primary-foreground"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-1.5 h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
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
              category={m.category}
              imageUrl={m.imageUrl}
              selected={selectedId === m.id}
              onClick={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
