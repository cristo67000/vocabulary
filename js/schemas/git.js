'use strict';
/*
 * Schémas de la catégorie « Git et GitHub ».
 *
 * Chaque entrée est la description d'une figure, dessinée par js/schema.js.
 * Voir l'en-tête de ce fichier pour le vocabulaire : `t` est un titre ou un
 * texte, `l` une légende, `alt` la description pour les lecteurs d'écran ; un
 * texte est une chaîne ou un couple [français, anglais].
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'git-zones': {
      k: 'graphe',
      alt: ['Les quatre zones de Git : dossier de travail, index, dépôt local, dépôt distant', 'The four areas of Git: working tree, index, local repository, remote repository'],
      l: ['Une modification traverse les zones dans l’ordre : add, commit, push.', 'A change moves through the areas in order: add, commit, push.'],
      n: [
        { id: 'w', t: ['Dossier de travail', 'Working tree'], c: 0, r: 0, f: 'file', s: 'warn', w: 112 },
        { id: 'i', t: ['Index\n(zone d’attente)', 'Index\n(staging area)'], c: 1, r: 0, s: 'a', w: 112 },
        { id: 'l', t: ['Dépôt local', 'Local repo'], c: 1, r: 1, f: 'db', s: 'ok', w: 112, h: 50 },
        { id: 'd', t: ['Dépôt distant', 'Remote repo'], c: 1, r: 2, f: 'cloud', s: 'v', w: 112, h: 54 },
      ],
      e: [
        ['w', 'i', 'git add', 'a'],
        ['i', 'l', 'git commit', 'a'],
        ['l', 'd', 'git push', 'v'],
        ['d', 'l', 'git fetch', 'v dash'],
      ],
      g: [{ t: ['Votre ordinateur', 'Your computer'], ids: ['w', 'i', 'l'] }],
    },

    'git-clone': {
      k: 'graphe',
      alt: ['Cloner : copier un dépôt distant sur son ordinateur', 'Cloning: copying a remote repository to your computer'],
      n: [
        { id: 'd', t: ['Dépôt distant\n(GitHub)', 'Remote repo\n(GitHub)'], c: 0, r: 0, f: 'cloud', s: 'v', w: 120, h: 56 },
        { id: 'l', t: ['Copie locale\n(dossier .git)', 'Local copy\n(.git folder)'], c: 1, r: 0, f: 'db', s: 'ok', w: 120, h: 62 },
        { id: 'w', t: ['Dossier de travail\n(vos fichiers)', 'Working tree\n(your files)'], c: 1, r: 1, f: 'file', s: 'warn', w: 134 },
      ],
      e: [
        ['d', 'l', 'git clone', 'a'],
        ['l', 'w', ['extrait', 'checks out'], 'a'],
      ],
    },

    'git-fetch': {
      k: 'graphe',
      alt: ['Fetch : rapatrier les nouveautés du dépôt distant sans toucher aux fichiers', 'Fetch: bring remote updates locally without touching your files'],
      n: [
        { id: 'd', t: ['Dépôt distant', 'Remote repo'], c: 0, r: 0, f: 'cloud', s: 'v', w: 110, h: 50 },
        { id: 'l', t: ['Dépôt local\norigin/main mis à jour', 'Local repo\norigin/main updated'], c: 1, r: 0, f: 'db', s: 'ok', w: 150, h: 62 },
        { id: 'w', t: ['Dossier de travail\n(inchangé)', 'Working tree\n(unchanged)'], c: 1, r: 1, f: 'file', s: 'mute', w: 150 },
      ],
      e: [
        ['d', 'l', 'git fetch', 'a'],
        ['l', 'w', ['rien ne bouge', 'nothing moves'], 'mute dash sans'],
      ],
    },

    'git-pull': {
      k: 'graphe',
      alt: ['Pull : fetch suivi d’une fusion dans la branche courante', 'Pull: fetch followed by a merge into the current branch'],
      n: [
        { id: 'd', t: ['Dépôt distant', 'Remote repo'], c: 0, r: 0, f: 'cloud', s: 'v', w: 110, h: 50 },
        { id: 'l', t: ['Dépôt local', 'Local repo'], c: 1, r: 0, f: 'db', s: 'ok', w: 110, h: 50 },
        { id: 'w', t: ['Dossier de travail\n(mis à jour)', 'Working tree\n(updated)'], c: 1, r: 1, f: 'file', s: 'warn', w: 138 },
      ],
      e: [
        ['d', 'l', '1. fetch', 'a'],
        ['l', 'w', '2. merge', 'a'],
      ],
      g: [{ t: ['git pull = fetch + merge', 'git pull = fetch + merge'], ids: ['l', 'w', 'd'] }],
    },

    'git-push': {
      k: 'graphe',
      alt: ['Push : envoyer ses commits vers le dépôt distant', 'Push: send your commits to the remote repository'],
      n: [
        { id: 'l', t: ['Dépôt local\ncommits A B C', 'Local repo\ncommits A B C'], c: 0, r: 0, f: 'db', s: 'ok', w: 112, h: 62 },
        { id: 'd', t: ['Dépôt distant\navait A B', 'Remote repo\nhad A B'], c: 1, r: 0, f: 'cloud', s: 'v', w: 112, h: 62 },
      ],
      e: [['l', 'd', ['git push\n(envoie C)', 'git push\n(sends C)'], 'a']],
    },

    'git-commit': {
      k: 'commits',
      alt: ['Une suite de commits sur la branche main', 'A chain of commits on the main branch'],
      lanes: ['main'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'] },
        { i: 'D', l: 0, x: 3, p: ['C'], s: 'new' },
      ],
      lab: [{ c: 'D', t: 'HEAD → main', s: 'head' }],
      l: ['Chaque commit pointe vers son parent : c’est une chaîne.', 'Each commit points to its parent: it is a chain.'],
    },

    'git-objets': {
      k: 'arbre',
      alt: ['Un commit désigne un arbre, qui contient des blobs et d’autres arbres', 'A commit points to a tree, which holds blobs and other trees'],
      racine: {
        t: 'commit\n9fc2', s: 'a',
        k: [{
          t: 'tree\n4b8e', s: 'v',
          k: [
            { t: 'blob\nREADME', s: 'ok' },
            { t: 'tree\nsrc/', s: 'v', k: [{ t: 'blob\nmain.js', s: 'ok' }, { t: 'blob\nstyle.css', s: 'ok' }] },
          ],
        }],
      },
      l: ['Blob = contenu d’un fichier · tree = dossier · commit = instantané daté.', 'Blob = file content · tree = folder · commit = dated snapshot.'],
    },

    'git-branche': {
      k: 'commits',
      alt: ['Une branche qui s’écarte de main', 'A branch that splits from main'],
      lanes: ['main', 'feature'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2.6, p: ['B'] },
        { i: 'D', l: 1, x: 2, p: ['B'], s: 'new' },
        { i: 'E', l: 1, x: 3, p: ['D'], s: 'new' },
      ],
      lab: [{ c: 'C', t: 'main', s: 'a' }, { c: 'E', t: 'feature', s: 'ok' }],
    },

    'git-merge': {
      k: 'commits',
      alt: ['Une fusion réunit deux branches en un commit à deux parents', 'A merge joins two branches into a commit with two parents'],
      lanes: ['main', 'feature'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'] },
        { i: 'D', l: 1, x: 2, p: ['B'] },
        { i: 'E', l: 1, x: 3, p: ['D'] },
        { i: 'M', l: 0, x: 4, p: ['C', 'E'], s: 'new' },
      ],
      lab: [{ c: 'M', t: 'main', s: 'a' }, { c: 'E', t: 'feature', s: 'ok', dessous: true }],
      l: ['M est un commit de fusion : il a deux parents (C et E).', 'M is a merge commit: it has two parents (C and E).'],
    },

    'git-fast-forward': {
      k: 'commits',
      alt: ['Fast-forward : main avance simplement jusqu’au bout de feature', 'Fast-forward: main simply moves up to the tip of feature'],
      lanes: ['main', 'feature'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 1, x: 2, p: ['B'] },
        { i: 'D', l: 1, x: 3, p: ['C'] },
      ],
      lab: [
        { c: 'B', t: ['main (avant)', 'main (before)'], s: 'mute' },
        { c: 'D', t: ['main (après)', 'main (after)'], s: 'a' },
        { c: 'D', t: 'feature', s: 'ok' },
      ],
      l: ['Aucun nouveau commit : l’étiquette main est seulement déplacée.', 'No new commit: the main label is simply moved.'],
    },

    'git-rebase': {
      k: 'commits',
      alt: ['Rebase : les commits de feature sont rejoués après ceux de main', 'Rebase: the feature commits are replayed on top of main'],
      lanes: ['main', 'feature'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'] },
        { i: 'D', l: 1, x: 2, p: ['B'], s: 'old' },
        { i: 'E', l: 1, x: 3, p: ['D'], s: 'old' },
        { i: 'D2', l: 0, x: 3, p: ['C'], s: 'new', t: "D'" },
        { i: 'E2', l: 0, x: 4, p: ['D2'], s: 'new', t: "E'" },
      ],
      lab: [{ c: 'E2', t: 'feature', s: 'ok' }],
      l: ['D et E (pointillés) sont abandonnés ; D’ et E’ sont de nouveaux commits, aux empreintes différentes.', 'D and E (dashed) are abandoned; D’ and E’ are new commits with different hashes.'],
    },

    'git-cherry-pick': {
      k: 'commits',
      alt: ['Cherry-pick : copier un seul commit d’une branche sur une autre', 'Cherry-pick: copy a single commit from one branch onto another'],
      lanes: ['main', 'feature'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 1, x: 2, p: ['B'] },
        { i: 'D', l: 1, x: 3, p: ['C'], s: 'ok' },
        { i: 'E', l: 1, x: 4, p: ['D'] },
        { i: 'D2', l: 0, x: 3.4, p: ['B'], s: 'new', t: "D'" },
      ],
      lab: [{ c: 'D2', t: 'main', s: 'a' }, { c: 'E', t: 'feature', s: 'ok' }],
      l: ['Seul D est copié (D’) : C et E restent sur feature.', 'Only D is copied (D’): C and E stay on feature.'],
    },

    'git-amend': {
      k: 'commits',
      alt: ['Amend : le dernier commit est remplacé par une nouvelle version', 'Amend: the last commit is replaced by a new version'],
      lanes: ['main', ''],
      lh: 52,
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'], s: 'old' },
        { i: 'C2', l: 1, x: 2, p: ['B'], s: 'new', t: "C'" },
      ],
      lab: [
        { c: 'C', t: ['ancien (abandonné)', 'old (abandoned)'], s: 'mute' },
        { c: 'C2', t: 'HEAD → main', s: 'head', dessous: true },
      ],
      l: ['C’ prend la place de C : nouvelle empreinte, même parent. À éviter après un push.', 'C’ takes C’s place: new hash, same parent. Avoid after a push.'],
    },

    'git-stash': {
      k: 'graphe',
      alt: ['Stash : mettre de côté ses modifications en cours, puis les reprendre', 'Stash: set aside your work in progress, then bring it back'],
      n: [
        { id: 'w', t: ['Modifications\nen cours', 'Work in\nprogress'], c: 0, r: 0, f: 'file', s: 'warn', w: 96 },
        { id: 's', t: ['Stash\n(la pile)', 'Stash\n(the pile)'], c: 1, r: 0, f: 'db', s: 'v', w: 96, h: 58 },
        { id: 'c', t: ['Dossier propre\n(= dernier commit)', 'Clean folder\n(= last commit)'], c: 0, r: 1, f: 'file', s: 'ok', w: 134 },
      ],
      e: [
        ['w', 's', 'stash', 'v'],
        ['s', 'w', 'pop', 'v dash'],
        ['w', 'c', ['on repart de HEAD', 'back to HEAD'], 'ok dash'],
      ],
    },

    'git-tag': {
      k: 'commits',
      alt: ['Des étiquettes de version posées sur des commits précis', 'Version labels attached to specific commits'],
      lanes: ['main'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'] },
        { i: 'D', l: 0, x: 3, p: ['C'] },
        { i: 'E', l: 0, x: 4, p: ['D'] },
      ],
      lab: [
        { c: 'B', t: 'v1.0', s: 'tag' },
        { c: 'D', t: 'v1.1', s: 'tag' },
        { c: 'E', t: 'main', s: 'a' },
      ],
      l: ['Une étiquette ne bouge pas : elle marque un commit pour toujours.', 'A tag never moves: it marks a commit for good.'],
    },

    'git-head': {
      k: 'commits',
      alt: ['HEAD désigne la branche courante, qui désigne le dernier commit', 'HEAD names the current branch, which names the latest commit'],
      lanes: ['main'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'] },
      ],
      lab: [
        { c: 'C', t: 'main', s: 'a' },
        { c: 'C', t: 'HEAD', s: 'head' },
      ],
      l: ['HEAD → main → C : « vous êtes ici ».', 'HEAD → main → C: “you are here”.'],
    },

    'git-detached-head': {
      k: 'commits',
      alt: ['HEAD détaché : HEAD pointe directement sur un commit, plus sur une branche', 'Detached HEAD: HEAD points straight at a commit, no longer at a branch'],
      lanes: ['main', ''],
      lh: 60,
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'] },
        { i: 'X', l: 1, x: 2, p: ['B'], s: 'warn' },
      ],
      lab: [
        { c: 'C', t: 'main', s: 'a' },
        { c: 'X', t: ['HEAD (détaché)', 'HEAD (detached)'], s: 'head', dessous: true },
      ],
      l: ['X n’appartient à aucune branche : sans étiquette, on le perd en quittant.', 'X belongs to no branch: without a label, leaving it loses it.'],
    },

    'git-reset': {
      k: 'cases',
      alt: ['Les trois modes de reset : soft, mixed, hard', 'The three reset modes: soft, mixed, hard'],
      l: ['En bleu : ce que le reset remet en état. Le mode hard efface aussi vos fichiers.', 'In blue: what reset puts back. Hard mode also erases your files.'],
      rows: [
        { t: 'git reset --soft', cells: ['HEAD', ['Index', 'Index'], ['Fichiers', 'Files']], s: ['a', 'ok', 'ok'], w: 100, mono: false, sz: 12, espace: 6 },
        { t: 'git reset --mixed', cells: ['HEAD', ['Index', 'Index'], ['Fichiers', 'Files']], s: ['a', 'a', 'ok'], w: 100, mono: false, sz: 12, espace: 6 },
        { t: 'git reset --hard', cells: ['HEAD', ['Index', 'Index'], ['Fichiers', 'Files']], s: ['a', 'a', 'bad'], w: 100, mono: false, sz: 12 },
      ],
    },

    'git-revert': {
      k: 'commits',
      alt: ['Revert : un nouveau commit qui annule l’effet d’un commit précédent', 'Revert: a new commit that undoes the effect of an earlier commit'],
      lanes: ['main'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'], s: 'bad' },
        { i: 'D', l: 0, x: 3, p: ['C'] },
        { i: 'R', l: 0, x: 4, p: ['D'], s: 'new' },
      ],
      lab: [
        { c: 'C', t: ['à annuler', 'to undo'], s: 'bad', dessous: true },
        { c: 'R', t: 'revert C', s: 'a' },
      ],
      l: ['L’historique n’est pas réécrit : R s’ajoute à la suite.', 'History is not rewritten: R is simply added on top.'],
    },

    'git-squash': {
      k: 'commits',
      alt: ['Squash : plusieurs commits réunis en un seul', 'Squash: several commits combined into one'],
      lanes: [['avant', 'before'], ['après', 'after']],
      lh: 52,
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'b1', l: 0, x: 1, p: ['A'], s: 'old' },
        { i: 'b2', l: 0, x: 2, p: ['b1'], s: 'old' },
        { i: 'b3', l: 0, x: 3, p: ['b2'], s: 'old' },
        { i: 'A2', l: 1, x: 0, t: 'A' },
        { i: 'S', l: 1, x: 3, p: ['A2'], s: 'new' },
      ],
      lab: [{ c: 'S', t: 'b1 + b2 + b3', s: 'a', dessous: true }],
    },

    'git-bisect': {
      k: 'cases',
      alt: ['Bisect : une recherche dichotomique du commit qui a introduit un bug', 'Bisect: a binary search for the commit that introduced a bug'],
      l: ['En 3 essais, on isole le coupable parmi 8 commits.', 'In 3 tries, the culprit among 8 commits is found.'],
      rows: [
        { t: [' 0. Le dernier commit est mauvais, le premier était bon', ' 0. The latest commit is bad, the first was good'], cells: ['1', '2', '3', '4', '5', '6', '7', '8'], s: ['ok', '', '', '', '', '', '', 'bad'], w: 36, h: 26, espace: 4 },
        { t: [' 1. On teste le milieu (4) → bon', ' 1. Test the middle (4) → good'], cells: ['1', '2', '3', '4', '5', '6', '7', '8'], s: ['ok', 'ok', 'ok', 'ok', '', '', '', 'bad'], w: 36, h: 26, espace: 4 },
        { t: [' 2. On teste 6 → mauvais', ' 2. Test 6 → bad'], cells: ['1', '2', '3', '4', '5', '6', '7', '8'], s: ['ok', 'ok', 'ok', 'ok', '', 'bad', 'bad', 'bad'], w: 36, h: 26, espace: 4 },
        { t: [' 3. On teste 5 → mauvais : le coupable est 5', ' 3. Test 5 → bad: the culprit is 5'], cells: ['1', '2', '3', '4', '5', '6', '7', '8'], s: ['ok', 'ok', 'ok', 'ok', 'bad', 'bad', 'bad', 'bad'], w: 36, h: 26, espace: 4 },
      ],
    },

    'git-hook': {
      k: 'graphe',
      alt: ['Un hook s’exécute avant le commit et peut le refuser', 'A hook runs before the commit and may refuse it'],
      n: [
        { id: 'a', t: 'git commit', c: 0, r: 0, s: 'a', mono: true, w: 86, sz: 11 },
        { id: 'h', t: ['pre-commit\n(votre script)', 'pre-commit\n(your script)'], c: 1, r: 0, f: 'diam', s: 'warn', w: 120, h: 62, sz: 11 },
        { id: 'o', t: ['Commit\ncréé', 'Commit\ncreated'], c: 2, r: 0, s: 'ok', w: 78 },
        { id: 'k', t: ['Commit refusé', 'Commit refused'], c: 1, r: 1, s: 'bad', w: 120 },
      ],
      e: [
        ['a', 'h'],
        ['h', 'o', '0', 'ok'],
        ['h', 'k', '≠ 0', 'bad'],
      ],
    },

    'git-submodule': {
      k: 'graphe',
      alt: ['Un sous-module : un dépôt à l’intérieur d’un autre, figé sur un commit précis', 'A submodule: a repository inside another, pinned to an exact commit'],
      n: [
        { id: 'p', t: ['Dépôt\nprincipal', 'Main\nrepository'], c: 0, r: 0, f: 'db', s: 'ok', w: 90, h: 60 },
        { id: 's', t: ['Dépôt tiers\n(sous-module)', 'Third-party repo\n(submodule)'], c: 1, r: 0, f: 'db', s: 'v', w: 108, h: 60 },
      ],
      e: [['p', 's', ['épingle\nle commit a3f9', 'pins\ncommit a3f9'], 'a']],
    },

    'git-remote': {
      k: 'graphe',
      alt: ['Un dépôt local peut connaître plusieurs remotes : origin et upstream', 'A local repository can know several remotes: origin and upstream'],
      n: [
        { id: 'l', t: ['Dépôt\nlocal', 'Local\nrepo'], c: 0, r: 0, f: 'db', s: 'ok', w: 90, h: 58 },
        { id: 'o', t: ['origin\n(votre fork)', 'origin\n(your fork)'], c: 1, r: 0, f: 'cloud', s: 'v', w: 120, h: 56 },
        { id: 'u', t: ['upstream\n(projet d’origine)', 'upstream\n(original project)'], c: 1, r: 1, f: 'cloud', s: 'info', w: 130, h: 56 },
      ],
      e: [
        ['l', 'o', 'push', 'v'],
        ['o', 'l', 'fetch', 'v dash'],
        ['u', 'l', 'fetch', 'info dash'],
      ],
    },

    'git-fork': {
      k: 'graphe',
      alt: ['Fork : une copie personnelle d’un dépôt sur GitHub, pour proposer des changements', 'Fork: your own copy of a repository on GitHub, to propose changes'],
      n: [
        { id: 'u', t: ['Dépôt d’origine\n(upstream)', 'Original repo\n(upstream)'], c: 0, r: 0, f: 'cloud', s: 'info', w: 116, h: 56 },
        { id: 'f', t: ['Votre fork\n(sur GitHub)', 'Your fork\n(on GitHub)'], c: 1, r: 0, f: 'cloud', s: 'v', w: 116, h: 56 },
        { id: 'c', t: ['Clone local', 'Local clone'], c: 1, r: 1, f: 'db', s: 'ok', w: 116, h: 50 },
      ],
      e: [
        ['u', 'f', 'fork', 'a'],
        ['f', 'u', 'pull\nrequest', 'a dash'],
        ['f', 'c', 'clone', 'a'],
        ['c', 'f', 'push', 'a dash'],
      ],
    },

    'git-pull-request': {
      k: 'sequence',
      alt: ['Le déroulé d’une pull request entre l’auteur, GitHub et le relecteur', 'How a pull request unfolds between the author, GitHub and the reviewer'],
      a: [['Auteur', 'Author'], 'GitHub', ['Relecteur', 'Reviewer']],
      s: ['a', 'n', 'v'],
      m: [
        [0, 1, ['push de la branche', 'push the branch']],
        [0, 1, ['ouvre la pull request', 'opens the pull request']],
        [2, 1, ['relit et commente', 'reviews and comments']],
        [1, 0, ['demande des changements', 'requests changes'], 'warn dash'],
        [0, 1, ['push des corrections', 'push the fixes']],
        [2, 1, ['approuve', 'approves'], 'ok'],
        [1, 1, ['fusion dans main', 'merge into main'], 'ok'],
      ],
    },

    'git-conflit': {
      k: 'commits',
      alt: ['Conflit : deux branches ont modifié la même ligne, Git ne sait pas choisir', 'Conflict: two branches changed the same line, Git cannot choose'],
      lanes: ['main', 'feature'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'], s: 'warn' },
        { i: 'C', l: 1, x: 1, p: ['A'], s: 'warn' },
        { i: 'M', l: 0, x: 3, p: ['B', 'C'], s: 'bad', t: '⚠' },
      ],
      lab: [{ c: 'B', t: ['ligne 12 : « a »', 'line 12: “a”'], s: 'warn' }, { c: 'C', t: ['ligne 12 : « b »', 'line 12: “b”'], s: 'warn', dessous: true }, { c: 'M', t: ['à résoudre', 'to resolve'], s: 'bad' }],
    },

    'git-gitignore': {
      k: 'arbre',
      mode: 'liste',
      alt: ['Un dossier de projet : ce que .gitignore exclut du suivi de Git', 'A project folder: what .gitignore keeps out of Git’s tracking'],
      racine: {
        t: 'mon-projet/', d: true, k: [
          { t: 'src/', d: true, k: [{ t: 'app.js', c: ['suivi', 'tracked'], cs: 'ok' }] },
          { t: 'node_modules/', d: true, s: 'mute', c: ['ignoré', 'ignored'], cs: 'bad' },
          { t: '.env', s: 'mute', c: ['ignoré (secrets)', 'ignored (secrets)'], cs: 'bad' },
          { t: '.gitignore', c: ['suivi', 'tracked'], cs: 'ok' },
          { t: 'README.md', c: ['suivi', 'tracked'], cs: 'ok' },
        ],
      },
    },

    'git-dossier-git': {
      k: 'arbre',
      mode: 'liste',
      alt: ['Le contenu du dossier caché .git', 'The contents of the hidden .git folder'],
      racine: {
        t: '.git/', d: true, k: [
          { t: 'HEAD', c: ['branche courante', 'current branch'] },
          { t: 'config', c: ['réglages du dépôt', 'repository settings'] },
          { t: 'index', c: ['zone d’attente', 'staging area'] },
          { t: 'objects/', d: true, c: ['commits, arbres, blobs', 'commits, trees, blobs'] },
          { t: 'refs/', d: true, c: ['branches et tags', 'branches and tags'] },
          { t: 'hooks/', d: true, c: ['scripts automatiques', 'automatic scripts'] },
        ],
      },
    },

    'git-porcelaine': {
      k: 'pile',
      alt: ['Porcelaine et plomberie : les deux étages des commandes Git', 'Porcelain and plumbing: the two layers of Git commands'],
      piles: [{
        t: ['Ce que vous tapez ↓', 'What you type ↓'],
        layers: [
          { t: ['Porcelaine', 'Porcelain'], d: 'add · commit · push · pull · status', s: 'a' },
          { t: ['Plomberie', 'Plumbing'], d: 'hash-object · cat-file · update-ref · rev-parse', s: 'v' },
          { t: ['Base de données', 'Database'], d: ['objets et références dans .git', 'objects and references in .git'], s: 'mute' },
        ],
      }],
    },

    'git-noreply': {
      k: 'dessin',
      h: 128,
      alt: ['L’adresse noreply de GitHub, découpée en trois parties', 'The GitHub noreply address, split into three parts'],
      d: [
        ['rect', 8, 8, 344, 34, { s: 'a', t: '231077272+cristo67000@users.noreply.github.com', mono: true, sz: 10.5, r: 8 }],
        ['line', 12, 54, 74, 54, { s: 'ok' }],
        ['line', 80, 54, 146, 54, { s: 'v' }],
        ['line', 154, 54, 348, 54, { s: 'warn' }],
        ['text', 43, 72, ['ID numérique', 'numeric ID'], { s: 'ok', sz: 10, b: true }],
        ['text', 113, 72, ['nom de compte', 'username'], { s: 'v', sz: 10, b: true }],
        ['text', 251, 72, ['domaine réservé de GitHub', 'GitHub reserved domain'], { s: 'warn', sz: 10, b: true }],
        ['text', 180, 104, ['Ce courriel masque votre vraie adresse : aucun message n’y arrive.', 'This email hides your real address: no mail is delivered to it.'], { sz: 10.5, max: 340 }],
      ],
    },

    'git-github': {
      k: 'graphe',
      alt: ['GitHub : une plateforme qui héberge des dépôts Git et les outils pour collaborer', 'GitHub: a platform hosting Git repositories and the tools to collaborate'],
      n: [
        { id: 'g', t: 'GitHub', c: 1, r: 1, f: 'cloud', s: 'v', w: 100, h: 60 },
        { id: 'd', t: ['Vous\n(git push)', 'You\n(git push)'], c: 0, r: 0, s: 'ok', w: 96 },
        { id: 'c', t: ['Équipe\n(pull requests)', 'Team\n(pull requests)'], c: 0, r: 2, s: 'a', w: 96 },
        { id: 'p', t: ['Pages\n(site web)', 'Pages\n(website)'], c: 2, r: 0, s: 'info', w: 96 },
        { id: 'x', t: ['Actions\n(automatisation)', 'Actions\n(automation)'], c: 2, r: 2, s: 'warn', w: 96 },
      ],
      gy: 66,
      e: [['d', 'g', '', 'ok'], ['c', 'g', '', 'a double'], ['g', 'p', '', 'info'], ['g', 'x', '', 'warn']],
    },

    'git-diff': {
      k: 'graphe',
      alt: ['Un diff compare deux versions d’un fichier et liste les lignes retirées et ajoutées', 'A diff compares two versions of a file and lists the removed and added lines'],
      gy: 66,
      n: [
        { id: 'a', t: ['Version avant', 'Version before'], c: 0, r: 0, f: 'file', s: 'bad', w: 112 },
        { id: 'b', t: ['Version après', 'Version after'], c: 0, r: 1, f: 'file', s: 'ok', w: 112 },
        { id: 'd', t: 'diff', sub: ['− ligne retirée\n+ ligne ajoutée', '− removed line\n+ added line'], c: 1, r: 0.5, s: 'a', w: 130, h: 62, mono: true },
      ],
      e: [['a', 'd', '', 'bad'], ['b', 'd', '', 'ok']],
    },

    'git-main': {
      k: 'commits',
      alt: ['La branche principale main, d’où partent les autres branches', 'The main branch, from which the other branches start'],
      lanes: ['main', 'fix-bug'],
      c: [
        { i: 'A', l: 0, x: 0 },
        { i: 'B', l: 0, x: 1, p: ['A'] },
        { i: 'C', l: 0, x: 2, p: ['B'] },
        { i: 'D', l: 0, x: 3.5, p: ['C', 'F'], s: 'new' },
        { i: 'E', l: 1, x: 1.6, p: ['B'] },
        { i: 'F', l: 1, x: 2.6, p: ['E'] },
      ],
      lab: [{ c: 'D', t: 'main', s: 'a' }, { c: 'F', t: 'fix-bug', s: 'ok', dessous: true }],
    },

  });
})(window);
