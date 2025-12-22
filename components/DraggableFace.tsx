import React, { useRef, useEffect, useState } from 'react';
import { FaceData } from '../types';
import { ToolType } from './NetEditor';

interface Props {
  data: FaceData;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onDrawUpdate: (id: number) => void;
  isHoveredBy3D: boolean;
  onHover: (id: number | null) => void;
  gridSize: number; // pixel size of grid cell
  drawingColor: string;
  activeTool: ToolType;
}

export const DraggableFace: React.FC<Props> = ({ 
  data, isSelected, onSelect, onDrawUpdate, isHoveredBy3D, onHover, gridSize, drawingColor, activeTool
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const startPosRef = useRef<{x: number, y: number}>({x: 0, y: 0});

  // Sync ref back to parent data for 3D usage
  useEffect(() => {
    if (data.canvasRef && canvasRef.current) {
      data.canvasRef.current = canvasRef.current;
    }
  }, [data]);

  // Init Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // High DPI
    const dpr = window.devicePixelRatio || 1;
    // Logical size
    const size = 256; 
    
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        ctx.font = "bold 60px Arial";
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(data.id.toString(), size/2, size/2);
        
        contextRef.current = ctx;
        onDrawUpdate(data.id);
      }
    }
  }, []);

  // Drawing Handlers
  const startDrawing = ({ nativeEvent }: { nativeEvent: PointerEvent | MouseEvent | TouchEvent }) => {
    if (!isSelected) {
        onSelect(data.id);
        return;
    }
    
    const { offsetX, offsetY } = getOffset(nativeEvent);
    if(contextRef.current && canvasRef.current) {
        setIsDrawing(true);
        startPosRef.current = { x: offsetX, y: offsetY };

        contextRef.current.strokeStyle = drawingColor;
        contextRef.current.fillStyle = drawingColor;
        contextRef.current.lineWidth = 4;

        if (activeTool === 'brush') {
            contextRef.current.beginPath();
            contextRef.current.moveTo(offsetX, offsetY);
        } else {
            // Save state for shape preview
            // Note: We need the raw canvas dimensions for getImageData
            const canvas = canvasRef.current;
            snapshotRef.current = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
        }
    }
  };

  const draw = ({ nativeEvent }: { nativeEvent: PointerEvent | MouseEvent | TouchEvent }) => {
    if (!isDrawing || !contextRef.current) return;
    const { offsetX, offsetY } = getOffset(nativeEvent);
    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;

    if (activeTool === 'brush') {
        contextRef.current.lineTo(offsetX, offsetY);
        contextRef.current.stroke();
    } else {
        // Restore snapshot to clear previous frame of the drag
        if (snapshotRef.current) {
            contextRef.current.putImageData(snapshotRef.current, 0, 0);
        }

        contextRef.current.beginPath();
        if (activeTool === 'line') {
            contextRef.current.moveTo(startX, startY);
            contextRef.current.lineTo(offsetX, offsetY);
            contextRef.current.stroke();
        } else if (activeTool === 'circle') {
            const radius = Math.sqrt(Math.pow(offsetX - startX, 2) + Math.pow(offsetY - startY, 2));
            contextRef.current.arc(startX, startY, radius, 0, 2 * Math.PI);
            contextRef.current.stroke();
        } else if (activeTool === 'triangle') {
            // Draw a triangle from start to current
            contextRef.current.moveTo(startX, startY + (offsetY - startY)); // Bottom left (approx) logic? 
            // Let's do Isosceles based on drag box
            // Start is Top Center? No, let's treat Start as Center and drag is radius-ish?
            // Simple: Start is one vertex, mouse is second, third is computed.
            // Or Box: Start is top-left corner, mouse is bottom-right.
            
            // Triangle inscribed in the rect formed by start/current
            const topX = startX + (offsetX - startX) / 2;
            const topY = startY;
            const botLeftX = startX;
            const botLeftY = offsetY;
            const botRightX = offsetX;
            const botRightY = offsetY;
            
            contextRef.current.moveTo(topX, topY);
            contextRef.current.lineTo(botRightX, botRightY);
            contextRef.current.lineTo(botLeftX, botLeftY);
            contextRef.current.closePath();
            contextRef.current.stroke();
        }
    }
  };

  const stopDrawing = () => {
    if(isDrawing) {
        contextRef.current?.closePath();
        setIsDrawing(false);
        snapshotRef.current = null;
        onDrawUpdate(data.id);
    }
  };
  
  const getOffset = (evt: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return { offsetX: 0, offsetY: 0 };
      
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      
      if (evt.touches && evt.touches.length > 0) {
          clientX = evt.touches[0].clientX;
          clientY = evt.touches[0].clientY;
      } else {
          clientX = evt.clientX;
          clientY = evt.clientY;
      }

      const x = (clientX - rect.left) / rect.width * 256;
      const y = (clientY - rect.top) / rect.height * 256;
      return { offsetX: x, offsetY: y };
  };

  return (
    <div
      className={`absolute transition-all duration-300 ease-out border-2 select-none
        ${isSelected ? 'border-blue-500 shadow-xl z-20 scale-105' : 'border-gray-300 shadow-sm z-10'}
        ${isHoveredBy3D ? 'ring-4 ring-yellow-400' : ''}
      `}
      style={{
        width: gridSize - 4,
        height: gridSize - 4,
        left: data.x * gridSize + 2,
        top: data.y * gridSize + 2,
        backgroundColor: 'white',
        cursor: isSelected ? 'crosshair' : 'pointer'
      }}
      onClick={() => onSelect(data.id)}
      onPointerEnter={() => onHover(data.id)}
      onPointerLeave={() => onHover(null)}
      onPointerDown={startDrawing}
      onPointerMove={draw}
      onPointerUp={stopDrawing}
      onPointerOut={stopDrawing}
    >
      <canvas ref={canvasRef} className="w-full h-full block touch-none" />
      
      {/* Label for accessibility/clarity */}
      <div className="absolute top-1 left-1 pointer-events-none text-xs text-gray-400 font-mono">
        Face {data.id + 1}
      </div>
    </div>
  );
};