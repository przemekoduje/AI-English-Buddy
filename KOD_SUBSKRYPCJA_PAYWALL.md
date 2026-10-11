# Speakling — Kompletny Moduł Subskrypcji, Paywalla i Limitów AI
Wygenerowano: 2026-10-11 22:17:22
> Dedykowany, lekki pakiet kodu dla zewnętrznych modeli AI (ChatGPT, Claude, DeepSeek). Zawiera 100% logiki subskrypcji, Stripe, limitów minut Gemini Live i blokad paywalla bez obcinania.

## Spis Zawartości Pakietu
1. `backend/app.py` — Silnik subskrypcji, plany, Stripe Checkout, Webhooks, Portal, liczniki minut, blokady 403
2. `frontend/src/components/Paywall/PaywallModal.js`
3. `frontend/src/components/Paywall/PaywallModal.css`
4. `frontend/src/services/GeminiLiveClient.js`
5. `frontend/src/components/TopBar.js`
6. `frontend/src/components/Sidebar.js`
7. `frontend/src/App.js`

---

## 1. Plik: `backend/app.py` (Kluczowe sekcje subskrypcji, Stripe i bramek limitów)

```python
# ========================================================
# 1. GŁÓWNY MODUŁ SUBSKRYPCJI, STRIPE, WEBHOOKÓW I LIMITÓW
# (Z pliku backend/app.py: linie 1135-1685)
# ========================================================
# ==========================================
# HYBRID TIERED SUBSCRIPTION & FAIR USAGE SYSTEM
# ==========================================

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
APP_URL = os.getenv("APP_URL", "https://przemokoduje.com/speakling").strip()

if STRIPE_SECRET_KEY:
    try:
        stripe.api_key = STRIPE_SECRET_KEY
    except Exception as stripe_init_err:
        print(f"Błąd inicjalizacji klucza Stripe: {stripe_init_err}")

# Definicje pakietów subskrypcyjnych (Fair Usage Tiered SaaS)
SUBSCRIPTION_PLANS = {
    "starter": {
        "id": "starter",
        "name": "Starter (Free)",
        "price_pln": 0,
        "billing_period": "darmowy na zawsze",
        "live_minutes_limit": 5.0,  # 5 minut demo na start
        "trial_days": 0,
        "can_access_mastery": False,
        "can_access_media": False,
        "can_access_industry_modes": False,
        "can_buy_topup": False,
        "tts_model": "edge_tts",
        "features": [
            "Nieograniczone czytanie historii",
            "Interaktywny słownik (Word Bank)",
            "Fiszki i podstawowe quizy powtórkowe",
            "1 krótka sesja demo Live Chat (5 min na start)",
            "Synteza mowy modelami ekonomicznymi (Edge TTS)"
        ]
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price_pln": 49,
        "billing_period": "49 zł / miesięcznie",
        "live_minutes_limit": 150.0,  # 150 minut Live Orb miesięcznie
        "trial_days": 7,
        "can_access_mastery": True,
        "can_access_media": True,
        "can_access_industry_modes": False,
        "can_buy_topup": True,
        "tts_model": "premium",
        "features": [
            "Wszystko z planu Starter",
            "150 minut rozmów głosowych Live Orb miesięcznie",
            "Pełny dostęp do modułu Mastery Path (3-etapowy trening)",
            "Media Buddy (analiza i nauka z filmami YouTube)",
            "Inteligentne raporty postępów i nielimitowany eksport słownictwa",
            "Wysokiej jakości synteza głosu lektora",
            "7-dniowy darmowy okres próbny (Trial)"
        ]
    },
    "intensive": {
        "id": "intensive",
        "name": "Intensive / Fluency",
        "price_pln": 99,
        "billing_period": "99 zł / miesięcznie",
        "live_minutes_limit": 400.0,  # 400 minut Live Orb miesięcznie
        "trial_days": 7,
        "can_access_mastery": True,
        "can_access_media": True,
        "can_access_industry_modes": True,
        "can_buy_topup": True,
        "tts_model": "premium",
        "features": [
            "Wszystko z planu Pro (Mastery Path + Media Buddy + Eksport)",
            "400 minut rozmów głosowych Live Orb miesięcznie",
            "Dedykowane symulacje branżowe (Business English, Tech Interview)",
            "Opcja dokupienia paczki dodatkowych 60 minut (+29 zł)",
            "Najwyższy priorytet połączeń i najnowsze modele audio",
            "7-dniowy darmowy okres próbny (Trial)"
        ]
    }
}


def get_user_subscription(email):
    """Pobiera lub inicjalizuje stan subskrypcji użytkownika z bazy danych."""
    if not email:
        return {
            "tier": "starter",
            "status": "free",
            "name": SUBSCRIPTION_PLANS["starter"]["name"],
            "live_minutes_used": 0.0,
            "live_minutes_limit": SUBSCRIPTION_PLANS["starter"]["live_minutes_limit"],
            "extra_live_minutes": 0.0,
            "minutes_remaining": SUBSCRIPTION_PLANS["starter"]["live_minutes_limit"],
            "total_minutes_allowed": SUBSCRIPTION_PLANS["starter"]["live_minutes_limit"],
            "can_access_mastery": False,
            "can_access_media": False,
            "can_access_industry_modes": False,
            "can_buy_topup": False,
            "trial_ends_at": None,
            "current_period_end": None,
            "is_admin": False
        }

    admin = is_admin(email)
    user_data = {}
    try:
        user_ref = db.collection('users').document(email).get()
        if user_ref.exists:
            user_data = user_ref.to_dict() or {}
    except Exception as e:
        print(f"Błąd odczytu subskrypcji dla {email}: {e}")

    sub_data = user_data.get('subscription') or {}
    tier = sub_data.get('tier') or ('intensive' if admin else 'starter')
    if tier not in SUBSCRIPTION_PLANS:
        tier = 'starter'

    plan = SUBSCRIPTION_PLANS[tier]
    status = sub_data.get('status') or ('active' if admin else 'free')

    # Sprawdzenie czy 7-dniowy okres próbny nie wygasł
    trial_ends_at = sub_data.get('trial_ends_at')
    if status == 'trialing' and trial_ends_at:
        try:
            t_end = datetime.fromisoformat(trial_ends_at) if isinstance(trial_ends_at, str) else trial_ends_at
            if datetime.utcnow() > t_end and not sub_data.get('stripe_subscription_id'):
                status = 'expired'
                tier = 'starter'
                plan = SUBSCRIPTION_PLANS['starter']
        except Exception as date_err:
            print(f"Błąd parsowania daty końca triala: {date_err}")

    live_minutes_used = float(sub_data.get('live_minutes_used', 0.0))
    extra_live_minutes = float(sub_data.get('extra_live_minutes', 0.0))

    if admin and tier == 'intensive':
        live_minutes_limit = 99999.0
    else:
        live_minutes_limit = float(sub_data.get('live_minutes_limit', plan['live_minutes_limit']))

    total_allowed = live_minutes_limit + extra_live_minutes
    minutes_remaining = max(0.0, round(total_allowed - live_minutes_used, 2))

    return {
        "tier": tier,
        "status": status,
        "name": plan["name"],
        "price_pln": plan["price_pln"],
        "live_minutes_used": round(live_minutes_used, 2),
        "live_minutes_limit": live_minutes_limit,
        "extra_live_minutes": round(extra_live_minutes, 2),
        "minutes_remaining": minutes_remaining,
        "total_minutes_allowed": round(total_allowed, 2),
        "can_access_mastery": plan["can_access_mastery"] or admin,
        "can_access_media": plan["can_access_media"] or admin,
        "can_access_industry_modes": plan["can_access_industry_modes"] or admin,
        "can_buy_topup": plan["can_buy_topup"] or admin,
        "trial_ends_at": str(trial_ends_at) if trial_ends_at else None,
        "current_period_end": str(sub_data.get('current_period_end', '')),
        "stripe_customer_id": sub_data.get('stripe_customer_id'),
        "has_stripe_subscription": bool(sub_data.get('stripe_subscription_id')),
        "processed_sessions": sub_data.get('processed_sessions') or [],
        "is_admin": admin
    }


def update_user_subscription(email, updates):
    """Aktualizuje dane subskrypcyjne użytkownika w bazie."""
    if not email or 'db' not in globals() or db is None:
        return
    try:
        user_ref = db.collection('users').document(email).get()
        user_data = user_ref.to_dict() if user_ref.exists else {}
        sub = user_data.get('subscription') or {}
        sub.update(updates)
        db.collection('users').document(email).set({'subscription': sub}, merge=True)
    except Exception as e:
        print(f"Błąd aktualizacji subskrypcji użytkownika {email}: {e}")


@app.route("/api/subscription/status", methods=['GET'])
def get_subscription_status():
    """Zwraca bieżący stan subskrypcji zalogowanego użytkownika oraz konfigurację planów."""
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({
            "subscription": get_user_subscription(None),
            "plans": SUBSCRIPTION_PLANS,
            "stripe_configured": bool(STRIPE_SECRET_KEY)
        }), 200

    sub = get_user_subscription(user_email)
    return jsonify({
        "subscription": sub,
        "plans": SUBSCRIPTION_PLANS,
        "stripe_configured": bool(STRIPE_SECRET_KEY),
        "stripe_publishable_key": STRIPE_PUBLISHABLE_KEY
    }), 200


@app.route("/api/subscription/track-live-time", methods=['POST'])
def track_subscription_live_time():
    """Śledzi czas trwania sesji Live i odlicza minuty z twardego limitu w czasie rzeczywistym."""
    user_email = get_user_from_request()
    req_data = request.get_json(silent=True) or {}
    if not user_email:
        user_email = req_data.get("user_email") or "guest@speakling.ai"

    seconds = float(req_data.get("duration_seconds", 0) or 0)
    minutes = float(req_data.get("minutes", 0) or 0)
    if seconds > 0:
        minutes += seconds / 60.0

    if minutes <= 0:
        sub = get_user_subscription(user_email)
        return jsonify({
            "success": True,
            "minutes_used": sub["live_minutes_used"],
            "minutes_remaining": sub["minutes_remaining"],
            "quota_exceeded": sub["minutes_remaining"] <= 0
        }), 200

    sub = get_user_subscription(user_email)
    new_used = round(sub.get("live_minutes_used", 0.0) + minutes, 2)
    update_user_subscription(user_email, {"live_minutes_used": new_used})
    
    updated_sub = get_user_subscription(user_email)
    return jsonify({
        "success": True,
        "minutes_used": updated_sub["live_minutes_used"],
        "minutes_remaining": updated_sub["minutes_remaining"],
        "total_minutes_allowed": updated_sub["total_minutes_allowed"],
        "quota_exceeded": updated_sub["minutes_remaining"] <= 0
    }), 200


@app.route("/api/stripe/create-checkout-session", methods=['POST'])
def create_stripe_checkout_session():
    """Tworzy sesję Stripe Checkout dla planu Pro, Intensive (z 7-dniowym trialem) lub doładowania Top-up."""
    user_email = get_user_from_request()
    req_data = request.get_json(silent=True) or {}
    if not user_email:
        user_email = req_data.get("user_email")
    if not user_email:
        return jsonify({"error": "Wymagane zalogowanie, aby rozpocząć subskrypcję."}), 401

    plan = req_data.get("plan", "pro").lower().strip()
    return_url = req_data.get("return_url") or APP_URL
    sub = get_user_subscription(user_email)

    # 1. Sprawdzenie uprawnień do zakupu Top-up (tylko Pro oraz Intensive)
    if plan == "topup_60" and not sub.get("can_buy_topup"):
        return jsonify({
            "error": "Paczka dodatkowych 60 minut jest dostępna dla subskrybentów planu Pro i Intensive. Uaktualnij pakiet, aby móc dokupować minuty."
        }), 400

    # 2. Bezpieczna obsługa przejścia na plan Starter (downgrade)
    if plan == "starter":
        if sub.get("has_stripe_subscription") and STRIPE_SECRET_KEY:
            return jsonify({
                "action_required": "portal",
                "error": "Posiadasz aktywną subskrypcję Stripe. Aby powrócić do planu Starter, anuluj subskrypcję w Portalu Klienta Stripe."
            }), 400
        else:
            update_user_subscription(user_email, {
                "tier": "starter",
                "status": "free",
                "live_minutes_limit": SUBSCRIPTION_PLANS["starter"]["live_minutes_limit"],
                "trial_ends_at": None
            })
            return jsonify({
                "demo_mode": True,
                "success": True,
                "message": "Pomyślnie przełączono na bezpłatny plan Starter.",
                "subscription": get_user_subscription(user_email)
            }), 200

    # Tryb symulacyjny (gdy klucz Stripe nie został skonfigurowany w środowisku produkcyjnym)
    if not STRIPE_SECRET_KEY:
        now = datetime.utcnow()
        if plan == "topup_60":
            current_extra = sub.get("extra_live_minutes", 0.0)
            update_user_subscription(user_email, {
                "extra_live_minutes": current_extra + 60.0
            })
            return jsonify({
                "demo_mode": True,
                "success": True,
                "message": "Pomyślnie dodano 60 minut rozmów Live Orb do Twojego konta!",
                "subscription": get_user_subscription(user_email)
            }), 200
        else:
            target_plan = plan if plan in SUBSCRIPTION_PLANS and plan != "starter" else "pro"
            trial_end = (now + timedelta(days=7)).isoformat()
            limit = SUBSCRIPTION_PLANS[target_plan]["live_minutes_limit"]
            update_user_subscription(user_email, {
                "tier": target_plan,
                "status": "trialing",
                "trial_ends_at": trial_end,
                "live_minutes_limit": limit,
                "billing_cycle_start": now.isoformat()
            })
            return jsonify({
                "demo_mode": True,
                "success": True,
                "message": f"Aktywowano 7-dniowy darmowy okres próbny pakietu {SUBSCRIPTION_PLANS[target_plan]['name']}!",
                "subscription": get_user_subscription(user_email)
            }), 200

    try:
        if plan == "topup_60":
            # Jednorazowa paczka 60 minut (29 zł)
            session = stripe.checkout.Session.create(
                mode="payment",
                customer_email=user_email,
                line_items=[{
                    "price_data": {
                        "currency": "pln",
                        "product_data": {
                            "name": "Paczka dodatkowych 60 minut Live Orb",
                            "description": "Jednorazowe doładowanie 60 minut rozmów z lektorem AI w Speakling"
                        },
                        "unit_amount": 2900  # 29.00 PLN
                    },
                    "quantity": 1
                }],
                metadata={
                    "user_email": user_email,
                    "plan": "topup_60",
                    "extra_minutes": "60"
                },
                success_url=f"{return_url}?payment=success&topup=60&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{return_url}?payment=cancelled"
            )
        else:
            # Subskrypcja z 7-dniowym darmowym okresem próbnym
            target_plan = plan if plan in ["pro", "intensive"] else "pro"
            plan_info = SUBSCRIPTION_PLANS[target_plan]
            unit_amount = plan_info["price_pln"] * 100

            session = stripe.checkout.Session.create(
                mode="subscription",
                customer_email=user_email,
                subscription_data={
                    "trial_period_days": 7
                },
                line_items=[{
                    "price_data": {
                        "currency": "pln",
                        "product_data": {
                            "name": f"Speakling {plan_info['name']}",
                            "description": f"{plan_info['name']} — {plan_info['features'][1]} (7-dniowy darmowy okres próbny)"
                        },
                        "unit_amount": unit_amount,
                        "recurring": {"interval": "month"}
                    },
                    "quantity": 1
                }],
                metadata={
                    "user_email": user_email,
                    "plan": target_plan
                },
                success_url=f"{return_url}?payment=success&plan={target_plan}&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{return_url}?payment=cancelled"
            )

        return jsonify({
            "checkout_url": session.url,
            "session_id": session.id
        }), 200

    except Exception as e:
        print(f"Stripe Checkout Error: {e}")
        return jsonify({"error": f"Błąd tworzenia płatności Stripe: {str(e)}"}), 500


@app.route("/api/stripe/verify-session", methods=['POST'])
def verify_stripe_session():
    """Weryfikuje sesję Checkout po powrocie z bramki Stripe i natychmiast aktywuje pakiet użytkownika."""
    user_email = get_user_from_request()
    req_data = request.get_json(silent=True) or {}
    session_id = req_data.get("session_id", "").strip()

    if not session_id or not STRIPE_SECRET_KEY:
        return jsonify({"success": False, "message": "Brak sesji do weryfikacji"}), 400

    try:
        session = stripe.checkout.Session.retrieve(session_id)
        email = session.metadata.get("user_email") or user_email or (session.customer_details.email if session.customer_details else None)
        plan = session.metadata.get("plan", "pro")

        if email:
            sub = get_user_subscription(email)
            processed = list(sub.get("processed_sessions") or [])

            # Idempotency check: zapobieganie podwójnemu naliczeniu minut (np. verify-session + webhook)
            if session_id in processed:
                print(f"Stripe: Sesja {session_id} została już wcześniej przetworzona dla {email}. Pomijam duplikat.", flush=True)
                return jsonify({
                    "success": True,
                    "already_processed": True,
                    "plan": plan,
                    "subscription": sub
                }), 200

            processed.append(session_id)
            processed = processed[-50:]  # pamiętamy do 50 ostatnich sesji

            now = datetime.utcnow()
            if plan == "topup_60":
                current_extra = sub.get("extra_live_minutes", 0.0)
                update_user_subscription(email, {
                    "extra_live_minutes": current_extra + 60.0,
                    "processed_sessions": processed
                })
            else:
                target_plan = plan if plan in ["pro", "intensive"] else "pro"
                trial_end = (now + timedelta(days=7)).isoformat()
                limit = SUBSCRIPTION_PLANS[target_plan]["live_minutes_limit"]
                update_user_subscription(email, {
                    "tier": target_plan,
                    "status": "trialing" if session.subscription else "active",
                    "trial_ends_at": trial_end,
                    "live_minutes_limit": limit,
                    "stripe_customer_id": session.customer,
                    "stripe_subscription_id": session.subscription,
                    "billing_cycle_start": now.isoformat(),
                    "processed_sessions": processed
                })

            return jsonify({
                "success": True,
                "plan": plan,
                "subscription": get_user_subscription(email)
            }), 200

        return jsonify({"success": False, "error": "Nie odnaleziono adresu email sesji"}), 400

    except Exception as e:
        print(f"Błąd weryfikacji sesji Stripe: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/stripe/create-portal-session", methods=['POST'])
def create_stripe_portal_session():
    """Otwiera Stripe Customer Portal do zarządzania płatnościami, kartą i fakturami."""
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Wymagane zalogowanie"}), 401

    sub = get_user_subscription(user_email)
    customer_id = sub.get("stripe_customer_id")

    if not STRIPE_SECRET_KEY or not customer_id:
        return jsonify({
            "error": "Brak podpiętego klienta Stripe dla tego konta.",
            "message": "Nie odnaleziono aktywnego identyfikatora klienta Stripe. Możesz zarządzać planem bezpośrednio w aplikacji."
        }), 400

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=APP_URL
        )
        return jsonify({"portal_url": portal_session.url}), 200
    except Exception as e:
        print(f"Stripe Portal Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/stripe/webhook", methods=['POST'])
def stripe_webhook():
    """Obsługuje zdarzenia Stripe Webhook (potwierdzenie płatności, odnowienia, anulowanie subskrypcji)."""
    payload = request.data
    sig_header = request.headers.get("Stripe-Signature", "")

    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except Exception as e:
            print(f"Błąd weryfikacji podpisu Stripe Webhook: {e}")
            return jsonify({"error": "Nieprawidłowy podpis"}), 400
    else:
        try:
            event = json.loads(payload.decode('utf-8'))
        except Exception:
            return jsonify({"error": "Nieprawidłowy payload"}), 400

    event_type = event.get("type", "")
    data_object = event.get("data", {}).get("object", {})

    print(f"Stripe Webhook odebrany: {event_type}")

    if event_type == "checkout.session.completed":
        email = data_object.get("metadata", {}).get("user_email") or (data_object.get("customer_details", {}) or {}).get("email")
        plan = data_object.get("metadata", {}).get("plan", "pro")
        customer_id = data_object.get("customer")
        subscription_id = data_object.get("subscription")
        session_id = data_object.get("id")

        if email:
            sub = get_user_subscription(email)
            processed = list(sub.get("processed_sessions") or [])

            # Idempotency check: jeśli sesja została już rozliczona przez verify-session na powrocie
            if session_id and session_id in processed:
                print(f"Stripe Webhook: sesja {session_id} została już przetworzona w verify-session. Pomijam powtórne dodanie minut.", flush=True)
                return jsonify({"received": True, "already_processed": True}), 200

            if session_id:
                processed.append(session_id)
                processed = processed[-50:]

            now = datetime.utcnow()
            if plan == "topup_60":
                current_extra = sub.get("extra_live_minutes", 0.0)
                update_user_subscription(email, {
                    "extra_live_minutes": current_extra + 60.0,
                    "stripe_customer_id": customer_id,
                    "processed_sessions": processed
                })
            else:
                target_plan = plan if plan in ["pro", "intensive"] else "pro"
                trial_end = (now + timedelta(days=7)).isoformat()
                limit = SUBSCRIPTION_PLANS[target_plan]["live_minutes_limit"]
                update_user_subscription(email, {
                    "tier": target_plan,
                    "status": "trialing" if subscription_id else "active",
                    "trial_ends_at": trial_end,
                    "live_minutes_limit": limit,
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": subscription_id,
                    "billing_cycle_start": now.isoformat(),
                    "processed_sessions": processed
                })

    elif event_type in ["customer.subscription.updated", "customer.subscription.deleted"]:
        subscription_id = data_object.get("id")
        customer_id = data_object.get("customer")
        status = data_object.get("status")  # active, trialing, past_due, canceled
        current_period_end = data_object.get("current_period_end")

        # Szukamy użytkownika po stripe_customer_id
        if 'db' in globals() and db is not None and customer_id:
            try:
                users_matching = db.collection('users').where('subscription.stripe_customer_id', '==', customer_id).limit(1).get()
                for u_doc in users_matching:
                    u_email = u_doc.id
                    updates = {"status": status}
                    if current_period_end:


# ========================================================
# 2. BRAMKA PAYWALLA W MODULE MEDIA BUDDY (YouTube)
# (Z pliku backend/app.py: /api/media/transcript)
# ========================================================
                return parts[0] * 3600 + parts[1] * 60 + parts[2]
        except Exception:
            pass
        return 0

    i = 0
    # Dopasowanie ciągów jak "0:03", "00:03", "1:02:03"
    ts_regex = r'^(\d{1,2}:)?\d{1,2}:\d{2}$'
    
    while i < len(lines):
        line = lines[i]
        if re.match(ts_regex, line):
            ts = ts_to_secs(line)
            text_parts = []
            i += 1
            while i < len(lines) and not re.match(ts_regex, lines[i]):

... (dalsza część pobierania napisów)

# ========================================================
# 3. BRAMKA PAYWALLA W MODULE MASTERY PATH (3 kroki)
# (Z pliku backend/app.py: /api/mastery-prepare)
# ========================================================
        3. Opisz krótko i jasno, czym jest ta struktura/czas i w jakich sytuacjach się jej używa, jakbyś tłumaczył to uczącej się osobie.

        Formatuj odpowiedź jako listę JSON, gdzie każdy element to obiekt z kluczami 'title', 'example_sentence', 'explanation'.

        Tekst do analizy:
        "{text}"

        Przykład formatu JSON (tylko dla jednego elementu, ma być ich 3):
        [
          {{
            "title": "Przykład Tytułu Gramatycznego",
            "example_sentence": "Przykład zdania z tekstu.",

... (dalsza część przygotowania etapów treningu)

# ========================================================
# 4. WYMUSZENIE DARMOWEGO EDGE TTS DLA PLANU STARTER
# (Z pliku backend/app.py: generate_tts_base64)
# ========================================================
        tts.write_to_fp(fp)
        return fp.getvalue()
    except Exception as e_gtts:
        print(f"gTTS fallback error: {e_gtts}", flush=True)
        return b""

def generate_gcp_male_tts_bytes(text_to_speak, voice_name="en-US-BrianNeural"):
    if gcp_tts_client:
        try:
            from google.cloud import texttospeech
            is_pl = ('pl-PL' in voice_name or 'Marek' in voice_name or 'Zofia' in voice_name)
            gcp_voice_name = "pl-PL-Wavenet-B" if is_pl else "en-US-Neural2-D"
            lang_code = "pl-PL" if is_pl else "en-US"
            

...

# ========================================================
# 5. TWARDY LIMIT MINUT DLA GEMINI LIVE ORB (KOD 403)
# (Z pliku backend/app.py: /api/live/token)
# ========================================================
        update_user_subscription(user_email, {"live_minutes_used": new_used})
        updated_sub = get_user_subscription(user_email)
    else:
        updated_sub = get_user_subscription(user_email)

    return jsonify({
        "success": True,
        "service": service,
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "duration_seconds": duration_seconds,
        "minutes_used": updated_sub.get("live_minutes_used", 0),
        "minutes_remaining": updated_sub.get("minutes_remaining", 0),
        "quota_exceeded": updated_sub.get("minutes_remaining", 0) <= 0
    }), 200


@app.route("/api/live/save-key", methods=['POST'])
def save_live_key():
    """Zapisuje podany przez użytkownika klucz GEMINI_API_KEY do pliku .env i do pamięci procesu."""
    global GEMINI_API_KEY
    user_email = get_user_from_request()
    if not user_email:
        return jsonify({"error": "Brak autoryzacji"}), 401

    req_data = request.get_json(silent=True) or {}


```

