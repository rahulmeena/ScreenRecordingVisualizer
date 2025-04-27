import React from 'react';
import { render } from '@testing-library/react';
import ActionOverlay from '../../src/components/ActionOverlay';

// Mock the useRef and canvas context
const mockGetContext = jest.fn();
const mockClearRect = jest.fn();
const mockBeginPath = jest.fn();
const mockArc = jest.fn();
const mockFill = jest.fn();
const mockStroke = jest.fn();
const mockMoveTo = jest.fn();
const mockLineTo = jest.fn();
const mockClosePath = jest.fn();
const mockFillRect = jest.fn();
const mockFillText = jest.fn();

// Mock canvas methods
HTMLCanvasElement.prototype.getContext = mockGetContext;
mockGetContext.mockReturnValue({
  clearRect: mockClearRect,
  beginPath: mockBeginPath,
  arc: mockArc,
  fill: mockFill,
  stroke: mockStroke,
  moveTo: mockMoveTo,
  lineTo: mockLineTo,
  closePath: mockClosePath,
  fillRect: mockFillRect,
  fillText: mockFillText,
  measureText: jest.fn().mockReturnValue({ width: 100 }),
});

describe('ActionOverlay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  const mockContainerRef = {
    current: {
      getBoundingClientRect: jest.fn().mockReturnValue({
        width: 1280,
        height: 800,
      }),
    },
  };
  
  it('renders without crashing', () => {
    const { container } = render(
      <ActionOverlay
        events={[]}
        containerRef={mockContainerRef as React.RefObject<HTMLDivElement>}
        currentTime={0}
      />
    );
    
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
  
  it('renders mouse clicks correctly', () => {
    const events = [
      { kind: 'mouse_down', x: 100, y: 200, button: 'left' },
    ];
    
    render(
      <ActionOverlay
        events={events}
        containerRef={mockContainerRef as React.RefObject<HTMLDivElement>}
        currentTime={0}
      />
    );
    
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockArc).toHaveBeenCalled();
    expect(mockFill).toHaveBeenCalled();
  });
  
  it('renders key presses correctly', () => {
    const events = [
      { kind: 'key_down', key: 'a' },
    ];
    
    render(
      <ActionOverlay
        events={events}
        containerRef={mockContainerRef as React.RefObject<HTMLDivElement>}
        currentTime={0}
      />
    );
    
    expect(mockFillRect).toHaveBeenCalled();
    expect(mockFillText).toHaveBeenCalled();
  });
  
  it('renders drag events correctly', () => {
    const events = [
      { kind: 'drag_end', start_x: 100, start_y: 200, end_x: 300, end_y: 400 },
    ];
    
    render(
      <ActionOverlay
        events={events}
        containerRef={mockContainerRef as React.RefObject<HTMLDivElement>}
        currentTime={0}
      />
    );
    
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockArc).toHaveBeenCalled(); // For start point
    expect(mockMoveTo).toHaveBeenCalled();
    expect(mockLineTo).toHaveBeenCalled();
    expect(mockStroke).toHaveBeenCalled();
  });
  
  it('renders scroll events correctly', () => {
    const events = [
      { kind: 'scroll', x: 200, y: 300, dy: 1 },
    ];
    
    render(
      <ActionOverlay
        events={events}
        containerRef={mockContainerRef as React.RefObject<HTMLDivElement>}
        currentTime={0}
      />
    );
    
    expect(mockBeginPath).toHaveBeenCalled();
    expect(mockArc).toHaveBeenCalled();
    expect(mockFill).toHaveBeenCalled();
  });
  
  it('does not draw if canvas or container ref is null', () => {
    // Mock container ref as null
    const nullContainerRef = { current: null };
    
    render(
      <ActionOverlay
        events={[{ kind: 'mouse_down', x: 100, y: 200, button: 'left' }]}
        containerRef={nullContainerRef as any}
        currentTime={0}
      />
    );
    
    expect(mockClearRect).not.toHaveBeenCalled();
  });
}); 