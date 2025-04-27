import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventsList from '../../src/components/EventsList';
import { fetchEventData } from '../../src/lib/client';

// Mock the client library
jest.mock('../../src/lib/client', () => ({
  fetchEventData: jest.fn(),
}));

describe('EventsList Component', () => {
  const mockEvents = {
    meta: { fps: 10 },
    events: [
      { t: 1000, kind: 'mouse_down', button: 'left', x: 100, y: 200 },
      { t: 2000, kind: 'key_down', key: 'a' },
      { t: 3000, kind: 'scroll', x: 300, y: 400, dy: 1 },
      { t: 4000, kind: 'drag_end', start_x: 100, start_y: 200, end_x: 300, end_y: 400 },
    ],
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchEventData as jest.Mock).mockResolvedValue(mockEvents);
  });
  
  it('renders loading state initially', () => {
    render(<EventsList eventsUrl="/api/events/123" />);
    
    expect(screen.getByText('Loading events...')).toBeInTheDocument();
  });
  
  it('fetches and displays events', async () => {
    render(<EventsList eventsUrl="/api/events/123" />);
    
    // Check if fetch was called
    expect(fetchEventData).toHaveBeenCalledWith('/api/events/123');
    
    // Wait for events to load
    await waitFor(() => {
      expect(screen.queryByText('Loading events...')).toBeNull();
    });
    
    // Check if filter buttons are rendered
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Mouse')).toBeInTheDocument();
    expect(screen.getByText('Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Scroll')).toBeInTheDocument();
    
    // Check if all events are displayed
    expect(screen.getByText(/left click at/)).toBeInTheDocument();
    expect(screen.getByText(/Key press: a/)).toBeInTheDocument();
    expect(screen.getByText(/Scroll down at/)).toBeInTheDocument();
    expect(screen.getByText(/Drag from/)).toBeInTheDocument();
  });
  
  it('filters events when clicking filter buttons', async () => {
    render(<EventsList eventsUrl="/api/events/123" />);
    
    // Wait for events to load
    await waitFor(() => {
      expect(screen.queryByText('Loading events...')).toBeNull();
    });
    
    // Click the Mouse filter
    fireEvent.click(screen.getByText('Mouse'));
    
    // Should show mouse events and hide others
    expect(screen.getByText(/left click at/)).toBeInTheDocument();
    expect(screen.getByText(/Drag from/)).toBeInTheDocument();
    expect(screen.queryByText(/Key press: a/)).toBeNull();
    expect(screen.queryByText(/Scroll down at/)).toBeNull();
    
    // Click the Keyboard filter
    fireEvent.click(screen.getByText('Keyboard'));
    
    // Should show only keyboard events
    expect(screen.queryByText(/left click at/)).toBeNull();
    expect(screen.queryByText(/Drag from/)).toBeNull();
    expect(screen.getByText(/Key press: a/)).toBeInTheDocument();
    expect(screen.queryByText(/Scroll down at/)).toBeNull();
  });
  
  it('displays a message when no events are found', async () => {
    // Mock empty events
    (fetchEventData as jest.Mock).mockResolvedValue({ events: [] });
    
    render(<EventsList eventsUrl="/api/events/empty" />);
    
    // Wait for events to load
    await waitFor(() => {
      expect(screen.queryByText('Loading events...')).toBeNull();
    });
    
    // Should show no events message
    expect(screen.getByText('No events found')).toBeInTheDocument();
  });
  
  it('handles fetch errors gracefully', async () => {
    // Mock fetch error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (fetchEventData as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    render(<EventsList eventsUrl="/api/events/error" />);
    
    // Wait for events to load (or fail)
    await waitFor(() => {
      expect(screen.queryByText('Loading events...')).toBeNull();
    });
    
    // Should show no events message
    expect(screen.getByText('No events found')).toBeInTheDocument();
    
    // Error should be logged
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
}); 