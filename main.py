import requests
import urllib3
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
from src.AIRACResolver import AIRACResolver
from src.MasterOrchestrator import MasterOrchestrator

# Concurrency tuning: number of parallel airport workers
MAX_WORKERS = 4

if __name__ == "__main__":
    HOME_URL = "https://aim-india.aai.aero/"
    
    # 1. Create the Master Session
    master_session = requests.Session()
    master_session.verify = False 
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    
    # 2. Add a standard Browser User-Agent
    master_session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
    })
    
    # 3. Mount a robust Retry Strategy (Retries 3 times, with increasing delays)
    retry_strategy = Retry(
        total=3,
        backoff_factor=2, # Wait 2s, then 4s, then 8s between retries
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"]
    )
    # Pool size matches worker count for optimal connection reuse under concurrency
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=MAX_WORKERS + 2,
        pool_maxsize=MAX_WORKERS + 2
    )
    master_session.mount("https://", adapter)
    master_session.mount("http://", adapter)
    
    # Execute Hop 0
    resolver = AIRACResolver(HOME_URL, session=master_session)
    active_eaip_url = resolver.get_current_eaip_url()
    
    if active_eaip_url:
        orchestrator = MasterOrchestrator(
            active_eaip_url, 
            session=master_session,
            max_workers=MAX_WORKERS
        )
        orchestrator.run_pipeline()
    else:
        print("[!] Critical Failure: Could not resolve a valid eAIP target URL. Exiting.")