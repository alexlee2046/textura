"use client";

import { useCallback, useState } from "react";
import { MaterialGrid } from "@/components/vendor/material-grid";
import { RetextureTool } from "@/components/vendor/retexture-tool";
import { Button } from "@/components/ui/button";
import Image from "next/image";

type SelectedMaterial = {
  id: string;
  name: string;
  color: string | null;
  imageUrl: string | null;
};

type VendorPageClientProps = {
  orgName: string;
  orgSlug: string;
  description: string | null;
  wechatQr: string | null;
  materialCount: number;
};

export function VendorPageClient({
  orgName,
  orgSlug,
  description,
  wechatQr,
  materialCount,
}: VendorPageClientProps) {
  const [selectedMaterial, setSelectedMaterial] =
    useState<SelectedMaterial | null>(null);

  const handleMaterialSelect = useCallback(
    (material: { id: string; name: string; color: string | null; imageUrl: string | null }) => {
      setSelectedMaterial(material);
    },
    [],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900 md:p-8">
        <h1 className="text-2xl font-bold md:text-3xl">
          在你的家具上试试{" "}
          <span className="text-primary">{orgName}</span> 的材质
        </h1>
        <p className="mt-2 text-muted-foreground">
          共 {materialCount} 种材质可供选择
        </p>

        <RetextureTool
          orgSlug={orgSlug}
          selectedMaterial={selectedMaterial}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">选择材质</h2>
        <MaterialGrid
          orgSlug={orgSlug}
          selectedId={selectedMaterial?.id ?? null}
          onSelect={handleMaterialSelect}
        />
      </section>

      {(description || wechatQr) && (
        <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900 md:p-8">
          <h2 className="mb-4 text-lg font-semibold">关于 {orgName}</h2>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
          {wechatQr && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                微信扫码联系
              </p>
              <Image
                src={wechatQr}
                alt="WeChat QR"
                width={160}
                height={160}
                className="rounded-lg"
              />
            </div>
          )}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/90 backdrop-blur-md dark:bg-zinc-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <span className="text-sm text-muted-foreground">
            {selectedMaterial ? "已选择 1 种材质" : "请选择材质"}
          </span>
          <Button size="lg" disabled={!selectedMaterial}>
            申请样品
          </Button>
        </div>
      </div>

      <div className="h-16" />
    </div>
  );
}
