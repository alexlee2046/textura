"use client";


import React, { useState, useEffect, useRef, useMemo } from "react";
import { useUser } from "@/hooks/useUser";
import { motion, AnimatePresence } from "framer-motion";
import ImageUploader from "@/components/ImageUploader";
import FabricSelector from "@/components/FabricSelector";
import ImageCropper, { ASPECT_RATIOS, type AspectRatioOption } from "@/components/ImageCropper";
import { microUrl, type Fabric } from "@/data/fabrics";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import { ArrowLeft, Download, RotateCcw, Sparkles, Shuffle, RefreshCw, AlertTriangle, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

import MagicButton from "@/components/MagicButton";
import ShareModal from "@/components/ShareModal";
import { FabricPopover } from "@/components/FabricPopover";
import { postShareToMiniProgram } from "@/lib/miniProgramShare";
import { updateWechatShareData } from "@/lib/wechatShareEvent";
import { getMyReferralCode, appendRef } from "@/lib/referral";


type Step = "PROCCESS" | "RESULT";


const BRAND_TIPS = [
  "Elastron 超纤皮系列，耐磨 10 万次，手感细腻柔软",
  "Magenta 意大利进口天然面料，透气环保",
  "AI 正在分析面料纹理和光影效果...",
  "好的面料换装需要精确匹配光照角度和材质质感",
  "超纤皮比天然皮革更耐磨、更易清洁，且零动物成分",
  "面料颜色会根据环境光线自动调整，呈现最真实的效果",
];

function BrandTipsCarousel() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % BRAND_TIPS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={index}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="text-zinc-400 mt-3 font-medium text-sm text-center max-w-xs"
      >
        {BRAND_TIPS[index]}
      </motion.p>
    </AnimatePresence>
  );
}


