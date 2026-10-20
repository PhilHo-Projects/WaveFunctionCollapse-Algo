import React, { useRef, useEffect } from 'react';
import { OrganicGrid, type OrganicCell } from '../core/townscaper/OrganicGrid';
import { ORGANIC_TILES } from '../core/townscaper/OrganicTiles';
import { animate } from 'animejs';

interface OrganicRendererProps {
    grid: OrganicGrid | null;
    selectedToolId?: number;
    onCellClick?: (id: number) => void;
    onHoverCell?: (cell: OrganicCell, html: string, x: number, y: number) => void;
    onHoverLeave?: () => void;
}

export const OrganicRenderer: React.FC<OrganicRendererProps> = ({
    grid,
    selectedToolId,
    onCellClick,
    onHoverCell,
    onHoverLeave
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const hoveredCellRef = useRef<OrganicCell | null>(null);

    useEffect(() => {
        if (!grid || !canvasRef.current) return;
        const canvas = canvasRef.current;

        // Auto-scale canvas
        canvas.width = grid.width;
        canvas.height = grid.height;
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderLoop = () => {
            ctx.clearRect(0, 0, grid.width, grid.height);

            let needsRender = false;

            for (const cell of grid.cells) {
                ctx.save();
                ctx.translate(cell.x, cell.y);
                ctx.scale(cell.renderScale, cell.renderScale);
                ctx.translate(-cell.x + cell.renderXOffset, -cell.y + cell.renderYOffset);

                if (cell.collapsed) {
                    const tileIdx = Array.from(cell.options)[0];
                    const tile = ORGANIC_TILES[tileIdx];
                    if (tile) {
                        tile.draw(ctx, cell.polygon);
                    }
                } else {
                    // Draw uncollapsed base polygon
                    ctx.fillStyle = '#14171f';
                    ctx.beginPath();
                    ctx.moveTo(cell.polygon[0][0], cell.polygon[0][1]);
                    for (let i = 1; i < cell.polygon.length; i++) {
                        ctx.lineTo(cell.polygon[i][0], cell.polygon[i][1]);
                    }
                    ctx.closePath();
                    ctx.fill();

                    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Dots for valid options
                    const opts = Array.from(cell.options);
                    if (opts.length <= 5) {
                        const gap = 4;
                        const r = 3;
                        const tw = opts.length * (r * 2) + (opts.length - 1) * gap;
                        let cx = cell.x - tw / 2 + r;
                        const cy = cell.y;

                        ctx.globalAlpha = 0.2;
                        for (const tileId of opts) {
                            ctx.fillStyle = ORGANIC_TILES[tileId].color;
                            ctx.beginPath();
                            ctx.arc(cx, cy, r, 0, Math.PI * 2);
                            ctx.fill();
                            cx += r * 2 + gap;
                        }
                        ctx.globalAlpha = 1.0;
                    }
                }

                // Draw flashes
                if (cell.flash && cell.flash.timer > 0) {
                    ctx.beginPath();
                    ctx.moveTo(cell.polygon[0][0], cell.polygon[0][1]);
                    for (let i = 1; i < cell.polygon.length; i++) {
                        ctx.lineTo(cell.polygon[i][0], cell.polygon[i][1]);
                    }
                    ctx.closePath();

                    const alpha = cell.flash.timer * 0.5;
                    if (cell.flash.type === 'collapse') {
                        ctx.fillStyle = `rgba(124, 140, 245, ${alpha})`;
                        ctx.strokeStyle = `rgba(150, 163, 252, ${alpha})`;
                    } else if (cell.flash.type === 'error') {
                        ctx.fillStyle = `rgba(245, 112, 112, ${alpha})`;
                        ctx.strokeStyle = `rgba(255, 130, 130, ${alpha})`;
                    } else {
                        ctx.fillStyle = `rgba(107, 207, 142, ${alpha})`;
                        ctx.strokeStyle = `rgba(140, 220, 170, ${alpha})`;
                    }
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    cell.flash.timer -= 0.05;
                    if (cell.flash.timer <= 0) cell.flash = null;
                }

                ctx.restore();

                if ((cell.flash && cell.flash.timer > 0) || cell.isAnimating) {
                    needsRender = true;
                }
            }

            if (needsRender || window.location.pathname.includes('/townscaper')) {
                rafRef.current = requestAnimationFrame(renderLoop);
            } else {
                rafRef.current = requestAnimationFrame(renderLoop);
            }
        };

        rafRef.current = requestAnimationFrame(renderLoop);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [grid]);

    const isDraggingRef = useRef(false);
    const lastPlacedCellRef = useRef<OrganicCell | null>(null);

    const getEventCell = (e: React.MouseEvent) => {
        if (!grid || !canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        return grid.getCellAt(x, y) ?? null;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        const cell = getEventCell(e);
        if (cell && onCellClick) {
            lastPlacedCellRef.current = cell;
            onCellClick(cell.id);
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
        if (!grid || !canvasRef.current || !onHoverCell) return;
        const cell = getEventCell(e);

        if (cell !== hoveredCellRef.current) {
            if (hoveredCellRef.current && !hoveredCellRef.current.collapsed) {
                hoveredCellRef.current.isAnimating = true;
                animate(hoveredCellRef.current, {
                    renderScale: 1.0,
                    duration: 200,
                    ease: 'outQuad',
                    onComplete: () => { if (hoveredCellRef.current) hoveredCellRef.current.isAnimating = false; }
                });
            }
            hoveredCellRef.current = cell;
            if (cell && !cell.collapsed) {
                cell.isAnimating = true;
                animate(cell, {
                    renderScale: 1.05,
                    duration: 200,
                    ease: 'outQuad',
                    onComplete: () => { cell.isAnimating = false; }
                });
            }
        }

        if (isDraggingRef.current && cell && onCellClick) {
            if (cell !== lastPlacedCellRef.current) {
                lastPlacedCellRef.current = cell;
                onCellClick(cell.id);
            }
        }

        if (!cell) {
            if (onHoverLeave) onHoverLeave();
            return;
        }

        let html = `<div class="font-semibold text-[--accent] mb-1">Cell ID: ${cell.id}</div>`;
        if (cell.collapsed) {
            const idx = Array.from(cell.options)[0];
            html += `<div class="text-[--text-secondary]">Tile: <strong class="text-[--text-primary]">${ORGANIC_TILES[idx].name}</strong></div>`;
        } else {
            if (selectedToolId !== undefined) {
                if (cell.options.has(selectedToolId)) {
                    html += `<div class="text-[--green]">✓ Click to place</div>`;
                } else {
                    html += `<div class="text-[--red]">✗ Cannot place here due to constraints</div>`;
                }
            }
        }
        onHoverCell(cell, html, e.clientX, e.clientY);
    };

    return (
        <section className="flex-none flex items-center justify-center relative shadow-[0_0_0_1px_var(--border),0_8px_32px_rgba(0,0,0,0.4)] rounded-xl w-[800px] max-w-full aspect-square overflow-hidden">
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair bg-[--bg-primary]"
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />
        </section>
    );
};
