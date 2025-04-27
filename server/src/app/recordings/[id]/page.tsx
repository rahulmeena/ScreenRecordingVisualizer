import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import RecordingPlayer from '@/components/RecordingPlayer';
import { getRecordingData } from '@/lib/storage';

// Generate metadata for the page
export async function generateMetadata({ params }: { params: { id: string } }) {
  const id = params.id;
  
  const recordingData = await getRecordingData(id);
  if (!recordingData) {
    return {
      title: 'Recording Not Found',
    };
  }
  
  return {
    title: `Recording ${id}`,
    description: `Screen recording session from ${new Date(recordingData.timestamp).toLocaleString()}`,
  };
}

export default async function RecordingPage({ params }: { params: { id: string } }) {
  const id = params.id;
  
  const recordingData = await getRecordingData(id);
  
  if (!recordingData) {
    notFound();
  }
  
  return (
    <div className="w-full max-w-screen-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-white">Recording {id}</h2>
      
      <div className="bg-dark-100 shadow-lg rounded-lg p-4 mb-6 border border-primary-700/20 text-gray-300">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="bg-primary-900/30 px-3 py-1 rounded-md">
            <span className="font-medium text-white">Recorded:</span>{' '}
            {new Date(recordingData.timestamp).toLocaleString()}
          </div>
          <div className="bg-primary-900/30 px-3 py-1 rounded-md">
            <span className="font-medium text-white">Machine:</span> {recordingData.machine || 'Unknown'}
          </div>
          <div className="bg-primary-900/30 px-3 py-1 rounded-md">
            <span className="font-medium text-white">OS:</span> {recordingData.os || 'Unknown'}
          </div>
          <div className="bg-primary-900/30 px-3 py-1 rounded-md">
            <span className="font-medium text-white">Events:</span>{' '}
            {recordingData.events?.count || 0}
          </div>
        </div>
      </div>
      
      <Suspense fallback={<div className="text-gray-300">Loading player...</div>}>
        <RecordingPlayer
          videoUrl={recordingData.urls.video}
          eventsUrl={recordingData.urls.events}
          id={id}
        />
      </Suspense>
    </div>
  );
} 