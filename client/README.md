# Screen Recording Client

A Windows application that records screen, mouse, and keyboard activity and uploads the recordings to a visualization server.

## Features

- Records screen at Desktop's resolution @ 10fps
- Captures mouse movements, clicks, drags, and scrolls
- Logs keyboard input
- Runs in the background with minimal resource usage
- System tray icon for start/stop control
- Automatically uploads recordings to server
- Handles offline scenarios with queue system

## Requirements

- Windows 10 or 11 (64-bit)
- FFmpeg (if not bundled in the executable)
- Python 3.8+ (for development only)

## Installation

### Option 1: Use pre-built executable

1. Download the latest `ScreenRecorder.exe` from the releases page
2. Run the executable to start the application
3. The app will appear in your system tray

### Option 2: Build from source

1. Clone this repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Install PyInstaller:
   ```
   pip install pyinstaller
   ```
4. Build the executable:
   ```
   pyinstaller screen_recorder.spec
   ```
5. The executable will be in the `dist` folder

## Usage

1. Click the system tray icon to see available options
2. Select "Start Recording" to begin capturing
3. Select "Stop & Upload" to end recording and upload the data
4. Recordings are uploaded to the configured server for visualization

## Configuration

By default, the app uploads to `http://localhost:3000/api/recordings`. To change this:

1. Edit `src/uploader.py` before building
2. Change the `server_url` parameter in the `Uploader` class

## Troubleshooting

Logs are stored in `%LOCALAPPDATA%\GAce\logs`. Check these logs if you encounter any issues.

Common issues:

1. **App doesn't start**: Make sure you have permissions to create files in AppData
2. **Recording failed**: Check if FFmpeg is installed and in your PATH
3. **Upload failed**: Verify server URL and network connection

## Performance

The application is designed to use minimal resources:
- Memory: ~50MB during idle, ~100MB during recording
- CPU: <5% when idle, <15% during recording on a modern system
- Disk: Recordings are temporarily stored in `%APPDATA%\GAce` 
