import os
import base64
import json
import firebase_admin
from firebase_admin import credentials, firestore

def init_firebase():
    if not firebase_admin._apps:
        encoded_creds = os.getenv("FIREBASE_CREDENTIALS_BASE64")
        if not encoded_creds:
            local_key_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
            if local_key_path and os.path.exists(local_key_path):
                cred = credentials.Certificate(local_key_path)
            else:
                raise ValueError("Missing FIREBASE_CREDENTIALS_BASE64 environment variable")
        else:
            decoded_creds = base64.b64decode(encoded_creds).decode("utf-8")
            cred_dict = json.loads(decoded_creds)
            cred = credentials.Certificate(cred_dict)
            
        firebase_admin.initialize_app(cred)
    
    return firestore.client()

db = init_firebase()

