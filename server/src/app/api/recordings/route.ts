import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import formidable from 'formidable';
import { createReadStream, writeFileSync } from 'fs';
import { enqueueProcessJob } from '@/lib/queue';

// This config is not needed in App Router and should be removed
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

export async function POST(req: NextRequest) {
  try {
    // Generate a unique ID for this recording
    const id = randomUUID();
    
    // Create directory for the recording
    const uploadDir = join(process.cwd(), 'uploads', id);
    await mkdir(uploadDir, { recursive: true });
    
    // Get content type - check if it's a direct binary upload or multipart
    const contentType = req.headers.get('content-type') || '';
    let meta = {};
    
    try {
      const metaHeader = req.headers.get('x-recording-meta');
      if (metaHeader) {
        meta = JSON.parse(metaHeader);
      }
    } catch (e) {
      console.error('Error parsing metadata header:', e);
    }
    
    // Get the original filename from headers if provided
    const originalFilename = req.headers.get('x-original-filename') || 'recording.zip';
    const filePath = join(uploadDir, originalFilename);
    
    // Handle binary data properly depending on content type
    if (contentType.includes('application/zip')) {
      // Direct binary upload - get as arrayBuffer and write without transformation
      const data = await req.arrayBuffer();
      
      // Write directly to file without Buffer transformation to preserve binary integrity
      writeFileSync(filePath, new Uint8Array(data));
      console.log(`Direct binary upload saved to ${filePath}, size: ${data.byteLength} bytes`);
    } else {
      // Multipart form or other format - use standard processing
      const data = await req.arrayBuffer();
      const buffer = Buffer.from(data);
      await writeFile(filePath, buffer);
      console.log(`Multipart form upload saved to ${filePath}, size: ${buffer.length} bytes`);
    }
    
    // Create metadata structure
    const fields = {
      'meta': JSON.stringify({
        ...meta,
        timestamp: Date.now(),
        id,
      })
    };
    
    // Enqueue processing job
    try {
      await enqueueProcessJob({
        id,
        filePath: filePath,
        meta: typeof fields.meta === 'string' ? JSON.parse(fields.meta) : fields.meta,
      });
      console.log(`Successfully enqueued processing job for recording ${id}`);
    } catch (processingError) {
      console.error(`Failed to enqueue processing job: ${processingError}`);
      // Continue even if enqueueing fails - we've still saved the file
    }
    
    // Return success response
    return NextResponse.json({
      ok: true,
      id,
      message: 'Recording uploaded successfully',
    });
  } catch (error) {
    console.error('Error handling upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 