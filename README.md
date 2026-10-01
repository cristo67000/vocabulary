# Vocabulary — dictionnaire anglais ⇄ français hors ligne

Application web progressive (PWA), sans compte ni serveur, pour **traduire et
apprendre** l'anglais et le français dans les deux sens. Elle s'installe sur
un téléphone ou un ordinateur et fonctionne ensuite sans internet.

**En ligne pour essai** : https://cristo67000.github.io/vocabulary/ (GitHub
Pages). Elle s'installe depuis le navigateur du téléphone (« Ajouter à l'écran
d'accueil »). **Pas encore sur le Play Store** : la fiche est préparée dans
`docs/FICHE-PLAY-STORE.md`.

## Ce qu'elle fait

- **Dictionnaire** : 83 553 entrées anglaises et 117 672 françaises (paquet
  complet, 107 Mo, téléchargé en arrière-plan ; un noyau de 17 000 + 18 000
  mots, 28 Mo, est là dès l'installation). Définitions, traductions,
  prononciation britannique, formes, marques d'usage, phrases d'exemple
  traduites, familles de mots, orthographe britannique en vedette (« colour »,
  « US : color »).
- **Modules** (`data/modules.json`, 2 483 fiches) : mots courants et actuels
  par thèmes, britannique ou américain, argot et abréviations (mots crus
  masqués d'office), tech (IA, programmation, codage — glossaire de Code en
  clair et termes officiels FranceTerme), expressions, proverbes, verbes à
  particule, faux amis.
- **Dessins d'apprentissage** (`js/schemas/apprendre.js`, 16 dessins) :
  prépositions, since/for/ago, temps, comparatifs, quantités, nombres,
  registres, maison, corps, famille, heure, dates, météo, directions.
- **Phrases et dialogues** (`data/conversation.json`) : 174 phrases et
  25 dialogues en 14 situations, à écouter, apprendre et jouer.
- **Apprendre** : révision espacée dans les deux sens, ateliers d'exercices
  (reconnaître, écrire, traduire, phrase à trou, famille, verbes irréguliers,
  pluriels, écoute), notes et exemples personnels, mots et phrases à soi,
  progrès, sauvegarde dans un fichier.
- **Voix** : synthèse vocale du système, britannique d'abord pour l'anglais,
  de France d'abord pour le français ; jamais une voix d'une langue pour
  l'autre.

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
