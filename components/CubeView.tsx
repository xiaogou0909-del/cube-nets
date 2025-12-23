import React, { useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { ArcballControls, PerspectiveCamera, Center, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';
import { FaceData, FaceNode, AdjacencyMap, EdgeSide } from '../types';
import { SIDE_COLORS } from '../utils';

// Augment JSX namespace to satisfy TypeScript for R3F elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
      lineSegments: any;
      edgesGeometry: any;
      lineBasicMaterial: any;
    }
  }
}

interface CubeViewProps {
  faces: FaceData[];
  foldTree: FaceNode | null;
  foldProgress: number; // 0 to 1 (Global)
  hoveredFaceId: number | null;
  setHoveredFaceId: (id: number | null) => void;
  textureVersion: number; 
  maxDepth: number;
  selectedId: number | null;
  adjacencyMap: AdjacencyMap;
  showSharedEdges: boolean;
  showFaceIds: boolean;
}

const FoldablePart: React.FC<{
  node: FaceNode;
  faces: FaceData[];
  globalProgress: number;
  maxDepth: number;
  hoveredFaceId: number | null;
  onHover: (id: number | null) => void;
  textureVersion: number;
  adjacencyMap: AdjacencyMap;
  selectedId: number | null;
  showSharedEdges: boolean;
  showFaceIds: boolean;
}> = ({ node, faces, globalProgress, maxDepth, hoveredFaceId, onHover, textureVersion, adjacencyMap, selectedId, showSharedEdges, showFaceIds }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const faceData = faces.find(f => f.id === node.id);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (faceData?.canvasRef?.current && meshRef.current) {
        if (!textureRef.current) {
             const tex = new THREE.CanvasTexture(faceData.canvasRef.current);
             tex.colorSpace = THREE.SRGBColorSpace;
             textureRef.current = tex;
             if (Array.isArray(meshRef.current.material)) {
                // simple handle
             } else {
                (meshRef.current.material as THREE.MeshStandardMaterial).map = tex;
                (meshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
             }
        } else {
             textureRef.current.image = faceData.canvasRef.current;
             textureRef.current.needsUpdate = true;
        }
    }
  }, [textureVersion, faceData]);

  // Pivot positioning
  const pivotPosition = useMemo(() => {
     switch (node.directionFromParent) {
        case 'top': return [0, 0.5, 0];
        case 'bottom': return [0, -0.5, 0];
        case 'left': return [-0.5, 0, 0];
        case 'right': return [0.5, 0, 0];
        default: return [0, 0, 0];
     }
  }, [node.directionFromParent]);

  // Animation Frame
  useFrame(() => {
    if (groupRef.current && node.directionFromParent !== 'root') {
        let targetAngle = 0;
        
        switch (node.directionFromParent) {
            case 'top': targetAngle = -Math.PI / 2; break;
            case 'bottom': targetAngle = Math.PI / 2; break;
            case 'left': targetAngle = -Math.PI / 2; break;
            case 'right': targetAngle = Math.PI / 2; break;
        }

        let localP = 0;
        if (maxDepth > 0) {
            const scaledP = globalProgress * maxDepth;
            const startThreshold = node.depth - 1;
            localP = Math.max(0, Math.min(1, scaledP - startThreshold));
            localP = 1 - Math.pow(1 - localP, 3);
        } else {
            localP = globalProgress;
        }

        const currentAngle = targetAngle * localP;
        
        if (node.directionFromParent === 'top' || node.directionFromParent === 'bottom') {
            groupRef.current.rotation.x = currentAngle;
        } else {
            groupRef.current.rotation.y = currentAngle;
        }
    }
  });

  const meshOffset = useMemo(() => {
      switch (node.directionFromParent) {
          case 'top': return [0, 0.5, 0];
          case 'bottom': return [0, -0.5, 0];
          case 'left': return [-0.5, 0, 0];
          case 'right': return [0.5, 0, 0];
          case 'root': return [0, 0, 0];
          default: return [0, 0, 0];
      }
  }, [node.directionFromParent]);

  const isHovered = hoveredFaceId === node.id;
  
  // Highlight Geometry for Adjacency
  const activeAdjacency = adjacencyMap[node.id];
  const isSelected = selectedId === node.id;
  
  const getBorderColor = (side: EdgeSide): string | null => {
      if (!activeAdjacency) return null;
      const conn = activeAdjacency[side];
      if (!conn) return null;
      
      if (isSelected) return conn.color;
      if (conn.targetFaceId === selectedId) {
          // If connected to selected face, match the color of the selected face's connection
          return SIDE_COLORS[conn.targetSide];
      }
      
      return null;
  };

  const EdgeLine = ({ start, end, color }: { start: [number,number,number], end: [number,number,number], color: string }) => {
     // eslint-disable-next-line react-hooks/exhaustive-deps
     const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
     return (
        <line>
            <bufferGeometry>
                <float32BufferAttribute attach="attributes-position" args={[new Float32Array([...start, ...end]), 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={color} linewidth={3} depthTest={false} />
        </line>
     );
  };

  // Border Coordinates (Local to mesh, center 0,0,0, size 1x1)
  const Z = 0.01;

  return (
    <group position={node.directionFromParent === 'root' ? [0,0,0] : (pivotPosition as any)} ref={groupRef}>
        <group position={meshOffset as any}>
            <mesh 
                ref={meshRef}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(node.id); }}
                onPointerOut={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(null); }}
            >
                <planeGeometry args={[0.98, 0.98]} />
                <meshStandardMaterial 
                    side={THREE.DoubleSide} 
                    color={isHovered ? "#fef08a" : "#ffffff"} 
                    emissive={isHovered ? "#fef08a" : "#000000"}
                    emissiveIntensity={isHovered ? 0.2 : 0}
                    roughness={0.6}
                />
            </mesh>
            
            {/* Numbering - Floating Text */}
            {showFaceIds && (
                <Text 
                    position={[0, 0, 0.02]} 
                    fontSize={0.4} 
                    color="black" 
                    anchorX="center" 
                    anchorY="middle"
                    fillOpacity={0.15}
                >
                    {node.id + 1}
                </Text>
            )}

            {/* Adjacency Highlights */}
            {showSharedEdges && (
                <>
                    {getBorderColor('top') && <EdgeLine start={[-0.49, 0.49, Z]} end={[0.49, 0.49, Z]} color={getBorderColor('top')!} />}
                    {getBorderColor('right') && <EdgeLine start={[0.49, 0.49, Z]} end={[0.49, -0.49, Z]} color={getBorderColor('right')!} />}
                    {getBorderColor('bottom') && <EdgeLine start={[0.49, -0.49, Z]} end={[-0.49, -0.49, Z]} color={getBorderColor('bottom')!} />}
                    {getBorderColor('left') && <EdgeLine start={[-0.49, -0.49, Z]} end={[-0.49, 0.49, Z]} color={getBorderColor('left')!} />}
                </>
            )}

            {/* Backside */}
            <mesh position={[0,0,-0.01]} rotation={[0, Math.PI, 0]}>
                 <planeGeometry args={[0.98, 0.98]} />
                 <meshStandardMaterial color="#cbd5e1" side={THREE.FrontSide} />
            </mesh>

            {/* Recursion */}
            {node.children.map(child => (
                <FoldablePart 
                    key={child.id} 
                    node={child} 
                    faces={faces} 
                    globalProgress={globalProgress}
                    maxDepth={maxDepth}
                    hoveredFaceId={hoveredFaceId}
                    onHover={onHover}
                    textureVersion={textureVersion}
                    adjacencyMap={adjacencyMap}
                    selectedId={selectedId}
                    showSharedEdges={showSharedEdges}
                    showFaceIds={showFaceIds}
                />
            ))}
        </group>
    </group>
  );
};

export const CubeView: React.FC<CubeViewProps> = ({ 
  faces, foldTree, foldProgress, hoveredFaceId, setHoveredFaceId, textureVersion, maxDepth, selectedId, adjacencyMap, showSharedEdges, showFaceIds
}) => {
  if (!foldTree) return null;

  return (
    <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
        <ArcballControls 
            makeDefault 
            minDistance={3} 
            maxDistance={20}
        />
        
        <Environment preset="city" />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} castShadow />

        <Center>
            <FoldablePart 
                node={foldTree} 
                faces={faces} 
                globalProgress={foldProgress}
                maxDepth={maxDepth}
                hoveredFaceId={hoveredFaceId}
                onHover={setHoveredFaceId}
                textureVersion={textureVersion}
                adjacencyMap={adjacencyMap}
                selectedId={selectedId}
                showSharedEdges={showSharedEdges}
                showFaceIds={showFaceIds}
            />
        </Center>
    </Canvas>
  );
};