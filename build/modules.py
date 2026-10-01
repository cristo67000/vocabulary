#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construction du contenu des modules : `data/modules.json`.

Trois sources, chacune dite sur chaque fiche (`src`) :

  claude          les fiches rédigées pour l'application — mots courants et
                  actuels, argot et abréviations, IA, expressions, faux amis —
                  dans `build/contenu/*.txt` (format décrit plus bas) ;
  code-en-clair   le glossaire du codage de Code en clair (même auteur) :
                  399 termes définis en français et en anglais, avec leurs
                  schémas — repris tel quel, plus un nom anglais pour les
                  termes nommés en français ;
  franceterme     les termes recommandés au Journal officiel par la
                  Commission d'enrichissement de la langue française
                  (Licence Ouverte) : l'équivalent français officiel d'un terme
                  anglais du numérique, avec sa définition.

── Le format des fiches rédigées ──────────────────────────────────────────

    module: argot            ← en tête de fichier, vaut pour la suite
    langue: en               ← idem (peut être redonné par fiche)

    @ knackered              ← identifiant (et vedette, si `w:` manque)
    t: fatigue               ← thème
    w: knackered             ← vedette, si elle diffère de l'identifiant
    tr: crevé, naze          ← équivalents dans l'autre langue
    mq: arg, gb              ← marques d'usage (voir build/marques.py)
    nat: adj                 ← nature (codes du dictionnaire : n, v, adj…)
    d-fr: … / d-en: …        ← définition dans chaque langue
    n-fr: … / n-en: …        ← note d'usage
    a-fr: … / a-en: …        ← piège à éviter
    lit-fr: … / lit-en: …    ← traduction mot à mot (expressions imagées)
    x: anglais | français    ← exemple traduit (plusieurs lignes possibles)
    v: autre-id, …           ← voir aussi (identifiants du même module)
    sc: id-de-schema         ← un dessin de js/schemas/*.js
    al: alias, …             ← autres graphies pour la recherche
    cru: 1                   ← mot cru (vulgaire, injurieux) : masqué d'office
    g: masc | fem            ← genre d'une vedette française

Une ligne qui commence par `#` est un commentaire. Une valeur peut se
poursuivre sur la ligne suivante si celle-ci commence par deux espaces.

Le script écrit aussi `build/noyau_force.txt` : les vedettes des modules que
le noyau du dictionnaire doit contenir, pour que leurs fiches s'ouvrent hors
ligne dès l'installation.

Usage : python build/modules.py
"""

import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import commun

sys.stdout.reconfigure(encoding="utf-8")

RACINE = Path(__file__).resolve().parent
CONTENU = RACINE / "contenu"
SOURCES = RACINE / "sources"
DATA = RACINE.parent / "data"

CHAMPS_BILINGUES = ("d", "n", "a", "lit")

# ── Code en clair : le nom anglais des termes nommés en français ────────────
#
# Le glossaire de Code en clair nomme chaque terme par son nom d'usage — tantôt
# anglais (« Commit », « Push »), tantôt français (« Base de données »). Un
# dictionnaire bilingue a besoin des deux. Les termes dont le nom est déjà
# anglais n'ont rien à faire ici ; `nf` (nom français) les complète dans le
# glossaire lui-même.
TECH_EN = {
    "accessibilite": "accessibility", "noreply": "noreply address", "agent": "agent",
    "algorithme": "algorithm", "arbre-donnees": "tree", "argument": "argument",
    "artefact": "artefact", "assertion": "assertion", "assistant-de-code": "coding assistant",
    "authentification": "authentication and authorisation", "bande-passante": "bandwidth",
    "cle-valeur": "key-value store", "base-de-donnees": "database", "bibliotheque": "library",
    "binaire": "binary", "boucle": "loop", "cache-http": "HTTP cache",
    "canal-alpha": "alpha channel", "certificat": "certificate", "chemin": "path",
    "chiffrement": "encryption", "classe": "class", "api-key": "API key",
    "cle-etrangere": "foreign key", "cle-primaire": "primary key",
    "cle-publique-privee": "public and private keys", "client-serveur": "client-server",
    "code-de-sortie": "exit code", "code-de-statut": "HTTP status code",
    "commentaire": "comment", "compilation": "compilation", "complexite": "complexity",
    "compression": "compression", "condition": "condition", "constante": "constant",
    "contraste-wcag": "contrast ratio", "hex-couleur": "hex colour",
    "couverture": "test coverage", "debogage": "debugging", "debugger": "debugger",
    "densite-ecran": "screen density", "dependance": "dependency",
    "deploiement": "deployment", "dette-technique": "technical debt",
    "dictionnaire": "dictionary", "echappement": "escaping", "empreinte": "hash",
    "emulateur": "emulator", "header": "HTTP header", "encodage": "character encoding",
    "nombre-flottant": "integer and float", "entrainement": "training",
    "environnement": "environment", "evenement": "event", "exception": "exception",
    "context-window": "context window", "lockfile": "lock file", "file-fifo": "queue",
    "file-attente-messages": "message queue", "fonction": "function", "graphe": "graph",
    "hallucination": "hallucination", "heritage": "inheritance",
    "hexadecimal": "hexadecimal", "ia": "AI", "icone-maskable": "maskable icon",
    "idempotence": "idempotence", "package-name": "application ID",
    "index-bdd": "index", "inference": "inference", "injection-sql": "SQL injection",
    "instance": "instance", "interface": "interface", "interpretation": "interpretation",
    "jointure": "join", "unites-octets": "kilobyte, megabyte", "latence": "latency",
    "licence": "licence", "liste-chainee": "linked list", "machine-a-etats": "state machine",
    "vm": "virtual machine", "message-de-commit": "commit message",
    "methode-http": "HTTP method", "migration": "migration", "minification": "minification",
    "modele": "model", "osi": "OSI model", "moindre-privilege": "least privilege",
    "mot-cle": "keyword", "mutabilite": "mutability", "navigateur": "browser",
    "domaine": "domain name", "normalisation": "normalisation", "objet": "object",
    "objet-git": "Git object", "operateur": "operator", "paquet": "packet",
    "paquet-logiciel": "package", "parametre": "parameter", "firewall": "firewall",
    "permission-android": "Android permission", "pile": "stack",
    "pointeur": "pointer", "polymorphisme": "polymorphism", "portee": "scope",
    "processus": "process", "profil-icc": "ICC profile", "profiling": "profiling",
    "ratio-aspect": "aspect ratio", "recette": "acceptance testing",
    "recursion": "recursion", "redirection": "redirection", "regression": "regression",
    "load-balancer": "load balancer", "requete-sql": "SQL query", "resolution": "resolution",
    "code-review": "code review", "salage": "salting", "saut-de-ligne": "line break",
    "sauvegarde-backup": "backup", "scalabilite": "scalability",
    "schema-bdd": "database schema", "secret": "secret", "data-safety": "data safety",
    "serialisation": "serialisation", "session": "session",
    "signature-numerique": "digital signature", "singleton": "singleton",
    "sous-agent": "subagent", "syntaxe": "syntax", "table": "table",
    "table-de-hachage": "hash table", "tableau": "array", "temperature": "temperature",
    "terminal": "terminal", "test-integration": "integration test",
    "test-e2e": "end-to-end test", "test-ferme": "closed testing",
    "test-unitaire": "unit test", "transaction": "transaction",
    "transpilation": "transpilation", "type": "type", "mime": "MIME type",
    "variable": "variable", "variable-denvironnement": "environment variable",
    "vectoriel-matriciel": "vector and raster", "vulnerabilite": "vulnerability",
}


def ecrire(chemin, texte):
    chemin.write_text(texte, encoding="utf-8", newline="")


# ── Lecture des fiches rédigées ─────────────────────────────────────────────

def lire_fiches(chemin):
    """Un fichier `build/contenu/*.txt` → liste de fiches (dict)."""
    fiches = []
    defauts = {}
    courante = None
    derniere_cle = None
    for numero, brute in enumerate(chemin.read_text(encoding="utf-8").splitlines(), 1):
        if brute.startswith("#") or not brute.strip():
            if not brute.strip():
                derniere_cle = None
            continue
        if brute.startswith("  ") and courante is not None and derniere_cle:
            valeur = brute.strip()
            if derniere_cle == "x":
                courante["x"][-1] += " " + valeur
            else:
                courante[derniere_cle] += " " + valeur
            continue
        if brute.startswith("@"):
            courante = dict(defauts)
            courante["id"] = brute[1:].strip()
            courante["x"] = []
            courante["_ligne"] = f"{chemin.name}:{numero}"
            fiches.append(courante)
            derniere_cle = None
            continue
        if ":" not in brute:
            raise SystemExit(f"{chemin.name}:{numero} : ligne sans « clé: » — {brute!r}")
        cle, valeur = brute.split(":", 1)
        cle, valeur = cle.strip(), valeur.strip()
        if courante is None:
            defauts[cle] = valeur
            continue
        if cle == "x":
            courante["x"].append(valeur)
        else:
            courante[cle] = valeur
        derniere_cle = cle
    return fiches


def liste(valeur, separateurs=","):
    """« a, b (c, d) ; e » → ['a', 'b (c, d)', 'e'] : un séparateur entre
    parenthèses ne coupe pas — « dans (mois, année, saison) » reste entier."""
    morceaux, courant, profondeur = [], "", 0
    for signe in valeur or "":
        if signe == "(":
            profondeur += 1
        elif signe == ")":
            profondeur = max(0, profondeur - 1)
        if signe in separateurs and profondeur == 0:
            morceaux.append(courant)
            courant = ""
        else:
            courant += signe
    morceaux.append(courant)
    return [x.strip() for x in morceaux if x.strip()]


def vers_item(fiche):
    """Une fiche rédigée → une fiche de `modules.json`."""
    module = fiche.get("module")
    if not module:
        raise SystemExit(f"{fiche['_ligne']} : pas de module")
    langue = fiche.get("langue") or "en"
    if langue not in commun.LANGUES:
        raise SystemExit(f"{fiche['_ligne']} : langue inconnue {langue!r}")
    identifiant = fiche["id"]
    item = {
        "id": f"{module}:{identifiant}",
        "m": module,
        "t": fiche.get("t", ""),
        "l": langue,
        "w": fiche.get("w") or identifiant.replace("_", " "),
        # « du poivre ; un poivron » : deux équivalents, comme avec la virgule.
        "tr": liste(fiche.get("tr"), ",;"),
        "src": fiche.get("src", "claude"),
    }
    for cle in ("mq",):
        if fiche.get(cle):
            item[cle] = liste(fiche[cle])
    for cle in ("nat", "g", "api"):
        if fiche.get(cle):
            item[cle] = fiche[cle]
    if fiche.get("al"):
        item["al"] = liste(fiche["al"])
    if fiche.get("cru") in ("1", "oui", "true"):
        item["cru"] = 1
    sens = {}
    for champ in CHAMPS_BILINGUES:
        valeur = {l: fiche[f"{champ}-{l}"] for l in commun.LANGUES if fiche.get(f"{champ}-{l}")}
        if valeur:
            sens[champ] = valeur
    exemples = []
    for x in fiche.get("x", []):
        if "|" not in x:
            raise SystemExit(f"{fiche['_ligne']} : exemple sans « | » — {x!r}")
        en, fr = (morceau.strip() for morceau in x.split("|", 1))
        # Un fichier peut écrire ses exemples dans l'ordre « français |
        # anglais » (en-tête « exemples: fr-en ») : on les remet d'aplomb.
        if fiche.get("exemples") == "fr-en":
            en, fr = fr, en
        exemples.append([en, fr])
    if exemples:
        sens["x"] = exemples
    if fiche.get("sc"):
        sens["sc"] = fiche["sc"]
    item["s"] = [sens] if sens else []
    if fiche.get("v"):
        item["v"] = [v if ":" in v else f"{module}:{v}" for v in liste(fiche["v"])]
    return item


# ── Définition des modules et de leurs thèmes ───────────────────────────────

def lire_modules(chemin):
    """`build/contenu/modules.txt` → liste de modules avec leurs thèmes."""
    modules = []
    courant = None
    for numero, brute in enumerate(chemin.read_text(encoding="utf-8").splitlines(), 1):
        ligne = brute.strip()
        if not ligne or ligne.startswith("#"):
            continue
        m = re.fullmatch(r"\[module\s+([\w-]+)\]", ligne)
        if m:
            courant = {"id": m.group(1), "themes": []}
            modules.append(courant)
            continue
        cle, valeur = (x.strip() for x in ligne.split(":", 1))
        if cle == "theme":
            morceaux = [x.strip() for x in valeur.split("|")]
            if len(morceaux) != 3:
                raise SystemExit(f"modules.txt:{numero} : thème « id | fr | en » attendu")
            courant["themes"].append({"id": morceaux[0], "nom": {"fr": morceaux[1], "en": morceaux[2]}})
            continue
        m = re.fullmatch(r"(nom|court|accroche|intro)-(fr|en)", cle)
        if m:
            courant.setdefault(m.group(1), {})[m.group(2)] = valeur
            continue
        courant[cle] = valeur
    return modules


# ── Code en clair ────────────────────────────────────────────────────────────

def items_code_en_clair(chemin):
    if not chemin.exists():
        print("  ! glossaire de Code en clair absent — module technique sans lui")
        return [], []
    glossaire = json.loads(chemin.read_text(encoding="utf-8"))
    themes = [{"id": c["id"], "nom": {"fr": c["fr"], "en": c["en"]}} for c in glossaire["cats"]]
    items = []
    sans_nom_anglais = []
    for terme in glossaire["termes"]:
        nom = terme["n"]
        nom_fr = terme.get("nf")
        if nom_fr:
            anglais, francais = nom, [x.strip() for x in nom_fr.split(",") if x.strip()]
        elif terme["id"] in TECH_EN:
            anglais, francais = TECH_EN[terme["id"]], [nom]
        else:
            anglais, francais = nom, [nom]
            if re.search(r"[àâçéèêëîïôûùœ]", nom):
                sans_nom_anglais.append(terme["id"])
        sens = []
        for s in terme.get("s", []):
            bloc = {"d": {"fr": s.get("f", ""), "en": s.get("e", "")}}
            if s.get("pf") or s.get("pe"):
                bloc["n"] = {"fr": s.get("pf", ""), "en": s.get("pe", "")}
            if s.get("af") or s.get("ae"):
                bloc["a"] = {"fr": s.get("af", ""), "en": s.get("ae", "")}
            if s.get("ex"):
                bloc["ex"] = s["ex"]
            if s.get("sc"):
                bloc["sc"] = s["sc"]
            if s.get("lb"):
                bloc["lib"] = {"fr": s["lb"][0], "en": s["lb"][1]} if isinstance(s["lb"], list) else s["lb"]
            sens.append(bloc)
        item = {
            "id": "tech:" + terme["id"],
            "m": "tech",
            "t": terme["c"],
            "l": "en",
            "w": anglais,
            "tr": francais,
            "s": sens,
            "src": "code-en-clair",
            "nat": "n",
        }
        if terme.get("dev"):
            item["dev"] = terme["dev"]
        if terme.get("al"):
            item["al"] = terme["al"][:10]
        if terme.get("v"):
            item["v"] = ["tech:" + v for v in terme["v"]]
        items.append(item)
    if sans_nom_anglais:
        print(f"  ! {len(sans_nom_anglais)} termes nommés en français sans nom anglais : "
              f"{', '.join(sans_nom_anglais[:12])}")
    return themes, items


# ── FranceTerme ──────────────────────────────────────────────────────────────

DOMAINES_TECH = {"Informatique", "Télécommunications", "Intelligence artificielle"}
SOUS_DOMAINES_TECH = {"Internet"}
MOTS_IA = re.compile(r"apprentissage|intelligence artificielle|réseau de neurones|modèle|"
                     r"génératif|générative|neuronal|donnée d’entraînement|jeton|agent conversationnel|"
                     r"instruction générative|hypertrucage|dialogueur|robot conversationnel",
                     re.IGNORECASE)


def nettoyer(texte):
    return re.sub(r"\s+", " ", (texte or "")).strip()


def date_iso(brute):
    m = re.fullmatch(r"(\d\d)/(\d\d)/(\d{4})", (brute or "").strip())
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else ""


def items_franceterme(chemin):
    if not chemin.exists():
        print("  ! FranceTerme absent")
        return []
    racine = ET.parse(chemin).getroot()
    items = []
    vus = set()
    for article in racine.findall("Article"):
        if article.get("annule") == "1" or article.get("publie") == "0":
            continue
        domaines = {nettoyer(d.text) for d in article.findall("Domaine/Dom")}
        sous = {nettoyer(d.text) for d in article.findall("Domaine/S-dom")}
        terme = article.find("Terme")
        if terme is None:
            continue
        vedette = nettoyer(terme.get("Terme") or "".join(terme.itertext()))
        equivalents = []
        for e in article.findall("Equivalent"):
            if e.get("langue") != "en":
                continue
            for prop in e.findall("Equi_prop"):
                texte = nettoyer("".join(prop.itertext()))
                if texte and texte not in equivalents:
                    equivalents.append(texte)
        if not vedette or not equivalents or vedette.startswith(("Recommandation", "Décision")):
            continue
        definition = nettoyer("".join(article.find("Definition").itertext())) \
            if article.find("Definition") is not None else ""
        notes = nettoyer("".join(article.find("Notes").itertext())) \
            if article.find("Notes") is not None else ""
        date = date_iso(article.findtext("DatePub"))
        technique = bool(domaines & DOMAINES_TECH or sous & SOUS_DOMAINES_TECH)
        general = "Tous domaines" in domaines
        if not technique and not general:
            continue
        if general and not technique and date and date < "2005":
            # Les plus anciens « tous domaines » sont surtout de la mécanique
            # (amortisseur, châssis-support) : pas du vocabulaire d'aujourd'hui.
            continue
        if technique:
            theme = "ft-ia" if MOTS_IA.search(vedette + " " + definition) else (
                "ft-telecom" if "Télécommunications" in domaines and "Informatique" not in domaines
                else "ft-info")
            module = "tech"
        else:
            theme, module = "officiel", "actuel"
        # « rendre anonyme » → rendre-anonyme ; les doublons de vedette (un
        # même terme dans deux domaines) ne donnent qu'une fiche.
        ident = re.sub(r"[^\w]+", "-", commun.cle(vedette)).strip("-")[:60]
        cle = (module, ident)
        if cle in vus:
            continue
        vus.add(cle)
        sens = {"d": {"fr": definition}} if definition else {}
        if notes:
            sens["n"] = {"fr": notes[:600]}
        item = {
            "id": f"{module}:ft-{ident}",
            "m": module,
            "t": theme,
            "l": "fr",
            "w": vedette.replace(", -", ", ").split(", ")[0] if ", -" in vedette else vedette,
            "tr": equivalents[:4],
            "s": [sens] if sens else [],
            "src": "franceterme",
            "date": date,
        }
        items.append(item)
    return items


# ── Contrôles ────────────────────────────────────────────────────────────────

def controler(modules, items):
    fautes = []
    ids = set()
    themes = {m["id"]: {t["id"] for t in m["themes"]} for m in modules}
    for item in items:
        if item["id"] in ids:
            fautes.append(f"identifiant en double : {item['id']}")
        ids.add(item["id"])
        if item["m"] not in themes:
            fautes.append(f"{item['id']} : module inconnu {item['m']}")
        elif item["t"] not in themes[item["m"]]:
            fautes.append(f"{item['id']} : thème inconnu {item['t']!r}")
        if not item["tr"]:
            fautes.append(f"{item['id']} : aucun équivalent")
        for code in item.get("mq", ()):
            if code not in MARQUES_CONNUES:
                fautes.append(f"{item['id']} : marque inconnue {code!r}")
    for item in items:
        for v in item.get("v", ()):
            if v not in ids:
                fautes.append(f"{item['id']} : renvoi introuvable {v}")
    return fautes


MARQUES_CONNUES = {"fam", "tfam", "arg", "vulg", "inj", "pej", "web", "abr", "neo", "angl",
                   "hum", "iron", "euph", "enf", "fig", "sout", "vieilli", "vx", "rare",
                   "dial", "gb", "us", "ie", "sc", "au", "nz", "ca", "za", "in", "qc", "be",
                   "ch", "af"}


def main():
    modules = lire_modules(CONTENU / "modules.txt")
    items = []
    for chemin in sorted(CONTENU.glob("*.txt")):
        if chemin.name == "modules.txt":
            continue
        fiches = lire_fiches(chemin)
        items.extend(vers_item(f) for f in fiches)
        print(f"  {chemin.name:<24} {len(fiches):5d} fiches")

    themes_tech, tech = items_code_en_clair(SOURCES / "glossaire-code-en-clair.json")
    for module in modules:
        if module["id"] == "tech":
            # Les catégories de Code en clair après les thèmes déclarés
            # (l'IA d'abord), sans doublon.
            deja = {t["id"] for t in module["themes"]}
            module["themes"].extend(t for t in themes_tech if t["id"] not in deja)
    items.extend(tech)
    print(f"  Code en clair            {len(tech):5d} termes")

    officiels = items_franceterme(SOURCES / "FranceTerme.xml")
    items.extend(officiels)
    print(f"  FranceTerme              {len(officiels):5d} termes "
          f"({sum(1 for i in officiels if i['m'] == 'tech')} techniques, "
          f"{sum(1 for i in officiels if i['m'] == 'actuel')} généraux)")

    fautes = controler(modules, items)
    if fautes:
        print("\n".join("  ✗ " + f for f in fautes[:60]))
        raise SystemExit(f"{len(fautes)} anomalies dans le contenu des modules")

    # Les fiches rédigées d'abord dans chaque thème, dans l'ordre du fichier ;
    # puis Code en clair ; puis FranceTerme, par ordre alphabétique.
    rang_source = {"claude": 0, "code-en-clair": 1, "franceterme": 2}
    items.sort(key=lambda i: (rang_source.get(i["src"], 3),
                              commun.cle(i["w"]) if i["src"] == "franceterme" else ""))

    contenu = {
        "format": "vocabulary-modules",
        "version": 1,
        "construit": time.strftime("%Y-%m-%d"),
        "licence": "CC BY-SA 4.0 (fiches rédigées) ; Code en clair ; FranceTerme, Licence Ouverte",
        "modules": modules,
        "items": items,
    }
    texte = json.dumps(contenu, ensure_ascii=False, separators=(",", ":"))
    DATA.mkdir(exist_ok=True)
    ecrire(DATA / "modules.json", texte)

    force = sorted({f"{i['l']}:{i['w']}" for i in items})
    ecrire(RACINE / "noyau_force.txt", "\n".join(force) + "\n")

    par_module = {}
    for i in items:
        par_module[i["m"]] = par_module.get(i["m"], 0) + 1
    print(f"\ndata/modules.json : {len(items)} fiches, {commun.humain(len(texte.encode('utf-8')))}"
          f" — {', '.join(f'{m} {n}' for m, n in par_module.items())}")
    print(f"build/noyau_force.txt : {len(force)} vedettes")


if __name__ == "__main__":
    main()
