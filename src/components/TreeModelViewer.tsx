'use client';

import { useState, useRef, Suspense, useEffect, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Instances, Instance, Grid, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PLYLoader, OBJLoader } from 'three-stdlib';
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
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 5000; i++) {
      const x = (Math.random() - 0.5) * 5;
      const y = Math.random() * 8;
      const z = (Math.random() - 0.5) * 5;
      
      // roughly color brown near bottom, green near top
      const color = y > 3 ? '#4ade80' : '#a16207';
      pts.push({ position: [x, y, z], color });
    }
    return pts;
  }, []);

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

function calculateTreeMetrics(width: number, height: number, depth: number, source: string) {
  const spread = Math.max(width, depth);
  const isMultiTrunk = spread > height * 0.7; // Exaggerated structural heuristic
  
  // Deterministic stem count using spread/height ratio limits calculations 
  const stemCount = isMultiTrunk ? Math.max(2, Math.floor((spread / height) * 2)) : 1;

  let equivalentDbh = 0;
  let trunkDetails = "";

  // Deterministic lean calculation based on volumetric asymmetry
  const asymmetry = Math.abs(width - depth);
  const lean_angle = Math.min((asymmetry / height) * 15, 15).toFixed(1);

  if (stemCount === 1) {
    equivalentDbh = spread * 0.15 * 100;
  } else {
    // Deterministic stem size formula
    const stems = Array.from({ length: stemCount }, (_, i) => (spread * (0.05 + (i * 0.02)) * 100));
    equivalentDbh = Math.sqrt(stems.reduce((sum, d) => sum + d * d, 0));
    trunkDetails = stems.map(s => s.toFixed(1)).join(', ');
  }

  return {
    DBH: equivalentDbh.toFixed(1),
    stem_count: stemCount,
    trunk_details: trunkDetails,
    height: height.toFixed(1),
    crown_spread: spread.toFixed(1),
    lean_angle: lean_angle,
    wind_load_resistance: `Extracted from ${source}: ` + (stemCount > 1 ? `Codominant stems (${stemCount}) detected. Analyze limits.` : "Single trunk. Good resistance.")
  };
}

function getOffsetAndSize(localBox: THREE.Box3, rotation: [number, number, number]) {
  const rotMat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation));
  const rotatedBox = localBox.clone().applyMatrix4(rotMat);
  
  const center = rotatedBox.getCenter(new THREE.Vector3());
  const size = rotatedBox.getSize(new THREE.Vector3());
  
  const offset: [number, number, number] = [-center.x, -rotatedBox.min.y, -center.z];
  return { offset, size, center };
}

function ImportedMeshModel({ url, onUpdate, modelRotation, setCameraTarget }: { url: string, onUpdate?: (metrics: any) => void, modelRotation: [number, number, number], setCameraTarget?: (t: [number, number, number]) => void }) {
  const { scene } = useGLTF(url);
  const [offset, setOffset] = useState<[number, number, number]>([0, 0, 0]);

  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const { offset, size } = getOffsetAndSize(box, modelRotation);

      setOffset(offset);
      setCameraTarget?.([0, size.y / 2, 0]);
      onUpdate?.(calculateTreeMetrics(size.x, size.y, size.z, "mesh"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, modelRotation]);
  
  return (
    <group position={offset}>
      <group rotation={modelRotation}>
        <primitive object={scene} dispose={null} />
      </group>
    </group>
  );
}

