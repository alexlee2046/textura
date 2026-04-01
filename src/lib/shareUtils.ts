export const isWechat =
  typeof navigator !== "undefined" &&
  /MicroMessenger/i.test(navigator.userAgent);

export const isMobile =
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const canNativeShare =
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function";

/** Running inside WeChat mini-program's <web-view> */
export function isWechatMiniProgram(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /miniProgram/i.test(navigator.userAgent) ||
    (window as unknown as Record<string, unknown>).__wxjs_environment === "miniprogram"
  );
}

/** iOS device (for WebKit-specific workarounds) */
export const isIOS =
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);