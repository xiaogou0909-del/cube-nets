import { MutableRefObject } from 'react';

export interface FaceData {
  id: number;
  x: number; // Grid X (0-6)
  y: number; // Grid Y (0-6)
  color: string;
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>; // Ref to the 2D canvas for texture
}

export interface GridPos {
  x: number;
  y: number;
}

// Tree structure for 3D folding hierarchy
export interface FaceNode {
  id: number;
  directionFromParent: 'top' | 'bottom' | 'left' | 'right' | 'root';
  children: FaceNode[];
  depth: number; // Distance from root
}

export interface FoldingStatus {
  isValid: boolean;
  message?: string;
}

// Adjacency for highlighting
// Which side of the current face connects to which side of another face?
export type EdgeSide = 'top' | 'bottom' | 'left' | 'right';

export interface EdgeConnection {
  targetFaceId: number;
  targetSide: EdgeSide;
  color: string; // The highlight color
  reversed: boolean; // True if the edge vertices align in reverse order (e.g. p1a->p2b)
}

export interface AdjacencyMap {
  [faceId: number]: {
    [key in EdgeSide]?: EdgeConnection;
  };
}

export interface DraggableFaceHandle {
  undo: () => void;
  saveHistory: () => void;
}