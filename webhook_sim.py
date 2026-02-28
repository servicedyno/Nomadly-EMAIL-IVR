#!/usr/bin/env python3
"""
Comprehensive Telegram Bot Webhook Simulator
Tests all buttons/flows in EN, FR, ZH, HI languages.
Sends simulated webhook messages and checks logs for errors.
"""

import requests
import time
import json
import subprocess
import sys

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
USERNAME = "hostbay_support"
FIRST_NAME = "Hostbay"

update_counter = 900000

def send_message(text, sleep_time=2):
    global update_counter
    update_counter += 1
    payload = {
        "update_id": update_counter,
        "message": {
            "message_id": update_counter,
            "from": {
                "id": CHAT_ID,
                "is_bot": False,
                "first_name": FIRST_NAME,
                "username": USERNAME
            },
            "chat": {
                "id": CHAT_ID,
                "first_name": FIRST_NAME,
                "username": USERNAME,
                "type": "private"
            },
            "date": int(time.time()),
            "text": text
        }
    }
    try:
        r = requests.post(WEBHOOK_URL, json=payload, timeout=10)
        time.sleep(sleep_time)
        return r.status_code
    except Exception as e:
        print(f"  [HTTP ERROR] {e}")
        return -1

def check_errors():
    """Check stderr log for new errors"""
    result = subprocess.run(
        ["cat", "/var/log/supervisor/nodejs.err.log"],
        capture_output=True, text=True
    )
    return result.stdout.strip()

def get_last_replies(n=5):
    """Get last N reply lines from stdout log"""
    result = subprocess.run(
        ["tail", f"-n", "50", "/var/log/supervisor/nodejs.out.log"],
        capture_output=True, text=True
    )
    lines = result.stdout.strip().split('\n')
    replies = [l for l in lines if l.startswith('reply:') or 'Unhandled' in l or 'Error' in l or 'error' in l]
    return replies[-n:]

def clear_error_log():
    subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])

# ============================================================
# BUTTON TEXT DEFINITIONS PER LANGUAGE
# ============================================================

# Main menu buttons per language
MAIN_MENU = {
    'en': {
        'cloud_phone': '📞 Cloud Phone + SIP',
        'test_sip': '🧪 Test SIP Free',
        'digital_products': '🛒 Digital Products',
        'virtual_card': '💳 Virtual Card',
        'domain_names': '🌐 Register Bulletproof Domain — 1000+ TLDs',
        'buy_leads': '🎯 Buy Phone Leads',
        'validate_numbers': '✅ Validate Numbers',
        'anti_red_hosting': '🛡️🔥 Anti-Red Hosting',
        'wallet': '👛 My Wallet',
        'subscriptions': '📋 My Subscriptions',
        'become_reseller': '💼 Become A Reseller',
        'settings': '🌍 Settings',
        'support': '💬 Get Support',
    },
    'fr': {
        'cloud_phone': '📞☁️ Cloud Phone + SIP',
        'test_sip': '🧪 Tester SIP Gratuit',
        'digital_products': '🛒 Produits numériques',
        'virtual_card': '💳 Carte Virtuelle',
        'domain_names': '🌐 Register Bulletproof Domain ¹⁰⁰⁰⁺ ᵀᴸᴰ',
        'buy_leads': '🎯 Acheter des Leads Téléphoniques',
        'validate_numbers': '✅ Valider les Numéros',
        'anti_red_hosting': '🛡️🔥 Hébergement Anti-Red',
        'wallet': '👛 Mon portefeuille',
        'subscriptions': '📋 Mes Abonnements',
        'become_reseller': '💼 Devenir revendeur',
        'settings': '🌍 Modifier les paramètres',
        'support': "💬 Obtenir de l'aide",
    },
    'zh': {
        'cloud_phone': '📞☁️ Cloud Phone + SIP',
        'test_sip': '🧪 免费测试 SIP',
        'digital_products': '🛒 数字产品',
        'virtual_card': '💳 虚拟卡',
        'domain_names': '🌐 Register Bulletproof Domain ¹⁰⁰⁰⁺ ᵀᴸᴰ',
        'buy_leads': '🎯 购买电话线索',
        'validate_numbers': '✅ 验证号码',
        'anti_red_hosting': '🌐 离岸托管',
        'wallet': '👛 我的钱包',
        'subscriptions': '📋 我的订阅',
        'become_reseller': '💼 成为代理商',
        'settings': '🌍 更改设置',
        'support': '💬 获取支持',
    },
    'hi': {
        'cloud_phone': '📞☁️ Cloud Phone + SIP',
        'test_sip': '🧪 SIP मुफ्त टेस्ट',
        'digital_products': '🛒 डिजिटल उत्पाद',
        'virtual_card': '💳 वर्चुअल कार्ड',
        'domain_names': '🌐 Register Bulletproof Domain ¹⁰⁰⁰⁺ ᵀᴸᴰ',
        'buy_leads': '🎯 फ़ोन लीड्स खरीदें',
        'validate_numbers': '✅ नंबर सत्यापित करें',
        'anti_red_hosting': '🌐 ऑफ़शोर होस्टिंग',
        'wallet': '👛 मेरा वॉलेट',
        'subscriptions': '📋 मेरी सदस्यताएं',
        'become_reseller': '💼 पुनर्विक्रेता बनें',
        'settings': '🌍 सेटिंग्स बदलें',
        'support': '💬 सहायता प्राप्त करें',
    }
}

