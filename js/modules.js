'use strict';
/*
 * Les modules : les mots d'aujourd'hui, l'argot et les abréviations, la
 * technique (IA, programmation, codage), les expressions et les phrases.
 *
 * ── Ce qu'est un module ─────────────────────────────────────────────────────
 *
 * Le dictionnaire répond à « que veut dire ce mot ? ». Un module répond à
 * « quels mots faut-il savoir ? » : une sélection rangée par thèmes, écrite
 * pour apprendre — définitions claires dans les deux langues, registre, piège
 * à éviter, exemple traduit, schéma quand un dessin explique mieux qu'une
 * phrase. Le contenu vient de `data/modules.json`, construit par
 * `build/modules.py` à partir de trois sources : les fiches rédigées pour
 * l'application (argot, mots d'aujourd'hui, expressions, faux amis, IA), le
 * glossaire de Code en clair (399 termes et leurs schémas), et FranceTerme,
 * les termes recommandés au Journal officiel.
 *
 * ── Une fiche de module et une entrée du dictionnaire ──────────────────────
 *
 * Une fiche de module porte une vedette et sa langue. Quand le dictionnaire
 * connaît ce mot, les deux ne font qu'un : la fiche du dictionnaire s'ouvre, et
 * le module y ajoute son bloc en tête (`blocPourFiche`) ; les cartes de
 * révision sont celles du mot. Quand il ne le connaît pas — « tbh », « prompt
 * injection » —, la fiche de module devient une entrée à part entière
 * (`entree`), avec ses cartes à elle (`mod:<id>`).
 *
 * ── Les mots crus ───────────────────────────────────────────────────────────
 *
 * Une fiche marquée `cru` (vulgaire, injurieuse) n'apparaît ni dans les listes
 * ni dans la recherche tant que le réglage « Afficher les mots crus » est
 * coupé — c'est le cas d'office.
 */
