# STAR Rennes

## Présentation

Cette intégration amène le **STAR**, le réseau de bus et de métro de Rennes Métropole, dans Gladys : les **prochains passages en temps réel** aux arrêts de votre choix (trois dans le formulaire, jusqu’à 20 de plus avec un bouton), filtrés par ligne et direction, avec le **retard** du prochain bus ; le **trafic** de six lignes au plus, bus ou métro (normal, perturbation mineure, majeure ou bloquante, métro en panne, avec les alertes du STAR) ; et l’**état du métro** : ses deux lignes, les stations fermées, les ascenseurs et escaliers mécaniques hors service. Chaque arrêt et chaque ligne devient un appareil à afficher sur un tableau de bord et à utiliser dans les scènes.

Les données viennent du **portail open data officiel du STAR** (Keolis Rennes, pour Rennes Métropole), sous licence ODbL : ni compte, ni clé. Les arrêts sont lus toutes les minutes par défaut (toutes les 10 minutes quand un arrêt n’annonce rien, la nuit), le trafic et le métro toutes les 5 minutes. Les lignes et arrêts du réseau sont gardés par l’intégration et relus une fois par jour et une fois par semaine.

C’est une intégration **cloud** : elle contacte `data.explore.star.fr`. Rien d’autre ne quitte votre réseau.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Rien d’autre : l’open data du STAR ne demande ni compte ni clé.

## Configuration

| Champ              | Quoi saisir                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrêt 1, 2, 3      | Le nom de l’arrêt (« République », « Gares ») pour tous les côtés de la rue et la station de métro, ou un identifiant (« 1242 ») pour un côté ou un quai. |
| Ligne              | Seulement cette ligne : « C1 », « 11 », « a » ou « b » pour le métro. Vide : toutes les lignes de l’arrêt.                                                |
| Direction          | Seulement les destinations contenant ces mots : « Chantepie », « Poterie \| Gaîté ». Vide : les deux sens.                                                |
| Lignes suivies     | Les lignes dont vous suivez le trafic, six au plus : « a, b, C1, 11 ».                                                                                    |
| Lecture des arrêts | Toutes les 30 secondes, minutes, 2 minutes ou 5 minutes.                                                                                                  |
| Langue des textes  | Noms des appareils, résumés et sorties des scènes. Les noms d’arrêts et les alertes du STAR restent en français.                                          |

Le bouton **Chercher un arrêt** donne les noms exacts des arrêts contenant quelques mots, avec l’identifiant de chaque côté de la rue et de chaque quai de métro, et les lignes et destinations qui y sont annoncées (« 1242 → 11 La Poterie, C1 Chantepie ») : copiez l’identifiant du côté où vous montez. **Tester la connexion** lit le réseau, chaque arrêt et chaque ligne tout de suite, et le nombre d’appels restants aujourd’hui.

Plus d’arrêts que les trois du formulaire (domicile, travail…) : **Ajouter un arrêt** reprend les trois mêmes champs — arrêt, ligne, direction — et suit jusqu’à 20 arrêts de plus. **Lister les arrêts** montre tous les arrêts suivis, numérotés ; **Retirer un arrêt** prend ce numéro (ou le nom). Les arrêts ajoutés sont gardés dans la configuration de Gladys et suivent donc ses sauvegardes.

Sans clé, le portail autorise un nombre d’appels par jour et par adresse internet (20 000 à l’écriture de cette intégration). Avec beaucoup d’arrêts, l’intégration les lit moins souvent pour rester bien en dessous, et le signale dans son état.

## Utilisation

### Appareils

Dans l’onglet **Découvrir**, créez les appareils voulus :

- **STAR \<arrêt\>** : le prochain passage en texte (« C1 → Chantepie · 6 min (+1 min de retard) »), l’attente du prochain passage et du suivant, et le retard du prochain bus sur son horaire (minutes) ;
- **STAR ligne \<ligne\>** ou **STAR métro \<ligne\>** : le trafic en texte (« Perturbation majeure : Travaux ») et le nombre de perturbations majeures ou bloquantes en cours.

Quand un bus n’est pas encore localisé, le STAR donne son horaire théorique : l’intégration le précise (« horaire théorique »). La nuit, sans aucun passage, les attentes gardent leur dernière valeur.

