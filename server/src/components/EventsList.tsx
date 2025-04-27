'use client';

import { useState, useEffect } from 'react';
import { fetchEventData } from '@/lib/client';

interface EventsListProps {
  eventsUrl: string;
}

export default function EventsList({ eventsUrl }: EventsListProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  // Fetch events data
  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const data = await fetchEventData(eventsUrl);
        if (data && data.events) {
          setEvents(data.events);
        }
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadEvents();
  }, [eventsUrl]);
  
  // Filter events based on selected type
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    if (filter === 'mouse' && (
      event.kind === 'mouse_down' || 
      event.kind === 'mouse_up' || 
      event.kind === 'drag_end'
    )) return true;
    if (filter === 'keyboard' && (
      event.kind === 'key_down' || 
      event.kind === 'key_up'
    )) return true;
    if (filter === 'scroll' && event.kind === 'scroll') return true;
    return false;
  });
  
  // Format event time (from ms to readable format)
  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };
  
  // Get display text for an event
  const getEventText = (event: any) => {
    switch (event.kind) {
      case 'mouse_down':
        return `${event.button} click at (${event.x}, ${event.y})`;
      case 'mouse_up':
        return `${event.button} release at (${event.x}, ${event.y})`;
      case 'key_down':
        return `Key press: ${event.key}`;
      case 'key_up':
        return `Key release: ${event.key}`;
      case 'drag_end':
        return `Drag from (${event.start_x}, ${event.start_y}) to (${event.end_x}, ${event.end_y})`;
      case 'scroll':
        return `Scroll ${event.dy > 0 ? 'down' : 'up'} at (${event.x}, ${event.y})`;
      default:
        return event.kind;
    }
  };
  
  // Get icon/color class for an event
  const getEventClass = (event: any) => {
    switch (event.kind) {
      case 'mouse_down':
      case 'mouse_up':
        return 'bg-red-900/30 border-red-700/50 text-red-200';
      case 'key_down':
      case 'key_up':
        return 'bg-blue-900/30 border-blue-700/50 text-blue-200';
      case 'drag_end':
        return 'bg-green-900/30 border-green-700/50 text-green-200';
      case 'scroll':
        return 'bg-purple-900/30 border-purple-700/50 text-purple-200';
      default:
        return 'bg-gray-800 border-gray-700 text-gray-300';
    }
  };
  
  if (loading) {
    return <div className="p-4 text-center text-gray-300">Loading events...</div>;
  }
  
  if (events.length === 0) {
    return <div className="p-4 text-center text-gray-300">No events found</div>;
  }
  
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'all' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-300 hover:bg-dark-100'
          }`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'mouse' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-300 hover:bg-dark-100'
          }`}
          onClick={() => setFilter('mouse')}
        >
          Mouse
        </button>
        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'keyboard' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-300 hover:bg-dark-100'
          }`}
          onClick={() => setFilter('keyboard')}
        >
          Keyboard
        </button>
        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            filter === 'scroll' ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-300 hover:bg-dark-100'
          }`}
          onClick={() => setFilter('scroll')}
        >
          Scroll
        </button>
      </div>
      
      <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-dark-200">
        {filteredEvents.map((event, index) => (
          <div 
            key={index}
            className={`mb-2 p-2 border rounded text-sm ${getEventClass(event)}`}
          >
            <div className="font-medium">{formatTime(event.t)}</div>
            <div>{getEventText(event)}</div>
          </div>
        ))}
      </div>
    </div>
  );
} 