export default function Home() {
  const t = useTranslations("HomePage");
  const [currentStep, setCurrentStep] = useState<Step>("PROCCESS");

  // State
  const [rawImageFile, setRawImageFile] = useState<File | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioOption>(ASPECT_RATIOS[3]);
  const [isCropping, setIsCropping] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [generatingQuality, setGeneratingQuality] = useState<"standard" | "pro" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const { user } = useUser();
  const handleGenerateRef = useRef<(quality?: "standard" | "pro") => Promise<void>>(async () => {});

  // Task 8: Last quality + share hash
  const [lastQuality, setLastQuality] = useState<"standard" | "pro">("standard");
  const [currentShareHash, setCurrentShareHash] = useState<string | null>(null);
  const [shareModalData, setShareModalData] = useState<{
    shareUrl: string;
    generation?: { shareHash: string; type: string };
  } | null>(null);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareFabrics, setCompareFabrics] = useState<Map<string, Fabric>>(new Map());
  // Derive Set for passing to FabricSelector
  const compareSelection = useMemo(() => new Set(compareFabrics.keys()), [compareFabrics]);
  const [batchResults, setBatchResults] = useState<Array<{
    fabricId: string;
    fabric: Fabric;
    imageUrl: string;
    shareHash: string;
  }>>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Revoke object URL when rawImageUrl changes or component unmounts
  useEffect(() => {
    return () => { if (rawImageUrl) URL.revokeObjectURL(rawImageUrl); };
  }, [rawImageUrl]);

  // Keep ref in sync with latest handleGenerate
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  // Fetch credits on mount
  useEffect(() => {
    if (user) {
      fetch("/api/credits")
        .then((r) => r.json())
        .then((d) => { if (typeof d.credits === "number") setCredits(d.credits); });
    }
  }, [user]);

  /** 统一广播分享数据到小程序 + 微信 H5 + URL */
  const broadcastShare = async (shareHash: string, title: string, desc: string) => {
    setCurrentShareHash(shareHash);
    window.history.replaceState(null, "", `/r/${shareHash}`);
    const cardUrl = `${window.location.origin}/r/${shareHash}/share-card`;
    const refCode = await getMyReferralCode();
    const shareLink = appendRef(`${window.location.origin}/r/${shareHash}`, refCode);
    postShareToMiniProgram({ title, shareHash, imageUrl: cardUrl, refCode: refCode ?? undefined });
    updateWechatShareData({
      title,
      desc,
      link: shareLink,
      imgUrl: cardUrl,
    });
  };

  // Handlers
  const handleImageSelected = (file: File, url: string) => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageFile(file);
    setRawImageUrl(url);
    setIsCropping(true);
  };

  const handleCropConfirm = (file: File, aspectRatio: AspectRatioOption) => {
    if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    setCroppedFile(file);
    setCroppedUrl(URL.createObjectURL(file));
    setSelectedAspectRatio(aspectRatio);
    setIsCropping(false);
  };

  const handleCropCancel = () => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageFile(null);
    setRawImageUrl(null);
    setIsCropping(false);
  };

  const resetFlow = () => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setCurrentStep("PROCCESS");
    setRawImageFile(null);
    setRawImageUrl(null);
    if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    setCroppedFile(null);
    setCroppedUrl(null);
    setIsCropping(false);
    setSelectedFabric(null);
    setResultImageUrl(null);
    setErrorMsg(null);
    setCompareMode(false);
    setCompareFabrics(new Map());
    setBatchResults([]);
    setBatchProgress(null);
    setCurrentShareHash(null);
    window.history.replaceState(null, "", "/");
  };

  const clearImage = () => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageFile(null);
    setRawImageUrl(null);
    if (croppedUrl) URL.revokeObjectURL(croppedUrl);
    setCroppedFile(null);
    setCroppedUrl(null);
    setIsCropping(false);
    setErrorMsg(null);
  };

  const generateForFabric = async (
    imageFile: File,
    fabric: Fabric,
    quality: "standard" | "pro",
  ): Promise<{ imageUrl: string; shareHash: string; creditsRemaining: number } | null> => {
    const swatchRes = await fetch(fabric.image);
    const swatchBlob = await swatchRes.blob();
    const swatchFile = new File([swatchBlob], "swatch.webp", { type: swatchBlob.type });

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("swatch", swatchFile);
    formData.append("prompt", fabric.promptModifier);
    formData.append("quality", quality);
    formData.append("fabricId", fabric.id);
    formData.append("aspectRatio", selectedAspectRatio.apiValue);

    const res = await fetch("/api/generate", { method: "POST", body: formData });
    const data = await res.json();

    if (res.status === 402) return null; // insufficient credits
    if (!res.ok) throw new Error(data.error || "Generation failed.");

    return {
      imageUrl: data.imageUrl,
      shareHash: data.shareHash,
      creditsRemaining: data.creditsRemaining,
    };
  };

  const handleGenerate = async (quality: "standard" | "pro" = "standard") => {
    if (!croppedFile || !selectedFabric) return;

    setGeneratingQuality(quality);
    setLastQuality(quality);
    setErrorMsg(null);

    try {
      const result = await generateForFabric(croppedFile, selectedFabric, quality);

      if (!result) {
        setErrorMsg(t("insufficientCredits"));
        return;
      }

      setResultImageUrl(result.imageUrl);
      if (typeof result.creditsRemaining === "number") {
        setCredits(result.creditsRemaining);
      }
      if (result.shareHash) {
        broadcastShare(
          result.shareHash,
          `看看我换的${selectedFabric?.name || "面料"}效果，是不是挺真的`,
          "免费体验 AI 换面料，选面料一键焕新你的家具"
        );
      }
      setCurrentStep("RESULT");
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(`${t("errorPrefix")}${err instanceof Error ? err.message : "An unexpected error occurred."}`);
    } finally {
      setGeneratingQuality(null);
    }
  };

  // Compare mode handlers
  const handleCompareToggle = (fabric: Fabric) => {
    setCompareFabrics(prev => {
      const next = new Map(prev);
      if (next.has(fabric.id)) next.delete(fabric.id);
      else if (next.size < 5) next.set(fabric.id, fabric);
      return next;
    });
  };

  const handleBatchGenerate = async (quality: "standard" | "pro" = "standard") => {
    if (!croppedFile || compareFabrics.size === 0) return;

    const fabricEntries = [...compareFabrics.entries()];

    setGeneratingQuality(quality);
    setLastQuality(quality);
    setErrorMsg(null);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: fabricEntries.length });

    let firstResult: { shareHash: string; fabricName: string } | null = null;

    try {
      for (let i = 0; i < fabricEntries.length; i++) {
        const [fabricId, fabric] = fabricEntries[i];

        try {
          const result = await generateForFabric(croppedFile, fabric, quality);

          if (!result) {
            setErrorMsg(t("insufficientCredits"));
            break;
          }

          if (!firstResult) {
            firstResult = { shareHash: result.shareHash, fabricName: fabric.name };
          }

          setBatchResults(prev => [...prev, {
            fabricId,
            fabric,
            imageUrl: result.imageUrl,
            shareHash: result.shareHash,
          }]);
          if (typeof result.creditsRemaining === "number") setCredits(result.creditsRemaining);
        } catch (err) {
          console.error(`Generation ${i + 1} failed:`, err);
          continue;
        }

        setBatchProgress({ current: i + 1, total: fabricEntries.length });
      }

      setCurrentStep("RESULT");
      if (firstResult) {
        broadcastShare(
          firstResult.shareHash,
          `${compareFabrics.size}款面料对比效果，你觉得哪个好看`,
          "免费体验 AI 换面料，多款面料一键对比"
        );
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(`${t("errorPrefix")}${err instanceof Error ? err.message : "Batch generation failed."}`);
    } finally {
      setGeneratingQuality(null);
      setBatchProgress(null);
    }
  };

  const handleDownload = () => {
    if (!resultImageUrl) return;
    const link = document.createElement("a");
    link.href = resultImageUrl;
    link.download = `fabric_magic_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center pt-20 pb-6 px-4 sm:px-6 lg:px-8 overflow-x-hidden text-zinc-900 z-0">
      {/* Light Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#f5f5f7]">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-100/60 blur-[130px] rounded-full opacity-70 animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-100/40 blur-[150px] rounded-full opacity-60" />
      </div>

      <div className="w-full max-w-6xl flex flex-col items-center z-10 space-y-4">
        
        <header className="text-center w-full max-w-3xl shrink-0 space-y-2">
          <motion.div initial={{ y: -20, opacity: 1 }} animate={{ y: 0, opacity: 1 }}>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight pb-1 drop-shadow-sm inline-flex items-center gap-3">
              <Sparkles className="w-10 h-10 md:w-11 md:h-11 text-zinc-600 shrink-0" />
              <span className="text-gradient">{t("title")}</span>
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ y: 10, opacity: 1 }} 
            animate={{ y: 0, opacity: 1 }} 
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-zinc-500 font-medium"
          >
            {t("subtitle")}<br className="hidden md:block"/> {t("subtitle2")}
          </motion.p>
        </header>

        {/* Credit Warning Banner */}
        {credits !== null && credits > 0 && credits < 4 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {t("lowCreditsWarning")}
          </div>
        )}

        {/* Global Error Toast */}
        <AnimatePresence initial={false}>
          {errorMsg && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="px-6 py-3 rounded-full bg-red-50 border border-red-200 text-red-600 text-sm"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Core Wizard Area */}
        <AnimatePresence mode="wait" initial={false}>
          
          {/* STEP 1 & 2: PROCESS (Upload inline + Edit & Generate) */}
          {currentStep === "PROCCESS" && (
            <motion.div
              key="step-process"
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 pb-24 lg:pb-0"
            >
               {/* Left Column: Upload Zone or Image Preview */}
               <div className="lg:col-span-7 flex flex-col gap-4">
                  <AnimatePresence mode="wait" initial={false}>
                    {!rawImageUrl ? (
                      /* Upload zone */
                      <motion.div
                        key="uploader"
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                        transition={{ duration: 0.35 }}
                        className="glass-panel p-2 rounded-3xl"
                      >
                        <ImageUploader onImagesChange={([f], [u]) => handleImageSelected(f, u)} />
                      </motion.div>
                    ) : isCropping ? (
                      /* Crop mode */
                      <motion.div
                        key="cropper"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.35 }}
                      >
                        <ImageCropper
                          imageUrl={rawImageUrl}
                          onConfirm={handleCropConfirm}
                          onCancel={handleCropCancel}
                        />
                      </motion.div>
                    ) : (
                      /* Image preview (after crop) */
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.35 }}
                        className="flex flex-col gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={clearImage}
                            disabled={generatingQuality !== null}
                            className="p-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
                          >
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <h2 className="text-xl font-bold tracking-wide">{t("sourceImage")}</h2>
                        </div>

                        <div className="relative w-full rounded-3xl overflow-hidden glass-panel group" style={{ aspectRatio: selectedAspectRatio.value }}>
                          <img
                            src={croppedUrl!}
                            alt="Source Preview"
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                          />

                          {/* Overlay loading indicator */}
                          <AnimatePresence>
                            {generatingQuality !== null && (
                              <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-20"
                              >
                                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 animate-pulse mb-6">
                                  {t("scanningDimensions")}
                                </h3>
                                <div className="w-48 h-2 rounded-full bg-white/20 overflow-hidden">
                                  <div className={`h-full rounded-full bg-white ${
                                    generatingQuality === "pro" ? "animate-progress-slow" : "animate-progress"
                                  }`} />
                                </div>
                                <p className="text-white/80 mt-4 text-sm">
                                  {t("generating")} · ~{generatingQuality === "pro" ? "20s" : "10s"}
                                </p>
                                {batchProgress && (
                                  <p className="text-white/80 mt-2 text-sm">
                                    {batchProgress.current}/{batchProgress.total} {t("generating")}
                                  </p>
                                )}
                                <BrandTipsCarousel />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>

               {/* Right Column: Interaction Panel */}
               <div className="lg:col-span-5 flex flex-col gap-4 lg:h-[calc(100vh-160px)]">
                  {/* Compare mode toggle */}
                  <div className="shrink-0 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setCompareMode(!compareMode);
                        if (compareMode) {
                          setCompareFabrics(new Map());
                        }
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                        compareMode
                          ? "bg-zinc-800 text-white border-zinc-800"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"
                      }`}
                    >
                      {compareMode ? t("compareOn") : t("compare")} {compareMode && compareSelection.size > 0 && `(${compareSelection.size})`}
                    </button>
                  </div>

                  <div className="flex-1 glass-panel rounded-3xl p-6 relative overflow-hidden flex flex-col">
                     <FabricSelector
                        selectedFabric={selectedFabric}
                        onSelect={setSelectedFabric}
                        compareMode={compareMode}
                        compareSelection={compareSelection}
                        onCompareToggle={handleCompareToggle}
                        maxCompare={5}
                     />
                  </div>

                  <div className="shrink-0 flex justify-end lg:pb-0 lg:static fixed bottom-0 left-0 right-0 z-30 lg:z-auto px-4 pb-4 pt-3 lg:px-0 lg:pt-0 bg-white/80 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-t border-zinc-200/60 lg:border-0">
                     <MagicButton
                        onApply={compareMode && compareSelection.size >= 2 ? handleBatchGenerate : handleGenerate}
                        disabled={compareMode ? compareSelection.size < 2 || !croppedFile : !selectedFabric || !croppedFile}
                        loadingQuality={generatingQuality}
                     />
                  </div>
               </div>
            </motion.div>
          )}

          {/* STEP 3: RESULT */}
          {currentStep === "RESULT" && rawImageUrl && (resultImageUrl || batchResults.length > 0) && (
            <motion.div
              key="step-result"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", type: "spring", bounce: 0.3 }}
              className="w-full flex flex-col gap-8"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel px-6 py-4 rounded-2xl w-full">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                       <Sparkles className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900">{t("transformationComplete")}</h2>
                      <p className="text-sm text-zinc-500">
                        {batchResults.length > 1 ? `${batchResults.length} ${t("compareResults")}` : t("sliderHint")}
                      </p>
                    </div>
                 </div>
                 {selectedFabric && batchResults.length <= 1 && (
                   <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200">
                     <FabricPopover fabric={selectedFabric}>
                       <img src={microUrl(selectedFabric.image)} alt={selectedFabric.color} className="w-16 h-16 rounded-xl object-cover border border-zinc-200 flex-shrink-0 shadow-sm cursor-pointer" />
                     </FabricPopover>
                     <div>
                       <p className="text-xs text-zinc-400 uppercase tracking-wide">{selectedFabric.brand} · {selectedFabric.name}</p>
                       <p className="text-base font-bold text-zinc-800">{selectedFabric.color}</p>
                     </div>
                   </div>
                 )}

                 <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 flex-wrap justify-center sm:justify-end">
                    {batchResults.length <= 1 && (
                      <>
                        <button
                          onClick={() => {
                            setCurrentStep("PROCCESS");
                            setSelectedFabric(null);
                            setResultImageUrl(null);
                            setErrorMsg(null);
                            setBatchResults([]);
                            window.history.replaceState(null, "", "/");
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors text-sm"
                        >
                           <Shuffle className="w-4 h-4" /> {t("switchFabric")}
                        </button>
                        <button
                          onClick={() => handleGenerate(lastQuality)}
                          disabled={generatingQuality !== null}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors text-sm disabled:opacity-50"
                        >
                           <RefreshCw className={`w-4 h-4 ${generatingQuality !== null ? "animate-spin" : ""}`} /> {t("regenerate")}
                        </button>
                        <button
                          onClick={async () => {
                            if (!currentShareHash) return;
                            const refCode = await getMyReferralCode();
                            const url = appendRef(`${window.location.origin}/r/${currentShareHash}`, refCode);
                            if (typeof navigator.share === "function") {
                              try {
                                await navigator.share({ url });
                                return;
                              } catch {
                                // User cancelled or share failed — fall through to modal
                              }
                            }
                            setShareModalData({
                              shareUrl: url,
                              generation: { shareHash: currentShareHash!, type: "fabric" },
                            });
                          }}
                          disabled={!currentShareHash}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium border border-zinc-200 transition-colors text-sm disabled:opacity-50"
                        >
                           <Share2 className="w-4 h-4" /> {t("share")}
                        </button>
                        <button
                          onClick={handleDownload}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 font-bold shadow-sm transition-all text-sm"
                        >
                           <Download className="w-4 h-4" /> {t("download")}
                        </button>
                      </>
                    )}
                 </div>
              </div>

              {batchResults.length > 1 ? (
                <div className="w-full">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {batchResults.map(result => (
                      <div key={result.fabricId} className="group rounded-xl overflow-hidden border border-zinc-200 bg-white shadow-sm">
                        <div className="aspect-square relative">
                          <img src={result.imageUrl} alt="" className="w-full h-full object-cover" />
                          {/* Download button on hover */}
                          <a
                            href={result.imageUrl}
                            download={`fabric_compare_${result.fabric.color}_${Date.now()}.jpg`}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 backdrop-blur-sm border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <div className="p-2 flex items-center gap-2">
                          <FabricPopover fabric={result.fabric}>
                            <img src={microUrl(result.fabric.image)} alt="" className="w-6 h-6 rounded-full object-cover cursor-pointer" />
                          </FabricPopover>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-800 truncate">{result.fabric.name}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{result.fabric.color}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full flex justify-center pb-6">
                   <BeforeAfterSlider beforeImage={croppedUrl!} afterImage={resultImageUrl!} aspectRatio={selectedAspectRatio.value} />
                </div>
              )}

              <div className="flex justify-center pb-12">
                <button
                  onClick={resetFlow}
                  className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors underline underline-offset-4"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />{t("startOver")}
                </button>
              </div>
            </motion.div>
          )}
          
        </AnimatePresence>

      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {shareModalData && (
          <ShareModal
            shareUrl={shareModalData.shareUrl}
            generation={shareModalData.generation}
            onClose={() => setShareModalData(null)}
          />
        )}
      </AnimatePresence>

    </main>
  );
}
