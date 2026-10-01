#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cas de contrôle de l'appariement des sens.

`alignement.py` décide quelle phrase du Wiktionnaire illustre quelle traduction
de WikDict. C'est une fonction pure, sans fichier ni réseau, et c'est le point
dont dépend la promesse « une phrase par signification » : elle mérite d'être
éprouvée seule, sur des cas qu'on peut lire.

Tous les exemples ci-dessous sont réels, relevés dans les données. Les
définitions WikDict sont reproduites telles que `construire.py:couper()` les
laisse — ellipse comprise quand elles dépassent 130 signes.

    python build/essais_alignement.py
"""

import sys

import alignement

CAS = []


def cas(nom, wikdict, wikt, attendu):
    CAS.append((nom, wikdict, wikt, attendu))


# ── Le cas ordinaire : les définitions sont identiques ──────────────────────

cas("un sens de chaque côté, identique",
    ["stehendes Gewässer, das von Land umgeben ist"],
    ["stehendes Gewässer, das von Land umgeben ist"],
    [0])

# ── L'ordre diffère : c'est pourquoi on n'apparie pas par rang ──────────────

cas("abbauen — trois sens, dans un ordre différent",
    ["Rohstoffe, Baustoffe vor allem durch Bergbau und ähnliche Technologien gewinnen",
     "(vor allem auch übertragen) verringern, beseitigen; mindern von Hindernissen, die Prozesse behindern",
     "bauliche und andere (auch zeitweilig errichteten) technische oder künstliche Anlagen, Einrichtungen, Aufbauten und Ähnliches…"],
    ["bauliche und andere (auch zeitweilig errichteten) technische oder künstliche Anlagen, Einrichtungen, Aufbauten und Ähnliches wieder wegräumen",
     "Rohstoffe, Baustoffe vor allem durch Bergbau und ähnliche Technologien gewinnen",
     "(vor allem auch übertragen) verringern, beseitigen; mindern von Hindernissen, die Prozesse behindern",
     "von komplexeren in einfachere Strukturen und Formen zerlegen",
     "sich körperlich oder geistig zurückentwickeln"],
    [1, 2, 0])

# ── La troncature : WikDict coupe à 130 signes ─────────────────────────────

cas("définition tronquée, appariée par son début",
    ["Cérémonie ou prestation réservée à un nouvel arrivant, consistant généralement à lui souhaiter la bienvenue et à l'aider dans…"],
    ["Cérémonie ou prestation réservée à un nouvel arrivant, consistant généralement à lui souhaiter la bienvenue et à l'aider dans son intégration ou ses démarches."],
    [0])

# ── Le préfixe de domaine, que wiktextract range à part ────────────────────

cas("« Musik: » d'un côté, topics de l'autre",
    ["Musik: Bezeichnung für Ton \"A\", und Abkürzung für A-Dur (Tonart und Akkord)"],
    ["Bezeichnung für Ton „A“, und Abkürzung für A-Dur (Tonart und Akkord)"],
    [0])

cas("« Zoologie: » et guillemets typographiques",
    ["Zoologie: schlangenförmiger Süßwasser- und Meerwasserfisch aus der Ordnung der Aalartigen (Anguilliformes)"],
    ["schlangenförmiger Süßwasser- und Meerwasserfisch aus der Ordnung der Aalartigen (Anguilliformes)"],
    [0])

# ── Reformulation légère : le recouvrement de vocabulaire tranche ──────────

cas("même sens, mots-outils différents",
    ["Lieu où sont accueillies les personnes"],
    ["Le lieu où l'on accueille les personnes"],
    [0])

# ── Ce qu'il ne faut surtout pas apparier ──────────────────────────────────

cas("deux sens sans rapport restent seuls",
    ["stehendes Gewässer, das von Land umgeben ist"],
    ["Bewegung der Oberfläche eines Meeres oder Sees",
     "Sammelbegriff für alle sehr großen zusammenhängenden Gewässer",
     "hohe Welle"],
    [None])

cas("aucun sens du côté Wiktionnaire",
    ["stehendes Gewässer, das von Land umgeben ist"],
    [],
    [None])

cas("le Wiktionnaire en distingue huit, WikDict trois : pas de reliquat",
    ["une chose tout à fait particulière et sans rapport",
     "Rohstoffe durch Bergbau gewinnen",
     "autre chose encore, également sans rapport"],
    ["Rohstoffe durch Bergbau gewinnen",
     "sens un", "sens deux", "sens trois", "sens quatre",
     "sens cinq", "sens six", "sens sept"],
    [None, 0, None])

# ── Le dernier debout : deux listes courtes, un seul orphelin de chaque côté ─

cas("dernier debout, listes courtes",
    ["stehendes Gewässer, das von Land umgeben ist",
     "une formulation que rien ne rapproche de l'autre"],
    ["stehendes Gewässer, das von Land umgeben ist",
     "une tournure entièrement différente mais seule restante"],
    [0, 1])

cas("pas de dernier debout au-delà de trois sens",
    ["alpha bravo charlie delta", "echo foxtrot golf hotel",
     "india juliett kilo lima", "mike november oscar papa"],
    ["alpha bravo charlie delta", "quebec romeo sierra tango",
     "uniform victor whisky xray", "yankee zoulou alfa bravo"],
    [0, None, None, None])

# ── Un sens Wiktionnaire ne sert qu'une fois ───────────────────────────────

cas("deux définitions WikDict identiques, un seul sens en face",
    ["stehendes Gewässer, das von Land umgeben ist",
     "stehendes Gewässer, das von Land umgeben ist"],
    ["stehendes Gewässer, das von Land umgeben ist"],
    [0, None])


# ── Choix de l'entrée selon la lecture ──────────────────────────────────────

CAS_LECTURE = [
    ("laut adjectif",
     "adj", "", [{"p": "adj", "g": ""}, {"p": "prep", "g": ""}], 0),
    ("laut préposition",
     "preposition", "", [{"p": "adj", "g": ""}, {"p": "prep", "g": ""}], 1),
    ("See masculin, le lac",
     "n", "masc", [{"p": "noun", "g": "masc"}, {"p": "noun", "g": "fem"}], 0),
    ("See féminin, la mer",
     "n", "fem", [{"p": "noun", "g": "masc"}, {"p": "noun", "g": "fem"}], 1),
    ("nature absente du Wiktionnaire : on s'abstient",
     "v", "", [{"p": "noun", "g": "neut"}], None),
    ("deux noms de même genre : on s'abstient",
     "n", "masc", [{"p": "noun", "g": "fem"}, {"p": "noun", "g": "fem"}], None),
    ("nature inconnue : la première entrée",
     "", "", [{"p": "noun", "g": "neut"}, {"p": "verb", "g": ""}], 0),
]


def main():
    fautes = 0

    print("Appariement des sens\n")
    for nom, wikdict, wikt, attendu in CAS:
        obtenu = alignement.apparier(wikdict, wikt)
        bon = obtenu == attendu
        fautes += 0 if bon else 1
        print(f"  {'ok ' if bon else 'NON'} {nom}")
        if not bon:
            print(f"        attendu {attendu}, obtenu {obtenu}")

    print("\nChoix de l'entrée selon la lecture\n")
    for nom, nature, genre, enregistrements, attendu in CAS_LECTURE:
        obtenu = alignement.choisir_enregistrement(nature, genre, enregistrements)
        rang = enregistrements.index(obtenu) if obtenu is not None else None
        bon = rang == attendu
        fautes += 0 if bon else 1
        print(f"  {'ok ' if bon else 'NON'} {nom}")
        if not bon:
            print(f"        attendu {attendu}, obtenu {rang}")

    total = len(CAS) + len(CAS_LECTURE)
    print(f"\n{total - fautes}/{total} cas conformes")
    return 1 if fautes else 0


if __name__ == "__main__":
    sys.exit(main())
