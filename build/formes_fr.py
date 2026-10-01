#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Formes fléchies du français.

Le dictionnaire TEI de WikDict n'en donne que 27 384, contre 211 388 côté
allemand, et **aucune conjugaison** : DBnary n'extrait pas les tables de
conjugaison du Wiktionnaire français, qui vivent sur des pages séparées. Sans
elles, taper « faut », « vais » ou « était » ne mène nulle part — soit un quart
des mots d'un texte français ordinaire.

Trois apports, dans cet ordre de fiabilité :

1. **La base des formes de WikDict** (`fr.sqlite3`, table `form`) : 785 905
   lignes de pluriels et de féminins, dont les irréguliers qu'aucune règle ne
   devine — *beau → bel, belle, beaux*, *vieux → vieil, vieille*,
   *national → nationaux*. Données réelles, même provenance, même licence.

2. **Une table de verbes irréguliers**, écrite à la main. Ce sont les verbes les
   plus fréquents de la langue : les laisser de côté aurait laissé « suis »,
   « est », « ai », « fait », « peut » sans réponse.

3. **Des règles de conjugaison** pour les verbes réguliers, appliquées
   largement — on engendre les trois patrons du troisième groupe sans chercher
   à deviner lequel s'applique.

Ce que la générosité du point 3 coûterait en fausses formes, une seule règle
l'annule : **une forme engendrée n'est retenue que si le corpus Tatoeba
l'écrit vraiment**. Une conjugaison inventée n'apparaît dans aucune phrase et
disparaît ; une conjugaison correcte est attestée des dizaines de fois. On ne
devine donc jamais — on propose, et le corpus tranche.

