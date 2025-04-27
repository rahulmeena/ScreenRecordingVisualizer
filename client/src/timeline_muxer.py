import os
import time
import json
import shutil
import tempfile
import zipfile
from loguru import logger

class TimelineMuxer:
    def __init__(self):
        self.running = False
        self.output_dir = os.path.join(os.environ.get('APPDATA', tempfile.gettempdir()), 'GAce')
        os.makedirs(self.output_dir, exist_ok=True)
        self.recording_id = None
        self.recording_dir = None
        self.video_file = None
        self.events_file = None
    
    def start(self):
        """Start a new recording session"""
        if self.running:
            return
        
        self.running = True
        self.recording_id = f"recording_{int(time.time())}"
        self.recording_dir = os.path.join(self.output_dir, self.recording_id)
        os.makedirs(self.recording_dir, exist_ok=True)
        
        logger.info(f"Started timeline muxer with recording ID: {self.recording_id}")
    
    def stop(self):
        """Stop the current recording session"""
        if not self.running:
            return
        
        self.running = False
        logger.info(f"Stopped timeline muxer for recording ID: {self.recording_id}")
    
    def set_video_file(self, video_path):
        """Set the video file for the current recording"""
        self.video_file = video_path
        logger.info(f"Set video file: {video_path}")
    
    def set_events_file(self, events_path):
        """Set the events file for the current recording"""
        self.events_file = events_path
        logger.info(f"Set events file: {events_path}")
    
    def finalize(self):
        """Finalize the recording by combining video and events into a package"""
        if self.running:
            self.stop()
        
        if not self.recording_id:
            logger.error("Cannot finalize: No active recording")
            return None
        
        logger.info(f"Finalizing recording: {self.recording_id}")
        
        # Copy video file
        if not self.video_file or not os.path.exists(self.video_file):
            logger.error(f"Video file not found: {self.video_file}")
            return None
        
        # Copy events file
        if not self.events_file or not os.path.exists(self.events_file):
            logger.error(f"Events file not found: {self.events_file}")
            return None
        
        # Create metadata file
        metadata = {
            "id": self.recording_id,
            "timestamp": time.time(),
            "duration": self._calculate_duration(),
            "resolution": [1280, 800],
            "fps": 10
        }
        
        metadata_file = os.path.join(self.recording_dir, "metadata.json")
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Create normalized events file with aligned timestamps
        events = self._normalize_events()
        events_output = os.path.join(self.recording_dir, "events.json")
        with open(events_output, 'w') as f:
            json.dump(events, f, indent=2)
        
        # Copy video file
        video_output = os.path.join(self.recording_dir, "video.mp4")
        shutil.copy2(self.video_file, video_output)
        
        # Create ZIP package
        zip_path = os.path.join(self.output_dir, f"{self.recording_id}.zip")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(self.recording_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, self.recording_dir)
                    zipf.write(file_path, arcname)
        
        logger.info(f"Created recording package: {zip_path}")
        return zip_path
    
    def _calculate_duration(self):
        """Calculate recording duration from events"""
        try:
            if self.events_file and os.path.exists(self.events_file):
                with open(self.events_file, 'r') as f:
                    data = json.load(f)
                
                if "events" in data and len(data["events"]) > 1:
                    first_event = data["events"][0]
                    last_event = data["events"][-1]
                    
                    # Convert nanoseconds to seconds
                    duration_ns = last_event["t"] - first_event["t"]
                    return duration_ns / 1_000_000_000
            
            # Fallback: estimate based on 10 fps and expected number of frames
            return 30.0  # Default 30 seconds
        except Exception as e:
            logger.error(f"Error calculating duration: {e}")
            return 0.0
    
    def _normalize_events(self):
        """Normalize event timestamps to start from 0 and convert to milliseconds"""
        try:
            if not self.events_file or not os.path.exists(self.events_file):
                return {"events": []}
            
            with open(self.events_file, 'r') as f:
                data = json.load(f)
            
            if "events" not in data or not data["events"]:
                return {"meta": {"fps": 10, "resolution": [1280, 800]}, "events": []}
            
            events = data["events"]
            
            # Find the first timestamp
            first_timestamp = events[0]["t"]
            
            # Normalize timestamps
            for event in events:
                # Convert from ns to ms and make relative to first event
                event["t"] = int((event["t"] - first_timestamp) / 1_000_000)
            
            return {
                "meta": {
                    "fps": 10,
                    "resolution": [1280, 800],
                    "start_time": time.time()
                },
                "events": events
            }
        except Exception as e:
            logger.error(f"Error normalizing events: {e}")
            return {"meta": {"fps": 10, "resolution": [1280, 800]}, "events": []} 