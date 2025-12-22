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