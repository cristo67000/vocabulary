'use strict';
/*
 * Schémas de la catégorie « Tests et qualité ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'qualite-pyramide': {
      k: 'dessin',
      h: 170,
      alt: ['La pyramide des tests : beaucoup de tests unitaires, moins d’intégration, très peu de bout en bout', 'The test pyramid: many unit tests, fewer integration tests, very few end-to-end'],
      d: [
        ['poly', [180, 8, 218, 54, 142, 54], { s: 'bad', t: 'E2E', tx: 180, ty: 38, sz: 10.5 }],
        ['poly', [142, 60, 218, 60, 244, 106, 116, 106], { s: 'warn', t: ['Intégration', 'Integration'], tx: 180, ty: 84, sz: 10.5 }],
        ['poly', [114, 112, 246, 112, 276, 160, 84, 160], { s: 'ok', t: ['Unitaires', 'Unit'], tx: 180, ty: 137, sz: 11.5 }],
        ['text', 236, 34, ['peu, lents,\nchers', 'few, slow,\ncostly'], { a: 's', sz: 10, s: 'bad', b: true }],
        ['text', 288, 136, ['nombreux,\nrapides,\nbon marché', 'many,\nfast,\ncheap'], { a: 's', sz: 10, s: 'ok', b: true }],
      ],
    },

    'qualite-tdd': {
      k: 'graphe',
      alt: ['Le cycle du TDD : rouge, vert, refactoring', 'The TDD cycle: red, green, refactor'],
      gy: 84,
      n: [
        { id: 'r', t: ['Rouge', 'Red'], sub: ['un test qui échoue', 'a failing test'], c: 0, r: 0, s: 'bad', w: 108, h: 52 },
        { id: 'v', t: ['Vert', 'Green'], sub: ['on le fait passer', 'make it pass'], c: 2, r: 0, s: 'ok', w: 108, h: 52 },
        { id: 'f', t: 'Refactoring', sub: ['on améliore', 'improve'], c: 1, r: 1, s: 'a', w: 112, h: 52, sz: 11 },
      ],
      e: [['r', 'v', '', 'bad'], ['v', 'f', '', 'ok'], ['f', 'r', ['répéter', 'repeat'], 'a']],
    },

    'qualite-mock': {
      k: 'graphe',
      alt: ['En test, un mock remplace le vrai service que le code appelle en production', 'In a test, a mock replaces the real service the code calls in production'],
      gy: 76,
      n: [
        { id: 'c', t: ['Code testé', 'Code under test'], c: 0, r: 0.5, s: 'a', w: 100 },
        { id: 'v', t: ['Vrai service', 'Real service'], sub: ['lent, en réseau', 'slow, over the network'], c: 1, r: 0, f: 'cloud', s: 'mute', w: 112, h: 56, sz: 11 },
        { id: 'm', t: 'Mock', sub: ['réponses prévues', 'planned answers'], c: 1, r: 1, s: 'ok', w: 112, h: 50 },
      ],
      e: [['c', 'v', ['production', 'production'], 'mute dash'], ['c', 'm', 'test', 'ok']],
    },

  });
})(window);
