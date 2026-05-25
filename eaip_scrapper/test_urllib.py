import urllib.request
import urllib.error

key = "llx-UE2gvScQDvszh92qTqeTIQb2R7kxvZ4TYFbDiTWkTew3Jtff"

req = urllib.request.Request("https://api.cloud.llamaindex.ai/api/parsing/upload", method="POST")
req.add_header("Authorization", f"Bearer {key}")
try:
    urllib.request.urlopen(req)
    print("Key 3 is VALID (auth passed)")
except urllib.error.HTTPError as e:
    if e.code == 401:
        print("Key 3 is INVALID: 401 Unauthorized")
    else:
        print(f"Key 3 is VALID (auth passed, got {e.code})")
