import type { OrganicCell } from './OrganicGrid';
import { OrganicGrid } from './OrganicGrid';
import { ORGANIC_TILES } from './OrganicTiles';
import { animate } from 'animejs';

export type OrganicSolverState = 'idle' | 'propagating' | 'error';

export class OrganicSolver {
    grid: OrganicGrid;
    propagationStack: number[]; // Cell IDs
    state: OrganicSolverState;
    stepCount: number;
    private generationFrame: number | null = null;

    cancelGeneration() {
        if (this.generationFrame !== null) cancelAnimationFrame(this.generationFrame);
        this.generationFrame = null;
    }

    constructor(grid: OrganicGrid) {
        this.grid = grid;
        this.propagationStack = [];
        this.state = 'idle';
        this.stepCount = 0;
    }

    userCollapse(cell: OrganicCell, tileId: number, skipAnimation: boolean = false): boolean {
        if (!cell.options.has(tileId)) {
            cell.flash = { type: 'error', timer: 1.0 };
            if (!skipAnimation) {
                cell.isAnimating = true;
                animate(cell, {
                    renderXOffset: [-6, 6, -4, 4, -2, 2, 0],
                    duration: 400,
                    ease: 'outQuad',
                    onComplete: () => { cell.isAnimating = false; }
                });
            }
            return false;
        }

        cell.options = new Set([tileId]);
        cell.collapsed = true;
        cell.flash = { type: 'collapse', timer: 1.0 };

        if (!skipAnimation) {
            cell.isAnimating = true;
            animate(cell, {
                renderScale: [0, 1.05, 1],
                renderYOffset: [-5, 0],
                duration: 400,
                ease: 'easeOutCubic',
                onComplete: () => { cell.isAnimating = false; }
            });
        }

        this.propagationStack.push(cell.id);
        this.state = 'propagating';

        return this._propagateAll(skipAnimation);
    }

    _propagateAll(skipAnimation: boolean = false) {
        this.stepCount = 0;
        while (this.propagationStack.length > 0) {
            if (this.state === 'error') break;
            this._propagateStep(skipAnimation);
            this.stepCount++;
            if (this.stepCount > 100000) {
                console.error("Propagation loop exceeded limit.");
                break;
            }
        }

        if (this.state !== 'error') {
            this.state = 'idle';
        }
        return this.state === 'idle';
    }

    _propagateStep(skipAnimation: boolean = false) {
        const cellId = this.propagationStack.pop()!;
        const cell = this.grid.cells[cellId];
        if (!cell) return;

        for (const nId of cell.neighbors) {
            // D3 Delaunay neighbor array can contain -1 for boundaries
            if (nId === -1) continue;

            const neighbor = this.grid.cells[nId];
            if (!neighbor) continue;

            // Collect all universally valid options for the neighbor
            const allowed = new Set<number>();
            for (const optIdx of cell.options) {
                for (const validOpt of ORGANIC_TILES[optIdx].allowedNeighbors) {
                    allowed.add(validOpt);
                }
            }

            const before = neighbor.options.size;
            const newOptions = new Set<number>();
            for (const idx of neighbor.options) {
                if (allowed.has(idx)) newOptions.add(idx);
            }
            neighbor.options = newOptions;

            if (neighbor.options.size === 0) {
                this.state = 'error';
                neighbor.flash = { type: 'error', timer: 1.0 };
                return;
            }

            if (neighbor.options.size < before) {
                neighbor.flash = { type: 'propagate', timer: 0.5 };

                if (!skipAnimation) {
                    neighbor.isAnimating = true;
                    animate(neighbor, {
                        renderScale: [1.1, 1.0],
                        duration: 300,
                        ease: 'outQuad',
                        onComplete: () => { neighbor.isAnimating = false; }
                    });
                }

                this.propagationStack.push(neighbor.id);

                if (neighbor.options.size === 1) {
                    neighbor.collapsed = true;
                    neighbor.flash = { type: 'collapse', timer: 0.8 };

                    if (!skipAnimation) {
                        neighbor.isAnimating = true;
                        animate(neighbor, {
                            renderScale: [0, 1.05, 1],
                            renderYOffset: [-5, 0],
                            duration: 400,
                            ease: 'easeOutCubic',
                            onComplete: () => { neighbor.isAnimating = false; }
                        });
                    }
                }
            }
        }
    }

