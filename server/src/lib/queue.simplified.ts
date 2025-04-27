/**
 * Simplified queue implementation that doesn't require Redis
 * This is a fallback for when the full BullMQ implementation isn't available
 * Uses asynchronous processing with setTimeout and file-based job persistence
 */

import { join } from 'path';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, createReadStream, createWriteStream } from 'fs';
import { unlink, mkdir, readFile, writeFile } from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createUnzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';
import { saveRecordingData } from './storage';

// Try to import adm-zip if available
let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch (error) {
  console.log('[Simplified Queue] adm-zip not found, will use alternative extraction methods');
}

const execAsync = promisify(exec);

// Path constants
const UPLOADS_DIR = join(process.cwd(), 'uploads');
const STORAGE_DIR = join(process.cwd(), 'storage');
const JOBS_DIR = join(process.cwd(), 'jobs');

// Create required directories
if (!existsSync(STORAGE_DIR)) {
  mkdirSync(STORAGE_DIR, { recursive: true });
}

if (!existsSync(JOBS_DIR)) {
  mkdirSync(JOBS_DIR, { recursive: true });
}

// In-memory job queue and processing state
const jobQueue = [];
const activeJobs = new Map();
const completedJobs = new Map();
let isProcessing = false;

export interface ProcessJobData {
  id: string;
  filePath: string;
  meta: any;
}

interface JobRecord {
  id: string;
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: ProcessJobData;
  result?: any;
  error?: string;
  timestamp: number;
  completedAt?: number;
}

/**
 * Load jobs from disk at startup
 */
async function loadJobsFromDisk() {
  try {
    if (!existsSync(JOBS_DIR)) {
      return;
    }
    
    // Read job files from disk
    const files = await readFile(join(JOBS_DIR, 'jobs.json'), 'utf-8').catch(() => '[]');
    const jobs = JSON.parse(files);
    
    // Restore completed jobs
    for (const job of jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        completedJobs.set(job.jobId, job);
      } else if (job.status === 'pending') {
        // Re-queue pending jobs
        jobQueue.push(job);
      }
    }
    
    console.log(`[Simplified Queue] Loaded ${jobQueue.length} pending jobs and ${completedJobs.size} completed jobs`);
  } catch (error) {
    console.error('[Simplified Queue] Error loading jobs from disk:', error);
  }
}

// Load jobs at startup
loadJobsFromDisk();

/**
 * Save jobs to disk
 */
async function saveJobsToDisk() {
  try {
    const allJobs = [
      ...jobQueue,
      ...Array.from(activeJobs.values()),
      ...Array.from(completedJobs.values()).slice(-100) // Keep last 100 completed jobs
    ];
    
    await writeFile(
      join(JOBS_DIR, 'jobs.json'),
      JSON.stringify(allJobs, null, 2)
    );
  } catch (error) {
    console.error('[Simplified Queue] Error saving jobs to disk:', error);
  }
}

/**
 * Process the next job in the queue
 */
async function processNextJob() {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  const job = jobQueue.shift();
  
  // Update job status
  job.status = 'processing';
  activeJobs.set(job.jobId, job);
  
  // Save state
  await saveJobsToDisk();
  
  console.log(`[Simplified Queue] Processing job ${job.jobId} for recording ${job.data.id}`);
  
  try {
    // Process the job
    await processRecording(job);
    
    // Update job status
    job.status = 'completed';
    job.completedAt = Date.now();
    job.result = { processed: true, timestamp: Date.now() };
    
    // Move to completed jobs
    completedJobs.set(job.jobId, job);
    activeJobs.delete(job.jobId);
    
    console.log(`[Simplified Queue] Successfully completed job ${job.jobId}`);
  } catch (error) {
    console.error(`[Simplified Queue] Error processing job ${job.jobId}:`, error);
    
    // Update job status
    job.status = 'failed';
    job.completedAt = Date.now();
    job.error = error.message || String(error);
    
    // Move to completed jobs
    completedJobs.set(job.jobId, job);
    activeJobs.delete(job.jobId);
  }
  
  // Save state
  await saveJobsToDisk();
  
  // Process next job
  isProcessing = false;
  setTimeout(processNextJob, 100);
}

