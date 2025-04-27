import os
import time
import json
import queue
import pytest
import tempfile
from unittest.mock import patch, MagicMock, mock_open

# Add parent directory to path
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.uploader import Uploader

class TestUploader:
    @pytest.fixture
    def uploader(self):
        """Create an Uploader instance for testing"""
        # Patch threading and queue methods
        with patch('threading.Thread') as mock_thread, \
             patch('os.makedirs') as mock_makedirs, \
             patch.object(Uploader, '_load_queued_recordings') as mock_load:
            
            # Return the Uploader instance
            uploader = Uploader(server_url="http://test-server/api/recordings")
            
            # Verify initialization
            assert uploader.server_url == "http://test-server/api/recordings"
            assert mock_thread.called  # Should start upload thread
            assert mock_load.called  # Should load queued recordings
            
            yield uploader
    
    def test_upload_recording_valid(self, uploader):
        """Test uploading a valid recording"""
        # Create a temp file to use as a recording
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp_file:
            tmp_path = tmp_file.name
            
            # Mock file operations
            with patch('os.path.exists', return_value=True), \
                 patch('builtins.open', mock_open()), \
                 patch.object(uploader.upload_queue, 'put') as mock_put:
                
                # Upload the recording
                result = uploader.upload_recording(tmp_path)
                
                # Verify results
                assert result is True
                assert mock_put.called
                
                # Check what was put in the queue
                record = mock_put.call_args[0][0]
                assert record['path'] == tmp_path
                assert 'timestamp' in record
                assert 'machine' in record
                assert 'os' in record
                assert record['retries'] == 0
            
            # Clean up
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    def test_upload_recording_invalid(self, uploader):
        """Test uploading an invalid recording"""
        # Mock file operations with non-existent file
        with patch('os.path.exists', return_value=False):
            # Upload the recording
            result = uploader.upload_recording("/non/existent/path.zip")
            
            # Verify results
            assert result is False
    
    @patch('requests.post')
    def test_do_upload_success(self, mock_post, uploader):
        """Test successful upload to server"""
        # Mock a successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ok": True, "id": "test123"}
        mock_post.return_value = mock_response
        
        # Create temp file
        with tempfile.NamedTemporaryFile(suffix='.zip') as tmp_file:
            # Prepare test metadata
            metadata = {
                'path': tmp_file.name,
                'timestamp': time.time(),
                'machine': 'test-machine',
                'os': 'test-os'
            }
            
            # Test the upload
            result = uploader._do_upload(tmp_file.name, metadata)
            
            # Verify results
            assert result is True
            assert mock_post.called
            
            # Check the upload arguments
            args, kwargs = mock_post.call_args
            assert args[0] == uploader.server_url
            assert 'files' in kwargs
            assert 'timeout' in kwargs
    
    @patch('requests.post')
    def test_do_upload_failure(self, mock_post, uploader):
        """Test failed upload to server"""
        # Mock a failed response
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Server error"
        mock_post.return_value = mock_response
        
        # Create temp file
        with tempfile.NamedTemporaryFile(suffix='.zip') as tmp_file:
            # Prepare test metadata
            metadata = {
                'path': tmp_file.name,
                'timestamp': time.time()
            }
            
            # Test the upload
            result = uploader._do_upload(tmp_file.name, metadata)
            
            # Verify results
            assert result is False
    
    @patch('requests.post')
    def test_do_upload_exception(self, mock_post, uploader):
        """Test exception during upload"""
        # Mock an exception
        mock_post.side_effect = Exception("Network error")
        
        # Create temp file
        with tempfile.NamedTemporaryFile(suffix='.zip') as tmp_file:
            # Prepare test metadata
            metadata = {
                'path': tmp_file.name,
                'timestamp': time.time()
            }
            
            # Test the upload
            result = uploader._do_upload(tmp_file.name, metadata)
            
            # Verify results
            assert result is False
    
    def test_load_queued_recordings(self, uploader):
        """Test loading previously queued recordings"""
        # Create mock queue files
        queue_files = [
            {'path': '/path/to/recording1.zip', 'timestamp': time.time(), 'retries': 0},
            {'path': '/path/to/recording2.zip', 'timestamp': time.time(), 'retries': 1}
        ]
        
        # Mock file operations
        with patch('os.listdir', return_value=['queue_1.json', 'queue_2.json']), \
             patch('os.path.exists', return_value=True), \
             patch('builtins.open', side_effect=[
                 mock_open(read_data=json.dumps(queue_files[0])).return_value,
                 mock_open(read_data=json.dumps(queue_files[1])).return_value
             ]), \
             patch.object(uploader.upload_queue, 'put') as mock_put:
            
            # Call the method
            uploader._load_queued_recordings()
            
            # Verify results - both files should be queued
            assert mock_put.call_count == 2
            
            # Check the queued items
            for i, call in enumerate(mock_put.call_args_list):
                record = call[0][0]
                assert record['path'] == queue_files[i]['path']
                assert record['timestamp'] == queue_files[i]['timestamp'] 