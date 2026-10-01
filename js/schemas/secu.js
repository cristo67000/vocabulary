'use strict';
/*
 * Schémas de la catégorie « Sécurité et cryptographie ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'secu-hash': {
      k: 'graphe',
      alt: ['Une fonction de hachage : un texte donne toujours la même empreinte, une majuscule la change entièrement', 'A hash function: a text always gives the same fingerprint, one capital letter changes it entirely'],
      gy: 66,
      n: [
        { id: 'a', t: '"Bonjour"', c: 0, r: 0, s: 'a', w: 92, mono: true, sz: 11 },
        { id: 'b', t: '"bonjour"', c: 0, r: 1, s: 'a', w: 92, mono: true, sz: 11 },
        { id: 'f', t: ['Fonction\nSHA-256', 'Function\nSHA-256'], c: 1, r: 0.5, s: 'v', w: 92, h: 50 },
        { id: 'x', t: '9172e8ee…', sub: ['64 chiffres hex', '64 hex digits'], c: 2, r: 0, s: 'ok', w: 104, h: 48, mono: true, sz: 11 },
        { id: 'y', t: '2cb4b143…', sub: ['64 chiffres hex', '64 hex digits'], c: 2, r: 1, s: 'warn', w: 104, h: 48, mono: true, sz: 11 },
      ],
      e: [['a', 'f', '', 'a'], ['b', 'f', '', 'a'], ['f', 'x', '', 'ok'], ['f', 'y', '', 'warn']],
      l: ['Une seule lettre change, l’empreinte est totalement différente. Impossible de remonter au texte.', 'One letter changes, the fingerprint is completely different. There is no way back to the text.'],
    },

    'secu-chiffrement': {
      k: 'graphe',
      alt: ['Le chiffrement transforme un texte lisible en texte illisible avec une clé, et inversement', 'Encryption turns readable text into unreadable text with a key, and back'],
      haut: 30,
      bas: 26,
      n: [
        { id: 'c', t: ['Texte\nclair', 'Plain\ntext'], c: 0, r: 0, s: 'a', w: 100 },
        { id: 'h', t: ['Texte\nchiffré', 'Encrypted\ntext'], c: 1, r: 0, s: 'warn', w: 100 },
      ],
      e: [['c', 'h', ['chiffrer\n(clé)', 'encrypt\n(key)'], 'a'], ['h', 'c', ['déchiffrer\n(clé)', 'decrypt\n(key)'], 'ok dash']],
      l: ['Contrairement à un hash, le chemin de retour existe — pour qui a la clé.', 'Unlike a hash, the way back exists — for whoever holds the key.'],
    },

    'secu-asymetrique': {
      k: 'graphe',
      alt: ['Chiffrer avec la clé publique de Bob : lui seul peut déchiffrer avec sa clé privée', 'Encrypt with Bob’s public key: only he can decrypt with his private key'],
      gy: 76,
      n: [
        { id: 'k', t: ['Clé publique de Bob', 'Bob’s public key'], sub: ['connue de tous', 'known to everyone'], c: 1, r: 0, s: 'info', w: 138, h: 48 },
        { id: 'a', t: 'Alice', c: 0, r: 1, s: 'a', w: 78 },
        { id: 'm', t: ['Message\nchiffré', 'Encrypted\nmessage'], c: 1, r: 1, f: 'file', s: 'warn', w: 92 },
        { id: 'b', t: 'Bob', sub: ['sa clé privée', 'his private key'], c: 2, r: 1, s: 'ok', w: 96, h: 50 },
      ],
      e: [['k', 'a', ['sert à chiffrer', 'used to encrypt'], 'info dash'], ['a', 'm', '', 'a'], ['m', 'b', ['déchiffre', 'decrypts'], 'ok']],
    },

    'secu-signature': {
      k: 'sequence',
      lh: 46,
      alt: ['Signer avec la clé privée, vérifier avec la clé publique', 'Sign with the private key, verify with the public key'],
      a: [['Auteur', 'Author'], ['Destinataire', 'Recipient']],
      s: ['a', 'v'],
      m: [
        [0, 0, ['calcule le hash du document', 'hashes the document'], 'mute'],
        [0, 0, ['le signe avec sa clé privée', 'signs it with the private key'], 'a'],
        [0, 1, ['document + signature', 'document + signature']],
        [1, 1, ['recalcule le hash, vérifie avec la clé publique', 'rehashes, verifies with the public key'], 'ok'],
      ],
    },

    'secu-certificat': {
      k: 'arbre',
      alt: ['La chaîne de confiance : autorité racine, autorité intermédiaire, certificat du site', 'The chain of trust: root authority, intermediate authority, site certificate'],
      racine: {
        t: ['Autorité\nracine', 'Root\nauthority'], s: 'a', k: [{
          t: ['Autorité\nintermédiaire', 'Intermediate\nauthority'], s: 'v', k: [{ t: 'exemple.org', s: 'ok' }, { t: 'autre.fr', s: 'ok' }],
        }],
      },
      l: ['Le navigateur connaît la racine ; chaque maillon signe le suivant.', 'The browser knows the root; each link signs the next one.'],
    },

    'secu-token': {
      k: 'sequence',
      lh: 44,
      alt: ['Après la connexion, le serveur remet un jeton que le client présente à chaque requête', 'After login, the server hands out a token that the client presents with each request'],
      a: [['Client', 'Client'], ['Serveur', 'Server']],
      s: ['a', 'v'],
      m: [
        [0, 1, ['identifiant + mot de passe', 'username + password']],
        [1, 0, ['jeton (token)', 'token'], 'ok dash'],
        [0, 1, ['requête + jeton dans l’en-tête', 'request + token in the header'], 'a'],
        [1, 1, ['vérifie le jeton', 'checks the token'], 'mute'],
        [1, 0, ['données', 'data'], 'dash'],
      ],
    },

    'secu-jwt': {
      k: 'dessin',
      h: 124,
      alt: ['Un JWT : en-tête, charge utile et signature, séparés par des points', 'A JWT: header, payload and signature, separated by dots'],
      d: [
        ['rect', 6, 10, 108, 28, { s: 'a', t: 'eyJhbGciOi…', mono: true, sz: 10.5, r: 4 }],
        ['text', 120, 30, '.', { sz: 16, b: true }],
        ['rect', 126, 10, 108, 28, { s: 'v', t: 'eyJzdWIiOi…', mono: true, sz: 10.5, r: 4 }],
        ['text', 240, 30, '.', { sz: 16, b: true }],
        ['rect', 246, 10, 108, 28, { s: 'ok', t: 'SflKxwRJSM…', mono: true, sz: 10.5, r: 4 }],
        ['line', 60, 40, 60, 56, { s: 'a', arrow: 1 }],
        ['line', 180, 40, 180, 56, { s: 'v', arrow: 1 }],
        ['line', 300, 40, 300, 56, { s: 'ok', arrow: 1 }],
        ['text', 60, 70, ['en-tête', 'header'], { s: 'a', sz: 11, b: true }],
        ['text', 60, 86, '{"alg":"HS256"}', { mono: true, sz: 9, s: 'mute' }],
        ['text', 180, 70, ['charge utile', 'payload'], { s: 'v', sz: 11, b: true }],
        ['text', 180, 86, '{"sub":"42"}', { mono: true, sz: 9, s: 'mute' }],
        ['text', 300, 70, ['signature', 'signature'], { s: 'ok', sz: 11, b: true }],
        ['text', 300, 86, ['garantit l’intégrité', 'guarantees integrity'], { sz: 9, s: 'mute' }],
        ['text', 180, 114, ['Base64 → lisible par tous · signé, pas chiffré', 'Base64 → readable by all · signed, not encrypted'], { sz: 10.5, s: 'warn', b: true }],
      ],
    },

    'secu-oauth': {
      k: 'sequence',
      lh: 52,
      alt: ['OAuth : l’application obtient un jeton du service sans jamais connaître votre mot de passe', 'OAuth: the app gets a token from the service without ever knowing your password'],
      a: [['Vous', 'You'], ['Application', 'App'], ['Service\n(GitHub…)', 'Service\n(GitHub…)']],
      s: ['a', 'v', 'ok'],
      m: [
        [0, 1, ['« Se connecter avec… »', '“Sign in with…”']],
        [1, 2, ['redirige vers le service', 'redirects to the service'], 'mute'],
        [0, 2, ['vous vous connectez et acceptez', 'you log in and accept'], 'ok'],
        [2, 1, ['code d’autorisation', 'authorization code'], 'dash'],
        [1, 2, ['code contre jeton', 'code for token'], 'a'],
        [2, 1, ['jeton d’accès', 'access token'], 'ok dash'],
      ],
    },

    'secu-2fa': {
      k: 'graphe',
      alt: ['Deux preuves de nature différente pour se connecter', 'Two proofs of different kinds to log in'],
      gy: 84,
      n: [
        { id: 'a', t: ['Ce que vous\nsavez', 'What you\nknow'], sub: ['mot de passe', 'password'], c: 0, r: 0, s: 'a', w: 96, h: 56 },
        { id: 'b', t: ['Ce que vous\navez', 'What you\nhave'], sub: ['téléphone, clé', 'phone, key'], c: 1, r: 0, s: 'v', w: 96, h: 56 },
        { id: 'c', t: ['Ce que vous\nêtes', 'What you\nare'], sub: ['empreinte', 'fingerprint'], c: 2, r: 0, s: 'mute', w: 96, h: 56 },
        { id: 'o', t: ['Accès accordé', 'Access granted'], c: 0.5, r: 1, s: 'ok', w: 130 },
      ],
      e: [['a', 'o', '+', 'a'], ['b', 'o', '', 'v']],
      l: ['Deux facteurs de familles différentes : un mot de passe volé ne suffit plus.', 'Two factors from different families: a stolen password is no longer enough.'],
    },

    'secu-session': {
      k: 'sequence',
      lh: 44,
      alt: ['La session : le serveur remet un identifiant en cookie et le retrouve à chaque requête', 'The session: the server hands out an identifier as a cookie and finds it again on each request'],
      a: [['Navigateur', 'Browser'], ['Serveur', 'Server']],
      s: ['a', 'v'],
      m: [
        [0, 1, 'POST /connexion'],
        [1, 0, 'Set-Cookie: session=abc123', 'ok dash'],
        [0, 1, 'GET /profil · Cookie: session=abc123', 'a'],
        [1, 0, ['200 (votre profil)', '200 (your profile)'], 'dash'],
      ],
    },

    'secu-xss': {
      k: 'sequence',
      lh: 46,
      alt: ['XSS : le script d’un attaquant s’exécute dans la page d’une victime', 'XSS: an attacker’s script runs in a victim’s page'],
      a: [['Attaquant', 'Attacker'], ['Site', 'Site'], ['Victime', 'Victim']],
      s: ['bad', 'n', 'a'],
      m: [
        [0, 1, ['commentaire piégé <script>', 'booby-trapped comment <script>'], 'bad'],
        [2, 1, ['ouvre la page', 'opens the page']],
        [1, 2, ['page + script piégé', 'page + trapped script'], 'bad dash'],
        [2, 2, ['exécute le script', 'runs the script'], 'bad'],
        [2, 0, ['jeton volé', 'stolen token'], 'bad'],
      ],
    },

    'secu-csrf': {
      k: 'sequence',
      lh: 48,
      alt: ['CSRF : une page piégée fait envoyer à votre navigateur une requête vers un site où vous êtes connecté', 'CSRF: a trapped page makes your browser send a request to a site where you are logged in'],
      a: [['Vous', 'You'], ['Banque', 'Bank'], ['Site\npiégé', 'Trapped\nsite']],
      s: ['a', 'ok', 'bad'],
      m: [
        [0, 1, ['vous êtes connecté (cookie)', 'you are logged in (cookie)'], 'ok'],
        [0, 2, ['vous visitez une page piégée', 'you visit a trapped page']],
        [2, 0, ['formulaire caché', 'hidden form'], 'bad dash'],
        [0, 1, ['virement + cookie ajouté seul', 'transfer + cookie added automatically'], 'bad'],
      ],
    },

    'secu-injection': {
      k: 'dessin',
      h: 214,
      alt: ['Une injection SQL par concaténation, et la parade par requête paramétrée', 'An SQL injection by concatenation, and the defense with a parameterized query'],
      d: [
        ['text', 8, 12, ['Concaténation (dangereux)', 'Concatenation (dangerous)'], { a: 's', s: 'bad', sz: 11, b: true }],
        ['rect', 8, 22, 344, 26, { s: 'bad', t: "SELECT * FROM users WHERE nom = '' OR '1'='1'", mono: true, sz: 9.2, r: 4 }],
        ['text', 8, 66, ['La saisie « \' OR \'1\'=\'1 » est devenue du SQL : toute la table est renvoyée.', 'The input “\' OR \'1\'=\'1” has turned into SQL: the whole table is returned.'], { a: 's', sz: 10, s: 'mute', max: 340 }],
        ['line', 8, 104, 352, 104, { s: 'g', dash: 1 }],
        ['text', 8, 122, ['Requête paramétrée (sûr)', 'Parameterized query (safe)'], { a: 's', s: 'ok', sz: 11, b: true }],
        ['rect', 8, 132, 190, 26, { s: 'ok', t: 'WHERE nom = ?', mono: true, sz: 11, r: 4 }],
        ['text', 208, 149, '+', { sz: 15, b: true }],
        ['rect', 222, 132, 130, 26, { s: 'warn', t: "' OR '1'='1", mono: true, sz: 10, r: 4 }],
        ['text', 8, 184, ['La saisie reste une simple valeur : aucun utilisateur ne porte ce nom.', 'The input stays a mere value: no user has that name.'], { a: 's', sz: 10, s: 'mute', max: 340 }],
      ],
    },

    'secu-sandbox': {
      k: 'graphe',
      alt: ['Dans une sandbox, l’application n’accède qu’à ce qu’on lui a explicitement autorisé', 'In a sandbox, the app only reaches what it was explicitly granted'],
      gy: 60,
      n: [
        { id: 'a', t: ['Application', 'App'], c: 0, r: 1, s: 'a', w: 100 },
        { id: 'f', t: ['Vos fichiers', 'Your files'], c: 1, r: 0, s: 'bad', w: 130 },
        { id: 'c', t: ['La caméra', 'The camera'], c: 1, r: 1, s: 'bad', w: 130 },
        { id: 'i', t: ['Internet', 'Internet'], c: 1, r: 2, s: 'ok', w: 130 },
      ],
      e: [['a', 'f', '✗', 'bad dash'], ['a', 'c', '✗', 'bad dash'], ['a', 'i', ['permission', 'permission'], 'ok']],
      g: [{ t: 'Sandbox', ids: ['a'] }],
    },

    'langage-tokens': {
      k: 'cases',
      alt: ['La ligne « let prix = 42; » découpée en cinq tokens', 'The line “let prix = 42;” cut into five tokens'],
      rows: [
        { t: 'let prix = 42;', cells: ['let', 'prix', '=', '42', ';'], s: ['v', 'a', 'warn', 'ok', 'mute'], cap: [['mot-clé', 'keyword'], ['nom', 'name'], ['opérateur', 'operator'], ['nombre', 'number'], ['ponctuation', 'punctuation']], w: 64, sz: 13 },
      ],
    },

    'ia-token': {
      k: 'cases',
      alt: ['Un texte découpé en tokens : des fragments de mots, chacun avec un numéro', 'A text cut into tokens: word fragments, each with a number'],
      rows: [
        { t: ['« Tokens are pieces of words »', '“Tokens are pieces of words”'], cells: ['Tok', 'ens', '␣are', '␣pieces', '␣of', '␣words'], s: ['a', 'a', 'v', 'v', 'v', 'v'], cap: ['12', '9021', '527', '9863', '315', '4476'], w: 56, sz: 11 },
      ],
      l: ['Illustration : le découpage réel dépend du modèle. ␣ marque une espace.', 'Illustration: the actual split depends on the model. ␣ marks a space.'],
    },

  });
})(window);
