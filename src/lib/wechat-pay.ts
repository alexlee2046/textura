// src/lib/wechat-pay.ts
// Payment infrastructure — everything gated behind PAYMENT_ENABLED feature flag.

export const isPaymentEnabled = process.env.PAYMENT_ENABLED === "true";

// Credit packages available for purchase
export const CREDIT_PACKAGES = [
  { id: "pack_50", credits: 50, priceYuan: 49, label: "50 积分" },
  { id: "pack_200", credits: 200, priceYuan: 149, label: "200 积分" },
  { id: "pack_1000", credits: 1000, priceYuan: 499, label: "1000 积分" },
] as const;

export type CreditPackage = (typeof CREDIT_PACKAGES)[number];

// WeChat Pay configuration (only initialized when enabled)
export function getWechatPayConfig() {
  if (!isPaymentEnabled) return null;
  return {
    appid: process.env.WECHAT_PAY_APP_ID ?? "",
    mchid: process.env.WECHAT_PAY_MCH_ID ?? "",
    apiKey: process.env.WECHAT_PAY_API_KEY ?? "",
    notifyUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/wechat/notify`,
  };
}
