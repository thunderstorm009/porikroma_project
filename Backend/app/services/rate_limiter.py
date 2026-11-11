import time
from collections import defaultdict
from threading import Lock
from typing import Tuple


class UserRateLimiter:
    """
    Sliding window per-user rate limiter.
    Thread-safe and lightweight with in-memory tracking.
    """

    def __init__(self, max_requests: int = 10, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, user_id: str) -> Tuple[bool, int]:
        """
        Check if user is allowed to perform an action.
        Returns (is_allowed: bool, retry_after_seconds: int).
        """
        now = time.monotonic()
        with self._lock:
            timestamps = self._requests[user_id]
            cutoff = now - self.window_seconds
            # Retain only timestamps within the rolling window
            valid_timestamps = [t for t in timestamps if t > cutoff]
            self._requests[user_id] = valid_timestamps

            if len(valid_timestamps) >= self.max_requests:
                oldest = valid_timestamps[0]
                retry_after = max(1, int(self.window_seconds - (now - oldest)))
                return False, retry_after

            valid_timestamps.append(now)
            return True, 0

    def reset(self, user_id: str = None) -> None:
        """Reset rate limiter state (useful for tests)."""
        with self._lock:
            if user_id:
                self._requests.pop(user_id, None)
            else:
                self._requests.clear()


# Default rate limiter for AI queries: 10 requests per 60 seconds per user
ai_rate_limiter = UserRateLimiter(max_requests=10, window_seconds=60.0)
