'use strict';
/*
 * Schémas de la catégorie « Langages et programmation ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'langage-portee': {
      k: 'dessin',
      h: 176,
      alt: ['Deux portées emboîtées : la fonction a sa propre variable a, distincte de la globale', 'Two nested scopes: the function has its own variable a, distinct from the global one'],
      d: [
        ['rect', 8, 8, 344, 160, { s: 'a', r: 10 }],
        ['text', 20, 24, ['Portée globale', 'Global scope'], { a: 's', s: 'a', sz: 11, b: true }],
        ['text', 20, 44, 'let a = "globale"', { a: 's', mono: true, sz: 11 }],
        ['rect', 30, 62, 300, 92, { s: 'v', r: 8 }],
        ['text', 42, 78, ['Portée de la fonction f', 'Scope of function f'], { a: 's', s: 'v', sz: 11, b: true }],
        ['text', 42, 98, 'let a = "locale"', { a: 's', mono: true, sz: 11 }],
        ['text', 42, 118, ['f voit sa propre a (« locale »)', 'f sees its own a (“locale”)'], { a: 's', s: 'mute', sz: 10.5 }],
        ['text', 42, 136, ['l’extérieur ne voit pas celle de f', 'the outside cannot see f’s'], { a: 's', s: 'mute', sz: 10.5 }],
      ],
    },

    'langage-closure': {
      k: 'graphe',
      alt: ['Une closure garde l’accès aux variables de l’endroit où elle est née', 'A closure keeps access to the variables of the place where it was born'],
      gy: 78,
      n: [
        { id: 'c', t: 'compteur()', sub: ['n = 0 (privé)', 'n = 0 (private)'], c: 0, r: 0, s: 'a', w: 130, h: 52, mono: true, sz: 11 },
        { id: 's', t: 'suivant', sub: ['la fonction retournée', 'the returned function'], c: 1, r: 0, s: 'v', w: 130, h: 52, mono: true, sz: 11 },
        { id: 'r', t: ['suivant() → 1\nsuivant() → 2', 'suivant() → 1\nsuivant() → 2'], c: 1, r: 1, s: 'ok', w: 130, mono: true, sz: 11 },
      ],
      e: [['c', 's', ['retourne', 'returns'], 'a'], ['s', 'c', ['se souvient de n', 'remembers n'], 'v dash'], ['s', 'r', '', 'ok']],
    },

    'langage-callback': {
      k: 'sequence',
      lh: 46,
      alt: ['Un callback est appelé plus tard, quand l’opération se termine', 'A callback is called later, when the operation finishes'],
      a: [['Votre code', 'Your code'], ['setTimeout', 'setTimeout']],
      s: ['a', 'warn'],
      m: [
        [0, 1, ['setTimeout(rappel, 3000)', 'setTimeout(callback, 3000)']],
        [0, 0, ['continue sans attendre', 'carries on without waiting'], 'mute'],
        [1, 0, ['3 s plus tard : appelle rappel()', '3 s later: calls callback()'], 'ok dash'],
      ],
    },

    'langage-promesse': {
      k: 'graphe',
      alt: ['Une promesse est en attente, puis tenue (then) ou rompue (catch)', 'A promise is pending, then fulfilled (then) or rejected (catch)'],
      gy: 72,
      n: [
        { id: 'p', t: 'pending', sub: ['en attente', 'waiting'], c: 0, r: 0.5, s: 'warn', w: 84, h: 46, mono: true, sz: 11 },
        { id: 'f', t: 'fulfilled', sub: ['tenue', 'kept'], c: 1, r: 0, s: 'ok', w: 90, h: 46, mono: true, sz: 11 },
        { id: 'r', t: 'rejected', sub: ['rompue', 'broken'], c: 1, r: 1, s: 'bad', w: 90, h: 46, mono: true, sz: 11 },
        { id: 't', t: '.then()', c: 2, r: 0, s: 'ok', w: 78, mono: true, sz: 11 },
        { id: 'c', t: '.catch()', c: 2, r: 1, s: 'bad', w: 78, mono: true, sz: 11 },
      ],
      e: [['p', 'f', 'resolve', 'ok'], ['p', 'r', 'reject', 'bad'], ['f', 't', '', 'ok'], ['r', 'c', '', 'bad']],
    },

    'langage-event-loop': {
      k: 'graphe',
      alt: ['La boucle d’événements reprend les tâches en attente quand la pile d’appels est vide', 'The event loop takes waiting tasks when the call stack is empty'],
      gy: 92,
      n: [
        { id: 'p', t: ['Pile d’appels', 'Call stack'], c: 0, r: 0, s: 'a', w: 116 },
        { id: 'a', t: ['API du navigateur\ntimers, réseau', 'Browser APIs\ntimers, network'], c: 1, r: 0, s: 'info', w: 122, h: 48, sz: 11 },
        { id: 'q', t: ['File de tâches\ncallbacks prêts', 'Task queue\nready callbacks'], c: 1, r: 1, s: 'warn', w: 122, h: 48, sz: 11 },
        { id: 'l', t: ['Boucle\nd’événements', 'Event\nloop'], c: 0, r: 1, s: 'v', w: 116, h: 48 },
      ],
      e: [['p', 'a', ['délègue', 'hands off'], 'a'], ['a', 'q', ['terminé', 'done'], 'info'], ['q', 'l', ['prend', 'takes'], 'warn'], ['l', 'p', ['si vide', 'if empty'], 'v']],
    },

    'langage-boucle': {
      k: 'graphe',
      alt: ['Une boucle for : initialiser, tester, exécuter le corps, incrémenter, recommencer', 'A for loop: initialize, test, run the body, increment, repeat'],
      gy: 84,
      n: [
        { id: 's', t: 'i = 1', c: 0, r: 0, s: 'a', w: 78, mono: true },
        { id: 't', t: 'i ≤ 3 ?', c: 1, r: 0, f: 'diam', s: 'warn', w: 96, h: 52, mono: true },
        { id: 'f', t: ['fin', 'end'], c: 2, r: 0, s: 'mute', w: 70 },
        { id: 'b', t: ['afficher i', 'print i'], c: 1, r: 1, s: 'ok', w: 96, mono: true, sz: 11 },
        { id: 'i', t: 'i = i + 1', c: 0, r: 1, s: 'a', w: 90, mono: true, sz: 11 },
      ],
      e: [['s', 't', '', 'a'], ['t', 'f', ['non', 'no'], 'mute'], ['t', 'b', ['oui', 'yes'], 'ok'], ['b', 'i', '', 'ok'], ['i', 't', '', 'a dash']],
    },

    'langage-recursion': {
      k: 'pile',
      lh: 34,
      alt: ['La pile d’appels de factorielle(3) : chaque appel attend celui du dessus', 'The call stack of factorielle(3): each call waits for the one above'],
      piles: [{
        t: ['Pile d’appels — le plus récent en haut', 'Call stack — most recent on top'],
        layers: [
          { t: 'factorielle(1)', d: ['cas de base → 1', 'base case → 1'], s: 'ok', mono: true },
          { t: 'factorielle(2)', d: ['attend → 2 × 1 = 2', 'waiting → 2 × 1 = 2'], s: 'a', mono: true },
          { t: 'factorielle(3)', d: ['attend → 3 × 2 = 6', 'waiting → 3 × 2 = 6'], s: 'a', mono: true },
          { t: ['programme principal', 'main program'], s: 'mute' },
        ],
      }],
    },

    'langage-complexite': {
      k: 'dessin',
      h: 190,
      alt: ['Comment le temps grandit avec la taille n des données : O(1), O(log n), O(n), O(n²)', 'How time grows with data size n: O(1), O(log n), O(n), O(n²)'],
      d: [
        ['line', 36, 164, 344, 164, { arrow: 1 }],
        ['line', 36, 164, 36, 12, { arrow: 1 }],
        ['text', 190, 182, ['taille des données n →', 'data size n →'], { s: 'mute', sz: 10.5, b: true }],
        ['text', 44, 14, ['temps', 'time'], { a: 's', s: 'mute', sz: 10.5, b: true }],
        ['path', 'M36,148 L286,148', { s: 'ok' }],
        ['text', 294, 152, 'O(1)', { a: 's', s: 'ok', sz: 11, b: true, mono: true }],
        ['path', 'M36,146 C80,116 160,104 286,98', { s: 'info' }],
        ['text', 294, 101, 'O(log n)', { a: 's', s: 'info', sz: 10, b: true, mono: true }],
        ['path', 'M36,146 L286,60', { s: 'warn' }],
        ['text', 294, 60, 'O(n)', { a: 's', s: 'warn', sz: 11, b: true, mono: true }],
        ['path', 'M36,146 C140,142 220,110 272,22', { s: 'bad' }],
        ['text', 278, 20, 'O(n²)', { a: 's', s: 'bad', sz: 11, b: true, mono: true }],
      ],
    },

    'langage-pile': {
      k: 'dessin',
      h: 158,
      alt: ['Une pile : on empile et on dépile par le haut (dernier entré, premier sorti)', 'A stack: pushing and popping at the top (last in, first out)'],
      d: [
        ['rect', 130, 100, 100, 28, { s: 'mute', t: 'a', mono: true, sz: 12 }],
        ['rect', 130, 70, 100, 28, { s: 'a', t: 'b', mono: true, sz: 12 }],
        ['rect', 130, 40, 100, 28, { s: 'ok', t: 'c', mono: true, sz: 12 }],
        ['line', 30, 54, 124, 54, { s: 'ok', arrow: 1 }],
        ['text', 30, 40, "push('c')", { a: 's', mono: true, sz: 11, s: 'ok', b: true }],
        ['line', 236, 54, 330, 54, { s: 'a', arrow: 1 }],
        ['text', 330, 40, 'pop() → c', { a: 'e', mono: true, sz: 11, s: 'a', b: true }],
        ['text', 180, 152, ['dernier entré, premier sorti (LIFO)', 'last in, first out (LIFO)'], { sz: 11, s: 'mute', b: true }],
      ],
    },

    'langage-file': {
      k: 'dessin',
      h: 128,
      alt: ['Une file : on ajoute à l’arrière et on retire à l’avant (premier entré, premier sorti)', 'A queue: adding at the back and removing at the front (first in, first out)'],
      d: [
        ['rect', 100, 36, 52, 32, { s: 'ok', t: '1', mono: true, sz: 12 }],
        ['rect', 156, 36, 52, 32, { s: 'a', t: '2', mono: true, sz: 12 }],
        ['rect', 212, 36, 52, 32, { s: 'a', t: '3', mono: true, sz: 12 }],
        ['line', 96, 52, 20, 52, { s: 'ok', arrow: 1 }],
        ['text', 10, 30, "shift() → 1", { a: 's', mono: true, sz: 10.5, s: 'ok', b: true }],
        ['line', 340, 52, 268, 52, { s: 'a', arrow: 1 }],
        ['text', 350, 30, "push(4)", { a: 'e', mono: true, sz: 10.5, s: 'a', b: true }],
        ['text', 130, 92, ['avant', 'front'], { sz: 10.5, s: 'mute' }],
        ['text', 240, 92, ['arrière', 'back'], { sz: 10.5, s: 'mute' }],
        ['text', 180, 120, ['premier entré, premier sorti (FIFO)', 'first in, first out (FIFO)'], { sz: 11, s: 'mute', b: true }],
      ],
    },

    'langage-liste-chainee': {
      k: 'graphe',
      alt: ['Une liste chaînée : chaque nœud contient une valeur et un lien vers le suivant', 'A linked list: each node holds a value and a link to the next one'],
      n: [
        { id: 'a', t: 'A', sub: '→', c: 0, r: 0, s: 'a', w: 56, h: 50, mono: true, sz: 14 },
        { id: 'b', t: 'B', sub: '→', c: 1, r: 0, s: 'a', w: 56, h: 50, mono: true, sz: 14 },
        { id: 'c', t: 'C', sub: '→', c: 2, r: 0, s: 'a', w: 56, h: 50, mono: true, sz: 14 },
        { id: 'd', t: 'null', c: 3, r: 0, s: 'mute', w: 56, mono: true, sz: 11 },
      ],
      e: [['a', 'b', '', 'a'], ['b', 'c', '', 'a'], ['c', 'd', '', 'a']],
    },

    'langage-arbre': {
      k: 'arbre',
      alt: ['Un arbre binaire de recherche : plus petit à gauche, plus grand à droite', 'A binary search tree: smaller on the left, larger on the right'],
      racine: {
        t: '8', s: 'a', k: [
          { t: '3', s: 'v', k: [{ t: '1', s: 'ok' }, { t: '6', s: 'ok' }] },
          { t: '10', s: 'v', k: [{ t: '14', s: 'ok' }] },
        ],
      },
      l: ['Racine en haut, feuilles en bas. Chercher 6 : 8 → gauche, 3 → droite.', 'Root at the top, leaves at the bottom. Looking for 6: 8 → left, 3 → right.'],
    },

    'langage-graphe': {
      k: 'dessin',
      h: 170,
      alt: ['Un graphe : des sommets reliés par des arêtes', 'A graph: vertices joined by edges'],
      d: [
        ['line', 60, 50, 180, 34, { s: 'mute' }],
        ['line', 180, 34, 300, 64, { s: 'mute' }],
        ['line', 60, 50, 110, 128, { s: 'mute' }],
        ['line', 110, 128, 250, 140, { s: 'mute' }],
        ['line', 180, 34, 250, 140, { s: 'mute' }],
        ['line', 300, 64, 250, 140, { s: 'mute' }],
        ['circ', 60, 50, 16, { s: 'a', t: 'A', sz: 12 }],
        ['circ', 180, 34, 16, { s: 'a', t: 'B', sz: 12 }],
        ['circ', 300, 64, 16, { s: 'a', t: 'C', sz: 12 }],
        ['circ', 110, 128, 16, { s: 'a', t: 'D', sz: 12 }],
        ['circ', 250, 140, 16, { s: 'a', t: 'E', sz: 12 }],
        ['text', 82, 22, ['sommet', 'vertex'], { s: 'a', sz: 10.5, b: true, a: 's' }],
        ['text', 240, 84, ['arête', 'edge'], { s: 'mute', sz: 10.5, b: true, a: 's' }],
      ],
    },

    'langage-hachage': {
      k: 'dessin',
      h: 158,
      alt: ['Une table de hachage : la clé est transformée en numéro de case', 'A hash table: the key is turned into a slot number'],
      d: [
        ['rect', 10, 10, 70, 30, { s: 'a', t: '"git"', mono: true, sz: 12 }],
        ['line', 84, 25, 116, 25, { s: 'a', arrow: 1 }],
        ['rect', 120, 10, 130, 30, { s: 'v', t: 'hash("git") % 5 = 2', mono: true, sz: 9.5 }],
        ['text', 262, 30, ['la clé', 'the key'], { a: 's', s: 'mute', sz: 10 }],
        ['line', 185, 42, 185, 86, { s: 'v', arrow: 1 }],
        ['rect', 40, 90, 52, 30, { s: 'mute', t: '0', mono: true, sz: 11 }],
        ['rect', 96, 90, 52, 30, { s: 'mute', t: '1', mono: true, sz: 11 }],
        ['rect', 152, 90, 66, 30, { s: 'ok', t: ['valeur', 'value'], sz: 11 }],
        ['rect', 222, 90, 52, 30, { s: 'mute', t: '3', mono: true, sz: 11 }],
        ['rect', 278, 90, 52, 30, { s: 'mute', t: '4', mono: true, sz: 11 }],
        ['text', 185, 138, ['case 2 : accès immédiat, sans parcourir les autres', 'slot 2: immediate access, without scanning the others'], { sz: 10.5, s: 'mute', b: true }],
      ],
    },

    'langage-classe': {
      k: 'graphe',
      alt: ['Une classe est un plan ; chaque instance est un objet construit à partir de lui', 'A class is a blueprint; each instance is an object built from it'],
      gy: 84,
      n: [
        { id: 'c', t: ['Classe Chien', 'Dog class'], sub: ['le plan', 'the blueprint'], c: 1, r: 0, s: 'a', w: 130, h: 50 },
        { id: 'a', t: 'rex', sub: 'nom = "Rex"', c: 0, r: 1, s: 'ok', w: 108, h: 50, mono: true, sz: 11 },
        { id: 'b', t: 'fido', sub: 'nom = "Fido"', c: 2, r: 1, s: 'ok', w: 108, h: 50, mono: true, sz: 11 },
      ],
      e: [['c', 'a', 'new', 'a'], ['c', 'b', 'new', 'a']],
    },

    'langage-heritage': {
      k: 'arbre',
      alt: ['Chien et Chat héritent de la classe mère Animal', 'Dog and Cat inherit from the parent class Animal'],
      w: 110,
      racine: {
        t: 'Animal\nmanger()', s: 'a', k: [{ t: 'Chien\naboyer()', s: 'ok' }, { t: 'Chat\nmiauler()', s: 'ok' }],
      },
      l: ['Les classes filles reçoivent manger() sans le réécrire.', 'The child classes receive manger() without rewriting it.'],
    },

    'langage-compilation': {
      k: 'graphe',
      alt: ['Compilation : traduire avant d’exécuter ; interprétation : lire et exécuter pas à pas', 'Compilation: translating before running; interpretation: reading and running step by step'],
      gy: 92,
      n: [
        { id: 'a', t: ['Code\nsource', 'Source\ncode'], c: 0, r: 0, s: 'a', w: 70 },
        { id: 'b', t: ['Compilateur', 'Compiler'], c: 1, r: 0, s: 'v', w: 74, sz: 9.5 },
        { id: 'c', t: ['Exécutable', 'Executable'], c: 2, r: 0, s: 'warn', w: 74, sz: 9.5 },
        { id: 'd', t: ['Processeur', 'Processor'], c: 3, r: 0, s: 'ok', w: 74, sz: 9.5 },
        { id: 'e', t: ['Code\nsource', 'Source\ncode'], c: 0, r: 1, s: 'a', w: 70 },
        { id: 'f', t: ['Interpréteur', 'Interpreter'], c: 1, r: 1, s: 'v', w: 74, sz: 9.5 },
        { id: 'g', t: ['Résultat', 'Result'], c: 2, r: 1, s: 'ok', w: 74, sz: 10.5 },
      ],
      e: [['a', 'b', '', 'a'], ['b', 'c', '', 'v'], ['c', 'd', '', 'warn'], ['e', 'f', '', 'a'], ['f', 'g', '', 'v']],
      g: [{ t: ['Compilé : traduit avant', 'Compiled: translated first'], ids: ['a', 'b', 'c', 'd'] }, { t: ['Interprété : lu et exécuté ligne à ligne', 'Interpreted: read and run line by line'], ids: ['e', 'f', 'g'] }],
    },

    'main-fonction': {
      k: 'graphe',
      alt: ['Le système d’exploitation appelle main(), qui appelle le reste du programme', 'The operating system calls main(), which calls the rest of the program'],
      gy: 76,
      n: [
        { id: 'o', t: ['Système\nd’exploitation', 'Operating\nsystem'], c: 0, r: 0.5, s: 'mute', w: 96 },
        { id: 'm', t: 'main()', c: 1, r: 0.5, s: 'a', w: 82, mono: true },
        { id: 'a', t: 'lire()', c: 2, r: 0, s: 'ok', w: 78, mono: true },
        { id: 'b', t: 'calculer()', c: 2, r: 1, s: 'ok', w: 90, mono: true, sz: 11 },
      ],
      e: [['o', 'm', ['lance', 'starts'], 'a'], ['m', 'o', ['code 0', 'code 0'], 'ok dash'], ['m', 'a', '', 'ok'], ['m', 'b', '', 'ok']],
    },

  });
})(window);
