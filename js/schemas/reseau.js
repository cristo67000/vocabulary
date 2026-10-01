'use strict';
/*
 * Schémas de la catégorie « Réseau et HTTP ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'reseau-requete-reponse': {
      k: 'sequence',
      alt: ['Un échange HTTP : le navigateur envoie une requête, le serveur répond', 'An HTTP exchange: the browser sends a request, the server answers'],
      a: [['Navigateur', 'Browser'], ['Serveur', 'Server']],
      s: ['a', 'v'],
      m: [
        [0, 1, 'GET /page.html'],
        [1, 0, '200 OK + HTML', 'ok dash'],
        [0, 1, 'GET /style.css'],
        [1, 0, '200 OK + CSS', 'ok dash'],
        ['note', 0, 1, ['Chaque échange est indépendant : le serveur ne se souvient de rien.', 'Each exchange is independent: the server remembers nothing.']],
      ],
    },

    'reseau-tls': {
      k: 'sequence',
      lh: 42,
      alt: ['La poignée de main TLS : négociation, certificat, échange de clés, puis données chiffrées', 'The TLS handshake: negotiation, certificate, key exchange, then encrypted data'],
      a: [['Navigateur', 'Browser'], ['Serveur', 'Server']],
      s: ['a', 'v'],
      m: [
        [0, 1, ['Bonjour + algorithmes', 'Hello + algorithms']],
        [1, 0, ['Choix + certificat', 'Choice + certificate'], 'dash'],
        [0, 0, ['vérifie le certificat', 'checks the certificate'], 'warn'],
        [0, 1, ['échange de clés', 'key exchange']],
        [1, 0, ['prêt', 'ready'], 'dash'],
        [0, 1, ['données chiffrées (HTTP)', 'encrypted data (HTTP)'], 'ok'],
      ],
    },

    'reseau-dns': {
      k: 'sequence',
      lh: 44,
      alt: ['Le DNS traduit un nom de domaine en adresse IP avant la requête', 'DNS translates a domain name into an IP address before the request'],
      a: [['Navigateur', 'Browser'], ['Serveur DNS', 'DNS server'], ['Serveur web', 'Web server']],
      s: ['a', 'warn', 'v'],
      m: [
        [0, 1, ['IP de exemple.org ?', 'IP of example.org?']],
        [1, 0, '93.184.216.34', 'ok dash'],
        [0, 2, 'GET / → 93.184.216.34'],
        [2, 0, '200 OK', 'ok dash'],
      ],
    },

    'reseau-url': {
      k: 'dessin',
      h: 100,
      alt: ['Les parties d’une URL : protocole, domaine, port, chemin, paramètres, ancre', 'The parts of a URL: protocol, domain, port, path, parameters, anchor'],
      d: [
        ['rect', 6, 8, 40, 26, { s: 'a', t: 'https', mono: true, sz: 9.5, r: 4 }],
        ['text', 53, 25, '://', { mono: true, sz: 9.5, s: 'mute' }],
        ['rect', 60, 8, 96, 26, { s: 'v', t: 'www.exemple.org', mono: true, sz: 9.5, r: 4 }],
        ['rect', 156, 8, 40, 26, { s: 'warn', t: ':8080', mono: true, sz: 9.5, r: 4 }],
        ['rect', 196, 8, 68, 26, { s: 'ok', t: '/blog/post', mono: true, sz: 9.5, r: 4 }],
        ['rect', 264, 8, 56, 26, { s: 'info', t: '?lang=fr', mono: true, sz: 9.5, r: 4 }],
        ['rect', 320, 8, 38, 26, { s: 'mute', t: '#avis', mono: true, sz: 9.5, r: 4 }],
        ['line', 26, 36, 26, 46, { s: 'a' }],
        ['text', 26, 55, ['protocole', 'protocol'], { s: 'a', sz: 10, b: true }],
        ['line', 108, 36, 108, 46, { s: 'v' }],
        ['text', 108, 55, ['domaine', 'domain'], { s: 'v', sz: 10, b: true }],
        ['line', 176, 36, 176, 64, { s: 'warn' }],
        ['text', 176, 73, 'port', { s: 'warn', sz: 10, b: true }],
        ['line', 230, 36, 230, 46, { s: 'ok' }],
        ['text', 230, 55, ['chemin', 'path'], { s: 'ok', sz: 10, b: true }],
        ['line', 292, 36, 292, 64, { s: 'info' }],
        ['text', 292, 73, ['paramètres', 'parameters'], { s: 'info', sz: 10, b: true }],
        ['line', 339, 36, 339, 46, { s: 'mute' }],
        ['text', 336, 55, ['ancre', 'anchor'], { s: 'mute', sz: 10, b: true }],
      ],
    },

    'reseau-statuts': {
      k: 'pile',
      lh: 32,
      alt: ['Les cinq familles de codes de statut HTTP', 'The five families of HTTP status codes'],
      piles: [{
        layers: [
          { t: '1xx', d: ['information', 'informational'], s: 'mute' },
          { t: '2xx', d: ['réussite · 200 OK', 'success · 200 OK'], s: 'ok' },
          { t: '3xx', d: ['redirection · 301 déplacé', 'redirection · 301 moved'], s: 'info' },
          { t: '4xx', d: ['erreur du client · 404 introuvable', 'client error · 404 not found'], s: 'warn' },
          { t: '5xx', d: ['erreur du serveur · 500', 'server error · 500'], s: 'bad' },
        ],
      }],
    },

    'reseau-proxy': {
      k: 'graphe',
      alt: ['Un proxy direct sert un réseau ; un proxy inverse protège des serveurs', 'A forward proxy serves a network; a reverse proxy shields servers'],
      gy: 80,
      n: [
        { id: 'a', t: ['Votre\nréseau', 'Your\nnetwork'], c: 0, r: 0, s: 'a', w: 82 },
        { id: 'b', t: ['Proxy', 'Proxy'], c: 1, r: 0, s: 'v', w: 82 },
        { id: 'c', t: 'Internet', c: 2, r: 0, f: 'cloud', s: 'info', w: 88, h: 48 },
        { id: 'd', t: ['Visiteurs', 'Visitors'], c: 0, r: 1, f: 'cloud', s: 'info', w: 88, h: 48 },
        { id: 'e', t: ['Proxy\ninverse', 'Reverse\nproxy'], c: 1, r: 1, s: 'v', w: 82 },
        { id: 'f', t: ['Vos\nserveurs', 'Your\nservers'], c: 2, r: 1, s: 'ok', w: 82 },
      ],
      e: [['a', 'b', '', 'a'], ['b', 'c', '', 'v'], ['d', 'e', '', 'info'], ['e', 'f', '', 'v']],
      g: [{ t: ['Proxy direct', 'Forward proxy'], ids: ['a', 'b', 'c'] }, { t: ['Proxy inverse', 'Reverse proxy'], ids: ['d', 'e', 'f'] }],
    },

    'reseau-cdn': {
      k: 'graphe',
      alt: ['Un CDN copie les fichiers sur des serveurs proches des visiteurs', 'A CDN copies files onto servers close to the visitors'],
      gy: 74,
      n: [
        { id: 'o', t: ['Serveur d’origine', 'Origin server'], c: 1, r: 0, f: 'db', s: 'v', w: 124, h: 52 },
        { id: 'p', t: ['CDN\nParis', 'CDN\nParis'], c: 0, r: 1, s: 'a', w: 84 },
        { id: 't', t: ['CDN\nTokyo', 'CDN\nTokyo'], c: 2, r: 1, s: 'a', w: 84 },
        { id: 'v', t: ['Visiteur\nen France', 'Visitor\nin France'], c: 0, r: 2, s: 'ok', w: 92 },
        { id: 'w', t: ['Visiteur\nau Japon', 'Visitor\nin Japan'], c: 2, r: 2, s: 'ok', w: 92 },
      ],
      e: [['o', 'p', ['copie', 'copy'], 'v dash'], ['o', 't', ['copie', 'copy'], 'v dash'], ['p', 'v', '', 'a'], ['t', 'w', '', 'a']],
    },

    'reseau-cache': {
      k: 'sequence',
      lh: 54,
      alt: ['Le cache HTTP : premier téléchargement avec ETag, puis revalidation en 304', 'HTTP cache: first download with an ETag, then revalidation with a 304'],
      a: [['Navigateur', 'Browser'], ['Serveur', 'Server']],
      s: ['a', 'v'],
      m: [
        [0, 1, 'GET /app.js'],
        [1, 0, '200 OK · ETag: "abc"', 'ok dash'],
        [0, 0, ['garde une copie', 'keeps a copy'], 'mute'],
        [0, 1, 'GET /app.js · If-None-Match: "abc"'],
        [1, 0, ['304 Not Modified (sans corps)', '304 Not Modified (no body)'], 'a dash'],
      ],
    },

    'reseau-osi': {
      k: 'pile',
      lh: 30,
      entre: 30,
      alt: ['Les sept couches du modèle OSI face aux quatre couches de TCP/IP', 'The seven layers of the OSI model next to the four layers of TCP/IP'],
      piles: [
        {
          t: 'OSI',
          layers: [
            { t: ['7 Application', '7 Application'], s: 'a' },
            { t: ['6 Présentation', '6 Presentation'], s: 'a' },
            { t: ['5 Session', '5 Session'], s: 'a' },
            { t: ['4 Transport', '4 Transport'], s: 'v' },
            { t: ['3 Réseau', '3 Network'], s: 'ok' },
            { t: ['2 Liaison', '2 Data link'], s: 'warn' },
            { t: ['1 Physique', '1 Physical'], s: 'warn' },
          ],
        },
        {
          t: 'TCP/IP',
          layers: [
            { t: ['Application', 'Application'], d: 'HTTP · DNS', s: 'a', h: 94 },
            { t: ['Transport', 'Transport'], d: 'TCP · UDP', s: 'v', h: 30 },
            { t: 'Internet', d: 'IP', s: 'ok', h: 30 },
            { t: ['Accès réseau', 'Network access'], d: 'Ethernet · Wi-Fi', s: 'warn', h: 64 },
          ],
        },
      ],
    },

  });
})(window);
