'use strict';
/*
 * Schémas de la catégorie « Terminal et shell » (et du saut de ligne, qui en
 * est voisin). Voir js/schema.js pour le vocabulaire des figures.
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'shell-terminal': {
      k: 'pile',
      alt: ['Les étages traversés par une commande tapée dans un terminal', 'The layers a command typed in a terminal goes through'],
      piles: [{
        t: ['Ce qui se passe quand vous tapez une commande ↓', 'What happens when you type a command ↓'],
        layers: [
          { t: ['Vous', 'You'], d: ['tapez « git status »', 'type “git status”'], s: 'a' },
          { t: ['Terminal', 'Terminal'], d: ['la fenêtre : affiche et transmet le texte', 'the window: displays and forwards the text'], s: 'info' },
          { t: ['Shell', 'Shell'], d: ['Bash, Zsh, PowerShell : comprend la commande', 'Bash, Zsh, PowerShell: understands the command'], s: 'v' },
          { t: ['Programme', 'Program'], d: ['git, npm, ls : fait le travail', 'git, npm, ls: does the work'], s: 'ok' },
          { t: ['Système d’exploitation', 'Operating system'], d: ['fichiers, réseau, mémoire', 'files, network, memory'], s: 'mute' },
        ],
      }],
    },

    'shell-commande': {
      k: 'dessin',
      h: 104,
      alt: ['Anatomie d’une commande : programme, sous-commande, option, valeur', 'Anatomy of a command: program, subcommand, option, value'],
      d: [
        ['rect', 8, 10, 56, 30, { s: 'a', t: 'git', mono: true, sz: 13 }],
        ['rect', 72, 10, 82, 30, { s: 'v', t: 'commit', mono: true, sz: 13 }],
        ['rect', 162, 10, 44, 30, { s: 'warn', t: '-m', mono: true, sz: 13 }],
        ['rect', 214, 10, 138, 30, { s: 'ok', t: '"Correction"', mono: true, sz: 13 }],
        ['text', 36, 60, ['programme', 'program'], { s: 'a', sz: 10.5, b: true }],
        ['text', 113, 60, ['sous-commande', 'subcommand'], { s: 'v', sz: 10.5, b: true }],
        ['text', 184, 78, ['option', 'option'], { s: 'warn', sz: 10.5, b: true }],
        ['text', 283, 60, ['valeur de l’option', 'the option’s value'], { s: 'ok', sz: 10.5, b: true }],
        ['line', 36, 42, 36, 50, { s: 'a' }],
        ['line', 113, 42, 113, 50, { s: 'v' }],
        ['line', 184, 42, 184, 68, { s: 'warn' }],
        ['line', 283, 42, 283, 50, { s: 'ok' }],
      ],
    },

    'shell-flux': {
      k: 'graphe',
      alt: ['Les trois flux d’un programme : entrée, sortie et erreurs', 'A program’s three streams: input, output and errors'],
      gy: 62,
      n: [
        { id: 'i', t: 'stdin (0)', sub: ['clavier\nou fichier', 'keyboard\nor file'], c: 0, r: 0.5, s: 'a', w: 96, h: 58, mono: true, sz: 10.5 },
        { id: 'p', t: ['Programme', 'Program'], c: 1, r: 0.5, s: 'v', w: 78, sz: 11 },
        { id: 'o', t: 'stdout (1)', sub: ['écran\nou fichier', 'screen\nor file'], c: 2, r: 0, s: 'ok', w: 96, h: 58, mono: true, sz: 10.5 },
        { id: 'e', t: 'stderr (2)', sub: ['écran\nou fichier', 'screen\nor file'], c: 2, r: 1, s: 'bad', w: 96, h: 58, mono: true, sz: 10.5 },
      ],
      e: [['i', 'p', '<', 'a'], ['p', 'o', '>', 'ok'], ['p', 'e', '2>', 'bad']],
      l: ['Les chevrons redirigent chaque flux vers un fichier : « < » lit, « > » écrit, « 2> » écrit les erreurs.', 'The chevrons redirect each stream to a file: “<” reads, “>” writes, “2>” writes the errors.'],
    },

    'shell-pipe': {
      k: 'graphe',
      alt: ['Un tube relie la sortie d’une commande à l’entrée de la suivante', 'A pipe connects one command’s output to the next command’s input'],
      gy: 70,
      n: [
        { id: 'a', t: 'cat\njournal.txt', c: 0, r: 0, s: 'a', mono: true, w: 82, sz: 10.5 },
        { id: 'b', t: 'grep\nERREUR', c: 1, r: 0, s: 'v', mono: true, w: 82, sz: 10.5 },
        { id: 'c', t: 'sort', c: 2, r: 0, s: 'ok', mono: true, w: 82, sz: 10.5 },
      ],
      e: [['a', 'b', '|', 'a'], ['b', 'c', '|', 'v']],
      l: ['Chaque commande lit le texte produit par la précédente : lire, filtrer, trier.', 'Each command reads the text produced by the previous one: read, filter, sort.'],
    },

    'shell-env': {
      k: 'graphe',
      alt: ['Une variable d’environnement est héritée par les programmes lancés', 'An environment variable is inherited by the programs launched'],
      gy: 70,
      n: [
        { id: 's', t: 'Shell', sub: 'API_URL=https://…', c: 0, r: 0, s: 'a', w: 118, h: 50 },
        { id: 'p', t: ['Programme lancé', 'Launched program'], sub: 'API_URL=https://…', c: 1, r: 0, s: 'ok', w: 118, h: 50 },
        { id: 'q', t: ['Autre shell', 'Another shell'], sub: 'API_URL absente', c: 0, r: 1, s: 'mute', w: 118, h: 50 },
      ],
      e: [['s', 'p', ['copie', 'copy'], 'ok'], ['s', 'q', ['ne se propage pas', 'does not propagate'], 'mute dash']],
    },

    'shell-path': {
      k: 'pile',
      alt: ['Le shell cherche un programme dans les dossiers de PATH, dans l’ordre', 'The shell looks for a program in the PATH folders, in order'],
      piles: [{
        t: ['Vous tapez « git » : le shell parcourt PATH', 'You type “git”: the shell walks through PATH'],
        layers: [
          { t: '/usr/local/bin', d: ['git absent → on continue', 'no git here → keep going'], s: 'mute', mono: true },
          { t: '/usr/bin', d: ['git trouvé → il est exécuté', 'git found → it is run'], s: 'ok', mono: true },
          { t: '/bin', d: ['jamais consulté', 'never looked at'], s: 'mute', mono: true },
        ],
      }],
    },

    'shell-chemins': {
      k: 'arbre',
      mode: 'liste',
      alt: ['Un chemin absolu part de la racine ; un chemin relatif part du dossier courant', 'An absolute path starts at the root; a relative path starts at the current folder'],
      racine: {
        t: '/', d: true, c: ['racine', 'root'], k: [{
          t: 'home/', d: true, k: [{
            t: 'moi/', d: true, c: ['~ = dossier personnel', '~ = home folder'], k: [
              {
                t: 'projets/', d: true, k: [
                  { t: 'app/', d: true, c: ['. = dossier courant', '. = current folder'], k: [{ t: 'notes.txt', c: ['./notes.txt', './notes.txt'], cs: 'ok' }] },
                  { t: 'blog/', d: true, c: ['../blog', '../blog'] },
                ],
              },
            ],
          }],
        }],
      },
    },

    'shell-chmod': {
      k: 'cases',
      alt: ['Les droits d’un fichier : propriétaire, groupe, autres, chacun r, w, x', 'A file’s permissions: owner, group, others, each r, w, x'],
      l: ['754 : le propriétaire fait tout (4+2+1), le groupe lit et exécute (4+1), les autres lisent (4).', '754: the owner can do everything (4+2+1), the group reads and runs (4+1), others read (4).'],
      rows: [
        { t: 'chmod 754 script.sh', cells: ['rwx', 'r-x', 'r--'], s: ['ok', 'a', 'warn'], cap: [['propriétaire', 'owner'], ['groupe', 'group'], ['autres', 'others']], w: 96, sz: 15 },
        { sep: '' },
        { cells: ['7', '5', '4'], s: ['ok', 'a', 'warn'], cap: ['4 + 2 + 1', '4 + 0 + 1', '4 + 0 + 0'], w: 96, sz: 17 },
      ],
    },

    'shell-slash': {
      k: 'dessin',
      h: 146,
      alt: ['Slash, antislash et commande slash', 'Slash, backslash and slash command'],
      d: [
        ['circ', 30, 30, 18, { s: 'a', t: '/', mono: true, sz: 20 }],
        ['text', 62, 26, ['slash', 'slash'], { a: 's', b: true, sz: 12.5 }],
        ['text', 62, 42, ['chemins Unix · URL · Git', 'Unix paths · URLs · Git'], { a: 's', s: 'mute', sz: 10.5 }],
        ['circ', 30, 78, 18, { s: 'warn', t: '\\', mono: true, sz: 20 }],
        ['text', 62, 74, ['antislash (backslash)', 'backslash'], { a: 's', b: true, sz: 12.5 }],
        ['text', 62, 90, ['chemins Windows · échappement', 'Windows paths · escaping'], { a: 's', s: 'mute', sz: 10.5 }],
        ['circ', 30, 126, 18, { s: 'v', t: '/x', mono: true, sz: 12 }],
        ['text', 62, 122, ['commande slash', 'slash command'], { a: 's', b: true, sz: 12.5 }],
        ['text', 62, 138, ['/help · /clear dans un outil ou une conversation', '/help · /clear in a tool or a chat'], { a: 's', s: 'mute', sz: 10.5 }],
      ],
    },

    'data-saut-de-ligne': {
      k: 'cases',
      alt: ['Deux façons de marquer une fin de ligne : LF (Unix) et CRLF (Windows)', 'Two ways to mark an end of line: LF (Unix) and CRLF (Windows)'],
      rows: [
        { t: ['Unix, macOS : LF', 'Unix, macOS: LF'], cells: ['H', 'i', 'LF', '!'], s: ['', '', 'a', ''], cap: ['48', '69', '0A', '21'], w: 54 },
        { t: ['Windows : CRLF', 'Windows: CRLF'], cells: ['H', 'i', 'CR', 'LF', '!'], s: ['', '', 'warn', 'a', ''], cap: ['48', '69', '0D', '0A', '21'], w: 54 },
      ],
      l: ['Le second saut de ligne prend deux octets : la même ligne n’a pas les mêmes octets.', 'The second line ending takes two bytes: the same line does not have the same bytes.'],
    },

  });
})(window);
