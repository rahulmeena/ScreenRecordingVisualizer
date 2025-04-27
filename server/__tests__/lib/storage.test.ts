import { getRecordingData, saveRecordingData } from '../../src/lib/storage';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Mock filesystem functions
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn(),
  dirname: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => jest.fn().mockResolvedValue({})),
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock process.cwd() to return a consistent path for testing
const mockCwd = '/mock/cwd';
jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);

describe('Storage Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecordingData', () => {
    it('should return data from cache if available', async () => {
      // Setup a mocked recording in the cache
      const mockRecord = {
        id: 'test-123',
        timestamp: Date.now(),
        events: { count: 10 },
      };
      
      // Access the private cache using any type
      const recordingCache = (getRecordingData as any).constructor.recordingCache || new Map();
      recordingCache.set('test-123', mockRecord);
      
      const result = await getRecordingData('test-123');
      
      // Expect cache hit
      expect(result).toEqual(mockRecord);
      expect(fs.promises.readFile).not.toHaveBeenCalled();
    });

    it('should read data from local storage when not in cache', async () => {
      const mockMetadata = {
        id: 'test-456',
        timestamp: Date.now(),
        events: { count: 5 },
      };
      
      // Mock file existence and content
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockMetadata));
      
      const result = await getRecordingData('test-456');
      
      // Expect the file to be read
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.promises.readFile).toHaveBeenCalled();
      
      // Expect URL properties to be added
      expect(result).toHaveProperty('urls');
      expect(result.urls).toHaveProperty('video');
      expect(result.urls).toHaveProperty('events');
      expect(result.urls).toHaveProperty('thumbnails');
      
      // Expect the data to match the mock with URLs added
      expect(result).toEqual({
        ...mockMetadata,
        urls: {
          video: `/storage/test-456/video.mp4`,
          events: `/storage/test-456/events.json`,
          thumbnails: `/storage/test-456/thumbnails`,
        },
      });
    });

    it('should return null when data not found', async () => {
      // Mock file not existing
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const result = await getRecordingData('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('saveRecordingData', () => {
    it('should save data to local storage', async () => {
      // Setup test data
      const id = 'test-save-123';
      const video = Buffer.from('mock video data');
      const events = {
        meta: { fps: 10 },
        events: [{ t: 1000, kind: 'mouse_down' }],
      };
      const thumbnails = [Buffer.from('thumbnail 1'), Buffer.from('thumbnail 2')];
      
      // Mock file existence check to trigger directory creation
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(false);
      
      // Call the function
      const result = await saveRecordingData(id, video, events, thumbnails);
      
      // Expect successful save
      expect(result).toBe(true);
      
      // Verify directory creation
      expect(promisify).toHaveBeenCalled();
      
      // Verify file writes
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(thumbnails.length + 2); // thumbnails + metadata + events
      
      // Check if metadata is written correctly
      const metadataCall = (fs.promises.writeFile as jest.Mock).mock.calls.find(
        call => call[0].endsWith('metadata.json')
      );
      
      expect(metadataCall).toBeTruthy();
      const metadataJson = JSON.parse(metadataCall[1]);
      expect(metadataJson).toHaveProperty('id', id);
      expect(metadataJson).toHaveProperty('thumbnailCount', thumbnails.length);
    });
  });
}); 