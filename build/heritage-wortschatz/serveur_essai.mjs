/*
 * Un serveur de fichiers qu'on peut faire tomber.
 *
 * `python -m http.server` suffit à servir l'application ; il ne suffit pas à
 * éprouver ce qui se passe quand le réseau lâche *pendant* une installation.
 * Celui-ci se pilote depuis l'épreuve, sans le relancer :
 *
 *   etat.dossier      le dossier servi — on en change pour jouer une publication ;
 *   etat.mode         'normal', 'coupe' (la connexion est fermée sans réponse :
 *                     le réseau ne répond pas) ou 'erreur' (503 : il répond mal) ;
 *   etat.delaiMarque  un délai, en millisecondes, sur les seules requêtes qui
 *                     portent la marque d'installation du service worker
 *                     (`?coquille=…`) — de quoi couper au milieu, sûrement.
 *
 * Il sert avec `Cache-Control: max-age=600`, comme GitHub Pages : une épreuve
 * qui passerait grâce à l'absence de cache HTTP ne prouverait rien.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.idx': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export function demarrerServeur({ port, dossier }) {
  const etat = { dossier, mode: 'normal', delaiMarque: 0, marque: 'coquille=', journal: [] };

  const serveur = http.createServer(async (requete, reponse) => {
    const url = new URL(requete.url, 'http://localhost');
    const marque = url.search.indexOf(etat.marque) !== -1;
    etat.journal.push({ chemin: url.pathname, marque, mode: etat.mode, quand: Date.now() });

    if (etat.mode === 'coupe') { requete.socket.destroy(); return; }
    if (etat.mode === 'erreur') {
      reponse.writeHead(503, { 'Content-Type': 'text/plain' });
      reponse.end('hors service');
      return;
    }
    if (marque && etat.delaiMarque) {
      await new Promise((r) => setTimeout(r, etat.delaiMarque));
      // Le réseau a pu tomber pendant l'attente.
      if (etat.mode === 'coupe') { requete.socket.destroy(); return; }
    }

    let chemin = decodeURIComponent(url.pathname);
    if (chemin.endsWith('/')) chemin += 'index.html';
    const racine = path.resolve(etat.dossier);
    const fichier = path.resolve(racine, '.' + chemin);
    if (!fichier.startsWith(racine)) {
      reponse.writeHead(403); reponse.end(); return;
    }
    try {
      const donnees = await readFile(fichier);
      reponse.writeHead(200, {
        'Content-Type': TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream',
        'Content-Length': donnees.length,
        'Cache-Control': 'max-age=600',
      });
      reponse.end(donnees);
    } catch (erreur) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain' });
      reponse.end('introuvable');
    }
  });
  serveur.keepAliveTimeout = 500;

  return new Promise((resoudre, rejeter) => {
    serveur.once('error', rejeter);
    serveur.listen(port, '127.0.0.1', () => {
      resoudre({
        etat,
        fermer: () => new Promise((r) => { serveur.closeAllConnections(); serveur.close(() => r()); }),
      });
    });
  });
}
