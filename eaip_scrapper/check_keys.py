import asyncio
from llama_parse import LlamaParse
from llama_index.core import SimpleDirectoryReader
import os

keys = [
    "llx-GgMNMxePYJ9TOEtCHYxlBGNMhd6oaigHQbKFUphwIrzpKSZc",
    "llx-E1PxYwBp8LAtJ8M6JNvhQTtmKHPhC0GFAdK5eypGcuJzUL30",
    "llx-AazmTwfi9O0lfJVjogS1UjISyvtFWtWOBJvS9SUFqgLLnw50",
    "llx-9j8P1MbYh2uSNsTOrNi8Nv8WX6gOBVwQvt4hOXsqShhGyjvX"
]

async def check():
    for i, key in enumerate(keys, 1):
        try:
            parser = LlamaParse(api_key=key, result_type="markdown")
            # we just need to try parsing a tiny string or dummy file to see if it auths
            # wait, LlamaParse requires a file path. Let's create a dummy file.
            with open("dummy.txt", "w") as f:
                f.write("test")
            await parser.aload_data("dummy.txt")
            print(f"Key {i} VALID: {key}")
        except Exception as e:
            print(f"Key {i} INVALID: {key} (Error: {e})")

asyncio.run(check())
