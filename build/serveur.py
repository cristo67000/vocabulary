#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serveur de développement : sert le dossier de l'application en local.

`python -m http.server` suffirait, à un détail près : il n'envoie aucun
en-tête de cache, et le navigateur garde alors les scripts d'avant une
modification selon sa propre estimation — on corrige un fichier, on recharge,
et c'est l'ancien qui tourne. Ici tout part avec `Cache-Control: no-cache` :
le navigateur revalide chaque fichier à chaque chargement. Le service worker
de l'application garde, lui, sa propre logique de cache.

Usage : python build/serveur.py [port]      (8150 par défaut)
"""

import functools
import http.server
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".idx": "text/plain; charset=utf-8",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        # Seulement les erreurs : un chargement de l'application, c'est une
        # centaine de requêtes réussies qui noieraient le reste.
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(format, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8150
    gestionnaire = functools.partial(Gestionnaire, directory=str(RACINE))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), gestionnaire) as serveur:
        print(f"Vocabulary : http://localhost:{port}/", flush=True)
        serveur.serve_forever()


if __name__ == "__main__":
    main()
