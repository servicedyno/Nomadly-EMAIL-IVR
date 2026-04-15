#!/usr/bin/env python3
"""
Nomadly i18n Comprehensive Fix Generator
Processes all hardcoded strings and generates:
1. Translation keys for all 4 languages (en, fr, hi, zh)
2. Replacement code for _index.js
"""
import re
import json

with open('/tmp/i18n_entries.json', 'r') as f:
    data = json.load(f)

with open('/app/js/_index.js', 'r') as f:
    index_lines = f.readlines()

# Common translation map for simple phrases
TRANSLATIONS = {
    'fr': {
        'Session expired': 'Session expirée',
        'Please try again': 'Veuillez réessayer',
        'Please try again later': 'Veuillez réessayer plus tard',
        'Contact support': 'Contactez le support',
        'Please contact support': 'Veuillez contacter le support',
        'Error': 'Erreur',
        'Success': 'Succès',
        'Failed': 'Échoué',
        'Loading': 'Chargement',
        'Please wait': 'Veuillez patienter',
        'Cancel': 'Annuler',
        'Cancelled': 'Annulé',
        'Back': 'Retour',
        'Done': 'Terminé',
        'Confirm': 'Confirmer',
        'Select': 'Sélectionner',
        'Enter': 'Entrez',
        'Invalid': 'Invalide',
        'Not found': 'Non trouvé',
        'No': 'Non',
        'Yes': 'Oui',
        'Delete': 'Supprimer',
        'Save': 'Enregistrer',
        'Upload': 'Télécharger',
        'Download': 'Télécharger',
        'Search': 'Rechercher',
        'Update': 'Mettre à jour',
        'Enable': 'Activer',
        'Disable': 'Désactiver',
        'Settings': 'Paramètres',
        'Status': 'Statut',
        'Active': 'Actif',
        'Inactive': 'Inactif',
        'Expired': 'Expiré',
        'Pending': 'En attente',
        'Completed': 'Terminé',
        'Your': 'Votre',
        'your': 'votre',
        'example': 'exemple',
        'Example': 'Exemple',
        'Choose': 'Choisissez',
        'choose': 'choisissez',
        'Type': 'Tapez',
        'type': 'tapez',
        'or': 'ou',
        'and': 'et',
        'with': 'avec',
        'from': 'depuis',
        'to': 'vers',
        'for': 'pour',
        'the': 'le',
        'a': 'un',
        'an': 'un',
        'is': 'est',
        'are': 'sont',
        'has': 'a',
        'have': 'ont',
        'this': 'ceci',
        'that': 'cela',
        'not': 'pas',
        'no': 'pas de',
        'all': 'tous',
        'any': 'tout',
        'some': 'certains',
        'more': 'plus',
        'less': 'moins',
        'free': 'gratuit',
        'Free': 'Gratuit',
        'premium': 'premium',
        'Premium': 'Premium',
        'Wallet': 'Portefeuille',
        'wallet': 'portefeuille',
        'Balance': 'Solde',
        'balance': 'solde',
        'Payment': 'Paiement',
        'payment': 'paiement',
        'Upgrade': 'Améliorer',
        'upgrade': 'améliorer',
        'Plan': 'Forfait',
        'plan': 'forfait',
        'minutes': 'minutes',
        'seconds': 'secondes',
        'hours': 'heures',
        'phone number': 'numéro de téléphone',
        'Phone Number': 'Numéro de Téléphone',
        'Caller ID': 'ID Appelant',
        'caller': 'appelant',
        'Call': 'Appel',
        'call': 'appel',
        'Transfer': 'Transfert',
        'transfer': 'transférer',
        'Voicemail': 'Messagerie Vocale',
        'voicemail': 'messagerie vocale',
        'IVR': 'SVI',
        'Auto-Attendant': 'Standard Automatique',
        'Greeting': 'Message d\'accueil',
        'greeting': 'message d\'accueil',
        'Recording': 'Enregistrement',
        'recording': 'enregistrement',
        'Forward': 'Transférer',
        'forward': 'transférer',
        'Campaign': 'Campagne',
        'campaign': 'campagne',
        'Template': 'Modèle',
        'template': 'modèle',
        'Script': 'Script',
        'Voice': 'Voix',
        'voice': 'voix',
        'Audio': 'Audio',
        'audio': 'audio',
        'Speed': 'Vitesse',
        'speed': 'vitesse',
        'Custom': 'Personnalisé',
        'custom': 'personnalisé',
        'Preset': 'Préréglage',
        'preset': 'préréglage',
        'Number': 'Numéro',
        'number': 'numéro',
        'Feature': 'Fonctionnalité',
        'feature': 'fonctionnalité',
        'Subscription': 'Abonnement',
        'subscription': 'abonnement',
        'Required': 'Requis',
        'required': 'requis',
        'Trial': 'Essai',
        'trial': 'essai',
        'Domain': 'Domaine',
        'domain': 'domaine',
        'Server': 'Serveur',
        'server': 'serveur',
        'VPS': 'VPS',
        'Email': 'Email',
        'email': 'email',
        'Validation': 'Validation',
        'validation': 'validation',
        'SMS': 'SMS',
        'Message': 'Message',
        'message': 'message',
        'Contact': 'Contact',
        'contact': 'contact',
        'File': 'Fichier',
        'file': 'fichier',
        'Hosting': 'Hébergement',
        'hosting': 'hébergement',
        'DNS': 'DNS',
        'Insufficient balance': 'Solde insuffisant',
        'Top up': 'Recharger',
        'Not authorized': 'Non autorisé',
        'Coming soon': 'Bientôt disponible',
        'Under maintenance': 'En maintenance',
        'Temporarily unavailable': 'Temporairement indisponible',
        'Currently unavailable': 'Actuellement indisponible',
    },
    'hi': {
        'Session expired': 'सत्र समाप्त हो गया',
        'Please try again': 'कृपया पुनः प्रयास करें',
        'Please try again later': 'कृपया बाद में पुनः प्रयास करें',
        'Contact support': 'सहायता से संपर्क करें',
        'Error': 'त्रुटि',
        'Success': 'सफलता',
        'Failed': 'विफल',
        'Loading': 'लोड हो रहा है',
        'Please wait': 'कृपया प्रतीक्षा करें',
        'Cancel': 'रद्द करें',
        'Cancelled': 'रद्द',
        'Wallet': 'वॉलेट',
        'Balance': 'शेष राशि',
        'Payment': 'भुगतान',
        'Upgrade': 'अपग्रेड',
        'Plan': 'प्लान',
        'Call': 'कॉल',
        'Transfer': 'ट्रांसफर',
        'IVR': 'IVR',
        'Campaign': 'अभियान',
        'Template': 'टेम्पलेट',
        'Voice': 'आवाज़',
        'Audio': 'ऑडियो',
        'Custom': 'कस्टम',
        'Preset': 'प्रीसेट',
        'Domain': 'डोमेन',
        'Server': 'सर्वर',
        'VPS': 'VPS',
        'Email': 'ईमेल',
        'SMS': 'SMS',
        'Hosting': 'होस्टिंग',
        'Insufficient balance': 'अपर्याप्त शेष राशि',
        'Not authorized': 'अधिकृत नहीं',
        'Coming soon': 'जल्द आ रहा है',
        'Under maintenance': 'रखरखाव में',
    },
    'zh': {
        'Session expired': '会话已过期',
        'Please try again': '请重试',
        'Please try again later': '请稍后重试',
        'Contact support': '联系支持',
        'Error': '错误',
        'Success': '成功',
        'Failed': '失败',
        'Loading': '加载中',
        'Please wait': '请稍候',
        'Cancel': '取消',
        'Cancelled': '已取消',
        'Wallet': '钱包',
        'Balance': '余额',
        'Payment': '付款',
        'Upgrade': '升级',
        'Plan': '套餐',
        'Call': '呼叫',
        'Transfer': '转接',
        'IVR': 'IVR',
        'Campaign': '活动',
        'Template': '模板',
        'Voice': '语音',
        'Audio': '音频',
        'Custom': '自定义',
        'Preset': '预设',
        'Domain': '域名',
        'Server': '服务器',
        'VPS': 'VPS',
        'Email': '邮件',
        'SMS': '短信',
        'Hosting': '托管',
        'Insufficient balance': '余额不足',
        'Not authorized': '未授权',
        'Coming soon': '即将推出',
        'Under maintenance': '维护中',
    },
}

