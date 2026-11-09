/**
 * 3D Model & 2D Sprite Registry System
 *
 * Supports:
 * 1. 2D Sprite Images (`.png`, `.svg`, `.webp`) via `loadSprite(key, url, options)`
 *    - Automatically preloads `./Truck_Model.png` for the haul truck!
 *    - Can also register sprites for any world object (`boulder`, `ore`, `rogue_loader`, etc.).
 * 2. 3D Models (Wavefront `.obj` or procedural vertex/edge/face meshes) via `loadOBJ(key, url)`
 *    - Used for LiDAR point-cloud / wireframe returns, 4D Radar ghost wireframes, or fallback geometry.
 *
 * Example usage from console or code:
 *   modelRegistry.loadSprite('truck', './Truck_Model.png');
 *   modelRegistry.loadSprite('boulder', './assets/boulder.png');
 *   modelRegistry.loadOBJ('boulder', './assets/boulder.obj', { scale: 0.8 });
 */

export class ModelRegistry {
  constructor() {
    this.models = new Map();
    this.sprites = new Map();
    this.registerDefaultProceduralModels();
    this.preloadDefaultSprites();
  }

  /**
   * Preloads default image sprites (`./Truck_Model.png`, `./boulder.png`, `./pickup.png`).
   */
  preloadDefaultSprites() {
    this.loadSprite('truck', './Truck_Model.png', {
      aspectRatio: 4 / 3,
      scale: 1.0
    });
    this.loadSprite('boulder', './boulder.png', {
      scale: 1.15,
      offsetY: 4
    });
    this.loadSprite('service_truck', './pickup.png', {
      scale: 1.35,
      offsetY: 4
    });
  }

  /**
   * Load and register a 2D image sprite (`.png`, `.svg`, `.webp`, `.jpg`) for `key`.
   * @param {string} key - Entity or truck key ('truck', 'boulder', 'ore', 'rogue_loader', 'service_truck', 'drill_drone', 'gate')
   * @param {string} url - Path to image asset
   * @param {{ scale?: number, offsetY?: number, aspectRatio?: number }} options
   */
  loadSprite(key, url, options = {}) {
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    const entry = {
      image: img,
      url,
      loaded: false,
      error: false,
      width: 0,
      height: 0,
      scale: options.scale ?? 1.0,
      offsetY: options.offsetY ?? 0
    };
    this.sprites.set(key, entry);

    img.onload = () => {
      entry.loaded = true;
      entry.width = img.naturalWidth || img.width;
      entry.height = img.naturalHeight || img.height;
    };
    img.onerror = () => {
      entry.error = true;
    };
    img.src = url;
    return entry;
  }

  /**
   * Returns a loaded sprite entry if available and ready, or null if it should fall back to 3D mesh.
   */
  getSprite(key) {
    const entry = this.sprites.get(key);
    return entry && entry.loaded && !entry.error ? entry : null;
  }

  /**
   * Register a 3D mesh definition directly.
   * @param {string} key - Model ID ('truck', 'boulder', 'rogue_loader', 'ore', 'gate', etc.)
   * @param {{ vertices: Array<[number,number,number]>, edges: Array<[number,number]>, faces?: Array<{indices: number[], color?: string}> }} meshData
   */
  registerModel(key, meshData) {
    this.models.set(key, meshData);
  }

  getModel(key) {
    return this.models.get(key) || this.models.get('default_box');
  }

