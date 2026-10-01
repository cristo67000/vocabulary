'use strict';
/*
 * Stockage local — IndexedDB.
 *
 * Rien ne sort de l'appareil : pas de compte, pas de serveur, pas de mesure
 * d'audience. Le dictionnaire lui-même n'est pas ici — il est dans le cache du
 * service worker, en fichiers ; ici ne vit que ce qui appartient à la personne
 * qui apprend.
 *
 * Sept magasins :
 *   reglages      langue de l'interface, voix, quotas — une ligne par réglage
 *   cartes        une carte de révision : quel mot, dans quel sens, quand revoir
 *   journal       une ligne par réponse donnée, pour les statistiques
 *   historique    les mots récemment consultés
 *   notes         une note personnelle (et ses exemples) attachée à un mot
 *   perso         les mots et expressions qu'on a ajoutés soi-même
 *   conversation  les phrases et les dialogues qu'on a écrits soi-même
 *
 * Le journal est volontairement séparé des cartes : une carte dit l'état
 * présent, le journal dit ce qui s'est passé. Sans lui, impossible de montrer
 * un progrès dans le temps.
 *
 * ── Notes et mots personnels : deux magasins, pas un champ ────────────────
 *
 * Une note n'est pas une propriété du dictionnaire, et un mot personnel n'en
 * fait pas partie. Les mêler aux données livrées les ferait disparaître au
 * premier changement de paquet. Ils vivent donc à part, désignés par une
 * référence :
 *
 *   dico:en house    une entrée du dictionnaire, par sa langue et sa vedette
 *   mod:tech:llm     une fiche d'un module (argot, technique, expressions…)
 *   perso:p-1a2b3c   un mot à soi, par son identifiant stable
 *   conv:ph-…        une phrase ou une réplique de « Phrases et dialogues »
 *
 * La base naît directement à son schéma final : Vocabulary descend de
 * Wortschatz, mais n'a jamais eu de version antérieure à migrer.
 */
