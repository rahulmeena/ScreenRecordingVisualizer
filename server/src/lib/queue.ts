import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

// Connect to Redis
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

// Create queue
const processingQueue = new Queue('recording-processing', { connection });

// Define job types
export interface ProcessJobData {
  id: string;
  filePath: string;
  meta: any;
}

/**
 * Enqueue a job to process a recording
 */
export async function enqueueProcessJob(data: ProcessJobData) {
  return processingQueue.add('process', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds
    },
  });
}

/**
 * Clean up old jobs
 */
export async function cleanupJobs() {
  await processingQueue.clean(86400000, 100, 'completed'); // Clean completed jobs older than 1 day
  await processingQueue.clean(86400000, 100, 'failed'); // Clean failed jobs older than 1 day
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  const job = await processingQueue.getJob(jobId);
  
  if (!job) {
    return null;
  }
  
  return {
    id: job.id,
    status: await job.getState(),
    progress: job.progress,
    data: job.data,
    result: job.returnvalue,
    error: job.failedReason,
  };
} 