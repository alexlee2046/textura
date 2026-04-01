import type { GenerationMode } from "../ModeSelector";
import type { UploadImage } from "../ImageUploadSlots";
import type { FurnitureType } from "@/lib/model3d-prompts";
import type { Model3DRegion } from "@/lib/model3d-schemas";

// ---------------------------------------------------------------------------
// Wizard step & status enums
// ---------------------------------------------------------------------------

export type WizardStep =
  | "setup"
  | "detecting"
  | "selecting"
  | "enhancing"
  | "review"
  | "generating";

export type WizardStatus =
  | "queued"
  | "running"
  | "downloading"
  | "completed"
  | "failed"
  | "refunded";

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface EnhanceResponse {
  imageUrl: string;
  generationId: string;
  enhanceCount: number;
  creditsRemaining?: number;
}

export interface GenerateResponse {
  generationId: string;
  status: string;
  creditsRemaining?: number | null;
}

export interface StatusResponse {
  status: string;
  progress?: number;
  modelUrl?: string;
  error?: string;
  creditsRemaining?: number;
}

// ---------------------------------------------------------------------------
// Props for the top-level wizard component
// ---------------------------------------------------------------------------

export interface Model3DWizardProps {
  userCredits: number;
  onClose: () => void;
  onModelLoaded: (file: File, generationId?: string) => void;
  onCreditsChange?: (credits: number) => void;
  onRefreshCredits?: () => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Return type of useModel3DGeneration
// ---------------------------------------------------------------------------

export interface Model3DGenerationState {
  // Step & status
  step: WizardStep;
  status: WizardStatus;
  loading: boolean;
  checkingActive: boolean;
  error: string | undefined;
  optimizingLabel: string;

  // Setup fields
  mode: GenerationMode;
  setMode: (m: GenerationMode) => void;
  furnitureType: FurnitureType | undefined;
  setFurnitureType: (t: FurnitureType | undefined) => void;
  dimensions: { width: number; depth: number; height: number };
  setDimensions: (d: { width: number; depth: number; height: number }) => void;
  images: { slot1?: UploadImage; slot2?: UploadImage };
  setImages: (imgs: { slot1?: UploadImage; slot2?: UploadImage }) => void;

  // Detection / selection
  detectedRegions: Model3DRegion[];
  selectedRegionId: string | null;
  setSelectedRegionId: (id: string | null) => void;
  setStep: (step: WizardStep) => void;

  // Enhanced images
  generationId: string | undefined;
  enhancedImageUrl: string | undefined;
  enhancedImage2Url: string | undefined;
  enhanceCount: number;
  progress: number;

  // Derived
  canProceed: boolean;

  // Actions
  handleStartDetect: () => Promise<void>;
  handleStartEnhance: () => Promise<void>;
  handleRetryEnhance: (viewIndex: 1 | 2, feedback?: string) => Promise<void>;
  handleConfirmGenerate: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toWizardStatus(status: string | undefined): WizardStatus {
  switch (status) {
    case "pending":
    case "queued":
      return "queued";
    case "processing":
    case "running":
      return "running";
    case "downloading":
      return "downloading";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "queued";
  }
}
