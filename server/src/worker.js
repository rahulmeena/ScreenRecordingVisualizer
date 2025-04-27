const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const sharp = require('sharp');
const extract = require('extract-zip');

// Connect to Redis
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

// Path constants
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const STORAGE_DIR = path.join(process.cwd(), 'storage');

// Create storage directory if it doesn't exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Create worker
const worker = new Worker('recording-processing', async job => {
  console.log(`Processing job ${job.id} for recording ${job.data.id}`);
  job.updateProgress(0);
  
  try {
    const { id, filePath, meta } = job.data;
    
    // Extract the zip file
    const extractDir = path.join(UPLOADS_DIR, id, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    
    console.log(`Extracting ${filePath} to ${extractDir}`);
    await extract(filePath, { dir: extractDir });
    job.updateProgress(10);
    
    // Read the video file
    const videoPath = path.join(extractDir, 'video.mp4');
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found in the uploaded package');
    }
    
    // Read the events file
    const eventsPath = path.join(extractDir, 'events.json');
    if (!fs.existsSync(eventsPath)) {
      throw new Error('Events file not found in the uploaded package');
    }
    
    const eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
    job.updateProgress(20);
    
    // Generate thumbnails
    const thumbnails = await generateThumbnails(videoPath);
    job.updateProgress(60);
    
    // Create storage directory
    const recordingDir = path.join(STORAGE_DIR, id);
    fs.mkdirSync(recordingDir, { recursive: true });
    
    // Copy video file
    fs.copyFileSync(videoPath, path.join(recordingDir, 'video.mp4'));
    
    // Save events file
    fs.writeFileSync(path.join(recordingDir, 'events.json'), JSON.stringify(eventsData));
    
    // Save thumbnails
    const thumbnailsDir = path.join(recordingDir, 'thumbnails');
    fs.mkdirSync(thumbnailsDir, { recursive: true });
    
    for (let i = 0; i < thumbnails.length; i++) {
      fs.writeFileSync(path.join(thumbnailsDir, `thumb_${i}.png`), thumbnails[i]);
    }
    
    // Create metadata
    const metadata = {
      id,
      timestamp: Date.now(),
      uploadTimestamp: meta.timestamp || Date.now(),
      machine: meta.machine || 'unknown',
      os: meta.os || 'unknown',
      thumbnailCount: thumbnails.length,
      events: {
        count: eventsData.events.length,
      },
    };
    
    // Save metadata
    fs.writeFileSync(
      path.join(recordingDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    job.updateProgress(100);
    
    // Clean up extracted files
    try {
      fs.rmSync(path.join(UPLOADS_DIR, id), { recursive: true, force: true });
    } catch (error) {
      console.error(`Error cleaning up: ${error}`);
    }
    
    console.log(`Completed processing recording ${id}`);
    return { id, success: true };
  } catch (error) {
    console.error(`Error processing recording: ${error}`);
    throw error;
  }
}, { connection });

/**
 * Generate thumbnails from a video file using FFmpeg
 */
async function generateThumbnails(videoPath) {
  try {
    // Get video duration
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    
    const duration = parseFloat(stdout.trim());
    
    // Generate thumbnails at regular intervals (one per 5 seconds)
    const numThumbnails = Math.min(12, Math.max(1, Math.floor(duration / 5)));
    const thumbnails = [];
    
    for (let i = 0; i < numThumbnails; i++) {
      const timeOffset = (i / (numThumbnails - 1 || 1)) * duration;
      const tempFile = path.join(path.dirname(videoPath), `thumb_${i}_temp.png`);
      
      // Extract frame using FFmpeg
      await execAsync(
        `ffmpeg -y -ss ${timeOffset} -i "${videoPath}" -vframes 1 -q:v 2 "${tempFile}"`
      );
      
      // Resize and optimize the thumbnail
      const thumbnailBuffer = await sharp(tempFile)
        .resize(320, 200, { fit: 'inside' })
        .png({ quality: 90 })
        .toBuffer();
      
      thumbnails.push(thumbnailBuffer);
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
    }
    
    return thumbnails;
  } catch (error) {
    console.error(`Error generating thumbnails: ${error}`);
    return [];
  }
}

console.log('Worker started, waiting for jobs...');

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
}); 