    autoGenerate(
        { vegetation, civilization, clustering, inlandWater, beachFormation, pathGeneration }:
            { vegetation: number, civilization: number, clustering: number, inlandWater: number, beachFormation: number, pathGeneration: number },
        onProgress: (percent: number) => void,
        onComplete: (outcome: 'complete' | 'error') => void
    ) {
        if (this.grid.isFullyCollapsed || this.state === 'error') {
            onComplete(this.state === 'error' ? 'error' : 'complete');
            return;
        }

        const step = () => {
            // Process a fixed small number of cells per frame to make the generation visible and satisfying
            let cellsToProcess = 15;

            while (cellsToProcess > 0) {
                let minEntropy = Infinity;
                let targetCells: OrganicCell[] = [];

                // Find lowest entropy
                for (const cell of this.grid.cells) {
                    if (!cell.collapsed) {
                        if (cell.options.size < minEntropy) {
                            minEntropy = cell.options.size;
                            targetCells = [cell];
                        } else if (cell.options.size === minEntropy) {
                            targetCells.push(cell);
                        }
                    }
                }

                if (targetCells.length === 0) {
                    onProgress(100);
                    onComplete('complete');
                    return;
                }

                // Randomly select one of the lowest entropy cells
                const targetCell = targetCells[Math.floor(Math.random() * targetCells.length)];
                if (!targetCell.options.size) { this.state = 'error'; onComplete('error'); return; }

                // Calculate dynamic weight based on neighbor clustering
                // This forces biomes to group together (grass with grass, sand with sand)
                const validTiles = Array.from(targetCell.options).map(id => ORGANIC_TILES[id]);

                const neighborTileCounts: Record<number, number> = {};
                for (const nId of targetCell.neighbors) {
                    if (nId === -1) continue;
                    const neighbor = this.grid.cells[nId];
                    if (neighbor && neighbor.collapsed) {
                        const tileId = Array.from(neighbor.options)[0];
                        neighborTileCounts[tileId] = (neighborTileCounts[tileId] || 0) + 1;
                    }
                }

                const hasWaterNeighbor = targetCell.neighbors.some(nId => nId !== -1 && this.grid.cells[nId]?.collapsed && Array.from(this.grid.cells[nId]?.options)[0] === 0);
                const hasBuildingNeighbor = targetCell.neighbors.some(nId => nId !== -1 && this.grid.cells[nId]?.collapsed && [5, 6].includes(Array.from(this.grid.cells[nId]?.options)[0]));

                const weightedTiles = validTiles.map(tile => {
                    let dynamicWeight = tile.weight;

                    // Apply Vegetation vs Civilization broad heuristics
                    // Natural tiles: Sand (1), Grass (2), Wood (4)
                    if ([1, 2, 4].includes(tile.id)) {
                        // vegetation slider is 0-100. 50 is normal (1x). 100 is 3x. 0 is 0.1x.
                        const vegMod = vegetation >= 50 ? 1 + ((vegetation - 50) / 50) * 2 : 0.1 + (vegetation / 50) * 0.9;
                        dynamicWeight *= vegMod;
                    }
                    // Structural tiles: Brick (5), Roof (6), Cobblestone (7)
                    if ([5, 6, 7].includes(tile.id)) {
                        const civMod = civilization >= 50 ? 1 + ((civilization - 50) / 50) * 2 : 0.1 + (civilization / 50) * 0.9;
                        dynamicWeight *= civMod;
                    }

                    // Inland Water Heuristic
                    // If tile is water and has no water neighbors, scale its chance of spawning by inlandWater slider
                    if (tile.id === 0 && !hasWaterNeighbor) {
                        dynamicWeight *= (inlandWater / 100);
                    }

                    // Beach Formation Heuristic
                    // If tile is sand and touches water, massively boost probability based on slider
                    if (tile.id === 1 && hasWaterNeighbor) {
                        const beachMod = beachFormation >= 50 ? 1 + ((beachFormation - 50) / 50) * 4 : (beachFormation / 50);
                        dynamicWeight *= beachMod;
                    }

                    // Path Generation Heuristic
                    // If tile is cobblestone and touches a building, boost probability
                    if (tile.id === 7 && hasBuildingNeighbor) {
                        const pathMod = pathGeneration >= 50 ? 1 + ((pathGeneration - 50) / 50) * 4 : (pathGeneration / 50);
                        dynamicWeight *= pathMod;
                    }

                    // Biome Clustering Heuristic
                    // If a neighbor is the exact same tile type, boost the likelihood of picking it
                    if (neighborTileCounts[tile.id]) {
                        // clustering 50 = 5x multiplier. clustering 100 = 10x multiplier
                        const clusterMultiplier = (clustering / 10);
                        dynamicWeight += neighborTileCounts[tile.id] * clusterMultiplier;
                    }
                    return { id: tile.id, weight: dynamicWeight };
                });

                const totalWeight = weightedTiles.reduce((sum, tile) => sum + tile.weight, 0);
                let randomWeight = Math.random() * totalWeight;
                let chosenTileId = weightedTiles[0].id;

                for (const tile of weightedTiles) {
                    randomWeight -= tile.weight;
                    if (randomWeight <= 0) {
                        chosenTileId = tile.id;
                        break;
                    }
                }

                // Force a fast pop animation when generating visibly
                this.userCollapse(targetCell, chosenTileId, false);
                targetCell.renderScale = 1;
                targetCell.isAnimating = false;

                cellsToProcess--;

                if (this.state === 'error') {
                    onProgress((this.grid.collapsedCount / this.grid.cells.length) * 100);
                    onComplete('error');
                    return;
                }

                if (this.grid.isFullyCollapsed) {
                    onProgress(100);
                    onComplete('complete');
                    return;
                }
            }

            const percent = (this.grid.collapsedCount / this.grid.cells.length) * 100;
            onProgress(percent);

            if (!this.grid.isFullyCollapsed && this.state !== 'error') {
                this.generationFrame = requestAnimationFrame(step);
            }
        };

        step();
    }
}
