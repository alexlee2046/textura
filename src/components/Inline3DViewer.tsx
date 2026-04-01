"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, Center } from "@react-three/drei";
import { Loader2 } from "lucide-react";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

function Fallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#e4e4e7" wireframe />
    </mesh>
  );
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
    </div>
  );
}

export default function Inline3DViewer({ modelUrl }: { modelUrl: string }) {
  return (
    <div className="aspect-[4/3] relative bg-zinc-50 rounded-2xl overflow-hidden">
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: [3, 2, 3], fov: 45 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          className="w-full h-full"
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />
          <directionalLight position={[-3, 3, -3]} intensity={0.3} />
          <Suspense fallback={<Fallback />}>
            <Model url={modelUrl} />
            <Environment preset="studio" environmentIntensity={0.4} />
          </Suspense>
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            autoRotate
            autoRotateSpeed={1.5}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
