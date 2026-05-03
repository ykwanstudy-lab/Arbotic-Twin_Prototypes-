/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import TreeModelViewer from './components/TreeModelViewer';
import BiometricsPanel from './components/BiometricsPanel';
import Chatbot from './components/Chatbot';
import { useEffect, useState } from 'react';

export default function App() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Initial fetch for fallback
    fetch('/api/v1/tree-metrics/tree_001')
      .then(res => res.json())
      .then(d => {
        if (!data) setData(d);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#020617] text-[#f8fafc] overflow-hidden font-sans">
      {/* Main 3D Viewport */}
      <main className="flex-[2] relative border-b md:border-b-0 md:border-r border-main point-cloud-grid">
        <TreeModelViewer onMetricsUpdate={setData} />
        <div className="absolute top-4 right-4 pointer-events-none">
          <div className="bg-[#0f172a]/90 backdrop-blur border border-main px-3 py-1.5 rounded text-[10px] font-mono text-slate-400 font-medium tracking-wide shadow-xl">
             ArboTwin <span className="text-emerald-400">v2.5</span>
          </div>
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="flex-1 flex flex-col md:max-w-md bg-[#0f172a] relative shadow-2xl z-10 w-full h-full border-l border-main">
        <div className="shrink-0 p-5 border-b border-main bg-[#0f172a]/50 sticky top-0 z-20 flex items-center justify-between">
          <h2 className="text-sm font-bold text-emerald-400 tracking-widest uppercase">Level 2.5 Metrics</h2>
          <p className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono tracking-wider">Spatial Bio-Extraction Active</p>
        </div>
        <div className="p-5 overflow-y-auto border-b border-main flex-1">
          <BiometricsPanel data={data} />
        </div>
        <div className="h-[320px] bg-slate-950 flex flex-col">
          <Chatbot biometrics={data} />
        </div>
      </aside>
    </div>
  );
}
