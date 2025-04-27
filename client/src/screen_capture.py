import os
import time
import asyncio
import subprocess
import tempfile
import threading
from queue import Queue
import mss
import numpy as np
from loguru import logger
import shutil

class ScreenCapture:
    def __init__(self, resolution=None, fps=10):
        # Detect system resolution automatically
        with mss.mss() as sct:
            monitor = sct.monitors[1]  # Primary monitor
            system_width = monitor["width"]
            system_height = monitor["height"]
            logger.info(f"Detected system resolution: {system_width}x{system_height}")
        
        # Use detected resolution if none provided
        self.resolution = resolution if resolution else (system_width, system_height)
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
                
                # Capture the entire monitor
                region = {
                    "left": monitor["left"],
                    "top": monitor["top"],
                    "width": monitor["width"],
                    "height": monitor["height"]
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
            # Check if ffmpeg is installed
            ffmpeg_path = shutil.which("ffmpeg")
            if not ffmpeg_path:
                logger.error("FFmpeg not found! Please install FFmpeg and make sure it's in your PATH.")
                self.running = False
                return
                
            # Start ffmpeg process
            cmd = [
                ffmpeg_path,  # Use the full path to ffmpeg
                "-y",  # Overwrite output file
                "-f", "rawvideo",
                "-vcodec", "rawvideo",
                "-pixel_format", "bgra",
                "-video_size", f"{self.resolution[0]}x{self.resolution[1]}",
                "-framerate", str(self.fps),
                "-i", "-",  # Input from stdin
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "28", # 28 for good enough quality, 38 for worst quality but smallest file
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
                    
                    # Convert mss screenshot to correct format for ffmpeg
                    # MSS returns images in BGRA format, we need to resize and convert
                    frame_array = np.array(frame)
                    
                    # Resize if needed to match requested resolution
                    if frame_array.shape[0] != self.resolution[1] or frame_array.shape[1] != self.resolution[0]:
                        # Use simple resizing (nearest neighbor for speed)
                        h_scale = self.resolution[1] / frame_array.shape[0]
                        w_scale = self.resolution[0] / frame_array.shape[1]
                        
                        if h_scale < w_scale:
                            new_height = self.resolution[1]
                            new_width = int(frame_array.shape[1] * h_scale)
                        else:
                            new_width = self.resolution[0]
                            new_height = int(frame_array.shape[0] * w_scale)
                            
                        # Center the image
                        temp_frame = np.zeros((self.resolution[1], self.resolution[0], 4), dtype=np.uint8)
                        
                        # Simple resize using numpy (faster than cv2 for this use case)
                        indices_x = np.floor(np.arange(new_width) / new_width * frame_array.shape[1]).astype(np.int32)
                        indices_y = np.floor(np.arange(new_height) / new_height * frame_array.shape[0]).astype(np.int32)
                        
                        # Create the resized image
                        resized = frame_array[np.ix_(indices_y, indices_x)]
                        
                        # Place it in the center
                        x_offset = (self.resolution[0] - new_width) // 2
                        y_offset = (self.resolution[1] - new_height) // 2
                        
                        temp_frame[y_offset:y_offset+new_height, x_offset:x_offset+new_width] = resized
                        frame_array = temp_frame
                    
                    # Write raw frame bytes to ffmpeg
                    self.ffmpeg_process.stdin.write(frame_array.tobytes())
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
            ffmpeg_path = shutil.which("ffmpeg")
            if not ffmpeg_path:
                return False
                
            result = subprocess.run(
                [ffmpeg_path, "-hide_banner", "-encoders"],
                capture_output=True, text=True, check=True
            )
            return "h264_nvenc" in result.stdout
        except:
            return False
    
    def _has_intel_qsv(self):
        """Check if Intel QuickSync is available"""
        try:
            ffmpeg_path = shutil.which("ffmpeg")
            if not ffmpeg_path:
                return False
                
            result = subprocess.run(
                [ffmpeg_path, "-hide_banner", "-encoders"],
                capture_output=True, text=True, check=True
            )
            return "h264_qsv" in result.stdout
        except:
            return False 