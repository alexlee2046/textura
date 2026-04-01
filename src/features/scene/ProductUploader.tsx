// src/features/scene/ProductUploader.tsx
"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, ImageIcon } from "lucide-react";

export interface ProductEntry {
  id: string;
  name: string;
  file: File | null;
  previewUrl: string | null;
  width: number;   // cm
  depth: number;   // cm
  height: number;  // cm
  bgRemoval: boolean; // test toggle, off by default
}

interface Props {
  products: ProductEntry[];
  onChange: (products: ProductEntry[]) => void;
}

const MAX_PRODUCTS = 10;

export function makeEmptyProduct(): ProductEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    file: null,
    previewUrl: null,
    width: 100,
    depth: 80,
    height: 85,
    bgRemoval: false,
  };
}

export default function ProductUploader({ products, onChange }: Props) {
  const t = useTranslations("ProductUploader");

  const add = () => {
    if (products.length >= MAX_PRODUCTS) return;
    onChange([...products, makeEmptyProduct()]);
  };

  const remove = (id: string) => {
    const target = products.find((p) => p.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(products.filter((p) => p.id !== id));
  };

  const update = (id: string, patch: Partial<ProductEntry>) =>
    onChange(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const handleFile = (id: string, file: File) => {
    const existing = products.find((p) => p.id === id);
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    update(id, { file, previewUrl });
  };

  return (
    <div className="flex flex-col gap-3">
      {products.map((p) => (
        <ProductSlot
          key={p.id}
          product={p}
          onRemove={() => remove(p.id)}
          onFile={(f) => handleFile(p.id, f)}
          onUpdate={(patch) => update(p.id, patch)}
          t={t}
        />
      ))}

      {products.length < MAX_PRODUCTS && (
        <button
          onClick={add}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors w-full text-sm"
        >
          <Plus className="w-4 h-4" />
          {t("addProduct")} ({products.length}/{MAX_PRODUCTS})
        </button>
      )}
    </div>
  );
}

function ProductSlot({
  product, onRemove, onFile, onUpdate, t,
}: {
  product: ProductEntry;
  onRemove: () => void;
  onFile: (f: File) => void;
  onUpdate: (p: Partial<ProductEntry>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 backdrop-blur p-3 flex gap-3 items-start">
      {/* Image zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) onFile(f); }}
        onDragOver={(e) => e.preventDefault()}
        className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center cursor-pointer hover:border-zinc-400 overflow-hidden bg-zinc-50"
      >
        {product.previewUrl
          ? <img src={product.previewUrl} alt="" className="w-full h-full object-contain" />
          : <ImageIcon className="w-7 h-7 text-zinc-300" />
        }
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </div>

      {/* Fields */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <input
          type="text"
          placeholder={t("productName")}
          value={product.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
        <div className="flex gap-1.5">
          {(["width", "depth", "height"] as const).map((dim) => (
            <label key={dim} className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wide">
                {t(`${dim}Cm` as "widthCm")}
              </span>
              <input
                type="number" min={1} max={1000}
                value={product[dim]}
                onChange={(e) => onUpdate({ [dim]: Number(e.target.value) })}
                className="rounded-lg border border-zinc-200 px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400 w-full"
              />
            </label>
          ))}
        </div>

        {/* BG Removal test toggle */}
        <button
          onClick={() => onUpdate({ bgRemoval: !product.bgRemoval })}
          title={t("bgRemovalHint")}
          className={`self-start flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            product.bgRemoval
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${product.bgRemoval ? "bg-blue-500" : "bg-zinc-300"}`} />
          {t("bgRemoval")}
        </button>
      </div>

      <button onClick={onRemove} className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-red-500 transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
