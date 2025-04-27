import { ProcessJobData as SimpleProcessJobData, enqueueProcessJob as simpleEnqueueProcessJob, getJobStatus as simpleGetJobStatus, cleanupJobs as simpleCleanupJobs } from './queue.simplified';

// Force simplified implementation
const useFallbackImplementation = true;
console.log('Using simplified queue implementation (no Redis required)');

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
  return simpleEnqueueProcessJob(data as SimpleProcessJobData);
}

/**
 * Clean up old jobs
 */
export async function cleanupJobs() {
  return simpleCleanupJobs();
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  return simpleGetJobStatus(jobId);
} 