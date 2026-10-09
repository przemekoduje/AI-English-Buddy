import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

try:
    cred = credentials.Certificate("firebase_service_account.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    start_date = datetime(2026, 10, 5, tzinfo=timezone.utc)
    end_date = datetime(2026, 10, 6, tzinfo=timezone.utc)

    docs = db.collection('api_usage')\
        .where('timestamp', '>=', start_date)\
        .where('timestamp', '<', end_date)\
        .stream()

    count = 0
    for doc in docs:
        data = doc.to_dict()
        if data.get('model') == 'gemini-2.5-flash-native-audio-latest' and data.get('cost_usd', 0) > 0:
            print(data)
            count += 1
            if count >= 3:
                break

except Exception as e:
    print(f"Error: {e}")
