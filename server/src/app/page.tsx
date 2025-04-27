'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import RecordingPlayer from '@/components/RecordingPlayer';

interface Recording {
  id: string;
  timestamp: number;
  machine?: string;
  os?: string;
  events?: {
    count: number;
  };
  urls: {
    video: string;
    events: string;
  };
}

export default function Home() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  
  // Fetch recordings data
  useEffect(() => {
    async function fetchRecordings() {
      try {
        setLoading(true);
        const response = await fetch('/api/recordings');
        if (!response.ok) {
          throw new Error('Failed to fetch recordings');
        }
        const data = await response.json();
        
        // Filter out any invalid recordings (missing id or other required properties)
        const validRecordings = data.filter(recording => 
          recording && recording.id && recording.timestamp && recording.urls
        );
        
        setRecordings(validRecordings);
        
        // Set the first recording as selected by default if available
        if (validRecordings.length > 0) {
          setSelectedRecording(validRecordings[0]);
        }
      } catch (error) {
        console.error('Error fetching recordings:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchRecordings();
  }, []);
  
  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold mb-6 text-white">Screen Recording Visualizer</h2>
      
      {!selectedRecording && !loading && recordings.length === 0 && (
        <div className="bg-dark-100 shadow-lg rounded-lg p-6 mb-8 border border-primary-700/20">
          <h3 className="text-xl font-semibold mb-4 text-white">About This Tool</h3>
          <p className="mb-4 text-gray-300 max-w-4xl">
            This tool allows you to visualize screen recordings along with synchronized mouse 
            and keyboard actions. The recordings are captured using the Windows desktop application
            and uploaded to this server for analysis.
          </p>
          
          <h4 className="text-lg font-medium mt-6 mb-2 text-white">Features:</h4>
          <ul className="list-disc pl-6 mb-4 text-gray-300 max-w-4xl">
            <li>High-quality video playback at native screen resolution</li>
            <li>Synchronized timeline of all user interactions</li>
            <li>Visual overlays showing mouse clicks, drags, and keyboard input</li>
            <li>Filterable event list for easy navigation</li>
          </ul>
          
          <p className="mt-4 text-gray-300">
            To get started, download and install the Windows desktop application.
            After recording sessions, they will appear here for visualization.
          </p>
          <div className="mt-4">
            <Link 
              href="/guide" 
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 inline-block transition duration-150"
            >
              View Setup Guide
            </Link>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-10 text-gray-300">
          <div className="animate-pulse">Loading recordings...</div>
        </div>
      ) : recordings.length > 0 && (
        <>
          {selectedRecording && (
            <div className="bg-dark-100 shadow-lg rounded-lg p-4 mb-6 border border-primary-700/20 text-gray-300">
              <h3 className="text-xl font-semibold mb-3 text-white">Recording {selectedRecording.id}</h3>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="bg-primary-900/30 px-3 py-1 rounded-md">
                  <span className="font-medium text-white">Recorded:</span>{' '}
                  {new Date(selectedRecording.timestamp).toLocaleString()}
                </div>
                <div className="bg-primary-900/30 px-3 py-1 rounded-md">
                  <span className="font-medium text-white">Machine:</span> {selectedRecording.machine || 'Unknown'}
                </div>
                <div className="bg-primary-900/30 px-3 py-1 rounded-md">
                  <span className="font-medium text-white">OS:</span> {selectedRecording.os || 'Unknown'}
                </div>
                <div className="bg-primary-900/30 px-3 py-1 rounded-md">
                  <span className="font-medium text-white">Events:</span>{' '}
                  {selectedRecording.events?.count || 0}
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left column - Recordings List */}
            <div className="lg:col-span-3">
              <div className="bg-dark-100 shadow-lg rounded-lg p-4 border border-primary-700/20 overflow-hidden" style={{ height: '600px' }}>
                <h3 className="text-lg font-medium mb-3 text-white">Available Recordings</h3>
                <ul className="divide-y divide-gray-800 h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-dark-200" style={{ overscrollBehavior: 'contain' }}>
                  {recordings.map(recording => (
                    <li 
                      key={recording?.id || 'unknown'} 
                      className={`py-3 cursor-pointer ${selectedRecording?.id === recording?.id ? 'bg-primary-900/30 -mx-2 px-2 rounded' : ''}`}
                      onClick={() => setSelectedRecording(recording)}
                    >
                      <div className="font-medium mb-1 text-gray-200">
                        {new Date(recording?.timestamp || Date.now()).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">
                        ID: {recording?.id ? recording.id.substring(0, 8) : 'Unknown'}...
                      </div>
                      <div className="text-sm text-gray-400">
                        Machine: {recording?.machine || 'Unknown'}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Right column - Video Player with integrated Events Timeline */}
            <div className="lg:col-span-9">
              {selectedRecording ? (
                <RecordingPlayer
                  videoUrl={selectedRecording.urls.video}
                  eventsUrl={selectedRecording.urls.events}
                  id={selectedRecording.id}
                />
              ) : (
                <div className="bg-dark-100 shadow-lg rounded-lg p-6 border border-primary-700/20 text-gray-300 h-full flex items-center justify-center">
                  <p>Select a recording to view</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 