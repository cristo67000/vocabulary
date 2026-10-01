#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Récupération des sources de Vocabulary.

Rien de ce qui est téléchargé ici n'est publié tel quel : ce sont les matières
premières, `construire.py` en tire les paquets de l'application. Le dossier
`build/sources/` pèse environ 2 Go et n'a pas sa place dans le dépôt (voir
.gitignore).

Provenance et licences : voir SOURCES.md, à côté de ce fichier.

Usage :
    python build/telecharger.py            # ne retélécharge pas ce qui est là
    python build/telecharger.py --forcer   # tout reprendre à zéro
"""

import argparse
import json
import re
import sys
import time
import email.utils
import urllib.error
import urllib.request
from pathlib import Path

# La console Windows est en cp1252 : sans cela, la première flèche de la barre
# de progression fait tomber le script avec un UnicodeEncodeError.
for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

RACINE = Path(__file__).resolve().parent
SOURCES = RACINE / "sources"

WIKDICT_TEI = "https://download.wikdict.com/dictionaries/tei/recommended/"
WIKDICT_SQLITE = "https://download.wikdict.com/dictionaries/sqlite/"
TATOEBA = "https://downloads.tatoeba.org/exports/per_language/"

# Le Wiktionnaire intégral, passé par wiktextract (Tatu Ylonen). Chaque édition
# a son dump : l'allemande donne les entrées allemandes avec leurs définitions
# et leurs exemples **en allemand**, la française de même. C'est ce que WikDict
# ne retient pas — il ne garde que les paires de traduction.
#
# Pour l'anglais, l'édition anglaise ; kaikki.org la publie découpée par langue
# décrite. On en prend deux morceaux : les mots anglais (définitions, exemples,
# prononciation britannique, tables de traduction vers le français) et les mots
# français décrits en anglais — leurs gloses sont des traductions anglaises.
# Pour le français, l'édition française entière : elle décrit les mots français
# en français, et aussi les mots anglais en français.
KAIKKI_EN = "https://kaikki.org/dictionary/{langue}/kaikki.org-dictionary-{langue}.jsonl.gz"
KAIKKI_FR = "https://kaikki.org/frwiktionary/raw-wiktextract-data.jsonl.gz"

# FranceTerme : les termes recommandés au Journal officiel par la Commission
# d'enrichissement de la langue française (Licence Ouverte). L'adresse stable de
# data.gouv.fr renvoie vers le fichier du jour.
FRANCETERME = "https://www.data.gouv.fr/api/1/datasets/r/4e1b0ebe-e40f-4ce2-beaa-ac5a60d20899"

# Lexique 3.83 : fréquences du français d'aujourd'hui (sous-titres de films).
LEXIQUE = "http://www.lexique.org/databases/Lexique383/Lexique383.tsv"

# Un navigateur poli s'annonce. Les deux hébergeurs servent des fichiers lourds
# gratuitement ; se présenter est la moindre des choses.
AGENT = "Vocabulary-build/1.0 (application hors ligne d'apprentissage FR-EN)"

# La date de chaque fichier telle que l'hebergeur l'annonce.
#
# Sans elle, on ne saurait pas dire de quelle mouture viennent les donnees : le
# TEI de WikDict porte la sienne dans son en-tete, mais les dumps kaikki.org
# n'en portent aucune, et la date du fichier sur le disque est celle du
# telechargement — pas celle de la source. SOURCES.md et le manifeste des
# donnees citent ce qui est ecrit ici.
MOUTURES = {}


def humain(octets):
    for unite in ("o", "Ko", "Mo", "Go"):
        if octets < 1024 or unite == "Go":
            return f"{octets:.0f} {unite}" if unite == "o" else f"{octets:.1f} {unite}"
        octets /= 1024


def ouvrir(url, depuis=0):
    requete = urllib.request.Request(url, headers={"User-Agent": AGENT})
    if depuis:
        requete.add_header("Range", f"bytes={depuis}-")
    return urllib.request.urlopen(requete, timeout=120)


def noter_mouture(destination, reponse):
    """Retient la date annoncee par l'hebergeur, au format ISO."""
    brut = reponse.headers.get("Last-Modified")
    if not brut:
        return
    try:
        instant = email.utils.parsedate_to_datetime(brut)
    except (TypeError, ValueError):
        return
    MOUTURES[destination.name] = instant.date().isoformat()


def lister(url):
    """Noms de fichiers d'un index Apache/nginx."""
    with ouvrir(url) as reponse:
        page = reponse.read().decode("utf-8", "replace")
    return re.findall(r'href="([^"?/][^"]*)"', page)


def dernier_dossier_sqlite():
    """WikDict garde toutes ses moutures ; on prend la plus récente.

    Les noms sont de la forme `2_2026-06/`. Le tri lexicographique suffit,
    l'année précède le mois.
    """
    dossiers = [d for d in lister(WIKDICT_SQLITE) if re.fullmatch(r"2_\d{4}-\d{2}[a-z]?/", d)]
    if not dossiers:
        raise SystemExit("Aucune mouture SQLite trouvée sur download.wikdict.com")
    return sorted(dossiers)[-1]


