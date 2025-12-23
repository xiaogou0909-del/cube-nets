import { FaceData, FaceNode, FoldingStatus, AdjacencyMap, EdgeSide } from './types';
import * as THREE from 'three';

// Constants
export const GRID_SIZE = 7; // Enough space for any net configuration

export const SIDE_COLORS: Record<EdgeSide, string> = {
  'top': '#ef4444',    // Red
  'right': '#22c55e',  // Green
  'bottom': '#3b82f6', // Blue
  'left': '#eab308'    // Yellow/Orange
};

// Directions
const DIRS = [
  { dx: 0, dy: -1, name: 'top' },
  { dx: 0, dy: 1, name: 'bottom' },
  { dx: -1, dy: 0, name: 'left' },
  { dx: 1, dy: 0, name: 'right' },
] as const;

// Presets
export const PRESETS: Record<string, {name: string, coords: {x:number, y:number}[]}> = {
  'cross': {
    name: '十字形 (1-4-1)',
    coords: [{x:2,y:2}, {x:2,y:1}, {x:2,y:3}, {x:2,y:4}, {x:1,y:2}, {x:3,y:2}]
  },
  't-shape': {
    name: 'T 字形 (1-4-1)',
    coords: [{x:2,y:3}, {x:2,y:2}, {x:2,y:1}, {x:1,y:2}, {x:3,y:2}, {x:2,y:4}]
  },
  'offset': {
    name: '错位形 (1-4-1)',
    coords: [{x:1,y:2}, {x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:2,y:1}, {x:3,y:3}]
  },
  'split': {
    name: '分裂形 (1-4-1)',
    coords: [{x:1,y:2}, {x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:2,y:1}, {x:4,y:3}]
  },
  'hook': {
    name: '钩形 (2-3-1)',
    coords: [{x:1,y:1}, {x:2,y:1}, {x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:4,y:3}]
  },
  'stairs': {
    name: '阶梯形 (2-2-2)',
    coords: [{x:1,y:2}, {x:2,y:2}, {x:2,y:3}, {x:3,y:3}, {x:3,y:4}, {x:4,y:4}]
  },
  'z-shape': {
    name: 'Z 字形 (2-2-2)',
    coords: [{x:1,y:1}, {x:2,y:1}, {x:2,y:2}, {x:3,y:2}, {x:3,y:3}, {x:4,y:3}]
  },
  'rectangle': {
    name: '长方形 (无效)',
    coords: [{x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:2,y:3}, {x:3,y:3}, {x:4,y:3}]
  },
  'long': {
    name: '长条形 (无效)',
    coords: [{x:0,y:3}, {x:1,y:3}, {x:2,y:3}, {x:3,y:3}, {x:4,y:3}, {x:5,y:3}]
  }
};

// 1. Check if the graph is fully connected (BFS)
export const isConnected = (faces: FaceData[]): boolean => {
  if (faces.length === 0) return true;
  const start = faces[0];
  const visited = new Set<number>();
  const queue = [start];
  visited.add(start.id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    // Find neighbors in the faces array
    const neighbors = faces.filter(f => 
      !visited.has(f.id) &&
      Math.abs(f.x - current.x) + Math.abs(f.y - current.y) === 1
    );
    for (const n of neighbors) {
      visited.add(n.id);
      queue.push(n);
    }
  }
  return visited.size === faces.length;
};

