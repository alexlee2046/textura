"use client";

import { useEffect } from "react";
import { isWechat } from "@/lib/shareUtils";
import { type WechatShareData } from "@/lib/wechatShareEvent";
import { sendDefaultShareData } from "@/lib/miniProgramShare";

declare global {
  interface Window {
    wx?: {
      config: (options: {
        debug?: boolean;
        appId: string;
        timestamp: number;
        nonceStr: string;
        signature: string;
        jsApiList: string[];
      }) => void;
      ready: (fn: () => void) => void;
      error: (fn: (res: { errMsg: string }) => void) => void;
      updateAppMessageShareData: (options: {
        title: string;
        desc: string;
        link: string;
        imgUrl: string;
        success?: () => void;
      }) => void;
      updateTimelineShareData: (options: {
        title: string;
        link: string;
        imgUrl: string;
        success?: () => void;
      }) => void;
    };
  }
}

export default function WechatShare() {
  useEffect(() => {
    // 立即发送默认分享数据，确保首次分享有数据可用
    sendDefaultShareData();

    if (!isWechat) return;

    const script = document.createElement("script");
    script.src = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
    script.onload = initWechatSdk;
    document.head.appendChild(script);

    const handler = (e: Event) => {
      const data = (e as CustomEvent<WechatShareData>).detail;
      const wx = window.wx;
      if (!wx) return;

      wx.updateAppMessageShareData({
        title: data.title,
        desc: data.desc || "免费体验 AI 换面料，选面料一键焕新你的家具",
        link: data.link,
        imgUrl: data.imgUrl,
      });

      wx.updateTimelineShareData({
        title: data.title,
        link: data.link,
        imgUrl: data.imgUrl,
      });
    };

    window.addEventListener("wechat-share-update", handler);

    return () => {
      document.head.removeChild(script);
      window.removeEventListener("wechat-share-update", handler);
    };
  }, []);

  return null;
}

async function initWechatSdk() {
  const wx = window.wx;
  if (!wx) return;

  try {
    const url = window.location.href.split("#")[0];
    const res = await fetch(`/api/wechat/signature?url=${encodeURIComponent(url)}`);
    if (!res.ok) return;

    const { appId, timestamp, nonceStr, signature } = await res.json();

    wx.config({
      debug: false,
      appId,
      timestamp,
      nonceStr,
      signature,
      jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
    });

    wx.ready(() => {
      const shareData = {
        title: "拍张照就能换面料，效果超真实",
        desc: "免费体验 AI 换面料，选面料一键焕新你的家具",
        link: window.location.href,
        imgUrl: `${window.location.origin}/api/share-card/default`,
      };

      wx.updateAppMessageShareData({ ...shareData });

      wx.updateTimelineShareData({
        title: shareData.title,
        link: shareData.link,
        imgUrl: shareData.imgUrl,
      });
    });

    wx.error((res) => {
      console.error("WeChat JS-SDK error:", res.errMsg);
    });
  } catch (err) {
    console.error("WeChat SDK init failed:", err);
  }
}
