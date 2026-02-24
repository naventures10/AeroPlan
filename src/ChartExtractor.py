import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote
import re


class ChartExtractor:
    def __init__(self, session=None):
        # Accepts an existing session to maintain connection efficiency, 
        # or creates a new one if run independently.
        self.session = session or requests.Session()

    def extract_charts(self, parent_url):
        print(f"[*] Parent Context: Fetching {parent_url}")
        
        try:
            response = self.session.get(parent_url, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"[!] Failed to fetch parent page: {e}")
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        extracted_charts = []
        
        # Step 1: IFrame Targeting Logic
        iframes = soup.find_all('iframe', src=True)
        print(f"[*] Found {len(iframes)} total iframe(s) on the page.")

        for iframe in iframes:
            raw_src = iframe['src']
            
            # Filter out generic iframes (like ad banners or empty frames)
            if "Chart" not in raw_src:
                continue
                
            print(f"\n[*] Intermediate Hop: Diving into {raw_src}")
            
            # Step 2: Resolve the intermediate URL (handling spaces in filenames)
            safe_src = quote(raw_src)
            iframe_url = urljoin(parent_url, safe_src)
            
            try:
                iframe_response = self.session.get(iframe_url, timeout=10)
                iframe_response.raise_for_status()
            except requests.RequestException as e:
                print(f"[!] Failed to fetch iframe {iframe_url}: {e}")
                continue
                
            iframe_soup = BeautifulSoup(iframe_response.text, 'html.parser')
            
            # Step 3: The Asset Hunt
            pdf_links = iframe_soup.find_all('a', href=True)
            chart_count = 0
            
            for link in pdf_links:
                raw_href = link['href']
                
                # Check if it's a PDF (using 'in' to catch parameters like .pdf?v=1)
                if '.pdf' in raw_href.lower():
                    # Attempt to get the human-readable name
                    chart_name = link.get_text(strip=True)
                    
                    # Fallback: If text is an icon/empty, use the filename
                    if not chart_name:
                        chart_name = raw_href.split('/')[-1]
                        
                    # Step 4: Final Resolution
                    safe_pdf_href = quote(raw_href)
                    pdf_absolute_url = urljoin(iframe_url, safe_pdf_href)
                    
                    extracted_charts.append({
                        "chart_name": chart_name,
                        "pdf_url": pdf_absolute_url,
                        "source_iframe": raw_src
                    })
                    chart_count += 1
            
            print(f"    -> Extracted {chart_count} PDFs from this iframe.")

        return extracted_charts