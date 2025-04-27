import os
import time
import json
import threading
import tempfile
from pynput import mouse, keyboard
from loguru import logger
from timing import get_timestamp_ns

class InputLogger:
    def __init__(self):
        self.running = False
        self.events = []
        self.mouse_listener = None
        self.keyboard_listener = None
        self.output_dir = os.path.join(os.environ.get('APPDATA', tempfile.gettempdir()), 'GAce')
        os.makedirs(self.output_dir, exist_ok=True)
        self.output_file = None
        self.lock = threading.Lock()
        self.drag_state = {
            'left': False,
            'right': False,
            'middle': False,
            'start_x': 0,
            'start_y': 0,
            'start_time': 0
        }
    
    def start(self):
        """Start recording input events"""
        if self.running:
            return
        
        self.running = True
        self.output_file = os.path.join(self.output_dir, f"events_{int(time.time())}.json")
        logger.info(f"Starting input logging to {self.output_file}")
        
        # Clear events
        with self.lock:
            self.events = []
        
        # Start listeners
        self.mouse_listener = mouse.Listener(
            on_move=self.on_mouse_move,
            on_click=self.on_mouse_click,
            on_scroll=self.on_mouse_scroll
        )
        self.mouse_listener.start()
        
        self.keyboard_listener = keyboard.Listener(
            on_press=self.on_key_press,
            on_release=self.on_key_release
        )
        self.keyboard_listener.start()
    
    def stop(self):
        """Stop recording input events and save to file"""
        if not self.running:
            return
        
        logger.info("Stopping input logging")
        self.running = False
        
        # Stop listeners
        if self.mouse_listener:
            self.mouse_listener.stop()
            self.mouse_listener = None
        
        if self.keyboard_listener:
            self.keyboard_listener.stop()
            self.keyboard_listener = None
        
        # Save events to file
        with self.lock:
            with open(self.output_file, 'w') as f:
                json.dump({
                    "meta": {
                        "timestamp": time.time(),
                        "type": "input_events"
                    },
                    "events": self.events
                }, f, indent=2)
        
        logger.info(f"Input logging stopped, events saved to {self.output_file}")
        return self.output_file
    
    def _add_event(self, event_type, **kwargs):
        """Add an event to the events list"""
        if not self.running:
            return
        
        # Use timing module to get timestamp relative to global start time
        timestamp_ns = get_timestamp_ns()
        event = {
            "t": timestamp_ns,
            "kind": event_type,
            **kwargs
        }
        
        with self.lock:
            self.events.append(event)
    
    def on_mouse_move(self, x, y):
        """Handle mouse move event"""
        # Only log move events if dragging (to reduce data volume)
        if self.drag_state['left'] or self.drag_state['right'] or self.drag_state['middle']:  # Any button is in drag state
            self._add_event("mouse_drag", x=x, y=y)
    
    def on_mouse_click(self, x, y, button, pressed):
        """Handle mouse click event"""
        button_name = button.name if hasattr(button, 'name') else str(button)
        
        # Handle regular clicks
        if pressed:
            self._add_event("mouse_down", button=button_name, x=x, y=y)
            
            # Track drag start
            if button_name in self.drag_state:
                self.drag_state[button_name] = True
                self.drag_state['start_x'] = x
                self.drag_state['start_y'] = y
                self.drag_state['start_time'] = time.perf_counter_ns()
        else:
            self._add_event("mouse_up", button=button_name, x=x, y=y)
            
            # Check if this was a drag end
            if button_name in self.drag_state and self.drag_state[button_name]:
                # If moved more than 5 pixels, consider it a drag
                dx = abs(x - self.drag_state['start_x'])
                dy = abs(y - self.drag_state['start_y'])
                drag_time = time.perf_counter_ns() - self.drag_state['start_time']
                
                if dx > 5 or dy > 5:
                    self._add_event("drag_end", 
                                   button=button_name,
                                   start_x=self.drag_state['start_x'],
                                   start_y=self.drag_state['start_y'],
                                   end_x=x,
                                   end_y=y,
                                   duration_ns=drag_time)
                
                self.drag_state[button_name] = False
    
    def on_mouse_scroll(self, x, y, dx, dy):
        """Handle mouse scroll event"""
        self._add_event("scroll", x=x, y=y, dx=dx, dy=dy)
    
    def on_key_press(self, key):
        """Handle key press event"""
        key_name = self._get_key_name(key)
        self._add_event("key_down", key=key_name)
    
    def on_key_release(self, key):
        """Handle key release event"""
        key_name = self._get_key_name(key)
        self._add_event("key_up", key=key_name)
    
    def _get_key_name(self, key):
        """Get a readable name for a key"""
        try:
            # Handle special keys
            if hasattr(key, 'char'):
                if key.char:
                    return key.char
            
            # Handle named keys (Enter, Esc, etc.)
            if hasattr(key, 'name'):
                return key.name
            
            # Fall back to string representation
            key_str = str(key)
            # Clean up string representation
            key_str = key_str.replace("Key.", "")
            key_str = key_str.replace("'", "")
            return key_str
        except:
            return "unknown_key" 