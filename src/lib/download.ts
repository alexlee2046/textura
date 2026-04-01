import { isWechatMiniProgram } from "./shareUtils";

/**
 * Trigger a browser download for the given URL.
 * In WeChat miniprogram WebView, shows a long-press guidance toast instead,
 * because <a download> does not work reliably (especially on iOS).
 */
export function downloadImage(url: string, filename?: string) {
  if (isWechatMiniProgram()) {
    showLongPressGuide();
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? `image_${Date.now()}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Show a floating toast guiding user to long-press the image to save. */
function showLongPressGuide() {
  if (document.getElementById("mp-save-guide")) return;

  const el = document.createElement("div");
  el.id = "mp-save-guide";
  el.style.cssText =
    "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;" +
    "background:rgba(0,0,0,0.8);color:#fff;padding:12px 24px;border-radius:12px;" +
    "font-size:14px;white-space:nowrap;pointer-events:none;" +
    "animation:mp-fade-in 0.3s ease";
  el.textContent = "长按图片即可保存到相册";
  document.body.appendChild(el);

  if (!document.getElementById("mp-save-guide-style")) {
    const style = document.createElement("style");
    style.id = "mp-save-guide-style";
    style.textContent =
      "@keyframes mp-fade-in{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}";
    document.head.appendChild(style);
  }

  setTimeout(() => {
    el.remove();
    document.getElementById("mp-save-guide-style")?.remove();
  }, 3000);
}
