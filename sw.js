'use strict';
/*
 * Service worker.
 *
 * Deux sortes de fichiers, deux traitements :
 *
 *   la coquille (HTML, CSS, JavaScript, manifeste de l'application, contenu
 *   fourni) — **cache d'abord, depuis le cache de cette version et de lui
 *   seul**. Une page ne reçoit jamais qu'un jeu complet d'une seule version :
 *   celui que ce service worker a installé, tout ou rien, dans un cache qui
 *   porte son numéro. Une version suivante se prépare dans un autre cache, et
 *   ne prend la main qu'au feu vert de `js/miseajour.js` — quand la personne a
 *   accepté le bandeau. Tant qu'elle attend, l'ancienne sert, entière.
 *
 *   les données (data/…) — **cache d'abord**. Un fichier de dictionnaire ne
 *   change jamais à l'intérieur d'une mouture : le redemander au réseau serait
 *   du temps et des octets perdus. Une nouvelle mouture porte de nouveaux noms
 *   de cache, et c'est l'application qui la télécharge.
 *
 * Pourquoi la coquille n'est pas servie « réseau d'abord » (leçon de
 * Wortschatz, dont ce service worker est repris) : une page ouverte recevrait
 * le code neuf dès sa publication, avec les données d'avant — et une coupure
 * au milieu d'un chargement pourrait lui donner la moitié des scripts d'une
 * version et l'autre moitié de l'autre. La version suivante s'installe en
 * arrière-plan, complète, puis attend le feu vert du bandeau.
 *
 * ⚠ Ce service worker ne supprime **que** les caches de coquille périmés. Le
 * cache des données (`vocabulary-donnees-…`) ne lui appartient pas : il
 * contient le dictionnaire complet que l'appareil a téléchargé, et une mise à
 * jour du code n'est pas une raison de le lui reprendre. Seul js/paquets.js
 * l'efface, sur demande explicite ou en installant une version plus récente.
 */

const VERSION = 'v1.2.0';
const COQUILLE = 'vocabulary-coquille-' + VERSION;

/* Les ressources obligatoires : sans l'une d'elles, il n'y a pas
 * d'application, et rien n'est proposé. */
const FICHIERS = [
  './',
  'index.html',
  'confidentialite.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/page.css',
  'css/schema.css',
  'js/i18n.js',
  'js/outils.js',
  'js/lexique.js',
  'js/store.js',
  'js/voix.js',
  'js/revision.js',
  'js/exercices.js',
  'js/notes.js',
  'js/perso.js',
  'js/conversation.js',
  'js/motsvifs.js',
  'js/schema.js',
  'js/schemas/apprendre.js',
  'js/schemas/git.js',
  'js/schemas/shell.js',
  'js/schemas/web.js',
  'js/schemas/reseau.js',
  'js/schemas/data.js',
  'js/schemas/secu.js',
  'js/schemas/langage.js',
  'js/schemas/outils.js',
  'js/schemas/image.js',
  'js/schemas/bdd.js',
  'js/schemas/mobile.js',
  'js/schemas/ia.js',
  'js/schemas/qualite.js',
  'js/schemas/archi.js',
  'js/fiche.js',
  'js/modules.js',
  'js/seance.js',
  'js/progres.js',
  'js/atelier.js',
  'js/suivis.js',
  'js/mesmots.js',
  'js/situations.js',
  'js/sauvegarde.js',
  'js/paquets.js',
  'js/installer.js',
  'js/miseajour.js',
  'js/app.js',
  'js/demarrage.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'data/manifeste.json',
  /* Le contenu rédigé — phrases et dialogues, fiches des modules : livré et
   * versionné avec la coquille, pas avec les paquets du dictionnaire. Présent
   * dès la première installation, hors ligne compris ; le corriger ne
   * demande pas de retélécharger le dictionnaire. */
  'data/conversation.json',
  'data/modules.json',
];

/* La marque que portent les requêtes d'installation. Elle sert deux fois :
 * `cache: 'reload'` court-circuite le cache du navigateur, mais pas celui d'un
 * relais — GitHub Pages sert derrière un CDN qui garde un fichier dix minutes,
 * et juste après une publication il peut encore tenir l'ancien. Une adresse
 * que personne n'a demandée avant est forcément fraîche. Et une épreuve qui
 * veut couper le réseau *pendant* une installation reconnaît ces requêtes. */
