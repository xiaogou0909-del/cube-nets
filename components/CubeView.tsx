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
  targetProgress: number; // 0 or 1
  hoveredFaceId: number | null;
  setHoveredFaceId: (id: number | null) => void;
  textureVersion: number;
  maxDepth: number;
  selectedId: number | null;
  adjacencyMap: AdjacencyMap;
  showSharedEdges: boolean;
  showFaceIds: boolean;
}

// Reusable line components to avoid recreation
const LINE_GEOMETRY = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.485, 0, 0),
    new THREE.Vector3(0.485, 0, 0)
]);

const FoldablePart: React.FC<{
  node: FaceNode;
  faces: FaceData[];
  smoothProgress: { current: number };
  maxDepth: number;
  hoveredFaceId: number | null;
  onHover: (id: number | null) => void;
  textureVersion: number;
  adjacencyMap: AdjacencyMap;
  selectedId: number | null;
  showSharedEdges: boolean;
  showFaceIds: boolean;
}> = ({ node, faces, smoothProgress, maxDepth, hoveredFaceId, onHover, textureVersion, adjacencyMap, selectedId, showSharedEdges, showFaceIds }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const faceData = faces.find(f => f.id === node.id);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  // Constants for animation to avoid re-calculation
  const targetAngle = useMemo(() => {
    switch (node.directionFromParent) {
        case 'top': return -Math.PI / 2;
        case 'bottom': return Math.PI / 2;
        case 'left': return -Math.PI / 2;
        case 'right': return Math.PI / 2;
        default: return 0;
    }
  }, [node.directionFromParent]);

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

  // Cleanup textures on unmount
  useEffect(() => {
      return () => {
          if (textureRef.current) {
              textureRef.current.dispose();
          }
      };
  }, []);

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
  useFrame((state, delta) => {
    if (groupRef.current && node.directionFromParent !== 'root') {
        const globalProgress = smoothProgress.current;
        let localP = 0;
        
        if (maxDepth > 0) {
            const scaledP = globalProgress * maxDepth;
            const startThreshold = node.depth - 1;
            localP = Math.max(0, Math.min(1, scaledP - startThreshold));
            
            // Cubic ease-in-out for more natural feel
            localP = localP < 0.5 
                ? 4 * localP * localP * localP 
                : 1 - Math.pow(-2 * localP + 2, 3) / 2;
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

  const EdgeLine = ({ rotation, position, color }: { rotation: [number, number, number], position: [number, number, number], color: string }) => {
     return (
        <mesh rotation={rotation} position={position}>
            <planeGeometry args={[0.97, 0.02]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} depthTest={false} />
        </mesh>
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
                    color={isHovered ? "#0A84FF" : "#ffffff"}
                    emissive={isHovered ? "#0A84FF" : "#000000"}
                    emissiveIntensity={isHovered ? 0.2 : 0}
                    roughness={0.8}
                    metalness={0.1}
                    transparent={false}
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
                    {getBorderColor('top') && <EdgeLine position={[0, 0.485, Z]} rotation={[0, 0, 0]} color={getBorderColor('top')!} />}
                    {getBorderColor('right') && <EdgeLine position={[0.485, 0, Z]} rotation={[0, 0, Math.PI / 2]} color={getBorderColor('right')!} />}
                    {getBorderColor('bottom') && <EdgeLine position={[0, -0.485, Z]} rotation={[0, 0, 0]} color={getBorderColor('bottom')!} />}
                    {getBorderColor('left') && <EdgeLine position={[-0.485, 0, Z]} rotation={[0, 0, Math.PI / 2]} color={getBorderColor('left')!} />}
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
                    smoothProgress={smoothProgress}
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

const Scene: React.FC<CubeViewProps & { smoothProgress: React.MutableRefObject<number> }> = (props) => {
  const { foldTree, targetProgress, smoothProgress } = props;

  // Animation Driver
  useFrame((state, delta) => {
      // Spring-like smooth transition
      const speed = 4.0;
      const diff = targetProgress - smoothProgress.current;
      
      if (Math.abs(diff) > 0.0001) {
          smoothProgress.current += diff * Math.min(1, delta * speed);
      } else {
          smoothProgress.current = targetProgress;
      }
  });

  if (!foldTree) return null;

  return (
    <>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
        <ArcballControls
            makeDefault
            minDistance={3}
            maxDistance={20}
            dampingFactor={0.15}
            enablePan={false}
        />

        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />

        <Center>
            <FoldablePart
                node={foldTree}
                faces={props.faces}
                smoothProgress={smoothProgress}
                maxDepth={props.maxDepth}
                hoveredFaceId={props.hoveredFaceId}
                onHover={props.setHoveredFaceId}
                textureVersion={props.textureVersion}
                adjacencyMap={props.adjacencyMap}
                selectedId={props.selectedId}
                showSharedEdges={props.showSharedEdges}
                showFaceIds={props.showFaceIds}
            />
        </Center>
    </>
  );
};

export const CubeView: React.FC<CubeViewProps> = (props) => {
  const smoothProgress = useRef(0);

  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      className="bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] rounded-2xl md:rounded-l-none"
      performance={{ min: 0.5 }}
      gl={{ 
        antialias: true,
        powerPreference: "high-performance"
      }}
    >
        <Scene {...props} smoothProgress={smoothProgress} />
    </Canvas>
  );
};
