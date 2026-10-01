# -*- coding: utf-8 -*-
"""Image d'aperçu pour le partage du lien (Open Graph).

Quand on envoie l'adresse de l'application par message, le destinataire ne voit
qu'une URL nue. Cette image, annoncée par les balises og:image, donne au lien un
visage : le nom, ce que fait l'application, et les deux cartes de l'icône.

Format 1200 x 630, celui qu'attendent les messageries et les réseaux.

    python build/generer-partage.py
"""
import importlib.util
import os

from PIL import Image, ImageDraw, ImageFont

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)

MARINE = (22, 50, 79)
CREME = (250, 247, 242)
ROUGE_CLAIR = (236, 128, 146)
GRIS = (176, 190, 209)

LARGEUR, HAUTEUR = 1200, 630


def police(taille, gras=False):
    """Une police système lisible, quelle que soit la machine."""
    noms = (["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
            if gras else
            ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"])
    for nom in noms:
        for dossier in (r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu"):
            chemin = os.path.join(dossier, nom)
            if os.path.exists(chemin):
                return ImageFont.truetype(chemin, taille)
    return ImageFont.load_default()


def icone(taille):
    """Le dessin de l'icône, tel que le fait build/generer-icones.py."""
    spec = importlib.util.spec_from_file_location("icones", os.path.join(ICI, "generer-icones.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.dessiner(taille, 0.0)


def main():
    image = Image.new("RGB", (LARGEUR, HAUTEUR), MARINE)
    image.paste(icone(360), (70, 135))
    dessin = ImageDraw.Draw(image)

    x = 480
    dessin.text((x, 150), "Vocabulary", font=police(96, gras=True), fill=CREME)
    dessin.text((x, 270), "Dictionnaire anglais – français", font=police(44, gras=True), fill=CREME)
    dessin.text((x, 325), "hors ligne, pour apprendre dans les deux sens", font=police(34), fill=GRIS)
    dessin.text((x, 400), "Mots d’aujourd’hui · Argot · IA et code", font=police(32), fill=ROUGE_CLAIR)
    dessin.text((x, 442), "Expressions · Phrases · Exercices", font=police(32), fill=ROUGE_CLAIR)
    dessin.text((x, 510), "Voix britannique et voix de France · sans compte · sans publicité",
                font=police(24), fill=GRIS)

    chemin = os.path.join(RACINE, "icons", "apercu-1200x630.png")
    image.save(chemin, optimize=True)
    print(f"  {os.path.relpath(chemin, RACINE)} — {os.path.getsize(chemin) // 1024} Kio")


if __name__ == "__main__":
    main()
