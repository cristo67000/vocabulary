#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le document de relecture des phrases et dialogues ajoutés depuis une révision.

    python build/relecture.py [révision] [sortie]

Compare `data/conversation.json` à celui de la révision donnée (`main` par
défaut) et écrit, en Markdown, tout ce qui est nouveau : chaque phrase avec
son identifiant, son texte allemand, son équivalent français, son registre et
son contexte, ses variantes ; chaque dialogue avec ses répliques dans l'ordre.
C'est ce qu'on donne à relire à une locutrice native — et c'est l'identifiant
qui permet ensuite de reporter une correction au bon endroit sans toucher aux
cartes de révision de personne.
"""
import json
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
FICHIER = RACINE / "data" / "conversation.json"


def charger_ancien(revision):
    brut = subprocess.run(["git", "show", f"{revision}:data/conversation.json"],
                          cwd=RACINE, capture_output=True, check=True).stdout
    return json.loads(brut.decode("utf-8"))


def cellule(texte):
    return str(texte).replace("|", "\\|").replace("\n", " ")


def variantes(item, langue):
    v = (item.get("variantes") or {}).get(langue) or []
    return " · ".join(v)


def principal():
    revision = sys.argv[1] if len(sys.argv) > 1 else "main"
    sortie = Path(sys.argv[2]) if len(sys.argv) > 2 else RACINE / "build" / "RELECTURE-3.3.md"
    neuf = json.loads(FICHIER.read_text(encoding="utf-8"))
    ancien = charger_ancien(revision)
    themes = {t["id"]: t for t in neuf["themes"]}
    anciens_ids = {p["id"] for p in ancien["phrases"]} | {d["id"] for d in ancien["dialogues"]}
    phrases = [p for p in neuf["phrases"] if p["id"] not in anciens_ids]
    dialogues = [d for d in neuf["dialogues"] if d["id"] not in anciens_ids]

    lignes = []
    w = lignes.append
    w("# Wortschatz — phrases et dialogues à relire (version 3.3)")
    w("")
    w(f"Contenu ajouté depuis la révision `{revision}` : **{len(phrases)} phrases** et "
      f"**{len(dialogues)} dialogues** ({sum(len(d['repliques']) for d in dialogues)} répliques), "
      f"rédigés par un assistant d’écriture (Claude) et **non relus par un locuteur natif**. "
      "Ce document est fait pour la relecture du texte allemand, et de son équivalent français si "
      "la relectrice le souhaite.")
    w("")
    w("Ce qu’il est utile de dire pour chaque ligne : *naturel* / *acceptable mais on dirait plutôt …* / "
      "*faux*. L’identifiant permet de reporter la correction dans `data/conversation.json` sans rien "
      "casser : les cartes de révision des utilisateurs ne portent jamais le texte, seulement "
      "l’identifiant.")
    w("")
    w("Les 26 dialogues de la version 3.2 ont déjà été validés en allemand et ne figurent pas ici. "
      "Les 148 phrases isolées de la 3.2 n’ont pas été relues non plus ; elles se listent avec "
      "`python build/relecture.py <révision d’avant la 3.2>` si l’on veut les revoir.")
    w("")
    w("Le *contexte* est la notice que l’application affiche sous la phrase (« Quand l’employer »). "
      "Le *registre* dit à qui la phrase s’adresse : *poli* (vouvoiement) ou *familier* (tutoiement).")
    w("")

    w("## Phrases")
    w("")
    for theme_id in [t["id"] for t in neuf["themes"]]:
        lot = [p for p in phrases if p["theme"] == theme_id]
        if not lot:
            continue
        t = themes[theme_id]
        nombre = "1 phrase" if len(lot) == 1 else f"{len(lot)} phrases"
        w(f"### {t['fr']} — *{t['de']}* (`{theme_id}`, {nombre})")
        w("")
        w("| Identifiant | Allemand | Français | Registre · contexte |")
        w("|---|---|---|---|")
        for p in lot:
            de = cellule(p["de"])
            fr = cellule(p["fr"])
            vde = variantes(p, "de")
            vfr = variantes(p, "fr")
            if vde:
                de += f"<br>*var. : {cellule(vde)}*"
            if vfr:
                fr += f"<br>*var. : {cellule(vfr)}*"
            registre = p.get("registre") or "—"
            contexte = cellule(p["situation"]["fr"]) if isinstance(p.get("situation"), dict) else cellule(p.get("situation", ""))
            w(f"| `{p['id']}` | {de} | {fr} | *{registre}* · {contexte} |")
        w("")

    w("## Dialogues")
    w("")
    w("Les répliques sont dans l’ordre. Une réplique marquée *→ ph-…* reprend mot pour mot une "
      "phrase listée plus haut : corriger l’une, c’est corriger l’autre.")
    w("")
    for d in dialogues:
        t = themes[d["theme"]]
        w(f"### `{d['id']}` — {d['titre']['fr']} / *{d['titre']['de']}*")
        w("")
        w(f"Situation : {t['fr']}. Registre : *{d['registre']}*. "
          f"A = {d['roles']['A']['fr']} (*{d['roles']['A']['de']}*), "
          f"B = {d['roles']['B']['fr']} (*{d['roles']['B']['de']}*).")
        w("")
        for r in d["repliques"]:
            lien = f" *(→ {r['phrase']})*" if r.get("phrase") else ""
            w(f"{r['id'][1:]}. **{r['qui']}** — {r['de']}{lien}  ")
            w(f"    {r['fr']}")
        w("")

    sortie.write_text("\n".join(lignes) + "\n", encoding="utf-8", newline="\n")
    print(f"{sortie.relative_to(RACINE)} : {len(phrases)} phrases, {len(dialogues)} dialogues")


if __name__ == "__main__":
    principal()