---

## 2. Plik: `frontend/src/components/Paywall/PaywallModal.js`

```javascript
import React, { useState } from 'react';
import { API_BASE_URL } from '../../config';
import './PaywallModal.css';

const PaywallModal = ({
  isOpen,
  onClose,
  user,
  subscription,
  initialReason = null,
  onSubscriptionUpdated = () => {}
}) => {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const currentTier = subscription?.tier || 'starter';
  const minutesUsed = subscription?.live_minutes_used || 0;
  const minutesLimit = subscription?.total_minutes_allowed || subscription?.live_minutes_limit || 5;
  const minutesRemaining = subscription?.minutes_remaining ?? Math.max(0, minutesLimit - minutesUsed);
  const usagePercentage = Math.min(100, Math.round((minutesUsed / Math.max(1, minutesLimit)) * 100));

  const handleSelectPlan = async (planKey) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingPlan(planKey);

    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        },
        body: JSON.stringify({
          plan: planKey,
          user_email: user?.email,
          return_url: window.location.origin + window.location.pathname
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Nie udało się zainicjalizować sesji płatności.');
      }

      if (data.checkout_url) {
        // Prawdziwe przekierowanie do Stripe Checkout (w tym obsługa 7-dniowego triala)
        window.location.href = data.checkout_url;
      } else if (data.demo_mode) {
        // Tryb symulacyjny (gdy brak klucza Stripe API w środowisku)
        setSuccessMsg(data.message || 'Pomyślnie zaktualizowano subskrypcję!');
        if (data.subscription) {
          onSubscriptionUpdated(data.subscription);
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      console.error('Błąd wyboru pakietu:', err);
      setErrorMsg(err.message || 'Wystąpił błąd podczas połączenia z bramką płatności.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleDowngradeToStarter = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (subscription?.has_stripe_subscription) {
      // Posiadacz subskrypcji Stripe musi anulować subskrypcję w portalu klienta
      setSuccessMsg('Otwieram Stripe Customer Portal, aby zarządzać subskrypcją...');
      handleOpenCustomerPortal();
      return;
    }

    setLoadingPlan('starter');
    try {
      const response = await fetch(`${API_BASE_URL}/api/subscription/simulate-activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        },
        body: JSON.stringify({
          tier: 'starter',
          user_email: user?.email
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Nie udało się przełączyć na plan Starter.');
      }

      setSuccessMsg(data.message || 'Pomyślnie przełączono na bezpłatny plan Starter.');
      if (data.subscription) {
        onSubscriptionUpdated(data.subscription);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Błąd podczas przełączania na plan Starter.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleOpenCustomerPortal = async () => {
    setErrorMsg(null);
    setLoadingPlan('portal');

    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': user?.token || ''
        }
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.message || data.error || 'Nie udało się otworzyć portalu klienta.');
      }

      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    } catch (err) {
      setErrorMsg(err.message || 'Brak aktywnego profilu klienta Stripe.');
    } finally {
      setLoadingPlan(null);
    }
  };

  // Kontekstowy nagłówek w zależności od przyczyny wywołania paywalla
  const getContextualHeadline = () => {
    if (initialReason?.feature === 'mastery') {
      return {
        badge: 'ODBLOKUJ MASTERY PATH',
        title: 'Mastery Path wymaga pakietu Pro',
        subtitle: 'Uwolnij pełny potencjał 3-etapowego treningu historii (rozumienie, wymowa, parafraza) z nieograniczonym dostępem.'
      };
    }
    if (initialReason?.feature === 'media') {
      return {
        badge: 'ODBLOKUJ MEDIA BUDDY',
        title: 'Analiza wideo YouTube w pakiecie Pro',
        subtitle: 'Ucz się ze swoich ulubionych filmów, podcastów i wywiadów z natychmiastową transkrypcją i lektorem AI.'
      };
    }
    if (initialReason?.feature === 'quota' || initialReason?.reason === 'quota_exceeded') {
      return {
        badge: 'LIMIT MINUT OSIĄGNIĘTY',
        title: 'Wyczerpano minuty Live Chat Orb',
        subtitle: `Twój limit minut (${minutesLimit} min) w bieżącym okresie został osiągnięty. Wybierz pakiet Pro lub Intensive, aby kontynuować rozmowę!`
      };
    }
    if (initialReason?.feature === 'industry') {
      return {
        badge: 'PAKIET INTENSIVE / FLUENCY',
        title: 'Dedykowane symulacje branżowe',
        subtitle: 'Trenuj Business English, rozmowy kwalifikacyjne i techniczny angielski z 400 minutami lektora Live AI miesięcznie.'
      };
    }
    return {
      badge: 'PLANY & SUBSKRYPCJA',
      title: 'Inwestuj w swoją swobodę mówienia',
      subtitle: 'Przewidywalna subskrypcja z gwarancją bezpieczeństwa budżetowego. Rozpocznij 7-dniowy bezpłatny okres próbny.'
    };
  };

  const headline = getContextualHeadline();

  return (
    <div className="paywall-overlay animate-fade-in" onClick={onClose}>
      <div className="paywall-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Przycisk zamknięcia */}
        <button className="paywall-close-btn" onClick={onClose} title="Zamknij">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Nagłówek modalny */}
        <div className="paywall-header">
          <div className="paywall-badge-pill">
            <span className="badge-sparkle">✨</span>
            <span className="badge-text">{headline.badge}</span>
          </div>
          <h2 className="paywall-title">{headline.title}</h2>
          <p className="paywall-subtitle">{headline.subtitle}</p>

          {/* Wizualny pasek wykorzystania minut Live AI */}
          <div className="paywall-usage-meter">
            <div className="usage-meter-header">
              <span className="usage-meter-label">
                Pula minut Live Chat Orb ({currentTier.toUpperCase()}):
              </span>
              <span className="usage-meter-values">
                <strong>{minutesUsed.toFixed(1)}</strong> z <strong>{minutesLimit} min</strong> ({usagePercentage}%)
              </span>
            </div>
            <div className="usage-meter-track">
              <div 
                className={`usage-meter-fill ${usagePercentage >= 100 ? 'meter-exhausted' : usagePercentage >= 80 ? 'meter-warning' : ''}`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <div className="usage-meter-footer">
              <span>Pozostało: <strong>{minutesRemaining.toFixed(1)} min</strong></span>
              {subscription?.extra_live_minutes > 0 && (
                <span className="extra-mins-tag">W tym doładowania: +{subscription.extra_live_minutes} min</span>
              )}
            </div>
          </div>
        </div>

        {/* Komunikaty błędów i sukcesu */}
        {errorMsg && (
          <div className="paywall-alert paywall-alert-error animate-fade-in">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="paywall-alert paywall-alert-success animate-fade-in">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Siatka pakietów (Tiered SaaS) */}
        <div className="paywall-cards-grid">
          {/* KARTA 1: Starter (Free) */}
          <div className={`paywall-card card-starter ${currentTier === 'starter' ? 'is-current' : ''}`}>
            <div className="card-top">
              <div className="card-tier-label">Starter</div>
              <div className="card-price-row">
                <span className="card-price">0 zł</span>
                <span className="card-period">/ darmowy na zawsze</span>
              </div>
              <p className="card-desc">Dla osób zaczynających naukę z czytaniem i podstawowymi fiszkami.</p>
            </div>

            <ul className="card-features-list">
              <li>
                <span className="check-icon">✓</span>
                <span>Nieograniczone czytanie historii</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Interaktywny słownik (Word Bank)</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Fiszki i quizy powtórkowe</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span><strong>5 minut</strong> demo Live Chat (Orb)</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Ekonomiczna synteza mowy (Edge TTS)</span>
              </li>
              <li className="feature-disabled">
                <span className="cross-icon">✕</span>
                <span>Mastery Path & Media Buddy</span>
              </li>
            </ul>

            <div className="card-action">
              {currentTier === 'starter' ? (
                <button className="plan-btn btn-current" disabled>
                  Twój obecny plan
                </button>
              ) : (
                <button 
                  className="plan-btn btn-secondary"
                  disabled={loadingPlan !== null}
                  onClick={handleDowngradeToStarter}
                >
                  {loadingPlan === 'starter' ? (
                    <span className="spinner-inline" />
                  ) : (
                    'Przełącz na Starter'
                  )}
                </button>
              )}
            </div>
          </div>

          {/* KARTA 2: Pro (Rekomendowany) */}
          <div className={`paywall-card card-pro highlighted-card ${currentTier === 'pro' ? 'is-current' : ''}`}>
            <div className="card-ribbon">
              <span>NAJPOPULARNIEJSZY · 7 DNI FREE</span>
            </div>

            <div className="card-top">
              <div className="card-tier-label">Pro</div>
              <div className="card-price-row">
                <span className="card-price">49 zł</span>
                <span className="card-period">/ miesięcznie</span>
              </div>
              <p className="card-desc">Pełny zestaw narzędzi edukacyjnych i codzienna swoboda mówienia.</p>
            </div>

            <ul className="card-features-list">
              <li>
                <span className="check-icon check-purple">✓</span>
                <span><strong>150 minut</strong> Live Chat Orb miesięcznie</span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span>Pełny dostęp do <strong>Mastery Path</strong></span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span><strong>Media Buddy</strong> (filmy i YouTube)</span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span>Inteligentne raporty & eksport słownictwa</span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span>Wysokiej jakości synteza głosu lektora</span>
              </li>
              <li>
                <span className="check-icon check-purple">✓</span>
                <span><strong>7 dni darmowego okresu próbnego</strong></span>
              </li>
            </ul>

            <div className="card-action">
              {currentTier === 'pro' ? (
                <button className="plan-btn btn-current" disabled>
                  Twój obecny plan (Pro)
                </button>
              ) : (
                <button 
                  className="plan-btn btn-primary-pro"
                  disabled={loadingPlan !== null}
                  onClick={() => handleSelectPlan('pro')}
                >
                  {loadingPlan === 'pro' ? (
                    <span className="spinner-inline" />
                  ) : (
                    'Wypróbuj 7 dni bezpłatnie'
                  )}
                </button>
              )}
            </div>
          </div>

          {/* KARTA 3: Intensive / Fluency */}
          <div className={`paywall-card card-intensive ${currentTier === 'intensive' ? 'is-current' : ''}`}>
            <div className="card-top">
              <div className="card-tier-label">Intensive / Fluency</div>
              <div className="card-price-row">
                <span className="card-price">99 zł</span>
                <span className="card-period">/ miesięcznie</span>
              </div>
              <p className="card-desc">Dla profesjonalistów dążących do natychmiastowej płynności językowej.</p>
            </div>

            <ul className="card-features-list">
              <li>
                <span className="check-icon check-blue">✓</span>
                <span><strong>400 minut</strong> Live Chat Orb miesięcznie</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span>Wszystko z planu Pro (Mastery + Media)</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span><strong>Symulacje branżowe</strong> (Business English, Tech)</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span>Opcja dokupienia paczki <strong>+60 min</strong> (+29 zł)</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span>Priorytetowe połączenia i najnowsze modele audio</span>
              </li>
              <li>
                <span className="check-icon check-blue">✓</span>
                <span><strong>7 dni darmowego okresu próbnego</strong></span>
              </li>
            </ul>

            <div className="card-action">
              {currentTier === 'intensive' ? (
                <button className="plan-btn btn-current" disabled>
                  Twój obecny plan (Intensive)
                </button>
              ) : (
                <button 
                  className="plan-btn btn-primary-intensive"
                  disabled={loadingPlan !== null}
                  onClick={() => handleSelectPlan('intensive')}
                >
                  {loadingPlan === 'intensive' ? (
                    <span className="spinner-inline" />
                  ) : (
                    'Wybierz Intensive (7 dni free)'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dolna sekcja: Doładowanie dodatkowych minut (Top-up) oraz Customer Portal */}
        <div className="paywall-bottom-addons">
          <div className="addon-card glass-subpanel">
            <div className="addon-info">
              <div className="addon-title-row">
                <span className="addon-icon">⚡</span>
                <span className="addon-title">Paczka dodatkowych 60 minut Live Orb</span>
                <span className="addon-price">29 zł jednorazowo</span>
              </div>
              <p className="addon-desc">
                {currentTier === 'starter'
                  ? 'Paczka dodatkowych minut jest dostępna dla subskrybentów planu Pro i Intensive. Uaktualnij pakiet, aby móc dokupować dodatkowy czas.'
                  : 'Zabrakło Ci minut przed końcem miesiąca? Dokup jednorazowy pakiet 60 minut bez zmiany obecnej subskrypcji.'}
              </p>
            </div>
            {currentTier === 'starter' ? (
              <button 
                className="addon-buy-btn addon-btn-upgrade"
                disabled={loadingPlan !== null}
                onClick={() => handleSelectPlan('pro')}
              >
                Odblokuj w pakiecie Pro
              </button>
            ) : (
              <button 
                className="addon-buy-btn"
                disabled={loadingPlan !== null}
                onClick={() => handleSelectPlan('topup_60')}
              >
                {loadingPlan === 'topup_60' ? (
                  <span className="spinner-inline" />
                ) : (
                  'Dokup +60 min (29 zł)'
                )}
              </button>
            )}
          </div>

          {subscription?.has_stripe_subscription && (
            <div className="portal-management-row">
              <span>Chcesz zmienić kartę płatniczą lub pobrać faktury VAT?</span>
              <button 
                className="portal-link-btn" 
                onClick={handleOpenCustomerPortal}
                disabled={loadingPlan === 'portal'}
              >
                {loadingPlan === 'portal' ? 'Ładowanie portalu...' : 'Otwórz Stripe Customer Portal →'}
              </button>
            </div>
          )}
        </div>

        {/* Informacja prawna i gwarancja */}
        <div className="paywall-footer-note">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>
            Bezpieczna autoryzacja Stripe. 7-dniowy okres próbny — karta nie zostanie obciążona przed upływem 7 dni. Możesz anulować w dowolnym momencie bez opłat.
          </span>
        </div>
      </div>
    </div>
  );
};

export default PaywallModal;

```

---

## 3. Plik: `frontend/src/components/Paywall/PaywallModal.css`

```css
/* ========================================================
   Speakling Paywall Modal Styles
   Design: Apple-clean, glassmorphism, accent #7c3aed
   ======================================================== */

.paywall-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  overflow-y: auto;
}

.paywall-modal {
  position: relative;
  width: 100%;
  max-width: 1040px;
  max-height: 92vh;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.06);
  padding: 2.25rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Przycisk zamknięcia */
.paywall-close-btn {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #f8fafc;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.paywall-close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
  transform: scale(1.05);
}

/* Nagłówek */
.paywall-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.paywall-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.2);
  color: #7c3aed;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.paywall-title {
  margin: 0;
  font-family: 'Outfit', 'Google Sans', -apple-system, sans-serif;
  font-size: 1.85rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.paywall-subtitle {
  margin: 0;
  font-size: 0.95rem;
  color: #64748b;
  max-width: 680px;
  line-height: 1.5;
}

/* Wskaźnik zużycia minut */
.paywall-usage-meter {
  width: 100%;
  max-width: 580px;
  margin-top: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.85rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.usage-meter-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #475569;
}

.usage-meter-track {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.usage-meter-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7c3aed, #9333ea);
  transition: width 0.4s ease;
}

.usage-meter-fill.meter-warning {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.usage-meter-fill.meter-exhausted {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.usage-meter-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #64748b;
}

.extra-mins-tag {
  color: #059669;
  font-weight: 600;
}

/* Alerty */
.paywall-alert {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.88rem;
  font-weight: 500;
}

.paywall-alert-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.paywall-alert-success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
}

/* Siatka kart planów */
.paywall-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-top: 0.25rem;
}

