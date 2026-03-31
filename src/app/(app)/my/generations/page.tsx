import { getAuthUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "我的生成记录 — Textura",
};

type MaterialSnapshot = {
  name?: string;
  color?: string;
  swatchUrl?: string;
};

export default async function GenerationsPage() {
  const { userId } = await getAuthUser();

  const generations = await prisma.generation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      resultImageUrl: true,
      shareHash: true,
      materialSnapshot: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">我的生成记录</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        你使用 AI 生成的所有材质效果图
      </p>

      {generations.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ImageOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-lg font-medium">暂无生成记录</p>
          <p className="mt-1 text-sm text-muted-foreground">
            前往厂商页面，上传家具照片并选择材质即可体验 AI 换装
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {generations.map((gen) => {
            const snapshot = gen.materialSnapshot as MaterialSnapshot;
            const shareUrl = gen.shareHash ? `/s/${gen.shareHash}` : null;
            const label = [snapshot.name, snapshot.color]
              .filter(Boolean)
              .join(" ");

            return (
              <Link
                key={gen.id}
                href={shareUrl ?? "#"}
                className="group overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    src={
                      gen.resultImageUrl.startsWith("http")
                        ? gen.resultImageUrl
                        : `${SITE_URL}${gen.resultImageUrl}`
                    }
                    alt={label || "AI 生成效果"}
                    fill
                    className="object-cover transition-transform group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">
                    {label || "AI 生成"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {gen.createdAt.toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
