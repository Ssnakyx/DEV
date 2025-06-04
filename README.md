# 🎮 Multiplayer Mini-Games Platform

Une plateforme de jeux multijoueurs en temps réel , construite avec Go (backend) et JavaScript vanilla (frontend).

## 🌟 Fonctionnalités

### 🎯 Jeux Disponibles
- **Tic Tac Toe** - Le classique jeu de morpion
- **Connect 4** - Alignez 4 pions pour gagner
- **Pierre Papier Ciseaux** - Le jeu de hasard légendaire
- **Devine le Nombre** - Devinez un nombre entre 1 et 100
- **Devine le Mot** - Jeu de pendu collaboratif
- **Dots & Boxes** - Complétez des boîtes pour marquer des points



### 🔧 Fonctionnalités Techniques
- **WebSocket** pour la communication temps réel
- **Reconnexion automatique** en cas de déconnexion
- **Gestion des salles** avec codes uniques
- **Système hôte/invité** pour la gestion des parties
- **Nettoyage automatique** des salles vides
- **Interface responsive** pour mobile et desktop

## 🚀 Installation et Démarrage

### Prérequis
- Go 1.19 ou plus récent
- Un navigateur web moderne

### Installation

1. **Clonez le repository**
\`\`\`bash
git clone <https://github.com/Ssnakyx/DEV.git>
cd DEV
\`\`\`

2. **Installez les dépendances Go**
\`\`\`bash
go mod tidy
\`\`\`

3. **Démarrez le serveur**
\`\`\`bash
go run server.go
\`\`\`

4. **Accédez à l'application**
- Local: `http://localhost:8080`
- Réseau local: `http://[VOTRE-IP]:8080`

## 🎮 Comment Jouer

### 1. Créer une Partie
1. Entrez votre nom d'utilisateur sur la page d'accueil
2. Choisissez un jeu
3. Cliquez sur "Créer une Partie"
4. Partagez le code de la salle avec un ami

### 2. Rejoindre une Partie
1. Entrez votre nom d'utilisateur
2. Entrez le code de la salle
3. Cliquez sur "Rejoindre la Partie"



**Amusez-vous bien ! 🎮**