  /**
   * Asynchronously load a Wavefront .obj file and register it under `key`.
   */
  async loadOBJ(key, url, options = { scale: 1.0, offsetY: 0 }) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const mesh = this.parseOBJ(text, options);
      this.registerModel(key, mesh);
      return mesh;
    } catch (err) {
      console.warn(`[ModelRegistry] Failed to load OBJ for "${key}" from ${url}, using procedural fallback.`, err);
      return this.getModel(key);
    }
  }

  /**
   * Parses Wavefront .obj text into vertices, faces, and deduplicated wireframe edges.
   */
  parseOBJ(objText, { scale = 1.0, offsetY = 0 } = {}) {
    const vertices = [];
    const faces = [];
    const edgeSet = new Set();
    const edges = [];

    const addEdge = (a, b) => {
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgeSet.has(k)) {
        edgeSet.add(k);
        edges.push([a, b]);
      }
    };

    const lines = objText.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/\s+/);
      if (parts[0] === 'v') {
        vertices.push([
          parseFloat(parts[1]) * scale,
          parseFloat(parts[2]) * scale + offsetY,
          parseFloat(parts[3]) * scale
        ]);
      } else if (parts[0] === 'f') {
        const indices = parts.slice(1).map((tok) => parseInt(tok.split('/')[0], 10) - 1);
        if (indices.length >= 3) {
          faces.push({ indices });
          for (let i = 0; i < indices.length; i++) {
            addEdge(indices[i], indices[(i + 1) % indices.length]);
          }
        }
      }
    }

    return { vertices, edges, faces };
  }

  registerDefaultProceduralModels() {
    // 1. Agile Autonomous Haul Truck (3D fallback mesh + hardpoint anchors)
    const s = 0.62;
    const rawTruckVertices = [
      [-0.48, 0.18, -1.1], [0.48, 0.18, -1.1], [0.48, 0.18, 1.1], [-0.48, 0.18, 1.1],
      [-0.52, 0.55, -1.15], [0.52, 0.55, -1.15], [0.52, 0.55, 1.2], [-0.52, 0.55, 1.2],
      [-0.58, 0.58, -1.25], [0.58, 0.58, -1.25], [0.58, 0.58, 0.55], [-0.58, 0.58, 0.55],
      [-0.64, 1.18, -1.05], [0.64, 1.18, -1.05], [0.62, 1.28, 0.85], [-0.62, 1.28, 0.85],
      [-0.42, 0.88, 0.55], [0.42, 0.88, 0.55], [0.38, 0.82, 1.18], [-0.38, 0.82, 1.18]
    ];
    const truckVertices = rawTruckVertices.map(([x, y, z]) => [x * s, y * s, z * s]);

    const truckFaces = [
      { indices: [8, 9, 13, 12], color: '#2b3945' },
      { indices: [12, 13, 14, 15], color: '#384b5c' },
      { indices: [8, 12, 15, 11], color: '#24313c' },
      { indices: [9, 10, 14, 13], color: '#24313c' },
      { indices: [16, 17, 18, 19], color: '#1b2836' },
      { indices: [7, 6, 18, 19], color: '#14202c' },
      { indices: [0, 1, 5, 4], color: '#151d24' },
      { indices: [0, 4, 7, 3], color: '#1a242d' },
      { indices: [1, 2, 6, 5], color: '#1a242d' }
    ];

    const truckEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
      [8, 9], [9, 10], [10, 11], [11, 8],
      [12, 13], [13, 14], [14, 15], [15, 12],
      [8, 12], [9, 13], [10, 14], [11, 15],
      [16, 17], [17, 18], [18, 19], [19, 16],
      [7, 19], [6, 18]
    ];

    this.registerModel('truck', {
      vertices: truckVertices,
      edges: truckEdges,
      faces: truckFaces,
      hardpointAnchors: {
        front_bumper: [0, 0.42 * s, 1.22 * s],
        roof_mast: [0, 1.32 * s, 0.72 * s],
        fender_left: [-0.56 * s, 0.72 * s, 0.95 * s],
        fender_right: [0.56 * s, 0.72 * s, 0.95 * s]
      }
    });

    // 2. Jagged Wide Boulder & Rockslide Model (Unmistakable heavy wide rock silhouette)
    const boulderVerts = [
      [-0.55, 0.0, -0.42], [0.55, 0.0, -0.42], [0.58, 0.0, 0.42], [-0.52, 0.0, 0.45],
      [-0.58, 0.52, -0.35], [0.52, 0.56, -0.3], [0.48, 0.48, 0.42], [-0.5, 0.54, 0.38],
      [-0.22, 0.88, -0.12], [0.26, 0.84, 0.08]
    ];
    const boulderFaces = [
      { indices: [0, 1, 5, 4], color: '#5a3a2e' },
      { indices: [3, 2, 6, 7], color: '#6e4738' },
      { indices: [0, 3, 7, 4], color: '#472e24' },
      { indices: [1, 2, 6, 5], color: '#472e24' },
      { indices: [4, 5, 9, 8], color: '#825442' },
      { indices: [7, 6, 9, 8], color: '#754b3b' }
    ];
    const boulderEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
      [4, 8], [7, 8], [5, 9], [6, 9], [8, 9]
    ];
    this.registerModel('boulder', { vertices: boulderVerts, edges: boulderEdges, faces: boulderFaces });
    this.registerModel('rockslide', { vertices: boulderVerts, edges: boulderEdges, faces: boulderFaces });

    // 3. Multi-Spike Crystalline Ore Cluster Model (Tall, sharp 3-spire crystal cluster — distinct from boulders!)
    const oreVerts = [
      // Base hexagon/quad (0..3)
      [-0.32, 0.0, -0.28], [0.32, 0.0, -0.28], [0.32, 0.0, 0.28], [-0.32, 0.0, 0.28],
      // Tall Center Crystal Spire Tip (4)
      [0.0, 1.32, 0.0],
      // Left Angled Crystal Spire Tip (5)
      [-0.48, 0.92, 0.05],
      // Right Angled Crystal Spire Tip (6)
      [0.48, 0.96, -0.05],
      // Mid-waist facet ring (7..10)
      [-0.22, 0.55, -0.22], [0.22, 0.55, -0.22], [0.22, 0.55, 0.22], [-0.22, 0.55, 0.22]
    ];
    const oreFaces = [
      { indices: [7, 8, 4] },
      { indices: [8, 9, 4] },
      { indices: [9, 10, 4] },
      { indices: [10, 7, 4] },
      { indices: [0, 3, 5] },
      { indices: [3, 10, 5] },
      { indices: [1, 2, 6] },
      { indices: [2, 9, 6] }
    ];
    const oreEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [7, 8], [8, 9], [9, 10], [10, 7],
      [0, 7], [1, 8], [2, 9], [3, 10],
      // Center tall crystal spire
      [7, 4], [8, 4], [9, 4], [10, 4],
      // Left crystal spire
      [0, 5], [3, 5], [7, 5], [10, 5],
      // Right crystal spire
      [1, 6], [2, 6], [8, 6], [9, 6]
    ];
    this.registerModel('ore', { vertices: oreVerts, edges: oreEdges, faces: oreFaces });

    // 4. Rogue LHD Loader Vehicle Model
    const loaderVerts = [
      [-0.48, 0.0, -0.8], [0.48, 0.0, -0.8], [0.48, 0.0, 0.8], [-0.48, 0.0, 0.8],
      [-0.45, 0.65, -0.75], [0.45, 0.65, -0.75], [0.45, 0.55, 0.45], [-0.45, 0.55, 0.45],
      [-0.54, 0.08, 0.8], [0.54, 0.08, 0.8], [0.54, 0.52, 1.15], [-0.54, 0.52, 1.15],
      [-0.35, 0.98, -0.45], [0.35, 0.98, -0.45], [0.35, 0.98, 0.15], [-0.35, 0.98, 0.15]
    ];
    const loaderFaces = [
      { indices: [0, 1, 5, 4], color: '#5c3818' },
      { indices: [4, 5, 6, 7], color: '#784820' },
      { indices: [8, 9, 10, 11], color: '#3a2410' },
      { indices: [12, 13, 14, 15], color: '#945b27' }
    ];
    const loaderEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
      [8, 9], [9, 10], [10, 11], [11, 8],
      [6, 10], [7, 11],
      [12, 13], [13, 14], [14, 15], [15, 12],
      [4, 12], [5, 13], [6, 14], [7, 15]
    ];
    this.registerModel('rogue_loader', { vertices: loaderVerts, edges: loaderEdges, faces: loaderFaces });

    // 5. Mine Crew Service Pickup / Utility Truck Model
    const serviceVerts = [
      [-0.42, 0.0, -0.7], [0.42, 0.0, -0.7], [0.42, 0.0, 0.7], [-0.42, 0.0, 0.7],
      [-0.42, 0.48, -0.7], [0.42, 0.48, -0.7], [0.42, 0.48, 0.7], [-0.42, 0.48, 0.7],
      [-0.36, 0.92, -0.25], [0.36, 0.92, -0.25], [0.36, 0.92, 0.35], [-0.36, 0.92, 0.35]
    ];
    const serviceFaces = [
      { indices: [0, 1, 5, 4], color: '#705818' },
      { indices: [3, 2, 6, 7], color: '#8a6d1f' },
      { indices: [8, 9, 10, 11], color: '#b58e28' }
    ];
    const serviceEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
      [8, 9], [9, 10], [10, 11], [11, 8],
      [4, 8], [5, 9], [6, 10], [7, 11]
    ];
    this.registerModel('service_truck', { vertices: serviceVerts, edges: serviceEdges, faces: serviceFaces });

    // 6. Autonomous Survey Drill Rig Model
    const drillVerts = [
      [-0.44, 0.0, -0.45], [0.44, 0.0, -0.45], [0.44, 0.0, 0.45], [-0.44, 0.0, 0.45],
      [-0.38, 0.45, -0.4], [0.38, 0.45, -0.4], [0.38, 0.45, 0.4], [-0.38, 0.45, 0.4],
      [-0.12, 1.15, -0.12], [0.12, 1.15, -0.12], [0.12, 1.15, 0.12], [-0.12, 1.15, 0.12]
    ];
    const drillFaces = [
      { indices: [0, 1, 5, 4], color: '#5c2a2a' },
      { indices: [3, 2, 6, 7], color: '#783535' },
      { indices: [4, 5, 9, 8], color: '#994242' }
    ];
    const drillEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
      [8, 9], [9, 10], [10, 11], [11, 8],
      [4, 8], [5, 9], [6, 10], [7, 11]
    ];
    this.registerModel('drill_drone', { vertices: drillVerts, edges: drillEdges, faces: drillFaces });

    // 7. Overhead Arch Gate Model
    const gateVerts = [
      [-0.5, 0.0, -0.12], [-0.38, 0.0, -0.12], [-0.38, 1.0, -0.12], [-0.5, 1.0, -0.12],
      [0.38, 0.0, -0.12], [0.5, 0.0, -0.12], [0.5, 1.0, -0.12], [0.38, 1.0, -0.12],
      [-0.5, 0.82, 0.12], [0.5, 0.82, 0.12], [0.5, 1.0, 0.12], [-0.5, 1.0, 0.12]
    ];
    const gateFaces = [
      { indices: [0, 1, 2, 3] },
      { indices: [4, 5, 6, 7] },
      { indices: [8, 9, 10, 11] }
    ];
    const gateEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [3, 6], [2, 7], [8, 9], [9, 10], [10, 11], [11, 8]
    ];
    this.registerModel('gate', { vertices: gateVerts, edges: gateEdges, faces: gateFaces });

    // 8. Default Box / Trench / Plume Fallback
    const boxVerts = [
      [-0.5, 0, -0.3], [0.5, 0, -0.3], [0.5, 0, 0.3], [-0.5, 0, 0.3],
      [-0.5, 1, -0.3], [0.5, 1, -0.3], [0.5, 1, 0.3], [-0.5, 1, 0.3]
    ];
    const boxEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    const boxFaces = [
      { indices: [3, 2, 6, 7] },
      { indices: [4, 5, 6, 7] }
    ];
    this.registerModel('default_box', { vertices: boxVerts, edges: boxEdges, faces: boxFaces });
  }
}

export const modelRegistry = new ModelRegistry();
