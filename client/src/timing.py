"""
Shared timing utilities to synchronize events across recording components
"""
import time

# Global timing reference for all components
START_TIME_NS = None

def get_start_time():
    """Get the global start time, initializing if needed"""
    global START_TIME_NS
    if START_TIME_NS is None:
        START_TIME_NS = time.perf_counter_ns()
    return START_TIME_NS

def set_start_time():
    """Set the global start time to now and return it"""
    global START_TIME_NS
    START_TIME_NS = time.perf_counter_ns()
    return START_TIME_NS

def get_timestamp_ns():
    """Get timestamp relative to start time in nanoseconds"""
    return time.perf_counter_ns() - get_start_time() 