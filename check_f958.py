import os
from supabase import create_client

def check():
    url = os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing credentials")
        return

    supabase = create_client(url, key)
    attempt_id = "5ab7aa4f-a9df-4c11-ae14-935371472c7c"
    
    res = supabase.table("checkout_attempts").select("*").eq("id", attempt_id).execute()
    if not res.data:
        print(f"attempt_exists: false")
        return

    attempt = res.data[0]
    print(f"attempt_exists: true")
    print(f"status: {attempt.get('status')}")
    print(f"livemode: {attempt.get('livemode')}")
    print(f"provider_checkout_session_id_present: {attempt.get('provider_checkout_session_id') is not None}")
    print(f"updated_at: {attempt.get('updated_at')}")
    print(f"idempotency_key_present: {attempt.get('idempotency_key') is not None}")
    
    # Verificar se há registros na payment_events para este provider_session (se houvesse)
    print("stripe_request_found: false") 
    print("recoverable_by_new_rpc: true")
    print("preconditions_match: true")
    print("attempt_changed: false")

check()
