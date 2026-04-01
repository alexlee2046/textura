export type FurnitureType =
  | "upholstered"
  | "glass"
  | "metal-frame"
  | "stone-top"
  | "wood"
  | "mixed";

export interface PromptParams {
  width: number;
  depth: number;
  height: number;
  furnitureType: FurnitureType;
  viewIndex?: 1 | 2;
  feedback?: string;
}

const BASE_PROMPT = `You are a professional product photography retouching specialist preparing furniture images for AI 3D model generation.

TASK: Transform the provided furniture product photo into an optimized image suitable for high-quality AI 3D model reconstruction.

CRITICAL CONTEXT: The output image will be DIRECTLY fed into a 3D generation AI to generate a 3D model. Therefore, the object MUST be completely isolated, fully intact without missing parts, and clearly visible at the correct angle.

REQUIREMENTS:
1. BACKGROUND REMOVAL: If the image has a complex background, you MUST cleanly extract and isolate the main furniture object. Place it on a pure white background (#FFFFFF). No shadows, reflections, or ground contact.
2. VIEWING ANGLE & COMPLETION: 3/4 elevated perspective — ~35° azimuth, ~20° elevation. If the source has missing/cropped parts or is at a suboptimal angle, you MUST infer and complete the missing structures and angles. Do not leave any structural parts cut off.
3. LIGHTING: Even, diffuse, from all directions. No directional shadows or hotspots.
4. MATERIAL FIDELITY: Reproduce every surface EXACTLY. Do NOT add/modify textures.
5. STRUCTURAL COMPLETENESS: Complete any cropped parts matching existing design language. Ensure all structural elements are physically connected.
6. EDGE CLARITY: Thin elements (legs, frames) must have strong contrast against white.
7. SCALE: Product fills ~80-85% of frame, centered, even padding.
8. DO NOT: Add decorative elements, correct asymmetry, change proportions, add context objects.`;

const FURNITURE_MODIFIERS: Record<FurnitureType, string> = {
  upholstered: `\nFURNITURE-SPECIFIC (Upholstered):\n- Preserve fabric/leather texture and wrinkle patterns precisely\n- Maintain exact cushion volume and plumpness — do not flatten or inflate\n- Show seam lines and stitching clearly as these define 3D panel structure\n- Preserve any tufting, piping, or quilting patterns exactly`,
  glass: `\nFURNITURE-SPECIFIC (Glass/Transparent Elements):\n- Render glass with subtle edge highlights to maintain visibility against white\n- Glass must read as transparent with visible thickness at edges\n- Do NOT make glass invisible or fully opaque — maintain realistic transparency\n- Show objects/structure visible through glass to establish transparency`,
  "metal-frame": `\nFURNITURE-SPECIFIC (Metal Frame):\n- Maintain maximum contrast on thin metal elements against white background\n- Preserve exact metal finish: matte, brushed, polished, or powder-coated\n- Show clear physical connection points between frame and other components\n- Metal tube/bar cross-section shape must be accurate (round, square, flat)`,
  "stone-top": `\nFURNITURE-SPECIFIC (Stone/Marble Top):\n- Preserve exact vein/pattern, direction, and color variation in stone\n- Maintain stone edge profile (bullnose, beveled, waterfall, straight) clearly\n- Stone surface thickness must be visually accurate\n- Do NOT genericize the stone pattern — it must match the source exactly`,
  wood: `\nFURNITURE-SPECIFIC (Wood):\n- Preserve wood grain direction and consistency across all visible surfaces\n- Maintain exact wood tone — do not shift toward generic "wood brown"\n- Show joinery details if visible (dovetails, dowels, edge banding)\n- Distinguish between solid wood and veneer if visually apparent`,
  mixed: `\nFURNITURE-SPECIFIC (Mixed Materials):\n- Pay special attention to material transition zones (wood meets metal, glass meets frame, etc.)\n- Each material must maintain its own distinct surface characteristics\n- Connection/joint details between different materials must be clear and physically plausible`,
};

const SECOND_VIEW_MODIFIER = `\nMULTIVIEW SECOND IMAGE:\nGenerate the REAR 3/4 view (~210° azimuth, 20° elevation).\nShows: back face + opposite side + top.\nCRITICAL: Maintain EXACT consistency with the first view in:\n  materials, proportions, lighting, detail level.\nStructurally plausible back/rear — infer from visible design language.`;

export function buildEnhancePrompt(params: PromptParams): string {
  const { width, depth, height, furnitureType, viewIndex, feedback } = params;

  let prompt = BASE_PROMPT;
  prompt += `\n\nPHYSICAL DIMENSIONS: This product is approximately W${width} × D${depth} × H${height}mm. Maintain these proportions accurately.`;
  prompt += FURNITURE_MODIFIERS[furnitureType] ?? "";

  if (viewIndex === 2) {
    prompt += SECOND_VIEW_MODIFIER;
  }

  if (feedback) {
    prompt += `\n\nUSER FEEDBACK on previous generation:\n"${feedback}"\nPlease address this feedback while maintaining all other requirements.\nPrevious image is provided as reference context.`;
  }

  return prompt;
}