def telecharger(url, destination, forcer=False):
    destination.parent.mkdir(parents=True, exist_ok=True)

    try:
        with ouvrir(url, depuis=0) as reponse:
            attendu = int(reponse.headers.get("Content-Length") or 0)
            noter_mouture(destination, reponse)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"  ✗ {url} → HTTP {e.code}")

    if destination.exists() and not forcer:
        deja = destination.stat().st_size
        if attendu and deja == attendu:
            print(f"  = {destination.name} déjà là ({humain(deja)})")
            return destination
        if attendu and deja < attendu:
            print(f"  ↻ {destination.name} incomplet, reprise à {humain(deja)}")
            return _corps(url, destination, attendu, depuis=deja)
        # Taille supérieure à l'attendu : fichier douteux, on refait.
        print(f"  ! {destination.name} de taille inattendue, reprise à zéro")

    return _corps(url, destination, attendu, depuis=0)


def _corps(url, destination, attendu, depuis):
    mode = "ab" if depuis else "wb"
    debut = time.time()
    recu = depuis
    dernier_affichage = 0.0

    with ouvrir(url, depuis=depuis) as reponse, open(destination, mode) as sortie:
        while True:
            morceau = reponse.read(1 << 16)
            if not morceau:
                break
            sortie.write(morceau)
            recu += len(morceau)
            maintenant = time.time()
            if maintenant - dernier_affichage > 0.5:
                dernier_affichage = maintenant
                vitesse = (recu - depuis) / max(maintenant - debut, 0.001)
                part = f"{100 * recu / attendu:5.1f} %" if attendu else humain(recu)
                sys.stdout.write(
                    f"\r  ↓ {destination.name:<28} {part}  {humain(vitesse)}/s   "
                )
                sys.stdout.flush()

    duree = time.time() - debut
    sys.stdout.write("\r" + " " * 78 + "\r")
    print(f"  ✓ {destination.name} — {humain(recu)} en {duree:.0f} s")

    if attendu and recu != attendu:
        raise SystemExit(
            f"  ✗ {destination.name} : {recu} octets reçus, {attendu} attendus"
        )
    return destination


def main():
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--forcer", action="store_true",
                           help="retélécharger même ce qui est déjà présent")
    options = analyseur.parse_args()

    SOURCES.mkdir(parents=True, exist_ok=True)
    print(f"Sources dans {SOURCES}\n")

    print("WikDict — dictionnaires TEI (mot, phonétique, formes, sens)")
    for nom in ("eng-fra.tei", "fra-eng.tei"):
        telecharger(WIKDICT_TEI + nom, SOURCES / nom, options.forcer)

    mouture = dernier_dossier_sqlite()
    print(f"\nWikDict — bases SQLite (importance des mots), mouture {mouture.rstrip('/')}")
    for nom in ("en-fr.sqlite3", "fr-en.sqlite3"):
        telecharger(WIKDICT_SQLITE + mouture + nom, SOURCES / nom, options.forcer)

    # La base monolingue française : c'est elle qui porte les formes fléchies
    # (« nationaux » → « national »), dans ses tables `entry` et `form`. Les
    # bases bilingues ne les ont pas. Rangée sous `fr-lang.sqlite3` pour ne pas
    # la confondre avec `fr-en.sqlite3`, qui n'a pas les mêmes tables.
    print(f"\nWikDict — base monolingue française (formes fléchies), "
          f"mouture {mouture.rstrip('/')}")
    telecharger(WIKDICT_SQLITE + mouture + "fr.sqlite3",
                SOURCES / "fr-lang.sqlite3", options.forcer)

    print("\nTatoeba — phrases alignées")
    for langue, nom in (("eng", "eng_sentences.tsv.bz2"),
                        ("fra", "fra_sentences.tsv.bz2"),
                        ("eng", "eng-fra_links.tsv.bz2")):
        telecharger(TATOEBA + langue + "/" + nom, SOURCES / nom, options.forcer)

    print("\nWiktionary anglais — mots anglais, et mots français décrits en anglais")
    telecharger(KAIKKI_EN.format(langue="English"),
                SOURCES / "wiktionary-en-en.jsonl.gz", options.forcer)
    telecharger(KAIKKI_EN.format(langue="French"),
                SOURCES / "wiktionary-en-fr.jsonl.gz", options.forcer)

    print("\nWiktionnaire français intégral (définitions, exemples, flexions)")
    telecharger(KAIKKI_FR, SOURCES / "wiktionnaire-fr.jsonl.gz", options.forcer)

    print("\nFranceTerme — termes recommandés (numérique, IA, internet…)")
    telecharger(FRANCETERME, SOURCES / "FranceTerme.xml", options.forcer)

    print("\nLexique 3.83 — fréquences du français")
    telecharger(LEXIQUE, SOURCES / "Lexique383.tsv", options.forcer)

    (SOURCES / "moutures.json").write_text(
        json.dumps(MOUTURES, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8", newline="")
    print("\nMoutures des sources — build/sources/moutures.json")
    for nom, date in sorted(MOUTURES.items()):
        print(f"  {nom:<30} {date}")

    total = sum(f.stat().st_size for f in SOURCES.iterdir() if f.is_file())
    print(f"\nTotal : {humain(total)} dans build/sources/")
    print("Les fréquences anglaises et françaises viennent aussi de wordfreq "
          "(pip install wordfreq), lu directement par construire.py.")
    print("Étape suivante : python build/wiktionnaire.py, puis construire.py")


if __name__ == "__main__":
    main()
