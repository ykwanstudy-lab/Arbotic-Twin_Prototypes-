export default function BiometricsPanel({ data }: { data: any }) {
  if (!data) return <div className="text-[10px] text-slate-400 p-4 font-mono uppercase tracking-widest animate-pulse">Scanning spatial data...</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 border border-main p-3 rounded-lg">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">DBH (Diameter)</label>
          <div className="text-xl font-bold font-mono text-[#f8fafc]">{data.DBH} <span className="text-xs font-normal opacity-60">cm</span></div>
        </div>
        <div className="bg-slate-800/50 border border-main p-3 rounded-lg">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Height</label>
          <div className="text-xl font-bold font-mono text-[#f8fafc]">{data.height} <span className="text-xs font-normal opacity-60">m</span></div>
        </div>
        <div className="bg-slate-800/50 border border-main p-3 rounded-lg">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Crown Spread</label>
          <div className="text-xl font-bold font-mono text-[#f8fafc]">{data.crown_spread} <span className="text-xs font-normal opacity-60">m</span></div>
        </div>
        <div className="bg-slate-800/50 border border-rose-500/50 p-3 rounded-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 bg-rose-600 text-[9px] font-bold uppercase tracking-widest text-[#020617]">Critical</div>
          <label className="text-[10px] text-rose-400 uppercase tracking-wider mb-1 block">Lean Angle</label>
          <div className="text-xl font-bold font-mono text-rose-500">{data.lean_angle} <span className="text-xs font-normal opacity-60">°</span></div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800 pb-2">Risk Factor Analysis</h3>
        <div className="flex items-start gap-3">
          <div className="w-1 h-10 bg-rose-500 rounded-full shrink-0"></div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#f8fafc]">Eccentric Loading / Wind Resistance</span>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{data.wind_load_resistance}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
