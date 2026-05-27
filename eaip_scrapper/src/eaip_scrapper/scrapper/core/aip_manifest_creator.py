import re
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup


class AIPManifestCreator:
    def __init__(self, base_url):
        self.base_url = base_url
        # Keeping the TCP connection alive for the duration of the crawler
        self.session = requests.Session()
        self.manifest = []

    def run_discovery(self):
        """
        Orchestrates the dynamic frame navigation to bypass the UI wrappers.
        """
        print(f"[*] Hop 1: Bootstrapping from index -> {self.base_url}")

        # Hop 1: Hit the index, find the toc-frameset shell
        response_1 = self.session.get(self.base_url)
        soup_1 = BeautifulSoup(response_1.text, "html.parser")

        nav_base_frame = soup_1.find("frame", {"name": "eAISNavigationBase"})
        if not nav_base_frame:
            print("[!] Hop 1 Failed: 'eAISNavigationBase' frame not found.")
            return

        # pyrefly: ignore [bad-argument-type]
        toc_url = urljoin(self.base_url, nav_base_frame["src"])
        print(f"[*] Hop 2: Navigating to nested frameset -> {toc_url}")

        # Hop 2: Hit the toc-frameset, find the actual Menu frame
        response_2 = self.session.get(toc_url)
        soup_2 = BeautifulSoup(response_2.text, "html.parser")

        menu_frame = soup_2.find("frame", {"name": "eAISNavigation"})
        if not menu_frame:
            print("[!] Hop 2 Failed: 'eAISNavigation' frame not found.")
            return

        # pyrefly: ignore [bad-argument-type]
        menu_url = urljoin(toc_url, menu_frame["src"])
        print(f"[*] Hop 3: Navigating to final menu -> {menu_url}")

        # Hop 3: Pass the direct menu URL into the parsing engine
        self.extract_aerodromes(menu_url)
        return self.manifest

    def extract_aerodromes(self, menu_url):
        """
        Parses the final menu using strict Regex to build a clean queue.
        """
        response = self.session.get(menu_url)
        soup = BeautifulSoup(response.text, "html.parser")

        # The Regex logic: enforcing "AD 2.1" followed by exactly 4 uppercase letters
        icao_pattern = re.compile(r"AD[ -]?2\.1([A-Z]{4})")
        seen_urls = set()

        links = soup.find_all("a", href=True)

        for link in links:
            raw_href = link["href"]
            raw_text = link.get_text(strip=True)

            # pyrefly: ignore [no-matching-overload]
            match = icao_pattern.search(raw_href)

            if match and "/" in raw_text:
                # Group 1 isolated by Regex is exactly the ICAO code
                icao_code = match.group(1)
                # pyrefly: ignore [bad-argument-type]
                absolute_url = urljoin(menu_url, raw_href)

                # pyrefly: ignore [no-matching-overload]
                safe_href = quote(raw_href)
                absolute_url = urljoin(menu_url, safe_href)

                # The Deduplication Filter
                if absolute_url in seen_urls:
                    continue
                seen_urls.add(absolute_url)

                # The Name Extraction Logic (Splitting "VABB/Mumbai" by "/")
                parts = raw_text.split("/")
                clean_name = parts[1].strip() if len(parts) > 1 else ""

                # Strict Validation
                if not re.match(r"^[A-Z]{4}$", icao_code):
                    import sys

                    print(f"[!] CRITICAL: Invalid ICAO code extracted: '{icao_code}'")
                    sys.exit(1)

                if not clean_name or re.search(r"<[^>]+>", clean_name):
                    import sys

                    print(
                        f"[!] CRITICAL: Invalid Aerodrome name extracted: '{clean_name}' for ICAO {icao_code}"
                    )
                    sys.exit(1)

                self.manifest.append(
                    {
                        "icao": icao_code,
                        "name": clean_name,
                        "source_url": absolute_url,
                        "status": "pending",
                    }
                )
