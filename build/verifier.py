#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Contrôle des paquets produits par construire.py.

Deux sortes de constats, et il faut les distinguer :

  ✗ ANOMALIE — quelque chose est cassé : un index qui pointe dans le vide, une
    clé que l'application ne saura pas reconstruire. Le script sort en erreur.
  · observation — une mesure à connaître : combien de noms sans genre, combien
    de définitions coupées. Ce sont des faiblesses des données d'origine, pas
    des défauts de construction ; on les surveille, on ne s'y arrête pas.

Le rapport complet part dans build/rapport.txt, y compris les listes à relire —
en particulier la tête du classement, qu'il faut regarder de temps en temps :
c'est le vocabulaire que les débutants apprendront en premier.
"""

import json
import random
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

import commun

RACINE = Path(__file__).resolve().parent
DATA = RACINE.parent / "data"
RAPPORT = RACINE / "rapport.txt"

# Des mots dont on sait qu'ils sont délicats : homographes, faux amis, genres
# trompeurs, expressions. Ce sont eux qu'on relit à la main.
MOTS_PIEGES = {
    "en": ["house", "flat", "go", "get", "take", "left", "may", "May", "lead", "tear",
           "actually", "eventually", "sensible", "library", "colour", "knackered"],
    "fr": ["avocat", "temps", "livre", "tour", "mode", "voile", "aller", "savoir",
           "connaître", "actuellement", "éventuellement", "tout de suite", "avoir lieu"],
}

anomalies = []
lignes = []


def dire(texte=""):
    print(texte)
    lignes.append(texte)


def anomalie(texte):
    anomalies.append(texte)
    dire(f"  ✗ {texte}")


def charger_index(chemin):
    """clé → [(mot, tranche, aperçu), …], en signalant les lignes malformées.

    Une clé peut désigner plusieurs vedettes : « May » le mois et « may » le
    verbe ont la même clé une fois la casse gommée. L'index les garde toutes, sur des lignes
    distinctes — et l'application doit donc s'attendre à plusieurs résultats
    pour une frappe exacte, sans quoi la moitié d'entre elles seraient
    introuvables.
    """
    index = {}
    for numero, ligne in enumerate(chemin.read_text(encoding="utf-8").splitlines(), 1):
        if not ligne:
            continue
        morceaux = ligne.split("\t")
        # clé, vedette, tranche, bande, aperçu — et les drapeaux (c : crue,
        # x : expression), quand il y en a.
        if len(morceaux) not in (5, 6):
            anomalie(f"{chemin.name} ligne {numero} : {len(morceaux)} champs au lieu de 5 ou 6")
            continue
        cle, mot, tranche, bande, apercu = morceaux[:5]
        if commun.cle(mot) != cle:
            anomalie(f"{chemin.name} ligne {numero} : clé « {cle} » ≠ cle({mot})")
        index.setdefault(cle, []).append((mot, int(tranche), int(bande), apercu))
    return index


def compter_entrees(index):
    return sum(len(lot) for lot in index.values())


def verifier_normalisation():
    dire("Normalisation (commun.cle)")
    fautes = [(e, a, commun.cle(e)) for e, a in commun.CAS_DE_CONTROLE if commun.cle(e) != a]
    for entree, attendu, obtenu in fautes:
        anomalie(f"cle({entree!r}) donne {obtenu!r}, attendu {attendu!r}")
    if not fautes:
        dire(f"  · {len(commun.CAS_DE_CONTROLE)} cas de contrôle conformes")
    dire()


def verifier_jumeau_js():
    """`commun.cle()` en Python et `Lexique.cle()` en JavaScript doivent coïncider.

    C'est le point le plus fragile du projet : la construction range les mots
    sous une clé calculée en Python, l'application les cherche sous une clé
    calculée en JavaScript. Un écart d'une seule règle — un tréma traité ici et
    pas là — et des milliers de mots deviennent introuvables sans que rien ne
    signale la panne.

    On compare donc sur les cas de contrôle *et* sur un large échantillon de
    vraies vedettes, tirées des deux langues.
    """
    dire("Jumeau JavaScript (js/lexique.js : Lexique.cle)")
    if not shutil.which("node"):
        dire("  · node absent, comparaison impossible — à refaire sur une machine qui l'a")
        dire()
        return

    entrees = [e for e, _ in commun.CAS_DE_CONTROLE]
    graine = random.Random(1789)
    for langue in commun.LANGUES:
        chemin = DATA / "complet" / f"{langue}.idx"
        if not chemin.exists():
            continue
        mots = [l.split("\t")[1] for l in chemin.read_text(encoding="utf-8").splitlines() if l]
        entrees += graine.sample(mots, min(2000, len(mots)))

    sortie = subprocess.run(
        ["node", str(RACINE / "cle.mjs")],
        input=json.dumps(entrees), capture_output=True, text=True, encoding="utf-8")
    if sortie.returncode != 0:
        anomalie(f"node a échoué : {sortie.stderr.strip()[:200]}")
        dire()
        return

    obtenues = json.loads(sortie.stdout)
    ecarts = [(e, commun.cle(e), j) for e, j in zip(entrees, obtenues) if commun.cle(e) != j]
    for entree, py, js in ecarts[:10]:
        anomalie(f"cle({entree!r}) : Python donne {py!r}, JavaScript {js!r}")
    if ecarts:
        anomalie(f"{len(ecarts)} écarts au total entre les deux implémentations")
    else:
        dire(f"  · {len(entrees)} mots donnent la même clé des deux côtés")
    dire()


def verifier_code_js():
    """Les cas de contrôle du code (build/essais.mjs : correction, choix de
    l'exercice, révision espacée) et les libellés (build/essais_i18n.mjs :
    chaque clé employée existe, en français et en anglais)."""
    dire("Code de l'application (build/essais.mjs, build/essais_i18n.mjs)")
    if not shutil.which("node"):
        dire("  · node absent, essais non exécutés")
        dire()
        return
    for essai in ("essais.mjs", "essais_i18n.mjs"):
        sortie = subprocess.run(["node", str(RACINE / essai)],
                                capture_output=True, text=True, encoding="utf-8")
        for ligne in (sortie.stdout or "").splitlines():
            if ligne.strip().startswith("NON"):
                anomalie(f"{essai} : {ligne.strip()}")
            elif "cas conformes" in ligne or "clés" in ligne:
                dire("  ·" + ligne[1:])
        if sortie.returncode != 0 and not anomalies:
            anomalie(f"{essai} a échoué : {(sortie.stderr or '').strip()[:200]}")
    dire()


def verifier_paquet(nom, manifeste):
    dire(f"Paquet « {nom} »")
    dossier = DATA / nom
    if not dossier.is_dir():
        anomalie(f"dossier {dossier} absent")
        return

    declares = set(manifeste["paquets"][nom]["fichiers"])
    presents = {f"{nom}/{f.name}" for f in dossier.iterdir() if f.is_file()}
    for manquant in sorted(declares - presents):
        anomalie(f"{manquant} déclaré au manifeste mais absent du disque")
    for surnumeraire in sorted(presents - declares):
        anomalie(f"{surnumeraire} présent sur le disque mais absent du manifeste")

    expressions_vues = {}
    vedettes_du_paquet = {}
    for langue in commun.LANGUES:
        index = charger_index(dossier / f"{langue}.idx")
        vedettes_du_paquet[langue] = {mot for lot in index.values() for mot, *_ in lot}
        attendu = manifeste["paquets"][nom]["entrees"][langue]
        if compter_entrees(index) != attendu:
            anomalie(f"{langue}.idx contient {compter_entrees(index)} lignes, "
                     f"le manifeste en annonce {attendu}")
        partagees = sum(len(lot) for lot in index.values() if len(lot) > 1)
        if partagees:
            dire(f"  · {langue} : {partagees} vedettes partagent leur clé avec une autre")

        # Chaque tranche doit contenir exactement les mots que l'index lui adresse.
        par_tranche = {}
        for lot in index.values():
            for mot, tranche, _bande, _apercu in lot:
                par_tranche.setdefault(tranche, set()).add(mot)

        bandes = Counter()
        expressions_vues.setdefault(langue, 0)
        sans_genre = coupees = sans_traduction = 0
        sens_total = sens_illustres = avec_flexion = 0
        pieges_vus = {}
        for numero, attendus in sorted(par_tranche.items()):
            chemin = dossier / f"{langue}-{numero:03d}.json"
            if not chemin.exists():
                anomalie(f"tranche {chemin.name} absente, {len(attendus)} mots inaccessibles")
                continue
            contenu = json.loads(chemin.read_text(encoding="utf-8"))
            if contenu.get("l") != langue:
                anomalie(f"{chemin.name} annonce la langue « {contenu.get('l')} »")
            trouves = set()
            for ecrite in contenu["e"]:
                # Cinq champs, et un sixième facultatif : les informations de
                # l'entrée (provenance d'une expression, orthographe américaine,
                # mot cru…) — voir construire.py.
                mot, bande, lectures = ecrite[0], ecrite[1], ecrite[2]
                infos = ecrite[5] if len(ecrite) > 5 else {}
                if not isinstance(infos, dict):
                    anomalie(f"« {mot} » : sixième champ inattendu {infos!r}")
                    infos = {}
                if infos.get("e"):
                    expressions_vues[langue] += 1
                    if infos["e"] not in PROVENANCES:
                        anomalie(f"« {mot} » : provenance d'expression inconnue « {infos['e']} »")
                trouves.add(mot)
                bandes[bande] += 1
                if mot in MOTS_PIEGES.get(langue, ()):
                    pieges_vus[mot] = lectures
                for lecture in lectures:
                    nature, genre, sens = lecture[0], lecture[1], lecture[4]
                    flexion = lecture[5] if len(lecture) > 5 else []
                    if nature == "n" and not genre and langue == "fr":
                        sans_genre += 1
                    if flexion:
                        avec_flexion += 1
                    for bloc in sens:
                        definition, traductions = bloc[0], bloc[1]
                        citations = bloc[2] if len(bloc) > 2 else []
                        phrases_du_sens = bloc[3] if len(bloc) > 3 else []
                        sens_total += 1
                        if citations or phrases_du_sens:
                            sens_illustres += 1
                        if not traductions:
                            sans_traduction += 1
                        if definition.endswith("…"):
                            coupees += 1
                        # Une marque qui déborde de sa phrase mettrait en gras
                        # n'importe quoi, avec l'aplomb d'une donnée vérifiée.
                        # Un quatrième champ, s'il existe, est la traduction
                        # française (build/citations.py) : jamais vide.
                        for citation in citations:
                            texte, marque = citation[0], citation[1]
                            if marque and not (0 <= marque[0] < marque[1] <= len(texte)):
                                anomalie(f"« {mot} » : citation dont la marque "
                                         f"{marque} déborde d'un texte de "
                                         f"{len(texte)} signes")
                            if len(citation) > 3 and not citation[3].strip():
                                anomalie(f"« {mot} » : citation à traduction vide")
            for absent in sorted(attendus - trouves):
                anomalie(f"« {absent} » adressé à {chemin.name} mais absent de cette tranche")

        total = sum(bandes.values())
        dire(f"  · {langue} : {total} entrées, bandes "
             + ", ".join(f"{manifeste['bandes'][b]}={n}" for b, n in sorted(bandes.items())))
        if langue == "fr":
            dire(f"  · {langue} : {sans_genre} lectures de nom sans genre")
        dire(f"  · {langue} : {coupees} définitions coupées, {sans_traduction} sens sans traduction")
        # La mesure de la version 2 : un sens sans exemple est un sens qu'on
        # apprend hors contexte, c'est-à-dire mal.
        part = 100 * sens_illustres / max(sens_total, 1)
        dire(f"  · {langue} : {sens_illustres}/{sens_total} sens illustrés "
             f"({part:.1f} %), {avec_flexion} lectures avec tableau de formes")
        seuil = 60 if nom == "noyau" else 50
        if part < seuil:
            anomalie(f"{langue} : seuls {part:.1f} % des sens ont un exemple — "
                     f"la promesse « une phrase par signification » n'est pas tenue")

        manquants = [m for m in MOTS_PIEGES.get(langue, ()) if m not in pieges_vus]
        if manquants and nom == "complet":
            dire(f"  · {langue} : mots pièges absents du dictionnaire — {', '.join(manquants)}")

        # L'index des expressions par mot : chaque renvoi doit aboutir à une
        # vedette du paquet, et le compte du manifeste doit dire vrai.
        verifier_expressions(dossier, langue, nom, manifeste, vedettes_du_paquet[langue],
                             expressions_vues[langue])

    dire()


# Les provenances qu'une expression peut porter — voir build/expressions.py.
PROVENANCES = {"dico", "tatoeba", "croisee", "attestee", "editorial"}


def verifier_expressions(dossier, langue, nom, manifeste, vedettes, vues):
    """L'index des expressions par mot, et le compte du manifeste.

    Chaque renvoi de l'index doit aboutir à une vedette du même paquet : un
    renvoi vers une expression absente ferait un résultat qui ne s'ouvre pas.
    Les clés doivent être des mots normalisés — la dichotomie de l'application
    s'appuie sur leur tri. Et le nombre d'expressions écrites dans les tranches
    doit être celui que le manifeste annonce, à l'entrée près.
    """
    chemin = dossier / f"expressions-{langue}.idx"
    if not chemin.exists():
        anomalie(f"{chemin.name} absent")
        return
    annonce = manifeste["paquets"][nom].get("expressions", {}).get(langue)
    if annonce != vues:
        anomalie(f"{nom}/{langue} : {vues} expressions dans les tranches, "
                 f"le manifeste en annonce {annonce}")
    lignes = chemin.read_text(encoding="utf-8").splitlines()
    precedente = ""
    renvois = aboutissent = 0
    vedettes_par_langue = {langue: vedettes}
    for numero, ligne in enumerate(lignes, 1):
        if not ligne:
            continue
        morceaux = ligne.split("	")
        if len(morceaux) != 2:
            anomalie(f"{chemin.name} ligne {numero} : {len(morceaux)} champs au lieu de 2")
            continue
        mot, liste = morceaux
        if commun.cle(mot) != mot:
            anomalie(f"{chemin.name} ligne {numero} : « {mot} » n'est pas une clé normalisée")
        if mot < precedente:
            anomalie(f"{chemin.name} ligne {numero} : « {mot} » rompt le tri")
        precedente = mot
        for marque in liste.split("|"):
            renvois += 1
            if ":" not in marque:
                anomalie(f"{chemin.name} ligne {numero} : renvoi « {marque} » sans langue")
                continue
            l, vedette = marque.split(":", 1)
            if l not in commun.LANGUES:
                anomalie(f"{chemin.name} ligne {numero} : langue « {l} » inconnue")
                continue
            # La vedette d'une expression de l'autre langue se vérifie dans
            # l'index de l'autre langue, qu'on lit à la demande.
            if l not in vedettes_par_langue:
                autre = charger_index(dossier / f"{l}.idx")
                vedettes_par_langue[l] = {m for lot in autre.values() for m, *_ in lot}
            if vedette in vedettes_par_langue[l]:
                aboutissent += 1
            else:
                anomalie(f"{chemin.name} : « {mot} » renvoie à « {vedette} » ({l}), "
                         f"absent du paquet")
    dire(f"  · {langue} : {vues} expressions usuelles, {len(lignes)} mots indexés, "
         f"{aboutissent}/{renvois} renvois aboutissent")


def verifier_phrases(nom, manifeste):
    """Chaque numéro de phrase cité par une entrée doit exister dans le vivier.

    Les entrées ne portent que des numéros ; si le vivier est écrit à partir
    d'une autre sélection, les renvois pointent à côté et la fiche affiche la
    phrase d'un autre mot — une erreur qui ne se voit qu'à la lecture, et qui
    passerait donc inaperçue longtemps.
    """
    dossier = DATA / nom
    attendues = manifeste["paquets"][nom].get("phrases", 0)

    vivier = 0
    while (dossier / f"phrases-{vivier // 900:03d}.json").exists():
        contenu = json.loads(
            (dossier / f"phrases-{vivier // 900:03d}.json").read_text(encoding="utf-8"))
        if not contenu["p"]:
            break
        vivier += len(contenu["p"])
        if len(contenu["p"]) < 900:
            break

    if vivier != attendues:
        anomalie(f"{nom} : {vivier} phrases sur le disque, {attendues} au manifeste")

    hors_bornes = illustres = renvois = 0
    for langue in commun.LANGUES:
        numero = 0
        while (dossier / f"{langue}-{numero:03d}.json").exists():
            contenu = json.loads(
                (dossier / f"{langue}-{numero:03d}.json").read_text(encoding="utf-8"))
            for _mot, _bande, _lectures, liste, _voisins, *_expression in contenu["e"]:
                if liste:
                    illustres += 1
                for identifiant in liste:
                    renvois += 1
                    if not 0 <= identifiant < vivier:
                        hors_bornes += 1
            numero += 1

    if hors_bornes:
        anomalie(f"{nom} : {hors_bornes} renvois de phrase hors du vivier")
    dire(f"  · {nom} : {vivier} phrases, {renvois} renvois depuis {illustres} entrées")


def verifier_familles(nom, manifeste):
    """Les voisins cités doivent exister dans le même paquet et la même langue.

    Un voisin absent afficherait un mot sur lequel on ne peut pas cliquer —
    et le noyau, qui ne contient qu'une partie des mots, en aurait beaucoup si la
    restriction faite à la construction avait été oubliée.
    """
    dossier = DATA / nom
    for langue in commun.LANGUES:
        vedettes, avec, liens, orphelins = set(), 0, 0, []
        entrees = []
        numero = 0
        while (dossier / f"{langue}-{numero:03d}.json").exists():
            contenu = json.loads(
                (dossier / f"{langue}-{numero:03d}.json").read_text(encoding="utf-8"))
            for mot, _bande, _lectures, _phrases, voisins, *_expression in contenu["e"]:
                vedettes.add(mot)
                entrees.append((mot, voisins))
            numero += 1
        for mot, voisins in entrees:
            if voisins:
                avec += 1
            for voisin in voisins:
                liens += 1
                if voisin not in vedettes:
                    if len(orphelins) < 5:
                        orphelins.append(f"{mot} → {voisin}")
        if orphelins:
            anomalie(f"{nom}/{langue} : voisins hors du paquet (ex. {'; '.join(orphelins)})")
        dire(f"  · {nom}/{langue} : {avec} mots ont un voisinage, {liens} liens")


def relire_familles():
    """Un échantillon de voisinages, à relire.

    Le procédé est automatique et se trompe. Ce que la relecture repère se
    corrige dans build/exclusions.txt, et n'y revient plus.
    """
    lignes.append("\n" + "=" * 72)
    lignes.append("FAMILLES À RELIRE — corriger les erreurs dans build/exclusions.txt")
    lignes.append("=" * 72)
    graine = random.Random(1789)
    for langue in commun.LANGUES:
        dossier = DATA / "noyau"
        tous = []
        numero = 0
        while (dossier / f"{langue}-{numero:03d}.json").exists():
            contenu = json.loads(
                (dossier / f"{langue}-{numero:03d}.json").read_text(encoding="utf-8"))
            for mot, bande, _lectures, _phrases, voisins, *_expression in contenu["e"]:
                if voisins and bande <= 1:
                    tous.append((mot, voisins))
            numero += 1
        lignes.append(f"\n{langue} — {len(tous)} mots courants ont un voisinage ; "
                      f"échantillon de 30 :")
        for mot, voisins in graine.sample(tous, min(30, len(tous))):
            lignes.append(f"    {mot:<22} {', '.join(voisins)}")


def verifier_formes():
    dire("Index des formes fléchies")
    for langue in commun.LANGUES:
        chemin = DATA / "complet" / f"formes-{langue}.idx"
        if not chemin.exists():
            anomalie(f"{chemin.name} absent")
            continue
        vedettes = set(charger_index(DATA / "complet" / f"{langue}.idx"))
        total = orphelines = 0
        exemples = []
        for ligne in chemin.read_text(encoding="utf-8").splitlines():
            if not ligne:
                continue
            forme, codes = ligne.split("\t", 1)
            total += 1
            for code in codes.split("|"):
                partage, reste = code.split(",", 1)
                lemme = forme[:int(partage)] + reste
                if lemme not in vedettes:
                    orphelines += 1
                    if len(exemples) < 5:
                        exemples.append(f"{forme} → {lemme}")
        if orphelines:
            anomalie(f"formes-{langue}.idx : {orphelines} renvois vers une vedette "
                     f"inexistante (ex. {'; '.join(exemples)})")
        else:
            dire(f"  · {langue} : {total} formes, tous les renvois aboutissent")
    dire()


def relire(manifeste):
    """Listes à relire par un humain : elles ne peuvent pas être vérifiées seules."""
    lignes.append("\n" + "=" * 72)
    lignes.append("À RELIRE — ces listes demandent un œil humain")
    lignes.append("=" * 72)

    for langue in commun.LANGUES:
        index = charger_index(DATA / "noyau" / f"{langue}.idx")
        tete = []
        for numero in range(0, 40):
            chemin = DATA / "noyau" / f"{langue}-{numero:03d}.json"
            if not chemin.exists():
                break
            for mot, bande, _lectures, _phrases, _voisins, *_expression in json.loads(
                    chemin.read_text(encoding="utf-8"))["e"]:
                if bande == 0:
                    tete.append(mot)
        lignes.append(f"\nBande « premiers pas » en {langue} : {len(tete)} mots")
        lignes.append("  " + ", ".join(sorted(tete, key=commun.cle)[:120]))

        graine = random.Random(1789)
        echantillon = graine.sample(sorted(index), min(25, len(index)))
        lignes.append(f"\nÉchantillon de {len(echantillon)} entrées du noyau {langue} :")
        for cle in sorted(echantillon):
            for mot, _tranche, _bande, apercu in index[cle]:
                lignes.append(f"    {mot:<28} {apercu}")

    for langue, mots in MOTS_PIEGES.items():
        lignes.append(f"\nMots pièges — {langue}")
        index = charger_index(DATA / "complet" / f"{langue}.idx")
        for mot in mots:
            lot = index.get(commun.cle(mot))
            if not lot:
                lignes.append(f"    {mot:<24} — ABSENT —")
                continue
            for vedette, _tranche, _bande, apercu in lot:
                lignes.append(f"    {vedette:<24} {apercu}")


def main():
    if not (DATA / "manifeste.json").exists():
        raise SystemExit("data/ absent. Lance d'abord : python build/construire.py")
    manifeste = json.loads((DATA / "manifeste.json").read_text(encoding="utf-8"))

    dire(f"Vocabulary — contrôle des données du {manifeste.get('mouture') or manifeste['construit']}")
    dire(f"Moutures des sources : {manifeste['moutures']}")
    dire()

    verifier_normalisation()
    verifier_jumeau_js()
    verifier_code_js()
    for nom in manifeste["paquets"]:
        verifier_paquet(nom, manifeste)
    dire("Phrases d'exemple")
    for nom in manifeste["paquets"]:
        verifier_phrases(nom, manifeste)
    dire()
    dire("Familles de mots")
    for nom in manifeste["paquets"]:
        verifier_familles(nom, manifeste)
    dire()
    verifier_formes()
    relire(manifeste)
    relire_familles()

    RAPPORT.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    dire("=" * 72)
    if anomalies:
        dire(f"{len(anomalies)} anomalie(s) — voir build/rapport.txt")
        sys.exit(1)
    dire(f"Aucune anomalie. Listes à relire dans build/rapport.txt")


if __name__ == "__main__":
    main()
