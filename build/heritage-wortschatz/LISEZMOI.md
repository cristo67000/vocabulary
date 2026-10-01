# Essais hérités de Wortschatz — à adapter

Vocabulary est parti du code de Wortschatz (dictionnaire allemand ⇄ français).
Ces scripts de recette viennent de là et parlent encore allemand : mots
d'essai (« Haus », « gehen »), langue `de`, voix `de-DE`, identifiants de
contenu de Wortschatz. Ils ne tournent **pas** tels quels sur Vocabulary.

Ils sont gardés parce que leur mécanique reste bonne et servira à les
réécrire : pilotage de Chrome sans affichage par CDP (`pilote_chrome.mjs`),
serveur d'essai capable de couper le réseau (`serveur_essai.mjs`), fausse
IndexedDB pour Node (`faux_indexeddb.mjs`), recettes de la coquille hors
ligne, de la mise à jour, des migrations et des voix.

Ce qui tourne aujourd'hui sur Vocabulary :

    node build/essais.mjs        correction des réponses, choix de l'exercice, révision
    node build/essais_i18n.mjs   chaque libellé employé existe en français et en anglais
    python build/verifier.py     cohérence des paquets de données (et les deux essais)
