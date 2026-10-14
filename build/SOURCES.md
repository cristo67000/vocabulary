# Provenance et licences des données

Vocabulary met en forme, pour un usage hors ligne, des ressources libres, et y
ajoute des contenus rédigés pour elle. Ce fichier dit lesquelles, sous quelle
licence, et ce que l'application en fait. Les mêmes mentions figurent dans
« À propos » (Réglages) et dans `confidentialite.html`, car les licences
l'exigent. Les moutures exactes des fichiers téléchargés sont notées dans
`build/sources/moutures.json` et reprises dans `data/manifeste.json`.

## 1. WikDict — l'ossature bilingue

- **Site** : <https://www.wikdict.com/> — Karl Bartel
- **Fichiers** : `eng-fra.tei`, `fra-eng.tei` (TEI « recommended »),
  `en-fr.sqlite3`, `fr-en.sqlite3`, `fr.sqlite3` (formes du français),
  depuis <https://download.wikdict.com/dictionaries/>
- **Licence** : CC BY-SA 3.0, annoncée dans l'en-tête TEI.
- **Amont** : Wiktionnaire, via DBnary (Gilles Sérasset).
- **Usage** : vedettes, nature, genre, formes fléchies, définitions abrégées,
  traductions sens par sens.

## 2. Wiktionary et Wiktionnaire, par wiktextract

- **Fichiers** (<https://kaikki.org/>, Tatu Ylonen) : le Wiktionary anglais
  (mots anglais, et mots français glosés en anglais) et le Wiktionnaire
  français complet.
- **Licence** : celles du Wiktionnaire, CC BY-SA et GFDL.
- **Usage** : pour les mots anglais, définitions anglaises, exemples sens par
  sens, marques d'usage (familier, argot, britannique…), prononciation
  britannique (transcription marquée UK ou RP d'abord, jamais une forme
  partielle), synonymes, dérivés, tableaux de formes ; pour les mots français
  (des ponts vers l'anglais depuis la 1.2), les traductions anglaises, les
  marques d'usage et un **repère** de quelques mots tiré de la définition,
  quand il faut distinguer les sens — ni citation, ni prononciation, ni
  conjugaison, ni synonymes français ne sont livrés. Aussi : traductions des
  mots que WikDict ignore, gloses croisées (l'argot et les abréviations,
  traduits par l'édition d'en face). Extraits compacts :
  `build/sources/wikt-en.jsonl`, `wikt-fr.jsonl`.

## 3. Tatoeba — les phrases d'exemple traduites

- **Fichiers** : `eng_sentences`, `fra_sentences`, `eng-fra_links`, depuis
  <https://downloads.tatoeba.org/exports/per_language/>
- **Licence** : CC BY 2.0 FR (quelques phrases CC0 1.0).
- **Usage** : paires anglais-français rattachées aux sens ; fréquence des mots
  en appoint de wordfreq.

## 4. wordfreq — la fréquence d'usage

- <https://github.com/rspeer/wordfreq> — Robyn Speer ; données CC BY-SA 4.0.
- **Usage** : rang de fréquence de chaque vedette (sous-titres, presse,
  réseaux sociaux, Wikipédia) → niveaux « premiers pas », « courant »,
  « étendu », « rare », et choix du noyau.

## 5. FranceTerme — les termes officiels

- Base des termes recommandés au *Journal officiel* par la Commission
  d'enrichissement de la langue française, sur data.gouv.fr.
- **Licence** : Licence Ouverte / Open Licence (Etalab).
- **Usage** : les termes anglais du numérique et les anglicismes courants,
  mis en vedette avec leur équivalent français officiel et sa définition
  (modules « Tech » et « Mots courants et actuels ») ; un terme qui a déjà sa
  fiche anglaise y reçoit l'équivalent officiel parmi ses traductions.

## 6. Code en clair — le glossaire du codage

- Glossaire du même auteur : 399 termes définis en français et en anglais,
  165 schémas (`js/schemas/*.js`, moteur `js/schema.js`).
- **Usage** : module « Tech ».

## 7. Contenus rédigés pour l'application

- **Fiches des modules** : `build/contenu/*.txt` (mots courants et actuels,
  britannique ou américain, argot et abréviations, IA, expressions, faux amis,
  dessins) ; **dessins d'apprentissage** : `js/schemas/apprendre.js` ;
  **phrases et dialogues** : `build/conversation.txt` ; **exemples des fiches
  anglaises** : `build/citations/fr/lot-*.txt` (`build/citations.py`) —
  traduction française des citations du Wiktionary pour les mots les plus
  courants, exemples contemporains rédigés à la place des citations
  archaïques ou pour les sens qui n'en avaient aucun, citations écartées
  (paroles de chansons protégées, contenus sexuels, violents ou polémiques,
  sens obsolètes).
- **Licence** : CC BY-SA 4.0 (les traductions de citations restent soumises à
  la licence du Wiktionary, CC BY-SA).
- Rédigés par un assistant d'écriture (Claude, d'Anthropic), contrôlés par
  programme (structure, renvois, parité des deux langues), **non relus par un
  locuteur natif** — ce que chaque fiche dit.

## Ce que nous n'utilisons pas

Les dictionnaires d'éditeurs (Oxford, Cambridge, Collins, Larousse, Robert)
sont commerciaux et interdisent l'extraction : aucun n'est présent. Les listes
de vocabulaire des certifications (CECRL) sont protégées : les niveaux affichés
sont des rangs de fréquence, pas des niveaux A1-C2. Lexique 3.83 est
téléchargé par `telecharger.py` mais n'entre pas dans les données livrées.
