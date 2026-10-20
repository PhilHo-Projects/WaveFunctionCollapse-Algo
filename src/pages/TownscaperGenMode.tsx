import { useState } from 'react';
import { useOrganicGeneration } from '../core/townscaper/useOrganicGeneration';
import { OrganicRenderer } from '../components/OrganicRenderer';

export default function TownscaperGenMode() {
    const { grid,pointCount,setPointCount,waterLevel,setWaterLevel,vegetation,setVegetation,civilization,setCivilization,clustering,setClustering,inlandWater,setInlandWater,beachFormation,setBeachFormation,pathGeneration,setPathGeneration,status,isGenerating,progress,handleReset,handleGenerate }=useOrganicGeneration(1000);
    const [tooltipInfo,setTooltipInfo]=useState<{html:string;x:number;y:number}|null>(null);
    const handleCellClick=()=>{};
    return (
        <>
            {/* Canvas Area (No Overlay) */}
            <section className="flex-none flex items-center justify-center relative rounded-xl w-[800px] max-w-full aspect-square overflow-hidden bg-[--bg-card]">
                <div className="w-full h-full">
                    <OrganicRenderer
                        grid={grid}
                        onCellClick={handleCellClick}
                        onHoverCell={(_cell, html, x, y) => setTooltipInfo({ html, x: x + 14, y: y + 14 })}
                        onHoverLeave={() => setTooltipInfo(null)}
                    />
                </div>
            </section>

            {tooltipInfo && (
                <div
                    className="fixed z-50 bg-[--bg-card] border border-[--border-light] rounded p-2.5 font-mono text-xs text-[--text-primary] shadow-2xl pointer-events-none backdrop-blur-md"
                    style={{ left: tooltipInfo.x, top: tooltipInfo.y }}
                    dangerouslySetInnerHTML={{ __html: tooltipInfo.html }}
                />
            )}

            <aside className="w-full md:w-[var(--panel-width)] bg-[--bg-secondary] border-l border-[--border] p-4 flex flex-col gap-3.5 overflow-y-auto max-h-[calc(100vh-80px)]">

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Procedural Controls</h2>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Cell Density</span>
                            <span className="font-mono">{pointCount}</span>
                        </div>
                        <input
                            type="range"
                            min="200"
                            max="2000"
                            step="100"
                            value={pointCount}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setPointCount(val);
                                handleReset(val);
                            }}
                            disabled={isGenerating}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                        <p className="text-[10px] text-[--text-muted] mt-1.5 text-right font-mono text-wrap leading-tight">
                            Warning: High cell capacities may cause temporary UI stutters.
                        </p>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Water Level</span>
                            <span className="font-mono">{waterLevel}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={waterLevel}
                            onChange={(e) => {
                                setWaterLevel(parseInt(e.target.value));
                                handleReset(); // Rebuild boundaries instantly
                            }}
                            disabled={isGenerating}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Vegetation</span>
                            <span className="font-mono">{vegetation}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={vegetation}
                            onChange={(e) => setVegetation(parseInt(e.target.value))}
                            disabled={isGenerating}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                    </div>

                    <div className="mb-5">
                        <div className="flex justify-between text-xs mb-1.5 text-[--text-secondary]">
                            <span>Civilization</span>
                            <span className="font-mono">{civilization}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={civilization}
                            onChange={(e) => setCivilization(parseInt(e.target.value))}
                            disabled={isGenerating}
                            className="w-full h-1.5 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]"
                        />
                    </div>

                    <details className="mb-5 group">
                        <summary className="text-[10px] font-bold text-[--accent] cursor-pointer outline-none uppercase tracking-wider mb-3 hover:text-white transition-colors">
                            Experimental Heuristics ▾
                        </summary>
                        <div className="pl-3 border-l border-[--border] space-y-4">
                            <div>
                                <div className="flex justify-between text-[10px] mb-1.5 text-[--text-secondary]">
                                    <span>Biome Clustering</span>
                                    <span className="font-mono">{clustering}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={clustering} onChange={(e) => setClustering(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1.5 text-[--text-secondary]">
                                    <span>Inland Water Lakes</span>
                                    <span className="font-mono">{inlandWater}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={inlandWater} onChange={(e) => setInlandWater(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1.5 text-[--text-secondary]">
                                    <span>Beach Formation</span>
                                    <span className="font-mono">{beachFormation}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={beachFormation} onChange={(e) => setBeachFormation(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1.5 text-[--text-secondary]">
                                    <span>Path Generation</span>
                                    <span className="font-mono">{pathGeneration}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={pathGeneration} onChange={(e) => setPathGeneration(parseInt(e.target.value))} disabled={isGenerating} className="w-full h-1 bg-[--bg-secondary] rounded-lg appearance-none cursor-pointer border border-[--border]" />
                            </div>
                        </div>
                    </details>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full py-3 font-mono text-sm font-semibold bg-[--accent] text-[#0b0c10] rounded-lg hover:bg-[#52ffd8] hover:shadow-[0_0_20px_rgba(100,255,218,0.4)] transition-all flex items-center justify-center gap-2"
                    >
                        {isGenerating ? 'Generating...' : '▶ Auto-Generate Island'}
                    </button>

                    {isGenerating && (
                        <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-[--text-secondary] font-mono mb-1">
                                <span>Generating...</span>
                                <span>{Math.floor(progress)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[--bg-primary] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[--accent] transition-all duration-75"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">Status</h2>
                    <div className="flex justify-between items-center py-1.5 border-b border-[--border] text-sm">
                        <span className="text-[--text-secondary]">State:</span>
                        <span className={`font-medium ${status.includes('Error') ? 'text-[--red]' : 'text-[--green]'}`}>
                            {status}
                        </span>
                    </div>
                </div>

                <div className="bg-[--bg-card] border border-[--border] rounded-lg p-3.5 bg-gradient-to-br from-[#1e2230] to-[#181a24]">
                    <h2 className="text-[0.72rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-2.5">High Performance Core</h2>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">
                        Procedural mode bypasses the Animation rendering engine. Instead, it utilizes `setTimeout` chunks to process the complex edge matrix operations as quickly as JavaScript permits without deadlocking the browser tab!
                    </p>
                </div>

            </aside>
        </>
    );
}
