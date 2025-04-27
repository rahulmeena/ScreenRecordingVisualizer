'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchEventData } from '@/lib/client';

interface EventsListProps {
  eventsUrl: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

export default function EventsList({ eventsUrl, currentTime = 0, onSeek }: EventsListProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const timelineRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  
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
  const getEventClass = (event: any, isActive: boolean = false) => {
    let baseClass = '';
    
    switch (event.kind) {
      case 'mouse_down':
      case 'mouse_up':
        baseClass = 'bg-red-900/30 border-red-700/50 text-red-200';
        break;
      case 'key_down':
      case 'key_up':
        baseClass = 'bg-blue-900/30 border-blue-700/50 text-blue-200';
        break;
      case 'drag_end':
        baseClass = 'bg-green-900/30 border-green-700/50 text-green-200';
        break;
      case 'scroll':
        baseClass = 'bg-purple-900/30 border-purple-700/50 text-purple-200';
        break;
      default:
        baseClass = 'bg-gray-800 border-gray-700 text-gray-300';
    }
    
    return isActive 
      ? `${baseClass} border-l-4 shadow-lg ring-1 ring-white/20` 
      : baseClass;
  };
  
  // Check if an event is active at current playback time
  const isEventActive = (event: any) => {
    if (!currentTime) return false;
    
    const eventTimeSeconds = event.t / 1000;
    // Events are considered active if they occurred within 0.5 seconds of current time
    return Math.abs(eventTimeSeconds - currentTime) < 0.5;
  };
  
  // Auto-scroll timeline to keep current events visible
  useEffect(() => {
    if (!autoScroll || !timelineRef.current || !currentTime) return;
    
    const activeEventIndex = filteredEvents.findIndex(event => isEventActive(event));
    if (activeEventIndex >= 0) {
      const eventElements = timelineRef.current.querySelectorAll('.event-item');
      if (eventElements[activeEventIndex]) {
        eventElements[activeEventIndex].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, [currentTime, filteredEvents, autoScroll]);
  
  // Handle click on an event to seek video
  const handleEventClick = (event: any) => {
    if (onSeek) {
      onSeek(event.t / 1000);
    }
  };
  
  if (loading) {
    return <div className="p-4 text-center text-gray-300">Loading events...</div>;
  }
  
  if (events.length === 0) {
    return <div className="p-4 text-center text-gray-300">No events found</div>;
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
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
        
        <button
          className={`px-2 py-1 text-xs rounded transition-colors ${
            autoScroll ? 'bg-primary-600 text-white' : 'bg-dark-200 text-gray-300 hover:bg-dark-100'
          }`}
          onClick={() => setAutoScroll(!autoScroll)}
          title={autoScroll ? "Auto-scroll is on" : "Auto-scroll is off"}
        >
          {autoScroll ? "Auto" : "Manual"}
        </button>
      </div>
      
      <h3 className="text-sm font-medium text-gray-300 mb-2">Events Timeline</h3>
      
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-700 z-0"></div>
        
        <div 
          ref={timelineRef}
          className="max-h-full h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-dark-200 relative z-10"
          style={{ overscrollBehavior: 'contain' }}
        >
          {filteredEvents.map((event, index) => {
            const active = isEventActive(event);
            return (
              <div 
                key={index}
                className={`event-item mb-2 p-2 border rounded text-sm cursor-pointer transition-all duration-200 hover:brightness-125 ${getEventClass(event, active)}`}
                onClick={() => handleEventClick(event)}
                style={{
                  marginLeft: '12px',
                  transform: active ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <div className="absolute w-3 h-3 bg-gray-600 rounded-full -left-1.5 top-1/2 transform -translate-y-1/2"></div>
                <div className="font-medium">{formatTime(event.t)}</div>
                <div>{getEventText(event)}</div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="mt-2 text-xs text-gray-400 italic">
        Click any event to jump to that point in the video
      </div>
    </div>
  );
} 