#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les marques d'usage : familier, argot, vulgaire, britannique, vieilli…

── Pourquoi elles comptent ─────────────────────────────────────────────────

Traduire « knackered » par « éreinté » est exact et trompeur : l'un se dit au
pub, l'autre dans un roman. Une application qui veut faire parler juste doit
dire **à quel registre** appartient un mot, dans les deux langues — et, pour
l'anglais, **où** il se dit : « flat » est britannique, « apartment »
américain.

Les deux éditions du Wiktionnaire notent ces marques, et wiktextract les
normalise en étiquettes anglaises (`slang`, `familiar`, `vulgar`, `UK`…).
WikDict, lui, les laisse en tête de définition : « (UK, slang, offensive) Tired
or exhausted », « (Argot) (Péjoratif) Policier ». Ce module ramène les deux à un
même petit vocabulaire de codes, courts parce qu'ils voyagent dans chaque sens.

── Les codes ──────────────────────────────────────────────────────────────

  fam     familier, informel, parlé          tfam   très familier
  arg     argot                              web    internet, SMS
  vulg    vulgaire                           inj    injurieux, insultant
  pej     péjoratif                          abr    abréviation, sigle
  vieilli vieilli                            vx     vieux, archaïque, obsolète
  rare    rare                               sout   soutenu, littéraire
  hum     plaisant                           iron   ironique
  fig     figuré                             enf    enfantin
  euph    euphémisme                         neo    néologisme
  angl    anglicisme                         dial   dialectal
  gb us au ca ie sc nz za in               régions de l'anglais
  qc be ch af                               régions du français

