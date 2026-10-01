# -*- coding: utf-8 -*-
"""Génère les icônes de Vocabulary.

Dessin : deux cartes de révision qui se chevauchent sur un fond bleu marine —
une rouge derrière, une crème devant, marquée de deux flèches opposées
(l'anglais vers le français, le français vers l'anglais). Bleu, blanc, rouge :
les couleurs que partagent l'Union Jack et le drapeau français, sans dessiner
ni l'un ni l'autre. Rien de plus : à 48 pixels sur un écran de téléphone,
tout détail supplémentaire devient une tache.

Le tout est dessiné au quadruple de la taille finale puis réduit : Pillow ne
lisse pas les bords, le suréchantillonnage s'en charge.

    python build/generer-icones.py
"""
import os

from PIL import Image, ImageDraw

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(os.path.dirname(ICI), "icons")

MARINE = (22, 50, 79)       # --accent de l'application
CREME = (250, 247, 242)
ROUGE = (179, 36, 59)       # --rouge

E = 4  # facteur de suréchantillonnage


def dessiner(taille, marge_relative=0.0):
    """Une icône carrée. `marge_relative` réserve la zone rognée des icônes
    masquables d'Android, qui peut découper jusqu'à 20 % de chaque bord."""
    grand = taille * E
    image = Image.new("RGB", (grand, grand), MARINE)
    dessin = ImageDraw.Draw(image)

    marge = grand * marge_relative
    unite = (grand - 2 * marge) / 100.0

    def p(x, y):
        return (int(marge + x * unite), int(marge + y * unite))

    def boite(x1, y1, x2, y2):
        return [*p(x1, y1), *p(x2, y2)]

    rayon = int(8 * unite)

    # La carte du fond, rouge, et deux traits crème : du texte, sans en écrire.
    dessin.rounded_rectangle(boite(10, 12, 70, 58), radius=rayon, fill=ROUGE)
    dessin.rounded_rectangle(boite(19, 21, 53, 26), radius=int(2.5 * unite), fill=CREME)
    dessin.rounded_rectangle(boite(19, 30, 43, 35), radius=int(2.5 * unite), fill=CREME)

    # La carte de devant, crème, avec un liseré marine qui la détache.
    dessin.rounded_rectangle(boite(28, 38, 90, 88), radius=rayon, fill=CREME,
                             outline=MARINE, width=max(1, int(2 * unite)))

    # Les deux flèches : → en haut, ← en bas.
    epaisseur = int(5 * unite)
    dessin.line([p(39, 55), p(73, 55)], fill=MARINE, width=epaisseur)
    dessin.polygon([p(81, 55), p(71, 47.5), p(71, 62.5)], fill=MARINE)
    dessin.line([p(79, 72), p(45, 72)], fill=ROUGE, width=epaisseur)
    dessin.polygon([p(37, 72), p(47, 64.5), p(47, 79.5)], fill=ROUGE)

    return image.resize((taille, taille), Image.LANCZOS)


def main():
    os.makedirs(SORTIE, exist_ok=True)
    for nom, taille, marge in (
        ("icon-192.png", 192, 0.05),
        ("icon-512.png", 512, 0.05),
        # Android rogne les icônes masquables : on garde le dessin au centre.
        ("icon-maskable-512.png", 512, 0.19),
        # Pour la fiche du Play Store (512 px, sans transparence).
        ("icon-store-512.png", 512, 0.08),
        ("apple-touch-icon.png", 180, 0.08),
        ("favicon-48.png", 48, 0.02),
    ):
        chemin = os.path.join(SORTIE, nom)
        dessiner(taille, marge).save(chemin, optimize=True)
        print(f"  {nom} — {os.path.getsize(chemin)} octets")


if __name__ == "__main__":
    main()
