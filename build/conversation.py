#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construction de `data/conversation.json` — « Phrases et dialogues ».

La source est `build/conversation.txt`, écrite pour être relue et corrigée
à la main (son format est décrit en tête du fichier). Ce script la lit, la
contrôle et écrit le JSON que lit `js/conversation.js` :

    { format: 'vocabulary-conversation', version, construit, licence,
      themes:    [ { id, fr, en } ],
      phrases:   [ { id: 'ph-<thème>-<slug>', theme, fr, en,
                     situation?: {fr, en}, variantes?: {fr: [], en: []},
                     registre?: 'poli' | 'familier' } ],
      dialogues: [ { id: 'dg-<thème>-<slug>', theme, registre, titre: {fr, en},
                     roles: { A: {fr, en}, B: {fr, en} },
                     repliques: [ { id: 'r1', qui: 'A' | 'B', en, fr,
                                    phrase?: 'ph-…' } ] } ] }

Contrôles : identifiants uniques, thèmes connus, deux textes partout, renvois
`=> slug` vers une phrase existante du même thème, répliques alternées entre
deux rôles, textes pas trop longs pour l'application (240 signes).

Usage : python build/conversation.py
"""

import json
import re
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

RACINE = Path(__file__).resolve().parent
SOURCE = RACINE / "conversation.txt"
SORTIE = RACINE.parent / "data" / "conversation.json"

REGISTRES = {"", "poli", "familier"}
TEXTE_MAX = 240


def simple(texte):
    """Un texte sans casse ni ponctuation, pour comparer deux phrases."""
    return " ".join(re.sub(r"[^\w’' ]+", " ", texte.lower()).split())


def deux(valeur, ligne):
    """« français | anglais » → (fr, en)."""
    if "|" not in valeur:
        raise SystemExit(f"conversation.txt:{ligne} : « français | anglais » attendu")
    fr, en = (x.strip() for x in valeur.split("|", 1))
    return fr, en


def lire():
    themes, phrases, dialogues = [], [], []
    theme = None
    courant = None          # la phrase ou le dialogue en cours
    for numero, brute in enumerate(SOURCE.read_text(encoding="utf-8").splitlines(), 1):
        ligne = brute.strip()
        if not ligne or ligne.startswith("#"):
            continue
        if ligne.startswith("=="):
            ident, fr, en = (x.strip() for x in ligne[2:].split("|"))
            theme = {"id": ident, "fr": fr, "en": en}
            themes.append(theme)
            courant = None
            continue
        if theme is None:
            raise SystemExit(f"conversation.txt:{numero} : contenu avant le premier thème")
        m = re.fullmatch(r"\*\s+([\w-]+)(?:\s+\[(\w*)\])?", ligne)
        if m:
            courant = {"sorte": "phrase", "slug": m.group(1), "theme": theme["id"],
                       "registre": m.group(2) or "", "_ligne": numero}
            phrases.append(courant)
            continue
        m = re.fullmatch(r">\s+([\w-]+)\s+\[(\w*)\]\s+(.+)", ligne)
        if m:
            titre_fr, titre_en = deux(m.group(3), numero)
            courant = {"sorte": "dialogue", "slug": m.group(1), "theme": theme["id"],
                       "registre": m.group(2), "titre": {"fr": titre_fr, "en": titre_en},
                       "repliques": [], "_ligne": numero}
            dialogues.append(courant)
            continue
        if courant is None or ":" not in ligne:
            raise SystemExit(f"conversation.txt:{numero} : ligne inattendue — {ligne!r}")
        cle, valeur = (x.strip() for x in ligne.split(":", 1))
        if courant["sorte"] == "phrase":
            if cle in ("en", "fr"):
                courant[cle] = valeur
            elif cle in ("en+", "fr+"):
                courant.setdefault("variantes", {"fr": [], "en": []})[cle[:2]] = \
                    [x.strip() for x in valeur.split("|") if x.strip()]
            elif cle == "situation":
                fr, en = deux(valeur, numero)
                courant["situation"] = {"fr": fr, "en": en}
            else:
                raise SystemExit(f"conversation.txt:{numero} : clé inconnue {cle!r}")
        else:
            if cle == "roles":
                a, b = (x.strip() for x in valeur.split(";"))
                (afr, aen), (bfr, ben) = deux(a, numero), deux(b, numero)
                courant["roles"] = {"A": {"fr": afr, "en": aen}, "B": {"fr": bfr, "en": ben}}
            elif cle in ("A", "B"):
                renvoi = None
                if "=>" in valeur:
                    valeur, renvoi = (x.strip() for x in valeur.split("=>", 1))
                en, fr = (x.strip() for x in valeur.split("|", 1))
                courant["repliques"].append({"qui": cle, "en": en, "fr": fr, "renvoi": renvoi,
                                             "_ligne": numero})
            else:
                raise SystemExit(f"conversation.txt:{numero} : clé inconnue {cle!r}")
    return themes, phrases, dialogues


def construire():
    themes, phrases, dialogues = lire()
    fautes = []
    ids = set()
    sortie_phrases = []
    for p in phrases:
        ident = f"ph-{p['theme']}-{p['slug']}"
        if ident in ids:
            fautes.append(f"ligne {p['_ligne']} : identifiant en double {ident}")
        ids.add(ident)
        if not p.get("en") or not p.get("fr"):
            fautes.append(f"ligne {p['_ligne']} : {ident} sans ses deux textes")
            continue
        if p["registre"] not in REGISTRES:
            fautes.append(f"ligne {p['_ligne']} : registre inconnu {p['registre']!r}")
        for langue in ("en", "fr"):
            if len(p[langue]) > TEXTE_MAX:
                fautes.append(f"ligne {p['_ligne']} : texte trop long ({langue})")
        sortie = {"id": ident, "theme": p["theme"], "fr": p["fr"], "en": p["en"]}
        if p.get("situation"):
            sortie["situation"] = p["situation"]
        if p.get("variantes"):
            sortie["variantes"] = p["variantes"]
        if p["registre"]:
            sortie["registre"] = p["registre"]
        sortie_phrases.append(sortie)

    sortie_dialogues = []
    for d in dialogues:
        ident = f"dg-{d['theme']}-{d['slug']}"
        if ident in ids:
            fautes.append(f"ligne {d['_ligne']} : identifiant en double {ident}")
        ids.add(ident)
        if d["registre"] not in REGISTRES:
            fautes.append(f"ligne {d['_ligne']} : registre inconnu {d['registre']!r}")
        if "roles" not in d:
            fautes.append(f"ligne {d['_ligne']} : {ident} sans rôles")
        if not 2 <= len(d["repliques"]) <= 12:
            fautes.append(f"ligne {d['_ligne']} : {ident} a {len(d['repliques'])} répliques (2 à 12)")
        repliques = []
        for rang, r in enumerate(d["repliques"], 1):
            if not r["en"] or not r["fr"]:
                fautes.append(f"ligne {r['_ligne']} : réplique sans ses deux textes")
            if rang > 1 and r["qui"] == d["repliques"][rang - 2]["qui"]:
                fautes.append(f"ligne {r['_ligne']} : deux répliques de suite pour {r['qui']}")
            sortie = {"id": f"r{rang}", "qui": r["qui"], "en": r["en"], "fr": r["fr"]}
            if r["renvoi"]:
                # « => slug » : une phrase du même thème ; « => thème:slug » :
                # celle d'un autre thème.
                theme_cible, _, slug = r["renvoi"].rpartition(":")
                cible = f"ph-{theme_cible or d['theme']}-{slug}"
                phrase = next((p for p in sortie_phrases if p["id"] == cible), None)
                if phrase is None:
                    fautes.append(f"ligne {r['_ligne']} : renvoi introuvable {cible}")
                elif simple(phrase["en"]) not in simple(r["en"]):
                    # La réplique peut ajouter un mot d'entrée (« Great. », « Hello, »)
                    # à la phrase qu'elle reprend, pas dire autre chose.
                    fautes.append(f"ligne {r['_ligne']} : la réplique ne reprend pas {cible} : "
                                  f"« {r['en']} » / « {phrase['en']} »")
                sortie["phrase"] = cible
            repliques.append(sortie)
        sortie_dialogues.append({"id": ident, "theme": d["theme"], "registre": d["registre"],
                                 "titre": d["titre"], "roles": d.get("roles"),
                                 "repliques": repliques})

    if fautes:
        print("\n".join("  ✗ " + f for f in fautes))
        raise SystemExit(f"{len(fautes)} anomalies dans conversation.txt")

    contenu = {
        "format": "vocabulary-conversation",
        "version": 1,
        "construit": time.strftime("%Y-%m-%d"),
        "licence": "CC BY-SA 4.0",
        "themes": themes,
        "phrases": sortie_phrases,
        "dialogues": sortie_dialogues,
    }
    texte = json.dumps(contenu, ensure_ascii=False, indent=1)
    SORTIE.write_text(texte + "\n", encoding="utf-8", newline="")
    repliques = sum(len(d["repliques"]) for d in sortie_dialogues)
    print(f"data/conversation.json : {len(themes)} thèmes, {len(sortie_phrases)} phrases, "
          f"{len(sortie_dialogues)} dialogues ({repliques} répliques), "
          f"{len(texte.encode('utf-8')) // 1024} Kio")


if __name__ == "__main__":
    construire()
