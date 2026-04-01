export interface WechatShareData {
  title: string;
  desc?: string;
  link: string;
  imgUrl: string;
}

/** 分发自定义事件，WechatShare 组件监听后调用 JS-SDK 更新分享数据 */
export function updateWechatShareData(data: WechatShareData) {
  window.dispatchEvent(
    new CustomEvent("wechat-share-update", { detail: data })
  );
}
