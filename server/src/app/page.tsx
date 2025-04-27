import Link from 'next/link';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getRecordingData } from '@/lib/storage';

async function getRecentRecordings() {
  try {
    // Get the storage directory path
    const storageDir = join(process.cwd(), 'storage');
    
    // Check if storage directory exists
    if (!existsSync(storageDir)) {
      return [];
    }
    
    // Get all recording directories
    const recordingIds = readdirSync(storageDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Get metadata for each recording
    const recordings = await Promise.all(
      recordingIds.map(async id => {
        const data = await getRecordingData(id);
        return data;
      })
    );
    
    // Filter out any null values and sort by timestamp (newest first)
    return recordings
      .filter(recording => recording !== null)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10); // Only show the 10 most recent
  } catch (error) {
    console.error('Error getting recordings:', error);
    return [];
  }
}

export default async function Home() {
  const recentRecordings = await getRecentRecordings();
  
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Welcome to Screen Recording Visualizer</h2>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">About This Tool</h3>
        <p className="mb-4">
          This tool allows you to visualize screen recordings along with synchronized mouse 
          and keyboard actions. The recordings are captured using the Windows desktop application
          and uploaded to this server for analysis.
        </p>
        
        <h4 className="text-lg font-medium mt-6 mb-2">Features:</h4>
        <ul className="list-disc pl-6 mb-4">
          <li>High-quality video playback at 1280x800 resolution</li>
          <li>Synchronized timeline of all user interactions</li>
          <li>Visual overlays showing mouse clicks, drags, and keyboard input</li>
          <li>Filterable event list for easy navigation</li>
        </ul>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Recent Recordings</h3>
          
          {recentRecordings.length > 0 ? (
            <ul className="divide-y">
              {recentRecordings.map(recording => (
                <li key={recording.id} className="py-3">
                  <Link 
                    href={`/recordings/${recording.id}`}
                    className="block hover:bg-gray-50 -m-2 p-2 rounded"
                  >
                    <div className="font-medium mb-1">
                      {new Date(recording.timestamp).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {recording.id.substring(0, 8)}...
                    </div>
                    <div className="text-sm text-gray-500">
                      Machine: {recording.machine || 'Unknown'}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-gray-500 italic">No recordings available yet.</p>
              <p className="mt-4">
                To create recordings, use the Windows desktop application.
              </p>
            </>
          )}
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Getting Started</h3>
          <p className="mb-4">
            To get started, download and install the Windows desktop application.
            After recording sessions, they will appear here for visualization.
          </p>
          <div className="mt-4">
            <Link 
              href="/guide" 
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 inline-block"
            >
              View Setup Guide
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 