.paywall-card {
  position: relative;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 1.5rem 1.35rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.paywall-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 28px -8px rgba(0, 0, 0, 0.08);
}

.paywall-card.is-current {
  border-color: #cbd5e1;
  background: #f8fafc;
}

/* Wyróżniony plan PRO */
.paywall-card.highlighted-card {
  border: 2px solid #7c3aed;
  box-shadow: 0 16px 36px -10px rgba(124, 58, 237, 0.22);
  background: linear-gradient(180deg, rgba(124, 58, 237, 0.02) 0%, #ffffff 100%);
}

.card-ribbon {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #7c3aed, #9333ea);
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.85rem;
  border-radius: 9999px;
  white-space: nowrap;
  box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3);
}

.card-top {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.card-tier-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.highlighted-card .card-tier-label {
  color: #7c3aed;
}

.card-price-row {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.card-price {
  font-family: 'Outfit', -apple-system, sans-serif;
  font-size: 2.1rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.03em;
}

.card-period {
  font-size: 0.82rem;
  color: #64748b;
}

.card-desc {
  font-size: 0.82rem;
  color: #64748b;
  margin: 0 0 0.75rem 0;
  min-height: 38px;
  line-height: 1.4;
}

/* Lista cech */
.card-features-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 1.25rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  border-top: 1px solid #f1f5f9;
  padding-top: 0.9rem;
}

.card-features-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  font-size: 0.82rem;
  color: #334155;
  line-height: 1.35;
}

