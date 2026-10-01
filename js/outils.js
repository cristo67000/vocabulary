'use strict';
/*
 * Petits outils partagés — repris de Code en clair, pour le moteur de schémas.
 *
 * `svg()` fabrique un nœud SVG par `setAttribute` et `textContent` : rien n'est
 * jamais interprété comme du balisage, et aucun attribut `style` n'est posé
 * (la politique de sécurité de l'application l'interdit).
 */
(function (racine) {

  const NS_SVG = 'http://www.w3.org/2000/svg';

  function svg(balise, attributs, texte) {
    const noeud = document.createElementNS(NS_SVG, balise);
    if (attributs) {
      for (const cle of Object.keys(attributs)) {
        if (attributs[cle] !== undefined && attributs[cle] !== null) noeud.setAttribute(cle, attributs[cle]);
      }
    }
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  racine.Outils = { svg, NS_SVG };

})(window);
