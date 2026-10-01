'use strict';
/*
 * Schémas de la catégorie « Outils et construction ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'outils-npm': {
      k: 'graphe',
      alt: ['npm install lit package.json puis télécharge les dépendances dans node_modules', 'npm install reads package.json then downloads the dependencies into node_modules'],
      gy: 72,
      n: [
        { id: 'p', t: 'package.json', sub: ['ce qu’il faut', 'what is needed'], c: 0, r: 0.5, f: 'file', s: 'v', w: 106, h: 52, mono: true, sz: 10 },
        { id: 'n', t: 'npm install', c: 1, r: 0.5, s: 'a', w: 90, mono: true, sz: 10.5 },
        { id: 'm', t: 'node_modules/', sub: ['le code téléchargé', 'the downloaded code'], c: 2, r: 0, s: 'ok', w: 110, h: 50, mono: true, sz: 10 },
        { id: 'l', t: 'package-lock.json', sub: ['versions exactes', 'exact versions'], c: 2, r: 1, f: 'file', s: 'warn', w: 116, h: 50, mono: true, sz: 9.5 },
      ],
      e: [['p', 'n', '', 'v'], ['n', 'm', '', 'ok'], ['n', 'l', '', 'warn']],
    },

    'outils-build': {
      k: 'graphe',
      alt: ['Le build transforme les sources en fichiers prêts à publier', 'The build turns the sources into files ready to publish'],
      n: [
        { id: 's', t: 'src/', sub: ['vos sources', 'your sources'], c: 0, r: 0, s: 'a', w: 92, h: 50, mono: true },
        { id: 'b', t: ['Build', 'Build'], sub: ['assemble · minifie', 'bundles · minifies'], c: 1, r: 0, s: 'v', w: 100, h: 50 },
        { id: 'd', t: 'dist/', sub: ['prêt à publier', 'ready to publish'], c: 2, r: 0, s: 'ok', w: 96, h: 50, mono: true },
      ],
      e: [['s', 'b', '', 'a'], ['b', 'd', '', 'v']],
    },

    'outils-transpilation': {
      k: 'graphe',
      alt: ['Un transpileur traduit du code moderne vers un code que tous les navigateurs comprennent', 'A transpiler translates modern code into code every browser understands'],
      n: [
        { id: 'a', t: ['TypeScript\nJS moderne', 'TypeScript\nmodern JS'], c: 0, r: 0, s: 'a', w: 98 },
        { id: 'b', t: ['Transpileur', 'Transpiler'], sub: 'Babel · tsc', c: 1, r: 0, s: 'v', w: 100, h: 50, sz: 11 },
        { id: 'c', t: ['JavaScript\ncompatible', 'Compatible\nJavaScript'], c: 2, r: 0, s: 'ok', w: 98 },
      ],
      e: [['a', 'b', '', 'a'], ['b', 'c', '', 'v']],
    },

    'outils-source-map': {
      k: 'graphe',
      alt: ['La source map relie une erreur dans le code minifié à la ligne du code d’origine', 'The source map links an error in the minified code to the line in the original code'],
      gy: 84,
      n: [
        { id: 's', t: 'app.js', sub: ['ce que vous écrivez', 'what you write'], c: 0, r: 0, s: 'a', w: 118, h: 50, mono: true },
        { id: 'm', t: 'app.min.js', sub: ['erreur en 1:4812', 'error at 1:4812'], c: 1, r: 0, s: 'bad', w: 118, h: 50, mono: true },
        { id: 'c', t: 'app.min.js.map', sub: ['la carte', 'the map'], c: 1, r: 1, f: 'file', s: 'v', w: 128, h: 50, mono: true, sz: 10 },
        { id: 'r', t: ['app.js ligne 42', 'app.js line 42'], sub: ['ce que vous voyez', 'what you see'], c: 0, r: 1, s: 'ok', w: 118, h: 50, sz: 11 },
      ],
      e: [['s', 'm', ['build', 'build'], 'a'], ['m', 'c', ['produit', 'produces'], 'v dash'], ['c', 'r', ['retrouve', 'finds'], 'ok']],
    },

    'outils-ci-cd': {
      k: 'graphe',
      alt: ['La chaîne CI/CD : chaque push déclenche build, tests puis déploiement', 'The CI/CD chain: each push triggers build, tests then deployment'],
      gy: 84,
      n: [
        { id: 'p', t: 'push', c: 0, r: 0, s: 'a', w: 66, mono: true, sz: 11 },
        { id: 'b', t: 'build', c: 1, r: 0, s: 'info', w: 66, mono: true, sz: 11 },
        { id: 't', t: ['tests', 'tests'], c: 2, r: 0, s: 'warn', w: 66, mono: true, sz: 11 },
        { id: 'd', t: ['déploie', 'deploy'], c: 3, r: 0, s: 'ok', w: 70, mono: true, sz: 11 },
        { id: 'x', t: ['Échec : on prévient', 'Failure: you are told'], c: 2, r: 1, s: 'bad', w: 130, sz: 10.5 },
      ],
      e: [['p', 'b', '', 'a'], ['b', 't', '', 'info'], ['t', 'd', '✓', 'ok'], ['t', 'x', '✗', 'bad dash']],
    },

    'outils-docker': {
      k: 'pile',
      lh: 32,
      entre: 26,
      alt: ['Machine virtuelle : un système invité complet ; conteneur : le noyau de l’hôte est partagé', 'Virtual machine: a full guest system; container: the host’s kernel is shared'],
      piles: [
        {
          t: ['Machine virtuelle', 'Virtual machine'],
          layers: [
            { t: ['Application', 'App'], s: 'a', h: 30 },
            { t: ['Bibliothèques', 'Libraries'], s: 'a', h: 30 },
            { t: ['Système invité', 'Guest OS'], s: 'warn', h: 30 },
            { t: ['Hyperviseur', 'Hypervisor'], s: 'v', h: 30 },
            { t: ['Matériel', 'Hardware'], s: 'mute', h: 30 },
          ],
        },
        {
          t: 'Docker',
          layers: [
            { t: ['Application', 'App'], s: 'a', h: 38 },
            { t: ['Bibliothèques', 'Libraries'], s: 'a', h: 38 },
            { t: 'Docker', s: 'v', h: 38 },
            { t: ['Système hôte (noyau partagé)', 'Host OS (shared kernel)'], s: 'ok', h: 30 },
            { t: ['Matériel', 'Hardware'], s: 'mute', h: 30 },
          ],
        },
      ],
    },

    'outils-environnements': {
      k: 'graphe',
      alt: ['Le code passe du développement au staging puis à la production', 'Code moves from development to staging then to production'],
      n: [
        { id: 'd', t: ['Développement', 'Development'], sub: ['votre machine', 'your machine'], c: 0, r: 0, s: 'info', w: 98, h: 52, sz: 10.5 },
        { id: 's', t: 'Staging', sub: ['une copie pour valider', 'a copy to validate'], c: 1, r: 0, s: 'warn', w: 98, h: 52, sz: 10.5 },
        { id: 'p', t: 'Production', sub: ['vrais utilisateurs', 'real users'], c: 2, r: 0, s: 'ok', w: 98, h: 52, sz: 10.5 },
      ],
      e: [['d', 's', '', 'info'], ['s', 'p', '', 'warn']],
    },

    'outils-semver': {
      k: 'cases',
      alt: ['Un numéro de version MAJEUR.MINEUR.CORRECTIF', 'A MAJOR.MINOR.PATCH version number'],
      rows: [
        { cells: ['2', '.', '4', '.', '1'], s: ['bad', '', 'warn', '', 'ok'], cap: [['majeur', 'major'], '', ['mineur', 'minor'], '', ['correctif', 'patch']], w: 54, h: 44, sz: 24 },
        { sep: '' },
        { cells: [['casse la\ncompatibilité', 'breaks\ncompatibility'], ['ajoute,\nsans casser', 'adds,\nwithout breaking'], ['corrige,\nrien d’autre', 'fixes,\nnothing else']], s: ['bad', 'warn', 'ok'], w: 100, h: 44, sz: 10.5, mono: false },
      ],
    },

  });
})(window);
