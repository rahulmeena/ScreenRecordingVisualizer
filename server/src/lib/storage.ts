import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream } from 'fs';
import { unlink, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createGunzip } from 'zlib';
import { extract } from 'tar';
import { exec } from 'child_process';
import { promisify } from 'util';

// Define AWS S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

// Define bucket name
const BUCKET_NAME = process.env.S3_BUCKET || 'screen-recordings';

// Use local storage if S3 is not configured
const USE_LOCAL_STORAGE = !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY;
const LOCAL_STORAGE_DIR = join(process.cwd(), 'storage');

// Recording data cache
const recordingCache = new Map<string, any>();

/**
 * Get a recording's metadata and information
 */
export async function getRecordingData(id: string) {
  // Check cache first
  if (recordingCache.has(id)) {
    return recordingCache.get(id);
  }
  
  let data;
  
  if (USE_LOCAL_STORAGE) {
    // Get from local storage
    const metadataPath = join(LOCAL_STORAGE_DIR, id, 'metadata.json');
    
    if (existsSync(metadataPath)) {
      const metadataStr = await readFile(metadataPath, 'utf-8');
      data = JSON.parse(metadataStr);
    }
  } else {
    // Get from S3
    try {
      // Implementation for S3 retrieval would go here
      // For simplicity, we're just using local storage in this example
    } catch (error) {
      console.error(`Error getting recording data from S3: ${error}`);
      return null;
    }
  }
  
  // Add URLs for assets
  if (data) {
    data.urls = {
      video: `/storage/${id}/video.mp4`,
      events: `/storage/${id}/events.json`,
      thumbnails: `/storage/${id}/thumbnails`,
    };
    
    // Cache the data
    recordingCache.set(id, data);
  }
  
  return data;
}

/**
 * Save a recording's processed data
 */
export async function saveRecordingData(
  id: string,
  video: Buffer,
  events: any,
  thumbnails: Buffer[]
) {
  if (USE_LOCAL_STORAGE) {
    // Save to local storage
    const storageDir = join(LOCAL_STORAGE_DIR, id);
    
    // Ensure directory exists
    if (!existsSync(storageDir)) {
      await promisify(exec)(`mkdir -p ${storageDir}`);
    }
    
    // Write video file
    await writeFile(join(storageDir, 'video.mp4'), video);
    
    // Write events file
    await writeFile(join(storageDir, 'events.json'), JSON.stringify(events));
    
    // Write thumbnails
    const thumbsDir = join(storageDir, 'thumbnails');
    if (!existsSync(thumbsDir)) {
      await promisify(exec)(`mkdir -p ${thumbsDir}`);
    }
    
    for (let i = 0; i < thumbnails.length; i++) {
      await writeFile(join(thumbsDir, `thumb_${i}.png`), thumbnails[i]);
    }
    
    // Write metadata
    const metadata = {
      id,
      timestamp: Date.now(),
      thumbnailCount: thumbnails.length,
      events: {
        count: events.events.length,
      },
    };
    
    await writeFile(join(storageDir, 'metadata.json'), JSON.stringify(metadata));
    
    // Update cache
    recordingCache.set(id, {
      ...metadata,
      urls: {
        video: `/storage/${id}/video.mp4`,
        events: `/storage/${id}/events.json`,
        thumbnails: `/storage/${id}/thumbnails`,
      },
    });
    
    return true;
  } else {
    // Save to S3
    // Implementation for S3 storage would go here
    // For simplicity, we're just using local storage in this example
    return false;
  }
} 