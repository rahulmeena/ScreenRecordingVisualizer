import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import RecordingPlayer from '@/components/RecordingPlayer';
import EventsList from '@/components/EventsList';
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
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Recording {id}</h2>
      
      <div className="bg-white shadow-md rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="font-medium">Recorded:</span>{' '}
            {new Date(recordingData.timestamp).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Machine:</span> {recordingData.machine || 'Unknown'}
          </div>
          <div>
            <span className="font-medium">OS:</span> {recordingData.os || 'Unknown'}
          </div>
          <div>
            <span className="font-medium">Events:</span>{' '}
            {recordingData.events?.count || 0}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<div>Loading player...</div>}>
            <RecordingPlayer
              videoUrl={recordingData.urls.video}
              eventsUrl={recordingData.urls.events}
              id={id}
            />
          </Suspense>
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-3">Events Timeline</h3>
          <div className="bg-white shadow-md rounded-lg p-4">
            <Suspense fallback={<div>Loading events...</div>}>
              <EventsList eventsUrl={recordingData.urls.events} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
} 