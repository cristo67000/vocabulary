'use strict';
/*
 * Schémas de la catégorie « Images et couleurs ».
 *
 * Quelques figures ont pour sujet une couleur elle-même (RGB, HSL, contraste) :
 * la palette du thème ne peut pas les représenter, elles posent donc de vraies
 * couleurs par l'option `fill`.
 */
(function (racine) {

  /* Une grille de carrés, tirée d'un dessin en texte : X plein, . vide. */
  function grille(motif, x0, y0, cote, plein, vide) {
    const formes = [];
    motif.forEach((ligne, r) => {
      ligne.split('').forEach((signe, i) => {
        formes.push(['rect', x0 + i * cote, y0 + r * cote, cote - 2, cote - 2, { s: signe === 'X' ? plein : vide, r: 2 }]);
      });
    });
    return formes;
  }

  const hsl = (h, s, l) => 'hsl(' + h + ' ' + s + '% ' + l + '%)';
  function nuancier(y, etiquette, valeurs, fabrique) {
    const formes = [['text', 8, y + 17, etiquette, { a: 's', sz: 11, b: true, s: 'mute' }]];
    valeurs.forEach((v, i) => {
      formes.push(['rect', 92 + i * 44, y, 38, 26, { fill: fabrique(v), r: 4 }]);
      formes.push(['text', 111 + i * 44, y + 40, String(v), { sz: 9.5, mono: true, s: 'mute' }]);
    });
    return formes;
  }

  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'image-pixels': {
      k: 'dessin',
      h: 178,
      alt: ['Une image est une grille de pixels : ici, la lettre A en 8 par 5 pixels', 'An image is a grid of pixels: here, the letter A in 8 by 5 pixels'],
      d: grille(['..XXXX..', '.X....X.', '.XXXXXX.', '.X....X.', '.X....X.'], 76, 10, 26, 'a', 'mute').concat([
        ['text', 180, 156, ['chaque carré est un pixel : une seule couleur', 'each square is a pixel: a single color'], { sz: 11, s: 'mute', b: true }],
        ['text', 180, 172, 'rgb(36, 87, 214)', { sz: 10, mono: true, s: 'a' }],
      ]),
    },

    'image-densite': {
      k: 'dessin',
      h: 176,
      alt: ['Sur un écran 2×, la même largeur de 4 pixels CSS compte 8 pixels réels', 'On a 2× screen, the same 4-CSS-pixel width holds 8 real pixels'],
      d: [
        ['text', 8, 14, ['Écran 1× : 4 pixels CSS = 4 pixels réels', '1× screen: 4 CSS pixels = 4 real pixels'], { a: 's', sz: 11, b: true, s: 'a', max: 344 }],
      ].concat([0, 1, 2, 3].map((i) => ['rect', 30 + i * 78, 24, 74, 36, { s: 'a', r: 3 }]))
        .concat([['text', 8, 88, ['Écran 2× : mêmes 4 pixels CSS = 8 pixels réels', '2× screen: same 4 CSS pixels = 8 real pixels'], { a: 's', sz: 11, b: true, s: 'ok', max: 344 }]])
        .concat([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['rect', 30 + i * 39, 98, 35, 36, { s: 'ok', r: 3 }]))
        .concat([['text', 180, 162, ['Une image de 100 px CSS demande 200 px pour rester nette.', 'A 100 CSS px image needs 200 px to stay sharp.'], { sz: 10.5, s: 'mute', b: true }]]),
    },

    'image-rgb': {
      k: 'dessin',
      h: 168,
      alt: ['Synthèse additive : le rouge, le vert et le bleu se combinent en jaune, cyan, magenta et blanc', 'Additive mixing: red, green and blue combine into yellow, cyan, magenta and white'],
      d: [
        ['circ', 110, 58, 46, { fill: '#e5484d', fo: 0.62 }],
        ['circ', 170, 58, 46, { fill: '#30a46c', fo: 0.62 }],
        ['circ', 140, 106, 46, { fill: '#3e63dd', fo: 0.62 }],
        ['text', 84, 40, 'R', { sz: 15, b: true }],
        ['text', 196, 40, 'G', { sz: 15, b: true }],
        ['text', 140, 138, 'B', { sz: 15, b: true }],
        ['text', 140, 78, ['blanc', 'white'], { sz: 10, b: true }],
        ['text', 288, 30, 'R + G', { a: 'e', mono: true, sz: 10.5 }],
        ['text', 296, 30, ['= jaune', '= yellow'], { a: 's', sz: 10.5, b: true }],
        ['text', 288, 52, 'G + B', { a: 'e', mono: true, sz: 10.5 }],
        ['text', 296, 52, '= cyan', { a: 's', sz: 10.5, b: true }],
        ['text', 288, 74, 'R + B', { a: 'e', mono: true, sz: 10.5 }],
        ['text', 296, 74, ['= magenta', '= magenta'], { a: 's', sz: 10.5, b: true }],
        ['text', 288, 96, 'R + G + B', { a: 'e', mono: true, sz: 10.5 }],
        ['text', 296, 96, ['= blanc', '= white'], { a: 's', sz: 10.5, b: true }],
        ['text', 200, 158, 'rgb(255, 255, 255)', { sz: 10, mono: true, s: 'mute' }],
      ],
    },

    'image-srgb': {
      k: 'dessin',
      h: 186,
      alt: ['Schéma simplifié : le gamut sRGB est plus petit que Display P3, lui-même plus petit que Rec. 2020, tous contenus dans les couleurs visibles', 'Simplified diagram: the sRGB gamut is smaller than Display P3, itself smaller than Rec. 2020, all within the visible colors'],
      d: [
        ['path', 'M96,120 C70,70 100,26 168,22 C236,18 290,52 298,96 C302,124 250,142 190,144 C150,146 110,140 96,120 Z', { s: 'mute', dash: 1 }],
        ['text', 300, 18, ['couleurs visibles', 'visible colors'], { a: 'e', sz: 10, s: 'mute', b: true }],
        ['poly', [112, 124, 160, 34, 282, 104], { s: 'info' }],
        ['poly', [128, 118, 166, 50, 252, 104], { s: 'v' }],
        ['poly', [146, 112, 172, 70, 222, 102], { s: 'a' }],
        ['rect', 30, 160, 10, 10, { s: 'a' }],
        ['text', 46, 170, 'sRGB', { a: 's', sz: 10.5, b: true }],
        ['rect', 116, 160, 10, 10, { s: 'v' }],
        ['text', 132, 170, 'Display P3', { a: 's', sz: 10.5, b: true }],
        ['rect', 226, 160, 10, 10, { s: 'info' }],
        ['text', 242, 170, 'Rec. 2020', { a: 's', sz: 10.5, b: true }],
      ],
    },

    'image-alpha': {
      k: 'dessin',
      h: 150,
      alt: ['Le même disque bleu avec trois opacités : 1, 0,5 et 0,15, devant un damier', 'The same blue disc at three opacities: 1, 0.5 and 0.15, in front of a checkerboard'],
      d: [0, 1, 2].flatMap((i) => {
        const x0 = 20 + i * 115;
        const alpha = [1, 0.5, 0.15][i];
        return [
          ['rect', x0, 12, 45, 45, { fill: '#cfcfd6', r: 0 }],
          ['rect', x0 + 45, 12, 45, 45, { fill: '#f6f6f8', r: 0 }],
          ['rect', x0, 57, 45, 45, { fill: '#f6f6f8', r: 0 }],
          ['rect', x0 + 45, 57, 45, 45, { fill: '#cfcfd6', r: 0 }],
          ['circ', x0 + 45, 57, 32, { fill: '#3e63dd', fo: alpha }],
          ['text', x0 + 45, 122, ['alpha = ' + String(alpha).replace('.', ','), 'alpha = ' + alpha], { mono: true, sz: 10.5, b: true }],
          ['text', x0 + 45, 138, [['opaque', 'opaque'], ['à moitié', 'half'], ['presque invisible', 'nearly invisible']][i], { sz: 10, s: 'mute' }],
        ];
      }),
    },

    'image-formats': {
      k: 'dessin',
      h: 178,
      alt: ['Poids relatif d’une même photo selon le format : PNG, JPEG, WebP, AVIF', 'Relative weight of the same photo depending on the format: PNG, JPEG, WebP, AVIF'],
      d: [
        ['text', 8, 32, 'PNG', { a: 's', mono: true, sz: 12, b: true }],
        ['rect', 62, 16, 280, 28, { s: 'bad', t: '100 %', r: 4 }],
        ['text', 8, 72, 'JPEG', { a: 's', mono: true, sz: 12, b: true }],
        ['rect', 62, 56, 112, 28, { s: 'warn', t: '≈ 40 %', r: 4 }],
        ['text', 8, 112, 'WebP', { a: 's', mono: true, sz: 12, b: true }],
        ['rect', 62, 96, 80, 28, { s: 'ok', t: '≈ 28 %', r: 4 }],
        ['text', 8, 152, 'AVIF', { a: 's', mono: true, sz: 12, b: true }],
        ['rect', 62, 136, 58, 28, { s: 'a', t: '≈ 20 %', r: 4 }],
        ['text', 190, 72, ['photo, avec perte', 'photo, lossy'], { a: 's', sz: 10, s: 'mute' }],
        ['text', 156, 112, ['avec ou sans perte, transparence', 'lossy or lossless, transparency'], { a: 's', sz: 10, s: 'mute' }],
        ['text', 134, 152, ['le plus récent, encodage plus lent', 'the newest, slower to encode'], { a: 's', sz: 10, s: 'mute' }],
      ],
      l: ['Ordre de grandeur pour une même photo : les chiffres varient selon l’image et la qualité choisie.', 'Order of magnitude for the same photo: the figures vary with the image and the chosen quality.'],
    },

    'image-vectoriel': {
      k: 'dessin',
      h: 176,
      alt: ['Agrandi, un disque matriciel montre ses pixels ; un disque vectoriel reste net', 'Enlarged, a raster disc shows its pixels; a vector disc stays sharp'],
      d: grille(['...XXX...', '.XXXXXXX.', '.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '.XXXXXXX.', '...XXX...'], 24, 14, 14, 'a', 'n').concat([
        ['line', 180, 10, 180, 136, { s: 'g', dash: 1 }],
        ['circ', 270, 74, 56, { s: 'a' }],
        ['text', 84, 158, ['matriciel : les pixels se voient', 'raster: the pixels show'], { sz: 10.5, b: true, s: 'mute' }],
        ['text', 270, 158, ['vectoriel : reste net', 'vector: stays sharp'], { sz: 10.5, b: true, s: 'mute' }],
      ]),
    },

    'image-maskable': {
      k: 'dessin',
      h: 200,
      alt: ['Une icône maskable : le fond couvre tout, le motif reste dans la zone de sécurité, le système découpe', 'A maskable icon: the background covers everything, the motif stays in the safe zone, the system cuts'],
      d: [
        ['rect', 105, 8, 150, 150, { s: 'a', r: 4 }],
        ['circ', 180, 83, 75, { s: 'mute', dash: 1 }],
        ['circ', 180, 83, 60, { s: 'ok', dash: 1 }],
        ['text', 180, 90, '{ }', { mono: true, sz: 28, b: true, s: 'a' }],
        ['text', 8, 24, ['le système peut\ndécouper en cercle', 'the system may\ncut to a circle'], { a: 's', sz: 10, s: 'mute', b: true }],
        ['line', 78, 34, 116, 34, { s: 'mute', arrow: 1 }],
        ['text', 352, 24, ['zone de sécurité\n(80 %)', 'safe zone\n(80%)'], { a: 'e', sz: 10, s: 'ok', b: true }],
        ['line', 282, 34, 240, 46, { s: 'ok', arrow: 1 }],
        ['text', 180, 182, ['Le fond va jusqu’aux bords ; tout le motif tient dans le cercle vert.', 'The background reaches the edges; the whole motif fits within the green circle.'], { sz: 10, s: 'mute', max: 340 }],
      ],
    },

    'image-hsl': {
      k: 'dessin',
      h: 178,
      alt: ['Trois curseurs HSL : la teinte, la saturation et la luminosité', 'Three HSL sliders: hue, saturation and lightness'],
      d: nuancier(8, ['Teinte', 'Hue'], [0, 60, 120, 180, 240, 300], (h) => hsl(h, 70, 50))
        .concat(nuancier(70, ['Saturation', 'Saturation'], [0, 25, 50, 75, 100], (s) => hsl(220, s, 50)))
        .concat(nuancier(132, ['Luminosité', 'Lightness'], [90, 70, 50, 30, 10], (l) => hsl(220, 70, l))),
    },

    'image-contraste': {
      k: 'dessin',
      h: 128,
      alt: ['Trois textes sur fond : un contraste très bon, la limite de 4,5:1, et un contraste insuffisant', 'Three texts on a background: very good contrast, the 4.5:1 limit, and insufficient contrast'],
      d: [
        ['rect', 6, 10, 108, 54, { fill: '#16213e', t: ['Lisible', 'Readable'], ts: 'blanc', sz: 14 }],
        ['rect', 126, 10, 108, 54, { fill: '#ffffff', t: ['Limite', 'Limit'], ts: 'gris', sz: 14 }],
        ['rect', 246, 10, 108, 54, { fill: '#ffffff', t: ['Pâle', 'Pale'], ts: 'pale', sz: 14 }],
        ['text', 60, 84, '16 : 1', { mono: true, sz: 13, b: true, s: 'ok' }],
        ['text', 60, 102, '✓', { sz: 14, b: true, s: 'ok' }],
        ['text', 180, 84, '4,5 : 1', { mono: true, sz: 13, b: true, s: 'warn' }],
        ['text', 180, 102, ['minimum WCAG', 'WCAG minimum'], { sz: 10, b: true, s: 'warn' }],
        ['text', 300, 84, '1,7 : 1', { mono: true, sz: 13, b: true, s: 'bad' }],
        ['text', 300, 102, '✗', { sz: 14, b: true, s: 'bad' }],
      ],
    },

  });
})(window);