(function (racine) {

  const NOM = 'vocabulary';
  const VERSION = 1;
  let bd = null;

  // Le séparateur des identifiants de cartes : un caractère nul, qui ne figure
  // dans aucune vedette. Écrit par son code — un NUL littéral se perd au
  // premier outil qui nettoie les signes de commande.
  const NUL = String.fromCharCode(0);

  function ouvrir() {
    if (bd) return Promise.resolve(bd);
    return new Promise((resoudre, rejeter) => {
      const demande = indexedDB.open(NOM, VERSION);
      demande.onupgradeneeded = (e) => {
        const base = e.target.result;
        if (!base.objectStoreNames.contains('reglages')) {
          base.createObjectStore('reglages', { keyPath: 'cle' });
        }
        if (!base.objectStoreNames.contains('cartes')) {
          const magasin = base.createObjectStore('cartes', { keyPath: 'id' });
          magasin.createIndex('echeance', 'echeance', { unique: false });
          magasin.createIndex('mot', 'mot', { unique: false });
          magasin.createIndex('etat', 'etat', { unique: false });
          magasin.createIndex('perso', 'perso', { unique: false });
          magasin.createIndex('conversation', 'conversation', { unique: false });
          magasin.createIndex('module', 'module', { unique: false });
        }
        if (!base.objectStoreNames.contains('journal')) {
          const magasin = base.createObjectStore('journal',
            { keyPath: 'id', autoIncrement: true });
          magasin.createIndex('quand', 'quand', { unique: false });
        }
        if (!base.objectStoreNames.contains('historique')) {
          const magasin = base.createObjectStore('historique', { keyPath: 'id' });
          magasin.createIndex('quand', 'quand', { unique: false });
        }
        if (!base.objectStoreNames.contains('notes')) {
          const magasin = base.createObjectStore('notes', { keyPath: 'id' });
          magasin.createIndex('modifie', 'modifie', { unique: false });
        }
        if (!base.objectStoreNames.contains('perso')) {
          const magasin = base.createObjectStore('perso', { keyPath: 'id' });
          magasin.createIndex('cle', 'cle', { unique: false });
          magasin.createIndex('langue', 'langue', { unique: false });
          magasin.createIndex('cree', 'cree', { unique: false });
        }
        if (!base.objectStoreNames.contains('conversation')) {
          const magasin = base.createObjectStore('conversation', { keyPath: 'id' });
          magasin.createIndex('sorte', 'sorte', { unique: false });
          magasin.createIndex('modifie', 'modifie', { unique: false });
        }
      };
      demande.onsuccess = () => {
        bd = demande.result;
        /* Un autre onglet qui demanderait une version supérieure resterait
         * bloqué tant que celui-ci garde la base ouverte. */
        bd.onversionchange = () => { bd.close(); bd = null; };
        resoudre(bd);
      };
      demande.onerror = () => rejeter(demande.error);
    });
  }

  function transaction(magasins, mode) {
    return ouvrir().then((base) => base.transaction(magasins, mode));
  }

  function promesse(requete) {
    return new Promise((resoudre, rejeter) => {
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error);
    });
  }

  // ── Réglages ──────────────────────────────────────────────────────────────

  const DEFAUTS = {
    langue: null,            // null = suivre le navigateur au premier lancement
    voix: true,
    voixEn: null,            // { uri, nom } d'une voix préférée, ou rien : automatique
    voixFr: null,
    paquet: 'noyau',
    toutHorsLigne: true,     // télécharger le dictionnaire complet d'office
    nouveautesParJour: 10,
    sensDeTravail: 'les-deux', // 'les-deux' | 'vers-en' | 'vers-fr'
    montrerCrus: false,      // les mots vulgaires et injurieux restent masqués
    montrerUs: true,         // afficher la variante américaine des mots anglais
  };

  async function lireReglages() {
    const t = await transaction(['reglages'], 'readonly');
    const lignes = await promesse(t.objectStore('reglages').getAll());
    const valeurs = Object.assign({}, DEFAUTS);
    for (const ligne of lignes) valeurs[ligne.cle] = ligne.valeur;
    return valeurs;
  }

  async function ecrireReglage(cle, valeur) {
    const t = await transaction(['reglages'], 'readwrite');
    await promesse(t.objectStore('reglages').put({ cle, valeur }));
    return valeur;
  }

  // ── Cartes de révision ────────────────────────────────────────────────────

  /* Le séparateur est un caractère nul : une vedette peut contenir des
   * espaces — « give up », « avoir lieu » — et un identifiant séparé par des
   * espaces deviendrait ambigu. */
  function identifiant(langue, mot, type) {
    return langue + NUL + mot + NUL + type;
  }

  /* L'identifiant d'une carte de mot personnel : il ne contient pas la
   * graphie, pour que corriger l'orthographe ne fabrique pas une carte neuve. */
  function identifiantPerso(uid, type) {
    return 'perso:' + uid + NUL + type;
  }

  function identifiantConversation(id, type) {
    return 'conv:' + id + NUL + type;
  }

  /* Une fiche de module (un terme d'argot, d'IA, une expression imagée…) qui
   * n'a pas d'entrée au dictionnaire : elle a ses cartes à elle, sous son
   * identifiant de module. */
  function identifiantModule(id, type) {
    return 'mod:' + id + NUL + type;
  }

  async function lireCarte(id) {
    const t = await transaction(['cartes'], 'readonly');
    return promesse(t.objectStore('cartes').get(id));
  }

  async function cartesDuMot(langue, mot, perso) {
    const t = await transaction(['cartes'], 'readonly');
    const magasin = t.objectStore('cartes');
    if (perso) return promesse(magasin.index('perso').getAll(perso));
    const toutes = await promesse(magasin.index('mot').getAll(mot));
    return toutes.filter((c) => c.langue === langue && !c.perso && !c.conversation && !c.module);
  }

  async function cartesDeConversation(id) {
    const t = await transaction(['cartes'], 'readonly');
    return promesse(t.objectStore('cartes').index('conversation').getAll(id));
  }

  async function cartesDeModule(id) {
    const t = await transaction(['cartes'], 'readonly');
    return promesse(t.objectStore('cartes').index('module').getAll(id));
  }

  async function ecrireCarte(carte) {
    const t = await transaction(['cartes'], 'readwrite');
    await promesse(t.objectStore('cartes').put(carte));
    return carte;
  }

  async function supprimerCarte(id) {
    const t = await transaction(['cartes'], 'readwrite');
    return promesse(t.objectStore('cartes').delete(id));
  }

  async function toutesLesCartes() {
    const t = await transaction(['cartes'], 'readonly');
    return promesse(t.objectStore('cartes').getAll());
  }

  async function cartesDues(quand) {
    const t = await transaction(['cartes'], 'readonly');
    const borne = IDBKeyRange.upperBound(quand);
    return promesse(t.objectStore('cartes').index('echeance').getAll(borne));
  }

  // ── Journal ───────────────────────────────────────────────────────────────

  async function noter(ligne) {
    const t = await transaction(['journal'], 'readwrite');
    return promesse(t.objectStore('journal').add(ligne));
  }

  async function journalDepuis(quand) {
    const t = await transaction(['journal'], 'readonly');
    const borne = IDBKeyRange.lowerBound(quand);
    return promesse(t.objectStore('journal').index('quand').getAll(borne));
  }

  // ── Historique de consultation ────────────────────────────────────────────

  const HISTORIQUE_MAX = 80;

  /* `module` : l'identifiant d'une fiche de module, quand c'est elle qu'on a
   * ouverte et non une entrée du dictionnaire. */
  async function consulter(langue, mot, module) {
    const t = await transaction(['historique'], 'readwrite');
    const magasin = t.objectStore('historique');
    const id = module ? 'mod:' + module : langue + ' ' + mot;
    const ligne = { id, langue, mot, quand: Date.now() };
    if (module) ligne.module = module;
    await promesse(magasin.put(ligne));
    const tout = await promesse(magasin.index('quand').getAll());
    for (const vieux of tout.slice(0, Math.max(0, tout.length - HISTORIQUE_MAX))) {
      magasin.delete(vieux.id);
    }
  }

  async function historique() {
    const t = await transaction(['historique'], 'readonly');
    const tout = await promesse(t.objectStore('historique').index('quand').getAll());
    return tout.reverse();
  }

  async function effacerHistorique() {
    const t = await transaction(['historique'], 'readwrite');
    return promesse(t.objectStore('historique').clear());
  }

  // ── Notes personnelles ────────────────────────────────────────────────────

  async function lireNote(id) {
    const t = await transaction(['notes'], 'readonly');
    return promesse(t.objectStore('notes').get(id));
  }

  async function ecrireNote(note) {
    const t = await transaction(['notes'], 'readwrite');
    await promesse(t.objectStore('notes').put(note));
    return note;
  }

  async function supprimerNote(id) {
    const t = await transaction(['notes'], 'readwrite');
    return promesse(t.objectStore('notes').delete(id));
  }

  async function toutesLesNotes() {
    const t = await transaction(['notes'], 'readonly');
    return promesse(t.objectStore('notes').getAll());
  }

  // ── Mots personnels ───────────────────────────────────────────────────────

  async function lireMotPerso(id) {
    const t = await transaction(['perso'], 'readonly');
    return promesse(t.objectStore('perso').get(id));
  }

  async function ecrireMotPerso(mot) {
    const t = await transaction(['perso'], 'readwrite');
    await promesse(t.objectStore('perso').put(mot));
    return mot;
  }

  async function supprimerMotPerso(id) {
    const t = await transaction(['perso'], 'readwrite');
    return promesse(t.objectStore('perso').delete(id));
  }

  async function tousLesMotsPerso() {
    const t = await transaction(['perso'], 'readonly');
    return promesse(t.objectStore('perso').getAll());
  }

  // ── Phrases et dialogues personnels ───────────────────────────────────────

  async function lireConversation(id) {
    const t = await transaction(['conversation'], 'readonly');
    return promesse(t.objectStore('conversation').get(id));
  }

  async function ecrireConversation(enregistrement) {
    const t = await transaction(['conversation'], 'readwrite');
    await promesse(t.objectStore('conversation').put(enregistrement));
    return enregistrement;
  }

  async function supprimerConversation(id) {
    const t = await transaction(['conversation'], 'readwrite');
    return promesse(t.objectStore('conversation').delete(id));
  }

  async function touteLaConversation() {
    const t = await transaction(['conversation'], 'readonly');
    return promesse(t.objectStore('conversation').getAll());
  }

  racine.Store = {
    ouvrir,
    DEFAUTS,
    NUL,
    lireReglages, ecrireReglage,
    identifiant, identifiantPerso, identifiantConversation, identifiantModule,
    lireCarte, cartesDuMot, cartesDeConversation, cartesDeModule, ecrireCarte, supprimerCarte,
    toutesLesCartes, cartesDues,
    noter, journalDepuis,
    consulter, historique, effacerHistorique,
    lireNote, ecrireNote, supprimerNote, toutesLesNotes,
    lireMotPerso, ecrireMotPerso, supprimerMotPerso, tousLesMotsPerso,
    lireConversation, ecrireConversation, supprimerConversation, touteLaConversation,
  };

})(window);
