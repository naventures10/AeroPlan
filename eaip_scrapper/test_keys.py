import requests
import json
import os

keys = [
    "llx-GgMNMxePYJ9TOEtCHYxlBGNMhd6oaigHQbKFUphwIrzpKSZc",
    "llx-E1PxYwBp8LAtJ8M6JNvhQTtmKHPhC0GFAdK5eypGcuJzUL30",
    "llx-AazmTwfi9O0lfJVjogS1UjISyvtFWtWOBJvS9SUFqgLLnw50",
    "llx-9j8P1MbYh2uSNsTOrNi8Nv8WX6gOBVwQvt4hOXsqShhGyjvX"
]

for i, key in enumerate(keys, 1):
    headers = {"Authorization": f"Bearer {key}"}
    response = requests.get("https://api.cloud.llamaindex.ai/api/parsing/job", headers=headers)
    if response.status_code == 401:
        print(f"Key {i} is INVALID: {key}")
    else:
        print(f"Key {i} is VALID (status {response.status_code})")