function ImportedObjModel({ url, onUpdate, modelRotation, setCameraTarget }: { url: string, onUpdate?: (metrics: any) => void, modelRotation: [number, number, number], setCameraTarget?: (t: [number, number, number]) => void }) {
  const obj = useLoader(OBJLoader, url);
  const [offset, setOffset] = useState<[number, number, number]>([0, 0, 0]);

  const clonedObj = useMemo(() => {
    const clone = obj.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        child.material = new THREE.MeshStandardMaterial({
          color: '#10b981',
          roughness: 0.8,
          metalness: 0.2,
          side: THREE.DoubleSide
        });
      }
    });
    return clone;
  }, [obj]);

  useEffect(() => {
    if (clonedObj) {
      const box = new THREE.Box3().setFromObject(clonedObj);
      const { offset, size } = getOffsetAndSize(box, modelRotation);

      setOffset(offset);
      setCameraTarget?.([0, size.y / 2, 0]);
      onUpdate?.(calculateTreeMetrics(size.x, size.y, size.z, "mesh"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedObj, modelRotation]);
  
  return (
    <group position={offset}>
      <group rotation={modelRotation}>
        <primitive object={clonedObj} dispose={null} />
      </group>
    </group>
  );
}

function ImportedPointCloudModel({ url, onUpdate, modelRotation, setCameraTarget, ptSizeMult }: { url: string, onUpdate?: (metrics: any) => void, modelRotation: [number, number, number], setCameraTarget?: (t: [number, number, number]) => void, ptSizeMult: number }) {
  const geometry = useLoader(PLYLoader, url);
  const [offset, setOffset] = useState<[number, number, number]>([0, 0, 0]);
  const [basePtSize, setBasePtSize] = useState(0.05);

  useEffect(() => {
    if (geometry) {
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const { offset, size } = getOffsetAndSize(geometry.boundingBox, modelRotation);

        const maxDim = Math.max(size.x, size.y, size.z);
        setBasePtSize(Math.max(0.001, maxDim * 0.003)); 

        setOffset(offset);
        setCameraTarget?.([0, size.y / 2, 0]);
        onUpdate?.(calculateTreeMetrics(size.x, size.y, size.z, "PC"));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, modelRotation]);
  
  return (
    <group position={offset}>
      <group rotation={modelRotation}>
        <points geometry={geometry} dispose={null}>
          <pointsMaterial 
            size={basePtSize * ptSizeMult} 
            vertexColors={geometry.hasAttribute('color')} 
            color={!geometry.hasAttribute('color') ? '#10b981' : undefined} 
            sizeAttenuation={true}
          />
        </points>
      </group>
    </group>
  );
}

export default function TreeModelViewer({ onMetricsUpdate }: { onMetricsUpdate?: (metrics: any) => void }) {
  const [mode, setMode] = useState<'mesh' | 'pointcloud'>('mesh');
  const [meshUrl, setMeshUrl] = useState<string | null>(null);
  const [objUrl, setObjUrl] = useState<string | null>(null);
  const [pointCloudUrl, setPointCloudUrl] = useState<string | null>(null);
  const [modelRotation, setModelRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([0, 3, 0]);
  const [ptSizeMult, setPtSizeMult] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    setModelRotation([0, 0, 0]); // Reset on new import
    setPtSizeMult(1);

    if (ext === 'gltf' || ext === 'glb') {
      setMeshUrl(url);
      setObjUrl(null);
      setMode('mesh');
    } else if (ext === 'obj') {
      setMeshUrl(null);
      setObjUrl(url);
      setMode('mesh');
    } else if (ext === 'ply') {
      setPointCloudUrl(url);
      setMode('pointcloud');
    } else {
      alert('Please upload a .gltf, .glb, .obj, or .ply file.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    setMeshUrl(null);
    setObjUrl(null);
    setPointCloudUrl(null);
    setModelRotation([0, 0, 0]);
    setCameraTarget([0, 3, 0]);
    setPtSizeMult(1);
    onMetricsUpdate?.({
      DBH: "42.5",
      stem_count: 1,
      trunk_details: "",
      height: "14.2",
      crown_spread: "9.1",
      lean_angle: "18.5",
      wind_load_resistance: "Moderate stress expected at base."
    });
  };

  return (
    <div className="w-full h-full relative bg-transparent">
      {/* Toggle UI */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/90 border border-main p-1 rounded-lg flex gap-1 backdrop-blur-md shadow-lg self-start pointer-events-auto">
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
        
        <div className="bg-slate-900/90 border border-main p-1 rounded-lg flex flex-wrap gap-1 backdrop-blur-md shadow-lg self-start pointer-events-auto">
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
            accept=".gltf,.glb,.ply,.obj" 
            onChange={handleFileChange}
          />
          
          <div className="w-px h-6 bg-slate-700 mx-1 self-center" />
          <button 
            className="px-3 py-1.5 flex items-center gap-2 rounded text-[10px] font-bold uppercase transition-colors text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setModelRotation(r => [(r[0] - Math.PI / 2), r[1], r[2]])}
            title="Rotate 90 degrees on X axis"
            disabled={!meshUrl && !objUrl && !pointCloudUrl}
          >
            Rot X
          </button>
          <button 
            className="px-3 py-1.5 flex items-center gap-2 rounded text-[10px] font-bold uppercase transition-colors text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setModelRotation(r => [r[0], (r[1] - Math.PI / 2), r[2]])}
            title="Rotate 90 degrees on Y axis"
            disabled={!meshUrl && !objUrl && !pointCloudUrl}
          >
            Rot Y
          </button>
          <button 
            className="px-3 py-1.5 flex items-center gap-2 rounded text-[10px] font-bold uppercase transition-colors text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setModelRotation(r => [r[0], r[1], (r[2] - Math.PI / 2)])}
            title="Rotate 90 degrees on Z axis"
            disabled={!meshUrl && !objUrl && !pointCloudUrl}
          >
            Rot Z
          </button>

          {pointCloudUrl && (
            <>
              <div className="w-px h-6 bg-slate-700 mx-1 self-center" />
              <button 
                className="px-3 py-1.5 flex items-center gap-2 rounded text-[10px] font-bold uppercase transition-colors text-slate-300 hover:bg-slate-800"
                onClick={() => setPtSizeMult(m => Math.max(0.1, m * 0.75))}
                title="Decrease point size"
              >
                Pt Size -
              </button>
              <button 
                className="px-3 py-1.5 flex items-center gap-2 rounded text-[10px] font-bold uppercase transition-colors text-slate-300 hover:bg-slate-800"
                onClick={() => setPtSizeMult(m => Math.min(10, m * 1.5))}
                title="Increase point size"
              >
                Pt Size +
              </button>
            </>
          )}
          
          <div className="w-px h-6 bg-slate-700 mx-1 self-center" />
          <button 
            className="px-3 py-1.5 flex items-center gap-2 rounded text-[10px] font-bold uppercase transition-colors text-rose-400 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleClear}
            title="Clear imported model"
            disabled={!meshUrl && !objUrl && !pointCloudUrl}
          >
            Clear
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 6, 12], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        <Grid fadeDistance={20} sectionColor="#334155" cellColor="transparent" position={[0, -0.5, 0]} infiniteGrid />
        
        <Suspense fallback={null}>
          {mode === 'mesh' ? (
            meshUrl ? <ImportedMeshModel url={meshUrl} onUpdate={onMetricsUpdate} modelRotation={modelRotation} setCameraTarget={setCameraTarget} /> : 
            objUrl ? <ImportedObjModel url={objUrl} onUpdate={onMetricsUpdate} modelRotation={modelRotation} setCameraTarget={setCameraTarget} /> : <MeshModel />
          ) : (
            pointCloudUrl ? <ImportedPointCloudModel url={pointCloudUrl} onUpdate={onMetricsUpdate} modelRotation={modelRotation} setCameraTarget={setCameraTarget} ptSizeMult={ptSizeMult} /> : <PointCloudModel />
          )}
        </Suspense>
        
        <OrbitControls 
          makeDefault 
          autoRotate 
          autoRotateSpeed={0.5} 
          minDistance={1} 
          maxDistance={500}
          enablePan={true}
          screenSpacePanning={true}
          target={cameraTarget}
        />
      </Canvas>
    </div>
  );
}

