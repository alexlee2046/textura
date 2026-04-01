const STORAGE_KEY = "xinvise_ref";

/** 从 URL 提取 ref 参数并存入 localStorage */
export function captureReferralCode() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && ref.length >= 4) {
    localStorage.setItem(STORAGE_KEY, ref);
    // 清除 URL 中的 ref 参数（不刷新页面）
    params.delete("ref");
    const clean = params.toString();
    const newUrl = window.location.pathname + (clean ? `?${clean}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }
}

/** 登录后尝试领取邀请奖励（仅执行一次） */
export async function claimReferralIfNeeded(): Promise<{ bonus: number } | null> {
  if (typeof window === "undefined") return null;
  const code = localStorage.getItem(STORAGE_KEY);
  if (!code) return null;

  try {
    const res = await fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: code }),
    });

    // 无论成功还是"Already referred"，都清除 localStorage
    localStorage.removeItem(STORAGE_KEY);

    if (res.ok) {
      const data = await res.json();
      return { bonus: data.bonus };
    }
    return null;
  } catch {
    return null;
  }
}

/** 获取当前用户的邀请码（带缓存） */
let cachedCode: string | null = null;
let fetching: Promise<string | null> | null = null;

export async function getMyReferralCode(): Promise<string | null> {
  if (cachedCode) return cachedCode;
  if (fetching) return fetching;

  fetching = (async () => {
    try {
      const res = await fetch("/api/referral");
      if (!res.ok) return null;
      const data = await res.json();
      cachedCode = data.referralCode ?? null;
      return cachedCode;
    } catch {
      return null;
    } finally {
      fetching = null;
    }
  })();

  return fetching;
}

/** 给 URL 附加 ref 参数 */
export function appendRef(url: string, refCode: string | null): string {
  if (!refCode) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}ref=${refCode}`;
}

/** 重置缓存（登出时调用） */
export function clearReferralCache() {
  cachedCode = null;
}
