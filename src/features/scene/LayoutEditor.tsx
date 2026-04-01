// src/features/scene/LayoutEditor.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import { ProductEntry } from "./ProductUploader";

export interface PlacedProduct {
  id: string;
  name: string;
  fx: number;   // 0-1 normalized
  fy: number;   // 0-1 normalized (0=front, 1=back)
  rotation: number; // 0 | 90 | 180 | 270
}

interface Props {
  products: ProductEntry[];
  placements: PlacedProduct[];
  onPlacementsChange: (p: PlacedProduct[]) => void;
  roomWidthM: number;
  roomDepthM: number;
}

/* Base dimensions used as the reference for proportional scaling */
const BASE_W = 560;
const BASE_H = 380;
const ASPECT = BASE_W / BASE_H;

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

export default function LayoutEditor({ products, placements, onPlacementsChange, roomWidthM, roomDepthM }: Props) {
  const t = useTranslations("SceneSetup");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(BASE_W);

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Derived stage dimensions -- scale proportionally from container width, capped at 800px
  const dims = useMemo(() => {
    const stageW = Math.min(containerWidth, 800);
    const stageH = Math.round(stageW / ASPECT);
    const scale = stageW / BASE_W;
    const pad = Math.round(24 * scale);
    const gridW = stageW - pad * 2;
    const gridH = stageH - pad * 2;
    const gridStep = Math.max(16, Math.round(40 * scale));
    return { stageW, stageH, scale, pad, gridW, gridH, gridStep };
  }, [containerWidth]);

  const snapToGrid = useCallback(
    (v: number) => Math.round(v / dims.gridStep) * dims.gridStep,
    [dims.gridStep],
  );

  const productPxSize = useCallback(
    (p: ProductEntry) => {
      const minSize = Math.max(18, Math.round(24 * dims.scale));
      const pw = Math.max(minSize, (p.width / (roomWidthM * 100)) * dims.gridW);
      const pd = Math.max(minSize, (p.depth / (roomDepthM * 100)) * dims.gridH);
      return { pw, pd };
    },
    [dims.scale, dims.gridW, dims.gridH, roomWidthM, roomDepthM],
  );

  // Sync: add new products, remove deleted ones
  useEffect(() => {
    const existingIds = new Set(placements.map((p) => p.id));
    const newProds = products.filter((p) => !existingIds.has(p.id));
    const validPlacements = placements.filter((pl) => products.find((p) => p.id === pl.id));

    if (newProds.length === 0 && validPlacements.length === placements.length) return;

    const added: PlacedProduct[] = newProds.map((p, i) => ({
      id: p.id,
      name: p.name || `P${placements.length + i + 1}`,
      fx: 0.1 + ((placements.length + i) * 0.12) % 0.75,
      fy: 0.3 + ((placements.length + i) * 0.1) % 0.55,
      rotation: 0,
    }));

    onPlacementsChange([...validPlacements, ...added]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // Update names when product names change
  useEffect(() => {
    const updated = placements.map((pl) => {
      const prod = products.find((p) => p.id === pl.id);
      return prod && prod.name && prod.name !== pl.name ? { ...pl, name: prod.name } : pl;
    });
    if (updated.some((pl, i) => pl !== placements[i])) {
      onPlacementsChange(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.map((p) => p.name).join(",")]);

  const updatePlacement = (id: string, patch: Partial<PlacedProduct>) =>
    onPlacementsChange(placements.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const { stageW, stageH, scale, pad, gridW, gridH, gridStep } = dims;

  // Grid lines -- recomputed when dimensions change
  const gridLines: React.ReactElement[] = [];
  for (let x = pad; x <= pad + gridW; x += gridStep) {
    gridLines.push(<Line key={`gx${x}`} points={[x, pad, x, pad + gridH]} stroke="#e4e4e7" strokeWidth={1} />);
  }
  for (let y = pad; y <= pad + gridH; y += gridStep) {
    gridLines.push(<Line key={`gy${y}`} points={[pad, y, pad + gridW, y]} stroke="#e4e4e7" strokeWidth={1} />);
  }

  const fontSize = Math.max(9, Math.round(11 * scale));
  const labelFontSize = Math.max(8, Math.round(10 * scale));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-500">{t("layoutHint")}</p>
      <div ref={containerRef} className="w-full">
        <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-[#f9f9fb]">
          <Stage width={stageW} height={stageH}>
            <Layer>
              <Rect x={0} y={0} width={stageW} height={stageH} fill="#f9f9fb" />
              {gridLines}
              <Rect x={pad} y={pad} width={gridW} height={gridH} stroke="#a1a1aa" strokeWidth={2} fill="transparent" />
              <Text x={pad + gridW / 2 - Math.round(16 * scale)} y={Math.round(6 * scale)} text={`${roomWidthM}m`} fontSize={fontSize} fill="#a1a1aa" />
              <Text x={Math.round(4 * scale)} y={pad + gridH / 2 - Math.round(6 * scale)} text={`${roomDepthM}m`} fontSize={fontSize} fill="#a1a1aa" />

              {placements.map((pl, idx) => {
                const prod = products.find((p) => p.id === pl.id);
                if (!prod) return null;
                const { pw, pd } = productPxSize(prod);
                const cx = pad + pl.fx * gridW;
                const cy = pad + pl.fy * gridH;
                const color = COLORS[idx % COLORS.length];

                return (
                  <Group
                    key={pl.id}
                    x={cx}
                    y={cy}
                    rotation={pl.rotation}
                    draggable
                    dragBoundFunc={(pos) => {
                      const snappedX = snapToGrid(pos.x - pad) + pad;
                      const snappedY = snapToGrid(pos.y - pad) + pad;
                      return {
                        x: Math.min(Math.max(snappedX, pad), pad + gridW),
                        y: Math.min(Math.max(snappedY, pad), pad + gridH),
                      };
                    }}
                    onDragEnd={(e) => {
                      const nx = (e.target.x() - pad) / gridW;
                      const ny = (e.target.y() - pad) / gridH;
                      updatePlacement(pl.id, {
                        fx: Math.min(1, Math.max(0, nx)),
                        fy: Math.min(1, Math.max(0, ny)),
                      });
                    }}
                    onClick={() => updatePlacement(pl.id, { rotation: (pl.rotation + 90) % 360 })}
                    onTap={() => updatePlacement(pl.id, { rotation: (pl.rotation + 90) % 360 })}
                  >
                    <Rect
                      x={-pw / 2} y={-pd / 2} width={pw} height={pd}
                      fill={color + "33"} stroke={color} strokeWidth={2} cornerRadius={Math.round(4 * scale)}
                    />
                    <Text
                      x={-pw / 2} y={Math.round(-7 * scale)}
                      width={pw} height={Math.round(14 * scale)}
                      text={(pl.name || `P${idx + 1}`).slice(0, 12)}
                      fontSize={labelFontSize} fontStyle="bold" fill={color} align="center"
                    />
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