/**
 * Extract zip file using system unzip, 7zip, or adm-zip
 */
async function extractZipFile(zipPath: string, targetDir: string): Promise<void> {
  // Create target directory if it doesn't exist
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }

  try {
    // First, try using system unzip command (available on most platforms)
    try {
      await execAsync(`unzip -o "${zipPath}" -d "${targetDir}"`);
      console.log(`[Simplified Queue] Extracted using system unzip: ${zipPath}`);
      return;
    } catch (error) {
      console.log(`[Simplified Queue] System unzip failed, trying alternative methods: ${error.message}`);
    }

    // Next, try using 7zip if available (Windows common)
    try {
      await execAsync(`7z x "${zipPath}" -o"${targetDir}" -y`);
      console.log(`[Simplified Queue] Extracted using 7zip: ${zipPath}`);
      return;
    } catch (error) {
      console.log(`[Simplified Queue] 7zip extraction failed, trying adm-zip: ${error.message}`);
    }
    
    // Try using adm-zip if available
    if (AdmZip) {
      try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(targetDir, true);
        console.log(`[Simplified Queue] Extracted using adm-zip: ${zipPath}`);
        return;
      } catch (error) {
        console.log(`[Simplified Queue] adm-zip extraction failed: ${error.message}`);
      }
    }

    // As a last resort, manually copy the zip file (useful for single-file recordings)
    console.log(`[Simplified Queue] No extraction method worked, copying file directly`);
    const filename = zipPath.split(/[\\/]/).pop();
    copyFileSync(zipPath, join(targetDir, filename));
  } catch (error) {
    throw new Error(`Failed to extract zip file: ${error.message}`);
  }
}

/**
 * Process a recording by extracting the uploaded zip file and saving the data
 */
