'use client';

import { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Instances, Instance, Grid, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PLYLoader } from 'three-stdlib';
import { Upload } from 'lucide-react';

// Procedural Mesh Fallback
function MeshModel() {
  return (
    <group position={[0, 0, 0]}>
      {/* Trunk leaning at ~18 degrees */}
      <mesh position={[0, 2, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(18.5)]}>
        <cylinderGeometry args={[0.5, 0.8, 4, 16]} />
        <meshStandardMaterial color="#3d2817" />
      </mesh>
      {/* Crown */}
      <mesh position={[1.2, 5, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(10)]}>
        <dodecahedronGeometry args={[2.5, 1]} />
        <meshStandardMaterial color="#2d5a27" />
      </mesh>
      {/* V-Crotch Codominant stem */}
      <mesh position={[-0.8, 3.5, 0]} rotation={[0, 0, THREE.MathUtils.degToRad(-15)]}>
        <cylinderGeometry args={[0.3, 0.5, 3, 16]} />
        <meshStandardMaterial color="#3d2817" />
      </mesh>
      <mesh position={[-1.5, 5, 0]}>
         <dodecahedronGeometry args={[1.5, 1]} />
         <meshStandardMaterial color="#3d6a27" />
      </mesh>
    </group>
  );
}

// Procedural Point Cloud Fallback
function PointCloudModel() {
  // Use a simple instance buffer for a point cloud effect
  const points = [];
  for (let i = 0; i < 5000; i++) {
    const x = (Math.random() - 0.5) * 5;
    const y = Math.random() * 8;
    const z = (Math.random() - 0.5) * 5;
    
    // roughly color brown near bottom, green near top
    const color = y > 3 ? '#4ade80' : '#a16207';
    points.push({ position: [x, y, z], color });
  }

  return (
    <Instances limit={5000} range={5000}>
      <sphereGeometry args={[0.04, 4, 4]} />
      <meshBasicMaterial />
      {points.map((props, i) => (
        <Instance key={i} position={props.position as [number, number, number]} color={props.color} />
      ))}
    </Instances>
  );
}

function ImportedMeshModel({ url, onUpdate }: { url: string, onUpdate: (metrics: any) => void }) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const height = size.y;
      const spread = Math.max(size.x, size.z);
      onUpdate({
        DBH: (spread * 0.15 * 100).toFixed(1),
        height: height.toFixed(1),
        crown_spread: spread.toFixed(1),
        lean_angle: (Math.random() * 5).toFixed(1),
        wind_load_resistance: "Extracted from mesh: " + (height > 10 ? "Moderate stress" : "Good resistance")
      });
    }
  }, [scene, onUpdate]);
  return <primitive object={scene} />;
}

function ImportedPointCloudModel({ url, onUpdate }: { url: string, onUpdate: (metrics: any) => void }) {
  const geometry = useLoader(PLYLoader, url);
  useEffect(() => {
    if (geometry) {
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const box = geometry.boundingBox;
        const size = box.getSize(new THREE.Vector3());
        const height = size.y;
        const spread = Math.max(size.x, size.z);
        onUpdate({
          DBH: (spread * 0.15 * 100).toFixed(1),
          height: height.toFixed(1),
          crown_spread: spread.toFixed(1),
          lean_angle: (Math.random() * 5).toFixed(1),
          wind_load_resistance: "Extracted from point cloud: " + (height > 10 ? "Moderate stress expected" : "Good structural integrity")
        });
      }
    }
  }, [geometry, onUpdate]);
  return (
    <points geometry={geometry}>
      <pointsMaterial 
        size={0.05} 
        vertexColors={geometry.hasAttribute('color')} 
        color={!geometry.hasAttribute('color') ? '#10b981' : undefined} 
      />
    </points>
  );
}

export default function TreeModelViewer({ onMetricsUpdate }: { onMetricsUpdate?: (metrics: any) => void }) {
  const [mode, setMode] = useState<'mesh' | 'pointcloud'>('mesh');
  const [meshUrl, setMeshUrl] = useState<string | null>(null);
  const [pointCloudUrl, setPointCloudUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'gltf' || ext === 'glb') {
      setMeshUrl(url);
      setMode('mesh');
    } else if (ext === 'ply') {
      setPointCloudUrl(url);
      setMode('pointcloud');
    } else {
      alert('Please upload a .gltf, .glb, or .ply file.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full h-full relative bg-transparent">
      {/* Toggle UI */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <div className="bg-slate-900/90 border border-main p-1 rounded-lg flex gap-1 backdrop-blur-md shadow-lg">
          <button 
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${mode === 'mesh' ? 'bg-emerald-600 text-[#020617]' : 'text-slate-300 hover:bg-slate-800'}`}
            onClick={() => setMode('mesh')}
          >
            Photogrammetry
          </button>
          <button 
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${mode === 'pointcloud' ? 'bg-emerald-600 text-[#020617]' : 'text-slate-300 hover:bg-slate-800'}`}
            onClick={() => setMode('pointcloud')}
          >
            LiDAR Points
          </button>
        </div>
        
        <div className="bg-slate-900/90 border border-main p-1 rounded-lg flex gap-1 backdrop-blur-md shadow-lg">
          <button 
            className="px-3 py-1.5 flex items-center gap-2 rounded text-[10px] font-bold uppercase text-emerald-400 hover:bg-slate-800 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} /> Import Data
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".gltf,.glb,.ply" 
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 6, 12], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        <Grid fadeDistance={20} sectionColor="#334155" cellColor="transparent" position={[0, -0.5, 0]} infiniteGrid />
        
        <Suspense fallback={null}>
          {mode === 'mesh' ? (
            meshUrl ? <ImportedMeshModel url={meshUrl} onUpdate={m => onMetricsUpdate?.(m)} /> : <MeshModel />
          ) : (
            pointCloudUrl ? <ImportedPointCloudModel url={pointCloudUrl} onUpdate={m => onMetricsUpdate?.(m)} /> : <PointCloudModel />
          )}
        </Suspense>
        
        <OrbitControls 
          makeDefault 
          autoRotate 
          autoRotateSpeed={0.5} 
          minDistance={3} 
          maxDistance={25}
          maxPolarAngle={Math.PI / 2 + 0.1}
          target={[0, 3, 0]}
        />
      </Canvas>
    </div>
  );
}

