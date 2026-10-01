'use strict';
/*
 * Moteur de schémas : décrit un dessin en quelques lignes de données, le
 * dessine en SVG.
 *
 * Un glossaire illustré compte des dizaines de figures. Les écrire une à une en
 * SVG à la main les rendrait impossibles à relire, à corriger, à traduire et à
 * adapter au thème sombre. Ici, une figure est une petite description
 * (js/schemas/*.js) et ce module en fait le dessin — toujours à l'échelle de la
 * largeur de l'écran, avec les couleurs du thème, dans la langue choisie.
 *
 * Sept genres de figures, chacun pour une famille de sujets :
 *
 *   graphe     des cases reliées par des flèches, posées sur une grille
 *              (dépôt local / distant, requête / réponse, chaîne de build…)
 *   commits    l'historique Git : pastilles, branches, étiquettes
 *   cases      des cellules alignées (bits, octets, caractères, codage)
 *   pile       des couches empilées, une ou deux piles face à face
 *   arbre      un arbre (DOM, JSON) ou une arborescence de fichiers
 *   sequence   des échanges dans le temps entre plusieurs acteurs
 *   dessin     des formes libres, quand rien de ce qui précède ne convient
 *
 * Tout texte est une chaîne, ou un couple [français, anglais]. Rien n'est
 * jamais interprété comme du HTML : tout passe par `setAttribute` et
 * `textContent`, et jamais par l'attribut « style », que la politique de
 * sécurité de l'application interdit.
 *
 * Les couleurs viennent de classes (`dn-a`, `dl-ok`, `dt-bad`…) que la feuille
 * de style relie aux variables du thème : clair et sombre sans une ligne ici.
 */
