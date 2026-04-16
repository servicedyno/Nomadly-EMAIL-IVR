#!/usr/bin/env python3
"""Fix untranslated Cloud Phone (cp_*) keys in French language file."""

import re, json

# French translations stored as JSON to avoid Python quoting issues
FRENCH_FIXES = json.loads(r"""
{
  "cp_102": "'Veuillez sélectionner une vitesse parmi les boutons :',",
  "cp_115": "'Veuillez entrer un nombre entre 1 et 1440 minutes.',",
  "cp_131": "'Veuillez sélectionner un ID appelant dans la liste.',",
  "cp_141": "'📝 <b>Générer un audio à partir d\\'un modèle</b>\\\\n\\\\nChoisissez une catégorie de modèle ou écrivez votre propre script :',",
  "cp_160": "'Veuillez sélectionner un préréglage ou entrer des chiffres :',",
  "cp_177": "'Veuillez sélectionner un modèle parmi les boutons.',",
  "cp_205": "'Veuillez sélectionner une vitesse parmi les boutons :',",
  "cp_231": "'Ce forfait n\\'est pas encore disponible. Veuillez choisir parmi les forfaits disponibles ci-dessous.',",
  "cp_24": "'Veuillez sélectionner un numéro valide dans la liste.',",
  "cp_27": "'Veuillez entrer un numéro de téléphone valide commençant par + et 10-15 chiffres.\\\\n<i>Exemple : +33612345678</i>',",
  "cp_45": "'Veuillez sélectionner une catégorie parmi les boutons.',",
  "cp_58": "'Veuillez sélectionner un modèle parmi les boutons.',",
  "cp_76": "'Veuillez entrer un numéro de transfert valide.',",
  "cp_85": "'Veuillez sélectionner un préréglage ou entrer des chiffres.',",
  "cp_273": "'🌐 Sélectionnez la langue pour votre message d\\'accueil vocal :\\\\n\\\\n<i>Le modèle sera prononcé dans cette langue.</i>',",
  "cp_274": "'✅ Texte mis à jour.\\\\n\\\\n🌐 Sélectionnez la langue pour votre message d\\'accueil vocal :\\\\n\\\\n<i>Le modèle sera prononcé dans cette langue.</i>',",
  "cp_284": "'🌐 Sélectionnez la langue pour votre message d\\'accueil :',",
  "cp_288": "'🌐 Sélectionnez la langue pour votre message d\\'accueil :',",
  "cp_303": "'🌐 Sélectionnez la langue pour votre message d\\'accueil SVI :\\\\n\\\\n<i>Le modèle sera prononcé dans cette langue.</i>',",
  "cp_304": "'✅ Texte mis à jour.\\\\n\\\\n🌐 Sélectionnez la langue pour votre message d\\'accueil SVI :\\\\n\\\\n<i>Le modèle sera prononcé dans cette langue.</i>',",
  "cp_314": "'🌐 Sélectionnez la langue pour votre message d\\'accueil SVI :',",
  "cp_321": "'🌐 Sélectionnez la langue pour votre message d\\'accueil SVI :',"
}
""")

# Read the file
with open('/app/js/lang/fr.js', 'r') as f:
    lines = f.readlines()

count = 0
for i, line in enumerate(lines):
    for key, new_value in FRENCH_FIXES.items():
        # Match the key at the start of the line (with whitespace)
        pattern = rf'^(\s+){key}\s*:\s*'
        m = re.match(pattern, line)
        if m:
            indent = m.group(1)
            lines[i] = f'{indent}{key}: {new_value}\n'
            count += 1
            print(f'✅ L{i+1} Fixed {key}')
            break

print(f'\nSimple fixes: {count}/{len(FRENCH_FIXES)}')

with open('/app/js/lang/fr.js', 'w') as f:
    f.writelines(lines)
print('Saved fr.js')
