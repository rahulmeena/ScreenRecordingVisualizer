# Screen Recording and Visualization Suite

A complete solution for recording and visualizing screen activity with synchronized mouse and keyboard events. The system consists of a Windows desktop client that records the screen and user inputs, and a web server that processes and visualizes the recordings.

## Components

### Windows Client

A lightweight desktop application that:
- Records screen at 1280x800 @ 10fps
- Captures all mouse and keyboard events
- Runs in the background with system tray access
- Minimizes resource usage
- Uploads recordings to the server

See [client/README.md](client/README.md) for more details.

### Web Server

A Next.js web application that:
- Receives and processes recordings
- Extracts thumbnails and organizes data
- Provides a web interface for visualization
- Shows synchronized video and events
- Displays a filterable timeline of user actions

See [server/README.md](server/README.md) for more details.

## Getting Started

### Prerequisites

- Windows 10 or 11 (64-bit) for client
- Python 3.8+ for client development
- Node.js 18+ for server
- Redis for server job queue
- FFmpeg (included in both components)

### Quick Start

1. **Set up the server**:
   ```
   cd server
   npm install
   npm run dev
   ```
   In a separate terminal:
   ```
   npm run worker
   ```

2. **Build and run the client**:
   ```
   cd client
   pip install -r requirements.txt
   python src/app.py
   ```

   Or use the pre-built executable if available.

## Architecture

```
+----------------------+        HTTPS (multipart/form)        +----------------------------+
|  Windows Tray App    |  ───────────────────────────────────▶ |  Upload API (Node/Next.js) |
|  (Python 3.12)       |                                       +----------------------------+
|                      |                                               │
|  ▸ ScreenCapture     |           Synchronized  ⎫                    │ enqueue job
|  ▸ InputLogger       |           MP4  (H.264)  ⎬  ─┐                 ▼
|  ▸ TimelineMuxer     |           events.json    ⎭   ├▶  S3 / Blob store
|  ▸ Uploader          |                              │
+----------------------+                              ▼
                                                  +--------------------+
                                                  |  Worker (Node)     |
                                                  |  • frame hashes    |
                                                  |  • thumbnail grid  |
                                                  +--------------------+
                                                           │
                                     REST / SWR            ▼
                                 +-------------------------------+
                                 |  Next.js  Web UI (Tailwind)   |
                                 |  • video player (react-player)|
                                 |  • canvas action overlay      |
                                 |  • sortable event table       |
                                 +-------------------------------+
```

## Performance

This solution is designed to be lightweight:
- Client uses ~50MB RAM when idle, ~15% CPU during recording
- Zero-copy screen capture minimizes resource usage
- Hardware-accelerated encoding when available
- Server worker processes recordings asynchronously

## License

MIT 