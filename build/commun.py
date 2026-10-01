#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ce qui doit rester identique entre la construction et l'application.

⚠ `cle()` a un jumeau en JavaScript : `Lexique.cle()` dans js/lexique.js.
Les deux doivent donner exactement le même résultat, sinon un mot présent dans
l'index devient introuvable à la frappe. `verifier.py` compare les deux
implémentations sur une liste de cas et échoue si elles divergent — toute
retouche ici doit être reportée là-bas, et inversement.
"""

import sys
import unicodedata

# La console Windows est en cp1252 ; sans cela le moindre « é » à l'affichage
# fait tomber le script.
for _flux in (sys.stdout, sys.stderr):
    try:
        _flux.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


# Ligatures et lettres que la décomposition Unicode ne défait pas d'elle-même :
# NFD laisse « œ » entier, alors qu'on tape « oeuvre » au clavier. « ß » suit la
# même logique : on le cherche en tapant « ss ».
REMPLACEMENTS = {
    "ß": "ss", "ẞ": "ss",
    "œ": "oe", "Œ": "oe",
    "æ": "ae", "Æ": "ae",
    "’": "'", "‘": "'", "‛": "'", "‚": "'", "´": "'", "`": "'",
    "–": "-", "—": "-", "‐": "-", "‑": "-",
    "\u00a0": " ", "\u202f": " ", "\u2009": " ",
}


def cle(texte):
    """Forme normalisée d'un mot, celle sous laquelle on le cherche.

    Minuscules, diacritiques retirés, ligatures défaites, apostrophes et tirets
    ramenés à leur version ASCII, espaces resserrés. « Über » et « uber »
    donnent la même clé ; « élève » et « eleve » aussi.
    """
    if not texte:
        return ""
    texte = texte.lower()
    for avant, apres in REMPLACEMENTS.items():
        if avant in texte:
            texte = texte.replace(avant, apres)
    # NFD sépare la lettre de son accent, la boucle jette les accents.
    texte = unicodedata.normalize("NFD", texte)
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    return " ".join(texte.split())


def sans_diacritiques(texte):
    """Comme `cle()` mais en gardant la casse — pour comparer des radicaux."""
    for avant, apres in REMPLACEMENTS.items():
        if avant in texte:
            texte = texte.replace(avant, apres)
    texte = unicodedata.normalize("NFD", texte)
    return "".join(c for c in texte if not unicodedata.combining(c))


# Les deux langues de l'application, et l'autre de chacune. Tout le reste de la
# chaîne s'écrit à partir de là : la construction de Wortschatz, dont celle-ci
# descend, avait « de » en dur à quelques dizaines d'endroits.
LANGUES = ("en", "fr")
AUTRE = {"en": "fr", "fr": "en"}


def humain(octets):
    """Une taille lisible par un humain."""
    valeur = float(octets)
    for unite in ("o", "Ko", "Mo", "Go"):
        if valeur < 1024 or unite == "Go":
            return f"{valeur:.0f} {unite}" if unite == "o" else f"{valeur:.1f} {unite}"
        valeur /= 1024


# Cas de contrôle partagés avec verifier.py et avec le test JavaScript.
# Un couple = (ce qu'on écrit, la clé attendue).
CAS_DE_CONTROLE = [
    ("House", "house"),
    ("don’t", "don't"),
    ("café", "cafe"),
    ("naïve", "naive"),
    ("Résumé", "resume"),
    ("über", "uber"),
    ("Straße", "strasse"),
    ("élève", "eleve"),
    ("Œuvre", "oeuvre"),
    ("l’ensemble", "l'ensemble"),
    ("dans les plus brefs délais", "dans les plus brefs delais"),
    ("co-operate", "co-operate"),
    ("cœur", "coeur"),
    ("à-côté", "a-cote"),
    ("  espaces   multiples ", "espaces multiples"),
    ("Encyclopædia", "encyclopaedia"),
    ("ça", "ca"),
    ("État", "etat"),
]


if __name__ == "__main__":
    fautes = 0
    for entree, attendu in CAS_DE_CONTROLE:
        obtenu = cle(entree)
        etat = "ok " if obtenu == attendu else "NON"
        if obtenu != attendu:
            fautes += 1
        print(f"  {etat} {entree!r:38} → {obtenu!r}")
    print(f"\n{len(CAS_DE_CONTROLE) - fautes}/{len(CAS_DE_CONTROLE)} cas conformes")
    sys.exit(1 if fautes else 0)
