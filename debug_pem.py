import os
import json
from dotenv import load_dotenv

load_dotenv()

key_raw = os.getenv("GEE_PRIVATE_KEY_JSON")
if key_raw:
    data = json.loads(key_raw)
    pk = data.get("private_key", "")
    print(f"PK Length: {len(pk)}")
    # Use repr() without f-string backslash
    print("PK start: " + repr(pk[:60]))
    # Separate checks to avoid backslashes in f-string expressions
    has_slash_n = '\\n' in pk
    has_newline = '\n' in pk
    print(f"Contains \\n: {has_slash_n}")
    print(f"Contains actual newline: {has_newline}")
