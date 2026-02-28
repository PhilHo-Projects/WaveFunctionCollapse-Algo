import { Delaunay } from 'd3-delaunay';

export interface OrganicCell {
    id: number;
    x: number;
    y: number;
    polygon: [number, number][]; // Vertices of the Voronoi cell
    neighbors: number[]; // IDs of neighboring cells
    collapsed: boolean;
    options: Set<number>;
    flash?: { type: 'collapse' | 'propagate' | 'error'; timer: number } | null;
    renderScale: number;
    renderYOffset: number;
    renderXOffset: number;
    isAnimating: boolean;
}

export class OrganicGrid {
    width: number;
    height: number;
    cells: OrganicCell[];

    constructor(width: number, height: number, pointCount: number, relaxIterations: number, totalTiles: number) {
        this.width = width;
        this.height = height;
        this.cells = [];

        // 1. Generate random points
        let points = Array.from({ length: pointCount }, () => [
            Math.random() * width,
            Math.random() * height
        ] as [number, number]);

        // 2. Lloyd's Relaxation to make them uniform (like pentagons/hexagons)
        for (let i = 0; i < relaxIterations; i++) {
            const delaunay = Delaunay.from(points);
            const voronoi = delaunay.voronoi([0, 0, width, height]);

            points = points.map((p, idx) => {
                const poly = voronoi.cellPolygon(idx);
                if (!poly) return p;
                // Calculate centroid of the polygon
                let cx = 0, cy = 0, area = 0;
                for (let j = 0; j < poly.length - 1; j++) {
                    const [x0, y0] = poly[j];
                    const [x1, y1] = poly[j + 1];
                    const a = x0 * y1 - x1 * y0;
                    area += a;
                    cx += (x0 + x1) * a;
                    cy += (y0 + y1) * a;
                }
                area *= 0.5;
                if (area === 0) return p;
                return [cx / (6 * area), cy / (6 * area)];
            });
        }

        // 3. Final Voronoi and Graph Extraction
        const delaunay = Delaunay.from(points);
        const voronoi = delaunay.voronoi([0, 0, width, height]);

        for (let i = 0; i < points.length; i++) {
            const poly = voronoi.cellPolygon(i);
            if (!poly) continue;

            // Get neighbors from Delaunay halfedges
            const neighbors = Array.from(delaunay.neighbors(i));

            const options = new Set<number>();
            for (let t = 0; t < totalTiles; t++) options.add(t);

            this.cells.push({
                id: i,
                x: points[i][0],
                y: points[i][1],
                polygon: poly,
                neighbors,
                collapsed: false,
                options,
                flash: null,
                renderScale: 1.0,
                renderXOffset: 0.0,
                renderYOffset: 0.0,
                isAnimating: false
            });
        }
    }

    getCellAt(x: number, y: number): OrganicCell | undefined {
        // A simple O(N) check to find which polygon contains the point
        for (const cell of this.cells) {
            if (this._pointInPolygon([x, y], cell.polygon)) {
                return cell;
            }
        }
        return undefined;
    }

    _pointInPolygon(point: [number, number], polygon: [number, number][]) {
        const [x, y] = point;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    get isFullyCollapsed(): boolean {
        return this.cells.every((c) => c.collapsed);
    }

    get collapsedCount(): number {
        return this.cells.filter(c => c.collapsed).length;
    }

    reset(totalTiles: number) {
        for (const c of this.cells) {
            c.collapsed = false;
            c.options = new Set();
            for (let i = 0; i < totalTiles; i++) c.options.add(i);
            c.flash = null;
            c.renderScale = 1.0;
            c.renderXOffset = 0.0;
            c.renderYOffset = 0.0;
            c.isAnimating = false;
        }
    }
}
