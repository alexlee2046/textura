// src/lib/scenePromptMaps.ts
// Shared prompt maps used by both scene generation routes.

export const STYLE_MAP: Record<string, string> = {
  modern: "modern minimalist",
  nordic: "Scandinavian Nordic",
  luxury: "light luxury contemporary",
  chinese: "modern Chinese",
  industrial: "industrial loft",
};

export const ROOM_MAP: Record<string, string> = {
  living: "living room",
  bedroom: "bedroom",
  dining: "dining room",
  study: "home study",
};

export const LIGHT_MAP: Record<string, string> = {
  natural: "bright natural daylight streaming through large windows",
  dusk: "warm golden hour dusk light",
  night: "cozy evening artificial lighting",
  bright: "bright uniform studio lighting",
};
