import { FaceData, FaceNode, FoldingStatus } from './types';

// Constants
export const GRID_SIZE = 7; // Enough space for any net configuration

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
    name: 'Cross (1-4-1)',
    coords: [{x:2,y:2}, {x:2,y:1}, {x:2,y:3}, {x:2,y:4}, {x:1,y:2}, {x:3,y:2}]
  },
  't-shape': {
    name: 'T-Shape (1-4-1)',
    coords: [{x:2,y:3}, {x:2,y:2}, {x:2,y:1}, {x:1,y:2}, {x:3,y:2}, {x:2,y:4}]
  },
  'offset': {
    name: 'Offset (1-4-1)',
    coords: [{x:1,y:2}, {x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:2,y:1}, {x:3,y:3}]
  },
  'split': {
    name: 'Split (1-4-1)',
    coords: [{x:1,y:2}, {x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:2,y:1}, {x:4,y:3}]
  },
  'hook': {
    name: 'Hook (2-3-1)',
    coords: [{x:1,y:1}, {x:2,y:1}, {x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:4,y:3}]
  },
  'stairs': {
    name: 'Stairs (2-2-2)',
    coords: [{x:1,y:2}, {x:2,y:2}, {x:2,y:3}, {x:3,y:3}, {x:3,y:4}, {x:4,y:4}]
  },
  'z-shape': {
    name: 'Z-Shape (2-2-2)',
    coords: [{x:1,y:1}, {x:2,y:1}, {x:2,y:2}, {x:3,y:2}, {x:3,y:3}, {x:4,y:3}]
  },
  'rectangle': {
    name: 'Rectangle (Invalid)',
    coords: [{x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:2,y:3}, {x:3,y:3}, {x:4,y:3}]
  },
  'long': {
    name: 'Strip (Invalid)',
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
  if (faces.length !== 6) return { isValid: false, message: "Need exactly 6 squares." };
  if (!isConnected(faces)) return { isValid: false, message: "Squares must be connected." };

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
             return { isValid: false, message: "Overlapping faces in 3D!" };
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
  // This helps the camera stay centered.
  const avgX = faces.reduce((sum, f) => sum + f.x, 0) / faces.length;
  const avgY = faces.reduce((sum, f) => sum + f.y, 0) / faces.length;
  
  // Find face closest to avg
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