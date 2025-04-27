import os
import time
import json
import pytest
from unittest.mock import patch, MagicMock, mock_open
import tempfile

# Add parent directory to path
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.input_logger import InputLogger

class TestInputLogger:
    @pytest.fixture
    def input_logger(self):
        """Create an InputLogger instance for testing"""
        with patch('src.input_logger.mouse.Listener') as mock_mouse_listener, \
             patch('src.input_logger.keyboard.Listener') as mock_keyboard_listener:
            
            # Setup mocks
            mock_mouse_listener.return_value = MagicMock()
            mock_keyboard_listener.return_value = MagicMock()
            
            # Return the InputLogger instance
            il = InputLogger()
            yield il
            
            # Ensure it's stopped after the test
            if il.running:
                il.stop()
    
    def test_initialization(self, input_logger):
        """Test initialization of InputLogger"""
        assert input_logger.running is False
        assert isinstance(input_logger.events, list)
        assert input_logger.mouse_listener is None
        assert input_logger.keyboard_listener is None
        assert input_logger.output_file is None
    
    def test_start_logging(self, input_logger):
        """Test starting the input logging"""
        with patch('builtins.open', mock_open()) as mock_file:
            input_logger.start()
            
            assert input_logger.running is True
            assert input_logger.output_file is not None
            assert input_logger.mouse_listener.start.called
            assert input_logger.keyboard_listener.start.called
            assert len(input_logger.events) == 0  # Events list should be cleared
    
    def test_stop_logging(self, input_logger):
        """Test stopping the input logging"""
        # First start the logging
        with patch('builtins.open', mock_open()) as mock_file:
            input_logger.start()
            assert input_logger.running is True
            
            # Stop the logging
            output_file = input_logger.stop()
            
            # Verify the state
            assert input_logger.running is False
            assert input_logger.mouse_listener.stop.called
            assert input_logger.keyboard_listener.stop.called
            assert mock_file.called  # File should be opened for writing
            assert output_file == input_logger.output_file
    
    def test_add_event(self, input_logger):
        """Test adding events to the logger"""
        # Start the logger
        input_logger.start()
        
        # Add an event
        with patch('time.perf_counter_ns', return_value=123456789):
            input_logger._add_event("test_event", param1="value1", param2=42)
        
        # Check the event was added
        assert len(input_logger.events) == 1
        event = input_logger.events[0]
        assert event["t"] == 123456789
        assert event["kind"] == "test_event"
        assert event["param1"] == "value1"
        assert event["param2"] == 42
        
        # Test adding event when not running
        input_logger.running = False
        input_logger._add_event("ignored_event")
        assert len(input_logger.events) == 1  # No new event should be added
    
    def test_mouse_click_handler(self, input_logger):
        """Test mouse click event handling"""
        input_logger.start()
        
        # Create a mock button with a name attribute
        mock_button = MagicMock()
        mock_button.name = "left"
        
        # Test mouse down event
        with patch.object(input_logger, '_add_event') as mock_add_event:
            input_logger.on_mouse_click(100, 200, mock_button, True)  # Mouse down
            mock_add_event.assert_called_with("mouse_down", button="left", x=100, y=200)
            
            # Check drag tracking was updated
            assert input_logger.drag_state["left"] is True
            assert input_logger.drag_state["start_x"] == 100
            assert input_logger.drag_state["start_y"] == 200
        
        # Test mouse up event with drag detection
        with patch.object(input_logger, '_add_event') as mock_add_event, \
             patch('time.perf_counter_ns', return_value=12345):
            
            input_logger.on_mouse_click(200, 300, mock_button, False)  # Mouse up with movement
            
            # Should call mouse_up and drag_end since we moved more than 5 pixels
            assert mock_add_event.call_count == 2
            mock_add_event.assert_any_call("mouse_up", button="left", x=200, y=300)
            
            # Check second call for drag_end
            drag_call_args = mock_add_event.call_args_list[1][0]
            drag_call_kwargs = mock_add_event.call_args_list[1][1]
            assert drag_call_args[0] == "drag_end"
            assert drag_call_kwargs["button"] == "left"
            assert drag_call_kwargs["start_x"] == 100
            assert drag_call_kwargs["start_y"] == 200
            assert drag_call_kwargs["end_x"] == 200
            assert drag_call_kwargs["end_y"] == 300
    
    def test_keyboard_event_handlers(self, input_logger):
        """Test keyboard event handling"""
        input_logger.start()
        
        # Create a mock key
        mock_key = MagicMock()
        mock_key.char = 'a'
        
        # Test key press event
        with patch.object(input_logger, '_add_event') as mock_add_event:
            input_logger.on_key_press(mock_key)
            mock_add_event.assert_called_with("key_down", key='a')
        
        # Test key release event
        with patch.object(input_logger, '_add_event') as mock_add_event:
            input_logger.on_key_release(mock_key)
            mock_add_event.assert_called_with("key_up", key='a')
        
        # Test special key handling (no char attribute)
        mock_special_key = MagicMock(spec=[])
        mock_special_key.__str__ = lambda self: "Key.space"
        
        with patch.object(input_logger, '_add_event') as mock_add_event:
            input_logger.on_key_press(mock_special_key)
            mock_add_event.assert_called_with("key_down", key='space')
    
    def test_scroll_handler(self, input_logger):
        """Test scroll event handling"""
        input_logger.start()
        
        with patch.object(input_logger, '_add_event') as mock_add_event:
            input_logger.on_mouse_scroll(300, 400, 0, 1)  # Scroll down
            mock_add_event.assert_called_with("scroll", x=300, y=400, dx=0, dy=1) 