import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
import re


class AIRACResolver:
    def __init__(self, homepage_url, session=None):
        self.homepage_url = homepage_url
        self.session = session or requests.Session()
        # Regex to capture the date string exactly as it appears inside the parentheses
        self.date_pattern = re.compile(
            r"Effective Date:\s*(\d{1,2}\s+[a-zA-Z]{3}\s+\d{4})"
        )

    def get_current_eaip_url(self):
        print(f"[*] Hop 0: Resolving active AIRAC cycle from {self.homepage_url}")

        try:
            response = self.session.get(self.homepage_url, timeout=120)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"[!] Failed to fetch homepage: {e}")
            return None

        soup = BeautifulSoup(response.text, "html.parser")
        eaip_links = []

        # Step 1: Scan for all eAIP amendments
        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True)

            if "eAIP India AMDT" in text:
                match = self.date_pattern.search(text)
                if match:
                    date_str = match.group(1)
                    try:
                        # Convert string (e.g., "19 MAR 2026") into a comparable datetime object
                        effective_date = datetime.strptime(date_str, "%d %b %Y")
                        absolute_url = urljoin(self.homepage_url, link["href"])
                        eaip_links.append((effective_date, absolute_url, text))
                    except ValueError as e:
                        print(f"    [!] Date parsing error for '{date_str}': {e}")

        if not eaip_links:
            print("[-] No eAIP links found on the homepage.")
            return None

        # Step 2: The Time Machine Logic
        today = datetime.now()
        print(f"[*] System Date: {today.strftime('%d %b %Y')}")

        # Filter: Keep only the links where the effective date is today or in the past
        active_links = [item for item in eaip_links if item[0] <= today]

        if not active_links:
            print(
                "[-] No currently active eAIP found (all published cycles are in the future)."
            )
            # Fallback: If everything is in the future, just take the closest one
            eaip_links.sort(key=lambda x: x[0])
            best_match = eaip_links[0]
        else:
            # Sort: Bring the most recent past date to the top (Index 0)
            active_links.sort(key=lambda x: x[0], reverse=True)
            best_match = active_links[0]

        print(f"[+] Active Cycle Locked: {best_match[2]}")
        print(f"[+] Target Base URL resolved: {best_match[1]}\n")

        return best_match[1]
