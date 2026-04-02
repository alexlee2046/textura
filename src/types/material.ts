export type Material = {
  id: string;
  name: string;           // Series name, e.g. "CHLOE"
  seriesCode: string | null;
  category: string;       // "Fabric" | "Natural Fabric" | "Advanced" | "Leather"
  color: string | null;
  colorCode: string | null;
  imageUrl: string | null; // Full URL to material image (from MaterialImage)
};

export type SeriesEntry = {
  name: string;
  seriesCode: string | null;
  category: string;
  colorCount: number;
  representativeImage: string | null;
};