# Back/Cancel per language
BACK_CANCEL = {
    'en': {'back': '⬅️ Back', 'cancel': 'Cancel'},
    'fr': {'back': '⬅️ Retour', 'cancel': 'Annuler'},
    'zh': {'back': '⬅️ 返回', 'cancel': '取消'},
    'hi': {'back': '⬅️ वापस', 'cancel': 'रद्द करें'},
}

# Sub-menus per language
DOMAIN_SUBMENU = {
    'en': {
        'buy': '🛒🌐 Buy Domain Names',
        'my_domains': '📂 My Domain Names',
        'dns': '🔧 DNS Management',
    },
    'fr': {
        'buy': '🛒🌐 Acheter des noms de domaine',
        'my_domains': '📂 Mes noms de domaine',
        'dns': '🔧 Gestion DNS',
    },
    'zh': {
        'buy': '🛒🌐 购买域名',
        'my_domains': '📂 我的域名',
        'dns': '🔧 DNS 管理',
    },
    'hi': {
        'buy': '🛒🌐 डोमेन नाम खरीदें',
        'my_domains': '📂 मेरे डोमेन नाम',
        'dns': '🔧 DNS प्रबंधन',
    },
}

SHORTENER_SUBMENU = {
    'en': {
        'shorten': '✂️ Shorten a Link',
        'redirect': '🔀✂️ Redirect & Shorten',
        'analytics': '📊 View Shortlink Analytics',
        'activate': '🔗 Activate Domain for Shortener',
    },
    'fr': {
        'shorten': '✂️ Raccourcir un lien',
        'redirect': '🔀✂️ Rediriger & Raccourcir',
        'analytics': '📊 Voir les Analytics',
        'activate': '🔗 Activer un domaine pour le raccourcisseur',
    },
    'zh': {
        'shorten': '✂️ 缩短链接',
        'redirect': '🔀✂️ 重定向 & 缩短',
        'analytics': '📊 查看短链接分析',
        'activate': '🔗 激活域名缩短器',
    },
    'hi': {
        'shorten': '✂️ लिंक छोटा करें',
        'redirect': '🔀✂️ रीडायरेक्ट और छोटा करें',
        'analytics': '📊 शॉर्टलिंक एनालिटिक्स देखें',
        'activate': '🔗 शॉर्टनर के लिए डोमेन सक्रिय करें',
    },
}

WALLET_SUBMENU = {
    'en': {
        'deposit': '➕💵 Deposit',
        'withdraw': '💸 Withdraw',
        'transfer': '💰 Transfer Funds',
        'history': '📜 Transaction History',
    },
    'fr': {
        'deposit': '➕💵 Déposer',
        'withdraw': '💸 Retirer',
        'transfer': '💰 Transférer des fonds',
        'history': '📜 Historique des transactions',
    },
    'zh': {
        'deposit': '➕💵 充值',
        'withdraw': '💸 提现',
        'transfer': '💰 转账',
        'history': '📜 交易历史',
    },
    'hi': {
        'deposit': '➕💵 जमा',
        'withdraw': '💸 निकासी',
        'transfer': '💰 फंड ट्रांसफर',
        'history': '📜 लेनदेन इतिहास',
    },
}

LANGUAGE_BUTTONS = {
    'en': '🇬🇧 English',
    'fr': '🇫🇷 French',
    'zh': '🇨🇳 Chinese',
    'hi': '🇮🇳 Hindi',
}

# Digital products sub-menu
DIGITAL_PRODUCTS_SUBMENU = {
    'en': ['Twilio Main $450', 'Twilio Sub $200', 'Telnyx Main $400', 'Telnyx Sub $150', 'Google Workspace New $100', 'Google Workspace Aged $150', 'Zoho New $100', 'Zoho Aged $150', 'eSIM $60', 'AWS Main $350', 'AWS Sub $150', 'GCloud Main $300', 'GCloud Sub $150'],
}

