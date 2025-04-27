import os
import time
import pytest
from unittest.mock import patch, MagicMock, mock_open
import threading
import tempfile

# Add parent directory to path
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.screen_capture import ScreenCapture

class TestScreenCapture:
    @pytest.fixture
    def screen_capture(self):
        """Create a ScreenCapture instance for testing"""
        with patch('src.screen_capture.mss') as mock_mss:
            # Setup the mock
            mock_sct = MagicMock()
            mock_mss.return_value.__enter__.return_value = mock_sct
            
            # Return the ScreenCapture instance
            sc = ScreenCapture(resolution=(1280, 800), fps=10)
            yield sc
            
            # Ensure it's stopped after the test
            if sc.running:
                sc.stop()
    
    def test_initialization(self, screen_capture):
        """Test initialization of ScreenCapture"""
        assert screen_capture.resolution == (1280, 800)
        assert screen_capture.fps == 10
        assert screen_capture.frame_interval == 0.1  # 1.0 / 10
        assert screen_capture.running is False
        assert screen_capture.output_file is None
    
    @patch('src.screen_capture.threading.Thread')
    def test_start_capture(self, mock_thread, screen_capture):
        """Test starting the capture process"""
        screen_capture.start()
        
        assert screen_capture.running is True
        assert screen_capture.output_file is not None
        assert mock_thread.call_count == 2  # Two threads created
        assert mock_thread.return_value.start.call_count == 2  # Both threads started
    
    @patch('src.screen_capture.threading.Thread')
    def test_stop_capture(self, mock_thread, screen_capture):
        """Test stopping the capture process"""
        # First start the capture
        screen_capture.start()
        assert screen_capture.running is True
        
        # Create mock threads
        screen_capture.capture_thread = MagicMock()
        screen_capture.encoder_thread = MagicMock()
        screen_capture.ffmpeg_process = MagicMock()
        screen_capture.ffmpeg_process.stdin = MagicMock()
        
        # Stop the capture
        output_file = screen_capture.stop()
        
        # Verify the state
        assert screen_capture.running is False
        assert screen_capture.capture_thread.join.called
        assert screen_capture.encoder_thread.join.called
        assert screen_capture.ffmpeg_process.stdin.close.called
        assert screen_capture.ffmpeg_process.wait.called
        assert output_file == screen_capture.output_file
    
    @patch('src.screen_capture.subprocess.Popen')
    @patch('src.screen_capture.ScreenCapture._has_nvidia', return_value=False)
    @patch('src.screen_capture.ScreenCapture._has_intel_qsv', return_value=False)
    def test_encoder_worker(self, mock_qsv, mock_nvidia, mock_popen, screen_capture):
        """Test the encoder worker"""
        # Setup mocks
        mock_process = MagicMock()
        mock_process.stdin = MagicMock()
        mock_popen.return_value = mock_process
        
        # Start the encoder
        screen_capture.running = True
        screen_capture.output_file = tempfile.mktemp(suffix='.mp4')
        
        # Call the encoder worker directly
        encoder_thread = threading.Thread(target=screen_capture._encoder_worker)
        encoder_thread.daemon = True
        encoder_thread.start()
        
        # Give it time to start up
        time.sleep(0.1)
        
        # Stop the encoder
        screen_capture.running = False
        encoder_thread.join(timeout=1.0)
        
        # Verify the process was created
        assert mock_popen.called
        # Check if libx264 was used (since both NVIDIA and Intel QSV are mocked as False)
        cmd_args = mock_popen.call_args[0][0]
        assert 'libx264' in cmd_args
    
    @patch('src.screen_capture.subprocess.run')
    def test_hardware_detection(self, mock_run, screen_capture):
        """Test hardware acceleration detection"""
        # Mock NVIDIA detection
        mock_result = MagicMock()
        mock_result.stdout = "h264_nvenc"
        mock_run.return_value = mock_result
        
        assert screen_capture._has_nvidia() is True
        
        # Mock Intel QSV detection
        mock_result.stdout = "h264_qsv"
        assert screen_capture._has_intel_qsv() is True
        
        # Mock failure
        mock_run.side_effect = Exception("Command failed")
        assert screen_capture._has_nvidia() is False
        assert screen_capture._has_intel_qsv() is False 