.card-features-list li strong {
  color: #0f172a;
}

.check-icon {
  font-weight: 800;
  color: #10b981;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.check-purple {
  color: #7c3aed;
}

.check-blue {
  color: #2563eb;
}

.cross-icon {
  color: #cbd5e1;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.feature-disabled {
  color: #94a3b8 !important;
  text-decoration: line-through;
}

/* Przyciski w kartach */
.card-action {
  margin-top: auto;
}

.plan-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
}

.btn-current {
  background: #f1f5f9;
  color: #64748b;
  cursor: default;
}

.btn-secondary {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #cbd5e1;
}

.btn-secondary:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.btn-primary-pro {
  background: linear-gradient(135deg, #7c3aed, #9333ea);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
}

.btn-primary-pro:hover {
  background: linear-gradient(135deg, #6d28d9, #7e22ce);
  box-shadow: 0 6px 18px rgba(124, 58, 237, 0.45);
  transform: translateY(-1px);
}

.btn-primary-intensive {
  background: linear-gradient(135deg, #1e293b, #0f172a);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.25);
}

.btn-primary-intensive:hover {
  background: linear-gradient(135deg, #0f172a, #020617);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.35);
  transform: translateY(-1px);
}

/* Dolne doładowania */
.paywall-bottom-addons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.addon-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 0.95rem 1.25rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
}

.addon-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.addon-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.addon-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: #0f172a;
}

.addon-price {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  background: #e2e8f0;
  color: #334155;
}

.addon-desc {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0;
}

.addon-buy-btn {
  white-space: nowrap;
  padding: 0.6rem 1.1rem;
  border-radius: 10px;
  border: 1px solid #7c3aed;
  background: rgba(124, 58, 237, 0.05);
  color: #7c3aed;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.addon-buy-btn:hover {
  background: #7c3aed;
  color: #ffffff;
}

.portal-management-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.82rem;
  color: #64748b;
  padding: 0.25rem 0.5rem;
}

.portal-link-btn {
  background: none;
  border: none;
  color: #7c3aed;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.portal-link-btn:hover {
  color: #5b21b6;
}

/* Stopka modalna */
.paywall-footer-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-align: center;
  font-size: 0.78rem;
  color: #94a3b8;
  padding-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

/* Spinner */
.spinner-inline {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsywność */
@media (max-width: 900px) {
  .paywall-cards-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .paywall-modal {
    padding: 1.5rem 1.25rem;
    max-height: 95vh;
  }

  .addon-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .addon-buy-btn {
    width: 100%;
  }

  .portal-management-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
  }
}

```

---

## 4. Plik: `frontend/src/services/GeminiLiveClient.js`

```javascript
/**
 * GeminiLiveClient.js
 * 
 * Klient połączenia czasu rzeczywistego (WebSockets + Web Audio API) dla technologii 
 * Gemini Multimodal Live API (Google AI Studio oraz Vertex AI / Google Cloud Platform).
 * 
 * Cechy:
 * - Dwukierunkowe strumieniowanie audio PCM 16kHz (Linear PCM 16-bit little-endian)
 * - Bezszwowe odtwarzanie dźwięku z Gemini (PCM 24kHz) z minimalnym opóźnieniem
 * - Błyskawiczne przerywanie mowy lektora (Barge-in / Interruption handling)
 * - Przekazywanie poziomów głośności RMS do animacji Orba (user i bot)
 * - Wsparcie dla wielomodalności (Multimodal Vision: wysyłanie klatek wideo z kamery/ekranu)
 * - Śledzenie transkrypcji na żywo
 */
import { API_BASE_URL } from '../config';

export class GeminiLiveClient {
  constructor(options = {}) {
    this.provider = options.provider || 'google_ai_studio'; // 'google_ai_studio' | 'vertex_ai'
    this.apiKey = options.apiKey || '';
    this.token = options.token || '';
    this.wsUrl = options.wsUrl || '';
    this.model = options.model || 'gemini-2.5-flash-native-audio-latest';
    this.voiceName = options.voiceName || 'Puck'; // Puck, Charon, Kore, Fenrir, Aoede
    this.systemInstruction = options.systemInstruction || 
      "You are Speakling, an enthusiastic, friendly and warm native English tutor. Your goal is to help the student practice speaking English naturally. Keep your spoken responses concise, conversational, and encouraging, giving the student plenty of speaking time. Speak with a natural, friendly tone.";
    this.initialGreetingPrompt = options.initialGreetingPrompt || null;

    // Callbacks
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onBotSpeaking = options.onBotSpeaking || (() => {});
    this.onUserVolume = options.onUserVolume || (() => {});
    this.onBotVolume = options.onBotVolume || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onQuotaExceeded = options.onQuotaExceeded || (() => {});
    this.onRemainingTimeWarning = options.onRemainingTimeWarning || (() => {});
    this.maxDurationSeconds = typeof options.maxDurationSeconds === 'number' ? options.maxDurationSeconds : null;
    this.quotaTicker = null;
    this.warningGiven = false;

    // WebSocket
    this.ws = null;
    this.isConnected = false;

    // Web Audio Input (Mikrofon)
    this.inputAudioContext = null;
    this.mediaStream = null;
    this.audioSourceNode = null;
    this.scriptProcessorNode = null;
    this.speechRecognition = null;
    this.lastUserTranscript = '';
    this.savedTurnPrefixText = '';
    this.userTurnStartIndex = 0;
    this.lastSpeechResultLength = 0;
    this.isDestroyed = false;

    // Web Audio Output (Odtwarzanie Gemini)
    this.outputAudioContext = null;
    this.audioQueue = [];
    this.scheduledSources = [];
    this.nextPlayTime = 0;
    this.isBotCurrentlySpeaking = false;
    this.checkSpeakingInterval = null;

    // Multimodal Video (Kamera)
    this.videoStream = null;
    this.videoFrameInterval = null;
    this.videoElement = null;

    this.apiBaseUrl = options.apiBaseUrl || (typeof window !== 'undefined' && window.location.origin.includes('localhost') ? 'http://localhost:5001' : (API_BASE_URL || ''));
    this.sessionToken = options.sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
    this.userEmail = options.userEmail || null;

    // Monitorowanie kosztów i zużycia tokenów Gemini Live
    this.sessionStartTime = null;
    this.sessionPromptTokens = 0;
    this.sessionCompletionTokens = 0;
    this.maxSeenTokens = 0;
    this.usageReported = false;

    // Bufor aktualnej wypowiedzi lektora
    this.currentBotTurnText = '';
    this.currentTurnAudioChunks = [];
    this.botTurnStarted = false;

    // Ochrona przed echem akustycznym z głośników komputera (bez słuchawek)
    this.lastBotSpeakingEndTime = 0;
    this.recentBotPhrases = [];
  }

  /**
   * Nawiązuje połączenie z Gemini Live API
   */
  async connect() {
    this.onStatusChange('connecting');

    try {
      // 1. Odblokowujemy Web Audio Output natychmiast w ramach bezpośredniego gestu użytkownika (kliknięcie Orb)
      await this.initOutputAudio();

      // 2. Ustalenie docelowego adresu WebSocket
      const url = this.buildWebSocketUrl();
      if (!url) {
        throw new Error("Brak prawidłowego adresu WebSocket lub klucza uwierzytelniającego.");
      }

      console.log(`[GeminiLive] Łączenie z WebSocket (${this.provider})...`);
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        console.log("[GeminiLive] Połączenie WebSocket otwarte. Wysyłam ramkę setup...");
        this.sessionStartTime = Date.now();
        this.usageReported = false;
        this.sendSetupFrame();
        this.isConnected = true;

        // Inicjalizacja mikrofonu
        await this.initInputAudio();

        this.onStatusChange('listening');

        // Rozpoczęcie trackera twardego limitu czasu sesji
        if (this.quotaTicker) clearInterval(this.quotaTicker);
        this.quotaTicker = setInterval(async () => {
          if (!this.isConnected || !this.sessionStartTime || this.isDestroyed) return;
          const elapsedSec = Math.round((Date.now() - this.sessionStartTime) / 1000);

          if (this.maxDurationSeconds !== null) {
            const remaining = this.maxDurationSeconds - elapsedSec;
            if (remaining <= 60 && remaining > 0 && !this.warningGiven) {
              this.warningGiven = true;
              this.onRemainingTimeWarning(remaining);
            }
            if (remaining <= 0) {
              console.warn("[GeminiLive] Osiągnięto limit minut sesji Live AI.");
              clearInterval(this.quotaTicker);
              this.quotaTicker = null;
              this.onQuotaExceeded({
                elapsedSeconds: elapsedSec,
                reason: "Twój limit minut sesji Live AI został wyczerpany."
              });
              this.cleanup();
              return;
            }
          }

          // Co 30 sekund synchronizuj z backendem
          if (elapsedSec > 0 && elapsedSec % 30 === 0) {
            try {
              const res = await fetch(`${this.apiBaseUrl}/api/subscription/track-live-time`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Session-Token': this.sessionToken || ''
                },
                body: JSON.stringify({
                  duration_seconds: 30,
                  user_email: this.userEmail
                })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.quota_exceeded) {
                  console.warn("[GeminiLive] Backend zgłosił wyczerpanie limitu minut!");
                  clearInterval(this.quotaTicker);
                  this.quotaTicker = null;
                  this.onQuotaExceeded({
                    elapsedSeconds: elapsedSec,
                    reason: "Twój limit minut sesji Live AI został wyczerpany."
                  });
                  this.cleanup();
                }
              }
            } catch (err) {
              // Błąd sieci przy pingu - nie przerywamy natychmiast
            }
          }
        }, 1000);
      };

      this.ws.onmessage = async (event) => {
        await this.handleServerMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.error("[GeminiLive] Błąd WebSocket:", err);
        this.onError("Błąd połączenia WebSocket z Gemini Live.");
      };

      this.ws.onclose = (event) => {
        console.log(`[GeminiLive] WebSocket zamknięty (kod: ${event.code}, powód: ${event.reason})`);
        this.cleanup();
        this.isConnected = false;

        if (event.code !== 1000 && event.code !== 1005) {
          let friendlyReason = "";
          if (event.reason && (event.reason.includes("invalid authentication") || event.code === 1008)) {
            friendlyReason = "Invalid Google AI Studio API Key. Please paste a valid API key (starting with AIzaSy) in Settings or switch to Classic Mode (OpenAI).";
          } else if (event.reason) {
            friendlyReason = `Google AI Studio: ${event.reason} (code ${event.code})`;
          } else if (event.code === 1008) {
            friendlyReason = "Google AI Studio rejected connection (code 1008). Please check your Google AI Studio API key in Settings or switch to OpenAI mode.";
          } else if (event.code === 1007) {
            friendlyReason = "Google AI Studio reported data format or unsupported model error (code 1007).";
          } else if (event.code === 1006) {
            friendlyReason = "Gemini Live WebSocket connection closed unexpectedly (code 1006). Please verify your API key.";
          } else {
            friendlyReason = `Gemini Live connection closed (code ${event.code}).`;
          }
          this.onError(friendlyReason);
        }

        this.onClose(event);
        this.onStatusChange('inactive');
      };

    } catch (err) {
      console.error("[GeminiLive] Inicjalizacja nie powiodła się:", err);
      this.cleanup();
      this.onError(err.message || "Nie udało się połączyć z Gemini Live.");
      this.onStatusChange('inactive');
    }
  }

  /**
   * Buduje adres WebSocket zależnie od wybranego dostawcy
   */
  buildWebSocketUrl() {
    if (this.wsUrl) {
      if (this.wsUrl.includes("BidiGenerateContentConstrained") && this.wsUrl.includes("?key=")) {
        return this.wsUrl.replace("?key=", "?access_token=");
      }
      return this.wsUrl;
    }

    if (this.provider === 'google_ai_studio') {
      if (this.token) {
        return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(this.token)}`;
      }
      if (this.apiKey) {
        return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.apiKey)}`;
      }
    }

    if (this.provider === 'vertex_ai' && this.token) {
      const region = 'us-central1';
      return `wss://${region}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent?access_token=${encodeURIComponent(this.token)}`;
    }

    return null;
  }

  /**
   * Wysyła wstępną konfigurację sesji (BidiGenerateContentSetup)
   */
  sendSetupFrame() {
    const formattedModel = this.model.startsWith('models/') ? this.model : `models/${this.model}`;

    const setupMessage = {
      setup: {
        model: formattedModel,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voiceName || "Puck"
              }
            }
          }
        },
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [
            {
              text: this.systemInstruction
            }
          ]
        }
      }
    };

    this.sendJson(setupMessage);
  }

  /**
   * Inicjalizuje odtwarzanie dźwięku z Gemini (PCM 24 kHz)
   */
  async initOutputAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.outputAudioContext || this.outputAudioContext.state === 'closed') {
        this.outputAudioContext = new AudioContextClass();
      }
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
      }
      this.nextPlayTime = this.outputAudioContext.currentTime;

      if (!this.outputGainNode) {
        this.outputGainNode = this.outputAudioContext.createGain();
        this.outputGainNode.gain.value = 1.0;
        this.outputGainNode.connect(this.outputAudioContext.destination);
      }

      if (!this.checkSpeakingInterval) {
        // Monitorowanie czy lektor wciąż mówi
        this.checkSpeakingInterval = setInterval(() => {
          if (this.outputAudioContext) {
            const isSpeaking = this.outputAudioContext.currentTime < this.nextPlayTime - 0.05;
            if (isSpeaking !== this.isBotCurrentlySpeaking) {
              if (this.isBotCurrentlySpeaking && !isSpeaking) {
                // Lektor właśnie skończył mówić - zapisujemy czas zakończenia dla okna tłumienia echa i resetujemy indeks tury ucznia
                this.lastBotSpeakingEndTime = Date.now();
                this.resetUserTurnIndex();
              }
              this.isBotCurrentlySpeaking = isSpeaking;
              this.onBotSpeaking(isSpeaking);
            }
          }
        }, 80);
      }
    } catch (e) {
      console.warn("[GeminiLive] Błąd inicjalizacji odtwarzania audio:", e);
    }
  }

  /**
   * Sprawdza czy aktywna jest ochrona przed echem akustycznym (lektor mówi lub dźwięk z głośników właśnie wygasł)
   */
  isEchoSuppressionActive() {
    if (this.isBotCurrentlySpeaking) return true;
    if (Date.now() - (this.lastBotSpeakingEndTime || 0) < 650) return true;
    return false;
  }

  /**
   * Sprawdza czy dany tekst z SpeechRecognition jest echem ostatnich słów wypowiedzianych przez lektora
   */
  isMatchingRecentBotText(userText) {
    if (!userText || this.recentBotPhrases.length === 0) return false;
    const cleanUser = userText.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
    if (!cleanUser || cleanUser.length < 3) return false;

    const userWords = cleanUser.split(/\s+/).filter(w => w.length > 2);
    if (userWords.length === 0) return false;

    for (const phrase of this.recentBotPhrases) {
      const cleanBot = phrase.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
      if (cleanBot.includes(cleanUser) || cleanUser.includes(cleanBot)) {
        return true;
      }
      const botWords = new Set(cleanBot.split(/\s+/));
      let matchCount = 0;
      for (const w of userWords) {
        if (botWords.has(w)) matchCount++;
      }
      if (matchCount / userWords.length >= 0.6) {
        return true;
      }
    }
    return false;
  }

  /**
   * Inicjalizuje mikrofon i konwersję do 16kHz PCM Little-Endian
   */
  async initInputAudio() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.inputAudioContext = new AudioContextClass();
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
      }

      this.audioSourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream);

      // Używamy bufora 2048 próbek (około 40-50ms)
      const bufferSize = 2048;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(bufferSize, 1, 1);

      // Wyciszamy bezpośrednie wyjście mikrofonu na głośniki za pomocą GainNode o wzmocnieniu 0
      this.inputMuteGain = this.inputAudioContext.createGain();
      this.inputMuteGain.gain.value = 0;

      this.audioSourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputMuteGain);
      this.inputMuteGain.connect(this.inputAudioContext.destination);

      const targetSampleRate = 16000;
      const nativeSampleRate = this.inputAudioContext.sampleRate;

      this.scriptProcessorNode.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Obliczanie poziomu RMS głośności mowy użytkownika
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        // Ochrona przed echem akustycznym bez słuchawek:
        // Kiedy lektor mówi przez głośniki komputera, mikrofon wyłapuje jego głos.
        if (this.isEchoSuppressionActive()) {
          // Jeśli uczeń celowo mówi głośno ponad dźwiękiem z głośników -> wtrącenie (Barge-in)
          if (rms > 0.18) {
            console.log("[GeminiLive] Wykryto głośne wtrącenie użytkownika (Barge-in). Zatrzymuję lektora.");
            this.stopBotAudio();
          } else {
            // Wyciszamy wskaźnik orba i nie wysyłamy echa lektora z powrotem do Gemini Live
            this.onUserVolume(0);
            return;
          }
        }

        this.onUserVolume(rms);

        // Resampling do 16000 Hz, jeśli natywna częstotliwość karty dźwiękowej jest inna (np. 44100 / 48000 Hz)
        const resampledData = this.resampleAudio(inputData, nativeSampleRate, targetSampleRate);

        // Konwersja do 16-bit PCM Little Endian
        const pcm16Buffer = this.floatTo16BitPCM(resampledData);

        // Konwersja na Base64
        const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

        // Wysłanie paczki audio do Gemini Live
        const realtimeAudioMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }
            ]
          }
        };

        this.sendJson(realtimeAudioMessage);
      };

      // Inicjalizacja pomocniczego rozpoznawania mowy dla podglądu transkrypcji ucznia
      this.initSpeechRecognition();

    } catch (err) {
      console.error("[GeminiLive] Błąd konfiguracji mikrofonu:", err);
      throw new Error("Brak dostępu do mikrofonu: " + err.message);
    }
  }

  resetUserTurnIndex() {
    this.userTurnStartIndex = this.lastSpeechResultLength || 0;
    this.savedTurnPrefixText = '';
    this.lastUserTranscript = '';
  }

  /**
   * Pomocnicze rozpoznawanie mowy przeglądarki (do zapisu słów ucznia w transkrypcji)
   */
  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    this.userTurnStartIndex = 0;
    this.savedTurnPrefixText = '';
    this.lastSpeechResultLength = 0;
    this.lastUserTranscript = '';

    const startRec = () => {
      if (this.isDestroyed || !this.isConnected) return;

      try {
        if (this.speechRecognition) {
          try {
            this.speechRecognition.onresult = null;
            this.speechRecognition.onend = null;
            this.speechRecognition.onerror = null;
            this.speechRecognition.abort();
          } catch (e) {}
          this.speechRecognition = null;
        }

        const rec = new SpeechRec();
        this.speechRecognition = rec;
        rec.lang = 'en-US';
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = (event) => {
          if (!event || !event.results) return;
          this.lastSpeechResultLength = event.results.length;

          // Ochrona przed echem akustycznym bez słuchawek:
          // Jeśli lektor mówi lub dźwięk z głośników właśnie wygasł, odrzucamy dźwięk
          if (this.isEchoSuppressionActive()) {
            return;
          }

          // Jeśli Chrome zresetował wyniki (nowa sesja po onend), zerujemy userTurnStartIndex
          if (event.results.length < this.userTurnStartIndex) {
            this.userTurnStartIndex = 0;
          }

          let sessionText = '';
          let hasFinal = false;

          const startIdx = Math.min(this.userTurnStartIndex || 0, event.results.length);
          for (let i = startIdx; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              hasFinal = true;
            }
            if (res[0] && res[0].transcript) {
              sessionText += res[0].transcript + ' ';
            }
          }

          const combined = [this.savedTurnPrefixText, sessionText]
            .map((s) => (s ? s.trim() : ''))
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (!combined) return;

          // Odrzucenie echa lektora, jeśli treść pokrywa się ze słowami wypowiedzianymi przez bota
          if (this.isMatchingRecentBotText(combined)) {
            return;
          }

          if (combined !== this.lastUserTranscript) {
            this.lastUserTranscript = combined;
            this.onTranscript({
              sender: 'user',
              text: combined,
              isFinal: hasFinal
            });
          }
        };

        rec.onend = () => {
          // Po automatycznym zatrzymaniu przez przeglądarkę (np. po milczeniu/pauzie):
          // Zapisujemy dotychczas wygenerowany tekst tury w savedTurnPrefixText
          if (this.lastUserTranscript && this.lastUserTranscript.trim()) {
            this.savedTurnPrefixText = this.lastUserTranscript.trim();
          }
          this.userTurnStartIndex = 0;

          // Auto-restart jeśli połączenie jest aktywne, klient nie został zniszczony i lektor nie mówi
          if (this.isConnected && !this.isDestroyed && !this.isBotCurrentlySpeaking) {
            setTimeout(() => {
              if (this.isConnected && !this.isDestroyed && !this.isBotCurrentlySpeaking) {
                startRec();
              }
            }, 100);
          }
        };

        rec.onerror = (e) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn("[GeminiLive] SpeechRecognition info:", e.error);
          }
        };

        rec.start();
      } catch (e) {
        console.warn("[GeminiLive] Nie udało się wystartować lokalnego SpeechRecognition:", e);
      }
    };

    startRec();
  }

  /**
   * Obsługa przychodzących wiadomości z Gemini Live API
   */
  async handleServerMessage(rawData) {
    let message;
    try {
      if (typeof rawData === 'string') {
        message = JSON.parse(rawData);
      } else if (rawData instanceof Blob) {
        const text = await rawData.text();
        message = JSON.parse(text);
      } else if (rawData instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(rawData);
        message = JSON.parse(text);
      }
    } catch (e) {
      console.warn("[GeminiLive] Błąd parsowania ramki JSON:", e);
      return;
    }

    if (!message) return;

    // Monitorowanie zużycia tokenów Gemini Live (usageMetadata)
    const usage = message.usageMetadata || (message.serverContent && message.serverContent.usageMetadata);
    if (usage) {
      const pTokens = usage.promptTokenCount || 0;
      const cTokens = usage.candidatesTokenCount || 0;
      const tTokens = usage.totalTokenCount || (pTokens + cTokens);
      if (tTokens > 0) {
        if (tTokens >= this.maxSeenTokens) {
          this.sessionPromptTokens = pTokens;
          this.sessionCompletionTokens = cTokens;
          this.maxSeenTokens = tTokens;
        } else {
          this.sessionPromptTokens += pTokens;
          this.sessionCompletionTokens += cTokens;
        }
      }
    }

    // 0. Potwierdzenie gotowości sesji przez Google AI Studio
    if (message.setupComplete) {
      console.log("[GeminiLive] Sesja skonfigurowana pomyślnie (setupComplete). Lektor rozpoczyna powitanie...");
      this.onStatusChange('active');
      this.sendInitialGreeting();
      return;
    }

    // 1. Sprawdzenie przerwania mowy lektora (Barge-in / User Interrupted)
    if (message.serverContent && message.serverContent.interrupted) {
      console.log("[GeminiLive] Wykryto przerwanie (interrupted = true). Wyciszam lektora natychmiast.");
      this.stopBotAudio();
      return;
    }

    // 2. Obsługa treści generowanych przez model
    let hasPartText = false;
    if (message.serverContent && message.serverContent.modelTurn) {
      if (!this.botTurnStarted) {
        this.botTurnStarted = true;
        this.currentBotTurnText = '';
        this.resetUserTurnIndex();
      }
      const parts = message.serverContent.modelTurn.parts || [];

      for (const part of parts) {
        // Audio PCM z Gemini (Google AI Studio przesyła inlineData: { mimeType: "audio/pcm;rate=24000", data: "..." })
        const audioData = part.inlineData || (part.mimeType && part.data ? part : null);
        if (audioData && audioData.mimeType && audioData.mimeType.startsWith('audio/pcm') && audioData.data) {
          let sampleRate = 24000;
          const match = audioData.mimeType.match(/rate=(\d+)/);
          if (match && match[1]) {
            sampleRate = parseInt(match[1], 10);
          }
          this.queueAudioChunk(audioData.data, sampleRate);
        }

        // Tekst wypowiedzi lektora (pomijamy myśli modelu: part.thought === true)
        if (part.text && !part.thought) {
          hasPartText = true;
          this.currentBotTurnText += part.text;
          this.onTranscript({
            sender: 'bot',
            text: this.currentBotTurnText,
            isFinal: false
          });
        }
      }
    }

    // Bezpośrednia transkrypcja mowy lektora ze strumienia outputTranscription (jeśli przesłana przez Gemini)
    if (message.serverContent) {
      const outTr = message.serverContent.outputTranscription || message.serverContent.output_transcription;
      if (outTr && outTr.text && !hasPartText) {
        this.currentBotTurnText += outTr.text;
        this.onTranscript({
          sender: 'bot',
          text: this.currentBotTurnText,
          isFinal: false
        });
      }
    }

    // 3. Koniec tura lektora
    if (message.serverContent && message.serverContent.turnComplete) {
      this.botTurnStarted = false;
      this.resetUserTurnIndex();
      if (this.currentBotTurnText) {
        this.recentBotPhrases.push(this.currentBotTurnText);
        if (this.recentBotPhrases.length > 8) {
          this.recentBotPhrases.shift();
        }
        this.onTranscript({
          sender: 'bot',
          text: this.currentBotTurnText,
          isFinal: true
        });
        this.currentBotTurnText = '';
        this.currentTurnAudioChunks = [];
      } else {
        this.transcribeBotTurn();
      }
    }
  }

  /**
   * Wysyła krótką prośbę o powitanie ucznia natychmiast po połączeniu
   */
  sendInitialGreeting() {
    this.resetUserTurnIndex();
    const greetingText = this.initialGreetingPrompt || 
      "Hello! Please greet me warmly in English as my friendly tutor, introduce yourself briefly in 1-2 natural sentences, and ask how my day is going.";
    const greetingTurn = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: greetingText
              }
            ]
          }
        ],
        turnComplete: true
      }
    };
    this.sendJson(greetingTurn);
  }

  /**
   * Kolejkuje i odtwarza fragment audio 24kHz PCM
   */
  queueAudioChunk(base64Data, sampleRate = 24000) {
    if (!this.outputAudioContext) return;

    try {
      if (this.outputAudioContext.state === 'suspended') {
        this.outputAudioContext.resume().catch((err) => {
          console.warn("[GeminiLive] Wznowienie AudioContext:", err);
        });
      }

      const float32Array = this.base64ToFloat32Array(base64Data);
      if (!float32Array || float32Array.length === 0) return;

      // Zbieramy próbki bieżącej tury do późniejszej automatycznej transkrypcji
      this.currentTurnAudioChunks.push(float32Array);

      if (!this.botTurnStarted) {
        this.botTurnStarted = true;
        this.resetUserTurnIndex();
        this.onTranscript({
          sender: 'bot',
          text: '🎙️ Speaking...',
          isFinal: false
        });
      }

      const audioBuffer = this.outputAudioContext.createBuffer(1, float32Array.length, sampleRate);
      if (audioBuffer.copyToChannel) {
        audioBuffer.copyToChannel(float32Array, 0);
      } else {
        audioBuffer.getChannelData(0).set(float32Array);
      }

      const sourceNode = this.outputAudioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputGainNode || this.outputAudioContext.destination);

      const currentTime = this.outputAudioContext.currentTime;
      const startTime = (this.nextPlayTime < currentTime) ? currentTime : this.nextPlayTime;
      sourceNode.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.scheduledSources.push(sourceNode);

      sourceNode.onended = () => {
        const index = this.scheduledSources.indexOf(sourceNode);
        if (index !== -1) {
          this.scheduledSources.splice(index, 1);
        }
      };

      if (!this.isBotCurrentlySpeaking) {
        this.isBotCurrentlySpeaking = true;
        this.onBotSpeaking(true);
      }

    } catch (e) {
      console.error("[GeminiLive] Błąd podczas odtwarzania fragmentu audio:", e);
    }
  }

  /**
   * Koduje tablicę Float32 do pliku WAV PCM 16-bit
   */
  encodeWAV(samples, sampleRate = 24000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return buffer;
  }

  /**
   * Przesyła zarejestrowane audio tury lektora do backendu w celu uzyskania dokładnej transkrypcji (Gemini 3.8 / Whisper)
   */
  async transcribeBotTurn(explicitChunks = null) {
    const chunks = explicitChunks || this.currentTurnAudioChunks;
    if (!chunks || chunks.length === 0) return;
    if (!explicitChunks) {
      this.currentTurnAudioChunks = [];
    }

    let totalLength = 0;
    for (let i = 0; i < chunks.length; i++) {
      totalLength += chunks[i].length;
    }
    if (totalLength < 4800) return; // Mniej niż 0.2s pomijamy

    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      combined.set(chunks[i], offset);
      offset += chunks[i].length;
    }

    try {
      const wavBuffer = this.encodeWAV(combined, 24000);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', blob, 'bot_turn.wav');
      if (this.userEmail) {
        formData.append('user_email', this.userEmail);
      }

      const headers = {};
      if (this.sessionToken) {
        headers['X-Session-Token'] = this.sessionToken;
      }

      const res = await fetch(`${this.apiBaseUrl}/api/live/transcribe`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const text = (data.text || '').trim();
        if (text) {
          this.recentBotPhrases.push(text);
          if (this.recentBotPhrases.length > 8) {
            this.recentBotPhrases.shift();
          }
          this.onTranscript({
            sender: 'bot',
            text: text,
            isFinal: true
          });
          return;
        }
      }
    } catch (e) {
      console.warn("[GeminiLive] Błąd transkrypcji wypowiedzi lektora:", e);
    }
  }

  /**
   * Natychmiastowe zatrzymanie odtwarzania głosu lektora (Barge-in)
   */
  stopBotAudio() {
    this.scheduledSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    });
    this.scheduledSources = [];

    const chunksToTranscribe = this.currentTurnAudioChunks;
    this.currentTurnAudioChunks = [];
    const wasTurnStarted = this.botTurnStarted;
    this.botTurnStarted = false;
    this.resetUserTurnIndex();

    if (this.outputAudioContext) {
      this.nextPlayTime = this.outputAudioContext.currentTime;
    }

    if (this.isBotCurrentlySpeaking) {
      this.lastBotSpeakingEndTime = Date.now();
    }
    this.isBotCurrentlySpeaking = false;
    this.onBotSpeaking(false);

    // Jeśli lektor został przerwany przez użytkownika (Barge-in), ale zdążył już coś wypowiedzieć,
    // transkrybujemy to co wypowiedział do momentu przerwania.
    if (wasTurnStarted && !this.currentBotTurnText && chunksToTranscribe && chunksToTranscribe.length > 0) {
      this.transcribeBotTurn(chunksToTranscribe);
    }
  }

  /**
   * Multimodal Vision: Włączenie/Wyłączenie strumieniowania obrazu z kamery
   */
  async startCameraStream(videoElement) {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { max: 5 }
        }
      });

      this.videoElement = videoElement;
      if (this.videoElement) {
        this.videoElement.srcObject = this.videoStream;
        this.videoElement.play();
      }

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      // Wysyłamy 1 klatkę na sekundę
      this.videoFrameInterval = setInterval(() => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.videoElement || this.videoElement.readyState < 2) return;

        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64Data = dataUrl.split(',')[1];

        if (base64Data) {
          const videoFrameMessage = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              ]
            }
          };
          this.sendJson(videoFrameMessage);
        }
      }, 1000);

      return true;
    } catch (err) {
      console.error("[GeminiLive] Błąd włączania kamery:", err);
      throw err;
    }
  }

  stopCameraStream() {
    if (this.videoFrameInterval) {
      clearInterval(this.videoFrameInterval);
      this.videoFrameInterval = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  /**
   * Bezpieczne wysłanie obiektu JSON przez WebSocket
   */
  sendJson(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  /**
   * Resampling tablicy Float32 z częstotliwości wejściowej na 16000 Hz
   */
  resampleAudio(audioBuffer, fromSampleRate, toSampleRate) {
    if (fromSampleRate === toSampleRate) return audioBuffer;

    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(audioBuffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originalIndex = i * ratio;
      const leftIndex = Math.floor(originalIndex);
      const rightIndex = Math.min(leftIndex + 1, audioBuffer.length - 1);
      const interpolation = originalIndex - leftIndex;
      result[i] = audioBuffer[leftIndex] * (1 - interpolation) + audioBuffer[rightIndex] * interpolation;
    }

    return result;
  }

  /**
   * Konwersja Float32 [-1.0, 1.0] do 16-bit PCM Little Endian
   */
  floatTo16BitPCM(input) {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  /**
   * Konwersja Base64 PCM 16-bit Little Endian do Float32Array
   */
  base64ToFloat32Array(base64) {
    try {
      const sanitized = base64.replace(/\s/g, '');
      const binaryString = window.atob(sanitized);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const dataView = new DataView(bytes.buffer);
      const numSamples = Math.floor(bytes.length / 2);
      const samples = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        samples[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
      }

      return samples;
    } catch (e) {
      console.warn("[GeminiLive] Błąd dekodowania Base64 PCM:", e);
      return null;
    }
  }

  /**
   * Konwersja ArrayBuffer na ciąg Base64
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Zgłasza do backendu statystyki sesji Gemini Live (czas trwania i zużycie tokenów) do monitora kosztów
   */
  async reportSessionUsage() {
    if (this.usageReported) return;
    this.usageReported = true;

    const durationSeconds = this.sessionStartTime
      ? Math.max(1, Math.round((Date.now() - this.sessionStartTime) / 1000))
      : 0;

    // Raportuj jeśli sesja trwała co najmniej 2 sekundy lub naliczono jakiekolwiek tokeny
    if (durationSeconds < 2 && this.sessionPromptTokens === 0 && this.sessionCompletionTokens === 0) {
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.sessionToken) {
        headers['X-Session-Token'] = this.sessionToken;
      }
      await fetch(`${this.apiBaseUrl}/api/live/log-usage`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: this.provider,
          model: this.model,
          prompt_tokens: this.sessionPromptTokens,
          completion_tokens: this.sessionCompletionTokens,
          duration_seconds: durationSeconds,
          user_email: this.userEmail
        })
      });
      console.log(`[GeminiLive] Zaraportowano zużycie sesji do monitora kosztów: ${durationSeconds}s, in: ${this.sessionPromptTokens}, out: ${this.sessionCompletionTokens}`);
    } catch (e) {
      console.warn("[GeminiLive] Błąd raportowania zużycia sesji do backendu:", e);
    }
  }

  /**
   * Pełne sprzątanie zasobów
   */
  cleanup() {
    this.isDestroyed = true;
    if (this.quotaTicker) {
      clearInterval(this.quotaTicker);
      this.quotaTicker = null;
    }
    this.reportSessionUsage();
    this.isConnected = false;

    this.stopBotAudio();
    this.stopCameraStream();

    if (this.checkSpeakingInterval) {
      clearInterval(this.checkSpeakingInterval);
      this.checkSpeakingInterval = null;
    }

    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch (e) {}
      this.speechRecognition = null;
    }

    if (this.scriptProcessorNode) {
      try {
        this.scriptProcessorNode.disconnect();
      } catch (e) {}
      this.scriptProcessorNode = null;
    }

    if (this.inputMuteGain) {
      try {
        this.inputMuteGain.disconnect();
      } catch (e) {}
      this.inputMuteGain = null;
    }

    if (this.audioSourceNode) {
      try {
        this.audioSourceNode.disconnect();
      } catch (e) {}
      this.audioSourceNode = null;
    }

    if (this.outputGainNode) {
      try {
        this.outputGainNode.disconnect();
      } catch (e) {}
      this.outputGainNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioContext) {
      try {
        if (this.inputAudioContext.state !== 'closed') {
          this.inputAudioContext.close();
        }
      } catch (e) {}
      this.inputAudioContext = null;
    }

    if (this.outputAudioContext) {
      try {
        if (this.outputAudioContext.state !== 'closed') {
          this.outputAudioContext.close();
        }
      } catch (e) {}
      this.outputAudioContext = null;
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }
}

