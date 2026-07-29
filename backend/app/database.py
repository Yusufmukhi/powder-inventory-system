import os
import time

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in your .env file. "
        "Copy .env.example to .env and fill in your project credentials."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def execute_with_retry(query, retries: int = 2, delay_seconds: float = 0.3):
    """
    Runs `query.execute()`, retrying on transient connection errors
    (e.g. httpx.RemoteProtocolError: Server disconnected — an intermittent
    Supabase/Render networking blip, not a code bug). Re-raises the last
    error if all attempts fail.
    """
    last_error = None
    for attempt in range(retries + 1):
        try:
            return query.execute()
        except Exception as e:
            last_error = e
            if attempt < retries:
                time.sleep(delay_seconds)
    raise last_error
    