// 2. Validate if it folds into a cube
export const checkGeometricValidity = (faces: FaceData[]): FoldingStatus => {
  if (faces.length !== 6) return { isValid: false, message: "需要正好 6 个正方形。" };
  if (!isConnected(faces)) return { isValid: false, message: "所有正方形必须相连。" };

  const root = faces[0];
  const queue = [{
    id: root.id,
    normal: [0, 0, 1],
    up: [0, 1, 0]
  }];

  const visited = new Set<number>();
  visited.add(root.id);

  const uniqueNormals = new Set<string>();
  uniqueNormals.add("0,0,1");

  const idMap = new Map(faces.map(f => [f.id, f]));

  while (queue.length > 0) {
    const { id, normal, up } = queue.shift()!;
    const currentFace = idMap.get(id)!;

    // Check all 4 neighbors
    for (const dir of DIRS) {
      const nx = currentFace.x + dir.dx;
      const ny = currentFace.y + dir.dy;
      const neighbor = faces.find(f => f.x === nx && f.y === ny);

      if (neighbor && !visited.has(neighbor.id)) {
        visited.add(neighbor.id);

        let nextNormal = [...normal];
        let nextUp = [...up];

        // 3D Rotation math (simulated)
        const crossX = up[1] * normal[2] - up[2] * normal[1];
        const crossY = up[2] * normal[0] - up[0] * normal[2];
        const crossZ = up[0] * normal[1] - up[1] * normal[0];
        const rightVec = [crossX, crossY, crossZ];

        if (dir.name === 'top') {
           nextNormal = [...up];
           nextUp = [-normal[0], -normal[1], -normal[2]];
        } else if (dir.name === 'bottom') {
           nextNormal = [-up[0], -up[1], -up[2]];
           nextUp = [...normal];
        } else if (dir.name === 'right') {
           nextNormal = [...rightVec];
           nextUp = [...up];
        } else if (dir.name === 'left') {
           nextNormal = [-rightVec[0], -rightVec[1], -rightVec[2]];
           nextUp = [...up];
        }

        const normalKey = nextNormal.map(n => Math.round(n)).join(',');
        
        if (uniqueNormals.has(normalKey)) {
             return { isValid: false, message: "折叠后发生重叠！" };
        }
        
        uniqueNormals.add(normalKey);
        queue.push({
            id: neighbor.id,
            normal: nextNormal,
            up: nextUp
        });
      }
    }
  }

  return { isValid: true };
};


// 3. Build Tree for Animation
export const buildFoldTree = (faces: FaceData[]): FaceNode | null => {
  if (faces.length === 0) return null;

  // Root selection: Try to pick the face closest to the center of the structure
  const avgX = faces.reduce((sum, f) => sum + f.x, 0) / faces.length;
  const avgY = faces.reduce((sum, f) => sum + f.y, 0) / faces.length;
  
  let rootFace = faces[0];
  let minDist = 999;
  for (const f of faces) {
      const dist = Math.sqrt(Math.pow(f.x - avgX, 2) + Math.pow(f.y - avgY, 2));
      if (dist < minDist) {
          minDist = dist;
          rootFace = f;
      }
  }

  const visited = new Set<number>();
  const queue: { face: FaceData, parentNode: FaceNode, depth: number }[] = [];

  const rootNode: FaceNode = {
    id: rootFace.id,
    directionFromParent: 'root',
    children: [],
    depth: 0
  };

  visited.add(rootFace.id);
  queue.push({ face: rootFace, parentNode: rootNode, depth: 0 });

  while (queue.length > 0) {
    const { face, parentNode, depth } = queue.shift()!;
    
    // Find neighbors
    for (const dir of DIRS) {
      const nx = face.x + dir.dx;
      const ny = face.y + dir.dy;
      const neighbor = faces.find(f => f.x === nx && f.y === ny);

      if (neighbor && !visited.has(neighbor.id)) {
        const newNode: FaceNode = {
          id: neighbor.id,
          directionFromParent: dir.name,
          children: [],
          depth: depth + 1
        };
        parentNode.children.push(newNode);
        visited.add(neighbor.id);
        queue.push({ face: neighbor, parentNode: newNode, depth: depth + 1 });
      }
    }
  }

  return rootNode;
};