```

---

## 5. Plik: `frontend/src/components/TopBar.js`

```javascript
import React from 'react';
import './TopBar.css';

const TopBar = ({ title, user, subscription, onOpenPaywall }) => {
  const userName = user?.name || (user?.email ? user.email.split('@')[0] : 'Anna Kowalska');
  const tier = subscription?.tier || 'starter';
  const remaining = subscription?.minutes_remaining !== undefined ? subscription.minutes_remaining : 5;
  const isProOrIntensive = tier === 'pro' || tier === 'intensive';
  
  return (
    <header className="mission-topbar">
      <div className="topbar-left">
        <h2 className="page-title">{title}</h2>
      </div>

      <div className="topbar-right">
        {/* Pigułka subskrypcji i minut Live AI */}
        <button 
          className={`topbar-plan-pill ${isProOrIntensive ? 'plan-pill-premium' : 'plan-pill-free'}`}
          onClick={() => onOpenPaywall && onOpenPaywall()}
          title="Zarządzaj pakietem i limitami minut Live AI"
        >
          <span className="plan-pill-badge">{tier.toUpperCase()}</span>
          <span className="plan-pill-mins">{remaining.toFixed(1)}m</span>
          <span className="plan-pill-action">{tier === 'starter' ? '⚡ Uaktualnij' : 'Plan'}</span>
        </button>

        <button className="topbar-lang-pill" title="Zmień język docelowy (EN → PL)">
          <span className="lang-icon">🌐</span>
          <span className="lang-text">EN → PL</span>
        </button>

        <button className="topbar-icon-btn" title="Powiadomienia">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        <div className="topbar-user-pill" onClick={() => onOpenPaywall && onOpenPaywall()} style={{ cursor: 'pointer' }} title="Profil i subskrypcja">
          <span className="topbar-avatar">{userName.charAt(0).toUpperCase()}</span>
          <span className="topbar-username">{userName}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </header>
  );
};