const MARQUE = '?coquille=' + encodeURIComponent(VERSION);

/* Installe la coquille : chaque fichier obligatoire, tout ou rien, rangé sous
 * son adresse nue. Le jeu doit être d'une seule version : la page porte la
 * sienne dans une balise, et un `index.html` d'une autre version — relais en
 * retard, publication en cours — fait échouer l'installation, qui sera
 * retentée plus tard, depuis rien. */
async function installerLaCoquille(cache) {
  const manques = [];
  await Promise.all(FICHIERS.map(async (url) => {
    try {
      const reponse = await fetch(new Request(url + MARQUE, { cache: 'reload' }));
      if (!reponse.ok) { manques.push(url + ' : ' + reponse.status); return; }
      await cache.put(url, reponse);
    } catch (erreur) {
      manques.push(url + ' : ' + (erreur && erreur.message ? erreur.message : erreur));
    }
  }));
  if (manques.length) throw new Error('coquille incomplète — ' + manques.join(', '));
  const page = await cache.match('index.html');
  const html = page ? await page.text() : '';
  if (html.indexOf('name="application-version" content="' + VERSION + '"') === -1) {
    throw new Error('index.html n’est pas de la version ' + VERSION);
  }
}

/* Met en cache une liste de fichiers, un par un, en tolérant les échecs.
 *
 * Sur les fichiers du dictionnaire, un hoquet de réseau mobile, un proxy, une
 * limitation de débit, et l'installation entière échouait — donc plus aucun
 * mode hors ligne, en silence, alors que cinquante-sept fichiers étaient
 * arrivés. Ce qui manque ici sera rattrapé à l'usage : le gestionnaire
 * `fetch` range dans le cache tout fichier de données qu'il doit aller
 * chercher.
 */
async function cacherTolerant(cache, urls) {
  let manques = 0;
  // Six à la fois : assez pour ne pas attendre, assez peu pour ne pas se faire
  // limiter par l'hébergeur.
  const PARALLELE = 6;
  let curseur = 0;
  async function ouvrier() {
    while (curseur < urls.length) {
      const url = urls[curseur];
      curseur += 1;
      try {
        const reponse = await fetch(new Request(url, { cache: 'reload' }));
        if (reponse.ok) await cache.put(url, reponse);
        else manques += 1;
      } catch (erreur) {
        manques += 1;
      }
    }
  }
  const ouvriers = [];
  for (let i = 0; i < Math.min(PARALLELE, urls.length); i += 1) ouvriers.push(ouvrier());
  await Promise.all(ouvriers);
  return manques;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(COQUILLE);
    try {
      await installerLaCoquille(cache);
    } catch (erreur) {
      /* Rien n'est proposé, et rien ne reste : une coquille à moitié remplie
       * ne doit pas traîner sous le nom de cette version. La prochaine
       * tentative — au retour du réseau, à la prochaine vérification —
       * repartira de zéro. */
      await caches.delete(COQUILLE);
      throw erreur;
    }

    /* Le noyau du dictionnaire fait partie de l'installation : sans lui,
     * l'application s'ouvrirait hors ligne sur un dictionnaire vide. La liste
     * vient du manifeste plutôt que d'être recopiée ici, pour qu'une
     * reconstruction des données n'oblige pas à retoucher ce fichier.
     *
     * Le manifeste vient d'être mis en cache ; on le relit depuis le cache,
     * sans nouvelle requête. Attention : lire le corps d'une réponse la
     * consomme, et la cloner *après* lève une exception qui ferait échouer
     * toute l'installation — donc, silencieusement, plus aucun mode hors
     * ligne. C'est exactement ce qui s'est produit ici une fois. */
    const enCache = await cache.match('data/manifeste.json');
    const manifeste = await enCache.json();
    const manques = await cacherTolerant(
      cache, manifeste.paquets.noyau.fichiers.map((f) => 'data/' + f));
    if (manques) {
      console.warn('Vocabulary : ' + manques + ' fichiers du noyau non pré-cachés, '
        + 'ils seront rattrapés à l’usage.');
    }

    /* Pas de `skipWaiting()` ici. Ce service worker est prêt, mais il attend :
     * prendre la main tout seul reviendrait à changer l'application sous les
     * doigts de quelqu'un — et à effacer, en s'activant, le cache dont la page
     * ouverte se sert encore. C'est `js/miseajour.js` qui annonce la version
     * prête et qui donne le feu vert, une fois qu'on le lui a demandé. */
  })());
});