(function (racine) {

  const $ = (selecteur) => document.querySelector(selecteur);

  const etat = {
    donnees: null,          // le contenu de data/modules.json
    items: new Map(),       // id → fiche
    parCle: { en: new Map(), fr: new Map() },   // clé de vedette → [id]
    recherche: [],          // [clé, id, graphie] pour les recherches par préfixe
    vue: null,              // { module, theme } affiché
  };

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  /* Un texte bilingue { fr, en } dans la langue voulue, ou l'autre à défaut. */
  function texte(valeur, langue) {
    if (!valeur) return '';
    if (typeof valeur === 'string') return valeur;
    const l = langue || I18n.langue;
    return valeur[l] || valeur[l === 'fr' ? 'en' : 'fr'] || '';
  }

  function montrerCrus() {
    return !!Lexique.montrerCrus;
  }

  function visible(item) {
    return !!item && (!item.cru || montrerCrus());
  }

  /* Les équivalents des listes de vocabulaire portent leur article (« une
   * cuisine », « de l’huile ») : il dit le genre. On les trouve aussi sans
   * lui, et sans la précision entre parenthèses — « cuisine », « huile ». */
  const ARTICLE = /^(?:(?:un|une|des|le|la|les|du|de la|the|a|an|to)\s+|(?:l|d|de l)')/;

  function clesDeRecherche(graphie) {
    const k = Lexique.cle(graphie);
    if (!k) return [];
    const sortie = [k];
    const nue = k.replace(/\s*\([^)]*\)/g, '').trim();
    const sansArticle = nue.replace(ARTICLE, '').trim();
    for (const autre of [nue, sansArticle]) {
      if (autre && sortie.indexOf(autre) === -1) sortie.push(autre);
    }
    return sortie;
  }

  /* L'entrée du dictionnaire d'une fiche : sa vedette telle quelle, ou avec
   * l'apostrophe droite des dictionnaires (« o’clock » → « o'clock »). */
  function vedetteDe(it) {
    const v = Lexique.vedette(it.l, it.w);
    if (v || !/[’‘]/.test(it.w)) return v;
    return Lexique.vedette(it.l, it.w.replace(/[’‘]/g, "'"));
  }

  // ── Chargement ────────────────────────────────────────────────────────────

  async function charger() {
    try {
      const reponse = await fetch('data/modules.json');
      if (!reponse.ok) throw new Error(String(reponse.status));
      const donnees = await reponse.json();
      etat.donnees = donnees;
      for (const item of donnees.items || []) {
        etat.items.set(item.id, item);
        const k = Lexique.cle(item.w);
        const table = etat.parCle[item.l];
        if (table) {
          if (!table.has(k)) table.set(k, []);
          table.get(k).push(item.id);
        }
        const graphies = [item.w].concat(item.tr || [], item.al || []);
        for (const g of graphies) {
          for (const cleG of clesDeRecherche(g)) etat.recherche.push([cleG, item.id, g]);
        }
      }
      etat.recherche.sort((a, b) => (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)));
    } catch (erreur) {
      /* Sans le contenu des modules, le dictionnaire reste entier : l'onglet
       * le dit, rien d'autre ne casse. */
      etat.donnees = { modules: [], items: [] };
    }
    return etat.donnees;
  }

  function modules() {
    return (etat.donnees && etat.donnees.modules) || [];
  }

  function module(id) {
    return modules().find((m) => m.id === id) || null;
  }

  function item(id) {
    return etat.items.get(id) || null;
  }

  function nomCourt(idItem) {
    const it = item(idItem);
    const m = it ? module(it.m) : null;
    return m ? texte(m.court || m.nom) : '';
  }

  // ── Recherche ─────────────────────────────────────────────────────────────

  /* Le résultat de recherche d'une fiche : celui du dictionnaire quand il la
   * connaît (on n'affiche pas deux lignes pour un même mot), sinon une ligne
   * de module. */
  function resultatDe(it, exact, via) {
    const v = vedetteDe(it);
    const apercu = (it.tr || []).slice(0, 3).join(', ');
    if (v) {
      v.exact = exact;
      v.via = via || null;
      v.moduleItem = it.id;
      if (!v.apercu || it.src === 'claude') v.apercu = apercu;
      return v;
    }
    return {
      langue: it.l, mot: it.w, cle: Lexique.cle(it.w), tranche: -1, bande: 0,
      apercu, exact, via: via || null, module: it.id, moduleItem: it.id,
      expression: /\s/.test(it.w) && it.m === 'expressions',
    };
  }

  /* Les fiches atteintes par une saisie : par leur vedette, leurs traductions
   * ou leurs alias (« LLM » → grand modèle de langage). Recherche par préfixe
   * de clé, dans une liste triée : quelques milliers de lignes, une
   * dichotomie. */
  function chercher(saisie, plafond) {
    const k = Lexique.cle(saisie);
    if (!k || !etat.recherche.length) return [];
    const liste = etat.recherche;
    let bas = 0;
    let haut = liste.length;
    while (bas < haut) {
      const milieu = (bas + haut) >> 1;
      if (liste[milieu][0] < k) bas = milieu + 1;
      else haut = milieu;
    }
    const vus = new Set();
    const sortie = [];
    for (let i = bas; i < liste.length && sortie.length < (plafond || 12); i += 1) {
      const [cleG, id, graphie] = liste[i];
      if (!cleG.startsWith(k)) break;
      if (vus.has(id)) continue;
      vus.add(id);
      const it = item(id);
      if (!visible(it)) continue;
      const surVedette = Lexique.cle(it.w) === cleG;
      sortie.push(resultatDe(it, cleG === k && surVedette, surVedette ? null : graphie));
    }
    return sortie;
  }

  // ── L'entrée d'une fiche de module ────────────────────────────────────────

  /* Les exemples d'une fiche, en paires { en, fr } comme celles de Tatoeba. */
  function pairesDe(it) {
    const sortie = [];
    for (const sens of it.s || []) {
      for (const x of sens.x || []) {
        if (x && (x[0] || x[1])) sortie.push({ en: x[0] || '', fr: x[1] || '' });
      }
    }
    return sortie;
  }

  /* Une fiche de module sans entrée au dictionnaire, au format des entrées :
   * c'est ce qui permet à la fiche, aux exercices et à la révision de la
   * traiter comme n'importe quel mot. La définition n'est pas recopiée dans
   * le sens — le bloc du module la montre, dans les deux langues. */
  function entree(id) {
    const it = item(id);
    if (!it) return null;
    const sens = [['', (it.tr || []).slice(), [], [], (it.mq || []).slice()]];
    const lecture = [it.nat || '', it.g || '', it.api || '', [], sens, [], []];
    return {
      mot: it.w,
      langue: it.l,
      bande: 0,
      lectures: [lecture],
      tranche: -1,
      phrases: [],
      voisins: [],
      paires: pairesDe(it),
      module: id,
      expression: it.m === 'expressions' && /\s/.test(it.w) ? 'module' : undefined,
      cru: !!it.cru,
    };
  }

  /* Les fiches d'un mot du dictionnaire : celles dont la vedette est ce mot,
   * dans cette langue. */
  function itemsPour(entreeDico) {
    if (entreeDico.module) return [item(entreeDico.module)].filter(Boolean);
    const table = etat.parCle[entreeDico.langue];
    if (!table) return [];
    const ids = table.get(Lexique.cle(entreeDico.mot)) || [];
    /* Même clé ne veut pas dire même mot : « May » (le mois) n'a rien à faire
     * sur la fiche de « may » (le verbe). Une fiche va à sa vedette exacte, ou
     * à celle de même clé quand le dictionnaire ne connaît pas sa graphie. */
    const mot = entreeDico.mot;
    return ids.map(item).filter(visible).filter((it) => it.w === mot
      || it.w.replace(/[’‘]/g, "'") === mot || !vedetteDe(it));
  }

  // ── Le bloc de fiche ──────────────────────────────────────────────────────

  function boutonEcoute(texteALire, langue) {
    const bouton = element('button', 'ecouter-phrase', '▸');
    bouton.type = 'button';
    bouton.setAttribute('aria-label', I18n.t('fiche.ecouter'));
    Voix.brancherBouton(bouton, langue);
    bouton.addEventListener('click', () => Voix.dire(texteALire, langue));
    return bouton;
  }

  /* Les deux définitions, la langue de l'interface d'abord : on lit dans sa
   * langue, puis dans celle qu'on apprend. */
  function definitions(sens) {
    const bloc = element('div', 'module-definitions');
    const premiere = I18n.langue;
    const seconde = premiere === 'fr' ? 'en' : 'fr';
    for (const langue of [premiere, seconde]) {
      const valeur = sens.d && sens.d[langue];
      if (!valeur) continue;
      const p = element('p', 'module-definition');
      p.appendChild(element('span', 'pastille', I18n.t('langue.' + langue + '.court')));
      p.appendChild(document.createTextNode(' '));
      p.appendChild(MotsVifs.tisser(valeur, langue, {}));
      bloc.appendChild(p);
    }
    return bloc;
  }

  function paragrapheBilingue(valeur, classe, titre) {
    const t = texte(valeur);
    if (!t) return null;
    const p = element('p', classe);
    if (titre) p.appendChild(element('b', null, titre + ' '));
    p.appendChild(document.createTextNode(t));
    return p;
  }

  function exemples(sens) {
    const liste = (sens.x || []).filter((x) => x && (x[0] || x[1]));
    if (!liste.length) return null;
    const bloc = element('div', 'module-exemples');
    for (const [en, fr] of liste) {
      const ex = element('div', 'exemple');
      if (en) {
        const source = element('p', 'exemple-source');
        source.appendChild(MotsVifs.tisser(en, 'en', {}));
        source.appendChild(boutonEcoute(en, 'en'));
        ex.appendChild(source);
      }
      if (fr) {
        const cible = element('p', 'exemple-cible');
        cible.appendChild(MotsVifs.tisser(fr, 'fr', {}));
        cible.appendChild(boutonEcoute(fr, 'fr'));
        ex.appendChild(cible);
      }
      bloc.appendChild(ex);
    }
    return bloc;
  }

  function exempleDeCode(ex) {
    if (!ex || !ex.c) return null;
    const bloc = element('div', 'module-code');
    const pre = element('pre');
    pre.appendChild(element('code', null, ex.c));
    bloc.appendChild(pre);
    const legende = texte({ fr: ex.f, en: ex.e });
    if (legende) bloc.appendChild(element('p', 'discret', legende));
    return bloc;
  }

  function dessin(idSchema) {
    if (!idSchema || !racine.Schema || !racine.Schemas || !Schemas[idSchema]) return null;
    const spec = Schemas[idSchema];
    const figure = element('figure', 'schema');
    try {
      figure.appendChild(Schema.dessiner(spec, I18n.langue));
    } catch (erreur) {
      return null;
    }
    const titre = Schema.titre(spec, I18n.langue);
    const legende = Schema.legende(spec, I18n.langue);
    if (titre || legende) {
      figure.appendChild(element('figcaption', null, [titre, legende].filter(Boolean).join(' — ')));
    }
    return figure;
  }

  function voirAussi(it) {
    const ids = (it.v || []).filter((id) => visible(item(id)));
    if (!ids.length) return null;
    const bloc = element('div', 'module-voir');
    bloc.appendChild(element('b', null, I18n.t('module.voir') + ' '));
    for (const id of ids) {
      const autre = item(id);
      const bouton = element('button', 'voisin', autre.w);
      bouton.type = 'button';
      bouton.addEventListener('click', () => ouvrirItem(id));
      bloc.appendChild(bouton);
    }
    return bloc;
  }

  function provenance(it) {
    const cle = 'module.source.' + (it.src || 'claude');
    const p = element('p', 'discret module-source', I18n.t(cle, { date: it.date || '' }));
    return p;
  }

  function blocDeItem(it, dansLeDictionnaire) {
    const bloc = element('section', 'module-bloc module-' + it.m);
    const m = module(it.m);
    const tete = element('div', 'module-bloc-tete');
    if (m) {
      const badge = element('button', 'module-badge', (m.icone ? m.icone + ' ' : '') + texte(m.court || m.nom));
      badge.type = 'button';
      badge.addEventListener('click', () => { App.fermerFiche(); ouvrirModule(m.id, it.t); });
      tete.appendChild(badge);
      const theme = (m.themes || []).find((t) => t.id === it.t);
      if (theme) tete.appendChild(element('span', 'module-theme', texte(theme.nom)));
    }
    if (racine.Fiche) {
      const pastilles = Fiche.pastillesDeMarques(it.mq);
      if (pastilles) tete.appendChild(pastilles);
    }
    bloc.appendChild(tete);

    /* La vedette d'un terme technique a deux noms, et parfois un
     * développement : « LLM — grand modèle de langage — Large Language
     * Model ». La fiche du dictionnaire montre déjà la vedette ; ici on
     * donne les équivalents du module, qui sont ce qu'on retient. */
    if (it.tr && it.tr.length) {
      const ligne = element('p', 'traductions module-equivalents');
      for (const t of it.tr) ligne.appendChild(element('span', 'traduction', t));
      if (it.dev) ligne.appendChild(element('span', 'module-dev', it.dev));
      bloc.appendChild(ligne);
    }

    for (const sens of it.s || []) {
      const s = element('div', 'module-sens');
      if (sens.lib) s.appendChild(element('p', 'module-sens-titre', texte(sens.lib)));
      s.appendChild(definitions(sens));
      const litteral = paragrapheBilingue(sens.lit, 'module-litteral', I18n.t('module.litteral'));
      if (litteral) s.appendChild(litteral);
      const note = paragrapheBilingue(sens.n, 'module-note');
      if (note) s.appendChild(note);
      const piege = paragrapheBilingue(sens.a, 'module-attention', '⚠');
      if (piege) s.appendChild(piege);
      const ex = exemples(sens);
      if (ex) s.appendChild(ex);
      const code = exempleDeCode(sens.ex);
      if (code) s.appendChild(code);
      const figure = dessin(sens.sc);
      if (figure) s.appendChild(figure);
      bloc.appendChild(s);
    }
    const voir = voirAussi(it);
    if (voir) bloc.appendChild(voir);
    bloc.appendChild(provenance(it));
    if (!dansLeDictionnaire && !it.api && it.l === 'en') {
      // Rien à ajouter : la voix lit la vedette depuis la ligne de son.
    }
    return bloc;
  }

  function blocPourFiche(entreeDico) {
    const liste = itemsPour(entreeDico);
    if (!liste.length) return null;
    const fragment = document.createDocumentFragment();
    for (const it of liste) fragment.appendChild(blocDeItem(it, !entreeDico.module));
    return fragment;
  }

  /* Ouvre une fiche de module : par le dictionnaire s'il connaît le mot,
   * sinon comme entrée à part. */
  function ouvrirItem(id) {
    const it = item(id);
    if (!it) return;
    App.ouvrirFiche(resultatDe(it, true, null));
  }

  // ── Les écrans ────────────────────────────────────────────────────────────

  function itemsDu(module_, theme) {
    return (etat.donnees.items || []).filter((it) => it.m === module_
      && (!theme || it.t === theme) && visible(it));
  }

  function ligneDItem(it) {
    const li = element('li');
    const bouton = element('button', 'resultat');
    bouton.type = 'button';
    bouton.appendChild(element('span', 'pastille', I18n.t('langue.' + it.l + '.court')));
    bouton.appendChild(element('span', 'mot', it.w));
    if (racine.Fiche) {
      const pastilles = Fiche.pastillesDeMarques((it.mq || []).filter((m) => m !== 'gb' && m !== 'us'));
      if (pastilles) bouton.appendChild(pastilles);
    }
    bouton.appendChild(element('span', 'traduction', (it.tr || []).slice(0, 2).join(', ')));
    bouton.addEventListener('click', () => ouvrirItem(it.id));
    li.appendChild(bouton);
    return li;
  }

  /* Les entrées à exercer pour une liste de fiches : celles du dictionnaire
   * quand il les connaît, sinon les fiches elles-mêmes. */
  async function entreesPour(liste) {
    const sortie = [];
    for (const it of liste) {
      const v = vedetteDe(it);
      const e = v ? await Lexique.ouvrir(v).catch(() => null) : entree(it.id);
      if (e) sortie.push(e);
    }
    return sortie;
  }

  function hote() {
    return $('#modules-contenu');
  }

  function titreEtRetour(titre, retour) {
    const tete = element('div', 'module-tete');
    if (retour) {
      const bouton = element('button', 'lien-discret module-retour', '← ' + I18n.t('module.retour'));
      bouton.type = 'button';
      bouton.addEventListener('click', retour);
      tete.appendChild(bouton);
    }
    tete.appendChild(element('h2', null, titre));
    return tete;
  }

  function dessinerAccueil() {
    const zone = hote();
    if (!zone) return;
    etat.vue = null;
    zone.textContent = '';
    zone.appendChild(element('h2', null, I18n.t('modules.titre')));
    zone.appendChild(element('p', 'discret', I18n.t('modules.intro')));
    const grille = element('div', 'tuiles');
    for (const m of modules()) {
      grille.appendChild(tuile(m.icone, texte(m.nom), texte(m.accroche),
        I18n.n('modules.fiches', itemsDu(m.id).length), () => ouvrirModule(m.id)));
    }
    if (racine.Situations && racine.Conversation) {
      grille.appendChild(tuile('💬', I18n.t('conv.titre'), I18n.t('modules.conversation.accroche'),
        '', () => App.basculer('conversation')));
    }
    grille.appendChild(tuile('⇄', I18n.t('modules.irreguliers'), I18n.t('modules.irreguliers.accroche'),
      '', dessinerIrreguliers));
    grille.appendChild(tuile('◫', I18n.t('modules.schemas'), I18n.t('modules.schemas.accroche'),
      '', dessinerSchemas));
    zone.appendChild(grille);
  }

  function tuile(icone, titre, accroche, compte, action) {
    const bouton = element('button', 'tuile');
    bouton.type = 'button';
    bouton.appendChild(element('span', 'tuile-icone', icone || '•'));
    bouton.appendChild(element('span', 'tuile-titre', titre));
    if (accroche) bouton.appendChild(element('span', 'tuile-accroche', accroche));
    if (compte) bouton.appendChild(element('span', 'tuile-compte', compte));
    bouton.addEventListener('click', action);
    return bouton;
  }

  function ouvrirModule(id, theme) {
    if (racine.App && App.basculer) App.basculer('modules', { garder: true });
    const m = module(id);
    const zone = hote();
    if (!m || !zone) return;
    etat.vue = { module: id, theme: theme || null };
    zone.textContent = '';
    zone.appendChild(titreEtRetour((m.icone ? m.icone + ' ' : '') + texte(m.nom), dessinerAccueil));
    if (m.intro) zone.appendChild(element('p', 'discret', texte(m.intro)));
    if (m.id === 'argot' && !montrerCrus()) {
      zone.appendChild(element('p', 'discret module-crus', I18n.t('module.crus-masques')));
    }

    const puces = element('div', 'puces');
    const tous = element('button', 'puce', I18n.t('module.tous'));
    tous.type = 'button';
    tous.setAttribute('aria-pressed', String(!theme));
    tous.addEventListener('click', () => ouvrirModule(id, null));
    puces.appendChild(tous);
    for (const t of m.themes || []) {
      const n = itemsDu(id, t.id).length;
      if (!n) continue;
      const puce = element('button', 'puce', texte(t.nom) + ' · ' + n);
      puce.type = 'button';
      puce.setAttribute('aria-pressed', String(theme === t.id));
      puce.addEventListener('click', () => ouvrirModule(id, t.id));
      puces.appendChild(puce);
    }
    zone.appendChild(puces);

    const liste = itemsDu(id, theme);
    const actions = element('div', 'ligne-boutons module-actions');
    for (const [nom, cle] of [['reconnaitre', 'module.exercer.quiz'], ['ecrire', 'module.exercer.ecrire']]) {
      const bouton = element('button', 'bouton-discret', I18n.t(cle));
      bouton.type = 'button';
      bouton.addEventListener('click', async () => {
        bouton.disabled = true;
        const choisis = melanger(liste).slice(0, 20);
        const entrees = await entreesPour(choisis);
        const lance = await Atelier.lancerSur(nom, entrees);
        bouton.disabled = false;
        if (!lance) bouton.textContent = I18n.t('atelier.vide');
      });
      actions.appendChild(bouton);
    }
    zone.appendChild(actions);

    const ul = element('ul', 'liste-module');
    const PAGE = 60;
    let position = 0;
    const suite = () => {
      for (const it of liste.slice(position, position + PAGE)) ul.appendChild(ligneDItem(it));
      position += PAGE;
    };
    suite();
    zone.appendChild(ul);
    if (liste.length > PAGE) {
      const plus = element('button', 'lien-discret');
      plus.type = 'button';
      const libeller = () => { plus.textContent = I18n.n('module.plus', liste.length - position); };
      libeller();
      plus.addEventListener('click', () => {
        suite();
        if (position >= liste.length) plus.remove(); else libeller();
      });
      zone.appendChild(plus);
    }
    racine.scrollTo(0, 0);
  }

  function melanger(liste) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  /* Les verbes irréguliers anglais, en tableau : base, prétérit, participe,
   * traduction. Lus dans le dictionnaire — le tableau dit ce que les fiches
   * disent, rien de plus. */
  async function dessinerIrreguliers() {
    const zone = hote();
    if (!zone) return;
    etat.vue = { special: 'irreguliers' };
    zone.textContent = '';
    zone.appendChild(titreEtRetour(I18n.t('modules.irreguliers'), dessinerAccueil));
    zone.appendChild(element('p', 'discret', I18n.t('modules.irreguliers.intro')));
    const exercer = element('button', 'bouton-principal', I18n.t('modules.irreguliers.exercer'));
    exercer.type = 'button';
    zone.appendChild(exercer);
    const table = element('table', 'table-irreguliers');
    const tete = element('tr');
    for (const cle of ['base', 'passe', 'participe', 'sens']) {
      tete.appendChild(element('th', null, I18n.t('modules.irreguliers.' + cle)));
    }
    table.appendChild(tete);
    zone.appendChild(table);
    const entrees = [];
    for (const mot of Atelier.VERBES_IRREGULIERS) {
      const v = Lexique.vedette('en', mot);
      if (!v) continue;
      const e = await Lexique.ouvrir(v).catch(() => null);
      if (!e || !Exercices.estIrregulier(e)) continue;
      entrees.push(e);
      const passe = Exercices.formeFlechie(e, 'past');
      const participe = Exercices.formeFlechie(e, 'pp');
      const tr = element('tr');
      const base = element('td');
      const lien = element('button', 'lien-discret', e.mot);
      lien.type = 'button';
      lien.addEventListener('click', () => App.ouvrirFiche(v));
      base.appendChild(lien);
      tr.appendChild(base);
      tr.appendChild(element('td', null, passe ? passe.graphie : ''));
      tr.appendChild(element('td', null, participe ? participe.graphie : ''));
      tr.appendChild(element('td', 'discret', Exercices.traductions(e).slice(0, 2).join(', ')));
      table.appendChild(tr);
    }
    exercer.addEventListener('click', () => Atelier.lancerSur('irreguliers', melanger(entrees).slice(0, 20)));
  }

  /* Tous les schémas et dessins, en galerie : chacun mène à sa fiche. */
  function dessinerSchemas() {
    const zone = hote();
    if (!zone) return;
    etat.vue = { special: 'schemas' };
    zone.textContent = '';
    zone.appendChild(titreEtRetour(I18n.t('modules.schemas'), dessinerAccueil));
    zone.appendChild(element('p', 'discret', I18n.t('modules.schemas.intro')));
    const grille = element('div', 'galerie-schemas');
    const vus = new Set();
    const avecSchema = (etat.donnees.items || []).filter((it) => visible(it)
      && (it.s || []).some((s) => s.sc));
    // Les dessins d'apprentissage d'abord, les schémas techniques ensuite.
    avecSchema.sort((a, b) => (a.m === 'tech') - (b.m === 'tech'));
    for (const it of avecSchema) {
      for (const sens of it.s) {
        if (!sens.sc || vus.has(sens.sc)) continue;
        vus.add(sens.sc);
        const figure = dessin(sens.sc);
        if (!figure) continue;
        const carte = element('button', 'carte-schema');
        carte.type = 'button';
        carte.appendChild(element('span', 'carte-schema-titre', it.w
          + ((it.tr || [])[0] ? ' · ' + it.tr[0] : '')));
        carte.appendChild(figure);
        carte.addEventListener('click', () => ouvrirItem(it.id));
        grille.appendChild(carte);
      }
    }
    zone.appendChild(grille);
  }

  function dessiner() {
    if (!etat.vue) { dessinerAccueil(); return; }
    if (etat.vue.special === 'irreguliers') { dessinerIrreguliers(); return; }
    if (etat.vue.special === 'schemas') { dessinerSchemas(); return; }
    ouvrirModule(etat.vue.module, etat.vue.theme);
  }

  /* Pour l'accueil : quelques fiches au hasard, prises dans les mots
   * d'aujourd'hui et l'argot, jamais crues ni péjoratives. */
  function suggestions(combien) {
    const candidats = (etat.donnees && etat.donnees.items || []).filter((it) =>
      (it.m === 'actuel' || it.m === 'argot' || it.m === 'expressions') && it.src === 'claude'
      && !it.cru && !(it.mq || []).some((m) => m === 'pej' || m === 'vulg' || m === 'inj'));
    return melanger(candidats).slice(0, combien || 6);
  }

  racine.Modules = {
    charger, modules, module, item, nomCourt, chercher, entree, itemsPour,
    blocPourFiche, ouvrirItem, ouvrirModule, dessiner, dessinerAccueil, suggestions,
    texte, resultatDe,
    get pret() { return !!etat.donnees; },
    get vue() { return etat.vue; },
  };

})(window);
