import { isWechatMiniProgram } from "./shareUtils";

/**
 * 向微信小程序发送分享数据。
 * 在小程序 web-view 中，postMessage 的数据会在用户触发分享时送达。
 * imageUrl 用于朋友圈分享卡片（onShareTimeline）。
 */
export function postShareToMiniProgram(params: {
  title: string;
  shareHash: string;
  imageUrl?: string;
  refCode?: string;
}) {
  if (!isWechatMiniProgram()) return;
  try {
    const wx = (window as any).wx;
    wx?.miniProgram?.postMessage({
      data: {
        type: "share",
        title: params.title,
        shareHash: params.shareHash,
        imageUrl: params.imageUrl || "",
        refCode: params.refCode || "",
      },
    });
  } catch {
    // 静默失败 -- 非小程序环境或 JSSDK 未加载
  }
}

/**
 * 页面加载后立即发送默认分享数据。
 * postMessage 的数据在分享触发时才批量到达小程序端，
 * 所以必须在页面加载后就发一次，确保首次分享有数据可用。
 */
let defaultSent = false;
export function sendDefaultShareData() {
  if (defaultSent || !isWechatMiniProgram()) return;
  defaultSent = true;
  try {
    const wx = (window as any).wx;
    wx?.miniProgram?.postMessage({
      data: {
        type: "share",
        title: "拍张照就能换面料，效果超真实",
        shareHash: "",
        imageUrl: `${window.location.origin}/api/share-card/default`,
      },
    });
  } catch {
    // silent
  }
}
