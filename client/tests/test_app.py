import os
import pytest
from unittest.mock import patch, MagicMock

# Add parent directory to path
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.app import RecorderApp

class TestRecorderApp:
    @pytest.fixture
    def app(self):
        """Create a RecorderApp instance for testing"""
        # Patch the components and the pystray module
        with patch('src.app.ScreenCapture') as mock_screen_capture, \
             patch('src.app.InputLogger') as mock_input_logger, \
             patch('src.app.TimelineMuxer') as mock_timeline_muxer, \
             patch('src.app.Uploader') as mock_uploader, \
             patch('src.app.pystray.Icon') as mock_icon, \
             patch('src.app.pystray.Menu') as mock_menu, \
             patch('src.app.pystray.MenuItem') as mock_menu_item, \
             patch('src.app.ImageDraw') as mock_image_draw, \
             patch('src.app.Image') as mock_image:
            
            # Setup mocks
            mock_screen_capture.return_value = MagicMock()
            mock_input_logger.return_value = MagicMock()
            mock_timeline_muxer.return_value = MagicMock()
            mock_uploader.return_value = MagicMock()
            mock_icon.return_value = MagicMock()
            
            # Create the app
            app = RecorderApp()
            
            # Verify initialization
            assert app.is_recording is False
            assert app.recorder_thread is None
            assert app.loop is None
            assert mock_screen_capture.called
            assert mock_input_logger.called
            assert mock_timeline_muxer.called
            assert mock_uploader.called
            assert mock_icon.called
            
            yield app
    
    def test_create_icon_image(self, app):
        """Test creating the icon image"""
        with patch('src.app.Image.new') as mock_new, \
             patch('src.app.ImageDraw.Draw') as mock_draw:
            
            # Setup mocks
            mock_image = MagicMock()
            mock_new.return_value = mock_image
            mock_draw_obj = MagicMock()
            mock_draw.return_value = mock_draw_obj
            
            # Call the method
            result = app.create_icon_image()
            
            # Verify results
            assert mock_new.called
            assert mock_draw.called
            assert mock_draw_obj.ellipse.called
            assert result == mock_image
    
    def test_update_menu_state(self, app):
        """Test updating menu state"""
        # Setup mocks
        app.start_item = MagicMock()
        app.stop_item = MagicMock()
        app.icon = MagicMock()
        
        # Test recording state
        app.is_recording = True
        app.update_menu_state()
        assert app.start_item.enabled is False
        assert app.stop_item.enabled is True
        assert app.icon.update_menu.called
        
        # Test not recording state
        app.is_recording = False
        app.update_menu_state()
        assert app.start_item.enabled is True
        assert app.stop_item.enabled is False
    
    @patch('src.app.threading.Thread')
    def test_start_recording(self, mock_thread, app):
        """Test starting recording"""
        # Mock update_menu_state
        app.update_menu_state = MagicMock()
        
        # Call the method
        app.start_recording()
        
        # Verify results
        assert app.is_recording is True
        assert app.update_menu_state.called
        assert mock_thread.called
        assert mock_thread.return_value.start.called
        assert app.recorder_thread == mock_thread.return_value
    
    def test_stop_recording(self, app):
        """Test stopping recording"""
        # Setup mocks
        app.update_menu_state = MagicMock()
        app.loop = MagicMock()
        app.recorder_thread = MagicMock()
        app.screen_capture = MagicMock()
        app.input_logger = MagicMock()
        app.timeline_muxer = MagicMock()
        app.uploader = MagicMock()
        
        app.timeline_muxer.finalize.return_value = "recording.zip"
        
        # Set recording state
        app.is_recording = True
        
        # Call the method
        app.stop_recording()
        
        # Verify results
        assert app.is_recording is False
        assert app.update_menu_state.called
        assert app.loop.call_soon_threadsafe.called
        assert app.recorder_thread.join.called
        assert app.screen_capture.stop.called
        assert app.input_logger.stop.called
        assert app.timeline_muxer.finalize.called
        assert app.uploader.upload_recording.called
        assert app.uploader.upload_recording.call_args[0][0] == "recording.zip"
    
    def test_exit_app(self, app):
        """Test exiting the app"""
        # Setup mocks
        app.stop_recording = MagicMock()
        app.icon = MagicMock()
        
        # Test exiting while recording
        app.is_recording = True
        app.exit_app()
        assert app.stop_recording.called
        assert app.icon.stop.called
        
        # Reset mocks
        app.stop_recording.reset_mock()
        app.icon.stop.reset_mock()
        
        # Test exiting while not recording
        app.is_recording = False
        app.exit_app()
        assert not app.stop_recording.called
        assert app.icon.stop.called 