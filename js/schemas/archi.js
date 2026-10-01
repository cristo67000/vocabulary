'use strict';
/*
 * Schémas de la catégorie « Architecture et concepts ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'archi-api': {
      k: 'graphe',
      alt: ['Une API : l’application envoie une requête à l’interface, sans connaître l’intérieur du service', 'An API: the app sends a request to the interface, without knowing the service’s inner workings'],
      gy: 76,
      n: [
        { id: 'a', t: ['Votre\napplication', 'Your\napp'], c: 0, r: 0, s: 'a', w: 92 },
        { id: 'i', t: 'API', c: 1, r: 0, s: 'v', w: 78 },
        { id: 's', t: ['Service', 'Service'], sub: ['(boîte noire)', '(black box)'], c: 2, r: 0, f: 'db', s: 'mute', w: 96, h: 56 },
      ],
      e: [['a', 'i', ['requête', 'request'], 'a'], ['i', 'a', ['JSON', 'JSON'], 'ok dash'], ['i', 's', '', 'v']],
    },

    'archi-client-serveur': {
      k: 'graphe',
      alt: ['Le front-end (client) envoie des requêtes au back-end (serveur), qui interroge la base de données', 'The front-end (client) sends requests to the back-end (server), which queries the database'],
      gy: 84,
      n: [
        { id: 'f', t: 'Front-end', sub: ['navigateur, appli', 'browser, app'], c: 0, r: 0, s: 'a', w: 112, h: 50 },
        { id: 'b', t: 'Back-end', sub: ['le serveur', 'the server'], c: 1, r: 0, s: 'v', w: 112, h: 50 },
        { id: 'd', t: ['Base de données', 'Database'], c: 1, r: 1, f: 'db', s: 'ok', w: 112, h: 54 },
      ],
      e: [['f', 'b', ['requête', 'request'], 'a'], ['b', 'f', ['réponse', 'response'], 'v dash'], ['b', 'd', 'SQL', 'ok']],
    },

    'archi-mvc': {
      k: 'graphe',
      alt: ['MVC : la vue affiche, le contrôleur reçoit les actions, le modèle garde les données', 'MVC: the view displays, the controller receives actions, the model holds the data'],
      gy: 92,
      n: [
        { id: 'v', t: ['Vue', 'View'], sub: ['ce qu’on voit', 'what you see'], c: 0, r: 0, s: 'a', w: 112, h: 50 },
        { id: 'c', t: ['Contrôleur', 'Controller'], sub: ['reçoit les actions', 'receives actions'], c: 2, r: 0, s: 'v', w: 118, h: 50, sz: 11 },
        { id: 'm', t: ['Modèle', 'Model'], sub: ['données + règles', 'data + rules'], c: 1, r: 1, s: 'ok', w: 118, h: 50 },
      ],
      e: [['v', 'c', ['actions', 'actions'], 'a'], ['c', 'm', ['met à jour', 'updates'], 'v'], ['m', 'v', ['notifie', 'notifies'], 'ok dash']],
    },

    'archi-microservices': {
      k: 'graphe',
      alt: ['Un monolithe contient tout dans un programme ; des microservices sont de petits services qui communiquent', 'A monolith holds everything in one program; microservices are small services that communicate'],
      gy: 84,
      n: [
        { id: 'm', t: ['Un seul programme', 'A single program'], sub: ['clients · commandes · paiement', 'customers · orders · payment'], c: 1, r: 0, s: 'warn', w: 230, h: 50, sz: 11 },
        { id: 'u', t: ['Clients', 'Customers'], c: 0, r: 1, s: 'a', w: 86, sz: 10.5 },
        { id: 'o', t: ['Commandes', 'Orders'], c: 1, r: 1, s: 'v', w: 92, sz: 10.5 },
        { id: 'p', t: ['Paiement', 'Payment'], c: 2, r: 1, s: 'ok', w: 86, sz: 10.5 },
      ],
      e: [['u', 'o', '', 'a'], ['o', 'p', '', 'v']],
      g: [{ t: ['Monolithe', 'Monolith'], ids: ['m'] }, { t: 'Microservices', ids: ['u', 'o', 'p'] }],
    },

    'archi-cache': {
      k: 'sequence',
      lh: 46,
      alt: ['Un cache répond directement s’il a la donnée (hit), sinon il la demande au serveur (miss)', 'A cache answers directly if it has the data (hit), otherwise it asks the server (miss)'],
      a: ['Client', 'Cache', ['Serveur', 'Server']],
      s: ['a', 'warn', 'v'],
      m: [
        [0, 1, ['donnée A ?', 'data A?']],
        [1, 0, ['oui (hit) : immédiat', 'yes (hit): instant'], 'ok dash'],
        [0, 1, ['donnée B ?', 'data B?']],
        [1, 2, ['non (miss) : demande', 'no (miss): asks']],
        [2, 1, ['donnée B', 'data B'], 'dash'],
        [1, 0, ['B + copie gardée', 'B + copy kept'], 'ok dash'],
      ],
    },

    'archi-load-balancer': {
      k: 'graphe',
      alt: ['Un répartiteur de charge distribue les requêtes entre plusieurs serveurs et évite celui qui est en panne', 'A load balancer spreads requests over several servers and avoids the one that is down'],
      gy: 64,
      n: [
        { id: 'v', t: ['Visiteurs', 'Visitors'], c: 0, r: 1, f: 'cloud', s: 'info', w: 88, h: 50 },
        { id: 'l', t: ['Répartiteur', 'Load\nbalancer'], c: 1, r: 1, s: 'v', w: 92, sz: 11 },
        { id: 'a', t: ['Serveur 1', 'Server 1'], c: 2, r: 0, s: 'ok', w: 86, sz: 11 },
        { id: 'b', t: ['Serveur 2', 'Server 2'], sub: ['en panne', 'down'], c: 2, r: 1, s: 'bad', w: 86, h: 48, sz: 11 },
        { id: 'c', t: ['Serveur 3', 'Server 3'], c: 2, r: 2, s: 'ok', w: 86, sz: 11 },
      ],
      e: [['v', 'l', '', 'info'], ['l', 'a', '', 'ok'], ['l', 'b', '✗', 'bad dash'], ['l', 'c', '', 'ok']],
    },

    'archi-queue': {
      k: 'graphe',
      alt: ['Une file de messages relie des producteurs à des consommateurs qui traitent à leur rythme', 'A message queue links producers to consumers that process at their own pace'],
      gy: 66,
      n: [
        { id: 'p1', t: ['Producteur A', 'Producer A'], c: 0, r: 0, s: 'a', w: 92, sz: 11 },
        { id: 'p2', t: ['Producteur B', 'Producer B'], c: 0, r: 1, s: 'a', w: 92, sz: 11 },
        { id: 'q', t: ['File de\nmessages', 'Message\nqueue'], c: 1, r: 0.5, f: 'db', s: 'warn', w: 92, h: 60, sz: 11 },
        { id: 'c1', t: ['Consommateur 1', 'Consumer 1'], c: 2, r: 0, s: 'ok', w: 100, sz: 10.5 },
        { id: 'c2', t: ['Consommateur 2', 'Consumer 2'], c: 2, r: 1, s: 'ok', w: 100, sz: 10.5 },
      ],
      e: [['p1', 'q', '', 'a'], ['p2', 'q', '', 'a'], ['q', 'c1', '', 'ok'], ['q', 'c2', '', 'ok']],
    },

    'archi-webhook': {
      k: 'sequence',
      lh: 46,
      alt: ['Un webhook : le service appelle votre adresse quand un événement survient', 'A webhook: the service calls your address when an event occurs'],
      a: [['Service\n(GitHub…)', 'Service\n(GitHub…)'], ['Votre\napplication', 'Your\napp']],
      s: ['v', 'a'],
      m: [
        [1, 0, ['enregistre l’adresse du webhook (une fois)', 'registers the webhook address (once)'], 'mute'],
        [0, 0, ['un événement survient (push)', 'an event occurs (push)'], 'warn'],
        [0, 1, 'POST /webhook + signature', 'a'],
        [1, 1, ['vérifie la signature', 'verifies the signature'], 'mute'],
        [1, 0, '200 OK', 'ok dash'],
      ],
    },

    'archi-observer': {
      k: 'graphe',
      alt: ['Un sujet prévient automatiquement tous ses observateurs quand il change', 'A subject automatically notifies all its observers when it changes'],
      gy: 64,
      n: [
        { id: 's', t: ['Sujet', 'Subject'], sub: ['change', 'changes'], c: 0, r: 1, s: 'v', w: 96, h: 48 },
        { id: 'a', t: ['Observateur A', 'Observer A'], c: 1, r: 0, s: 'ok', w: 112, sz: 11 },
        { id: 'b', t: ['Observateur B', 'Observer B'], c: 1, r: 1, s: 'ok', w: 112, sz: 11 },
        { id: 'c', t: ['Observateur C', 'Observer C'], c: 1, r: 2, s: 'ok', w: 112, sz: 11 },
      ],
      e: [['s', 'a', ['notifie', 'notifies'], 'ok'], ['s', 'b', '', 'ok'], ['s', 'c', '', 'ok']],
    },

    'archi-etats': {
      k: 'graphe',
      alt: ['Une machine à états : une commande passe de créée à payée, expédiée puis livrée, ou est annulée', 'A state machine: an order goes from created to paid, shipped then delivered, or is cancelled'],
      gy: 78,
      n: [
        { id: 'c', t: ['créée', 'created'], c: 0, r: 0, s: 'a', w: 76, f: 'pill' },
        { id: 'p', t: ['payée', 'paid'], c: 1, r: 0, s: 'a', w: 76, f: 'pill' },
        { id: 'e', t: ['expédiée', 'shipped'], c: 2, r: 0, s: 'a', w: 82, f: 'pill' },
        { id: 'l', t: ['livrée', 'delivered'], c: 2, r: 1, s: 'ok', w: 82, f: 'pill' },
        { id: 'x', t: ['annulée', 'cancelled'], c: 0.5, r: 1, s: 'bad', w: 92, f: 'pill' },
      ],
      e: [['c', 'p', ['payer', 'pay'], 'a'], ['p', 'e', ['expédier', 'ship'], 'a'], ['e', 'l', ['livrer', 'deliver'], 'ok'], ['c', 'x', '', 'bad dash'], ['p', 'x', '', 'bad dash']],
    },

  });
})(window);
