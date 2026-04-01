export interface Fabric {
  id: string;
  name: string;        // Series name, e.g. "CHLOE"
  seriesCode: string;  // Series number, e.g. "0937"
  brand: "Elastron" | "Magenta";
  category: "Fabric" | "Natural Fabric" | "Advanced" | "Leather";
  color: string;       // Color name, e.g. "OLDROSE"
  colorCode: string;   // Full color code, e.g. "0937.0998"
  image: string;
  promptModifier: string;
}

/** 400x400 thumbnail path for series cards and expanded views */
export function thumbUrl(image: string): string {
  return image.replace("/fabrics/", "/fabrics/thumb/");
}

/** 120x120 micro thumbnail for small color swatches and preview bars */
export function microUrl(image: string): string {
  return image.replace("/fabrics/", "/fabrics/micro/");
}

/** Map API fabric record (imagePath) to client Fabric type (image) */
export function apiFabricToFabric(f: Record<string, unknown>): Fabric {
  return {
    id: f.id as string,
    name: f.name as string,
    seriesCode: f.seriesCode as string,
    brand: f.brand as Fabric["brand"],
    category: f.category as Fabric["category"],
    color: f.color as string,
    colorCode: f.colorCode as string,
    image: f.imagePath as string,
    promptModifier: f.promptModifier as string,
  };
}
