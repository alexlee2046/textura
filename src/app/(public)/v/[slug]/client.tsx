"use client";

import { useState } from "react";
import { MaterialGrid } from "@/components/vendor/material-grid";
import { Button } from "@/components/ui/button";
import Image from "next/image";

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
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(
    null,
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

        {/* AI retexture tool placeholder — Sprint 2 */}
        <div className="mt-6 flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm text-muted-foreground">
            AI 换材效果预览 (Sprint 2)
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">选择材质</h2>
        <MaterialGrid
          orgSlug={orgSlug}
          selectedId={selectedMaterialId}
          onSelect={setSelectedMaterialId}
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
            {selectedMaterialId ? "已选择 1 种材质" : "请选择材质"}
          </span>
          <Button size="lg" disabled={!selectedMaterialId}>
            申请样品
          </Button>
        </div>
      </div>

      <div className="h-16" />
    </div>
  );
}
