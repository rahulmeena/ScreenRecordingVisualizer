'use client';

import { useEffect, useRef } from 'react';

interface ActionOverlayProps {
  events: any[];
  containerRef: React.RefObject<HTMLDivElement>;
  currentTime: number;
}

export default function ActionOverlay({ events, containerRef, currentTime }: ActionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw events on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    
    // Resize canvas to match video container
    const containerRect = containerRef.current.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw events
    events.forEach(event => {
      // Convert event coordinates to canvas coordinates (assuming 1280x800 original)
      const scaleX = canvas.width / 1280;
      const scaleY = canvas.height / 800;
      
      // Handle different event types
      switch (event.kind) {
        case 'mouse_down':
          drawClick(ctx, event.x * scaleX, event.y * scaleY, event.button);
          break;
        
        case 'key_down':
          drawKeyPress(ctx, event.key);
          break;
        
        case 'drag_end':
          drawDrag(
            ctx, 
            event.start_x * scaleX, 
            event.start_y * scaleY, 
            event.end_x * scaleX, 
            event.end_y * scaleY
          );
          break;
        
        case 'scroll':
          drawScroll(ctx, event.x * scaleX, event.y * scaleY, event.dy);
          break;
      }
    });
  }, [events, containerRef, currentTime]);
  
  // Draw a mouse click
  function drawClick(ctx: CanvasRenderingContext2D, x: number, y: number, button: string) {
    const radius = button === 'right' ? 15 : 20;
    const color = button === 'right' ? 'rgba(255, 160, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)';
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x, y, radius - 5, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  // Draw a key press
  function drawKeyPress(ctx: CanvasRenderingContext2D, key: string) {
    // Display key press at the top of the screen
    const text = key.length === 1 ? key.toUpperCase() : key;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, ctx.measureText(text).width + 20, 30);
    
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText(text, 20, 30);
  }
  
  // Draw a drag operation
  function drawDrag(
    ctx: CanvasRenderingContext2D, 
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number
  ) {
    // Draw start and end points
    ctx.beginPath();
    ctx.arc(startX, startY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 200, 0, 0.6)';
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(endX, endY, 12, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 200, 0, 0.6)';
    ctx.fill();
    
    // Draw line connecting them
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(0, 200, 0, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw arrow head
    const angle = Math.atan2(endY - startY, endX - startX);
    const length = 15;
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - length * Math.cos(angle - Math.PI / 6),
      endY - length * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      endX - length * Math.cos(angle + Math.PI / 6),
      endY - length * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 200, 0, 0.8)';
    ctx.fill();
  }
  
  // Draw scroll action
  function drawScroll(ctx: CanvasRenderingContext2D, x: number, y: number, direction: number) {
    const size = 30;
    
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 100, 255, 0.4)';
    ctx.fill();
    
    // Draw scroll direction arrow
    const arrowHeight = 20;
    const arrowWidth = 15;
    
    ctx.beginPath();
    if (direction > 0) {
      // Scroll down
      ctx.moveTo(x, y + arrowHeight / 2);
      ctx.lineTo(x - arrowWidth / 2, y - arrowHeight / 2);
      ctx.lineTo(x + arrowWidth / 2, y - arrowHeight / 2);
    } else {
      // Scroll up
      ctx.moveTo(x, y - arrowHeight / 2);
      ctx.lineTo(x - arrowWidth / 2, y + arrowHeight / 2);
      ctx.lineTo(x + arrowWidth / 2, y + arrowHeight / 2);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 100, 255, 0.8)';
    ctx.fill();
  }
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
} 