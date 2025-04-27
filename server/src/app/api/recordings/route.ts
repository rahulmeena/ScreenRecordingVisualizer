import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import * as formidable from 'formidable';
import { createReadStream } from 'fs';
import { enqueueProcessJob } from '@/lib/queue';

// Disable Next.js body parsing for this route
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  try {
    // Generate a unique ID for this recording
    const id = randomUUID();
    
    // Create directory for the recording
    const uploadDir = join(process.cwd(), 'uploads', id);
    await mkdir(uploadDir, { recursive: true });
    
    // Parse form data
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
    }) as any;
    
    // Get form fields and files
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      const fields: formidable.Fields = {};
      const files: formidable.Files = {};
      
      // Read the request
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const filePath = join(uploadDir, 'upload.zip');
          await writeFile(filePath, buffer);
          
          // Extract metadata if present
          let metadata = {};
          try {
            const metaHeader = req.headers.get('x-recording-meta');
            if (metaHeader) {
              metadata = JSON.parse(metaHeader);
            }
          } catch (e) {
            console.error('Error parsing metadata header:', e);
          }
          
          // Add file to files object
          files['file'] = {
            filepath: filePath,
            originalFilename: 'upload.zip',
            newFilename: 'upload.zip',
            mimetype: 'application/zip',
            size: buffer.length,
          } as any;
          
          // Add metadata to fields
          fields['meta'] = JSON.stringify({
            ...metadata,
            timestamp: Date.now(),
            id,
          });
          
          resolve([fields, files]);
        } catch (error) {
          reject(error);
        }
      });
      
      req.on('error', (error) => {
        reject(error);
      });
    });
    
    // Get the uploaded file
    const file = files['file'] as formidable.File;
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    // Get metadata
    const meta = fields['meta'] ? JSON.parse(fields['meta'] as string) : {};
    
    // Enqueue processing job
    await enqueueProcessJob({
      id,
      filePath: file.filepath,
      meta,
    });
    
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