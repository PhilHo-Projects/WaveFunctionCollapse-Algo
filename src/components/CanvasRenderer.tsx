import React, { useRef, useEffect } from 'react';
import { Grid } from '../core/wfc/Grid';
import { TILES, TERRAIN_COLORS } from '../core/wfc/Tiles';

interface CanvasRendererProps {
    grid: Grid | null;
    selectedToolId?: number; // Only for builder mode
    onCellClick?: (x: number, y: number) => void;
    onHoverCell?: (cell: any, htmlTooltip: string, clientX: number, clientY: number) => void;
    onHoverLeave?: () => void;
    isBuilderMode?: boolean;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
    grid,
    selectedToolId,
    onCellClick,
    onHoverCell,
    onHoverLeave,
    isBuilderMode = false,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const cellSizeRef = useRef<number>(0);
    const rafRef = useRef<number>();
    const lastFrameRef = useRef<number>(performance.now());

    useEffect(() => {
        const handleResize = () => {
            if (!wrapperRef.current || !canvasRef.current || !grid) return;
            // Use a fixed high internal resolution to keep it sharp and consistent
            const size = 900;
            const cellSize = Math.floor(size / Math.max(grid.width, grid.height));
            cellSizeRef.current = cellSize;

            const canvas = canvasRef.current;
            const totalW = cellSize * grid.width;
            const totalH = cellSize * grid.height;
            canvas.width = totalW;
            canvas.height = totalH;

            // Let CSS handle the layout sizing automatically to fill the parent
            canvas.style.width = '100%';
            canvas.style.height = '100%';
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [grid]);

    useEffect(() => {
        if (!grid || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const renderLoop = (now: number) => {
            const dt = (now - lastFrameRef.current) / 1000;
            lastFrameRef.current = now;
            const s = cellSizeRef.current;

            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            for (const cell of grid.cells) {
                const px = cell.x * s;
                const py = cell.y * s;

                // --- Apply Anime.js Transformations ---
                ctx.save();

                // 1. Move origin to center of cell for scaling
                const cx = px + s / 2;
                const cy = py + s / 2;
                ctx.translate(cx, cy);

                // 2. Apply scale
                ctx.scale(cell.renderScale, cell.renderScale);

                // 3. Move back and apply X/Y offset
                ctx.translate(-cx + cell.renderXOffset, -cy + cell.renderYOffset);

                if (cell.collapsed) {
                    const tileIdx = Array.from(cell.options)[0];
                    TILES[tileIdx].draw(ctx, px, py, s);
                } else {
                    // Draw superposition
                    ctx.fillStyle = '#14171f';
                    ctx.fillRect(px, py, s, s);

                    const opts = Array.from(cell.options);
                    const baseTerrains = new Set<number>();
                    for (const idx of opts) {
                        baseTerrains.add((TILES[idx].sockets as any).south);
                    }

                    if (baseTerrains.size <= 5 && s >= 20) {
                        const terrainArr = Array.from(baseTerrains);
                        const gap = 2;
                        const maxSw = isBuilderMode ? s / 4 : s / 3;
                        const swatchS = Math.min((s - gap * (terrainArr.length + 1)) / terrainArr.length, maxSw);
                        const totalW = terrainArr.length * swatchS + (terrainArr.length - 1) * gap;
                        const startX = px + (s - totalW) / 2;
                        const startY = isBuilderMode ? py + s / 2 - swatchS / 2 : py + s - swatchS - 4;

                        ctx.globalAlpha = isBuilderMode ? 0.15 : 0.3;
                        for (let i = 0; i < terrainArr.length; i++) {
                            ctx.fillStyle = TERRAIN_COLORS[terrainArr[i]] || '#555';
                            if (isBuilderMode) {
                                ctx.beginPath();
                                ctx.arc(startX + i * (swatchS + gap) + swatchS / 2, startY + swatchS / 2, swatchS / 2, 0, Math.PI * 2);
                                ctx.fill();
                            } else {
                                ctx.fillRect(startX + i * (swatchS + gap), startY, swatchS, swatchS);
                            }
                        }
                        ctx.globalAlpha = 1.0;
                    }
                }

                // Draw flash
                if (cell.flash && cell.flash.timer > 0) {
                    const alpha = cell.flash.timer * 0.55;
                    if (cell.flash.type === 'collapse') {
                        ctx.fillStyle = isBuilderMode ? `rgba(124, 140, 245, ${alpha})` : `rgba(245, 197, 66, ${alpha})`;
                        ctx.strokeStyle = isBuilderMode ? `rgba(150, 163, 252, ${alpha})` : `rgba(255, 220, 100, ${alpha})`;
                    } else if (cell.flash.type === 'error') {
                        ctx.fillStyle = `rgba(245, 112, 112, ${alpha})`;
                        ctx.strokeStyle = `rgba(255, 130, 130, ${alpha})`;
                    } else {
                        ctx.fillStyle = isBuilderMode ? `rgba(107, 207, 142, ${alpha})` : `rgba(245, 112, 112, ${alpha})`;
                        ctx.strokeStyle = isBuilderMode ? `rgba(140, 220, 170, ${alpha})` : `rgba(255, 130, 130, ${alpha})`;
                    }
                    ctx.fillRect(px, py, s, s);
                    ctx.lineWidth = 2;
                    ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);

                    cell.flash.timer -= dt * 3;
                    if (cell.flash.timer <= 0) cell.flash = null;
                }

                // Draw entropy if explainer mode
                if (!isBuilderMode && !cell.collapsed) {
                    const count = cell.options.size;
                    const fontSize = Math.max(9, Math.min(s * 0.35, 18));
                    ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    if (count <= 2) ctx.fillStyle = 'rgba(245,197,66,0.85)';
                    else if (count <= 5) ctx.fillStyle = 'rgba(200,200,255,0.65)';
                    else ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillText(count.toString(), px + s / 2, py + s / 2);
                }

                // Grid lines (with scale intact so scaling pops perfectly over adjacent tiles too)
                ctx.strokeStyle = isBuilderMode && cell.collapsed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(px, py, s, s);

                // --- Restore Context ---
                ctx.restore();
            }

            let needsRender = false;
            for (const cell of grid.cells) {
                if ((cell.flash && cell.flash.timer > 0) || cell.isAnimating) {
                    needsRender = true;
                    break;
                }
            }

            if (needsRender || window.location.pathname.includes('/builder')) {
                // In builder mode, always redraw because of hover effects. Alternatively, track mouse hover state explicitly to save battery. For now force it.
                rafRef.current = requestAnimationFrame(renderLoop);
            } else {
                // If nothing is animating, sleep until next tick flag is set. We can achieve this lazily by just polling slowly, but for pure performance we could wait for events. A constant 60fps loop is fine for this project.
                rafRef.current = requestAnimationFrame(renderLoop);
            }
        };

        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(renderLoop);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [grid, isBuilderMode]);

    const getCellAt = (clientX: number, clientY: number) => {
        if (!canvasRef.current || !grid) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const cx = (clientX - rect.left) * scaleX;
        const cy = (clientY - rect.top) * scaleY;
        const col = Math.floor(cx / cellSizeRef.current);
        const row = Math.floor(cy / cellSizeRef.current);
        return grid.get(col, row);
    };

    const hoveredCellRef = useRef<any>(null);
    const isDraggingRef = useRef(false);
    const lastPlacedCellRef = useRef<any>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        const cell = getCellAt(e.clientX, e.clientY);
        if (cell && onCellClick) {
            lastPlacedCellRef.current = cell;
            onCellClick(cell.x, cell.y);
        }
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        lastPlacedCellRef.current = null;
    };

    const handleMouseLeave = () => {
        isDraggingRef.current = false;
        lastPlacedCellRef.current = null;
        if (onHoverLeave) onHoverLeave();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!onHoverCell || !grid) return;
        const cell = getCellAt(e.clientX, e.clientY);

        if (cell !== hoveredCellRef.current) {
            if (hoveredCellRef.current && isBuilderMode) {
                hoveredCellRef.current.animateHover(false);
            }
            hoveredCellRef.current = cell;
            if (cell && isBuilderMode) {
                cell.animateHover(true);
            }
        }

        if (isDraggingRef.current && cell && onCellClick) {
            if (cell !== lastPlacedCellRef.current) {
                lastPlacedCellRef.current = cell;
                onCellClick(cell.x, cell.y);
            }
        }

        if (!cell) {
            if (onHoverLeave) onHoverLeave();
            return;
        }

        // Construct HTML for tooltip depending on mode
        let html = `<div class="font-semibold text-[--accent] mb-1">Cell (${cell.x}, ${cell.y})</div>`;

        if (cell.collapsed) {
            const idx = Array.from(cell.options)[0];
            html += `<div class="text-[--text-secondary]">Tile: <strong class="text-[--text-primary]">${TILES[idx].name}</strong></div>`;
        } else {
            if (isBuilderMode && selectedToolId !== undefined) {
                // Find if selected terrain is valid
                const selectedTileIdx = TILES.findIndex(t => t.baseTerrainId === selectedToolId);
                if (cell.options.has(selectedTileIdx)) {
                    html += `<div class="text-[--green]">✓ Click to place</div>`;
                } else {
                    html += `<div class="text-[--red]">✗ Cannot place here due to constraints</div>`;
                }
            } else {
                html += `<div class="text-[--text-secondary]">Options: ${cell.options.size} tiles</div>`;
            }
        }
        onHoverCell(cell, html, e.clientX, e.clientY);
    };

    return (
        <section ref={wrapperRef} className="flex-none flex items-center justify-center relative shadow-[0_0_0_1px_var(--border),0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(124,140,245,0.05)] rounded-xl w-[800px] max-w-full aspect-square">
            <canvas
                ref={canvasRef}
                className="rounded-xl shadow-[0_0_0_1px_var(--border),0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(124,140,245,0.05)] cursor-crosshair [image-rendering:pixelated]"
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />
        </section>
    );
};
