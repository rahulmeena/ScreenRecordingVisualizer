import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getRecordingData } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Recording ID is required' },
        { status: 400 }
      );
    }
    
    // Get recording data from database or storage
    const recordingData = await getRecordingData(id);
    
    if (!recordingData) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }
    
    // Return recording data
    return NextResponse.json(recordingData);
  } catch (error) {
    console.error('Error getting recording:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 