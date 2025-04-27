declare module '@/lib/client' {
  export function fetchEventData(url: string): Promise<any>;
  export function formatTimestamp(timestamp: number): string;
  export function formatDuration(ms: number): string;
}

declare module '@/lib/storage' {
  export function getRecordingData(id: string): Promise<any>;
  export function saveRecordingData(
    id: string, 
    video: Buffer, 
    events: any, 
    thumbnails: Buffer[]
  ): Promise<boolean>;
}

declare module '@/lib/queue' {
  export interface ProcessJobData {
    id: string;
    filePath: string;
    meta: any;
  }
  
  export function enqueueProcessJob(data: ProcessJobData): Promise<any>;
  export function cleanupJobs(): Promise<void>;
  export function getJobStatus(jobId: string): Promise<any>;
}

declare module '@/components/RecordingPlayer' {
  interface RecordingPlayerProps {
    videoUrl: string;
    eventsUrl: string;
    id: string;
  }
  
  export default function RecordingPlayer(props: RecordingPlayerProps): JSX.Element;
}

declare module '@/components/EventsList' {
  interface EventsListProps {
    eventsUrl: string;
  }
  
  export default function EventsList(props: EventsListProps): JSX.Element;
}

declare module '@/components/ActionOverlay' {
  interface ActionOverlayProps {
    events: any[];
    containerRef: React.RefObject<HTMLDivElement>;
    currentTime: number;
  }
  
  export default function ActionOverlay(props: ActionOverlayProps): JSX.Element;
} 