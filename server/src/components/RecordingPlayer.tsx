'use client';

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { fetchEventData } from '@/lib/client';
import ActionOverlay from './ActionOverlay';
import EventsList from './EventsList';

interface RecordingPlayerProps {
  videoUrl: string;
  eventsUrl: string;
  id: string;
  showSidePanel?: boolean;
}

// Legend component to show outside the player
const EventLegend = () => {
  return (
    <div className="flex items-center bg-dark-200 px-3 py-1 rounded-lg gap-3">
      <span className="text-xs font-semibold text-gray-300">Legend:</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
          <span className="text-xs text-gray-300">Left Click</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-orange-400/60"></div>
          <span className="text-xs text-gray-300">Right Click</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
          <span className="text-xs text-gray-300">Drag</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500/60"></div>
          <span className="text-xs text-gray-300">Scroll</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="px-1 bg-black/80 text-white text-xs rounded">A</div>
          <span className="text-xs text-gray-300">Key</span>
        </div>
      </div>
    </div>
  );
};

export default function RecordingPlayer({ videoUrl, eventsUrl, id, showSidePanel = true }: RecordingPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [sourceResolution, setSourceResolution] = useState<[number, number]>([2560, 1440]);
  const [loading, setLoading] = useState(true);
  const playerRef = useRef<ReactPlayer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [debugMode, setDebugMode] = useState(false);
  
  // Fetch events data
  useEffect(() => {
    async function loadEventData() {
      try {
        setLoading(true);
        const data = await fetchEventData(eventsUrl);
        if (data) {
          if (data.meta && data.meta.resolution && Array.isArray(data.meta.resolution)) {
            setSourceResolution([data.meta.resolution[0], data.meta.resolution[1]]);
          }
          if (data.events) {
            setEvents(data.events);
          }
        }
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadEventData();
  }, [eventsUrl]);
  
  // Handle player progress updates
  const handleProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds);
  };
  
  const handleDuration = (duration: number) => {
    setDuration(duration);
  };
  
  // Filter events that are visible at the current time
  const visibleEvents = events.filter(event => {
    // Convert from ms to seconds for comparison with video playback time
    const eventTimeSeconds = event.t / 1000;
    // Events are visible if they happened within 1 second of the current time
    return eventTimeSeconds <= currentTime && eventTimeSeconds > currentTime - 1;
  });
  
  // Handle seeking to a specific time when clicking on an event
  const handleSeek = (timeInSeconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(timeInSeconds);
      // If video was paused, start playing from the new position
      if (!playing) {
        setPlaying(true);
      }
    }
  };
  
  return (
    <div className="flex flex-col md:flex-row gap-4 overflow-visible">
      <div className={showSidePanel ? "md:w-2/3" : "w-full"}>
        <div className="bg-dark-100 shadow-lg rounded-lg p-4 border border-primary-700/20">
          <div className="relative" ref={containerRef}>
            <ReactPlayer
              ref={playerRef}
              url={videoUrl}
              width="100%"
              height="auto"
              style={{ aspectRatio: '16/9' }}
              playing={playing}
              controls={false}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onProgress={handleProgress}
              onDuration={handleDuration}
              progressInterval={100}
              config={{
                file: {
                  attributes: {
                    controlsList: 'nodownload',
                  },
                },
              }}
            />
            
            <ActionOverlay
              events={visibleEvents}
              containerRef={containerRef}
              currentTime={currentTime}
              sourceResolution={sourceResolution}
              debugMode={debugMode}
            />
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <div>
                {new Date(currentTime * 1000).toISOString().substr(11, 8)}
              </div>
              <div>
                {new Date(duration * 1000).toISOString().substr(11, 8)}
              </div>
            </div>
            
            <div className="h-4 bg-dark-200 rounded overflow-hidden">
              <div
                className="h-full bg-primary-600"
                style={{
                  width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                }}
              ></div>
            </div>
            
            <div className="mt-4 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 bg-primary-700 text-white rounded hover:bg-primary-600 transition-colors"
                  onClick={() => {
                    if (playerRef.current) {
                      playerRef.current.seekTo(Math.max(0, currentTime - 5));
                    }
                  }}
                >
                  -5s
                </button>
                
                <button
                  className="px-3 py-1 bg-primary-700 text-white rounded hover:bg-primary-600 transition-colors"
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? 'Pause' : 'Play'}
                </button>
                
                <button
                  className="px-3 py-1 bg-primary-700 text-white rounded hover:bg-primary-600 transition-colors"
                  onClick={() => {
                    if (playerRef.current) {
                      playerRef.current.seekTo(Math.min(duration, currentTime + 5));
                    }
                  }}
                >
                  +5s
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  className={`px-2 py-1 text-white text-xs rounded transition-colors ${debugMode ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                  onClick={() => setDebugMode(!debugMode)}
                >
                  {debugMode ? 'Hide Debug' : 'Show Debug'}
                </button>
                
                <EventLegend />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showSidePanel && (
        <div className="md:w-1/3 bg-dark-100 shadow-lg rounded-lg p-4 border border-primary-700/20 overflow-hidden" style={{ height: '600px' }}>
          <EventsList 
            eventsUrl={eventsUrl} 
            currentTime={currentTime}
            onSeek={handleSeek}
          />
        </div>
      )}
    </div>
  );
} 