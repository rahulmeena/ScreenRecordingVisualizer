'use client';

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { fetchEventData } from '@/lib/client';
import ActionOverlay from './ActionOverlay';

interface RecordingPlayerProps {
  videoUrl: string;
  eventsUrl: string;
  id: string;
}

export default function RecordingPlayer({ videoUrl, eventsUrl, id }: RecordingPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const playerRef = useRef<ReactPlayer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fetch events data
  useEffect(() => {
    async function loadEventData() {
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
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <div className="relative" ref={containerRef}>
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          width="100%"
          height="auto"
          playing={playing}
          controls={true}
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
        />
      </div>
      
      <div className="mt-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <div>
            {new Date(currentTime * 1000).toISOString().substr(11, 8)}
          </div>
          <div>
            {new Date(duration * 1000).toISOString().substr(11, 8)}
          </div>
        </div>
        
        <div className="h-4 bg-gray-200 rounded overflow-hidden">
          <div
            className="h-full bg-primary-500"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
            }}
          ></div>
        </div>
        
        <div className="mt-4 flex gap-4">
          <button
            className="px-3 py-1 bg-primary-500 text-white rounded"
            onClick={() => {
              if (playerRef.current) {
                playerRef.current.seekTo(Math.max(0, currentTime - 5));
              }
            }}
          >
            -5s
          </button>
          
          <button
            className="px-3 py-1 bg-primary-500 text-white rounded"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          
          <button
            className="px-3 py-1 bg-primary-500 text-white rounded"
            onClick={() => {
              if (playerRef.current) {
                playerRef.current.seekTo(Math.min(duration, currentTime + 5));
              }
            }}
          >
            +5s
          </button>
        </div>
      </div>
    </div>
  );
} 