export default TopBar;

```

---

## 6. Plik: `frontend/src/components/Sidebar.js`

```javascript
import React, { useState } from 'react';
import logoImg from '../assets/logo.png';
import './Sidebar.css';

const Sidebar = ({ currentView, onNavigate, user, onLogout, isAdmin, subscription, onOpenPaywall }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('buddy_sidebar_collapsed');
    return stored ? JSON.parse(stored) : false;
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('buddy_sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  const isStarter = !subscription || subscription.tier === 'starter';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Chat Live',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      )
    },
    {
      id: 'workspace',
      label: 'Workspace',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    },
    {
      id: 'stories',
      label: 'Saved Stories',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      id: 'notebook',
      label: 'My Vocabulary',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8l6 6M4 14l6-6 2 3M2 5h12M9 2v3M22 22l-5-10-5 10M14 18h6" />
        </svg>
      )
    },
    {
      id: 'media',
      label: 'Media Buddy',
      badge: isStarter && !isAdmin ? 'PRO' : null,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </svg>
      )
    },
    {
      id: 'good-to-know',
      label: 'Good to Know',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.55.59 2.97 1.5 4 .76.76 1.23 1.52 1.41 2.5h6.18z" />
        </svg>
      )
    }
  ];

  if (isAdmin) {
    menuItems.push({
      id: 'admin',
      label: 'Admin Dashboard',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      )
    });
  }

  const handleItemClick = (item) => {
    if (item.disabled) return;
    if (item.id === 'media' && isStarter && !isAdmin) {
      if (onOpenPaywall) {
        onOpenPaywall({ feature: 'media' });
        return;
      }
    }
    onNavigate(item.id);
  };

  return (
    <aside className={`mission-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon-figma">
          <img src={logoImg} alt="Speakling Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        </div>
        <h1 className="brand-name-figma">speakling</h1>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item nav-item-${item.id} ${currentView === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            title={item.disabled ? `${item.label} (Wkrótce / Coming Soon)` : (isCollapsed ? item.label : undefined)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge && !isCollapsed && (
              <span className="nav-badge-pill">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <button 
        className="collapse-toggle-btn" 
        onClick={toggleCollapse}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isCollapsed ? (
            <path d="M9 18l6-6-6-6" />
          ) : (
            <path d="M15 18l-6-6 6-6" />
          )}
        </svg>
        <span>Collapse</span>
      </button>

      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="sidebar-subscription-box" onClick={() => onOpenPaywall && onOpenPaywall()}>
            {isStarter ? (
              <div className="sidebar-sub-card sub-card-upgrade">
                <div className="sub-card-header">
                  <span className="sub-card-tag">7 DNI FREE</span>
                  <span className="sub-card-sparkle">✨</span>
                </div>
                <div className="sub-card-title">Przejdź na Pro</div>
                <div className="sub-card-desc">150 min Live Orb + Mastery Path</div>
                <button className="sub-card-btn">Uaktualnij plan →</button>
              </div>
            ) : (
              <div className="sidebar-sub-card sub-card-active">
                <div className="sub-card-header">
                  <span className="sub-card-tag">{subscription?.tier?.toUpperCase()}</span>
                </div>
                <div className="sub-card-title">Plan {subscription?.name || 'Pro'}</div>
                <div className="sub-card-desc">
                  Pozostało: <strong>{(subscription?.minutes_remaining || 0).toFixed(1)} min</strong>
                </div>
                <button className="sub-card-btn-secondary">Zarządzaj planem</button>
              </div>
            )}
          </div>
        )}

        {!isCollapsed && (
          <div className="daily-practice-card">
            <div className="practice-card-header">
              <span className="practice-card-title">Your daily practice</span>
            </div>
            <p className="practice-card-sub">A little English, every day.</p>
            <div className="practice-progress-bar">
              <div className="practice-progress-fill" style={{ width: '60%' }}></div>
            </div>
            <span className="practice-card-meta">12 of 20 minutes today</span>
          </div>
        )}

        <div className="sidebar-bottom-actions">
          <button className="help-feedback-btn" onClick={() => onNavigate('good-to-know')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {!isCollapsed && <span>Help & feedback</span>}
          </button>
          
          {user && !isCollapsed && (
            <button className="logout-btn-minimal" onClick={onLogout} title="Wyloguj">
              Wyloguj ({user.email.split('@')[0]})
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

```

---

## 7. Plik: `frontend/src/App.js`

```javascript
import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Workspace from './components/Workspace';
import SavedStories from './components/Story/SavedStories';
import Auth from './components/Auth/Auth';
import VocabularyView from './components/Vocabulary/VocabularyView';
import VocabularyDrawer from './components/Vocabulary/VocabularyDrawer';
import TranslatorDrawer from './components/Translator/TranslatorDrawer';
import MediaBuddy from './components/Media/MediaBuddy';
import Flashcards from './components/Flashcards';
import { API_BASE_URL } from './config';
import AdminDashboard from './components/Admin/AdminDashboard';
import GoodToKnow from './components/GoodToKnow';
import PaywallModal from './components/Paywall/PaywallModal';

function App() {
  const [currentView, setCurrentView] = useState(() => {
    const savedView = localStorage.getItem("buddy_current_view");
    if (savedView) return savedView;
    return 'dashboard';
  });
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("buddy_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [isAdmin, setIsAdmin] = useState(false);

  const [subscription, setSubscription] = useState(() => {
    return user?.subscription || null;
  });
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);

  const openPaywall = (reason = null) => {
    setPaywallReason(reason);
    setPaywallOpen(true);
  };

  const fetchSubscription = async () => {
    if (!user || !user.token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/subscription/status`, {
        headers: { "X-Session-Token": user.token }
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      }
    } catch (e) {
      console.warn("Błąd pobierania subskrypcji:", e);
    }
  };

  useEffect(() => {
    if (user && user.token) {
      fetchSubscription();
      fetch(`${API_BASE_URL}/api/admin/verify`, {
        headers: { "X-Session-Token": user.token }
      })
      .then(res => {
        if (res.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
      setSubscription(null);
    }
  }, [user]);

  const [generatedText, setGeneratedText] = useState(() => {
    return localStorage.getItem("buddy_generated_text") || "";
  });
  const [currentStoryTitle, setCurrentStoryTitle] = useState(() => {
    return localStorage.getItem("buddy_current_story_title") || "";
  });
  const [currentStoryId, setCurrentStoryId] = useState(() => {
    const id = localStorage.getItem("buddy_current_story_id");
    return id ? JSON.parse(id) : null;
  });

  useEffect(() => {
    localStorage.setItem("buddy_generated_text", generatedText);
  }, [generatedText]);

  useEffect(() => {
    localStorage.setItem("buddy_current_story_title", currentStoryTitle);
  }, [currentStoryTitle]);

  useEffect(() => {
    if (currentStoryId !== null) {
      localStorage.setItem("buddy_current_story_id", JSON.stringify(currentStoryId));
    } else {
      localStorage.removeItem("buddy_current_story_id");
    }
  }, [currentStoryId]);

  const [externalFlashcardsWords, setExternalFlashcardsWords] = useState([]);

  const [customAlert, setCustomAlert] = useState(null);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setCustomAlert(message);
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Dynamiczne wykrywanie urządzeń mobilnych oraz zmniejszenia ekranu i przekierowanie na wersję mobilną
  useEffect(() => {
    const checkMobileRedirect = () => {
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                       window.innerWidth < 768 ||
                       (window.screen && Math.min(window.screen.width, window.screen.height) < 768);
      if (isMobile) {
        const path = window.location.pathname;
        if (!path.startsWith('/speakling/mobile') && !path.startsWith('/speakling/mobile/')) {
          const separator = window.location.search ? '&' : '?';
          const target = window.location.origin + '/speakling/mobile/' + window.location.search + separator + 'cb=' + Date.now() + window.location.hash;
          window.location.replace(target);
        }
      }
    };

    checkMobileRedirect();
    window.addEventListener('resize', checkMobileRedirect);
    
    return () => window.removeEventListener('resize', checkMobileRedirect);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playFlashcards = params.get('play_flashcards') === 'true';
    const wordsB64 = params.get('words');
    if (playFlashcards && wordsB64) {
      try {
        const decoded = decodeURIComponent(escape(window.atob(wordsB64)));
        const parsedWords = JSON.parse(decoded);
        if (Array.isArray(parsedWords) && parsedWords.length > 0) {
          setExternalFlashcardsWords(parsedWords);
        }
      } catch (e) {
        console.error("Failed to parse external flashcards words from URL:", e);
      }
      
      // Clean query parameters from URL without reloading
      const url = new URL(window.location);
      url.searchParams.delete('play_flashcards');
      url.searchParams.delete('words');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, []);

  // Obsługa powrotu z bramki Stripe (Stripe Checkout)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    if (payment === 'success') {
      if (sessionId && user?.token) {
        fetch(`${API_BASE_URL}/api/stripe/verify-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': user.token
          },
          body: JSON.stringify({ session_id: sessionId })
        })
        .then(res => res.json())
        .then(data => {
          if (data.subscription) {
            setSubscription(data.subscription);
          }
          setCustomAlert("Dziękujemy! Twój pakiet został pomyślnie zaktualizowany. Ciesz się pełnymi możliwościami Speakling!");
        })
        .catch(err => {
          console.error("Błąd weryfikacji sesji Stripe:", err);
          fetchSubscription();
        });
      } else {
        setCustomAlert("Dziękujemy! Płatność przebiegła pomyślnie.");
        fetchSubscription();
      }

      const url = new URL(window.location);
      url.searchParams.delete('payment');
      url.searchParams.delete('session_id');
      url.searchParams.delete('plan');
      url.searchParams.delete('topup');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    } else if (payment === 'cancelled') {
      setCustomAlert("Płatność została anulowana. Możesz powrócić do wyboru planu w dowolnym momencie.");
      const url = new URL(window.location);
      url.searchParams.delete('payment');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, [user]);

  const handleLoginSuccess = (userData) => {
    localStorage.setItem("buddy_user", JSON.stringify(userData));
    setUser(userData);
    if (userData.subscription) {
      setSubscription(userData.subscription);
    }
  };

  const handleLogout = async () => {
    if (user && user.token) {
      try {
        await fetch(`${API_BASE_URL}/api/logout`, {
          method: "POST",
          headers: { "X-Session-Token": user.token }
        });
      } catch (e) {
        console.error("Błąd API wylogowania:", e);
      }
    }
    localStorage.removeItem("buddy_user");
    localStorage.removeItem("buddy_current_view");
    localStorage.removeItem("buddy_generated_text");
    localStorage.removeItem("buddy_current_story_title");
    localStorage.removeItem("buddy_current_story_id");
    setUser(null);
    setSubscription(null);
    setGeneratedText("");
    setCurrentStoryTitle("");
    setCurrentStoryId(null);
  };

  const handleNavigate = (view) => {
    // Blokada wejścia w Media Buddy dla pakietu Starter
    if (view === 'media' && subscription && !subscription.can_access_media && !isAdmin) {
      openPaywall({ feature: 'media' });
      return;
    }
    setCurrentView(view);
    localStorage.setItem("buddy_current_view", view);
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Chat Live';
      case 'workspace': return 'Practice Room';
      case 'stories': return 'Saved Stories';
      case 'notebook': return 'My Vocabulary';
      case 'media': return 'Media Buddy';
      case 'admin': return 'Panel Administratora';
      case 'good-to-know': return 'Good to know';
      default: return 'Speakling';
    }
  };

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App mission-layout">
      <Sidebar 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        user={user} 
        onLogout={handleLogout} 
        isAdmin={isAdmin}
        subscription={subscription}
        onOpenPaywall={openPaywall}
      />
      
      <main className="main-content">
        {currentView !== 'workspace' && (
          <TopBar 
            title={getPageTitle()} 
            user={user} 
            subscription={subscription}
            onOpenPaywall={openPaywall}
          />
        )}
        <div className="view-container">
          {currentView === 'dashboard' ? (
            <Dashboard 
              onNavigateToWorkspace={() => handleNavigate('workspace')} 
              user={user} 
              subscription={subscription}
              onOpenPaywall={openPaywall}
              onSubscriptionUpdated={setSubscription}
            />
          ) : currentView === 'stories' ? (
            <SavedStories 
              user={user} 
              onSelectStory={(text, title, id) => {
                setGeneratedText(text);
                setCurrentStoryTitle(title);
                setCurrentStoryId(id);
                handleNavigate('workspace');
              }}
              onStartLiveChat={(storyId) => {
                localStorage.setItem("buddy_selected_story_id", storyId);
                handleNavigate('dashboard');
              }}
              onCreateStory={() => handleNavigate('workspace')}
            />
          ) : currentView === 'notebook' ? (
            <VocabularyView 
              user={user}
              onNavigateToWorkspace={() => handleNavigate('workspace')}
              subscription={subscription}
              onOpenPaywall={openPaywall}
            />
          ) : currentView === 'media' ? (
            <MediaBuddy 
              user={user}
              subscription={subscription}
              onOpenPaywall={openPaywall}
            />
          ) : currentView === 'admin' ? (
            <AdminDashboard 
              user={user}
            />
          ) : currentView === 'good-to-know' ? (
            <GoodToKnow />
          ) : (
            <Workspace 
              onNavigateToDashboard={() => handleNavigate('dashboard')} 
              onNavigateToVocabulary={() => handleNavigate('notebook')}
              user={user}
              generatedText={generatedText}
              setGeneratedText={setGeneratedText}
              currentStoryTitle={currentStoryTitle}
              setCurrentStoryTitle={setCurrentStoryTitle}
              currentStoryId={currentStoryId}
              setCurrentStoryId={setCurrentStoryId}
              subscription={subscription}
              onOpenPaywall={openPaywall}
            />
          )}
        </div>
      </main>
      {externalFlashcardsWords.length > 0 && (
        <div className="flashcards-fullpage-overlay">
          <div className="flashcards-wrapper-modal glass-panel">
            <Flashcards 
              notebookWords={externalFlashcardsWords} 
              onFinishExercises={() => setExternalFlashcardsWords([])} 
              user={user}
            />
          </div>
        </div>
      )}

      {currentView !== 'notebook' && (
        <>
          <VocabularyDrawer user={user} />
          <TranslatorDrawer user={user} />
        </>
      )}

      {/* Modal Paywalla */}
      <PaywallModal 
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        user={user}
        subscription={subscription}
        initialReason={paywallReason}
        onSubscriptionUpdated={(newSub) => setSubscription(newSub)}
      />

      {customAlert && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content">
            <h3>Notification</h3>
            <p>{customAlert}</p>
            <div className="modal-actions">
              <button onClick={() => setCustomAlert(null)} className="btn-primary">OK</button>
            </div>
          </div>
        </div>
      )}
      {currentView !== 'dashboard' && (
        <button 
          className="live-chat-floating-bubble" 
          onClick={() => handleNavigate('dashboard')}
          title="Chat Live"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default App;
```

---