# ============================================================
# SIMULATION ENGINE
# ============================================================

results = {}
errors_found = []

def test_button(lang, context, button_name, button_text, expect_reply=True):
    """Test a single button press and record result"""
    key = f"{lang}/{context}/{button_name}"
    clear_error_log()
    
    status = send_message(button_text, sleep_time=2)
    errors = check_errors()
    replies = get_last_replies(3)
    
    has_error = bool(errors)
    has_reply = any('reply:' in r for r in replies) or any(f'to: {CHAT_ID}' in r for r in replies)
    
    if has_error:
        results[key] = "❌ ERROR"
        errors_found.append({
            'key': key,
            'button_text': button_text,
            'error': errors
        })
        print(f"  ❌ {key}: ERROR - {errors[:200]}")
    elif not has_reply and expect_reply:
        # Check more carefully - maybe it just took longer
        time.sleep(1)
        replies2 = get_last_replies(5)
        has_reply2 = any(f'to: {CHAT_ID}' in r for r in replies2)
        if not has_reply2:
            results[key] = "⚠️ NO REPLY"
            print(f"  ⚠️ {key}: NO REPLY detected")
        else:
            results[key] = "✅ OK"
            print(f"  ✅ {key}: OK")
    else:
        results[key] = "✅ OK"
        print(f"  ✅ {key}: OK")
    
    return not has_error

def set_language(lang_code):
    """Set user language via settings"""
    send_message(MAIN_MENU['en'].get('settings', '🌍 Settings'), sleep_time=1)
    time.sleep(1)
    send_message(LANGUAGE_BUTTONS[lang_code], sleep_time=2)
    print(f"\n{'='*60}")
    print(f"  Language set to: {lang_code.upper()}")
    print(f"{'='*60}")

def go_home():
    """Cancel any active flow and go back to main menu"""
    send_message('Cancel', sleep_time=1)
    send_message('/start', sleep_time=2)

# ============================================================
# RUN TESTS
# ============================================================

