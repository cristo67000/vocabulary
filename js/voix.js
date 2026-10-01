'use strict';
/*
 * Prononciation, par la synthèse vocale du système.
 *
 * Aucun fichier son n'est embarqué : enregistrer 100 000 mots pèserait des
 * gigaoctets, et les téléphones savent déjà lire. `speechSynthesis` utilise les
 * voix installées sur l'appareil — celles d'Android ou d'iOS — et fonctionne
 * donc **hors ligne**, à condition que la langue soit installée. Aucune requête
 * réseau n'est émise : la politique de sécurité de l'application n'autorise de
 * toute façon que sa propre origine.
 *
 * ── Jamais une voix d'une autre langue ─────────────────────────────────────
 *
 * Un texte anglais n'est lu que par une voix dont la langue est l'anglais ;
 * s'il n'y en a aucune, il n'est pas lu du tout, et l'interface le dit. Lire
 * « water » avec une voix française donnerait un mot qu'aucun Anglais ne
 * reconnaîtrait — exactement le genre d'erreur qu'un apprenant retient sans le
 * savoir. Le moteur du système, lui, peut encore tricher : sur Android, une
 * voix anglaise annoncée sans son paquet de langue installé retombe sur la
 * langue par défaut du téléphone. L'application ne peut pas le détecter ; elle
 * peut en revanche dire quelle voix elle a demandée, et laisser en choisir une
 * autre.
 *
 * ── Le choix de la voix ────────────────────────────────────────────────────
 *
 * Par défaut, la mieux placée des voix de la langue : l'accent de France et
 * celui de Grande-Bretagne d'abord, le canadien et l'américain en dernier
 * (voir `REGIONS` plus bas), et à
 * région égale une voix **locale** — elle marche sans réseau, et c'est tout
 * l'objet de l'application. Hors réseau, une voix en ligne est sautée.
 * Les Réglages permettent d'en préférer une autre, par langue, et de l'essayer
 * sur une phrase choisie pour ses sons pièges. Le choix est retenu par
 * `voiceURI` et par nom ; une voix disparue (désinstallée, autre appareil)
 * rend la main au choix automatique, et le diagnostic le signale.
 *
 * ── Les voix arrivent en retard ────────────────────────────────────────────
 *
 * Sur la plupart des navigateurs, `getVoices()` rend une liste vide au premier
 * appel et la remplit après coup, par `voiceschanged`. Un bouton ▸ dessiné
 * avant cela se croirait sans voix pour toujours : ceux qui se déclarent par
 * `brancherBouton` sont repeints à l'arrivée de la liste, et l'événement
 * `voix-changees` sur le document prévient les écrans qui affichent un état.
 *
 * Si la voix manque, on le dit une fois, calmement, et on n'y revient pas. Une
 * application qui réclame l'installation d'un module à chaque mot est vite
 * insupportable.
 */
