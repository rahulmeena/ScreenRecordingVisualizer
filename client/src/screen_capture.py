import os
import time
import asyncio
import subprocess
import tempfile
import threading
from queue import Queue
import mss
from loguru import logger

class ScreenCapture:
    def __init__(self, resolution=(1280, 800), fps=10):
        self.resolution = resolution
        self.fps = fps
        self.running = False
        self.frame_interval = 1.0 / fps
        self.frame_queue = Queue(maxsize=2)  # Small queue to minimize memory usage
        self.output_dir = os.path.join(os.environ.get('APPDATA', tempfile.gettempdir()), 'GAce')
        os.makedirs(self.output_dir, exist_ok=True)
        self.output_file = None
        self.ffmpeg_process = None
        self.capture_thread = None
        self.encoder_thread = None
    
    def start(self):
        """Start the screen capture process"""
        if self.running:
            return
        
        self.running = True
        self.output_file = os.path.join(self.output_dir, f"recording_{int(time.time())}.mp4")
        logger.info(f"Starting screen capture to {self.output_file}")
        
        # Start capture thread
        self.capture_thread = threading.Thread(target=self._capture_worker)
        self.capture_thread.daemon = True
        self.capture_thread.start()
        
        # Start encoder thread
        self.encoder_thread = threading.Thread(target=self._encoder_worker)
        self.encoder_thread.daemon = True
        self.encoder_thread.start()
    
    def stop(self):
        """Stop the screen capture process"""
        if not self.running:
            return
        
        logger.info("Stopping screen capture")
        self.running = False
        
        if self.capture_thread:
            self.capture_thread.join(timeout=2.0)
        
        # Make sure encoder gets remaining frames and terminates
        if self.encoder_thread:
            self.encoder_thread.join(timeout=5.0)
        
        if self.ffmpeg_process:
            try:
                self.ffmpeg_process.stdin.close()
                self.ffmpeg_process.wait(timeout=5.0)
            except Exception as e:
                logger.error(f"Error stopping ffmpeg: {e}")
                try:
                    self.ffmpeg_process.kill()
                except:
                    pass
        
        logger.info(f"Screen capture stopped, video saved to {self.output_file}")
        return self.output_file
    
    def _capture_worker(self):
        """Worker thread to capture screen frames"""
        try:
            with mss.mss() as sct:
                # Get the monitor to capture
                monitor = sct.monitors[1]  # Primary monitor
                
                # Calculate region to maintain aspect ratio
                screen_width = monitor["width"]
                screen_height = monitor["height"]
                capture_width, capture_height = self.resolution
                
                # Calculate capture region to maintain aspect ratio
                if screen_width / screen_height > capture_width / capture_height:
                    # Screen is wider than target - adjust width
                    scale = capture_height / screen_height
                    adjusted_width = int(screen_width * scale)
                    offset_x = (adjusted_width - capture_width) // 2
                    region = {
                        "left": monitor["left"] + offset_x,
                        "top": monitor["top"],
                        "width": capture_width,
                        "height": capture_height
                    }
                else:
                    # Screen is taller than target - adjust height
                    scale = capture_width / screen_width
                    adjusted_height = int(screen_height * scale)
                    offset_y = (adjusted_height - capture_height) // 2
                    region = {
                        "left": monitor["left"],
                        "top": monitor["top"] + offset_y,
                        "width": capture_width,
                        "height": capture_height
                    }
                
                last_capture_time = 0
                
                while self.running:
                    current_time = time.perf_counter()
                    time_since_last = current_time - last_capture_time
                    
                    if time_since_last >= self.frame_interval:
                        timestamp_ns = time.perf_counter_ns()
                        frame = sct.grab(region)
                        
                        # Put frame in queue for encoder
                        if not self.frame_queue.full():
                            self.frame_queue.put((timestamp_ns, frame), block=False)
                        
                        last_capture_time = current_time
                    
                    # Small sleep to prevent CPU hogging
                    sleep_time = max(0.001, self.frame_interval - (time.perf_counter() - current_time))
                    time.sleep(sleep_time)
        
        except Exception as e:
            logger.exception(f"Error in capture worker: {e}")
            self.running = False
    
    def _encoder_worker(self):
        """Worker thread to encode frames to video"""
        try:
            # Start ffmpeg process
            cmd = [
                "ffmpeg",
                "-y",  # Overwrite output file
                "-f", "rawvideo",
                "-vcodec", "rawvideo",
                "-pixel_format", "bgra",
                "-video_size", f"{self.resolution[0]}x{self.resolution[1]}",
                "-framerate", str(self.fps),
                "-i", "-",  # Input from stdin
                "-c:v", "h264_nvenc" if self._has_nvidia() else "h264_qsv" if self._has_intel_qsv() else "libx264",
                "-preset", "ultrafast",
                "-crf", "28",
                "-pix_fmt", "yuv420p",
                "-r", str(self.fps),
                self.output_file
            ]
            
            logger.debug(f"Starting ffmpeg with command: {' '.join(cmd)}")
            
            self.ffmpeg_process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            while self.running or not self.frame_queue.empty():
                try:
                    timestamp_ns, frame = self.frame_queue.get(timeout=1.0)
                    
                    # Write raw frame bytes to ffmpeg
                    self.ffmpeg_process.stdin.write(frame.rgb)
                    self.ffmpeg_process.stdin.flush()
                    
                    # Log frame timestamp for debugging
                    logger.debug(f"Encoded frame at {timestamp_ns}")
                    
                except Exception as e:
                    if "queue.Empty" not in str(e.__class__):
                        logger.error(f"Error in encoder: {e}")
            
            # Finalize video
            if self.ffmpeg_process and self.ffmpeg_process.stdin:
                self.ffmpeg_process.stdin.close()
                self.ffmpeg_process.wait()
        
        except Exception as e:
            logger.exception(f"Error in encoder worker: {e}")
            self.running = False
    
    def _has_nvidia(self):
        """Check if NVIDIA GPU is available"""
        try:
            result = subprocess.run(
                ["ffmpeg", "-hide_banner", "-encoders"],
                capture_output=True, text=True, check=True
            )
            return "h264_nvenc" in result.stdout
        except:
            return False
    
    def _has_intel_qsv(self):
        """Check if Intel QuickSync is available"""
        try:
            result = subprocess.run(
                ["ffmpeg", "-hide_banner", "-encoders"],
                capture_output=True, text=True, check=True
            )
            return "h264_qsv" in result.stdout
        except:
            return False 