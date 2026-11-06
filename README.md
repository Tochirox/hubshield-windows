# HubShield Windows

Première base de l’adaptation PC de HubShield Mobile. L’APK `HubShield-1.1.0.apk` a été consulté en lecture seule. Les éléments confirmés incluent le nom HubShield, l’identité sombre `#09090B`, des couleurs violettes et les libellés français autour de la navigation et de la protection. L’APK est une application Expo compilée ; son code source React Native n’est pas inclus dans ce dépôt.

## Développement

Prérequis : Node.js 22 ou plus récent et npm.

```sh
npm ci
npm run dev
npm run build
```

`npm run dev` démarre Vite et Electron avec rechargement de l’interface ; `npm run build` produit la version compilée. Les vues de site sont des `WebContentsView` Chromium séparées des composants React. Les favoris et l’historique sont conservés dans le dossier de données HubShield de l’utilisateur ; les onglets privés utilisent des sessions temporaires séparées.

## Windows

`npm run dist:win` produit l’installateur NSIS `HubShield-Setup.exe` et le binaire portable `HubShield-Portable.exe` dans `release/`. Il faut exécuter cette commande dans un environnement Windows pour obtenir des exécutables Windows. Le workflow GitHub Actions `.github/workflows/windows-build.yml` compile et publie les EXE comme artefact téléchargeable sur un lancement manuel ou un tag `v*`.

Aucun EXE Windows n’est inclus dans ce dépôt pour l’instant : le poste de développement actuel est Termux/Android. La signature Windows et la publication de mises à jour automatiques ne sont pas configurées.

## État de la première version

Fonctionnels : fenêtre et contrôles natifs dessinés, onglets Chromium multiples, navigation URL/recherche, retour/avance/actualisation, accueil, favoris persistants, historique persistant, téléchargements de session, onglets privés temporaires, affichage du DOM HTML et outils Chromium.

Les permissions des sites sont refusées par défaut. `contextIsolation`, `sandbox`, `webSecurity` et `nodeIntegration: false` sont appliqués aux pages web. L’interface indique explicitement que le filtrage publicitaire/anti-traqueur et les scripts personnalisés ne sont pas encore implémentés. La couleur d’accent et le moteur de recherche (Google, DuckDuckGo ou Bing) sont réglables et conservés localement. Les mises à jour sécurisées, éditeur de scripts et intégrations IA restent à construire.
