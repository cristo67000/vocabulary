'use strict';
/*
 * Schémas de la catégorie « Web et navigateur ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'web-trois-langages': {
      k: 'pile',
      alt: ['Les trois langages du web : HTML pour le contenu, CSS pour l’apparence, JavaScript pour le comportement', 'The web’s three languages: HTML for content, CSS for appearance, JavaScript for behavior'],
      piles: [{
        t: ['Une page web = trois couches', 'A web page = three layers'],
        layers: [
          { t: 'JavaScript', d: ['comportement : clics, données, animations', 'behavior: clicks, data, animations'], s: 'warn' },
          { t: 'CSS', d: ['apparence : couleurs, polices, mise en page', 'appearance: colors, fonts, layout'], s: 'v' },
          { t: 'HTML', d: ['structure : titres, textes, liens, images', 'structure: headings, text, links, images'], s: 'a' },
        ],
      }],
    },

    'web-dom': {
      k: 'arbre',
      alt: ['Le DOM : une page HTML représentée sous forme d’arbre', 'The DOM: an HTML page represented as a tree'],
      racine: {
        t: 'html', s: 'a', k: [
          { t: 'head', s: 'v', k: [{ t: 'title', s: 'ok' }] },
          { t: 'body', s: 'v', k: [{ t: 'h1', s: 'ok' }, { t: 'p', s: 'ok', k: [{ t: 'a', s: 'ok' }] }] },
        ],
      },
      l: ['Chaque balise devient un nœud que JavaScript peut lire et modifier.', 'Each tag becomes a node that JavaScript can read and modify.'],
    },

    'web-headless': {
      k: 'graphe',
      alt: ['Un navigateur headless est piloté par un script, sans fenêtre visible', 'A headless browser is driven by a script, with no visible window'],
      n: [
        { id: 's', t: ['Votre script\n(Playwright…)', 'Your script\n(Playwright…)'], c: 0, r: 0, s: 'a', w: 116 },
        { id: 'c', t: ['Chrome\nheadless', 'Headless\nChrome'], c: 1, r: 0, s: 'v', w: 116, dash: true },
        { id: 'p', t: ['Page web\nchargée', 'Web page\nloaded'], c: 1, r: 1, s: 'info', w: 116 },
        { id: 'r', t: ['Résultat :\ncapture, PDF, test', 'Result:\nscreenshot, PDF, test'], c: 0, r: 1, s: 'ok', w: 116 },
      ],
      e: [['s', 'c', ['pilote', 'drives'], 'a'], ['c', 'p', ['charge et exécute', 'loads and runs'], 'v'], ['p', 'r', ['rendu', 'output'], 'ok']],
      l: ['Le navigateur est bien là, mais sans fenêtre : personne ne le regarde.', 'The browser is really there, just with no window: nobody looks at it.'],
    },

    'web-service-worker': {
      k: 'graphe',
      alt: ['Le service worker s’interpose entre la page et le réseau et peut répondre depuis le cache', 'The service worker sits between the page and the network and can answer from the cache'],
      gy: 72,
      n: [
        { id: 'p', t: 'Page', c: 1, r: 0, s: 'a', w: 100 },
        { id: 's', t: 'Service worker', c: 1, r: 1, s: 'v', w: 118, h: 42 },
        { id: 'c', t: 'Cache', c: 0, r: 2, f: 'db', s: 'ok', w: 90, h: 48 },
        { id: 'r', t: ['Réseau', 'Network'], c: 2, r: 2, f: 'cloud', s: 'info', w: 96, h: 52 },
      ],
      e: [['p', 's', ['requête', 'request'], 'a'], ['s', 'c', ['en cache ?', 'cached?'], 'ok'], ['s', 'r', ['sinon', 'if not'], 'info dash']],
    },

    'web-sw-cycle': {
      k: 'graphe',
      alt: ['Le cycle de vie d’un service worker : installation, attente, activation', 'A service worker’s lifecycle: install, wait, activate'],
      gy: 66,
      n: [
        { id: 'i', t: 'installing', c: 0, r: 0, s: 'a', mono: true, w: 106, sz: 11 },
        { id: 'w', t: 'waiting', c: 1, r: 0, s: 'warn', mono: true, w: 106, sz: 11 },
        { id: 'a', t: 'activating', c: 1, r: 1, s: 'v', mono: true, w: 106, sz: 11 },
        { id: 'd', t: 'activated', c: 1, r: 2, s: 'ok', mono: true, w: 106, sz: 11 },
        { id: 'x', t: 'redundant', c: 0, r: 1, s: 'mute', mono: true, w: 106, sz: 11 },
      ],
      e: [['i', 'w', ['install', 'install'], 'a'], ['w', 'a', ['skipWaiting', 'skipWaiting'], 'warn'], ['a', 'd', ['activate', 'activate'], 'v'], ['i', 'x', ['échec', 'failure'], 'bad dash']],
      l: ['« waiting » dure tant que des pages utilisent encore l’ancienne version, sauf skipWaiting().', '“waiting” lasts as long as pages still use the old version, unless skipWaiting() is called.'],
    },

    'web-pwa': {
      k: 'graphe',
      alt: ['Une PWA repose sur trois piliers : HTTPS, un manifeste, un service worker', 'A PWA rests on three pillars: HTTPS, a manifest, a service worker'],
      gy: 84,
      n: [
        { id: 'h', t: 'HTTPS', c: 0, r: 0, s: 'info', w: 98 },
        { id: 'm', t: ['Manifeste', 'Manifest'], c: 1, r: 0, s: 'v', w: 98 },
        { id: 's', t: ['Service\nworker', 'Service\nworker'], c: 2, r: 0, s: 'warn', w: 98 },
        { id: 'p', t: ['PWA installable\net hors ligne', 'Installable\noffline PWA'], c: 1, r: 1, s: 'ok', w: 150 },
      ],
      e: [['h', 'p', '', 'info'], ['m', 'p', '', 'v'], ['s', 'p', '', 'warn']],
    },

    'web-manifest': {
      k: 'graphe',
      alt: ['Le navigateur lit le manifeste pour installer l’application avec son nom et son icône', 'The browser reads the manifest to install the app with its name and icon'],
      n: [
        { id: 'f', t: 'manifest\n.webmanifest', c: 0, r: 0, f: 'file', s: 'v', w: 94, h: 50, mono: true, sz: 9.5 },
        { id: 'n', t: ['Navigateur', 'Browser'], c: 1, r: 0, s: 'a', w: 82, sz: 11 },
        { id: 'e', t: ['Écran d’accueil', 'Home screen'], sub: ['nom · icône\nplein écran', 'name · icon\nfull screen'], c: 2, r: 0, s: 'ok', w: 98, h: 58, sz: 10.5 },
      ],
      e: [['f', 'n', '', 'v'], ['n', 'e', '', 'ok']],
    },

    'web-csp': {
      k: 'graphe',
      alt: ['Avec la politique default-src « self », seul ce qui vient du même site est accepté', 'With the default-src “self” policy, only what comes from the same site is accepted'],
      gy: 62,
      n: [
        { id: 'p', t: ['Page', 'Page'], sub: "default-src 'self'", c: 0, r: 1, s: 'a', w: 118, h: 52 },
        { id: 'a', t: ['script du même site', 'script from the same site'], c: 1, r: 0, s: 'ok', w: 158 },
        { id: 'b', t: ['script d’un autre site', 'script from another site'], c: 1, r: 1, s: 'bad', w: 158 },
        { id: 'c', t: ['script écrit dans le HTML', 'script written inline in HTML'], c: 1, r: 2, s: 'bad', w: 158 },
      ],
      e: [['p', 'a', '✓', 'ok'], ['p', 'b', '✗', 'bad'], ['p', 'c', '✗', 'bad']],
    },

    'web-cors': {
      k: 'sequence',
      lh: 44,
      alt: ['CORS : le navigateur demande au serveur s’il autorise l’origine de la page', 'CORS: the browser asks the server whether it allows the page’s origin'],
      a: [['Navigateur\nmon-site.org', 'Browser\nmy-site.org'], ['Serveur\napi.exemple.org', 'Server\napi.example.org']],
      s: ['a', 'v'],
      m: [
        [0, 1, 'OPTIONS · Origin: mon-site.org'],
        [1, 0, 'Access-Control-Allow-Origin: mon-site.org', 'ok dash'],
        [0, 1, 'GET /données', 'a'],
        [1, 0, '200 OK + données', 'ok dash'],
        ['note', 0, 1, ['Sans l’en-tête d’autorisation, le navigateur bloque la lecture de la réponse.', 'Without the permission header, the browser blocks reading the response.']],
      ],
    },

    'web-flexbox': {
      k: 'dessin',
      h: 190,
      alt: ['Trois valeurs de justify-content : flex-start, center, space-between', 'Three justify-content values: flex-start, center, space-between'],
      d: [
        ['text', 10, 14, 'justify-content: flex-start', { a: 's', mono: true, sz: 10.5, s: 'mute', b: true }],
        ['rect', 10, 24, 340, 36, { s: 'mute', r: 6 }],
        ['rect', 16, 30, 56, 24, { s: 'a', t: '1', r: 4 }],
        ['rect', 80, 30, 56, 24, { s: 'a', t: '2', r: 4 }],
        ['rect', 144, 30, 56, 24, { s: 'a', t: '3', r: 4 }],
        ['text', 10, 82, 'justify-content: center', { a: 's', mono: true, sz: 10.5, s: 'mute', b: true }],
        ['rect', 10, 92, 340, 36, { s: 'mute', r: 6 }],
        ['rect', 88, 98, 56, 24, { s: 'v', t: '1', r: 4 }],
        ['rect', 152, 98, 56, 24, { s: 'v', t: '2', r: 4 }],
        ['rect', 216, 98, 56, 24, { s: 'v', t: '3', r: 4 }],
        ['text', 10, 150, 'justify-content: space-between', { a: 's', mono: true, sz: 10.5, s: 'mute', b: true }],
        ['rect', 10, 160, 340, 36, { s: 'mute', r: 6 }],
        ['rect', 16, 166, 56, 24, { s: 'ok', t: '1', r: 4 }],
        ['rect', 152, 166, 56, 24, { s: 'ok', t: '2', r: 4 }],
        ['rect', 288, 166, 56, 24, { s: 'ok', t: '3', r: 4 }],
      ],
    },

    'web-clone': {
      k: 'graphe',
      alt: ['Un clone web : un outil suit les liens d’un site et en copie chaque fichier', 'A web clone: a tool follows a site’s links and copies each file'],
      n: [
        { id: 's', t: ['Site web', 'Website'], c: 0, r: 0, f: 'cloud', s: 'v', w: 98, h: 56 },
        { id: 'o', t: ['Outil', 'Tool'], sub: 'wget · HTTrack', c: 1, r: 0, s: 'a', w: 92, h: 52 },
        { id: 'c', t: ['Copie\nlocale', 'Local\ncopy'], c: 2, r: 0, f: 'db', s: 'ok', w: 84, h: 62 },
      ],
      e: [['o', 's', '', 'a'], ['s', 'o', '', 'v dash'], ['o', 'c', '', 'ok']],
    },

  });
})(window);