async function processRecording(job: JobRecord) {
  const { id, filePath, meta } = job.data;
  
  try {
    // Ensure the file exists
    if (!existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    // Get the original filename and file extension
    const originalFilename = filePath.split(/[\\/]/).pop();
    const fileExt = originalFilename.split('.').pop().toLowerCase();
    
    // Create extraction directory
    const extractDir = join(UPLOADS_DIR, id, 'extracted');
    if (!existsSync(extractDir)) {
      await mkdir(extractDir, { recursive: true });
    }
    
    // Create storage directory
    const recordingDir = join(STORAGE_DIR, id);
    if (!existsSync(recordingDir)) {
      await mkdir(recordingDir, { recursive: true });
    }
    
    let videoPath = '';
    
    // If this is already a video file, copy it directly
    if (['mp4', 'mov', 'webm'].includes(fileExt)) {
      console.log(`[Simplified Queue] Direct video file detected: ${filePath}`);
      videoPath = filePath;
    } else {
      // Otherwise try to extract as a zip file
      console.log(`[Simplified Queue] Extracting ${filePath} to ${extractDir}`);
      await extractZipFile(filePath, extractDir);
      
      // Look for video file with multiple possible names
      const videoFileNames = ['video.mp4', 'screen.mp4', 'recording.mp4', 'capture.mp4'];
      for (const name of videoFileNames) {
        const testPath = join(extractDir, name);
        if (existsSync(testPath)) {
          videoPath = testPath;
          break;
        }
      }
    }
    
    if (!videoPath) {
      // List all files in the extracted directory to help debugging
      try {
        const isWindows = process.platform === 'win32';
        const command = isWindows
          ? `dir "${extractDir}" /b`
          : `ls -la "${extractDir}"`;
        const { stdout } = await execAsync(command);
        console.log(`[Simplified Queue] Files found in extraction directory: ${stdout}`);
      } catch (error) {
        console.log(`[Simplified Queue] Error listing files: ${error.message}`);
      }
      throw new Error('Video file not found in the uploaded package');
    }
    
    // Look for events file with multiple possible names
    let eventsPath = '';
    const eventsFileNames = ['events.json', 'input.json', 'actions.json'];
    for (const name of eventsFileNames) {
      const testPath = join(extractDir, name);
      if (existsSync(testPath)) {
        eventsPath = testPath;
        break;
      }
    }
    
    // If no events file is found, create an empty one
    if (!eventsPath) {
      console.log(`[Simplified Queue] Events file not found, creating empty events`);
      const emptyEvents = { events: [] };
      const emptyEventsPath = join(extractDir, 'events.json');
      await writeFile(emptyEventsPath, JSON.stringify(emptyEvents));
      eventsPath = emptyEventsPath;
    }
    
    // Read events data
    let eventsData;
    try {
      eventsData = JSON.parse(await readFile(eventsPath, 'utf-8'));
    } catch (error) {
      console.log(`[Simplified Queue] Error parsing events file: ${error.message}, creating empty events`);
      eventsData = { events: [] };
    }
    
    // Make sure events has the expected structure
    if (!eventsData.events) {
      eventsData.events = [];
    }
    
    // Copy video file to storage
    copyFileSync(videoPath, join(recordingDir, 'video.mp4'));
    
    // Copy events file to storage
    await writeFile(
      join(recordingDir, 'events.json'),
      JSON.stringify(eventsData, null, 2)
    );
    
    // Create thumbnails directory
    const thumbnailsDir = join(recordingDir, 'thumbnails');
    if (!existsSync(thumbnailsDir)) {
      await mkdir(thumbnailsDir, { recursive: true });
    }
    
    // Create metadata file
    const metadata = {
      id,
      timestamp: Date.now(),
      uploadTimestamp: meta.timestamp || Date.now(),
      machine: meta.machine || 'unknown',
      os: meta.os || 'unknown',
      thumbnailCount: 0,
      events: {
        count: eventsData.events?.length || 0,
      },
    };
    
    // Save metadata
    await writeFile(
      join(recordingDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Clean up extracted files
    try {
      await unlink(filePath);
    } catch (error) {
      console.error(`[Simplified Queue] Error deleting zip file: ${error.message}`);
    }
    
    console.log(`[Simplified Queue] Successfully processed recording ${id}`);
    return { success: true };
  } catch (error) {
    console.error(`[Simplified Queue] Error processing recording: ${error.message}`);
    throw error;
  }
}

/**
 * Enqueue a job to process a recording
 * This version is truly asynchronous
 */
export async function enqueueProcessJob(data: ProcessJobData) {
  console.log(`[Simplified Queue] Enqueueing job for recording ${data.id}`);
  
  // Create a job record
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const job: JobRecord = {
    id: data.id,
    jobId,
    status: 'pending',
    data,
    timestamp: Date.now()
  };
  
  // Add to queue
  jobQueue.push(job);
  
  // Save job state
  await saveJobsToDisk();
  
  // Start processing if not already running
  setTimeout(processNextJob, 100);
  
  // Return job reference
  return { id: data.id, jobId };
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  // Check active jobs
  if (activeJobs.has(jobId)) {
    return activeJobs.get(jobId);
  }
  
  // Check completed jobs
  if (completedJobs.has(jobId)) {
    return completedJobs.get(jobId);
  }
  
  // Check pending jobs
  const pendingJob = jobQueue.find(job => job.jobId === jobId);
  if (pendingJob) {
    return pendingJob;
  }
  
  return null;
}

/**
 * Clean up old jobs
 */
export async function cleanupJobs() {
  // Keep only the last 100 completed jobs
  const completedJobsArray = Array.from(completedJobs.entries());
  if (completedJobsArray.length > 100) {
    const jobsToRemove = completedJobsArray.slice(0, completedJobsArray.length - 100);
    for (const [jobId] of jobsToRemove) {
      completedJobs.delete(jobId);
    }
    
    // Save updated state
    await saveJobsToDisk();
  }
  
  return true;
}