### Widgets du tableau de bord

![Le widget Départs STAR à République, le widget Trafic STAR de quatre lignes et le widget Métro STAR (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-star-rennes/main/docs/assets/widgets.fr.png)

- **Départs STAR** : les prochains passages d’un arrêt, en compact : une ligne par ligne de bus et destination, avec ses prochains passages à la suite (« 1 · 9 · 27 min », « 10:32 »), les horaires théoriques en gris. Le réglage **Trajets affichés** fixe le nombre de lignes. Choisissez un arrêt suivi, ou saisissez n’importe quel arrêt (et une ligne) dans les réglages du widget. Avec **Plusieurs arrêts**, un seul widget affiche plusieurs appareils arrêts : les appareils d’un même arrêt sont réunis sous son nom ; pour des arrêts différents, chaque ligne commence par son arrêt.
- **Trafic STAR** : l’état de chaque ligne, puis les alertes du STAR avec leurs dates ; touchez une carte pour le texte complet et le lien vers star.fr. Les lignes suivies, ou celles saisies dans les réglages.
- **Métro STAR** : les lignes a et b (en service, ou en panne avec la reprise prévue), les stations fermées, puis les ascenseurs et escaliers mécaniques hors service, station par station. Le réglage **Équipements affichés** ne garde que les ascenseurs, par exemple.

### Scènes

Déclencheurs, une fois par changement (la première lecture sert seulement de référence) :

- **STAR : bus ou métro bientôt** : un passage à un arrêt suivi part dans 2, 3, 5, 10, 15 ou 20 minutes.
- **STAR : ligne perturbée** : une ligne suivie reçoit une alerte majeure ou bloquante en cours, ou son métro tombe en panne.
- **STAR : ligne revenue à la normale** : elle circule de nouveau normalement.
- **STAR : nouvelle alerte trafic** : le STAR publie une alerte sur une ligne suivie (prévue ou en cours).
- **STAR : ascenseur du métro en panne** et **STAR : ascenseur du métro réparé** : un ascenseur ou un escalier mécanique d’une station de métro (ou de son parc relais), à filtrer par station et par type. Aucune ligne n’a besoin d’être suivie.

Chacun donne une phrase toute prête, `{{triggerEvent.data.summary}}`, et ses valeurs (ligne, destination, heure, retard, titre, station…). Les actions **STAR : prochains passages** et **STAR : trafic d’une ligne** renvoient le même genre de valeurs, à mettre dans un message ou à tester dans une condition.

Exemples :

- Quand le C1 vers Chantepie part de République dans 5 minutes → allumer la lampe de l’entrée en vert.
- Quand l’ascenseur de votre station de métro tombe en panne → envoyer le résumé sur votre téléphone avant de partir.
- Chaque jour de semaine à 7 h 30 → lire les prochains passages de votre arrêt et les faire annoncer par l’enceinte de la cuisine.

### Transport

Cloud uniquement : les données viennent d’internet. Seuls les arrêts et lignes que vous suivez sont demandés au portail du STAR.

## Dépannage

- **« Inconnu du STAR »** : utilisez **Chercher un arrêt**, puis copiez le nom exact ou un identifiant ; pour une ligne, son nom comme sur les bus (« C1 », « 11 »), « a » ou « b » pour le métro.
- **Aucun passage la nuit** : le réseau dort ; l’arrêt est lu toutes les 10 minutes jusqu’à l’annonce du premier passage.
- **« Quota quotidien du portail open data STAR atteint »** : trop d’appels aujourd’hui depuis votre adresse internet (d’autres logiciels peuvent la partager) ; les lectures reprennent après minuit (UTC). Suivez moins d’arrêts, ou lisez-les moins souvent.
- **« Le portail open data STAR ne répond pas »** : l’intégration réessaie à chaque lecture ; les derniers passages restent sur les widgets.
- **Pour signaler un problème** : appuyez sur **Diagnostic**, puis copiez les lignes commençant par « STAR diagnostic » de l’onglet Journaux dans une issue GitHub ou une réponse sur le forum, avec les versions de Gladys et de l’intégration.
