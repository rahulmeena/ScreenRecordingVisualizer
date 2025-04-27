import os
import time
import json
import platform
import socket
import requests
import threading
import tempfile
import queue
from loguru import logger

class Uploader:
    def __init__(self, server_url="http://localhost:3000/api/recordings"):
        self.server_url = server_url
        self.queue_dir = os.path.join(os.environ.get('APPDATA', tempfile.gettempdir()), 'GAce', 'queue')
        os.makedirs(self.queue_dir, exist_ok=True)
        self.upload_queue = queue.Queue()
        self.upload_thread = None
        self.running = False
        
        # Start background uploader thread
        self._start_upload_thread()
        
        # Load any previously queued recordings
        self._load_queued_recordings()
    
    def _start_upload_thread(self):
        """Start the background upload thread"""
        if self.upload_thread and self.upload_thread.is_alive():
            return
        
        self.running = True
        self.upload_thread = threading.Thread(target=self._upload_worker)
        self.upload_thread.daemon = True
        self.upload_thread.start()
    
    def _load_queued_recordings(self):
        """Load any previously queued recordings"""
        try:
            files = [f for f in os.listdir(self.queue_dir) if f.endswith('.json')]
            for file in files:
                file_path = os.path.join(self.queue_dir, file)
                try:
                    with open(file_path, 'r') as f:
                        record = json.load(f)
                    
                    if 'path' in record and os.path.exists(record['path']):
                        logger.info(f"Queuing previously saved recording: {record['path']}")
                        self.upload_queue.put(record)
                    else:
                        # Clean up invalid queue entry
                        os.remove(file_path)
                except Exception as e:
                    logger.error(f"Error loading queued recording {file}: {e}")
        except Exception as e:
            logger.error(f"Error loading queued recordings: {e}")
    
    def upload_recording(self, recording_path):
        """Upload a recording to the server or queue it for later"""
        if not recording_path or not os.path.exists(recording_path):
            logger.error(f"Invalid recording path: {recording_path}")
            return False
        
        # Create record with metadata
        record = {
            'path': recording_path,
            'timestamp': time.time(),
            'machine': platform.node(),
            'os': f"{platform.system()} {platform.release()}",
            'retries': 0
        }
        
        # Save to queue in case upload fails
        queue_file = os.path.join(self.queue_dir, f"queue_{int(time.time())}_{id(record)}.json")
        with open(queue_file, 'w') as f:
            json.dump(record, f)
        
        # Add to upload queue
        self.upload_queue.put(record)
        
        return True
    
    def _upload_worker(self):
        """Background worker to process upload queue"""
        while self.running:
            try:
                # Try to get an item from the queue
                try:
                    record = self.upload_queue.get(timeout=5.0)
                except queue.Empty:
                    continue
                
                recording_path = record['path']
                retries = record['retries']
                
                # Check if file exists
                if not os.path.exists(recording_path):
                    logger.error(f"Recording file no longer exists: {recording_path}")
                    self.upload_queue.task_done()
                    continue
                
                # Try to upload
                success = self._do_upload(recording_path, record)
                
                if success:
                    logger.info(f"Successfully uploaded recording: {recording_path}")
                    # Clean up queue file
                    queue_files = [f for f in os.listdir(self.queue_dir) if f"{int(record['timestamp'])}" in f]
                    for file in queue_files:
                        try:
                            os.remove(os.path.join(self.queue_dir, file))
                        except:
                            pass
                else:
                    # Increment retry count and requeue
                    record['retries'] = retries + 1
                    
                    # Exponential backoff for retries
                    if record['retries'] <= 5:  # Max 5 retries
                        backoff_time = min(30, 2 ** record['retries'])
                        logger.info(f"Upload failed, will retry in {backoff_time} seconds")
                        time.sleep(backoff_time)
                        self.upload_queue.put(record)
                    else:
                        logger.error(f"Upload failed after maximum retries: {recording_path}")
                
                self.upload_queue.task_done()
            
            except Exception as e:
                logger.exception(f"Error in upload worker: {e}")
                time.sleep(5)  # Sleep before retrying the loop
    
    def _do_upload(self, recording_path, metadata):
        """Upload a recording file to the server"""
        try:
            logger.info(f"Uploading recording: {recording_path}")
            
            # Prepare metadata
            upload_metadata = {
                'machine': metadata.get('machine', platform.node()),
                'os': metadata.get('os', f"{platform.system()} {platform.release()}"),
                'timestamp': metadata.get('timestamp', time.time()),
            }
            
            # Get the original filename
            original_filename = os.path.basename(recording_path)
            
            # Read the file as binary data
            with open(recording_path, 'rb') as f:
                binary_data = f.read()
            
            # Add the original filename and metadata to the headers
            headers = {
                'x-original-filename': original_filename,
                'x-recording-meta': json.dumps(upload_metadata),
                'Content-Type': 'application/zip'  # Set content type to zip
            }
            
            # Send as binary data directly instead of multipart form
            response = requests.post(
                self.server_url,
                data=binary_data,  # Send binary data directly
                headers=headers,
                timeout=60  # 60 second timeout
            )
            
            # Check response
            if response.status_code == 200:
                resp_data = response.json()
                logger.info(f"Upload successful: {resp_data}")
                return True
            else:
                logger.error(f"Upload failed with status {response.status_code}: {response.text[:500]}")
                
                # Special handling for 500 errors
                if response.status_code == 500:
                    logger.info("Server error detected. The recording has been saved locally and will be retried later.")
                    
                    # Log additional diagnostic info
                    try:
                        if "Module not found" in response.text and "@/lib/queue" in response.text:
                            logger.warning("Server is missing the queue module. This is a known issue and the team is working on it.")
                    except:
                        pass
                
                return False
        
        except requests.RequestException as e:
            logger.error(f"Upload error: {e}")
            return False
        except Exception as e:
            logger.exception(f"Error during upload: {e}")
            return False 