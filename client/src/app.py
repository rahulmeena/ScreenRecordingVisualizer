import os
import sys
import time
import threading
import asyncio
import pystray
from PIL import Image, ImageDraw
import tempfile
from loguru import logger

from screen_capture import ScreenCapture
from input_logger import InputLogger
from timeline_muxer import TimelineMuxer
from uploader import Uploader

# Configure logging
log_dir = os.path.join(os.environ.get('LOCALAPPDATA', tempfile.gettempdir()), 'GAce', 'logs')
os.makedirs(log_dir, exist_ok=True)
logger.add(os.path.join(log_dir, "recorder_{time}.log"), rotation="10 MB")

class RecorderApp:
    def __init__(self):
        self.is_recording = False
        self.recorder_thread = None
        self.loop = None
        
        # Create components
        self.screen_capture = ScreenCapture()
        self.input_logger = InputLogger()
        self.timeline_muxer = TimelineMuxer()
        self.uploader = Uploader()
        
        # Initialize tray icon
        self.setup_tray()
        
    def setup_tray(self):
        """Set up the system tray icon and menu"""
        # Create a simple icon
        icon_image = self.create_icon_image()
        
        # Create the tray icon with dynamic menu
        self.icon = pystray.Icon('screen_recorder', icon_image, 'Screen Recorder', self.create_menu())
    
    def create_menu(self):
        """Create menu based on current state"""
        return pystray.Menu(
            pystray.MenuItem('Start Recording', self.start_recording, enabled=not self.is_recording),
            pystray.MenuItem('Stop & Upload', self.stop_recording, enabled=self.is_recording),
            pystray.MenuItem('Exit', self.exit_app)
        )
    
    def create_icon_image(self):
        """Create a simple icon image"""
        width = 64
        height = 64
        color = (255, 0, 0)  # Red
        
        image = Image.new('RGB', (width, height), color=(0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.ellipse([(8, 8), (width-8, height-8)], fill=color)
        
        return image
    
    def update_menu_state(self):
        """Update menu items enabled/disabled state"""
        # Update the icon's menu with a fresh menu
        self.icon.menu = self.create_menu()
    
    def start_recording(self, *args):
        """Start recording screen and inputs"""
        if self.is_recording:
            return
            
        logger.info("Starting recording")
        self.is_recording = True
        self.update_menu_state()
        
        # Create a new event loop for the recorder thread
        self.recorder_thread = threading.Thread(target=self.recording_worker)
        self.recorder_thread.daemon = True
        self.recorder_thread.start()
    
    def recording_worker(self):
        """Worker thread to handle recording process"""
        try:
            # Create new event loop for this thread
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            
            # Start capture processes
            self.screen_capture.start()
            self.input_logger.start()
            self.timeline_muxer.start()
            
            # Run the event loop
            self.loop.run_forever()
        except Exception as e:
            logger.exception(f"Error in recording worker: {e}")
            self.is_recording = False
            self.update_menu_state()
        finally:
            if self.loop and self.loop.is_running():
                self.loop.close()
    
    def stop_recording(self, *args):
        """Stop recording and upload results"""
        if not self.is_recording:
            return
            
        logger.info("Stopping recording")
        self.is_recording = False
        self.update_menu_state()
        
        # Stop recording components
        if self.loop:
            self.loop.call_soon_threadsafe(self.loop.stop)
        
        if self.recorder_thread:
            self.recorder_thread.join(timeout=5.0)
            self.recorder_thread = None
        
        self.screen_capture.stop()
        self.input_logger.stop()
        
        # Finalize recording
        recording_path = self.timeline_muxer.finalize()
        
        # Upload the recording
        self.uploader.upload_recording(recording_path)
    
    def exit_app(self, *args):
        """Exit the application"""
        logger.info("Exiting application")
        if self.is_recording:
            self.stop_recording()
        self.icon.stop()
    
    def run(self):
        """Run the application"""
        logger.info("Starting Screen Recorder application")
        self.icon.run()

if __name__ == "__main__":
    app = RecorderApp()
    app.run() 