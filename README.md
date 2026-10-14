# Vocabulary — apprendre l'anglais hors ligne

Application web progressive (PWA), sans compte ni serveur, qui **apprend
l'anglais à un francophone** : le vocabulaire et les expressions d'aujourd'hui,
l'argot, les termes de la tech, et la révision espacée pour les retenir. Elle
s'installe sur un téléphone ou un ordinateur et fonctionne ensuite sans
internet.

**L'anglais d'abord** (depuis la 1.2) : une fiche anglaise est complète
(définitions anglaises, prononciation, exemples traduits, formes, synonymes,
famille) ; une fiche française n'est qu'un **pont vers l'anglais** — ses
traductions, sens par sens, avec un repère de quelques mots quand il faut
distinguer les sens, et les phrases de Tatoeba, l'anglais en premier. Ni
définition française entière, ni citation de roman, ni conjugaison,
prononciation ou synonymes français : un francophone les sait.

**En ligne pour essai** : https://cristo67000.github.io/vocabulary/ (GitHub
Pages). Elle s'installe depuis le navigateur du téléphone (« Ajouter à l'écran
d'accueil »). **Pas encore sur le Play Store** : la fiche est préparée dans
`docs/FICHE-PLAY-STORE.md`.

## Ce qu'elle fait

- **Dictionnaire** : 83 554 entrées anglaises et 113 151 françaises (paquet
  complet, 70 Mo, téléchargé en arrière-plan ; un noyau de 23 000 mots
  anglais et 17 000 français, 25 Mo, est là dès l'installation).
  Définitions anglaises, traductions, prononciation britannique, formes,
  marques d'usage, phrases d'exemple traduites, familles de mots, orthographe
  britannique en vedette (« colour », « US : color »). Côté français, seuls
  les mots qui ont une traduction anglaise restent ; deux sens qui donnent la
  même traduction n'en font plus qu'un.
- **Modules** (`data/modules.json`, 3 052 fiches, dont 2 876 à vedette
  anglaise) : mots courants et actuels par thèmes, britannique ou américain,
  argot et abréviations (mots crus masqués d'office), tech (IA, programmation,
  codage — glossaire de Code en clair, et termes anglais de FranceTerme mis en
  vedette avec leur équivalent officiel), expressions, proverbes, verbes à
  particule, faux amis. Les fiches à vedette française — nos expressions, le
  français familier, nos abréviations — sont rangées à part, sous « Dire en
  anglais », et montrent l'anglais d'abord.
- **Dessins d'apprentissage** (`js/schemas/apprendre.js`, 16 dessins) :
  prépositions, since/for/ago, temps, comparatifs, quantités, nombres,
  registres, maison, corps, famille, heure, dates, météo, directions.
- **Phrases et dialogues** (`data/conversation.json`) : 174 phrases et
  25 dialogues en 14 situations, à écouter, apprendre et jouer.
- **Apprendre** : révision espacée — comprendre l'anglais, et savoir le dire —,
  ateliers d'exercices (reconnaître, écrire, traduire, phrase à trou, famille,
  verbes irréguliers, pluriels, dictée), notes et exemples personnels, mots et
  phrases à soi, progrès (« sus par cœur » = l'anglais produit de mémoire),
  sauvegarde dans un fichier. Aucun exercice ne fait écrire ni écouter du
  français pour lui-même.
- **Voix** : synthèse vocale du système, britannique d'abord ; on n'écoute que
  l'anglais (sur une fiche française, ses traductions). Jamais une voix d'une
  langue pour l'autre.

## Lancer en local

```
python build/serveur.py 8151
```

puis ouvrir http://localhost:8151/. Pour développer sans le service worker
(qui sert sinon la version en cache) : http://localhost:8151/?sans-sw — sur
localhost seulement.

## Reconstruire les données

```
python build/telecharger.py          # sources (≈ 2 Go, dans build/sources/)
python build/wiktionnaire.py         # extraits du Wiktionnaire (≈ 10 min)
python build/construire.py --sans-budget   # paquets du dictionnaire (≈ 4 min)
python build/modules.py              # fiches des modules (build/contenu/*.txt)
python build/conversation.py         # phrases et dialogues (build/conversation.txt)
python build/verifier.py             # contrôle des paquets + essais du code
python build/generer-icones.py       # icônes ; build/generer-partage.py : aperçu
```

Traductions rattachées au mauvais sens : WikDict devine à quel sens
appartient chaque traduction et se trompe parfois (« run » courir recevait
« couler »). La construction confronte ce choix aux tables que le
Wiktionnaire rattache avec certitude à un sens, et remet la traduction sous le
sens qu'elle sert, ou la retire si ce sens n'est pas affiché. Garde-fous :
seulement pour un sens apparié qui a sa propre table, jamais quand les deux
sens se ressemblent. Chaque déplacement est noté dans
`build/traductions-deplacees.tsv` (environ 1 100 en anglais, 470 en
français ; justes à près de 9 sur 10 sur échantillon, les autres changent de
sens sans quitter la fiche).

Corrections à la main, relues à chaque construction :
`build/traductions_ecartees.txt` (une traduction que la source rattache au
mauvais sens — « housewife → garce ») et `build/exclusions.txt` (une famille
de mots rapprochée à tort). L'ordre des natures et des sens suit le
Wiktionnaire, qui les range par importance ; WikDict n'en fournit que la
matière.

Toute modification du code ou des données livrées avec la coquille demande
d'augmenter `VERSION` dans `sw.js` **et** la balise `application-version`
d'`index.html`.

## Essais

```
node build/essais.mjs        # correction des réponses, choix de l'exercice, révision
node build/essais_i18n.mjs   # libellés français et anglais
```

Les recettes navigateur héritées de Wortschatz attendent leur adaptation dans
`build/heritage-wortschatz/`.

## Sources et licences

Voir `confidentialite.html` et `build/SOURCES.md` : WikDict, Wiktionary et
Wiktionnaire (CC BY-SA), Tatoeba (CC BY 2.0 FR), wordfreq (CC BY-SA 4.0),
FranceTerme (Licence Ouverte), Code en clair. Contenus rédigés pour
l'application (fiches des modules, phrases et dialogues) : CC BY-SA 4.0,
écrits par un assistant d'écriture, non relus par un locuteur natif.
