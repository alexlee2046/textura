interface FabricInfo {
  name: string;
  color: string;
}

const cache = new Map<string, FabricInfo>();
let fetching: Promise<void> | null = null;

/**
 * 批量预取面料信息到内存缓存。
 * 调用后 getFabricInfo 可同步返回结果。
 */
export async function prefetchFabricInfo(fabricIds: string[]): Promise<void> {
  const missing = fabricIds.filter((id) => !cache.has(id));
  if (missing.length === 0) return;

  if (fetching) {
    await fetching;
    // 再查一次，可能已经填充了
    const stillMissing = missing.filter((id) => !cache.has(id));
    if (stillMissing.length === 0) return;
  }

  fetching = (async () => {
    try {
      const res = await fetch(
        `/api/fabrics?ids=${encodeURIComponent(missing.join(","))}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      for (const f of data.fabrics ?? []) {
        cache.set(f.id, { name: f.name, color: f.color });
      }
    } finally {
      fetching = null;
    }
  })();

  await fetching;
}

/**
 * 同步获取面料信息（需先 prefetchFabricInfo）。
 */
export function getFabricInfo(fabricId: string): FabricInfo | null {
  return cache.get(fabricId) ?? null;
}
