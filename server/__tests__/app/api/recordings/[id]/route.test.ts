import { GET } from '../../../../../src/app/api/recordings/[id]/route';
import { getRecordingData } from '../../../../../src/lib/storage';
import { NextRequest } from 'next/server';

// Mock the storage module
jest.mock('../../../../../src/lib/storage', () => ({
  getRecordingData: jest.fn(),
}));

describe('GET /api/recordings/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('returns the recording data when found', async () => {
    // Mock recording data
    const mockData = {
      id: 'test-123',
      timestamp: Date.now(),
      urls: {
        video: '/storage/test-123/video.mp4',
        events: '/storage/test-123/events.json',
      }
    };
    
    // Setup mocks
    (getRecordingData as jest.Mock).mockResolvedValue(mockData);
    
    // Create request with parameters
    const req = new NextRequest('http://localhost:3000/api/recordings/test-123');
    const params = { id: 'test-123' };
    
    // Call the endpoint
    const response = await GET(req, { params });
    const data = await response.json();
    
    // Verify response
    expect(response.status).toBe(200);
    expect(data).toEqual(mockData);
    expect(getRecordingData).toHaveBeenCalledWith('test-123');
  });
  
  it('returns 404 when recording is not found', async () => {
    // Setup mocks - recording not found
    (getRecordingData as jest.Mock).mockResolvedValue(null);
    
    // Create request with parameters
    const req = new NextRequest('http://localhost:3000/api/recordings/not-found');
    const params = { id: 'not-found' };
    
    // Call the endpoint
    const response = await GET(req, { params });
    const data = await response.json();
    
    // Verify response
    expect(response.status).toBe(404);
    expect(data).toHaveProperty('error');
    expect(getRecordingData).toHaveBeenCalledWith('not-found');
  });
  
  it('returns 400 when id parameter is missing', async () => {
    // Create request with empty parameters
    const req = new NextRequest('http://localhost:3000/api/recordings/');
    const params = { id: '' };
    
    // Call the endpoint
    const response = await GET(req, { params });
    const data = await response.json();
    
    // Verify response
    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(getRecordingData).not.toHaveBeenCalled();
  });
  
  it('returns 500 when an error occurs', async () => {
    // Setup mocks - error thrown
    (getRecordingData as jest.Mock).mockRejectedValue(new Error('Database error'));
    
    // Spy on console.error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Create request with parameters
    const req = new NextRequest('http://localhost:3000/api/recordings/error');
    const params = { id: 'error' };
    
    // Call the endpoint
    const response = await GET(req, { params });
    const data = await response.json();
    
    // Verify response
    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
    expect(consoleSpy).toHaveBeenCalled();
    
    // Restore console.error
    consoleSpy.mockRestore();
  });
}); 