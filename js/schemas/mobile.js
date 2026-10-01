'use strict';
/*
 * Schémas de la catégorie « Android et mobile ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'mobile-webview': {
      k: 'pile',
      alt: ['Une application hybride : le code de l’application, une WebView, le moteur web, Android', 'A hybrid app: the app’s code, a WebView, the web engine, Android'],
      piles: [{
        t: ['Une application qui affiche du web', 'An app that displays web content'],
        layers: [
          { t: ['Application', 'App'], d: ['votre code (Kotlin, Java)', 'your code (Kotlin, Java)'], s: 'a' },
          { t: 'WebView', d: ['le composant qui affiche des pages', 'the component that displays pages'], s: 'v' },
          { t: ['Moteur web', 'Web engine'], d: 'Chromium : HTML · CSS · JavaScript', s: 'warn' },
          { t: 'Android', d: ['le système', 'the system'], s: 'mute' },
        ],
      }],
    },

    'mobile-apk-aab': {
      k: 'graphe',
      alt: ['Vous envoyez un AAB ; Google Play en tire un APK adapté à chaque appareil', 'You upload an AAB; Google Play derives a tailored APK for each device'],
      gy: 76,
      n: [
        { id: 'a', t: 'AAB', sub: ['un seul paquet', 'one package'], c: 0, r: 0.5, f: 'file', s: 'a', w: 90, h: 52, mono: true },
        { id: 'p', t: 'Google Play', c: 1, r: 0.5, f: 'cloud', s: 'v', w: 96, h: 56, sz: 11 },
        { id: 'x', t: ['APK\ntéléphone', 'APK\nphone'], c: 2, r: 0, s: 'ok', w: 90 },
        { id: 'y', t: ['APK\ntablette', 'APK\ntablet'], c: 2, r: 1, s: 'ok', w: 90 },
      ],
      e: [['a', 'p', ['envoi', 'upload'], 'a'], ['p', 'x', '', 'ok'], ['p', 'y', '', 'ok']],
    },

    'mobile-twa': {
      k: 'graphe',
      alt: ['Une TWA : l’application Android ouvre votre site dans Chrome, en plein écran, après vérification', 'A TWA: the Android app opens your site in Chrome, full screen, after verification'],
      gy: 88,
      n: [
        { id: 'p', t: 'Play Store', c: 0, r: 0, s: 'v', w: 104 },
        { id: 'a', t: ['Application\nAndroid (TWA)', 'Android app\n(TWA)'], c: 0, r: 1, s: 'a', w: 108 },
        { id: 'c', t: ['Chrome\nplein écran', 'Chrome\nfull screen'], c: 1, r: 1, s: 'info', w: 108 },
        { id: 's', t: ['Votre site\n(PWA)', 'Your site\n(PWA)'], c: 1, r: 0, f: 'cloud', s: 'ok', w: 108, h: 54 },
      ],
      e: [['p', 'a', ['installe', 'installs'], 'v'], ['a', 'c', ['ouvre', 'opens'], 'a'], ['c', 's', ['charge', 'loads'], 'info'], ['s', 'a', 'assetlinks.json', 'ok dash']],
    },

    'mobile-assetlinks': {
      k: 'sequence',
      lh: 50,
      alt: ['Chrome vérifie que le site déclare bien l’application avant de masquer la barre d’adresse', 'Chrome checks that the site really declares the app before hiding the address bar'],
      a: [['Application', 'App'], 'Chrome', ['Votre site', 'Your site']],
      s: ['a', 'info', 'ok'],
      m: [
        [0, 1, ['ouvre le site', 'opens the site']],
        [1, 2, ['GET /.well-known/\nassetlinks.json', 'GET /.well-known/\nassetlinks.json']],
        [2, 1, ['paquet + empreinte\nSHA-256', 'package + SHA-256\nfingerprint'], 'ok dash'],
        [1, 1, ['correspond ?', 'matches?'], 'warn'],
        [1, 0, ['plein écran', 'full screen'], 'ok dash'],
      ],
    },

    'mobile-signature': {
      k: 'graphe',
      alt: ['Vous signez l’AAB avec la clé d’importation ; Google le signe de nouveau avec sa clé avant de l’installer', 'You sign the AAB with the upload key; Google signs it again with its key before installing it'],
      gy: 80,
      n: [
        { id: 'k', t: 'Keystore', sub: ['clé d’importation', 'upload key'], c: 0, r: 0, s: 'warn', w: 100, h: 50 },
        { id: 'a', t: ['AAB signé', 'Signed AAB'], c: 1, r: 0, f: 'file', s: 'a', w: 92 },
        { id: 'p', t: 'Google Play', sub: ['clé de Google', 'Google’s key'], c: 2, r: 0, f: 'cloud', s: 'v', w: 100, h: 58, sz: 11 },
        { id: 'x', t: ['APK signé\npar Google', 'APK signed\nby Google'], c: 2, r: 1, s: 'ok', w: 100 },
        { id: 'u', t: ['Téléphone', 'Phone'], c: 1, r: 1, s: 'ok', w: 92 },
      ],
      e: [['k', 'a', ['signe', 'signs'], 'warn'], ['a', 'p', ['envoi', 'upload'], 'a'], ['p', 'x', ['resigne', 'resigns'], 'v'], ['x', 'u', ['installe', 'installs'], 'ok']],
    },

    'mobile-gradle': {
      k: 'graphe',
      alt: ['Gradle transforme le code et les ressources en APK de test ou en AAB de publication', 'Gradle turns code and resources into a test APK or a release AAB'],
      gy: 80,
      n: [
        { id: 's', t: ['Code +\nressources', 'Code +\nresources'], c: 0, r: 0.5, s: 'a', w: 92 },
        { id: 'g', t: 'Gradle', c: 1, r: 0.5, s: 'v', w: 84 },
        { id: 'a', t: ['APK de test', 'Test APK'], c: 2, r: 0, s: 'ok', w: 92 },
        { id: 'b', t: ['AAB pour\nGoogle Play', 'AAB for\nGoogle Play'], c: 2, r: 1, s: 'ok', w: 92 },
      ],
      e: [['s', 'g', '', 'a'], ['g', 'a', 'debug', 'ok'], ['g', 'b', 'release', 'ok']],
      l: ['assembleDebug produit un APK de test ; bundleRelease produit l’AAB à envoyer à Google Play.', 'assembleDebug produces a test APK; bundleRelease produces the AAB to upload to Google Play.'],
    },

  });
})(window);