self.addEventListener('message', (e) => {
  const message = e.data || {};

  // Le feu vert du bandeau de mise à jour.
  if (message.type === 'passer-devant') self.skipWaiting();

  /* La version de la coquille n'est écrite qu'ici — et dans la balise de la
   * page, que l'installation compare à celle-ci. La page la demande plutôt
   * que d'en tenir une copie en JavaScript, qui finirait par mentir. */
  if (message.type === 'version' && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ version: VERSION });
  }
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      // Uniquement les coquilles périmées. Jamais les données.
      if (nom.startsWith('vocabulary-coquille-') && nom !== COQUILLE) {
        await caches.delete(nom);
      }
    }
    await self.clients.claim();
  })());
});

/* Le nom du cache des données de cette mouture — format et date de
 * construction, comme `Paquets.nomDuCache` le forme —, lu dans le manifeste
 * pré-caché avec la coquille. Une seule lecture par vie du service worker. */
let promesseNomDesDonnees = null;
function nomDesDonnees() {
  if (!promesseNomDesDonnees) {
    promesseNomDesDonnees = (async () => {
      try {
        const coquille = await caches.open(COQUILLE);
        const reponse = await coquille.match('data/manifeste.json');
        if (!reponse) return null;
        const m = await reponse.json();
        const mouture = m.mouture || m.construit || '';
        return 'vocabulary-donnees-' + m.version + (mouture ? '-' + mouture : '');
      } catch (erreur) {
        return null;
      }
    })();
  }
  return promesseNomDesDonnees;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const estDonnee = url.pathname.includes('/data/');

  if (estDonnee) {
    /* Cache d'abord — mais pas n'importe lequel : la coquille, où vit le
     * noyau, puis le cache des données de **cette** mouture. Jamais celui
     * d'une mouture antérieure, qui peut coexister le temps d'un
     * téléchargement : y puiser une tranche sous un index neuf donnerait un
     * dictionnaire troué. L'ancien paquet, la page le lit elle-même, par
     * l'API Cache, quand elle a décidé de s'en servir.
     *
     * Ce qui n'est nulle part est rangé au passage : un fichier du noyau
     * manqué à l'installation entre dans la coquille la première fois qu'on
     * en a besoin, un fichier du paquet complet dans le cache des données —
     * et l'application se répare d'elle-même au fil de l'usage. */
    e.respondWith((async () => {
      const coquille = await caches.open(COQUILLE);
      const dansLaCoquille = await coquille.match(e.request);
      if (dansLaCoquille) return dansLaCoquille;
      const nomDonnees = await nomDesDonnees();
      const donnees = nomDonnees ? await caches.open(nomDonnees) : null;
      if (donnees) {
        const trouve = await donnees.match(e.request);
        if (trouve) return trouve;
      }
      const reponse = await fetch(e.request);
      if (reponse.ok && !url.search) {
        const copie = reponse.clone();
        const cible = url.pathname.includes('/data/complet/') && donnees ? donnees : coquille;
        cible.put(e.request, copie).catch(() => {});
      }
      return reponse;
    })());
    return;
  }

  /* La coquille : le cache de cette version, et lui seul. Ce qui n'y est pas
   * n'est pas de la version — une image d'aperçu, une adresse inconnue — et
   * va au réseau sans rien laisser dans le cache : y ranger un fichier venu
   * d'une autre publication, c'est exactement le mélange qu'on refuse.
   * `ignoreSearch` : « index.html?x » est la page ; `ignoreVary` : un relais
   * qui varie sur l'encodage ne doit pas rendre la page introuvable. */
  e.respondWith((async () => {
    const coquille = await caches.open(COQUILLE);
    const enCache = await coquille.match(e.request, { ignoreSearch: true, ignoreVary: true });
    if (enCache) return enCache;
    return fetch(e.request);
  })());
});
