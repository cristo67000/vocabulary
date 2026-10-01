/*
 * Un IndexedDB de laboratoire, en mémoire.
 *
 * ── Pourquoi pas une bibliothèque ──────────────────────────────────────────
 *
 * L'application n'a aucune dépendance, pas de `package.json`, pas d'étape de
 * compilation : c'est ce qui la rend réparable dans dix ans. Ajouter
 * `fake-indexeddb` pour éprouver le stockage introduirait un `node_modules` et
 * un fichier de verrous dans un dépôt qui n'en a pas — un prix élevé pour ce
 * qu'on demande.
 *
 * Ce qu'on demande est étroit : `js/store.js` n'emploie qu'une douzaine
 * d'appels d'IndexedDB. On les rend, fidèlement pour ce qui compte, et on ne
 * rend rien d'autre. Un appel non prévu lève plutôt que de mentir.
 *
 * ── Ce qui est fidèle, et qui compte ───────────────────────────────────────
 *
 *   les valeurs sont **clonées** à l'écriture comme à la lecture, ce qui est
 *   exactement ce que fait IndexedDB. Sans cela, une épreuve de migration
 *   passerait par simple partage de référence, sans rien prouver ;
 *
 *   un index ne range **pas** les enregistrements où sa clé manque. C'est la
 *   propriété sur laquelle repose la séparation des cartes du dictionnaire et
 *   des cartes de mots personnels : les premières n'ont pas de champ `perso` ;
 *
 *   `onupgradeneeded` reçoit `oldVersion`, et la transaction de migration voit
 *   les magasins existants avec leurs données.
 */

function cloner(valeur) {
  return valeur === undefined ? undefined : structuredClone(valeur);
}

function lireChemin(objet, chemin) {
  let courant = objet;
  for (const morceau of String(chemin).split('.')) {
    if (courant === null || courant === undefined) return undefined;
    courant = courant[morceau];
  }
  return courant;
}

/* L'ordre des clés d'IndexedDB, réduit à ce qu'on stocke : des nombres et des
 * chaînes. Les nombres passent avant les chaînes, comme dans la spécification. */