Bénéfice de bord : la clé de recherche ignore les accents et les cédilles, si
bien que « préfère » et « prefere », « commençons » et « commencons » se
confondent. Il n'y a pas à modéliser les alternances é/è ni c/ç.
"""

import re
import sqlite3
from collections import defaultdict
from pathlib import Path

import commun
import grammaire

SOURCES = Path(__file__).resolve().parent / "sources"
BASE_FORMES = "fr-lang.sqlite3"

# La table `form` de WikDict traîne parfois la prononciation dans le champ :
# « cheval \ʃə.val\ ou \ʃval\ ». Une forme fléchie ne contient ni barre oblique
# inversée, ni parenthèse, ni virgule.
FORME_PROPRE = re.compile(r"^[^\W\d_][^\\/(),;:0-9]*$", re.UNICODE)


def formes_de_la_base(vedettes):
    """Pluriels et féminins, depuis `fr.sqlite3`.

    On ne retient que les entrées natives (`fra/…`) : les autres sont les pages
    que les Wiktionnaires étrangers consacrent au français, sans flexions.
    """
    chemin = SOURCES / BASE_FORMES
    if not chemin.exists():
        return {}, 0

    lien = sqlite3.connect(f"file:{chemin}?mode=ro", uri=True)
    lexentries = defaultdict(list)
    requete = ("SELECT lexentry, written_rep FROM entry "
               "WHERE lexentry LIKE 'fra/%' AND written_rep IS NOT NULL")
    for lexentry, vedette in lien.execute(requete):
        if vedette in vedettes:
            lexentries[lexentry].append(vedette)

    resultat = defaultdict(set)
    retenues = 0
    for lexentry, forme in lien.execute(
            "SELECT lexentry, other_written_full FROM form WHERE lexentry LIKE 'fra/%'"):
        cibles = lexentries.get(lexentry)
        if not cibles or not forme or not FORME_PROPRE.match(forme):
            continue
        cle_forme = commun.cle(forme)
        if not cle_forme or " " in cle_forme:
            continue
        for vedette in cibles:
            cle_vedette = commun.cle(vedette)
            if cle_forme != cle_vedette:
                resultat[cle_forme].add(cle_vedette)
                retenues += 1
    lien.close()
    return dict(resultat), retenues


# ── Verbes irréguliers ──────────────────────────────────────────────────────
#
# Écrits à la main, parce que ce sont eux qu'on rencontre à chaque phrase et
# qu'aucune règle ne les produit. Une forme qui appartient à deux verbes —
# « suis » est à la fois « être » et « suivre » — figure sous les deux : l'index
# accepte plusieurs lemmes pour une forme, et l'application les montre tous.

IRREGULIERS = {
    "être": "suis es est sommes êtes sont étais était étions étiez étaient fus fut "
            "fûmes fûtes furent serai seras sera serons serez seront serais serait "
            "serions seriez seraient sois soit soyons soyez soient fût étant été",
    "avoir": "ai as a avons avez ont avais avait avions aviez avaient eus eut eûmes "
             "eûtes eurent aurai auras aura aurons aurez auront aurais aurait aurions "
             "auriez auraient aie aies ait ayons ayez aient eût ayant eu eue eues",
    "aller": "vais vas va allons allez vont allais allait allions alliez allaient "
             "allai alla allâmes allèrent irai iras ira irons irez iront irais irait "
             "irions iriez iraient aille ailles aillent allant allé allée allés allées",
    "faire": "fais fait faisons faites font faisais faisait faisions faisiez faisaient "
             "fis fit fîmes firent ferai feras fera ferons ferez feront ferais ferait "
             "ferions feriez feraient fasse fasses fassions fassiez fassent faisant "
             "faite faits",
    "pouvoir": "peux peut pouvons pouvez peuvent pouvais pouvait pouvions pouviez "
               "pouvaient pus put pûmes purent pourrai pourras pourra pourrons pourrez "
               "pourront pourrais pourrait pourrions pourriez pourraient puisse puisses "
               "puissions puissiez puissent pouvant pu",
    "vouloir": "veux veut voulons voulez veulent voulais voulait voulions vouliez "
               "voulaient voulus voulut voulurent voudrai voudras voudra voudrons "
               "voudrez voudront voudrais voudrait voudrions voudriez voudraient "
               "veuille veuilles veuillent veuillez voulant voulu voulue voulues",
    "devoir": "dois doit devons devez doivent devais devait devions deviez devaient "
              "dus dut durent devrai devras devra devrons devrez devront devrais "
              "devrait devrions devriez devraient doive doives devant dû due dues",
    "savoir": "sais sait savons savez savent savais savait savions saviez savaient "
              "sus sut surent saurai sauras saura saurons saurez sauront saurais "
              "saurait saurions sauriez sauraient sache saches sachions sachiez "
              "sachent sachant su sue sues",
    "voir": "vois voit voyons voyez voient voyais voyait voyions voyiez voyaient vis "
            "vit vîmes virent verrai verras verra verrons verrez verront verrais "
            "verrait verrions verriez verraient voie voies voyant vu vue vues",
    "venir": "viens vient venons venez viennent venais venait venions veniez venaient "
             "vins vint vinrent viendrai viendras viendra viendrons viendrez viendront "
             "viendrais viendrait viendrions viendriez viendraient vienne viennes "
             "venant venu venue venues",
    "tenir": "tiens tient tenons tenez tiennent tenais tenait tenions teniez tenaient "
             "tins tint tinrent tiendrai tiendras tiendra tiendrons tiendrez tiendront "
             "tiendrais tiendrait tiendraient tienne tiennes tenant tenu tenue tenues",
    "prendre": "prends prend prenons prenez prennent prenais prenait prenions preniez "
               "prenaient pris prit prirent prendrai prendras prendra prendrons "
               "prendrez prendront prendrais prendrait prendrions prendriez "
               "prendraient prenne prennes prenant prise prises",
    "mettre": "mets met mettons mettez mettent mettais mettait mettions mettiez "
              "mettaient mis mit mirent mettrai mettras mettra mettrons mettrez "
              "mettront mettrais mettrait mettrions mettriez mettraient mette mettes "
              "mettant mise mises",
    "dire": "dis dit disons dites disent disais disait disions disiez disaient dirent "
            "dirai diras dira dirons direz diront dirais dirait dirions diriez diraient "
            "dise dises disant dite dits",
    "falloir": "faut fallait fallut faudra faudrait faudrais faille fallu",
    "valoir": "vaux vaut valons valez valent valait valaient valut vaudra vaudrait "
              "vaille valant valu value",
    "croire": "crois croit croyons croyez croient croyais croyait croyions croyiez "
              "croyaient crus crut crurent croirai croiras croira croirons croirez "
              "croiront croirais croirait croiraient croie croies croyant cru crue",
    "boire": "bois boit buvons buvez boivent buvais buvait buvions buviez buvaient bus "
             "but burent boirai boiras boira boirons boirez boiront boirais boirait "
             "boive boives buvant bu bue",
    "vivre": "vis vit vivons vivez vivent vivais vivait vivions viviez vivaient vécus "
             "vécut vécurent vivrai vivras vivra vivrons vivrez vivront vivrais "
             "vivrait vive vives vivant vécu vécue vécues",
    "écrire": "écris écrit écrivons écrivez écrivent écrivais écrivait écrivions "
              "écriviez écrivaient écrivis écrivit écrivirent écrirai écriras écrira "
              "écrirons écrirez écriront écrirais écrirait écrive écrives écrivant "
              "écrite écrits écrites",
    "lire": "lis lit lisons lisez lisent lisais lisait lisions lisiez lisaient lus lut "
            "lurent lirai liras lira lirons lirez liront lirais lirait lise lises "
            "lisant lu lue lues",
    "connaître": "connais connaît connaissons connaissez connaissent connaissais "
                 "connaissait connaissions connaissiez connaissaient connus connut "
                 "connurent connaîtrai connaîtra connaîtrais connaîtrait connaisse "
                 "connaisses connaissant connu connue connues",
    "naître": "nais naît naissons naissez naissent naissais naissait naquis naquit "
              "naquirent naîtra naîtrait naisse naissant né née nés nées",
    "mourir": "meurs meurt mourons mourez meurent mourais mourait mourions mouriez "
              "mouraient mourus mourut moururent mourrai mourra mourrais mourrait "
              "meure meures mourant mort morte morts mortes",
    "courir": "cours court courons courez courent courais courait courions couriez "
              "couraient courus courut coururent courrai courra courrais courrait "
              "coure coures courant couru courue",
    "ouvrir": "ouvre ouvres ouvrons ouvrez ouvrent ouvrais ouvrait ouvrions ouvriez "
              "ouvraient ouvris ouvrit ouvrirent ouvrirai ouvrira ouvrirais ouvrirait "
              "ouvrant ouvert ouverte ouverts ouvertes",
    "recevoir": "reçois reçoit recevons recevez reçoivent recevais recevait recevions "
                "receviez recevaient reçus reçut reçurent recevrai recevra recevrais "
                "recevrait reçoive reçoives recevant reçu reçue reçues",
    "suivre": "suis suit suivons suivez suivent suivais suivait suivions suiviez "
              "suivaient suivis suivit suivirent suivrai suivra suivrais suivrait "
              "suive suives suivant suivi suivie suivies",
    "rire": "ris rit rions riez rient riais riait riaient rirent rirai rira rirais "
            "rirait rie ries riant ri",
    "plaire": "plais plaît plaisons plaisez plaisent plaisais plaisait plut plurent "
              "plaira plairait plaise plaises plaisant plu",
    "pleuvoir": "pleut pleuvait pleuvra pleuvrait pleuve plu",
    "envoyer": "envoie envoies envoient envoyons envoyez envoyais envoyait envoyaient "
               "envoyai envoya enverrai enverras enverra enverrons enverrez enverront "
               "enverrais enverrait envoyant envoyé envoyée envoyés envoyées",
    "asseoir": "assieds assied asseyons asseyez asseyent asseyais asseyait assis "
               "assit assirent assiérai assiérait asseye asseyant assise assises",
    "battre": "bats bat battons battez battent battais battait battirent battrai "
              "battra battrais battrait batte battes battant battu battue battues",
    "craindre": "crains craint craignons craignez craignent craignais craignait "
                "craignis craignit craindrai craindra craindrait craigne craignant",
    "joindre": "joins joint joignons joignez joignent joignais joignait joignit "
               "joindrai joindra joindrait joigne joignant",
    "peindre": "peins peint peignons peignez peignent peignais peignait peignit "
               "peindrai peindra peindrait peigne peignant",
    "conduire": "conduis conduit conduisons conduisez conduisent conduisais conduisait "
                "conduisis conduirai conduira conduirait conduise conduisant conduite",
    "fuir": "fuis fuit fuyons fuyez fuient fuyais fuyait fuirai fuira fuirait fuie "
            "fuyant fui",
    "cueillir": "cueille cueilles cueillent cueillons cueillez cueillais cueillait "
                "cueillerai cueillera cueillerait cueillant cueilli",
    "acquérir": "acquiers acquiert acquérons acquérez acquièrent acquérais acquérait "
                "acquis acquit acquerrai acquerra acquerrait acquière acquérant",
    "haïr": "hais hait haïssons haïssez haïssent haïssais haïssait haïrai haïra "
            "haïrait haïsse haïssant haï",
}


# ── Déterminants et pronoms ─────────────────────────────────────────────────
#
# Ils ne se conjuguent pas, aucune règle ne les couvre, et ce sont pourtant des
# mots qu'un débutant cherche tout le temps : « mes », « cette », « sa », « aux »
# figurent parmi les vingt formes les plus fréquentes du corpus qu'aucune entrée
# ne savait résoudre.

DETERMINANTS = {
    "mon": "ma mes",
    "ton": "ta tes",
    "son": "sa ses",
    "notre": "nos",
    "votre": "vos",
    "leur": "leurs",
    "ce": "cet cette ces",
    "celui": "celle ceux celles",
    "à": "au aux",
    "de": "du des",
    "tout": "toute tous toutes",
    "quel": "quelle quels quelles",
    "chacun": "chacune",
    "aucun": "aucune",
    "certain": "certaine certains certaines",
    "plusieurs": "",
}


# ── Règles pour les verbes réguliers ────────────────────────────────────────

TERMINAISONS_ER = (
    "e es e ons ez ent ais ait ions iez aient ai as a âmes âtes èrent "
    "erai eras era erons erez eront erais erait erions eriez eraient "
    "é ée és ées ant asse asses ât assions assiez assent"
).split()

TERMINAISONS_IR2 = (
    "is is it issons issez issent issais issait issions issiez issaient "
    "îmes îtes irent irai iras ira irons irez iront irais irait irions iriez "
    "iraient i ie is ies issant isse isses ît"
).split()

TERMINAISONS_IR3 = (
    "s s t ons ez ent ais ait ions iez aient is it îmes îtes irent "
    "irai iras ira irons irez iront irais irait iraient i ie is ies ant e es"
).split()

TERMINAISONS_RE = (
    "s s ons ez ent ais ait ions iez aient is it irent "
    "rai ras ra rons rez ront rais rait rions riez raient u ue us ues ant e es"
).split()


def candidats(verbe):
    """Toutes les formes plausibles d'un verbe, sans chercher à trancher.

    On engendre les trois patrons du troisième groupe pour tout verbe en -ir :
    « partir » suit l'un, « finir » l'autre, et rien dans la graphie ne le dit.
    Le corpus fera le tri.
    """
    formes = set()
    if verbe.endswith("er") and len(verbe) > 3:
        radical = verbe[:-2]
        # « manger » garde son e devant a et o (mangeons), « commencer » prend
        # une cédille (commençons) — mais la clé de recherche ignore la cédille,
        # il n'y a donc que le e à traiter.
        radical_doux = radical + "e" if radical.endswith("g") else radical
        for fin in TERMINAISONS_ER:
            formes.add((radical_doux if fin[0] in "aoâ" else radical) + fin)
    elif verbe.endswith("ir") and len(verbe) > 3:
        for fin in TERMINAISONS_IR2:
            formes.add(verbe[:-2] + fin)
        for fin in TERMINAISONS_IR3:
            formes.add(verbe[:-2] + fin)
        if len(verbe) >= 6:
            # « partir » → « pars » : le singulier perd la consonne du radical.
            # Le radical raccourci doit garder au moins trois lettres : sur
            # « vomir » il ne restait que « vo », d'où la forme « vos » —
            # attestée, mais comme possessif, et « vomir » l'héritait.
            for fin in TERMINAISONS_IR3:
                formes.add(verbe[:-3] + fin)
    elif verbe.endswith("re") and len(verbe) > 3:
        for fin in TERMINAISONS_RE:
            formes.add(verbe[:-2] + fin)
    return formes


def construire(entrees, compte_corpus, journal=None):
    """L'index des formes françaises. Renvoie {clé de forme: {clés de lemme}}.

    `entrees` est le dictionnaire des vedettes françaises,
    `compte_corpus` le décompte des graphies vues dans le corpus Tatoeba.
    """
    vedettes = set(entrees)
    cles_vedettes = {commun.cle(m) for m in entrees}
    resultat = defaultdict(set)
    bilan = {"base": 0, "irreguliers": 0, "regles": 0, "ecartees": 0, "homographes": 0, "determinants": 0}

    def poser(forme, lemme):
        cle_forme = commun.cle(forme)
        cle_lemme = commun.cle(lemme)
        if not cle_forme or " " in cle_forme or cle_forme == cle_lemme:
            return False
        if len(cle_forme) < 2:
            return False
        resultat[cle_forme].add(cle_lemme)
        return True

    # 1. Ce que WikDict sait déjà.
    de_la_base, _ = formes_de_la_base(vedettes)
    for cle_forme, lemmes in de_la_base.items():
        for cle_lemme in lemmes:
            if cle_forme != cle_lemme:
                resultat[cle_forme].add(cle_lemme)
                bilan["base"] += 1

    # 2. Verbes irréguliers et déterminants, sans condition : ils sont écrits à
    #    la main et répondent d'eux-mêmes. Le corpus n'a pas à les valider.
    for table, compteur in ((IRREGULIERS, "irreguliers"), (DETERMINANTS, "determinants")):
        for lemme, liste in table.items():
            if lemme not in vedettes:
                continue
            for forme in liste.split():
                if poser(forme, lemme):
                    bilan[compteur] += 1

    # 2 bis. Les formes des entrées grammaticales écrites pour l'application
    #        (voir grammaire.py) : « ma », « mes », « cette », « n' »…
    for forme, lemme in grammaire.formes_supplementaires():
        if lemme in vedettes and poser(forme, lemme):
            bilan["determinants"] += 1

    # 3. Les verbes réguliers, sous condition d'attestation.
    for mot, entree in entrees.items():
        if mot in IRREGULIERS or " " in mot:
            continue
        if not any(lecture[0] == "v" for lecture in entree["lectures"]):
            continue
        for forme in candidats(mot):
            # L'attestation se juge sur la clé, non sur la graphie : « achete »
            # engendré par la règle et « achète » écrit dans le corpus ont la
            # même clé, et c'est bien la même forme. Sans cela il faudrait
            # modéliser les alternances é/è, qui ne changent rien à la
            # recherche.
            cle_forme = commun.cle(forme)
            if compte_corpus.get(cle_forme, 0) < 1:
                bilan["ecartees"] += 1
                continue
            # Une forme *engendrée* ne prend jamais la place d'un mot existant.
            # La règle du troisième groupe fabriquait « pâs » pour « pâlir » —
            # dont la clé est celle de « pas », l'un des mots les plus fréquents
            # de la langue : « pâlir » se retrouvait quatorzième du classement,
            # et taper « pas » proposait « pâlir ». Les formes venues du TEI ou
            # de la table écrite à la main gardent ce droit, elles : « wurde »
            # est bien le prétérit de « werden », même si « Würde » existe.
            if cle_forme in cles_vedettes:
                bilan["homographes"] += 1
                continue
            if poser(forme, mot):
                bilan["regles"] += 1

    if journal is not None:
        journal.update(bilan)
        journal["formes"] = len(resultat)
        journal["nouvelles_cles"] = sum(1 for k in resultat if k not in cles_vedettes)
    return dict(resultat)
