import requests
import re
import json
import urllib3
import concurrent.futures
from pathlib import Path
from bs4 import BeautifulSoup

# Disable insecure request warnings caused by the expired SSL cert
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

MAP_URL = "https://olbs.amsschennai.gov.in/nsweb/FlightBriefing/weathermap/map.php?w=800px&h=600px"
STATION_URL = "https://olbs.amsschennai.gov.in/nsweb/FlightBriefing/weathermap/station.php?icao={}"
OUTPUT_DIR = Path("/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/output")


def get_station_ids():
    print("Fetching station list from map endpoint...")
    response = requests.get(MAP_URL, verify=False)
    response.raise_for_status()

    # The map endpoint returns HTML with inline JS.
    # The stations are hardcoded as window.stationClick("ICAO_CODE");
    matches = re.findall(r'window\.stationClick\("([A-Z0-9]{4})"\)', response.text)

    # Deduplicate and sort
    station_ids = sorted(list(set(matches)))
    print(f"Found {len(station_ids)} unique stations.")
    return station_ids


def fetch_station_data(icao_code):
    try:
        url = STATION_URL.format(icao_code)
        response = requests.get(url, verify=False, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        data = {"icao": icao_code, "metar": None, "taf": []}

        # Structure is roughly: <b>METAR</b><br/> DATA <br/> <b>TAF</b><br/> DATA <br/> <b>TAF</b> ...

        # Extract METAR
        metar_b = soup.find("b", string=re.compile(r"^\s*METAR\s*$", re.IGNORECASE))
        if metar_b:
            metar_text = ""
            current = metar_b.next_sibling
            while current and current.name != "b":
                if isinstance(current, str):
                    metar_text += current.strip() + " "
                current = current.next_sibling

            cleaned_metar = metar_text.strip()
            if cleaned_metar:
                data["metar"] = cleaned_metar

        # Extract all TAFs
        taf_bs = soup.find_all("b", string=re.compile(r"^\s*TAF\s*$", re.IGNORECASE))
        for taf_b in taf_bs:
            taf_text = ""
            current = taf_b.next_sibling
            while current and current.name != "b":
                if isinstance(current, str):
                    taf_text += current.strip() + "\n"
                current = current.next_sibling

            # Clean up empty lines and join
            taf_lines = [line.strip() for line in taf_text.split("\n") if line.strip()]
            if taf_lines:
                data["taf"].append(taf_lines)

        return data

    except Exception as e:
        return {"icao": icao_code, "error": str(e)}


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stations = get_station_ids()

    results = []

    print("\nStarting concurrent fetching for all stations...")
    # Use ThreadPoolExecutor to make concurrent HTTP requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        future_to_icao = {
            executor.submit(fetch_station_data, icao): icao for icao in stations
        }

        for future in concurrent.futures.as_completed(future_to_icao):
            icao = future_to_icao[future]
            try:
                data = future.result()
                results.append(data)

                # Simple progress indicator
                if len(results) % 20 == 0:
                    print(f"Processed {len(results)}/{len(stations)} stations...")
            except Exception as exc:
                print(f"[{icao}] generated an exception: {exc}")

    # Sort results by ICAO to keep output consistent
    results.sort(key=lambda x: x["icao"])

    output_file = OUTPUT_DIR / "weather_data.json"
    print(f"\nWriting results to {output_file}...")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4, ensure_ascii=False)

    print(
        f"Done! Successfully generated JSON payload with {len(results)} weather records."
    )


if __name__ == "__main__":
    main()
