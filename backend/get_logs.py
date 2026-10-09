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

    total_cost_usd = 0.0
    total_cost_pln = 0.0

    costs_by_model = {}

    count = 0
    for doc in docs:
        data = doc.to_dict()
        cost_usd = data.get('cost_usd', 0.0)
        cost_pln = data.get('cost_pln', 0.0)
        model = data.get('model', 'unknown')
        
        total_cost_usd += cost_usd
        total_cost_pln += cost_pln
        
        if model not in costs_by_model:
            costs_by_model[model] = {'usd': 0.0, 'pln': 0.0, 'count': 0}
            
        costs_by_model[model]['usd'] += cost_usd
        costs_by_model[model]['pln'] += cost_pln
        costs_by_model[model]['count'] += 1
        count += 1

    print(f"Total documents found: {count}")
    print(f"Total cost: ${total_cost_usd:.6f} / {total_cost_pln:.6f} PLN")
    print("Breakdown by model:")
    for model, cost in costs_by_model.items():
        print(f"  {model}: ${cost['usd']:.6f} / {cost['pln']:.6f} PLN ({cost['count']} requests)")
except Exception as e:
    print(f"Error: {e}")