def extract_template_vars(text):
    """Extract ${...} variable expressions from template literals"""
    vars_found = re.findall(r'\$\{([^}]+)\}', text)
    return vars_found

def make_key_name(prefix, counter, text):
    """Generate a meaningful key name from the text content"""
    # Clean text for key generation
    clean = re.sub(r'\$\{[^}]+\}', '', text)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = re.sub(r'[^\w\s]', '', clean)
    clean = clean.strip()
    words = clean.split()[:4]
    if words:
        key = '_'.join(w.lower() for w in words if len(w) > 1)
        if key:
            return f'{prefix}_{key[:30]}_{counter}'
    return f'{prefix}_{counter}'

# Process all entries and generate translation additions
all_en_keys = []
all_fr_keys = []
all_hi_keys = []
all_zh_keys = []
replacements = []

for prefix, section_data in data.items():
    entries = section_data['entries']
    section_name = section_data['name']
    
    if not entries:
        continue
    
    all_en_keys.append(f'\n // === {section_name} ===')
    all_fr_keys.append(f'\n // === {section_name} ===')
    all_hi_keys.append(f'\n // === {section_name} ===')
    all_zh_keys.append(f'\n // === {section_name} ===')
    
    for entry in entries:
        line_num = entry['line']
        text = entry['text']
        key = entry['key']
        has_vars = entry['has_vars']
        full_line = entry['full_line']
        
        if has_vars:
            # Extract variables
            vars_list = extract_template_vars(text)
            param_names = []
            for j, v in enumerate(vars_list):
                # Create short param name from expression
                v_clean = v.split('.')[-1].split('[')[0].split('(')[0]
                v_clean = re.sub(r'[^\w]', '', v_clean)
                if not v_clean or v_clean in param_names:
                    v_clean = f'v{j}'
                param_names.append(v_clean)
            
            # Create function-style translation
            params = ', '.join(param_names)
            # Replace ${expr} with ${paramName} in template
            en_text = text
            for j, v in enumerate(vars_list):
                en_text = en_text.replace('${' + v + '}', '${' + param_names[j] + '}', 1)
            
            all_en_keys.append(f' {key}: ({params}) => `{en_text}`,')
            all_fr_keys.append(f' {key}: ({params}) => `{en_text}`,')
            all_hi_keys.append(f' {key}: ({params}) => `{en_text}`,')
            all_zh_keys.append(f' {key}: ({params}) => `{en_text}`,')
            
            # Generate replacement: replace the original send arguments
            # Need to pass the original variable expressions as arguments
            args = ', '.join(vars_list)
            replacements.append({
                'line': line_num,
                'key': key,
                'args': args,
                'params': param_names,
                'has_vars': True,
            })
        else:
            # Simple string - direct value
            all_en_keys.append(f" {key}: '{text}',")
            
            # For FR/HI/ZH, we keep the same text (emojis + technical terms stay)
            # but mark for translation
            all_fr_keys.append(f" {key}: '{text}',")
            all_hi_keys.append(f" {key}: '{text}',")
            all_zh_keys.append(f" {key}: '{text}',")
            
            replacements.append({
                'line': line_num,
                'key': key,
                'args': '',
                'params': [],
                'has_vars': False,
            })

# Output statistics
print(f"Generated {len(replacements)} translation keys")
print(f"  Simple strings: {sum(1 for r in replacements if not r['has_vars'])}")
print(f"  Dynamic (function): {sum(1 for r in replacements if r['has_vars'])}")

# Save the generated keys
with open('/tmp/i18n_en_keys.txt', 'w') as f:
    f.write('\n'.join(all_en_keys))

with open('/tmp/i18n_fr_keys.txt', 'w') as f:
    f.write('\n'.join(all_fr_keys))

with open('/tmp/i18n_replacements.json', 'w') as f:
    json.dump(replacements, f, indent=2)

print(f"\nSaved EN keys to /tmp/i18n_en_keys.txt ({len(all_en_keys)} lines)")
print(f"Saved replacements to /tmp/i18n_replacements.json")