if __name__ == '__main__':
    print("=" * 70)
    print("NOMADLY BOT — COMPREHENSIVE WEBHOOK SIMULATION")
    print("Testing all buttons across EN, FR, ZH, HI")
    print("=" * 70)
    
    # Clear error log
    clear_error_log()
    
    # First, make sure user is at home
    print("\n[INIT] Sending /start to reset state...")
    send_message('/start', sleep_time=3)
    
    for lang_code in ['en', 'fr', 'zh', 'hi']:
        print(f"\n{'#'*70}")
        print(f"# TESTING LANGUAGE: {lang_code.upper()}")
        print(f"{'#'*70}")
        
        # Set language
        set_language(lang_code)
        go_home()
        
        menu = MAIN_MENU[lang_code]
        bc = BACK_CANCEL[lang_code]
        
        # ── Test each main menu button ──
        print(f"\n--- Main Menu Buttons ({lang_code}) ---")
        
        for btn_name, btn_text in menu.items():
            test_button(lang_code, 'main_menu', btn_name, btn_text)
            # Go back to main menu
            send_message(bc['cancel'], sleep_time=1)
            send_message('/start', sleep_time=1)
        
        # ── Test Domain sub-menu ──
        print(f"\n--- Domain Sub-Menu ({lang_code}) ---")
        send_message(menu['domain_names'], sleep_time=2)
        for btn_name, btn_text in DOMAIN_SUBMENU[lang_code].items():
            test_button(lang_code, 'domain_sub', btn_name, btn_text)
            send_message(bc['back'], sleep_time=1)
        send_message(bc['cancel'], sleep_time=1)
        go_home()
        
        # ── Test URL Shortener sub-menu ──
        print(f"\n--- URL Shortener Sub-Menu ({lang_code}) ---")
        # The shortener button text varies with free links count
        shortener_btn = menu.get('url_shortener', None)
        if not shortener_btn:
            # Use a general pattern since the button includes dynamic text
            # Try sending the raw text from the lang file
            pass
        
        # ── Test Wallet sub-menu ──
        print(f"\n--- Wallet Sub-Menu ({lang_code}) ---")
        send_message(menu['wallet'], sleep_time=2)
        for btn_name, btn_text in WALLET_SUBMENU[lang_code].items():
            test_button(lang_code, 'wallet_sub', btn_name, btn_text)
            send_message(bc['back'], sleep_time=1)
        send_message(bc['cancel'], sleep_time=1)
        go_home()
        
        # ── Test Digital Products sub-menu ──
        print(f"\n--- Digital Products Sub-Menu ({lang_code}) ---")
        send_message(menu['digital_products'], sleep_time=2)
        # Just test Back from here
        test_button(lang_code, 'digital_sub', 'back', bc['back'])
        go_home()
        
        # ── Test Virtual Card ──
        print(f"\n--- Virtual Card ({lang_code}) ---")
        send_message(menu['virtual_card'], sleep_time=2)
        test_button(lang_code, 'virtual_card', 'back_or_cancel', bc['cancel'])
        go_home()
        
        # ── Test Anti-Red Hosting ──
        print(f"\n--- Anti-Red Hosting ({lang_code}) ---")
        test_button(lang_code, 'hosting', 'anti_red', menu['anti_red_hosting'])
        send_message(bc['back'], sleep_time=1)
        go_home()
        
        # ── Test Subscriptions ──
        print(f"\n--- Subscriptions ({lang_code}) ---")
        test_button(lang_code, 'subscriptions', 'view', menu['subscriptions'])
        go_home()
        
        # ── Test Become Reseller ──
        print(f"\n--- Become Reseller ({lang_code}) ---")
        test_button(lang_code, 'reseller', 'become', menu['become_reseller'])
        go_home()
        
        # ── Test Back / Cancel from various states ──
        print(f"\n--- Back/Cancel Buttons ({lang_code}) ---")
        send_message(menu['domain_names'], sleep_time=2)
        send_message(DOMAIN_SUBMENU[lang_code]['buy'], sleep_time=2)
        test_button(lang_code, 'domain_buy', 'back', bc['back'])
        test_button(lang_code, 'domain_menu', 'cancel', bc['cancel'])
        go_home()
        
        # ── Test Buy Leads flow (the one that was broken) ──
        print(f"\n--- Buy Leads Flow ({lang_code}) ---")
        send_message(menu['buy_leads'], sleep_time=2)
        # Select first target (JPMorgan)
        test_button(lang_code, 'leads', 'target_select', 'JPMorgan C')
        # Select a city
        test_button(lang_code, 'leads', 'city_select', 'All Cities')
        # Select area code (Mixed)
        test_button(lang_code, 'leads', 'area_code', 'Mixed Area Codes')
        go_home()
        
        # ── Test Validate Numbers flow ──
        print(f"\n--- Validate Numbers Flow ({lang_code}) ---")
        test_button(lang_code, 'validate', 'main', menu['validate_numbers'])
        go_home()
        
        # ── Test Support ──
        print(f"\n--- Support ({lang_code}) ---")
        test_button(lang_code, 'support', 'get_support', menu['support'])
        send_message('/done', sleep_time=1)
        go_home()
    
    # ============================================================
    # RESULTS SUMMARY
    # ============================================================
    
    print("\n" + "=" * 70)
    print("RESULTS SUMMARY")
    print("=" * 70)
    
    ok_count = sum(1 for v in results.values() if v == "✅ OK")
    err_count = sum(1 for v in results.values() if v == "❌ ERROR")
    no_reply_count = sum(1 for v in results.values() if v == "⚠️ NO REPLY")
    
    print(f"\nTotal: {len(results)} | ✅ OK: {ok_count} | ❌ ERROR: {err_count} | ⚠️ NO REPLY: {no_reply_count}")
    
    if errors_found:
        print(f"\n{'─'*70}")
        print("ERRORS FOUND:")
        print(f"{'─'*70}")
        for e in errors_found:
            print(f"\n  Key: {e['key']}")
            print(f"  Button: {e['button_text']}")
            print(f"  Error: {e['error'][:300]}")
    
    no_replies = {k: v for k, v in results.items() if v == "⚠️ NO REPLY"}
    if no_replies:
        print(f"\n{'─'*70}")
        print("NO REPLY DETECTED:")
        print(f"{'─'*70}")
        for k in no_replies:
            print(f"  {k}")
    
    # Write results to file
    with open('/app/webhook_sim_results.json', 'w') as f:
        json.dump({
            'results': results,
            'errors': [{'key': e['key'], 'button_text': e['button_text'], 'error': e['error'][:500]} for e in errors_found],
            'summary': {
                'total': len(results),
                'ok': ok_count,
                'errors': err_count,
                'no_reply': no_reply_count,
            }
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\nResults written to /app/webhook_sim_results.json")
    
    sys.exit(0 if err_count == 0 else 1)
