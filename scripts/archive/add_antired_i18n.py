#!/usr/bin/env python3
"""Add antiRed.* i18n strings to all 4 panel locale files."""
import json
import sys

# Translations vetted: short, customer-friendly, matches existing tone of /site/ namespace.
TRANSLATIONS = {
    'en': {
        'statusRepairing': 'Anti-Red protection is repairing',
        'statusStuck': 'Anti-Red protection needs attention',
        'helpNoteRepairing': 'Your protection files were recently modified. The system is restoring them automatically — tap below to fix it right now if you don\'t want to wait.',
        'helpNoteStuck': 'Your protection files keep getting overwritten. Tap below to restore them — if this keeps happening, check whether a file in your last upload is overwriting them.',
        'restoreButton': 'Restore Anti-Red Protection',
        'restoring': 'Restoring…',
        'restoredOk': '✅ Protection restored successfully.',
        'restoreFailed': 'Restore failed — please try again or contact support.',
        'cooldown': 'Please wait a moment before restoring again.',
    },
    'fr': {
        'statusRepairing': 'La protection Anti-Red est en cours de réparation',
        'statusStuck': 'La protection Anti-Red nécessite votre attention',
        'helpNoteRepairing': 'Vos fichiers de protection ont été récemment modifiés. Le système les restaure automatiquement — appuyez ci-dessous pour résoudre le problème maintenant si vous ne voulez pas attendre.',
        'helpNoteStuck': 'Vos fichiers de protection sont continuellement écrasés. Appuyez ci-dessous pour les restaurer — si cela continue, vérifiez si un fichier de votre dernier transfert les remplace.',
        'restoreButton': 'Restaurer la protection Anti-Red',
        'restoring': 'Restauration…',
        'restoredOk': '✅ Protection restaurée avec succès.',
        'restoreFailed': 'Échec de la restauration — veuillez réessayer ou contacter le support.',
        'cooldown': 'Veuillez patienter un instant avant de réessayer.',
    },
    'zh': {
        'statusRepairing': '反红屏保护正在修复中',
        'statusStuck': '反红屏保护需要您的关注',
        'helpNoteRepairing': '您的保护文件最近被修改了。系统正在自动恢复 — 如果您不想等待,请点击下面立即修复。',
        'helpNoteStuck': '您的保护文件一直被覆盖。点击下方进行恢复 — 如果反复出现,请检查您上次上传的文件是否覆盖了它们。',
        'restoreButton': '恢复反红屏保护',
        'restoring': '恢复中…',
        'restoredOk': '✅ 保护已成功恢复。',
        'restoreFailed': '恢复失败 — 请重试或联系客服。',
        'cooldown': '请稍等片刻再重试。',
    },
    'hi': {
        'statusRepairing': 'एंटी-रेड सुरक्षा की मरम्मत हो रही है',
        'statusStuck': 'एंटी-रेड सुरक्षा पर ध्यान देने की आवश्यकता है',
        'helpNoteRepairing': 'आपकी सुरक्षा फ़ाइलों को हाल ही में संशोधित किया गया था। सिस्टम उन्हें स्वचालित रूप से पुनर्स्थापित कर रहा है — यदि आप प्रतीक्षा नहीं करना चाहते तो अभी ठीक करने के लिए नीचे टैप करें।',
        'helpNoteStuck': 'आपकी सुरक्षा फ़ाइलें बार-बार ओवरराइट हो रही हैं। उन्हें पुनर्स्थापित करने के लिए नीचे टैप करें — यदि यह जारी रहता है, तो जांचें कि क्या आपके पिछले अपलोड में कोई फ़ाइल उन्हें ओवरराइट कर रही है।',
        'restoreButton': 'एंटी-रेड सुरक्षा पुनर्स्थापित करें',
        'restoring': 'पुनर्स्थापित हो रहा है…',
        'restoredOk': '✅ सुरक्षा सफलतापूर्वक पुनर्स्थापित हो गई।',
        'restoreFailed': 'पुनर्स्थापना विफल — कृपया पुनः प्रयास करें या सहायता से संपर्क करें।',
        'cooldown': 'पुनः पुनर्स्थापित करने से पहले कृपया एक क्षण प्रतीक्षा करें।',
    },
}

for lang, strings in TRANSLATIONS.items():
    p = f'/app/frontend/src/locales/{lang}.json'
    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if 'antiRed' in data:
        # Merge — don't blow away custom additions
        data['antiRed'].update(strings)
        action = 'UPDATED'
    else:
        data['antiRed'] = strings
        action = 'ADDED'
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'  {lang}: {action} antiRed.* ({len(strings)} keys)')

print('\nDone.')
