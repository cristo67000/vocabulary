#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Combien de sens WikDict trouvent leur exemple **dans le Wiktionnaire** ?

⚠ Ce n'est pas le chiffre final. Un sens est illustré par deux sources
indépendantes : les citations du Wiktionnaire, que ce script mesure, et les
paires traduites de Tatoeba, réparties par `phrases.attribuer_aux_sens()`. Le
français, moins riche en citations que l'allemand, doit beaucoup à la seconde.

Le chiffre qui compte est celui que `verifier.py` calcule sur les paquets
construits, les deux sources réunies — et qui échoue en dessous de 60 %. Au
dernier passage : noyau 95,7 % (de) et 84,9 % (fr), complet 87,6 % et 70,6 %.

Ce script sert à autre chose : éprouver l'appariement seul, sans reconstruire,
quand on retouche `alignement.py`.

Le tirage d'échantillon est reproductible : même graine, mêmes lignes à
relire d'une exécution à l'autre. On compare ainsi deux réglages sur les mêmes
cas plutôt que sur deux tirages différents.

    python build/mesurer_alignement.py            # les deux langues
    python build/mesurer_alignement.py --montrer 15
"""

import argparse
import random
import sys

import alignement
import commun
import construire
import wiktionnaire

# Le Wiktionnaire allemand illustre presque tout, le français environ la
# moitié. On surveille donc une chute par rapport au connu, plutôt qu'un
# seuil unique qui accuserait à tort la langue la moins richement citée.
SEUIL_ALERTE = {"de": 0.80, "fr": 0.50}
GRAINE = 20260824


def mesurer(langue, fichier_tei, montrer=0):
    print(f"\n{'=' * 74}\n{langue} — lecture des sources")
    dictionnaire, _formes, _graphies = construire.charger_dictionnaire(
        wiktionnaire.SOURCES / fichier_tei)
    par_mot = wiktionnaire.charger(langue)
    print(f"  {len(dictionnaire):,} entrées WikDict, "
          f"{len(par_mot):,} vedettes Wiktionnaire".replace(",", " "))

    journal = {}
    apparies_avec_exemple = []
    for mot, entree in dictionnaire.items():
        avant = journal.get("avec_exemple", 0)
        alignement.enrichir(entree, par_mot.get(mot, []), journal)
        if journal.get("avec_exemple", 0) > avant:
            apparies_avec_exemple.append(mot)

    sens = journal["sens"]
    apparies = journal["apparies"]
    avec = journal["avec_exemple"]
    part = avec / sens if sens else 0.0

    print(f"\n  lectures                        {journal['lectures']:>8,}"
          .replace(",", " "))
    print(f"  · sans entrée Wiktionnaire      {journal['sans_entree']:>8,}"
          f"   ({100 * journal['sans_entree'] / max(journal['lectures'], 1):.1f} %)"
          .replace(",", " "))
    print(f"  sens WikDict                    {sens:>8,}".replace(",", " "))
    print(f"  · appariés                      {apparies:>8,}"
          f"   ({100 * apparies / max(sens, 1):.1f} %)".replace(",", " "))
    print(f"  · appariés **avec exemple**     {avec:>8,}"
          f"   ({100 * part:.1f} %)".replace(",", " "))
    print(f"  sens ajoutés du Wiktionnaire    {journal['sens_ajoutes']:>8,}"
          .replace(",", " "))

    if montrer:
        alea = random.Random(GRAINE)
        echantillon = alea.sample(apparies_avec_exemple,
                                  min(montrer, len(apparies_avec_exemple)))
        print(f"\n  — {len(echantillon)} appariements tirés au sort, à relire —")
        for mot in sorted(echantillon):
            entree = dictionnaire[mot]
            print(f"\n  ▸ {mot}")
            for lecture in entree["lectures"]:
                for bloc in lecture[4]:
                    if not bloc[2]:
                        continue
                    traductions = ", ".join(bloc[1]) or "(sans traduction)"
                    print(f"      {traductions}")
                    print(f"        « {bloc[0][:88]} »")
                    print(f"        → {bloc[2][0][0][:88]}")

    return part


def main():
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--montrer", type=int, default=8,
                           help="combien d'appariements afficher, par langue")
    options = analyseur.parse_args()

    parts = {}
    for langue, fichier in (("de", "deu-fra.tei"), ("fr", "fra-deu.tei")):
        parts[langue] = mesurer(langue, fichier, options.montrer)

    print(f"\n{'=' * 74}")
    faible = [l for l, p in parts.items() if p < SEUIL_ALERTE[l]]
    for langue, part in parts.items():
        etat = "ok " if part >= SEUIL_ALERTE[langue] else "BAS"
        print(f"  {etat} {langue} : {100 * part:.1f} % des sens sont illustrés "
              f"par le Wiktionnaire (seuil {100 * SEUIL_ALERTE[langue]:.0f} %)")
    print("")
    print("  Les paires Tatoeba en illustrent d'autres : le chiffre final se lit")
    print("  dans build/verifier.py, sur les paquets construits.")
    if faible:
        print(f"\n  ⚠ Chute de l'appariement pour : {', '.join(faible)}. "
              f"Regarder alignement.py avant de reconstruire.")
    return 1 if faible else 0


if __name__ == "__main__":
    sys.exit(main())