(function (racine) {

  const { svg } = Outils;
  const L = 360;               // largeur de la zone de dessin, en unités
  let compteur = 0;            // pour des identifiants de marqueurs uniques

  // ── Textes ────────────────────────────────────────────────────────────────

  function tr(valeur, langue) {
    if (Array.isArray(valeur)) return (langue === 'en' ? valeur[1] : valeur[0]) || valeur[0] || '';
    return valeur === undefined || valeur === null ? '' : String(valeur);
  }

  /* La largeur d'un texte, estimée : on ne peut pas la mesurer avant que le
   * dessin soit dans la page, et il faut dimensionner les cases avant. La
   * table est celle d'une police sans empattements courante ; une case a de
   * la marge, une erreur de quelques pour cent ne se voit pas. */
  const ETROITS = new Set("iljtfI.,:;'|!()[]/ ".split(''));
  const LARGES = new Set('mwMW@%'.split(''));
  function largeur(chaine, taille, mono) {
    const signes = Array.from(chaine);
    if (mono) return signes.length * taille * 0.6;
    let w = 0;
    for (const c of signes) {
      if (ETROITS.has(c)) w += 0.32;
      else if (LARGES.has(c)) w += 0.84;
      else if (c >= 'A' && c <= 'Z') w += 0.66;
      else w += 0.54;
    }
    return w * taille;
  }

  function envelopper(chaine, max, taille, mono) {
    const sortie = [];
    for (const paragraphe of String(chaine).split('\n')) {
      let ligne = '';
      for (const mot of paragraphe.split(' ')) {
        const essai = ligne ? ligne + ' ' + mot : mot;
        if (ligne && largeur(essai, taille, mono) > max) { sortie.push(ligne); ligne = mot; }
        else ligne = essai;
      }
      sortie.push(ligne);
    }
    return sortie;
  }

  function largeurMax(lignes, taille, mono) {
    return lignes.reduce((m, l) => Math.max(m, largeur(l, taille, mono)), 0);
  }

  /* Un bloc de texte à plusieurs lignes, centré verticalement sur `cy`. */
  function ecrire(parent, x, cy, lignes, o) {
    const opt = o || {};
    const taille = opt.sz || 12;
    const inter = opt.lh || taille * 1.22;
    const t = svg('text', {
      x, y: cy - ((lignes.length - 1) * inter) / 2 + taille * 0.35,
      'text-anchor': opt.a || 'middle',
      'font-size': taille,
      class: 'dt dt-' + (opt.s || 'n') + (opt.mono ? ' dmono' : '') + (opt.b ? ' dbold' : '') + (opt.halo ? ' dhalo' : ''),
    });
    lignes.forEach((l, i) => {
      t.appendChild(svg('tspan', { x, dy: i === 0 ? 0 : inter }, l));
    });
    parent.appendChild(t);
    return t;
  }

  // ── Formes ────────────────────────────────────────────────────────────────

  /* Les marqueurs de flèche : un par style utilisé, créés à la demande. */
  function marqueur(ctx, style) {
    const nom = 'fl-' + ctx.id + '-' + (style || 'n');
    if (!ctx.marqueurs.has(nom)) {
      ctx.marqueurs.add(nom);
      const m = svg('marker', {
        id: nom, viewBox: '0 0 10 10', refX: '8.5', refY: '5', markerWidth: '7', markerHeight: '7',
        orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse',
      });
      m.appendChild(svg('path', { d: 'M0,1.2 L9,5 L0,8.8 z', class: 'dm dm-' + (style || 'n') }));
      ctx.defs.appendChild(m);
    }
    return nom;
  }

  /* Un trait, éventuellement fléché à un bout ou aux deux. */
  function trait(ctx, x1, y1, x2, y2, o) {
    const opt = o || {};
    const l = svg('line', {
      x1, y1, x2, y2,
      class: 'dl dl-' + (opt.s || 'n') + (opt.dash ? ' dd' : ''),
    });
    if (opt.fin !== false && opt.fleche !== 'aucune') {
      l.setAttribute('marker-end', 'url(#' + marqueur(ctx, opt.s) + ')');
    }
    if (opt.fleche === 'double') l.setAttribute('marker-start', 'url(#' + marqueur(ctx, opt.s) + ')');
    (opt.parent || ctx.g).appendChild(l);
    return l;
  }

  function chemin(ctx, d, o) {
    const opt = o || {};
    const p = svg('path', {
      d, class: 'dl dl-' + (opt.s || 'n') + (opt.dash ? ' dd' : '') + (opt.plein ? ' dn dn-' + (opt.s || 'n') : ' dnf'),
    });
    if (opt.fleche) p.setAttribute('marker-end', 'url(#' + marqueur(ctx, opt.s) + ')');
    (opt.parent || ctx.g).appendChild(p);
    return p;
  }

  /* Le contour d'un nœud, selon sa forme. */
  function forme(ctx, f, cx, cy, w, h, style, o) {
    const opt = o || {};
    // une forme à couleur libre (attribut fill) ne porte aucune classe de remplissage
    const classe = (opt.libre ? 'dfree' : 'dn dn-' + (style || 'n')) + (opt.dash ? ' dd' : '');
    const g = opt.parent || ctx.g;
    const x = cx - w / 2;
    const y = cy - h / 2;
    switch (f) {
      case 'pill':
        g.appendChild(svg('rect', { x, y, width: w, height: h, rx: h / 2, class: classe }));
        break;
      case 'circ':
        g.appendChild(svg('circle', { cx, cy, r: Math.max(w, h) / 2, class: classe }));
        break;
      case 'diam':
        g.appendChild(svg('polygon', {
          points: [cx, y, x + w, cy, cx, y + h, x, cy].join(','), class: classe,
        }));
        break;
      case 'db': {
        const ry = Math.min(9, h / 5);
        g.appendChild(svg('path', {
          d: 'M' + x + ',' + (y + ry) + ' A' + (w / 2) + ',' + ry + ' 0 0 1 ' + (x + w) + ',' + (y + ry)
            + ' V' + (y + h - ry) + ' A' + (w / 2) + ',' + ry + ' 0 0 1 ' + x + ',' + (y + h - ry) + ' Z',
          class: classe,
        }));
        g.appendChild(svg('path', {
          d: 'M' + x + ',' + (y + ry) + ' A' + (w / 2) + ',' + ry + ' 0 0 0 ' + (x + w) + ',' + (y + ry),
          class: 'dl dl-' + (style || 'n') + ' dnf',
        }));
        break;
      }
      case 'file': {
        const c = Math.min(12, h / 3);
        g.appendChild(svg('path', {
          d: 'M' + x + ',' + y + ' H' + (x + w - c) + ' L' + (x + w) + ',' + (y + c) + ' V' + (y + h)
            + ' H' + x + ' Z',
          class: classe,
        }));
        g.appendChild(svg('path', {
          d: 'M' + (x + w - c) + ',' + y + ' V' + (y + c) + ' H' + (x + w),
          class: 'dl dl-' + (style || 'n') + ' dnf',
        }));
        break;
      }
      case 'cloud': {
        const a = w / 100;
        const b = h / 60;
        const d = 'M' + (x + 24 * a) + ',' + (y + 52 * b)
          + ' C' + (x + 6 * a) + ',' + (y + 52 * b) + ' ' + (x + 2 * a) + ',' + (y + 28 * b) + ' ' + (x + 20 * a) + ',' + (y + 26 * b)
          + ' C' + (x + 20 * a) + ',' + (y + 6 * b) + ' ' + (x + 48 * a) + ',' + (y + 2 * b) + ' ' + (x + 56 * a) + ',' + (y + 16 * b)
          + ' C' + (x + 66 * a) + ',' + (y + 4 * b) + ' ' + (x + 90 * a) + ',' + (y + 12 * b) + ' ' + (x + 84 * a) + ',' + (y + 30 * b)
          + ' C' + (x + 104 * a) + ',' + (y + 30 * b) + ' ' + (x + 100 * a) + ',' + (y + 52 * b) + ' ' + (x + 80 * a) + ',' + (y + 52 * b) + ' Z';
        g.appendChild(svg('path', { d, class: classe }));
        break;
      }
      default:
        g.appendChild(svg('rect', { x, y, width: w, height: h, rx: opt.rx === undefined ? 8 : opt.rx, class: classe }));
    }
  }

  /* Le point où la demi-droite centre → cible sort d'une forme. */
  function sortie(cx, cy, w, h, forme_, tx, ty) {
    const dx = tx - cx;
    const dy = ty - cy;
    if (!dx && !dy) return [cx, cy];
    if (forme_ === 'circ') {
      const r = Math.max(w, h) / 2;
      const n = Math.hypot(dx, dy);
      return [cx + (dx / n) * r, cy + (dy / n) * r];
    }
    const t = Math.min(dx ? (w / 2) / Math.abs(dx) : Infinity, dy ? (h / 2) / Math.abs(dy) : Infinity);
    return [cx + dx * t, cy + dy * t];
  }

  // ── Fabrique d'un dessin ──────────────────────────────────────────────────

  function nouveau(hauteur, alt) {
    compteur += 1;
    const ctx = { id: compteur, marqueurs: new Set(), langue: 'fr' };
    ctx.racine = svg('svg', {
      viewBox: '0 0 ' + L + ' ' + Math.ceil(hauteur), width: '100%', role: 'img',
      class: 'schema-svg', focusable: 'false',
    });
    ctx.racine.setAttribute('aria-label', alt || '');
    ctx.defs = svg('defs');
    ctx.racine.appendChild(ctx.defs);
    ctx.g = svg('g');
    ctx.racine.appendChild(ctx.g);
    return ctx;
  }

  function fixerHauteur(ctx, h) {
    ctx.racine.setAttribute('viewBox', '0 0 ' + L + ' ' + Math.ceil(h));
  }

  // ── Genre « graphe » ──────────────────────────────────────────────────────

  function dessinerGraphe(spec, langue) {
    const ctx = nouveau(200, tr(spec.alt, langue));
    const noeuds = spec.n;
    const mx = spec.mx === undefined ? 10 : spec.mx;
    const colonnes = Math.max(...noeuds.map((n) => n.c + 1), spec.cols || 0);
    const rangees = Math.max(...noeuds.map((n) => n.r + 1));
    const largeurCol = (L - 2 * mx) / colonnes;
    const gy = spec.gy || 84;
    const haut = spec.haut !== undefined ? spec.haut : (spec.g ? 22 : 8);

    // dimensions de chaque nœud
    const info = new Map();
    let hMax = 0;
    for (const n of noeuds) {
      const dispo = Math.max(60, (n.w || largeurCol - 14));
      const nuage = n.f === 'cloud';
      const sz = n.sz || (nuage ? 11 : 12);
      // le texte d'un nuage doit tenir dans son corps, pas dans son contour
      const lignes = envelopper(tr(n.t, langue), nuage ? dispo * 0.68 : dispo - 14, sz, n.mono);
      const sous = n.sub ? envelopper(tr(n.sub, langue), dispo - 12, 10, true) : [];
      const wTexte = Math.max(largeurMax(lignes, sz, n.mono), largeurMax(sous, 10, true)) + 20;
      const w = n.w ? (nuage ? Math.max(n.w, largeurMax(lignes, sz, n.mono) / 0.68) : n.w) : Math.min(dispo, Math.max(64, wTexte));
      const h = n.h || Math.max(n.f === 'db' ? 48 : 38, lignes.length * sz * 1.22 + sous.length * 12 + 16);
      hMax = Math.max(hMax, h);
      info.set(n.id, {
        n, w, h, lignes, sous, sz,
        cx: mx + (n.c + 0.5) * largeurCol,
        cy: haut + 4 + hMax / 2 + n.r * gy,
      });
    }
    // les centres verticaux dépendent de hMax, connu seulement à la fin
    for (const v of info.values()) v.cy = haut + 4 + hMax / 2 + v.n.r * gy;
    const hauteur = haut + 8 + hMax + (rangees - 1) * gy + (spec.bas || 8);

    // groupes : encadrés en pointillé sous les nœuds
    for (const grp of spec.g || []) {
      const cibles = grp.ids.map((id) => info.get(id)).filter(Boolean);
      const x1 = Math.min(...cibles.map((v) => v.cx - v.w / 2)) - 10;
      const x2 = Math.max(...cibles.map((v) => v.cx + v.w / 2)) + 10;
      const y1 = Math.min(...cibles.map((v) => v.cy - v.h / 2)) - 14;
      const y2 = Math.max(...cibles.map((v) => v.cy + v.h / 2)) + 10;
      ctx.g.appendChild(svg('rect', {
        x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 10, class: 'dn dn-g dd',
      }));
      ecrire(ctx.g, x1 + 8, y1 + 8, [tr(grp.t, langue)], { sz: 10, a: 'start', s: 'mute', b: true });
    }

    // arêtes : les décalages pour les paires reliées plusieurs fois
    const paires = new Map();
    spec.e.forEach((e, i) => {
      const cle = [e[0], e[1]].sort().join('|');
      if (!paires.has(cle)) paires.set(cle, []);
      paires.get(cle).push(i);
    });
    const etiquettes = [];
    spec.e.forEach((e, i) => {
      const a = info.get(e[0]);
      const b = info.get(e[1]);
      if (!a || !b) return;
      const opts = String(e[3] || '').split(' ');
      const style = ['a', 'ok', 'warn', 'bad', 'mute', 'v', 'info'].find((s) => opts.includes(s)) || 'n';
      const groupe = paires.get([e[0], e[1]].sort().join('|'));
      const rang = groupe.indexOf(i);
      let dec = (rang - (groupe.length - 1) / 2) * 16;
      if (a.n.id > b.n.id) dec = -dec;          // même côté pour un même sens
      if (e[0] === e[1]) {                        // boucle sur soi-même
        const x = a.cx + a.w / 2;
        chemin(ctx, 'M' + (x - 10) + ',' + (a.cy - a.h / 2) + ' C' + (x + 26) + ',' + (a.cy - a.h / 2 - 22) + ' '
          + (x + 30) + ',' + (a.cy + 6) + ' ' + x + ',' + (a.cy + 4), { s: style, fleche: true, dash: opts.includes('dash') });
        if (e[2]) etiquettes.push({ x: x + 22, y: a.cy - a.h / 2 - 8, lignes: [tr(e[2], langue)], s: style, a: 'start' });
        return;
      }
      let dx = b.cx - a.cx;
      let dy = b.cy - a.cy;
      const n = Math.hypot(dx, dy);
      const px = (-dy / n) * dec;
      const py = (dx / n) * dec;
      const p1 = sortie(a.cx + px, a.cy + py, a.w + 4, a.h + 4, a.n.f, b.cx + px, b.cy + py);
      const p2 = sortie(b.cx + px, b.cy + py, b.w + 4, b.h + 4, b.n.f, a.cx + px, a.cy + py);
      trait(ctx, p1[0], p1[1], p2[0], p2[1], {
        s: style, dash: opts.includes('dash'),
        fleche: opts.includes('double') ? 'double' : (opts.includes('sans') ? 'aucune' : 'fin'),
      });
      if (e[2]) {
        const mxp = (p1[0] + p2[0]) / 2;
        const myp = (p1[1] + p2[1]) / 2;
        const lignes = envelopper(tr(e[2], langue), 150, 10.5, false);
        /* À côté d'un trait vertical, au-dessus ou au-dessous d'un trait
         * horizontal — du côté où le trait est décalé, pour que deux flèches
         * parallèles ne se marchent pas sur leurs étiquettes. */
        const vertical = Math.abs(dy) > Math.abs(dx) * 1.5;
        if (vertical) {
          const cote = px < -0.5 ? -1 : 1;
          etiquettes.push({ x: mxp + cote * 8, y: myp, lignes, s: style, a: cote > 0 ? 'start' : 'end' });
        } else {
          const cote = py > 0.5 ? 1 : -1;
          const demi = ((lignes.length - 1) * 10.5 * 1.22) / 2;
          etiquettes.push({
            x: mxp, y: cote < 0 ? myp - 8 - demi : myp + 10 + demi, lignes, s: style, a: 'middle',
          });
        }
      }
    });

    // nœuds, par-dessus les traits
    for (const v of info.values()) {
      const n = v.n;
      forme(ctx, n.f || 'box', v.cx, v.cy, v.w, v.h, n.s, { dash: n.dash });
      // sous le couvercle d'un cylindre, pas dessus
      const descente = n.f === 'db' ? 4 : 0;
      const decal = v.sous.length ? (v.sous.length * 12) / 2 : 0;
      ecrire(ctx.g, v.cx, v.cy - decal + descente, v.lignes, { sz: v.sz, s: n.s === 'mute' ? 'mute' : 'n', mono: n.mono, b: n.b });
      if (v.sous.length) ecrire(ctx.g, v.cx, v.cy + (v.lignes.length * v.sz * 1.22) / 2 + 2 + descente, v.sous, { sz: 10, mono: true, s: 'mute' });
    }
    for (const et of etiquettes) {
      ecrire(ctx.g, et.x, et.y, et.lignes, { sz: 10.5, s: et.s, a: et.a, halo: true, b: true });
    }
    fixerHauteur(ctx, hauteur);
    return ctx.racine;
  }

  // ── Genre « commits » ─────────────────────────────────────────────────────

  function dessinerCommits(spec, langue) {
    const ctx = nouveau(160, tr(spec.alt, langue));
    const couloirs = spec.lanes || [''];
    const dessous = (spec.lab || []).some((x) => x.dessous || x.s === 'tag');
    const dessus = (spec.lab || []).some((x) => !(x.dessous || x.s === 'tag'));
    const hauteurCouloir = spec.lh || (couloirs.length === 1 ? 46 : 58);
    const avecNoms = couloirs.some(Boolean);
    const noms = couloirs.map((c) => tr(c, langue));
    const ml = avecNoms ? Math.min(96, Math.max(...noms.map((n) => largeur(n, 10.5, true))) + 14) : 10;
    const xMax = Math.max(...spec.c.map((c) => c.x));
    const rayon = 13;
    const unite = Math.min(58, (L - ml - 24) / Math.max(xMax, 1));
    const empilesDessus = Math.max(1, ...Object.values((spec.lab || []).filter((x) => !(x.dessous || x.s === 'tag'))
      .reduce((m, x) => { m[x.c] = (m[x.c] || 0) + 1; return m; }, {})));
    const haut = spec.top !== undefined ? spec.top
      : (dessus ? Math.max(10, 37 + (empilesDessus - 1) * 18 - hauteurCouloir / 2) : 10);
    const pos = new Map();
    for (const c of spec.c) {
      pos.set(c.i, { c, x: ml + 12 + c.x * unite, y: haut + c.l * hauteurCouloir + hauteurCouloir / 2 });
    }
    const hauteur = haut + couloirs.length * hauteurCouloir + (spec.bas !== undefined ? spec.bas : (dessous ? Math.max(8, 37 - hauteurCouloir / 2) : 6));

    // couloirs : un fin repère par branche
    couloirs.forEach((nom, i) => {
      const y = haut + i * hauteurCouloir + hauteurCouloir / 2;
      if (i > 0 || couloirs.length > 1) {
        ctx.g.appendChild(svg('line', { x1: ml - 4, y1: y, x2: L - 6, y2: y, class: 'dl dl-g dd dfin' }));
      }
      if (noms[i]) ecrire(ctx.g, 6, y, [noms[i]], { sz: 10.5, a: 'start', mono: true, s: 'mute', b: true });
    });

    // liens parent → enfant
    for (const c of spec.c) {
      for (const pid of c.p || []) {
        const a = pos.get(pid);
        const b = pos.get(c.i);
        if (!a || !b) continue;
        const style = c.s === 'old' ? 'mute' : (c.ls || (c.s === 'new' ? 'a' : 'n'));
        const dash = c.s === 'old' || c.dash;
        if (a.y === b.y) {
          trait(ctx, a.x + rayon, a.y, b.x - rayon, b.y, { s: style, dash, fleche: 'aucune' });
        } else {
          const dx = Math.min(30, (b.x - a.x) / 2);
          chemin(ctx, 'M' + (a.x + rayon * 0.7) + ',' + (a.y + Math.sign(b.y - a.y) * rayon * 0.7)
            + ' C' + (a.x + dx + rayon) + ',' + a.y + ' ' + (b.x - dx - rayon) + ',' + b.y + ' ' + (b.x - rayon) + ',' + b.y,
            { s: style, dash });
        }
      }
    }
    // pastilles
    for (const { c, x, y } of pos.values()) {
      if (c.s === 'gap') { ecrire(ctx.g, x, y, ['…'], { sz: 16, s: 'mute', b: true }); continue; }
      const style = c.s === 'old' ? 'mute' : (c.s === 'new' ? 'a' : (c.s || 'n'));
      forme(ctx, 'circ', x, y, rayon * 2, rayon * 2, style, { dash: c.s === 'old' });
      ecrire(ctx.g, x, y, [tr(c.t === undefined ? c.i : c.t, langue)], { sz: 9.5, mono: true, s: c.s === 'old' ? 'mute' : 'n', b: true });
    }
    // étiquettes : au-dessus (branches, HEAD) ou en dessous (versions)
    const pile = new Map();
    for (const lab of spec.lab || []) {
      const p = pos.get(lab.c);
      if (!p) continue;
      const dessous = lab.dessous || lab.s === 'tag';
      const cle = lab.c + (dessous ? 'b' : 'h');
      const n = pile.get(cle) || 0;
      pile.set(cle, n + 1);
      const t = tr(lab.t, langue);
      const w = largeur(t, 9.5, true) + 12;
      const y = dessous ? p.y + rayon + 12 + n * 18 : p.y - rayon - 12 - n * 18;
      const style = lab.s === 'tag' ? 'warn' : (lab.s === 'head' ? 'ok' : (lab.s || 'a'));
      let x = Math.min(L - w / 2 - 4, Math.max(w / 2 + 4, p.x));
      ctx.g.appendChild(svg('rect', { x: x - w / 2, y: y - 8, width: w, height: 16, rx: 8, class: 'dn dn-' + style }));
      ecrire(ctx.g, x, y, [t], { sz: 9.5, mono: true, s: style === 'a' ? 'a' : style, b: true });
    }
    fixerHauteur(ctx, hauteur);
    return ctx.racine;
  }

  // ── Genre « cases » ───────────────────────────────────────────────────────

  function dessinerCases(spec, langue) {
    const ctx = nouveau(160, tr(spec.alt, langue));
    let y = 10;
    const mx = spec.mx === undefined ? 10 : spec.mx;
    for (const rangee of spec.rows) {
      if (rangee.sep !== undefined) {
        // une flèche entre deux rangées, avec un commentaire
        trait(ctx, L / 2, y, L / 2, y + 22, { s: rangee.s || 'mute' });
        if (rangee.sep) ecrire(ctx.g, L / 2 + 10, y + 11, [tr(rangee.sep, langue)], { sz: 10.5, a: 'start', s: rangee.s || 'mute', b: true });
        y += 30;
        continue;
      }
      if (rangee.t) {
        ecrire(ctx.g, mx, y + 6, [tr(rangee.t, langue)], { sz: 11, a: 'start', b: true, s: 'mute' });
        y += 16;
      }
      const cellules = rangee.cells.map((c) => tr(c, langue));
      const n = cellules.length;
      const ecart = rangee.gap || [];            // indices après lesquels on ajoute un espace
      const espaces = ecart.length * 8;
      const wMax = rangee.w || 42;
      const w = Math.max(14, Math.min(wMax, (L - 2 * mx - espaces - (n - 1) * 3) / n));
      const h = rangee.h || 32;
      const total = n * w + (n - 1) * 3 + espaces;
      let x = rangee.align === 'gauche' ? mx : (L - total) / 2;
      const centres = [];
      const styles = Array.isArray(rangee.s) ? rangee.s : cellules.map(() => rangee.s || '');
      cellules.forEach((c, i) => {
        const wCell = (rangee.ws && rangee.ws[i]) || w;
        if (rangee.ws) { /* largeur propre : on recalcule plus bas */ }
        forme(ctx, 'box', x + wCell / 2, y + h / 2, wCell, h, styles[i] || undefined, { rx: 5 });
        const lignes = envelopper(c, wCell - 4, rangee.sz || 13, rangee.mono !== false);
        ecrire(ctx.g, x + wCell / 2, y + h / 2, lignes, { sz: rangee.sz || 13, mono: rangee.mono !== false, b: true });
        centres.push([x, x + wCell]);
        x += wCell + 3 + (ecart.includes(i) ? 8 : 0);
      });
      y += h;
      if (rangee.cap) {
        rangee.cap.forEach((c, i) => {
          if (!centres[i]) return;
          const t = tr(c, langue);
          if (t) ecrire(ctx.g, (centres[i][0] + centres[i][1]) / 2, y + 10, [t], { sz: Math.min(10, w / 3.6 + 5), s: 'mute', mono: true });
        });
        y += 18;
      }
      for (const acc of rangee.brace || []) {
        const x1 = centres[acc[0]][0];
        const x2 = centres[acc[1]][1];
        chemin(ctx, 'M' + x1 + ',' + (y + 4) + ' V' + (y + 8) + ' H' + x2 + ' V' + (y + 4), { s: 'mute' });
        if (acc[2]) ecrire(ctx.g, (x1 + x2) / 2, y + 20, [tr(acc[2], langue)], { sz: 10.5, s: 'mute', b: true });
        else y -= 8;
      }
      if (rangee.brace && rangee.brace.length) y += 30;
      y += rangee.espace === undefined ? 10 : rangee.espace;
    }
    fixerHauteur(ctx, y + 4);
    return ctx.racine;
  }

  // ── Genre « pile » ────────────────────────────────────────────────────────

  function dessinerPile(spec, langue) {
    const ctx = nouveau(200, tr(spec.alt, langue));
    const piles = spec.piles;
    const mx = 10;
    const largeurPile = piles.length === 1 ? L - 2 * mx : (L - 2 * mx - (spec.entre || 50)) / piles.length;
    const hCouche = spec.lh || 38;
    const petit = 4;
    let hauteur = 0;
    const cadres = [];
    piles.forEach((pile, k) => {
      const x = mx + k * (largeurPile + (spec.entre || 50));
      let y = 10;
      if (pile.t) { ecrire(ctx.g, x + largeurPile / 2, y + 6, [tr(pile.t, langue)], { sz: 12, b: true, s: 'mute' }); y += 20; }
      const rangees = [];
      pile.layers.forEach((couche, i) => {
        const lignes = envelopper(tr(couche.t, langue), largeurPile - 16, 12, couche.mono);
        const detail = couche.d ? envelopper(tr(couche.d, langue), largeurPile - 16, 10, false) : [];
        const h = couche.h || Math.max(hCouche, lignes.length * 15 + detail.length * 12 + 12);
        forme(ctx, 'box', x + largeurPile / 2, y + h / 2, largeurPile, h, couche.s, { rx: 6 });
        const decal = detail.length ? (detail.length * 12) / 2 : 0;
        ecrire(ctx.g, x + largeurPile / 2, y + h / 2 - decal, lignes, { sz: 12, b: true, mono: couche.mono });
        if (detail.length) ecrire(ctx.g, x + largeurPile / 2, y + h / 2 + (lignes.length * 15) / 2 + 1, detail, { sz: 10, s: 'mute' });
        rangees.push({ y: y + h / 2, x, w: largeurPile });
        y += h + petit;
      });
      cadres.push(rangees);
      hauteur = Math.max(hauteur, y + 6);
    });
    for (const lien of spec.liens || []) {
      const a = cadres[0][lien[0]];
      const b = cadres[1][lien[1]];
      if (!a || !b) continue;
      const opts = String(lien[3] || '');
      trait(ctx, a.x + a.w + 2, a.y, b.x - 2, b.y, {
        s: opts.includes('a') ? 'a' : 'mute', dash: opts.includes('dash'), fleche: opts.includes('double') ? 'double' : 'aucune',
      });
      if (lien[2]) ecrire(ctx.g, (a.x + a.w + b.x) / 2, (a.y + b.y) / 2 - 7, [tr(lien[2], langue)], { sz: 9.5, s: 'mute', b: true, halo: true });
    }
    if (spec.fleche) {
      // une flèche verticale « ce qui descend / ce qui monte » au centre
      ecrire(ctx.g, L / 2, hauteur + 6, [tr(spec.fleche, langue)], { sz: 10.5, s: 'mute', b: true });
      hauteur += 18;
    }
    fixerHauteur(ctx, hauteur);
    return ctx.racine;
  }

  // ── Genre « arbre » ───────────────────────────────────────────────────────

  function dessinerArbre(spec, langue) {
    if (spec.mode === 'liste') return dessinerListe(spec, langue);
    const ctx = nouveau(200, tr(spec.alt, langue));
    const mx = 8;
    // largeur de feuille : on réduit si l'arbre est trop large pour l'écran
    const feuilles = [];
    (function compter(n) { if (!n.k || !n.k.length) feuilles.push(n); else n.k.forEach(compter); })(spec.racine);
    const profondeur = (function prof(n) { return 1 + Math.max(0, ...(n.k || []).map(prof)); })(spec.racine);
    const disponible = L - 2 * mx;
    const wNoeud = Math.max(38, Math.min(spec.w || 84, disponible / feuilles.length - 6));
    const sz = wNoeud < 56 ? 9.5 : (wNoeud < 70 ? 10.5 : 11.5);
    const pas = Math.min(wNoeud + 8, disponible / feuilles.length);
    const gy = spec.gy || 54;
    const hN = spec.h || 28;
    let suivant = 0;
    (function placer(n, niveau) {
      n.niveau = niveau;
      if (!n.k || !n.k.length) { n.x = (suivant + 0.5) * pas; suivant += 1; }
      else {
        n.k.forEach((k) => placer(k, niveau + 1));
        n.x = (n.k[0].x + n.k[n.k.length - 1].x) / 2;
      }
    })(spec.racine, 0);
    const largeurTotale = feuilles.length * pas;
    const decalage = mx + (disponible - largeurTotale) / 2;
    const hauteur = 10 + profondeur * gy - (gy - hN) + 10;
    (function lier(n) {
      for (const k of n.k || []) {
        const x1 = decalage + n.x;
        const y1 = 10 + n.niveau * gy + hN;
        const x2 = decalage + k.x;
        const y2 = 10 + k.niveau * gy;
        const my = (y1 + y2) / 2;
        chemin(ctx, 'M' + x1 + ',' + y1 + ' V' + my + ' H' + x2 + ' V' + y2, { s: 'mute' });
        lier(k);
      }
    })(spec.racine);
    (function dessiner(n) {
      const cx = decalage + n.x;
      const cy = 10 + n.niveau * gy + hN / 2;
      forme(ctx, n.f || 'box', cx, cy, wNoeud, hN, n.s, { rx: 6 });
      const lignes = envelopper(tr(n.t, langue), wNoeud - 6, sz, spec.mono !== false);
      ecrire(ctx.g, cx, cy, lignes.slice(0, 2), { sz: lignes.length > 1 ? sz - 1.5 : sz, mono: spec.mono !== false, b: true });
      (n.k || []).forEach(dessiner);
    })(spec.racine);
    fixerHauteur(ctx, hauteur);
    return ctx.racine;
  }

  /* Une arborescence de fichiers : une ligne par élément, un commentaire à
   * droite. */
  function dessinerListe(spec, langue) {
    const ctx = nouveau(200, tr(spec.alt, langue));
    const lignes = [];
    (function aplatir(n, niveau, dernier) {
      lignes.push({ n, niveau });
      (n.k || []).forEach((k, i) => aplatir(k, niveau + 1, i === n.k.length - 1));
    })(spec.racine, 0);
    const inter = spec.lh || 24;
    const mx = 12;
    let y = 8;
    lignes.forEach(({ n, niveau }) => {
      const x = mx + niveau * 16;
      const cy = y + inter / 2;
      if (niveau > 0) {
        chemin(ctx, 'M' + (x - 9) + ',' + cy + ' H' + (x - 2), { s: 'mute' });
        chemin(ctx, 'M' + (x - 9) + ',' + (cy - inter / 2) + ' V' + cy, { s: 'mute' });
      }
      const dossier = n.d || (n.k && n.k.length);
      if (dossier) {
        ctx.g.appendChild(svg('path', {
          d: 'M' + x + ',' + (cy - 5) + ' h5 l2,2 h7 v9 h-14 z', class: 'dn dn-' + (n.s || 'a'),
        }));
      } else {
        ctx.g.appendChild(svg('path', {
          d: 'M' + (x + 1) + ',' + (cy - 6) + ' h8 l4,4 v10 h-12 z', class: 'dn dn-' + (n.s || 'n'),
        }));
      }
      const nom = tr(n.t, langue);
      ecrire(ctx.g, x + 20, cy, [nom], { sz: 12, a: 'start', mono: true, b: !!dossier, s: n.s === 'mute' ? 'mute' : 'n' });
      if (n.c) {
        const cw = largeur(nom, 12, true);
        const t = tr(n.c, langue);
        const dispo = L - 10 - (x + 26 + cw);
        // le commentaire va à droite, ou sous le nom s'il n'y a pas la place
        ecrire(ctx.g, L - 10, cy, [t], { sz: 10.5, a: 'end', s: n.cs || 'a', b: false });
        if (largeur(t, 10.5) > dispo) { /* trop serré : la revue visuelle le dira */ }
      }
      y += inter;
    });
    fixerHauteur(ctx, y + 6);
    return ctx.racine;
  }

  // ── Genre « sequence » ────────────────────────────────────────────────────

  function dessinerSequence(spec, langue) {
    const ctx = nouveau(200, tr(spec.alt, langue));
    const acteurs = spec.a.map((a) => tr(a, langue));
    const n = acteurs.length;
    const mx = 10;
    const pas = (L - 2 * mx) / n;
    const xs = acteurs.map((_, i) => mx + pas * (i + 0.5));
    const wA = Math.min(pas - 8, 100);
    const hEntete = 30;
    const inter = spec.lh || 38;
    const messages = spec.m;
    const bas = hEntete + 16 + messages.length * inter + 12;
    // lignes de vie
    xs.forEach((x) => {
      ctx.g.appendChild(svg('line', { x1: x, y1: hEntete + 6, x2: x, y2: bas, class: 'dl dl-g dd dfin' }));
    });
    acteurs.forEach((a, i) => {
      forme(ctx, 'box', xs[i], 10 + hEntete / 2 - 4, wA, hEntete, (spec.s && spec.s[i]) || 'a', { rx: 6 });
      const lignes = envelopper(a, wA - 6, 11, false);
      ecrire(ctx.g, xs[i], 10 + hEntete / 2 - 4, lignes, { sz: lignes.length > 1 ? 10 : 11.5, b: true });
    });
    let y = hEntete + 20 + inter / 2 - 6;
    for (const m of messages) {
      if (m[0] === 'note') {
        const x1 = xs[m[1]] - 8;
        const x2 = xs[m[2]] + 8;
        const lignes = envelopper(tr(m[3], langue), x2 - x1 - 10, 10.5, false);
        const h = lignes.length * 13 + 10;
        ctx.g.appendChild(svg('rect', { x: x1, y: y - h / 2, width: x2 - x1, height: h, rx: 5, class: 'dn dn-warn' }));
        ecrire(ctx.g, (x1 + x2) / 2, y, lignes, { sz: 10.5 });
        y += inter;
        continue;
      }
      const de = xs[m[0]];
      const a = xs[m[1]];
      const opts = String(m[3] || '');
      const style = ['a', 'ok', 'warn', 'bad', 'mute'].find((s) => opts.split(' ').includes(s)) || 'n';
      if (m[0] === m[1]) {
        /* Un message à soi-même : la boucle et son texte vont du côté où il y
         * a de la place — à gauche pour un acteur du bord droit. */
        const sens = de > L / 2 ? -1 : 1;
        const dispo = sens > 0 ? L - (de + 34) - 6 : de - 34 - 6;
        chemin(ctx, 'M' + de + ',' + (y - 8) + ' h' + (26 * sens) + ' v16 h' + (-26 * sens), { s: style, fleche: true, dash: opts.includes('dash') });
        ecrire(ctx.g, de + 32 * sens, y, envelopper(tr(m[2], langue), Math.min(150, dispo), 10.5, false), { sz: 10.5, a: sens > 0 ? 'start' : 'end', s: style, b: true });
      } else {
        trait(ctx, de + (a > de ? 2 : -2), y, a + (a > de ? -2 : 2), y, { s: style, dash: opts.includes('dash') });
        const lignes = envelopper(tr(m[2], langue), Math.abs(a - de) - 8, 10.5, false);
        ecrire(ctx.g, (de + a) / 2, y - 9 - (lignes.length - 1) * 6.5, lignes, { sz: 10.5, s: style, b: true, halo: true });
      }
      y += inter;
    }
    fixerHauteur(ctx, bas + 6);
    return ctx.racine;
  }

  // ── Genre « dessin » ──────────────────────────────────────────────────────

  /* Une couleur imposée à une forme (`fill`) et son opacité (`fo`) : pour les
   * figures dont le sujet est une couleur (RGB, HSL), que la palette du thème
   * ne saurait représenter. Ce sont des attributs de présentation, permis par
   * la politique de sécurité — contrairement à l'attribut « style ». */
  function peindre(noeud, o) {
    if (!noeud) return;
    if (o.fill) noeud.setAttribute('fill', o.fill);
    if (o.fo !== undefined) noeud.setAttribute('fill-opacity', o.fo);
  }

  function dessinerLibre(spec, langue) {
    const ctx = nouveau(spec.h || 160, tr(spec.alt, langue));
    for (const p of spec.d) {
      const type = p[0];
      const o = p[p.length - 1] && typeof p[p.length - 1] === 'object' && !Array.isArray(p[p.length - 1]) ? p[p.length - 1] : {};
      switch (type) {
        case 'rect': {
          forme(ctx, o.f || 'box', p[1] + p[3] / 2, p[2] + p[4] / 2, p[3], p[4], o.s, { rx: o.r, dash: o.dash, libre: !!o.fill });
          peindre(ctx.g.lastChild, o);
          if (o.t) {
            const texte = ecrire(ctx.g, p[1] + p[3] / 2, p[2] + p[4] / 2, envelopper(tr(o.t, langue), p[3] - 6, o.sz || 11, o.mono), { sz: o.sz || 11, mono: o.mono, b: o.b !== false, s: o.ts });
            if (o.tf) texte.setAttribute('fill', o.tf);
          }
          break;
        }
        case 'circ': {
          const rond = svg('circle', { cx: p[1], cy: p[2], r: p[3], class: (o.fill ? 'dfree' : 'dn dn-' + (o.s || 'n')) + (o.dash ? ' dd' : '') });
          ctx.g.appendChild(rond);
          peindre(rond, o);
          if (o.t) {
            const texte = ecrire(ctx.g, p[1], p[2], envelopper(tr(o.t, langue), p[3] * 1.6, o.sz || 11, o.mono), { sz: o.sz || 11, b: true, mono: o.mono, s: o.ts });
            if (o.tf) texte.setAttribute('fill', o.tf);
          }
          break;
        }
        case 'ell':
          ctx.g.appendChild(svg('ellipse', { cx: p[1], cy: p[2], rx: p[3], ry: p[4], class: 'dn dn-' + (o.s || 'n') + (o.dash ? ' dd' : '') }));
          if (o.t) ecrire(ctx.g, p[1], p[2], envelopper(tr(o.t, langue), p[3] * 1.6, o.sz || 11, o.mono), { sz: o.sz || 11, b: true, mono: o.mono, s: o.ts });
          break;
        case 'line':
          trait(ctx, p[1], p[2], p[3], p[4], { s: o.s, dash: o.dash, fleche: o.arrow ? (o.arrow === 2 ? 'double' : 'fin') : 'aucune' });
          break;
        case 'text':
          ecrire(ctx.g, p[1], p[2], envelopper(tr(p[3], langue), o.max || 300, o.sz || 11, o.mono), {
            sz: o.sz || 11, a: o.a === 's' ? 'start' : (o.a === 'e' ? 'end' : 'middle'), s: o.s, b: o.b, mono: o.mono, halo: o.halo,
          });
          break;
        case 'path':
          chemin(ctx, p[1], { s: o.s, dash: o.dash, plein: o.plein, fleche: o.arrow });
          break;
        case 'poly':
          ctx.g.appendChild(svg('polygon', { points: p[1].join(','), class: 'dn dn-' + (o.s || 'n') + (o.dash ? ' dd' : '') }));
          if (o.t) ecrire(ctx.g, o.tx, o.ty, [tr(o.t, langue)], { sz: o.sz || 11, b: true, s: o.ts });
          break;
        default: break;
      }
    }
    return ctx.racine;
  }

  // ── Entrée publique ───────────────────────────────────────────────────────

  const GENRES = {
    graphe: dessinerGraphe, commits: dessinerCommits, cases: dessinerCases,
    pile: dessinerPile, arbre: dessinerArbre, sequence: dessinerSequence, dessin: dessinerLibre,
  };

  function dessiner(spec, langue) {
    const fabrique = GENRES[spec.k];
    if (!fabrique) throw new Error('genre de schéma inconnu : ' + spec.k);
    return fabrique(spec, langue || 'fr');
  }

  racine.Schema = {
    dessiner, GENRES,
    titre: (spec, langue) => tr(spec.t, langue),
    legende: (spec, langue) => tr(spec.l, langue),
  };

})(window);
