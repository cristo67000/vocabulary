'use strict';
/*
 * Amorçage : réglages, langue, dictionnaire, service worker.
 *
 * L'ordre compte. On lit d'abord les réglages, pour savoir dans quelle langue
 * afficher un éventuel message d'erreur. On demande ensuite au cache lequel des
 * deux paquets est réellement installé, plutôt que de croire le réglage sur
 * parole : l'utilisateur a pu vider les données du site depuis le navigateur,
 * auquel cas le réglage annoncerait un dictionnaire complet qui n'est plus là.
 *
 * Le service worker est enregistré en dernier, une fois l'application à
 * l'écran. Il sert au deuxième lancement, pas au premier ; le retarder évite de
 * disputer la bande passante aux fichiers dont l'affichage a besoin tout de
 * suite. Son enregistrement est confié à `MiseAJour`, qui surveille l'arrivée
 * d'une version et se charge de l'annoncer.
 */
(function () {

  /* Quel paquet ouvrir, et dans quel cache.
   *
   * Le réglage dit ce que l'utilisateur avait choisi ; le cache dit ce qui
   * est vraiment là. Entre les deux, le cas qui compte : l'application vient
   * d'être mise à jour, ses données ont changé de mouture, et le paquet
   * complet téléchargé sous la mouture d'avant est toujours entier. On s'en
   * sert — sans les nouveautés, mais sans rien perdre, ni mélanger — jusqu'à
   * ce que le nouveau soit téléchargé. `ancien` est alors renseigné, et
   * l'application le dit à l'écran. */
  async function quelPaquet(manifeste, reglages) {
    if (reglages.paquet !== 'complet') return { paquet: 'noyau', ancien: null };
    try {
      if (await Paquets.complet(manifeste)) return { paquet: 'complet', ancien: null };
      const ancien = await Paquets.ancien(manifeste);
      if (ancien) return { paquet: 'complet', ancien };
    } catch (erreur) {
      /* Un cache inaccessible se traite comme absent. */
    }
    return { paquet: 'noyau', ancien: null };
  }

  async function demarrer() {
    const ecran = document.getElementById('demarrage');

    let reglages;
    try {
      reglages = await Store.lireReglages();
    } catch (erreur) {
      // Un navigateur en navigation privée peut refuser IndexedDB. Ce n'est pas
      // une raison pour ne pas ouvrir le dictionnaire : on continue sans
      // mémoire, l'essentiel de l'application n'en a pas besoin.
      reglages = Object.assign({}, Store.DEFAUTS);
    }

    I18n.definir(reglages.langue || I18n.langueDuNavigateur());

    try {
      const reponse = await fetch('data/manifeste.json');
      if (!reponse.ok) throw new Error('manifeste : ' + reponse.status);
      const manifeste = await reponse.json();
      const { paquet, ancien } = await quelPaquet(manifeste, reglages);

      /* Le ménage des moutures qui ne resserviront plus — jamais celle qu'on
       * s'apprête à lire : `oublierLesPerimes` garde un ancien paquet entier
       * tant que le nouveau ne l'est pas. On n'attend pas le résultat : c'est
       * du ménage, pas une étape du démarrage. */
      Paquets.oublierLesPerimes(manifeste).catch(() => {});
      Lexique.etat.manifeste = manifeste;
      await Lexique.charger(paquet, { ancien });

      // Le réglage suit ce qui est vraiment là, pas l'inverse.
      if (reglages.paquet !== paquet) {
        reglages.paquet = paquet;
        Store.ecrireReglage('paquet', paquet).catch(() => {});
      }

      /* Les mots personnels entrent en mémoire avant que l'écran ne s'ouvre.
       *
       * La recherche est synchrone — c'est ce qui fait qu'elle suit la touche —
       * et elle ne peut donc pas aller les chercher en base à chaque frappe.
       * Ils sont peu nombreux et tiennent dans un tableau ; les charger ici est
       * le seul moment où l'attente ne se voit pas. Un échec n'arrête rien :
       * on ouvre le dictionnaire sans eux plutôt que de ne rien ouvrir. */
      await Perso.charger().catch(() => {});
      /* Les phrases et dialogues aussi : la recherche générale les montre
       * pendant la frappe, ils doivent donc être en mémoire. Le fichier est
       * pré-caché avec la coquille, et ce qu'on a écrit soi-même vient de la
       * base — un échec de l'un ou l'autre n'arrête pas le démarrage. */
      if (window.Conversation) await Conversation.charger().catch(() => {});
      /* Le contenu des modules — argot, technique, expressions — est lui
       * aussi pré-caché avec la coquille ; la recherche le consulte pendant
       * la frappe. */
      if (window.Modules) await Modules.charger().catch(() => {});

      App.brancher({ reglages, manifeste });
      ecran.classList.add('parti');
      setTimeout(() => { ecran.hidden = true; }, 300);
    } catch (erreur) {
      ecran.textContent = '';
      const message = document.createElement('p');
      message.textContent = I18n.t('demarrage.echec');
      ecran.appendChild(message);
      const detail = document.createElement('p');
      detail.className = 'discret';
      detail.textContent = String(erreur && erreur.message ? erreur.message : erreur);
      ecran.appendChild(detail);
      return;
    }

    /* Mode développement, à la demande seulement : sur la machine de
     * développement, `?sans-sw` désinstalle le service worker et vide la
     * coquille en cache, pour que chaque rechargement serve les fichiers du
     * disque. Ailleurs que sur localhost, le paramètre est sans effet. */
    const developpement = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
      && /[?&]sans-sw\b/.test(window.location.search);
    if (developpement && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((liste) => Promise.all(liste.map((r) => r.unregister())))
        .then(() => (window.caches ? caches.keys() : []))
        .then((noms) => Promise.all(noms.filter((n) => n.indexOf('-coquille-') !== -1)
          .map((n) => caches.delete(n))))
        .catch(() => {});
    } else if ('serviceWorker' in navigator) {
      /* Sans service worker l'application marche encore, simplement elle ne
       * survit pas à la coupure du réseau — c'est-à-dire qu'elle perd sa raison
       * d'être. Rien à dire à l'utilisateur, qui n'y peut rien et dont le
       * navigateur a ses raisons (page servie en http, navigation privée…),
       * mais l'échec doit laisser une trace dans la console : une panne
       * d'installation entièrement muette a déjà coûté une soirée. */
      navigator.serviceWorker.register('sw.js')
        .then((enregistrement) => MiseAJour.surveiller(enregistrement))
        .catch((erreur) => {
          console.warn('Vocabulary : service worker non installé —', erreur);
        });
    }

    /* Le dictionnaire entier, hors ligne, sans qu'on le demande : c'est le
     * réglage d'office (« Tout garder hors ligne »). Il part après
     * l'ouverture, en arrière-plan, quand le réseau est là — le noyau suffit
     * à tout en attendant. */
    if (window.App && App.telechargerEnArrierePlan) {
      setTimeout(() => App.telechargerEnArrierePlan(), 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

})();
