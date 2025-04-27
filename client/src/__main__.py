import sys
import os
import traceback
import tempfile
from loguru import logger

# Add parent directory to path
parent_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Configure error handling
def handle_exception(exc_type, exc_value, exc_traceback):
    """Handle uncaught exceptions by logging them"""
    logger.error("Uncaught exception:", exc_info=(exc_type, exc_value, exc_traceback))
    # Display error message to user
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror("Screen Recorder Error", 
                         f"An error occurred: {exc_value}\n\nCheck logs for details.")
    # Continue with normal exception handling
    sys.__excepthook__(exc_type, exc_value, exc_traceback)

sys.excepthook = handle_exception

# Configure logging
log_dir = os.path.join(os.environ.get('LOCALAPPDATA', tempfile.gettempdir()), 'GAce', 'logs')
os.makedirs(log_dir, exist_ok=True)
logger.add(os.path.join(log_dir, "recorder_{time}.log"), rotation="10 MB")

# Import and run the app
if __name__ == "__main__":
    try:
        from src.app import RecorderApp
        app = RecorderApp()
        app.run()
    except Exception as e:
        logger.exception(f"Error starting application: {e}")
        # Re-raise to trigger the custom exception handler
        raise 