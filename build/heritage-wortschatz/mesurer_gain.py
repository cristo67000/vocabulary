#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Le gain, mesuré — et non annoncé.

Compare les paquets présents dans `data/` à ceux de la version précédente,
relus depuis git. Répond aux seules questions qui valent : combien d'entrées en
plus par langue, combien d'entre elles portent vraiment une traduction, ce que
cela coûte en octets, et ce que la recherche y gagne.

Un chiffre d'entrées seul ne veut rien dire : une entrée sans traduction est un
mot dans un dictionnaire monolingue qu'on n'a pas demandé. C'est pourquoi la
colonne « traduites » existe.

    python build/mesurer_gain.py            # compare à HEAD
    python build/mesurer_gain.py <revision>
"""

import json
import subprocess
import sys
from pathlib import Path

import commun

RACINE = Path(__file__).resolve().parent
DATA = RACINE.parent / "data"


def manifeste_de_git(revision):
    try:
        brut = subprocess.run(
            ["git", "show", f"{revision}:data/manifeste.json"],
            cwd=str(RACINE.parent), capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    return json.loads(brut.stdout.decode("utf-8"))


def index_de_git(revision, chemin):
    try:
        brut = subprocess.run(["git", "show", f"{revision}:{chemin}"],
                              cwd=str(RACINE.parent), capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    return brut.stdout.decode("utf-8")


def vedettes(texte):
    """Les couples (clé, vedette) d'un index."""
    sortie = set()
    for ligne in texte.split("\n"):
        if not ligne.strip():
            continue
        champs = ligne.rstrip("\r").split("\t")
        if len(champs) >= 2:
            sortie.add((champs[0], champs[1]))
    return sortie


def ligne(gauche, avant, apres):
    ecart = apres - avant
    signe = "+" if ecart >= 0 else ""
    part = f"  ({signe}{100 * ecart / avant:.1f} %)" if avant else ""
    print(f"  {gauche:<34} {avant:>9} → {apres:>9}   {signe}{ecart}{part}")


def main():
    revision = sys.argv[1] if len(sys.argv) > 1 else "HEAD"

    courant = json.loads((DATA / "manifeste.json").read_text(encoding="utf-8"))
    ancien = manifeste_de_git(revision)
    if ancien is None:
        raise SystemExit(f"Impossible de lire data/manifeste.json à la révision {revision}.")

    print(f"Comparaison : {revision} → l'arbre de travail")
    print(f"  données {ancien.get('construit')} → {courant.get('construit')}")
    print()

    for paquet in ("noyau", "complet"):
        a = ancien["paquets"][paquet]
        b = courant["paquets"][paquet]
        print(f"Paquet « {paquet} »")
        for langue in ("de", "fr"):
            ligne(f"entrées {langue}", a["entrees"][langue], b["entrees"][langue])
        ligne("entrées, les deux langues",
              a["entrees"]["de"] + a["entrees"]["fr"],
              b["entrees"]["de"] + b["entrees"]["fr"])
        if "traduites" in b:
            traduites = b["traduites"]["de"] + b["traduites"]["fr"]
            total = b["entrees"]["de"] + b["entrees"]["fr"]
            print(f"  {'dont traduites':<34} {'':>9}   {traduites}"
                  f"  ({100 * traduites / total:.1f} % du paquet)")
        ligne("phrases d'exemple", a["phrases"], b["phrases"])
        ligne("octets", a["octets"], b["octets"])
        print(f"  {'poids lisible':<34} {commun.humain(a['octets']):>9}"
              f" → {commun.humain(b['octets']):>9}")
        print()

    print("Ce que la recherche y gagne — index des vedettes")
    for paquet in ("noyau", "complet"):
        for langue in ("de", "fr"):
            chemin = f"data/{paquet}/{langue}.idx"
            avant = index_de_git(revision, chemin)
            apres = (DATA / paquet / f"{langue}.idx").read_text(encoding="utf-8")
            if avant is None:
                print(f"  {chemin} : absent de {revision}")
                continue
            a, b = vedettes(avant), vedettes(apres)
            neuves = b - a
            perdues = a - b
            print(f"  {paquet}/{langue} : {len(neuves)} vedettes de plus, "
                  f"{len(perdues)} disparues")
            if neuves:
                echantillon = sorted(m for _c, m in neuves)[:8]
                print(f"      neuves : {', '.join(echantillon)}")
            if perdues:
                echantillon = sorted(m for _c, m in perdues)[:8]
                print(f"      parties : {', '.join(echantillon)}")

    print()
    print("Index des formes fléchies — ce qui fait remonter un mot d'une graphie")
    for paquet in ("noyau", "complet"):
        for langue in ("de", "fr"):
            chemin = f"data/{paquet}/formes-{langue}.idx"
            avant = index_de_git(revision, chemin)
            apres = (DATA / paquet / f"formes-{langue}.idx").read_text(encoding="utf-8")
            if avant is None:
                continue
            a = len([l for l in avant.split("\n") if l.strip()])
            b = len([l for l in apres.split("\n") if l.strip()])
            ligne(f"{paquet}/{langue}", a, b)

    if "gain" in courant:
        print()
        print("D'où viennent les entrées neuves")
        for langue, detail in courant["gain"].items():
            print(f"  {langue} : {detail['wikdict']} vedettes WikDict, "
                  f"+{detail['neuves']} tirées des traductions du Wiktionnaire")
            print(f"       {detail['sens_traduits']} sens traduits en plus, "
                  f"{detail['sens_sans_traduction']} restent sans traduction")

    if "moutures_wiktionnaire" in courant:
        print()
        print("Moutures des sources")
        for langue, date in courant.get("moutures", {}).items():
            print(f"  WikDict {langue} : {date}")
        for langue, date in courant["moutures_wiktionnaire"].items():
            print(f"  Wiktionnaire {langue} : {date}")


if __name__ == "__main__":
    main()