// 4. Calculate 3D Adjacency
// This simulates folding in 3D to find which edges touch
export const calculateAdjacency = (faces: FaceData[]): AdjacencyMap => {
  const map: AdjacencyMap = {};
  if (faces.length !== 6 || !isConnected(faces)) return map;

  const tree = buildFoldTree(faces);
  if (!tree) return map;

  // We need to calculate the 4 corner points for each face in 3D space.
  // We'll use THREE.js math for convenience
  const faceCorners: { id: number, corners: THREE.Vector3[] }[] = [];

  const traverse = (node: FaceNode, parentMatrix: THREE.Matrix4) => {
      const localMatrix = new THREE.Matrix4();
      
      // Pivot transforms:
      let px = 0, py = 0, pz = 0;
      
      if (node.directionFromParent === 'root') {
          // Identity
      } else {
          const pivot = new THREE.Vector3();
          const axis = new THREE.Vector3();
          let angle = 0;

          switch(node.directionFromParent) {
            case 'top': pivot.set(0, 0.5, 0); axis.set(1,0,0); angle = -Math.PI/2; break;
            case 'bottom': pivot.set(0, -0.5, 0); axis.set(1,0,0); angle = Math.PI/2; break;
            case 'left': pivot.set(-0.5, 0, 0); axis.set(0,1,0); angle = -Math.PI/2; break;
            case 'right': pivot.set(0.5, 0, 0); axis.set(0,1,0); angle = Math.PI/2; break;
          }

          const matPivot = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z);
          const matRot = new THREE.Matrix4().makeRotationAxis(axis, angle);
          
          const offsetToCenter = new THREE.Vector3();
           switch(node.directionFromParent) {
            case 'top': offsetToCenter.set(0, 0.5, 0); break;
            case 'bottom': offsetToCenter.set(0, -0.5, 0); break;
            case 'left': offsetToCenter.set(-0.5, 0, 0); break;
            case 'right': offsetToCenter.set(0.5, 0, 0); break;
          }
          
          // Matrix chain
          localMatrix.multiply(matPivot);
          localMatrix.multiply(matRot);
          localMatrix.multiply(new THREE.Matrix4().makeTranslation(offsetToCenter.x, offsetToCenter.y, offsetToCenter.z));
      }

      const globalMatrix = parentMatrix.clone().multiply(localMatrix);
      
      // Calculate Corners in Global Space
      // Square is 1x1, centered at 0. corners at +/- 0.5
      const corners = [
        new THREE.Vector3(-0.5, 0.5, 0), // TL (0)
        new THREE.Vector3(0.5, 0.5, 0),  // TR (1)
        new THREE.Vector3(0.5, -0.5, 0), // BR (2)
        new THREE.Vector3(-0.5, -0.5, 0) // BL (3)
      ].map(v => v.applyMatrix4(globalMatrix));
      
      faceCorners.push({ id: node.id, corners });

      node.children.forEach(c => traverse(c, globalMatrix));
  };

  traverse(tree, new THREE.Matrix4());

  // Define Edges by Corner indices (0=TL, 1=TR, 2=BR, 3=BL)
  // Top: 0-1, Right: 1-2, Bottom: 2-3, Left: 3-0
  const edgeDefs: { side: EdgeSide, i1: number, i2: number }[] = [
    { side: 'top', i1: 0, i2: 1 },
    { side: 'right', i1: 1, i2: 2 },
    { side: 'bottom', i1: 2, i2: 3 },
    { side: 'left', i1: 3, i2: 0 },
  ];

  // Compare all edges of all faces
  // Two edges touch if their endpoints match (distance epsilon)
  // Order might be swapped
  const EPS = 0.01;

  for (let i = 0; i < faceCorners.length; i++) {
    const f1 = faceCorners[i];
    map[f1.id] = {};
    
    for (let j = 0; j < faceCorners.length; j++) {
       if (i === j) continue;
       const f2 = faceCorners[j];

       // Check every edge of f1 against every edge of f2
       for (const e1 of edgeDefs) {
          const p1a = f1.corners[e1.i1];
          const p1b = f1.corners[e1.i2];

          for (const e2 of edgeDefs) {
             const p2a = f2.corners[e2.i1];
             const p2b = f2.corners[e2.i2];

             // Check distance match (p1a~p2a && p1b~p2b) OR (p1a~p2b && p1b~p2a)
             const matchDirect = p1a.distanceTo(p2a) < EPS && p1b.distanceTo(p2b) < EPS;
             const matchSwap = p1a.distanceTo(p2b) < EPS && p1b.distanceTo(p2a) < EPS;

             if (matchDirect || matchSwap) {
                 map[f1.id]![e1.side] = {
                   targetFaceId: f2.id,
                   targetSide: e2.side,
                   color: SIDE_COLORS[e1.side],
                   reversed: matchSwap // If swapped, p1 start aligns with p2 end
                 };
             }
          }
       }
    }
  }

  return map;
};