'use strict';
/*
 * Installation du dictionnaire complet.
 *
 * Le noyau part avec l'application et vit dans le cache de la coquille. Le
 * dictionnaire complet — quelque deux cents fichiers, 80 Mo — est téléchargé
 * sur décision de l'utilisateur et rangé dans un cache **à part**, nommé
 * d'après la version des *données* et leur date de construction, pas d'après
 * celle de l'application.
 *
 * Cette séparation est tout le sujet de ce fichier. Le service worker de nos
 * autres applications supprime, à chaque activation, tous les caches sauf le
 * sien : repris tel quel, la moindre correction de faute de frappe dans le
 * code effacerait les 80 Mo que l'utilisateur a patiemment téléchargés, sur son
 * forfait. Ici, personne ne supprime le cache des données sinon :
 *   — l'utilisateur, explicitement, depuis les réglages ;
 *   — l'installation d'une version plus récente des données, qui remplace
 *     l'ancienne **une fois qu'elle est complète** — jamais avant.
 *
 * ── Le passage d'une mouture à la suivante ──────────────────────────────────
 *
 * Une reconstruction des données garde les noms de fichiers et change leur
 * contenu ; un téléchargement ne redemande pas ce qui est déjà là. Mélanger
 * l'index d'une mouture et les tranches d'une autre donnerait un dictionnaire
 * troué, au hasard. Chaque mouture a donc son cache, et trois règles tiennent
 * le tout :
 *
 *   1. l'ancien paquet reste **lisible** tant que le nouveau n'est pas entier
 *      — `Lexique` le lit directement dans son cache, par l'API Cache, sans
 *      passer par le réseau ni par le service worker : rien ne peut s'y
 *      substituer ;
 *   2. le nouveau se télécharge à côté, dans son propre cache, avec un cache-
 *      buster : même un service worker d'avant ne peut pas lui servir les
 *      fichiers de l'ancien ;
 *   3. l'ancien n'est effacé qu'une fois le nouveau complet, et le manifeste
 *      de chaque paquet est rangé avec lui — la prochaine fois, on saura
 *      exactement ce qu'il contient.
 *
 * Le téléchargement est repris là où il s'est arrêté : un fichier déjà en cache
 * n'est pas redemandé. Couper le réseau au milieu ne coûte donc que ce qui
 * restait.
 */
