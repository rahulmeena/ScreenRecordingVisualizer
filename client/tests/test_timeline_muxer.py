import os
import time
import json
import pytest
import tempfile
import zipfile
from unittest.mock import patch, MagicMock, mock_open

# Add parent directory to path
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.timeline_muxer import TimelineMuxer

class TestTimelineMuxer:
    @pytest.fixture
    def timeline_muxer(self):
        """Create a TimelineMuxer instance for testing"""
        # Setup mocks
        with patch('os.makedirs'):
            tm = TimelineMuxer()
            yield tm
            
            # Clean up
            if tm.running:
                tm.stop()
    
    def test_initialization(self, timeline_muxer):
        """Test initialization of TimelineMuxer"""
        assert timeline_muxer.running is False
        assert timeline_muxer.recording_id is None
        assert timeline_muxer.recording_dir is None
        assert timeline_muxer.video_file is None
        assert timeline_muxer.events_file is None
    
    def test_start_muxer(self, timeline_muxer):
        """Test starting the timeline muxer"""
        with patch('os.makedirs'):
            timeline_muxer.start()
            
            assert timeline_muxer.running is True
            assert timeline_muxer.recording_id is not None
            assert timeline_muxer.recording_id.startswith("recording_")
            assert timeline_muxer.recording_dir is not None
    
    def test_stop_muxer(self, timeline_muxer):
        """Test stopping the timeline muxer"""
        with patch('os.makedirs'):
            # First start the muxer
            timeline_muxer.start()
            assert timeline_muxer.running is True
            
            # Stop the muxer
            timeline_muxer.stop()
            
            assert timeline_muxer.running is False
    
    def test_set_files(self, timeline_muxer):
        """Test setting video and events files"""
        # Set video file
        video_path = "/path/to/video.mp4"
        timeline_muxer.set_video_file(video_path)
        assert timeline_muxer.video_file == video_path
        
        # Set events file
        events_path = "/path/to/events.json"
        timeline_muxer.set_events_file(events_path)
        assert timeline_muxer.events_file == events_path
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('json.dump')
    @patch('shutil.copy2')
    @patch('zipfile.ZipFile')
    @patch('os.walk')
    @patch('os.path.exists', return_value=True)
    def test_finalize(self, mock_exists, mock_walk, mock_zipfile, mock_copy, mock_json_dump, mock_file, timeline_muxer):
        """Test finalizing the timeline"""
        # Setup mocks
        mock_walk.return_value = [
            ('/recording_dir', [], ['metadata.json', 'events.json', 'video.mp4'])
        ]
        mock_zipfile.return_value.__enter__.return_value = MagicMock()
        
        # Setup the muxer
        timeline_muxer.start()
        timeline_muxer.video_file = "/path/to/video.mp4"
        timeline_muxer.events_file = "/path/to/events.json"
        
        # Create mock events json content
        events_json = {
            "events": [
                {"t": 1000000000, "kind": "mouse_down"},
                {"t": 2000000000, "kind": "mouse_up"}
            ]
        }
        
        # Mock the file reading for the events file
        with patch('builtins.open', mock_open(read_data=json.dumps(events_json))):
            with patch.object(timeline_muxer, '_calculate_duration', return_value=10.0):
                with patch.object(timeline_muxer, '_normalize_events', return_value={"events": []}):
                    # Test finalizing
                    zip_path = timeline_muxer.finalize()
                    
                    # Verify results
                    assert zip_path is not None
                    assert timeline_muxer.running is False
                    assert mock_json_dump.call_count >= 1  # At least one call to write metadata
                    assert mock_copy.called  # Video file should be copied
                    assert mock_zipfile.called  # Zip file should be created
    
    def test_calculate_duration(self, timeline_muxer):
        """Test duration calculation from events"""
        # Mock events file with timestamps
        events_json = {
            "events": [
                {"t": 1000000000, "kind": "mouse_down"},  # 1 second in ns
                {"t": 3000000000, "kind": "mouse_up"}     # 3 seconds in ns
            ]
        }
        
        timeline_muxer.events_file = "events.json"
        
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=json.dumps(events_json))):
                duration = timeline_muxer._calculate_duration()
                
                # Duration should be 2 seconds (3s - 1s)
                assert duration == 2.0
    
    def test_normalize_events(self, timeline_muxer):
        """Test event normalization"""
        # Mock events file with timestamps
        events_json = {
            "events": [
                {"t": 1000000000, "kind": "mouse_down"},  # 1 second in ns
                {"t": 3000000000, "kind": "mouse_up"}     # 3 seconds in ns
            ]
        }
        
        timeline_muxer.events_file = "events.json"
        
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=json.dumps(events_json))):
                normalized = timeline_muxer._normalize_events()
                
                # Verify normalization
                assert "meta" in normalized
                assert "events" in normalized
                assert len(normalized["events"]) == 2
                
                # First event should be at t=0 (normalized)
                assert normalized["events"][0]["t"] == 0
                
                # Second event should be at t=2000 (2 seconds in milliseconds)
                assert normalized["events"][1]["t"] == 2000 