`vulg` et `inj` sont les **mots crus** : l'application les masque tant qu'on ne
demande pas à les voir (réglage « Afficher les mots crus »).
"""

import re

ETIQUETTES = {
    # registre
    "informal": "fam", "colloquial": "fam", "familiar": "fam", "casual": "fam",
    "very-familiar": "tfam",
    "slang": "arg", "argot": "arg", "cant": "arg", "street-slang": "arg",
    "vulgar": "vulg", "crude": "vulg", "obscene": "vulg", "coarse": "vulg",
    "offensive": "inj", "slur": "inj", "ethnic-slur": "inj", "insult": "inj",
    "derogatory": "pej", "pejorative": "pej", "disparaging": "pej",
    "Internet": "web", "internet": "web", "text-messaging": "web", "SMS": "web",
    "abbreviation": "abr", "acronym": "abr", "initialism": "abr", "clipping": "abr",
    "dated": "vieilli", "archaic": "vx", "obsolete": "vx", "historical": "vieilli",
    "rare": "rare", "uncommon": "rare",
    "formal": "sout", "literary": "sout", "poetic": "sout",
    "humorous": "hum", "jocular": "hum",
    "ironic": "iron", "sarcastic": "iron",
    "figuratively": "fig", "metaphoric": "fig",
    "childish": "enf", "baby-talk": "enf",
    "euphemistic": "euph", "euphemism": "euph",
    "neologism": "neo", "nonce-word": "neo",
    "Anglicism": "angl", "anglicism": "angl",
    "dialectal": "dial", "regional": "dial",
    # régions de l'anglais
    "UK": "gb", "British": "gb", "Britain": "gb", "England": "gb", "Commonwealth": "gb",
    "Received-Pronunciation": "gb", "Cockney": "gb", "London": "gb",
    "US": "us", "American": "us", "General-American": "us",
    "Australia": "au", "Australian": "au",
    "Canada": "ca", "Canadian": "ca",
    "Ireland": "ie", "Irish": "ie",
    "Scotland": "sc", "Scottish": "sc",
    "New-Zealand": "nz", "South-Africa": "za", "India": "in", "Indian-English": "in",
    # régions du français (étiquettes brutes de l'édition française)
    "Québec": "qc", "Quebec": "qc", "Belgique": "be", "Belgium": "be",
    "Suisse": "ch", "Switzerland": "ch", "Afrique": "af",
}

# Les marques brutes de l'édition française qui ne sont pas normalisées.
BRUTES = {
    "France": "", "Canada": "qc", "Québec": "qc", "Belgique": "be", "Suisse": "ch",
    "Afrique": "af", "Louisiane": "", "Argot": "arg", "Verlan": "arg",
    "Argot internet": "web", "Langage SMS": "web", "Internet": "web",
    "Très familier": "tfam", "Populaire": "fam", "Familier": "fam",
    "Vulgaire": "vulg", "Injurieux": "inj", "Péjoratif": "pej",
    "Vieilli": "vieilli", "Désuet": "vieilli", "Archaïsme": "vx", "Vieux": "vx",
    "Néologisme": "neo", "Anglicisme": "angl", "Enfantin": "enf",
    "Euphémisme": "euph", "Ironique": "iron", "Figuré": "fig",
    "Littéraire": "sout", "Soutenu": "sout", "Poétique": "sout",
}

# Ordre d'affichage : ce qui prévient d'abord (cru, péjoratif), puis le
# registre, puis l'âge, puis la région.
ORDRE = ["inj", "vulg", "pej", "tfam", "arg", "fam", "web", "abr", "neo", "angl",
         "hum", "iron", "euph", "enf", "fig", "sout", "vieilli", "vx", "rare", "dial",
         "gb", "us", "ie", "sc", "au", "nz", "ca", "za", "in", "qc", "be", "ch", "af"]
RANG = {code: i for i, code in enumerate(ORDRE)}

CRUS = {"vulg", "inj"}

REGIONS_EN = {"gb", "us", "ie", "sc", "au", "nz", "ca", "za", "in"}


def ranger(codes):
    vus = []
    for code in codes:
        if code and code not in vus:
            vus.append(code)
    return sorted(vus, key=lambda c: RANG.get(c, 99))


def depuis_etiquettes(etiquettes, brutes=()):
    """Étiquettes wiktextract (et brutes de l'édition française) → codes."""
    etiquettes = list(etiquettes or ())
    codes = []
    # « mildly vulgar » : knackered, bloody. Le Wiktionary le dit lui-même,
    # ce n'est pas un mot cru — familier, et à ne pas employer partout.
    adouci = "mildly" in etiquettes or "sometimes" in etiquettes
    for etiquette in etiquettes:
        code = ETIQUETTES.get(etiquette)
        if code == "vulg" and adouci:
            code = "fam"
        elif code == "inj" and adouci:
            code = "pej"
        if code:
            codes.append(code)
    for brute in brutes or ():
        code = BRUTES.get(brute)
        if code:
            codes.append(code)
    # « UK » sur un mot qui ne se dit plus nulle part n'apprend rien : la
    # région ne s'affiche qu'accompagnée d'un usage vivant, ce que le ranger
    # suffit à garantir (on ne supprime rien ici).
    return ranger(codes)


# « (UK, Irish, Commonwealth, slang, sometimes, offensive) Tired or exhausted. »
# « (Argot) (Péjoratif) (Familier) Policier »
PREFIXE = re.compile(r"^\s*((?:\([^()]{1,80}\)\s*)+)")

MOTS_DE_PREFIXE = {
    "slang": "arg", "argot": "arg", "informal": "fam", "colloquial": "fam",
    "familier": "fam", "populaire": "fam", "très familier": "tfam",
    "vulgar": "vulg", "vulgaire": "vulg", "offensive": "inj", "injurieux": "inj",
    "derogatory": "pej", "pejorative": "pej", "péjoratif": "pej",
    "dated": "vieilli", "vieilli": "vieilli", "archaic": "vx", "obsolete": "vx",
    "désuet": "vieilli", "vieux": "vx", "rare": "rare", "internet": "web",
    "internet slang": "web", "text messaging": "web", "sms": "web",
    "humorous": "hum", "ironique": "iron", "figuratively": "fig", "figuré": "fig",
    "formal": "sout", "literary": "sout", "littéraire": "sout", "soutenu": "sout",
    "uk": "gb", "british": "gb", "britain": "gb", "commonwealth": "gb",
    "us": "us", "american": "us", "canada": "ca", "australia": "au",
    "ireland": "ie", "irish": "ie", "scotland": "sc",
    "québec": "qc", "belgique": "be", "suisse": "ch",
    "anglicisme": "angl", "néologisme": "neo", "enfantin": "enf",
    "euphémisme": "euph",
}


def depuis_definition(definition):
    """Les marques écrites en tête d'une définition WikDict, et la définition
    débarrassée de celles qu'on a su lire.

    Les parenthèses qui ne contiennent aucune marque connue (« (of a person) »,
    « (Informatique) ») restent en place : ce sont des précisions de sens ou de
    domaine, utiles au lecteur.
    """
    if not definition:
        return [], definition
    m = PREFIXE.match(definition)
    if not m:
        return [], definition
    codes = []
    gardees = []
    for groupe in re.findall(r"\(([^()]*)\)", m.group(1)):
        morceaux = [x.strip() for x in re.split(r"[,;]", groupe) if x.strip()]
        trouves = []
        adouci = any(x.lower() in ("mildly", "sometimes") for x in morceaux)
        for x in morceaux:
            code = MOTS_DE_PREFIXE.get(x.lower())
            if code == "vulg" and adouci:
                code = "fam"
            elif code == "inj" and adouci:
                code = "pej"
            if code:
                trouves.append(code)
        if trouves and len(trouves) * 2 >= len([x for x in morceaux
                                                 if x.lower() not in ("sometimes", "mildly",
                                                                      "often", "chiefly",
                                                                      "especially", "now")]):
            codes.extend(trouves)
        else:
            gardees.append("(" + groupe + ")")
    reste = definition[m.end():].strip()
    if gardees:
        reste = " ".join(gardees) + " " + reste
    return ranger(codes), reste


def est_cru(codes):
    return bool(CRUS.intersection(codes or ()))


if __name__ == "__main__":
    import commun  # noqa: F401  (console en UTF-8)
    essais = [
        (["Commonwealth", "Ireland", "UK", "mildly", "slang", "vulgar"], [], ["arg", "fam", "gb", "ie"]),
        (["familiar", "pejorative", "slang"], [], ["pej", "arg", "fam"]),
        (["colloquial", "vulgar"], [], ["vulg", "fam"]),
        (["familiar"], ["France", "Belgique", "Suisse"], ["fam", "be", "ch"]),
    ]
    fautes = 0
    for etiquettes, brutes, attendu in essais:
        obtenu = depuis_etiquettes(etiquettes, brutes)
        ok = obtenu == attendu
        fautes += not ok
        print(("ok " if ok else "NON"), etiquettes, brutes, "→", obtenu)
    for texte, attendu in [
        ("(UK, Irish, Commonwealth, slang, sometimes, offensive) Tired or exhausted.",
         (["pej", "arg", "gb", "ie"], "Tired or exhausted.")),
        ("(Argot) (Péjoratif) (Familier) Policier", (["pej", "arg", "fam"], "Policier")),
        ("(of a person) Having a lot of money.", ([], "(of a person) Having a lot of money.")),
        ("(Informatique) Programme malveillant.", ([], "(Informatique) Programme malveillant.")),
    ]:
        obtenu = depuis_definition(texte)
        ok = obtenu == attendu
        fautes += not ok
        print(("ok " if ok else "NON"), texte, "→", obtenu)
    raise SystemExit(1 if fautes else 0)