(function (racine) {

  const disponible = typeof speechSynthesis !== 'undefined'
    && typeof SpeechSynthesisUtterance !== 'undefined';

  const LANGUES = ['en', 'fr'];

  /* Ce qu'on fait lire pour juger une voix : des mots qui trahissent l'accent.
   * « tomato », « water », « bath » et « can't » se disent autrement à
   * Londres et à New York — une voix américaine s'entend dès le premier mot.
   * Les nasales et les finales muettes du français n'existent pas en
   * anglais. */
  const PHRASES_D_ESSAI = {
    en: "I can't have a bath: there's no hot water, and no tomato soup either.",
    fr: 'Les enfants chantent dans le jardin.',
  };

  /* ── L'accent attendu ─────────────────────────────────────────────────────
   *
   * Le système donne ses voix dans son ordre à lui, et la première voix
   * française venue est souvent canadienne : « fr-CA » avant « fr-FR » sur
   * Android, Amélie avant Thomas sur iPhone. Un accent québécois que personne
   * n'a demandé — plainte de l'utilisateur sur La Langue verte, puis sur Le
   * Mot juste, et c'est ici le même code. Les voix de chaque langue sont
   * donc rangées par région : pour le français, la France, les voix sans
   * région, la Belgique, la Suisse et voisins, les autres, le Canada en
   * dernier ; pour l'anglais, la Grande-Bretagne, sans région, l'Irlande,
   * l'Australie et voisins, les autres, les États-Unis et le Canada en
   * dernier — c'est l'anglais britannique que l'application enseigne.
   * À région égale, la voix de l'appareil avant la voix en
   * ligne ; puis la meilleure, « premium » ou « améliorée » avant la compacte,
   * et les voix Eloquence d'Apple (Eddy, Flo, Grand-mère…), robotiques, en
   * queue.
   *
   * `motif` reconnaît la région dans le nom quand la balise se tait ou ment :
   * « Microsoft Sylvie - French (Canada) », « Français Canada ». */
  const REGIONS = {
    fr: {
      FR: { rang: 0, motif: /france/i },
      '': { rang: 1, motif: null },
      BE: { rang: 2, motif: /belgi/i },
      CH: { rang: 2, motif: /suisse|switzerland|schweiz/i },
      LU: { rang: 2, motif: /luxemb/i },
      MC: { rang: 2, motif: /monaco/i },
      CA: { rang: 9, motif: /canad|qu[ée]bec/i },
    },
    en: {
      GB: { rang: 0, motif: /united kingdom|royaume-uni|britain|british|england|angleterre|\bUK\b/i },
      '': { rang: 1, motif: null },
      IE: { rang: 2, motif: /ireland|irlande/i },
      AU: { rang: 3, motif: /australi/i },
      NZ: { rang: 3, motif: /new zealand|zélande/i },
      ZA: { rang: 3, motif: /south africa|afrique du sud/i },
      IN: { rang: 4, motif: /india|inde\b/i },
      US: { rang: 9, motif: /united states|états-unis|etats-unis|\bUS\b|american|américain/i },
      CA: { rang: 9, motif: /canad/i },
    },
  };
  const AUTRE_REGION = 5;
  const ELOQUENCE = /^(eddy|flo|grandma|grandpa|grand-m[èe]re|grand-p[èe]re|oma|opa|reed|rocko|sandy|shelley)\b/i;

  let voix = [];                 // toutes les voix du système, telles quelles
  let pret = false;              // la liste est-elle arrivée au moins une fois ?
  let signature = '';            // pour ne signaler que les vrais changements
  let actif = true;
  const choisies = { en: null, fr: null };   // { uri, nom } préféré, par langue
  const boutons = new Map();     // bouton → langue, à repeindre à l'arrivée des voix

  /* Un énoncé en cours doit rester référencé : Chrome ramasse un énoncé que
   * plus rien ne tient, et n'appelle alors jamais `end`. */
  let enCours = null;

  /* Le dernier énoncé demandé au moteur — texte, voix, balise, langue voulue.
   * C'est la pièce à conviction : si un « z » sonne faux, les Réglages disent
   * à quelle voix la phrase a été confiée. Ce que le moteur en a fait ensuite,
   * personne ici ne l'entend. */
  let dernier = null;

  // ── Les voix ──────────────────────────────────────────────────────────────

  /* « en-GB », « en_GB », « GB » : la balise de langue varie d'un moteur à
   * l'autre. On compare sur le code de langue, et l'on remet un tiret là où
   * un moteur Android écrit un tiret bas — un énoncé porteur d'une balise
   * mal formée peut être lu avec la voix par défaut. */
  function baliseDe(valeur) {
    return String(valeur || '').replace(/_/g, '-');
  }

  function codeDe(valeur) {
    return baliseDe(valeur).toLowerCase().split('-')[0];
  }

  function recenser() {
    if (!disponible) return false;
    let liste = [];
    try { liste = speechSynthesis.getVoices() || []; } catch (erreur) { liste = []; }
    voix = liste;
    if (liste.length) pret = true;
    const nouvelle = liste.map((v) => v.voiceURI + '|' + v.lang + '|' + (v.localService ? 'l' : 'r')).join('\n');
    if (nouvelle === signature) return false;
    signature = nouvelle;
    return true;
  }

  function annoncer() {
    for (const [bouton, langue] of boutons) {
      if (!bouton.isConnected) { boutons.delete(bouton); continue; }
      peindreBouton(bouton, langue);
    }
    if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined'
        && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('voix-changees'));
    }
  }

  if (disponible) {
    recenser();
    // Sur la plupart des navigateurs la liste arrive après coup, de façon
    // asynchrone : sans cet écouteur, un premier appui sur « écouter » resterait
    // muet alors que la voix existe.
    speechSynthesis.addEventListener('voiceschanged', () => {
      if (recenser()) annoncer();
    });
    /* Un appareil sans aucune voix ne signale jamais rien : passé un délai,
     * la liste vide est tenue pour définitive, et les Réglages cessent de
     * dire qu'elle n'est pas encore arrivée. */
    const delai = setTimeout(() => {
      if (pret) return;
      recenser();
      pret = true;
      annoncer();
    }, 4000);
    if (delai && typeof delai.unref === 'function') delai.unref();
  }

  function rangDans(table, code) {
    const r = table[code];
    return r ? r.rang : AUTRE_REGION;
  }

  /* La région d'une voix : la sous-balise (« fr-CA » → CA), sauf si le nom
   * désigne une région moins bien placée — « Français (Canada) » annoncé en
   * « fr » tout court reste canadien. */
  function regionDe(v, langue) {
    const table = REGIONS[langue] || {};
    const sous = baliseDe(v.lang).split('-').slice(1).find((s) => /^([a-z]{2}|\d{3})$/i.test(s));
    let code = sous ? sous.toUpperCase() : '';
    for (const autre of Object.keys(table)) {
      const r = table[autre];
      if (r.motif && r.motif.test(v.name || '') && r.rang > rangDans(table, code)) code = autre;
    }
    return code;
  }

  function qualite(v) {
    const signes = (v.voiceURI || '') + ' ' + (v.name || '');
    if (/eloquence/i.test(signes) || ELOQUENCE.test(v.name || '')) return 0;
    if (/premium/i.test(signes)) return 3;
    if (/enhanced|am[ée]lior|verbessert|erweitert|natural|neural/i.test(signes)) return 2;
    return 1;
  }

  /* Les voix d'une langue, les meilleures d'abord : région, appareil avant
   * réseau, qualité, voix par défaut du système, puis l'ordre du système. */
  function candidates(langue) {
    if (!disponible) return [];
    if (!voix.length) recenser();
    const table = REGIONS[langue] || {};
    const liste = voix.filter((v) => codeDe(v.lang) === langue);
    const cles = new Map(liste.map((v, i) => [v, [
      rangDans(table, regionDe(v, langue)), v.localService ? 0 : 1, -qualite(v), v.default ? 0 : 1, i,
    ]]));
    return liste.sort((a, b) => {
      const x = cles.get(a);
      const y = cles.get(b);
      for (let k = 0; k < x.length; k += 1) if (x[k] !== y[k]) return x[k] - y[k];
      return 0;
    });
  }

  /* Hors réseau, une voix en ligne resterait muette : on la saute. */
  function utilisable(v) {
    return !!v && (v.localService || typeof navigator === 'undefined' || navigator.onLine !== false);
  }

  /* Le choix automatique : la mieux placée de celles qui peuvent parler. */
  function automatique(langue) {
    const liste = candidates(langue);
    if (!liste.length) return null;
    return liste.find(utilisable) || liste[0];
  }

  /* La voix retenue dans les réglages, si elle est toujours là — et si elle
   * est bien de la langue demandée : un réglage importé d'ailleurs ne fera
   * jamais lire de l'anglais par une voix française. */
  function preferee(langue) {
    const choix = choisies[langue];
    if (!choix) return null;
    const liste = candidates(langue);
    return liste.find((v) => v.voiceURI === choix.uri)
      || liste.find((v) => v.name === choix.nom)
      || null;
  }

  /* La voix choisie dans les Réglages, si elle peut parler ; sinon le choix
   * automatique — une voix en ligne choisie ne ferait que se taire hors
   * réseau. */
  function voixPour(langue) {
    const cible = langue === 'en' ? 'en' : 'fr';
    const pref = preferee(cible);
    return utilisable(pref) ? pref : automatique(cible);
  }

  function possible(langue) {
    return !!voixPour(langue);
  }

  function decrire(v, langue) {
    if (!v) return null;
    const code = langue || codeDe(v.lang);
    return { uri: v.voiceURI, nom: v.name, lang: baliseDe(v.lang), locale: !!v.localService,
             region: regionDe(v, code) };
  }

  /* Les voix qu'on peut choisir pour une langue, dans l'ordre où le choix
   * automatique les prendrait. */
  function lister(langue) {
    return candidates(langue).map((v) => decrire(v, langue));
  }

  /* Pourquoi une voix d'outre-Atlantique lit malgré tout, s'il y a lieu :
   *
   *   français — la voix qui lit est canadienne :
   *     choix-canadien   choisie à la main, alors qu'une voix d'Europe est là ;
   *     france-en-ligne  la voix de France ne marche qu'en ligne, et l'on est
   *                      hors réseau ;
   *     pas-de-france    aucune voix française d'Europe sur l'appareil : il
   *                      faut l'installer — l'application ne le peut pas.
   *   anglais — la voix qui lit est américaine ou canadienne :
   *     choix-americain, gb-en-ligne, pas-de-gb, de même.
   *
   * Rend null quand la voix qui lit a l'accent attendu. */
  const LOINTAINES = { fr: ['CA'], en: ['US', 'CA'] };
  const AVIS = {
    fr: ['choix-canadien', 'france-en-ligne', 'pas-de-france'],
    en: ['choix-americain', 'gb-en-ligne', 'pas-de-gb'],
  };
  function avisAccent(langue) {
    const lointaines = LOINTAINES[langue];
    if (!lointaines) return null;
    const v = voixPour(langue);
    if (!v || lointaines.indexOf(regionDe(v, langue)) === -1) return null;
    const proches = candidates(langue).filter((x) => lointaines.indexOf(regionDe(x, langue)) === -1);
    const [choix, enLigne, absente] = AVIS[langue];
    if (choisies[langue] && proches.some(utilisable)) return choix;
    if (proches.length && !proches.some(utilisable)) return enLigne;
    return absente;
  }

  /* Ce que les Réglages affichent, et ce qu'on demande à qui signale un
   * défaut de prononciation : la voix effectivement retenue, si elle vient
   * d'un choix ou du défaut, et si un choix enregistré est introuvable. */
  function diagnostic(langue) {
    const liste = candidates(langue);
    const choix = choisies[langue];
    const pref = preferee(langue);
    const prefParle = utilisable(pref);
    const retenue = prefParle ? pref : automatique(langue);
    return {
      langue,
      disponible,
      pret,
      actif,
      nombre: liste.length,
      total: voix.length,
      voix: decrire(retenue, langue),
      choix: choix ? { uri: choix.uri, nom: choix.nom } : null,
      choixIntrouvable: !!(choix && !pref),
      automatique: !prefParle,
      avis: avisAccent(langue),
    };
  }

  /* De quoi nommer l'appareil dans un signalement : système et navigateur,
   * tels que le navigateur les annonce. Rien n'est envoyé nulle part. */
  function appareil() {
    const n = typeof navigator !== 'undefined' ? navigator : {};
    const donnees = n.userAgentData || null;
    return {
      plateforme: (donnees && donnees.platform) || n.platform || '',
      navigateur: n.userAgent || '',
    };
  }

  // ── Les réglages ──────────────────────────────────────────────────────────

  function choixValide(valeur) {
    if (!valeur || typeof valeur !== 'object') return null;
    const uri = typeof valeur.uri === 'string' ? valeur.uri.slice(0, 300) : '';
    const nom = typeof valeur.nom === 'string' ? valeur.nom.slice(0, 200) : '';
    return uri || nom ? { uri, nom } : null;
  }

  /* Lit les réglages `voixEn` et `voixFr` — `{uri, nom}` ou rien. */
  function configurer(reglages) {
    const r = reglages || {};
    choisies.en = choixValide(r.voixEn);
    choisies.fr = choixValide(r.voixFr);
    annoncer();
  }

  /* Retient une voix pour une langue (`null` : choix automatique). Rend ce
   * qu'il faut écrire dans les réglages. */
  function choisir(langue, uri) {
    if (LANGUES.indexOf(langue) === -1) return null;
    const v = uri ? candidates(langue).find((c) => c.voiceURI === uri) : null;
    choisies[langue] = v ? { uri: v.voiceURI, nom: v.name } : null;
    annoncer();
    return choisies[langue];
  }

  function phraseDEssai(langue) {
    return PHRASES_D_ESSAI[langue] || PHRASES_D_ESSAI.en;
  }

  function essayer(langue) {
    return dire(phraseDEssai(langue), langue);
  }

  // ── Les boutons ▸ ─────────────────────────────────────────────────────────

  function peindreBouton(bouton, langue) {
    const sans = !possible(langue);
    bouton.disabled = sans;
    if (sans) {
      bouton.title = racine.I18n ? I18n.t('voix.aucune.' + langue) : '';
    } else {
      bouton.removeAttribute('title');
    }
  }

  /* Un bouton d'écoute qui suit l'arrivée des voix : grisé tant qu'aucune
   * voix de la langue n'est là, repeint dès que la liste change. */
  function brancherBouton(bouton, langue) {
    boutons.set(bouton, langue);
    peindreBouton(bouton, langue);
    return bouton;
  }

  // ── Parler ────────────────────────────────────────────────────────────────

  /* Une parole, prête à partir. Un peu en dessous de la vitesse normale : on
   * écoute pour apprendre à prononcer, pas pour aller vite. */
  function parole(texte, choisie) {
    const p = new SpeechSynthesisUtterance(texte);
    p.voice = choisie;
    p.lang = baliseDe(choisie.lang);
    p.rate = 0.9;
    return p;
  }

  function lancer(p, langue) {
    enCours = p;
    const relacher = () => { if (enCours === p) enCours = null; };
    p.addEventListener('end', relacher);
    p.addEventListener('error', relacher);
    dernier = { texte: p.text, voix: p.voice ? p.voice.name : '', lang: p.lang, langue, quand: Date.now() };
    speechSynthesis.speak(p);
    if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('voix-parle'));
    }
  }

  function dire(texte, langue) {
    if (!disponible || !actif || !texte) return false;
    const cible = langue === 'en' ? 'en' : 'fr';
    const choisie = voixPour(cible);
    if (!choisie) return false;
    taire();
    lancer(parole(texte, choisie), cible);
    return true;
  }

  /* Une suite de répliques, avec un silence entre chacune.
   *
   * C'est ce qu'il faut pour écouter un dialogue : chaque réplique part quand
   * la précédente est finie, après une pause — le temps de suivre des yeux,
   * ou de répéter. `items` est une liste de `{texte, langue, silence}` ; un
   * item sans texte ne fait qu'attendre `silence` millisecondes, ce qui
   * laisse un tour de parole vide à qui joue un rôle.
   *
   * `surItem(i)` est appelé quand l'item i commence, `surFin(interrompu)`
   * quand tout est fini ou arrêté. Rend `{arreter}`. Une seule suite à la
   * fois : en lancer une autre, ou `dire()`, ou `taire()`, arrête celle-ci —
   * la synthèse n'a qu'une voix, et un dialogue par-dessus un autre ne serait
   * qu'un brouhaha.
   *
   * Les navigateurs ne signalent pas tous la fin d'une parole annulée ; le
   * numéro de suite fait garde-fou, et une parole qui n'appelle jamais `end`
   * est rattrapée par un délai proportionné à sa longueur. */
  let suiteCourante = null;

  function enchainer(items, options) {
    const reglages = options || {};
    const pause = reglages.pause === undefined ? 900 : reglages.pause;
    taire();
    if (!disponible || !actif) {
      if (reglages.surFin) reglages.surFin(true);
      return { arreter() {} };
    }

    const suite = { active: true, minuterie: null, finir: null };
    suiteCourante = suite;
    let position = 0;

    function finir(interrompu) {
      if (!suite.active) return;
      suite.active = false;
      if (suite.minuterie) clearTimeout(suite.minuterie);
      if (suiteCourante === suite) suiteCourante = null;
      if (reglages.surFin) reglages.surFin(interrompu);
    }
    suite.finir = finir;

    function suivant() {
      if (!suite.active) return;
      if (position >= items.length) { finir(false); return; }
      const item = items[position];
      const rang = position;
      position += 1;
      if (reglages.surItem) reglages.surItem(rang);
      const silence = item.silence === undefined ? pause : item.silence;

      if (!item.texte) {
        suite.minuterie = setTimeout(suivant, silence);
        return;
      }
      const choisie = voixPour(item.langue);
      if (!choisie) {
        // Pas de voix pour cette langue : on passe, la suite continue.
        suite.minuterie = setTimeout(suivant, silence);
        return;
      }
      const p = parole(item.texte, choisie);
      let fini = false;
      const apres = () => {
        if (fini || !suite.active) return;
        fini = true;
        if (suite.minuterie) clearTimeout(suite.minuterie);
        suite.minuterie = setTimeout(suivant, silence);
      };
      p.onend = apres;
      p.onerror = (e) => {
        // Une parole interrompue par `cancel()` signale une erreur : ce n'est
        // pas la nôtre à traiter, `arreter` a déjà tout fermé.
        if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
        apres();
      };
      // Le filet : 120 ms par signe, jamais moins de trois secondes — plus
      // que la voix la plus lente, pour ne pas lui couper la parole.
      suite.minuterie = setTimeout(apres, 3000 + item.texte.length * 120);
      lancer(p, item.langue === 'en' ? 'en' : 'fr');
    }

    suivant();
    return {
      arreter() {
        if (!suite.active) return;
        finir(true);
        speechSynthesis.cancel();
      },
    };
  }

  function taire() {
    if (suiteCourante) {
      // Le module qui écoutait doit savoir que c'est fini.
      const suite = suiteCourante;
      suiteCourante = null;
      suite.finir(true);
    }
    if (disponible) speechSynthesis.cancel();
  }

  racine.Voix = {
    LANGUES,
    get disponible() { return disponible; },
    get pret() { return pret; },
    get actif() { return actif; },
    set actif(valeur) { actif = !!valeur; if (!actif) taire(); },
    possible,
    lister,
    diagnostic,
    appareil,
    dernier() { return dernier ? Object.assign({}, dernier) : null; },
    regionDe(v, langue) { return regionDe(v, langue); },
    configurer,
    choisir,
    phraseDEssai,
    essayer,
    brancherBouton,
    dire,
    enchainer,
    taire,
  };

})(window);
