"use client";

import dynamic from "next/dynamic";

const ViewerPageClient = dynamic(
  () =>
    import("@/features/viewer/ViewerPageClient").then((m) => ({
      default: m.ViewerPageClient,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        Loading 3D Viewer...
      </div>
    ),
  },
);

export default function ViewerPage() {
  return <ViewerPageClient />;
}
