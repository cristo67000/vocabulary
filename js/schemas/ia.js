'use strict';
/*
 * Schémas de la catégorie « IA et assistants de code ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'ia-llm': {
      k: 'graphe',
      alt: ['Un modèle de langage prédit la suite d’un texte : il calcule des probabilités, en choisit une, et recommence', 'A language model predicts what follows a text: it computes probabilities, picks one, and starts again'],
      gy: 84,
      n: [
        { id: 'a', t: ['Texte', 'Text'], sub: '"Le ciel est"', c: 0, r: 0, s: 'a', w: 100, h: 50, sz: 11 },
        { id: 'l', t: 'LLM', c: 1, r: 0, s: 'v', w: 76 },
        { id: 'p', t: ['Probabilités', 'Probabilities'], sub: 'bleu 62 %\ngris 20 %', c: 2, r: 0, s: 'warn', w: 100, h: 60, sz: 10.5 },
        { id: 'o', t: ['Texte allongé', 'Longer text'], sub: '"Le ciel est bleu"', c: 1, r: 1, s: 'ok', w: 120, h: 50, sz: 10.5 },
      ],
      e: [['a', 'l', '', 'a'], ['l', 'p', '', 'v'], ['p', 'o', '', 'warn'], ['o', 'l', ['on recommence', 'repeat'], 'ok dash']],
    },

    'ia-contexte': {
      k: 'dessin',
      h: 130,
      alt: ['La fenêtre de contexte se remplit : consignes, conversation, fichiers, réponse', 'The context window fills up: instructions, conversation, files, answer'],
      d: [
        ['text', 8, 16, ['Fenêtre de contexte (en tokens)', 'Context window (in tokens)'], { a: 's', sz: 11, b: true, s: 'mute' }],
        ['rect', 10, 28, 36, 34, { s: 'warn', r: 3 }],
        ['rect', 46, 28, 110, 34, { s: 'a', r: 3 }],
        ['rect', 156, 28, 90, 34, { s: 'v', r: 3 }],
        ['rect', 246, 28, 54, 34, { s: 'ok', r: 3 }],
        ['rect', 300, 28, 50, 34, { s: 'mute', dash: 1, r: 3 }],
        ['text', 28, 80, ['consignes', 'rules'], { sz: 10, b: true, s: 'warn' }],
        ['text', 101, 80, ['conversation', 'conversation'], { sz: 10, b: true, s: 'a' }],
        ['text', 201, 80, ['fichiers', 'files'], { sz: 10, b: true, s: 'v' }],
        ['text', 273, 80, ['réponse', 'answer'], { sz: 10, b: true, s: 'ok' }],
        ['text', 325, 80, ['libre', 'free'], { sz: 10, b: true, s: 'mute' }],
        ['text', 180, 112, ['Ce qui dépasse est oublié ou doit être résumé.', 'What exceeds it is forgotten or must be summarized.'], { sz: 10.5, s: 'mute' }],
      ],
    },

    'ia-temperature': {
      k: 'dessin',
      h: 176,
      alt: ['Température basse : le token le plus probable presque toujours ; haute : des choix plus variés', 'Low temperature: almost always the most likely token; high: more varied choices'],
      d: [
        ['text', 80, 14, ['température basse', 'low temperature'], { sz: 11, b: true, s: 'a' }],
        ['text', 270, 14, ['température haute', 'high temperature'], { sz: 11, b: true, s: 'v' }],
        ['line', 20, 144, 156, 144, { s: 'g' }],
        ['line', 204, 144, 340, 144, { s: 'g' }],
        ['rect', 32, 54, 30, 90, { s: 'a', r: 2 }],
        ['rect', 82, 136, 30, 8, { s: 'mute', r: 2 }],
        ['rect', 132, 142, 30, 2, { s: 'mute', r: 1 }],
        ['text', 47, 46, '90 %', { mono: true, sz: 9.5 }],
        ['rect', 216, 99, 30, 45, { s: 'v', r: 2 }],
        ['rect', 266, 111, 30, 33, { s: 'v', r: 2 }],
        ['rect', 316, 122, 30, 22, { s: 'v', r: 2 }],
        ['text', 231, 91, '45 %', { mono: true, sz: 9.5 }],
        ['text', 47, 160, 'bleu', { mono: true, sz: 10, s: 'mute' }],
        ['text', 97, 160, 'gris', { mono: true, sz: 10, s: 'mute' }],
        ['text', 147, 160, 'noir', { mono: true, sz: 10, s: 'mute' }],
        ['text', 231, 160, 'bleu', { mono: true, sz: 10, s: 'mute' }],
        ['text', 281, 160, 'gris', { mono: true, sz: 10, s: 'mute' }],
        ['text', 331, 160, 'noir', { mono: true, sz: 10, s: 'mute' }],
      ],
    },

    'ia-embedding': {
      k: 'dessin',
      h: 178,
      alt: ['Des mots de sens proche ont des vecteurs proches : les animaux d’un côté, la programmation de l’autre', 'Words of similar meaning have nearby vectors: animals on one side, programming on the other'],
      d: [
        ['ell', 78, 66, 62, 42, { s: 'ok', dash: 1 }],
        ['ell', 272, 120, 66, 42, { s: 'a', dash: 1 }],
        ['circ', 54, 52, 6, { s: 'ok' }], ['text', 54, 38, 'chat', { mono: true, sz: 10 }],
        ['circ', 100, 48, 6, { s: 'ok' }], ['text', 110, 51, 'chien', { a: 's', mono: true, sz: 10 }],
        ['circ', 78, 84, 6, { s: 'ok' }], ['text', 88, 88, 'lion', { a: 's', mono: true, sz: 10 }],
        ['circ', 246, 110, 6, { s: 'a' }], ['text', 236, 104, 'python', { a: 'e', mono: true, sz: 10 }],
        ['circ', 292, 100, 6, { s: 'a' }], ['text', 302, 96, 'js', { a: 's', mono: true, sz: 10 }],
        ['circ', 268, 136, 6, { s: 'a' }], ['text', 278, 148, 'code', { a: 's', mono: true, sz: 10 }],
        ['circ', 190, 30, 6, { s: 'warn' }], ['text', 200, 26, 'pizza', { a: 's', mono: true, sz: 10 }],
        ['text', 180, 168, ['proche dans l’espace = proche par le sens', 'close in space = close in meaning'], { sz: 10.5, s: 'mute', b: true }],
      ],
    },

    'ia-rag': {
      k: 'graphe',
      alt: ['RAG : chercher des documents pertinents, les ajouter au prompt, puis laisser le modèle répondre', 'RAG: find relevant documents, add them to the prompt, then let the model answer'],
      gy: 84,
      n: [
        { id: 'q', t: ['Question', 'Question'], c: 0, r: 0, s: 'a', w: 88 },
        { id: 's', t: ['Recherche', 'Search'], sub: 'embeddings', c: 1, r: 0, s: 'v', w: 92, h: 48, sz: 11 },
        { id: 'd', t: ['Documents\npertinents', 'Relevant\ndocuments'], c: 2, r: 0, f: 'db', s: 'info', w: 92, h: 58, sz: 10.5 },
        { id: 'p', t: ['Prompt\nenrichi', 'Enriched\nprompt'], c: 2, r: 1, s: 'warn', w: 92, sz: 10.5 },
        { id: 'l', t: 'LLM', c: 1, r: 1, s: 'v', w: 80 },
        { id: 'r', t: ['Réponse\n+ sources', 'Answer\n+ sources'], c: 0, r: 1, s: 'ok', w: 88, sz: 10.5 },
      ],
      e: [['q', 's', '', 'a'], ['s', 'd', '', 'v'], ['d', 'p', '', 'info'], ['p', 'l', '', 'warn'], ['l', 'r', '', 'v']],
    },

    'ia-agent': {
      k: 'graphe',
      alt: ['Un agent : le modèle choisit une action, un outil l’exécute, le modèle observe le résultat, et recommence', 'An agent: the model chooses an action, a tool runs it, the model observes the result, and repeats'],
      gy: 84,
      n: [
        { id: 'g', t: ['Objectif', 'Goal'], c: 0, r: 0, s: 'a', w: 88 },
        { id: 'm', t: ['Modèle', 'Model'], sub: ['décide', 'decides'], c: 1, r: 0, s: 'v', w: 88, h: 48 },
        { id: 't', t: ['Outil', 'Tool'], sub: ['fichier, commande,\nAPI', 'file, command,\nAPI'], c: 2, r: 0, s: 'warn', w: 104, h: 62, sz: 11 },
        { id: 'o', t: ['Résultat', 'Result'], c: 2, r: 1, s: 'info', w: 88 },
        { id: 'f', t: ['Réponse\nfinale', 'Final\nanswer'], c: 0, r: 1, s: 'ok', w: 88, sz: 10.5 },
      ],
      e: [['g', 'm', '', 'a'], ['m', 't', ['agit', 'acts'], 'v'], ['t', 'o', '', 'warn'], ['o', 'm', ['observe', 'observes'], 'info dash'], ['m', 'f', ['a fini', 'is done'], 'ok']],
    },

    'ia-mcp': {
      k: 'graphe',
      alt: ['Un assistant se connecte par MCP à un serveur qui expose des outils', 'An assistant connects through MCP to a server that exposes tools'],
      gy: 64,
      n: [
        { id: 'c', t: ['Assistant', 'Assistant'], sub: 'client MCP', c: 0, r: 1, s: 'a', w: 92, h: 48, sz: 11 },
        { id: 's', t: ['Serveur MCP', 'MCP server'], c: 1, r: 1, s: 'v', w: 96, sz: 11 },
        { id: 'f', t: ['Fichiers', 'Files'], c: 2, r: 0, s: 'ok', w: 88 },
        { id: 'b', t: ['Base de données', 'Database'], c: 2, r: 1, f: 'db', s: 'ok', w: 92, h: 50, sz: 10.5 },
        { id: 'w', t: ['Service web', 'Web service'], c: 2, r: 2, s: 'ok', w: 92, sz: 11 },
      ],
      e: [['c', 's', 'MCP', 'a double'], ['s', 'f', '', 'v'], ['s', 'b', '', 'v'], ['s', 'w', '', 'v']],
    },

  });
})(window);
