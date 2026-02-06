# Gmail to Asana

Extension Chrome/Firefox pour créer des tâches Asana directement depuis Gmail.

## Fonctionnalités

- Créer une tâche Asana depuis n'importe quel email
- Lier un email à une tâche existante (ajout en commentaire)
- Joindre les pièces jointes de l'email à la tâche
- Joindre le fichier .eml complet
- Support des champs personnalisés Asana
- Sélection du workspace, projet, assigné, date d'échéance, tags
- Notifications navigateur lors de la création
- Interface en français et anglais

## Installation

### Chrome
1. Télécharger `gmail-to-asana-chrome-vX.X.X.zip` depuis les [Releases](https://github.com/Sinepel/Gmail-To-Asana/releases)
2. Extraire le zip
3. Aller sur `chrome://extensions`
4. Activer le "Mode développeur"
5. Cliquer "Charger l'extension non empaquetée"
6. Sélectionner le dossier extrait

### Firefox
1. Télécharger `gmail-to-asana-firefox-vX.X.X.xpi` depuis les [Releases](https://github.com/Sinepel/Gmail-To-Asana/releases)
2. Aller sur `about:addons`
3. Cliquer sur l'engrenage → "Installer un module depuis un fichier..."
4. Sélectionner le fichier .xpi

## Configuration

1. Cliquer sur l'icône de l'extension
2. Créer un Personal Access Token sur [Asana](https://app.asana.com/0/my-apps)
3. Coller le token et enregistrer
4. Configurer les préférences (workspace/projet par défaut, options, langue)

## Utilisation

1. Ouvrir un email dans Gmail
2. Cliquer sur le bouton "Asana" dans la barre d'outils
3. Remplir les détails de la tâche
4. Cliquer "Créer la tâche" ou "Ajouter en commentaire"

## Développement

```bash
# Build les extensions
node build/build.js

# Les fichiers sont générés dans dist/
# - dist/chrome/ : Extension Chrome (dossier)
# - dist/firefox/ : Extension Firefox (dossier)
# - dist/gmail-to-asana-chrome-vX.X.X.zip : Package Chrome
# - dist/gmail-to-asana-firefox-vX.X.X.xpi : Package Firefox
```

## Licence

MIT
