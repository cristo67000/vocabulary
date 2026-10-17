# Reprendre un lot d'exemples anglais

Le travail : `build/citations/a-traduire/lot-NNN.txt` → `build/citations/fr/lot-NNN.txt`,
une ligne par ligne du lot, dans le même ordre, sans les lignes de commentaire.
Le lecteur est un **francophone qui apprend l'anglais d'aujourd'hui**.

## Les trois genres

| Ligne à faire | Ce qu'on écrit |
|---|---|
| `T id \| mot (nature) \| citation avec ⟦mot⟧` | `id traduction française` — ou `id = phrase neuve \| traduction` si la citation est mauvaise mais le sens utile — ou `id ✗` |
| `R id \| mot (nature) \| sens ‖ citation ancienne` | `id = phrase anglaise contemporaine avec le ⟦mot⟧ \| traduction` — ou `id ✗` |
| `N id \| mot (nature) \| sens` | `id = phrase anglaise contemporaine avec le ⟦mot⟧ \| traduction` — ou `id ✗` |

Une phrase neuve (`= …`) porte **exactement une** marque ⟦ ⟧, autour du mot (ou de la forme
fléchie, ou de l'expression) qu'elle illustre ; `|` entouré d'espaces sépare l'anglais du français.

## Traduire (T)

- Une traduction **naturelle**, du français d'aujourd'hui, pas un mot-à-mot ; mais le mot
  ⟦marqué⟧ doit y être rendu par son équivalent juste dans ce sens (c'est ce que le lecteur
  vient chercher).
- Garder le registre : familier → familier, technique → technique ; tutoiement ou vouvoiement
  selon la situation.
- Les noms propres restent ; les unités et les sigles s'expliquent seulement si c'est court.
- Un fragment (« a defensive missile system ») se traduit en fragment.
- Les vers se traduisent en gardant les ` / ` de séparation.

## Remplacer (R) et ajouter (N)

- Une phrase **courte (8 à 15 mots), contemporaine, plausible**, qu'on pourrait entendre ou
  lire aujourd'hui, et qui montre le sens donné — pas un autre sens du même mot.
- Orthographe britannique (colour, realise, travelling), apostrophe typographique `’`.
- Si le sens est mort, purement historique ou trop obscur pour qu'une phrase d'aujourd'hui
  ait du sens : `✗`.

## Écarter (✗)

- paroles de chanson (référence avec un groupe, un album, un titre de chanson…) ;
- contenu sexuel explicite, violence complaisante, injure, polémique politique ou religieuse ;
- fragment illisible, renvoi (« See also… »), liste de mots, phrase qui n'illustre pas le sens ;
- citation dont le mot ⟦marqué⟧ n'est pas le mot de la fiche ou n'est pas dans ce sens.

## Typographie française

Apostrophe `’`, guillemets « … » (espaces simples), points de suspension `…`, tiret `—` ;
espace simple avant `? ! : ;`. Pas de ⟦ ⟧ dans le français.

## Contrôle

    python build/citations.py verifier NNN [NNN…]

Il signale un identifiant manquant, en trop ou en double, une R/N laissée en simple
traduction, une marque absente ou double. Un lot n'est fini que « conforme ».

## Ensuite

`python build/construire.py --sans-budget` applique tout (≈ 5 min) et réécrit
`citations/attente.json` ; `python build/citations.py etat` dit ce qui reste.
Ne relancer `citations.py lots` qu'une fois **tous** les lots en cours rendus : la commande
efface et renumérote les lots à faire.