(function (racine) {

  const PREFIXE = 'vocabulary-donnees-';

  /* Le nom du cache d'une mouture : format, puis la mouture elle-même — date
   * de construction et empreinte du contenu. La date seule ne suffisait pas
   * (leçon de La Langue verte) : deux constructions le même jour gardaient le
   * même nom, et la seconde se serait mêlée à la première. */
  function nomDuCache(manifeste) {
    if (typeof manifeste !== 'object') return PREFIXE + manifeste;
    const mouture = manifeste.mouture || manifeste.construit || '';
    return PREFIXE + manifeste.version + (mouture ? '-' + mouture : '');
  }

  async function cachesDeDonnees() {
    const noms = await caches.keys();
    return noms.filter((n) => n.startsWith(PREFIXE));
  }

  async function tousPresents(cache, fichiers) {
    for (const fichier of fichiers) {
      if (!(await cache.match('data/' + fichier))) return false;
    }
    return true;
  }

  /* Le paquet complet de cette mouture est-il installé, et entièrement ? Un
   * téléchargement interrompu laisse un cache partiel : on vérifie que tous
   * les fichiers annoncés au manifeste y sont, sinon on considère qu'il n'est
   * pas installé — mieux vaut proposer de reprendre que d'ouvrir un
   * dictionnaire troué. */
  async function complet(manifeste) {
    if (!('caches' in racine)) return false;
    const nom = nomDuCache(manifeste);
    if (!(await caches.has(nom))) return false;
    return tousPresents(await caches.open(nom), manifeste.paquets.complet.fichiers);
  }

  /* Un paquet complet d'une mouture antérieure, s'il en reste un utilisable.
   *
   * C'est ce qui évite la perte d'accès : entre la mise à jour de
   * l'application et le téléchargement des nouvelles données, le dictionnaire
   * complet d'avant continue de servir — entier, cohérent, sans les nouveautés.
   * Rend `{nom, manifeste}` ; `manifeste` est celui rangé avec le paquet, ou
   * null pour un paquet d'avant que l'on ne le range (version 3.0), dont les
   * quatre index témoignent alors de l'intégrité. */
  async function ancien(manifeste) {
    if (!('caches' in racine)) return null;
    const courant = nomDuCache(manifeste);
    const candidats = (await cachesDeDonnees()).filter((n) => n !== courant).sort().reverse();
    for (const nom of candidats) {
      const cache = await caches.open(nom);
      const range = await cache.match('data/manifeste.json');
      if (range) {
        const propre = await range.json().catch(() => null);
        if (propre && propre.paquets && propre.paquets.complet
            && (await tousPresents(cache, propre.paquets.complet.fichiers))) {
          return { nom, manifeste: propre };
        }
        continue;
      }
      const temoins = ['complet/de.idx', 'complet/fr.idx',
                       'complet/formes-de.idx', 'complet/formes-fr.idx'];
      if (await tousPresents(cache, temoins)) return { nom, manifeste: null };
    }
    return null;
  }

  async function manquants(manifeste) {
    const cache = await caches.open(nomDuCache(manifeste));
    const liste = [];
    for (const fichier of manifeste.paquets.complet.fichiers) {
      if (!(await cache.match('data/' + fichier))) liste.push('data/' + fichier);
    }
    return liste;
  }

  /* Téléchargement, avec avancement et possibilité d'arrêt.
   *
   * `avancer({faits, total, octets})` est appelé après chaque fichier.
   * `signal` est un AbortSignal : arrêter en cours de route ne détruit rien,
   * ce qui est déjà arrivé reste en cache pour la prochaine tentative.
   *
   * Chaque fichier est demandé avec la date de construction en paramètre :
   * un service worker — celui d'aujourd'hui comme celui d'une version
   * antérieure — ne trouve pas cette adresse dans ses caches et va au réseau.
   * Sans cela, le service worker de la version 3.0 aurait répondu avec les
   * fichiers de l'ancien paquet, et le nouveau cache aurait reçu l'ancien
   * contenu sous les nouveaux noms.
   */
  async function telecharger(manifeste, avancer, signal) {
    const cache = await caches.open(nomDuCache(manifeste));
    const aFaire = await manquants(manifeste);
    const total = manifeste.paquets.complet.fichiers.length;
    let faits = total - aFaire.length;
    let octets = 0;
    const marque = '?mouture=' + encodeURIComponent(manifeste.mouture || manifeste.construit || manifeste.version);

    // Quatre à la fois : assez pour ne pas attendre la latence de chaque
    // requête, assez peu pour ne pas saturer une connexion mobile.
    const PARALLELE = 4;
    let curseur = 0;

    async function ouvrier() {
      while (curseur < aFaire.length) {
        if (signal && signal.aborted) return;
        const chemin = aFaire[curseur];
        curseur += 1;
        const reponse = await fetch(chemin + marque, { cache: 'no-cache', signal });
        if (!reponse.ok) throw new Error(chemin + ' : ' + reponse.status);
        const copie = reponse.clone();
        await cache.put(chemin, reponse);
        try {
          octets += (await copie.blob()).size;
        } catch (e) {
          /* La taille n'est qu'indicative ; ne pas la connaître n'empêche
           * rien. */
        }
        faits += 1;
        if (avancer) avancer({ faits, total, octets });
      }
    }

    const ouvriers = [];
    for (let i = 0; i < Math.min(PARALLELE, aFaire.length); i += 1) ouvriers.push(ouvrier());
    await Promise.all(ouvriers);

    if (signal && signal.aborted) return false;

    /* Le manifeste part avec le paquet : c'est lui qui dira, à la prochaine
     * mouture, ce que ce cache contient exactement. */
    await cache.put('data/manifeste.json', new Response(JSON.stringify(manifeste), {
      headers: { 'Content-Type': 'application/json' },
    }));

    // Le nouveau paquet est entier : les moutures précédentes peuvent partir.
    await oublierLesPerimes(manifeste);
    return true;
  }

  async function supprimer() {
    for (const nom of await cachesDeDonnees()) await caches.delete(nom);
  }

  /* Les données d'une mouture qui ne resservira plus.
   *
   * Un cache d'une autre mouture part dans deux cas seulement : le paquet de
   * la mouture courante est entier — l'ancien a été remplacé —, ou l'ancien
   * n'est pas utilisable lui-même, un téléchargement interrompu par exemple.
   * Tant qu'il est entier et que le nouveau ne l'est pas, il reste : c'est
   * lui que le dictionnaire lit.
   *
   * C'est la **seule** suppression automatique que s'autorise l'application :
   * ce qui est effacé ici est inutilisable ou remplacé, alors que le cache
   * courant représente un téléchargement que l'utilisateur a payé de son
   * forfait et que personne ne doit lui reprendre sans le lui demander. */
  async function oublierLesPerimes(manifeste) {
    if (!('caches' in racine)) return 0;
    const courant = nomDuCache(manifeste);
    const nouveauEntier = await complet(manifeste);
    const garde = nouveauEntier ? null : await ancien(manifeste);
    let effaces = 0;
    for (const nom of await cachesDeDonnees()) {
      if (nom === courant || (garde && nom === garde.nom)) continue;
      await caches.delete(nom);
      effaces += 1;
    }
    return effaces;
  }

  /* Poids annoncé à l'utilisateur avant qu'il ne décide. */
  function poids(manifeste) {
    return manifeste.paquets.complet.octets;
  }

  /* Une taille lisible, dans les unités et avec le séparateur décimal de la
   * langue affichée : « 30,1 Mo » en français, « 30.1 MB » en anglais. */
  const UNITES = {
    fr: ['o', 'Ko', 'Mo', 'Go'],
    en: ['B', 'KB', 'MB', 'GB'],
  };

  function humain(octets, langue) {
    const unites = UNITES[langue] || UNITES.fr;
    let valeur = octets;
    let rang = 0;
    while (valeur >= 1024 && rang < unites.length - 1) { valeur /= 1024; rang += 1; }
    const nombre = rang === 0 ? Math.round(valeur) : valeur.toFixed(1);
    const texte = String(nombre);
    return (langue === 'en' ? texte : texte.replace('.', ',')) + ' ' + unites[rang];
  }

  racine.Paquets = { complet, ancien, manquants, telecharger, supprimer, oublierLesPerimes,
                     poids, humain, nomDuCache };

})(window);
