import { fetchEventData, formatTimestamp, formatDuration } from '../../src/lib/client';

// Mock the global fetch API
global.fetch = jest.fn();

describe('Client Utilities', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchEventData', () => {
    it('should fetch and return data successfully', async () => {
      const mockData = { events: [{ t: 1000, kind: 'mouse_down' }] };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockData),
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await fetchEventData('/api/events/123');
      
      expect(global.fetch).toHaveBeenCalledWith('/api/events/123');
      expect(mockResponse.json).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should handle fetch errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await fetchEventData('/api/events/999');
      
      expect(global.fetch).toHaveBeenCalledWith('/api/events/999');
      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toBeNull();
      
      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await fetchEventData('/api/events/123');
      
      expect(global.fetch).toHaveBeenCalledWith('/api/events/123');
      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toBeNull();
      
      consoleSpy.mockRestore();
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp correctly', () => {
      // Create a fixed date for consistent testing
      const date = new Date('2023-01-01T12:34:56.789Z');
      const timestamp = date.getTime();
      
      // Mock Date.toLocaleTimeString
      const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
      Date.prototype.toLocaleTimeString = jest.fn().mockReturnValue('12:34:56');
      
      const result = formatTimestamp(timestamp);
      
      expect(result).toBe('12:34:56');
      
      // Restore original method
      Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly with zero values', () => {
      const result = formatDuration(0);
      expect(result).toBe('00:00.000');
    });

    it('should format duration correctly with seconds', () => {
      const result = formatDuration(5500); // 5.5 seconds
      expect(result).toBe('00:05.500');
    });

    it('should format duration correctly with minutes and seconds', () => {
      const result = formatDuration(65750); // 1 minute, 5.75 seconds
      expect(result).toBe('01:05.750');
    });

    it('should format duration correctly with large values', () => {
      const result = formatDuration(3725500); // 1 hour, 2 minutes, 5.5 seconds (in ms)
      expect(result).toBe('62:05.500');
    });
  });
}); 