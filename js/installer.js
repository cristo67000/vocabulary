'use strict';
/*
 * Installer l'application, et la partager.
 *
 * ── Installer ──────────────────────────────────────────────────────────────
 *
 * Une application web installable l'est déjà techniquement — le navigateur
 * propose « Ajouter à l'écran d'accueil » quelque part dans son menu. Encore
 * faut-il le savoir : la plupart des gens ne l'ont jamais remarqué, et une
 * application consultée dans un onglet perd tout ce qui fait son intérêt ici,
 * l'icône sur l'écran d'accueil et le fonctionnement hors ligne.
 *
 * D'où un bouton explicite. Trois cas, et ils diffèrent vraiment :
 *
 *   Android, Chrome, Edge   `beforeinstallprompt` est émis ; on le retient et
 *                           on le déclenche au clic. Installation en un geste.
 *   iOS, Safari             l'événement n'existe pas, et rien ne permet de
 *                           déclencher l'installation par programme. Reste à
 *                           expliquer le geste : Partager, puis « Sur l'écran
 *                           d'accueil ».
 *   déjà installée          on n'affiche rien du tout.
 *
 * ── Partager ───────────────────────────────────────────────────────────────
 *
 * `navigator.share` ouvre la feuille de partage du système — messages, courriel,
 * ce que la personne utilise. Là où elle manque (la plupart des navigateurs de
 * bureau), on copie l'adresse dans le presse-papiers, et on le dit.
 */
(function (racine) {

  const ADRESSE = 'https://cristo67000.github.io/vocabulary/';

  let invite = null;          // l'événement beforeinstallprompt retenu
  let elements = {};

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  function estInstallee() {
    return racine.matchMedia('(display-mode: standalone)').matches
      || racine.navigator.standalone === true;
  }

  function estApple() {
    // iPadOS 13+ se présente comme un Mac ; le point tactile le trahit.
    const ua = racine.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua)
      || (/Macintosh/.test(ua) && racine.navigator.maxTouchPoints > 1);
  }

  /* Chrome émet `beforeinstallprompt` très tôt, souvent avant que
   * l'application n'ait fini de s'installer elle-même. On l'écoute donc dès le
   * chargement du fichier, sans attendre que l'interface soit prête. */
  racine.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    invite = e;
    dessiner();
  });

  racine.addEventListener('appinstalled', () => {
    invite = null;
    dessiner();
  });

  // ── Installation ──────────────────────────────────────────────────────────

  function dessinerInstallation() {
    const bloc = elements.blocInstaller;
    const zone = elements.zoneInstaller;
    if (!bloc || !zone) return;
    zone.textContent = '';

    if (estInstallee()) {
      bloc.hidden = true;
      return;
    }

    if (invite) {
      bloc.hidden = false;
      const bouton = element('button', 'bouton-principal', I18n.t('reglages.installer.bouton'));
      bouton.type = 'button';
      bouton.addEventListener('click', async () => {
        bouton.disabled = true;
        try {
          invite.prompt();
          const choix = await invite.userChoice;
          if (choix && choix.outcome === 'accepted') invite = null;
        } catch (erreur) {
          /* L'invite ne peut servir qu'une fois ; si elle a expiré, on la
           * relâche et le navigateur en émettra une autre au besoin. */
          invite = null;
        }
        dessiner();
      });
      zone.appendChild(bouton);
      return;
    }

    if (estApple()) {
      bloc.hidden = false;
      const marche = element('ol', 'marche-a-suivre');
      for (const cle of ['reglages.installer.ios.1', 'reglages.installer.ios.2',
                         'reglages.installer.ios.3']) {
        marche.appendChild(element('li', null, I18n.t(cle)));
      }
      zone.appendChild(marche);
      return;
    }

    /* Ni invite ni iOS : soit le navigateur ne sait pas installer, soit il l'a
     * déjà proposé et l'utilisateur a refusé. Rien à dire d'utile — on se tait
     * plutôt que d'afficher une consigne qui ne mènerait nulle part. */
    bloc.hidden = true;
  }

  // ── Partage ───────────────────────────────────────────────────────────────

  function dessinerPartage() {
    const zone = elements.zonePartager;
    if (!zone) return;
    zone.textContent = '';
    /* Partager une adresse qui ne mène nulle part serait pire que ne rien
     * proposer : tant que l'application ne tourne pas depuis son adresse
     * publique — en local, avant publication —, la zone reste vide. */
    const publiee = String(racine.location.href).indexOf(ADRESSE) === 0;
    const bloc = document.getElementById('bloc-partager');
    if (bloc) bloc.hidden = !publiee;
    if (!publiee) return;

    const bouton = element('button', 'bouton-discret', I18n.t('reglages.partager.bouton'));
    bouton.type = 'button';
    const retour = element('p', 'discret retour-partage', '');
    retour.hidden = true;

    bouton.addEventListener('click', async () => {
      const contenu = {
        title: I18n.t('app.nom'),
        text: I18n.t('reglages.partager.texte'),
        url: ADRESSE,
      };
      if (racine.navigator.share) {
        try {
          await racine.navigator.share(contenu);
          return;
        } catch (erreur) {
          // Partage annulé : ce n'est pas une erreur, on ne dit rien.
          if (erreur && erreur.name === 'AbortError') return;
        }
      }
      try {
        await racine.navigator.clipboard.writeText(ADRESSE);
        retour.textContent = I18n.t('reglages.partager.copie');
      } catch (erreur) {
        retour.textContent = ADRESSE;
      }
      retour.hidden = false;
    });

    zone.appendChild(bouton);
    zone.appendChild(element('p', 'adresse-partage', ADRESSE));
    zone.appendChild(retour);
  }

  function dessiner() {
    dessinerInstallation();
    dessinerPartage();
  }

  function brancher() {
    elements = {
      blocInstaller: document.getElementById('bloc-installer'),
      zoneInstaller: document.getElementById('zone-installer'),
      zonePartager: document.getElementById('zone-partager'),
    };
    dessiner();
    document.addEventListener('langue-changee', dessiner);
  }

  racine.Installer = { brancher, dessiner, estInstallee, estApple, ADRESSE };

})(window);