function comparer(a, b) {
  const rang = (v) => (typeof v === 'number' ? 0 : 1);
  if (rang(a) !== rang(b)) return rang(a) - rang(b);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export class FauxKeyRange {
  constructor(bas, haut, basOuvert, hautOuvert) {
    this.lower = bas;
    this.upper = haut;
    this.lowerOpen = !!basOuvert;
    this.upperOpen = !!hautOuvert;
  }

  static upperBound(haut, ouvert) { return new FauxKeyRange(undefined, haut, false, ouvert); }
  static lowerBound(bas, ouvert) { return new FauxKeyRange(bas, undefined, ouvert, false); }
  static bound(bas, haut) { return new FauxKeyRange(bas, haut, false, false); }
  static only(valeur) { return new FauxKeyRange(valeur, valeur, false, false); }

  contient(cle) {
    if (this.lower !== undefined) {
      const c = comparer(cle, this.lower);
      if (c < 0 || (c === 0 && this.lowerOpen)) return false;
    }
    if (this.upper !== undefined) {
      const c = comparer(cle, this.upper);
      if (c > 0 || (c === 0 && this.upperOpen)) return false;
    }
    return true;
  }
}

class FauxRequete {
  constructor(executer) {
    this.onsuccess = null;
    this.onerror = null;
    this.result = undefined;
    this.error = null;
    /* Une micro-tâche, comme le fait un vrai IndexedDB : l'appelant a le temps
     * de poser ses gestionnaires avant que le résultat n'arrive. */
    queueMicrotask(() => {
      try {
        this.result = executer();
        if (this.onsuccess) this.onsuccess({ target: this });
      } catch (erreur) {
        this.error = erreur;
        if (this.onerror) this.onerror({ target: this });
        else throw erreur;
      }
    });
  }
}

class FauxIndex {
  constructor(magasin, nom, chemin) {
    this.magasin = magasin;
    this.name = nom;
    this.keyPath = chemin;
  }

  getAll(cle) {
    return new FauxRequete(() => {
      const sortie = [];
      for (const valeur of this.magasin.lignes.values()) {
        const indexee = lireChemin(valeur, this.keyPath);
        // Une valeur sans la clé de l'index n'y est pas rangée du tout.
        if (indexee === undefined || indexee === null) continue;
        if (cle === undefined) { sortie.push(cloner(valeur)); continue; }
        if (cle instanceof FauxKeyRange) {
          if (cle.contient(indexee)) sortie.push(cloner(valeur));
        } else if (comparer(indexee, cle) === 0) {
          sortie.push(cloner(valeur));
        }
      }
      sortie.sort((a, b) => comparer(lireChemin(a, this.keyPath),
                                     lireChemin(b, this.keyPath)));
      return sortie;
    });
  }
}

class FauxMagasin {
  constructor(donnees, transaction) {
    this.donnees = donnees;
    this.transaction = transaction;
    this.name = donnees.nom;
  }

  get lignes() { return this.donnees.lignes; }

  get indexNames() {
    const noms = Object.keys(this.donnees.index);
    return { contains: (n) => noms.indexOf(n) !== -1, length: noms.length };
  }

  createIndex(nom, chemin) {
    this.donnees.index[nom] = chemin;
    return new FauxIndex(this.donnees, nom, chemin);
  }

  index(nom) {
    const chemin = this.donnees.index[nom];
    if (chemin === undefined) throw new Error('index inconnu : ' + nom);
    return new FauxIndex(this.donnees, nom, chemin);
  }

  put(valeur) {
    return new FauxRequete(() => {
      const copie = cloner(valeur);
      if (this.donnees.autoIncrement && copie[this.donnees.keyPath] === undefined) {
        this.donnees.prochain += 1;
        copie[this.donnees.keyPath] = this.donnees.prochain;
      }
      const cle = lireChemin(copie, this.donnees.keyPath);
      if (cle === undefined) throw new Error('clé absente pour ' + this.donnees.nom);
      this.donnees.lignes.set(cle, copie);
      return cle;
    });
  }

  add(valeur) { return this.put(valeur); }

  get(cle) {
    return new FauxRequete(() => cloner(this.donnees.lignes.get(cle)));
  }

  delete(cle) {
    return new FauxRequete(() => { this.donnees.lignes.delete(cle); });
  }

  getAll() {
    return new FauxRequete(() => [...this.donnees.lignes.values()].map(cloner));
  }

  /* Un curseur qui parcourt tout le magasin. `store.js` ne s'en sert que pour
   * la migration v1 → v2, où il réécrit et efface au passage : on parcourt donc
   * une copie de la liste des clés, comme le ferait un vrai curseur avec son
   * instantané. */
  openCursor() {
    const cles = [...this.donnees.lignes.keys()];
    let position = 0;
    const magasin = this;
    const requete = { onsuccess: null, onerror: null, result: null };
    function avancer() {
      queueMicrotask(() => {
        while (position < cles.length && !magasin.donnees.lignes.has(cles[position])) {
          position += 1;
        }
        if (position >= cles.length) {
          requete.result = null;
          if (requete.onsuccess) requete.onsuccess({ target: requete });
          return;
        }
        const cle = cles[position];
        position += 1;
        requete.result = {
          key: cle,
          value: cloner(magasin.donnees.lignes.get(cle)),
          continue: avancer,
        };
        if (requete.onsuccess) requete.onsuccess({ target: requete });
      });
    }
    avancer();
    return requete;
  }
}

class FauxTransaction {
  constructor(base, noms) {
    this.base = base;
    this.noms = noms;
  }

  objectStore(nom) {
    const donnees = this.base.magasins[nom];
    if (!donnees) throw new Error('magasin inconnu : ' + nom);
    return new FauxMagasin(donnees, this);
  }
}

class FausseBase {
  constructor(depot) {
    this.depot = depot;
    this.onversionchange = null;
    this.ferme = false;
  }

  get magasins() { return this.depot.magasins; }
  get version() { return this.depot.version; }

  get objectStoreNames() {
    const noms = Object.keys(this.depot.magasins);
    return { contains: (n) => noms.indexOf(n) !== -1, length: noms.length };
  }

  createObjectStore(nom, options) {
    const reglages = options || {};
    this.depot.magasins[nom] = {
      nom,
      keyPath: reglages.keyPath,
      autoIncrement: !!reglages.autoIncrement,
      prochain: 0,
      lignes: new Map(),
      index: {},
    };
    return new FauxMagasin(this.depot.magasins[nom], null);
  }

  transaction(noms) {
    if (this.ferme) throw new Error('base fermée');
    return new FauxTransaction(this, Array.isArray(noms) ? noms : [noms]);
  }

  close() { this.ferme = true; }
}

/* Le dépôt : ce qui survit à la fermeture de la base, c'est-à-dire au
 * rechargement de l'application. C'est lui qu'on garde entre deux évaluations
 * de `store.js` pour éprouver qu'une donnée écrite hier est relue demain. */
export function nouveauDepot(version) {
  return { version: version || 0, magasins: {} };
}

export function fabriquerIndexedDB(depot) {
  return {
    open(nom, version) {
      const requete = {
        onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null,
        result: null, error: null,
      };
      queueMicrotask(() => {
        const base = new FausseBase(depot);
        const ancienne = depot.version;
        if (version > ancienne) {
          depot.version = version;
          const transaction = new FauxTransaction(base, Object.keys(depot.magasins));
          if (requete.onupgradeneeded) {
            requete.onupgradeneeded({
              target: { result: base, transaction },
              oldVersion: ancienne,
              newVersion: version,
            });
          }
        }
        requete.result = base;
        /* Les micro-tâches posées pendant la migration — un curseur, par
         * exemple — doivent finir avant que l'appelant ne croie la base prête.
         * Un vrai IndexedDB ne signale le succès qu'à la fin de la transaction
         * de version ; on lui laisse quelques tours de boucle. */
        let tours = 0;
        const attendre = () => {
          tours += 1;
          if (tours < 12) { queueMicrotask(attendre); return; }
          if (requete.onsuccess) requete.onsuccess({ target: requete });
        };
        queueMicrotask(attendre);
      });
      return requete;
    },
  };
}
