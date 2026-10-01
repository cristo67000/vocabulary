'use strict';
/*
 * Schémas de la catégorie « Bases de données ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'bdd-table': {
      k: 'dessin',
      h: 158,
      alt: ['Une table : des colonnes (les champs) et des lignes (les enregistrements)', 'A table: columns (fields) and rows (records)'],
      d: [
        ['text', 110, 12, ['colonne : un champ, un type', 'column: a field, a type'], { s: 'a', sz: 10, b: true }],
        ['rect', 10, 22, 50, 26, { s: 'warn', t: 'id', mono: true, sz: 11, r: 3 }],
        ['rect', 60, 22, 100, 26, { s: 'a', t: 'nom', mono: true, sz: 11, r: 3 }],
        ['rect', 160, 22, 130, 26, { s: 'a', t: ['catégorie', 'category'], mono: true, sz: 11, r: 3 }],
        ['rect', 10, 48, 50, 26, { s: 'mute', t: '1', mono: true, sz: 11, r: 3 }],
        ['rect', 60, 48, 100, 26, { s: 'mute', t: 'amend', mono: true, sz: 11, r: 3 }],
        ['rect', 160, 48, 130, 26, { s: 'mute', t: 'git', mono: true, sz: 11, r: 3 }],
        ['rect', 10, 74, 50, 26, { s: 'mute', t: '2', mono: true, sz: 11, r: 3 }],
        ['rect', 60, 74, 100, 26, { s: 'mute', t: 'hash', mono: true, sz: 11, r: 3 }],
        ['rect', 160, 74, 130, 26, { s: 'mute', t: 'secu', mono: true, sz: 11, r: 3 }],
        ['rect', 10, 100, 50, 26, { s: 'mute', t: '3', mono: true, sz: 11, r: 3 }],
        ['rect', 60, 100, 100, 26, { s: 'mute', t: 'dom', mono: true, sz: 11, r: 3 }],
        ['rect', 160, 100, 130, 26, { s: 'mute', t: 'web', mono: true, sz: 11, r: 3 }],
        ['text', 296, 91, ['← ligne', '← row'], { a: 's', sz: 10, s: 'mute', b: true }],
        ['text', 35, 142, ['clé primaire', 'primary key'], { s: 'warn', sz: 10, b: true }],
      ],
    },

    'bdd-jointure': {
      k: 'dessin',
      h: 156,
      alt: ['Une jointure : la colonne terme_id de la table notes désigne l’id d’une ligne de la table termes', 'A join: the terme_id column of the notes table designates the id of a row in the termes table'],
      d: [
        ['text', 70, 12, 'termes', { mono: true, sz: 11, b: true, s: 'a' }],
        ['text', 280, 12, 'notes', { mono: true, sz: 11, b: true, s: 'v' }],
        ['rect', 10, 20, 40, 22, { s: 'warn', t: 'id', mono: true, sz: 10, r: 2 }],
        ['rect', 50, 20, 86, 22, { s: 'a', t: 'nom', mono: true, sz: 10, r: 2 }],
        ['rect', 10, 44, 40, 24, { s: 'mute', t: '1', mono: true, sz: 10.5, r: 2 }],
        ['rect', 50, 44, 86, 24, { s: 'mute', t: 'git', mono: true, sz: 10.5, r: 2 }],
        ['rect', 10, 68, 40, 24, { s: 'mute', t: '2', mono: true, sz: 10.5, r: 2 }],
        ['rect', 50, 68, 86, 24, { s: 'mute', t: 'shell', mono: true, sz: 10.5, r: 2 }],
        ['rect', 10, 92, 40, 24, { s: 'mute', t: '3', mono: true, sz: 10.5, r: 2 }],
        ['rect', 50, 92, 86, 24, { s: 'mute', t: 'web', mono: true, sz: 10.5, r: 2 }],
        ['rect', 210, 20, 64, 22, { s: 'warn', t: 'terme_id', mono: true, sz: 9, r: 2 }],
        ['rect', 274, 20, 76, 22, { s: 'v', t: 'texte', mono: true, sz: 10, r: 2 }],
        ['rect', 210, 44, 64, 24, { s: 'mute', t: '1', mono: true, sz: 10.5, r: 2 }],
        ['rect', 274, 44, 76, 24, { s: 'mute', t: 'amend', mono: true, sz: 9.5, r: 2 }],
        ['rect', 210, 68, 64, 24, { s: 'mute', t: '1', mono: true, sz: 10.5, r: 2 }],
        ['rect', 274, 68, 76, 24, { s: 'mute', t: 'stash', mono: true, sz: 9.5, r: 2 }],
        ['rect', 210, 92, 64, 24, { s: 'mute', t: '3', mono: true, sz: 10.5, r: 2 }],
        ['rect', 274, 92, 76, 24, { s: 'mute', t: 'dom', mono: true, sz: 9.5, r: 2 }],
        ['line', 206, 56, 140, 56, { s: 'warn', dash: 1, arrow: 1 }],
        ['line', 206, 80, 140, 58, { s: 'warn', dash: 1, arrow: 1 }],
        ['line', 206, 104, 140, 104, { s: 'warn', dash: 1, arrow: 1 }],
        ['text', 180, 142, ['clé étrangère terme_id → id', 'foreign key terme_id → id'], { s: 'warn', sz: 10.5, b: true }],
      ],
    },

    'bdd-index': {
      k: 'arbre',
      alt: ['Un index oriente vers la bonne ligne sans lire toute la table', 'An index points to the right row without reading the whole table'],
      racine: {
        t: ['index\nsur nom', 'index\non name'], s: 'warn', k: [
          { t: 'A–F', s: 'v', k: [{ t: ['ligne\n8', 'row\n8'], s: 'ok' }] },
          { t: 'G–M', s: 'v', k: [{ t: ['ligne\n3', 'row\n3'], s: 'ok' }] },
          { t: 'N–Z', s: 'v', k: [{ t: ['ligne\n21', 'row\n21'], s: 'ok' }] },
        ],
      },
      l: ['Comme l’index d’un livre : on saute à la bonne page au lieu de tout lire.', 'Like a book’s index: you jump to the right page instead of reading everything.'],
    },

    'bdd-transaction': {
      k: 'sequence',
      lh: 40,
      alt: ['Une transaction : tout est validé ensemble par COMMIT, ou annulé par ROLLBACK', 'A transaction: everything is committed together by COMMIT, or cancelled by ROLLBACK'],
      a: [['Application', 'Application'], ['Base de données', 'Database']],
      s: ['a', 'v'],
      m: [
        [0, 1, 'BEGIN'],
        [0, 1, ['compte 1 : − 100', 'account 1: − 100']],
        [0, 1, ['compte 2 : + 100', 'account 2: + 100']],
        [0, 1, 'COMMIT', 'ok'],
        ['note', 0, 1, ['Si une étape échoue : ROLLBACK — rien n’est modifié.', 'If a step fails: ROLLBACK — nothing is changed.']],
      ],
    },

    'bdd-migration': {
      k: 'cases',
      alt: ['Des migrations numérotées, appliquées dans l’ordre', 'Numbered migrations, applied in order'],
      rows: [
        { cells: [['001\ncréer termes', '001\ncreate terms'], ['002\najouter alias', '002\nadd alias'], ['003\nindex sur nom', '003\nindex on name']], s: ['ok', 'ok', 'warn'], cap: [['appliquée', 'applied'], ['appliquée', 'applied'], ['à appliquer', 'to apply']], w: 104, h: 46, sz: 11, mono: false },
      ],
    },

    'bdd-crud': {
      k: 'graphe',
      alt: ['CRUD : créer, lire, modifier, supprimer des données', 'CRUD: create, read, update, delete data'],
      gy: 62,
      n: [
        { id: 'd', t: ['Données', 'Data'], c: 1, r: 1, f: 'db', s: 'v', w: 96, h: 54 },
        { id: 'c', t: 'Create', sub: 'INSERT · POST', c: 1, r: 0, s: 'ok', w: 104, h: 44, sz: 11 },
        { id: 'r', t: 'Read', sub: 'SELECT · GET', c: 2, r: 1, s: 'a', w: 100, h: 44, sz: 11 },
        { id: 'u', t: 'Update', sub: 'UPDATE · PATCH', c: 1, r: 2, s: 'warn', w: 104, h: 44, sz: 11 },
        { id: 'x', t: 'Delete', sub: 'DELETE', c: 0, r: 1, s: 'bad', w: 92, h: 44, sz: 11 },
      ],
      e: [['c', 'd', '', 'ok'], ['d', 'r', '', 'a'], ['u', 'd', '', 'warn'], ['x', 'd', '', 'bad']],
    },

  });
})(window);
