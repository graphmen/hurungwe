import os
import json
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GEE_PRIVATE_KEY_JSON")
print(f"Key Found: {'Yes' if key else 'No'}")
if key:
    print(f"Key Type: {type(key)}")
    print(f"Key Start: {key[:50]}...")
    try:
        data = json.loads(key)
        print("JSON Parse: SUCCESS")
        print(f"Email: {data.get('client_email')}")
    except Exception as e:
        print(f"JSON Parse: FAILED - {str(e)}")
