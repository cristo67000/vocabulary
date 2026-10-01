'use strict';
/*
 * Les dessins d'apprentissage : prépositions de lieu et de temps, depuis /
 * il y a, temps des verbes, comparatifs, quantités, grands nombres,
 * registres, britannique ou américain, maison, corps, famille, heure, dates,
 * météo, directions.
 *
 * Ces dessins sont bilingues quelle que soit la langue de l'interface :
 * l'anglais en gras, le français en gris dessous — on apprend les deux
 * langues. Seuls le titre, la légende et les étiquettes de grammaire suivent
 * l'interface (couples [français, anglais]).
 *
 * Les figures répétitives (neuf scènes de prépositions, huit temps qu'il
 * fait, les graduations d'une horloge) sont calculées par de petites
 * fonctions plutôt qu'écrites à la main : moins de coordonnées à relire.
 */
(function (racine) {

  /* Un mot anglais en gras et sa traduction dessous, centrés sur x. */
  function paire(x, y, en, fr, o) {
    const opt = o || {};
    const sz = opt.sz || 11.5;
    return [
      ['text', x, y, en, { sz, b: true, s: opt.s, a: opt.a, max: opt.max }],
      ['text', x, y + (opt.ecart || 14), fr, { sz: sz - 1.5, s: 'mute', a: opt.a, max: opt.max }],
    ];
  }

  function aplatir(listes) {
    return [].concat(...listes);
  }

  // ── Où ? Les prépositions de lieu ─────────────────────────────────────────

  /* Neuf scènes, trois par ligne : une boîte, une balle, et le mot. */
  function lieu() {
    const d = [];
    const scenes = [
      ['in', 'dans'], ['on', 'sur'], ['under', 'sous'],
      ['above', 'au-dessus de'], ['behind', 'derrière'], ['in front of', 'devant'],
      ['next to', 'à côté de'], ['between', 'entre'], ['opposite', 'en face de'],
    ];
    scenes.forEach(([en, fr], i) => {
      const x0 = (i % 3) * 120;
      const y0 = 8 + Math.floor(i / 3) * 94;
      const cx = x0 + 60;
      const sol = y0 + 54;
      const boite = (x, w) => ['rect', x, y0 + 28, w || 34, 26, { s: 'n', r: 3 }];
      const balle = (x, y, r) => ['circ', x, y, r || 8, { s: 'a' }];
      if (en !== 'opposite') d.push(['line', x0 + 14, sol, x0 + 106, sol, { s: 'g' }]);
      switch (en) {
        case 'in':
          d.push(balle(cx, y0 + 45, 7));
          d.push(['path', `M${cx - 17},${y0 + 24} V${sol} H${cx + 17} V${y0 + 24}`, { s: 'n' }]);
          break;
        case 'on':
          d.push(boite(cx - 17), balle(cx, y0 + 20));
          break;
        case 'under':
          d.push(['rect', cx - 26, y0 + 24, 52, 6, { s: 'n', r: 2 }]);
          d.push(['line', cx - 22, y0 + 30, cx - 22, sol, { s: 'n' }]);
          d.push(['line', cx + 22, y0 + 30, cx + 22, sol, { s: 'n' }]);
          d.push(balle(cx, y0 + 45));
          break;
        case 'above':
          d.push(boite(cx - 17), balle(cx, y0 + 10, 7));
          break;
        case 'behind':
          d.push(balle(cx + 9, y0 + 26, 9), boite(cx - 17));
          break;
        case 'in front of':
          d.push(['rect', cx - 17, y0 + 22, 34, 26, { s: 'n', r: 3 }], balle(cx, y0 + 46, 9));
          break;
        case 'next to':
          d.push(boite(cx - 27), balle(cx + 19, y0 + 46));
          break;
        case 'between':
          d.push(boite(cx - 42, 24), boite(cx + 18, 24), balle(cx, y0 + 46));
          break;
        default:   // opposite : de part et d'autre de la rue
          d.push(['rect', cx - 14, y0 + 4, 28, 18, { s: 'n', r: 2 }]);
          d.push(['rect', x0 + 10, y0 + 27, 100, 14, { s: 'mute', r: 0 }]);
          d.push(['line', x0 + 16, y0 + 34, x0 + 104, y0 + 34, { s: 'g', dash: 1 }]);
          d.push(balle(cx, y0 + 50, 7));
      }
      d.push(...paire(cx, y0 + 70, en, fr, { s: 'a', max: 112 }));
    });
    return d;
  }

  // ── L'heure ───────────────────────────────────────────────────────────────

  function horloge(cx, cy, r) {
    const d = [['circ', cx, cy, r, { s: 'n' }]];
    for (let k = 0; k < 12; k += 1) {
      const a = (k * Math.PI) / 6;
      const long = k % 3 === 0 ? 12 : 6;
      d.push(['line',
        +(cx + (r - 2 - long) * Math.sin(a)).toFixed(1), +(cy - (r - 2 - long) * Math.cos(a)).toFixed(1),
        +(cx + (r - 2) * Math.sin(a)).toFixed(1), +(cy - (r - 2) * Math.cos(a)).toFixed(1),
        { s: k % 3 === 0 ? 'n' : 'g' }]);
    }
    d.push(['circ', cx, cy, 3, { s: 'n' }]);
    return d;
  }

  // ── Le temps qu'il fait ───────────────────────────────────────────────────

  function meteo() {
    const d = [];
    const cellules = [
      ['sunny', 'It’s sunny.', 'Il fait beau.'],
      ['cloudy', 'It’s cloudy.', 'C’est nuageux.'],
      ['rain', 'It’s raining.', 'Il pleut.'],
      ['wind', 'It’s windy.', 'Il y a du vent.'],
      ['snow', 'It’s snowing.', 'Il neige.'],
      ['fog', 'It’s foggy.', 'Il y a du brouillard.'],
      ['storm', 'There’s a storm.', 'Il y a de l’orage.'],
      ['freezing', 'It’s freezing.', 'Il gèle.'],
    ];
    cellules.forEach(([genre, en, fr], i) => {
      const x0 = (i % 4) * 90;
      const y0 = 6 + Math.floor(i / 4) * 112;
      const cx = x0 + 45;
      const cy = y0 + 34;
      const nuage = (s) => ['rect', cx - 26, cy - 22, 52, 32, { f: 'cloud', s }];
      switch (genre) {
        case 'sunny':
          for (let k = 0; k < 8; k += 1) {
            const a = (k * Math.PI) / 4;
            d.push(['line', +(cx + 19 * Math.cos(a)).toFixed(1), +(cy + 19 * Math.sin(a)).toFixed(1),
              +(cx + 26 * Math.cos(a)).toFixed(1), +(cy + 26 * Math.sin(a)).toFixed(1), { s: 'warn' }]);
          }
          d.push(['circ', cx, cy, 14, { s: 'warn' }]);
          break;
        case 'cloudy':
          d.push(['rect', cx - 20, cy - 26, 40, 26, { f: 'cloud', s: 'mute' }], nuage('n'));
          break;
        case 'rain':
          d.push(nuage('info'));
          for (const dx of [-14, 0, 14]) d.push(['line', cx + dx, cy + 14, cx + dx - 5, cy + 26, { s: 'info' }]);
          break;
        case 'wind':
          d.push(['path', `M${cx - 30},${cy - 10} H${cx + 12} a7,7 0 1 0 -7,-7`, { s: 'info' }]);
          d.push(['path', `M${cx - 30},${cy + 2} H${cx + 22} a8,8 0 1 1 -8,8`, { s: 'info' }]);
          d.push(['path', `M${cx - 24},${cy + 14} H${cx + 2}`, { s: 'info' }]);
          break;
        case 'snow':
          d.push(nuage('info'));
          for (const [dx, dy] of [[-14, 18], [0, 25], [14, 18]]) d.push(['circ', cx + dx, cy + dy, 3, { s: 'info' }]);
          break;
        case 'fog':
          [-18, -8, 2, 12, 22].forEach((dy, k) => {
            const decale = k % 2 ? 8 : 0;
            d.push(['line', cx - 30 + decale, cy + dy, cx + 30 - (8 - decale), cy + dy, { s: 'mute', dash: 1 }]);
          });
          break;
        case 'storm':
          d.push(nuage('mute'));
          d.push(['poly', [cx + 2, cy + 6, cx - 8, cy + 22, cx - 1, cy + 22, cx - 6, cy + 34, cx + 8, cy + 16, cx + 1, cy + 16, cx + 6, cy + 6], { s: 'warn' }]);
          break;
        default:   // freezing : un thermomètre au plus bas
          d.push(['rect', cx - 5, cy - 26, 10, 42, { s: 'n', r: 5 }]);
          d.push(['circ', cx, cy + 20, 8, { s: 'info' }]);
          d.push(['rect', cx - 2, cy + 4, 4, 12, { s: 'info', r: 1 }]);
          for (const dy of [-18, -10, -2]) d.push(['line', cx + 7, cy + dy, cx + 12, cy + dy, { s: 'g' }]);
      }
      d.push(...paire(cx, y0 + 78, en, fr, { sz: 10.5, max: 86, ecart: 15 }));
    });
    return d;
  }

  // ── Les dessins ───────────────────────────────────────────────────────────

  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'app-lieu': {
      k: 'dessin',
      h: 290,
      t: ['Les prépositions de lieu', 'Prepositions of place'],
      l: ['Où est la balle par rapport à la boîte ?', 'Where is the ball, compared with the box?'],
      alt: ['Neuf petites scènes : la balle dans, sur, sous, au-dessus, derrière, devant, à côté, entre des boîtes, et en face, de l’autre côté de la rue',
        'Nine small scenes: the ball in, on, under, above, behind, in front of, next to, between boxes, and opposite, across the street'],
      d: lieu(),
    },

    'app-quand': {
      k: 'dessin',
      h: 214,
      t: ['At, on, in : les prépositions de temps', 'At, on, in: prepositions of time'],
      l: ['Du plus large au plus précis : in (une période), on (un jour), at (un moment)', 'From widest to most precise: in (a period), on (a day), at (a point in time)'],
      alt: ['Trois cadres emboîtés : in pour les mois, années et saisons ; on pour les jours et les dates ; at pour les heures',
        'Three nested frames: in for months, years and seasons; on for days and dates; at for clock times'],
      d: aplatir([
        [['rect', 8, 8, 344, 198, { s: 'info', r: 10 }],
          ['text', 20, 30, 'in', { a: 's', sz: 16, b: true, s: 'info' }]],
        paire(50, 25, 'in July, in 2026, in winter, in the evening', 'en juillet, en 2026, en hiver, le soir', { a: 's', sz: 11 }),
        [['rect', 22, 54, 316, 144, { s: 'ok', r: 9 }],
          ['text', 34, 76, 'on', { a: 's', sz: 16, b: true, s: 'ok' }]],
        paire(66, 71, 'on Monday, on 3rd May, on my birthday', 'lundi, le 3 mai, le jour de mon anniversaire', { a: 's', sz: 11 }),
        [['rect', 36, 102, 288, 88, { s: 'warn', r: 8 }],
          ['text', 48, 126, 'at', { a: 's', sz: 16, b: true, s: 'warn' }]],
        paire(80, 121, 'at 7 o’clock, at noon, at night', 'à 7 heures, à midi, la nuit', { a: 's', sz: 11 }),
        paire(80, 160, 'at the weekend (UK), at Christmas', 'le week-end, à Noël', { a: 's', sz: 11 }),
      ]),
    },

    'app-depuis': {
      k: 'dessin',
      h: 276,
      t: ['Since, for, ago', 'Since, for, ago'],
      l: ['Present perfect avec since (point de départ) ou for (durée) ; prétérit avec ago', 'Present perfect with since (starting point) or for (length of time); past simple with ago'],
      alt: ['Une frise : depuis 2020 jusqu’à maintenant, six ans ; et une flèche qui remonte de maintenant à 2020 : il y a six ans',
        'A timeline: from 2020 to now, six years; and an arrow going back from now to 2020: six years ago'],
      d: aplatir([
        paire(60, 18, 'since 2020', 'depuis 2020', { s: 'warn' }),
        [['line', 60, 42, 60, 80, { s: 'warn', dash: 1 }]],
        paire(180, 56, 'for six years', 'depuis six ans', { s: 'a' }),
        [['rect', 60, 82, 240, 10, { s: 'a', r: 3 }],
          ['line', 14, 92, 346, 92, { s: 'g', arrow: 1 }],
          ['circ', 60, 87, 5, { s: 'warn' }],
          ['line', 300, 86, 300, 98, { s: 'n' }],
          ['text', 60, 108, '2020', { sz: 10.5, mono: true, s: 'mute' }],
          ['text', 300, 108, ['maintenant', 'now'], { sz: 10.5, b: true }],
          ['line', 298, 124, 64, 124, { s: 'v', arrow: 1 }]],
        paire(182, 140, 'six years ago', 'il y a six ans', { s: 'v' }),
        [['rect', 8, 168, 344, 46, { s: 'a', r: 6 }]],
        paire(180, 184, 'I have lived here since 2020 / for six years.', 'J’habite ici depuis 2020 / depuis six ans.', { sz: 11 }),
        [['rect', 8, 222, 344, 46, { s: 'v', r: 6 }]],
        paire(180, 238, 'I moved here six years ago.', 'J’ai emménagé ici il y a six ans.', { sz: 11 }),
      ]),
    },

    'app-temps': {
      k: 'dessin',
      h: 306,
      t: ['Les temps des verbes anglais', 'English tenses'],
      l: ['Où se place l’action par rapport à maintenant', 'Where the action sits in relation to now'],
      alt: ['Six frises : prétérit, present perfect, présent continu, présent simple, futur avec will, futur avec going to',
        'Six timelines: past simple, present perfect, present continuous, present simple, future with will, future with going to'],
      d: (function () {
        const d = [
          ['text', 222, 14, ['passé', 'past'], { sz: 10, s: 'mute' }],
          ['text', 290, 14, ['maintenant', 'now'], { sz: 10, b: true, s: 'warn' }],
          ['text', 338, 14, ['futur', 'future'], { sz: 10, s: 'mute' }],
          ['line', 290, 22, 290, 298, { s: 'warn', dash: 1 }],
        ];
        const lignes = [
          [['prétérit', 'past simple'], 'I worked (yesterday)', 'j’ai travaillé hier', 'passe'],
          [['present perfect', 'present perfect'], 'I have worked', 'j’ai travaillé (bilan)', 'parfait'],
          [['présent continu', 'present continuous'], 'I am working', 'je travaille (en ce moment)', 'continu'],
          [['présent simple', 'present simple'], 'I work (every day)', 'je travaille (chaque jour)', 'habitude'],
          [['futur (will)', 'future (will)'], 'I will work', 'je travaillerai', 'futur'],
          [['futur (going to)', 'future (going to)'], 'I’m going to work', 'je vais travailler', 'intention'],
        ];
        lignes.forEach(([nom, en, fr, genre], i) => {
          const y0 = 26 + i * 46;
          const y = y0 + 22;
          d.push(['text', 8, y0 + 6, nom, { a: 's', sz: 9.5, b: true, s: 'a' }]);
          d.push(['text', 8, y0 + 21, en, { a: 's', sz: 11.5, b: true }]);
          d.push(['text', 8, y0 + 35, fr, { a: 's', sz: 10, s: 'mute' }]);
          d.push(['line', 180, y, 352, y, { s: 'g' }]);
          switch (genre) {
            case 'passe': d.push(['circ', 225, y, 5, { s: 'a' }]); break;
            case 'parfait':
              d.push(['circ', 214, y, 4, { s: 'a' }], ['line', 218, y, 286, y, { s: 'a', arrow: 1 }]);
              break;
            case 'continu': d.push(['rect', 270, y - 7, 40, 14, { s: 'a', r: 7 }]); break;
            case 'habitude':
              for (const x of [194, 218, 242, 266, 290, 314, 338]) d.push(['circ', x, y, 3.5, { s: 'a' }]);
              break;
            case 'futur': d.push(['circ', 334, y, 5, { s: 'v' }]); break;
            default:
              d.push(['line', 292, y, 326, y, { s: 'v', arrow: 1 }], ['circ', 334, y, 5, { s: 'v' }]);
          }
        });
        return d;
      }()),
    },

    'app-comparer': {
      k: 'dessin',
      h: 262,
      t: ['Comparatifs et superlatifs', 'Comparatives and superlatives'],
      l: ['Mots courts : -er, the -est ; mots longs : more, the most ; puis than (que)', 'Short words: -er, the -est; long words: more, the most; then than'],
      alt: ['Trois barres de plus en plus hautes : big, bigger, the biggest ; puis expensive, good et bad avec leurs formes',
        'Three bars getting taller: big, bigger, the biggest; then expensive, good and bad with their forms'],
      d: aplatir([
        [['text', 60, 12, ['adjectif', 'adjective'], { sz: 10, b: true, s: 'mute' }],
          ['text', 180, 12, ['comparatif', 'comparative'], { sz: 10, b: true, s: 'mute' }],
          ['text', 300, 12, ['superlatif', 'superlative'], { sz: 10, b: true, s: 'mute' }],
          ['rect', 38, 80, 44, 30, { s: 'ok', r: 3 }],
          ['rect', 158, 55, 44, 55, { s: 'a', r: 3 }],
          ['rect', 278, 26, 44, 84, { s: 'v', r: 3 }],
          ['line', 16, 110, 344, 110, { s: 'g' }]],
        paire(60, 126, 'big', 'grand'),
        paire(180, 126, 'bigger (than)', 'plus grand (que)'),
        paire(300, 126, 'the biggest', 'le plus grand'),
        [['line', 16, 150, 344, 150, { s: 'g', dash: 1 }]],
        paire(60, 166, 'expensive', 'cher', { sz: 10.5 }),
        paire(180, 166, 'more expensive', 'plus cher', { sz: 10.5 }),
        paire(300, 166, 'the most expensive', 'le plus cher', { sz: 10.5 }),
        paire(60, 202, 'good', 'bon', { sz: 10.5, s: 'warn' }),
        paire(180, 202, 'better', 'meilleur', { sz: 10.5, s: 'warn' }),
        paire(300, 202, 'the best', 'le meilleur', { sz: 10.5, s: 'warn' }),
        paire(60, 238, 'bad', 'mauvais', { sz: 10.5, s: 'warn' }),
        paire(180, 238, 'worse', 'pire', { sz: 10.5, s: 'warn' }),
        paire(300, 238, 'the worst', 'le pire', { sz: 10.5, s: 'warn' }),
      ]),
    },

    'app-quantite': {
      k: 'dessin',
      h: 238,
      t: ['Much, many, a lot of', 'Much, many, a lot of'],
      l: ['Many et a few avec ce qui se compte ; much et a little avec ce qui ne se compte pas ; a lot of avec les deux',
        'Many and a few with things you can count; much and a little with things you can’t; a lot of with both'],
      alt: ['À gauche, des pommes qu’on compte : many, a few ; à droite, de l’eau qu’on ne compte pas : much, a little ; en bas, a lot of pour les deux',
        'Left, apples you can count: many, a few; right, water you can’t count: much, a little; below, a lot of for both'],
      d: aplatir([
        [['rect', 8, 8, 168, 170, { s: 'ok', r: 8 }],
          ['rect', 184, 8, 168, 170, { s: 'info', r: 8 }],
          ['text', 92, 26, ['dénombrable', 'countable'], { sz: 11, b: true, s: 'ok' }],
          ['text', 268, 26, ['indénombrable', 'uncountable'], { sz: 11, b: true, s: 'info' }]],
        aplatir([44, 68, 92, 116, 140].map((x) => [['circ', x, 62, 8, { s: 'ok' }], ['line', x, 54, x + 2, 49, { s: 'ok' }]])),
        [['poly', [254, 67, 282, 67, 280, 88, 256, 88], { s: 'info' }],
          ['path', 'M250,46 L286,46 L281,90 L255,90 Z', { s: 'n' }]],
        paire(92, 104, 'How many apples?', 'Combien de pommes ?', { sz: 11 }),
        paire(92, 142, 'a few apples', 'quelques pommes', { sz: 11 }),
        paire(268, 104, 'How much water?', 'Combien d’eau ?', { sz: 11 }),
        paire(268, 142, 'a little water', 'un peu d’eau', { sz: 11 }),
        [['rect', 8, 186, 344, 46, { s: 'a', r: 8 }]],
        paire(180, 203, 'a lot of apples · a lot of water', 'beaucoup de pommes · beaucoup d’eau', { sz: 11 }),
      ]),
    },

    'app-nombres': {
      k: 'dessin',
      h: 214,
      t: ['Les grands nombres, les décimales', 'Big numbers and decimals'],
      l: ['Le milliard se dit billion ; le point et la virgule s’échangent', 'A French milliard is a billion; points and commas swap places'],
      alt: ['Un million, un milliard (a billion), mille milliards (a trillion) ; 3.5 en anglais s’écrit 3,5 en français',
        'A million, a billion (un milliard), a trillion (un billion); 3.5 in English is 3,5 in French'],
      d: aplatir([
        [['text', 70, 16, ['chiffres', 'figures'], { sz: 10, b: true, s: 'mute' }],
          ['text', 205, 16, 'English', { sz: 10, b: true, s: 'mute' }],
          ['text', 300, 16, 'français', { sz: 10, b: true, s: 'mute' }],
          ['text', 70, 40, '1,000,000', { sz: 10.5, mono: true }],
          ['text', 205, 40, 'a million', { sz: 11, b: true }],
          ['text', 300, 40, 'un million', { sz: 11 }],
          ['rect', 8, 54, 344, 24, { s: 'a', r: 4 }],
          ['text', 70, 66, '1,000,000,000', { sz: 10.5, mono: true }],
          ['text', 205, 66, 'a billion', { sz: 11, b: true }],
          ['text', 300, 66, 'un milliard', { sz: 11, b: true, s: 'a' }],
          ['rect', 8, 80, 344, 24, { s: 'warn', r: 4 }],
          ['text', 70, 92, '1,000,000,000,000', { sz: 9.5, mono: true }],
          ['text', 205, 92, 'a trillion', { sz: 11, b: true }],
          ['text', 300, 92, 'un billion', { sz: 11, b: true, s: 'warn' }],
          ['text', 180, 118, ['⚠ le « billion » français vaut un trillion anglais', '⚠ a French « billion » is an English trillion'], { sz: 10, b: true, s: 'warn' }],
          ['rect', 8, 136, 168, 70, { s: 'info', r: 6 }],
          ['rect', 184, 136, 168, 70, { s: 'ok', r: 6 }],
          ['text', 92, 152, 'English', { sz: 10.5, b: true, s: 'info' }],
          ['text', 268, 152, 'français', { sz: 10.5, b: true, s: 'ok' }],
          ['text', 92, 174, '3.5   1,000   £3.50', { sz: 11, mono: true }],
          ['text', 268, 174, '3,5   1 000   3,50 €', { sz: 11, mono: true }],
          ['text', 92, 194, 'three point five', { sz: 10, s: 'mute' }],
          ['text', 268, 194, 'trois virgule cinq', { sz: 10, s: 'mute' }]],
      ]),
    },

    'app-registres': {
      k: 'dessin',
      h: 242,
      t: ['Les niveaux de langue', 'Levels of language'],
      l: ['Le même sens, du plus soutenu au plus cru : les marques des fiches disent le registre', 'Same meaning, from formal to crude: the labels on entries show the register'],
      alt: ['Une échelle de cinq registres, de soutenu à vulgaire, avec des façons de saluer et de dire qu’on est fatigué',
        'A scale of five registers, from formal to vulgar, with ways of saying hello and saying you are tired'],
      d: (function () {
        const d = [
          ['text', 170, 18, ['saluer', 'saying hello'], { sz: 10.5, b: true, s: 'mute' }],
          ['text', 285, 18, ['être fatigué', 'being tired'], { sz: 10.5, b: true, s: 'mute' }],
        ];
        const niveaux = [
          ['info', ['soutenu', 'formal'], ['How do you do?', 'Enchanté.'], ['I am exhausted.', 'Je suis épuisé.']],
          ['ok', ['courant', 'neutral'], ['Hello.', 'Bonjour.'], ['I’m tired.', 'Je suis fatigué.']],
          ['a', ['familier', 'informal'], ['Hi! Hiya!', 'Salut !'], ['I’m knackered.', 'Je suis crevé.']],
          ['warn', ['argot', 'slang'], ['Wagwan?', 'Wesh !'], ['I’m cream-crackered.', 'Je suis claqué.']],
          ['bad', ['vulgaire', 'vulgar'], null, null],
        ];
        niveaux.forEach(([s, nom, salut, fatigue], i) => {
          const y0 = 30 + i * 42;
          d.push(['rect', 8, y0, 96, 34, { s, r: 5, t: nom, sz: 11 }]);
          if (salut) {
            d.push(...paire(170, y0 + 13, salut[0], salut[1], { sz: 11 }));
            d.push(...paire(285, y0 + 13, fatigue[0], fatigue[1], { sz: 11 }));
          } else {
            d.push(['text', 228, y0 + 18, ['à comprendre, pas à employer', 'understand it, don’t use it'], { sz: 10.5, b: true, s: 'bad' }]);
          }
        });
        d.push(['line', 114, 34, 114, 230, { s: 'mute', arrow: 1 }]);
        return d;
      }()),
    },

    'app-gb-us': {
      k: 'dessin',
      h: 262,
      t: ['Britannique ou américain ?', 'British or American?'],
      l: ['L’application suit l’usage britannique ; le mot américain est donné en note', 'The app follows British usage; the American word is given in a note'],
      alt: ['Deux colonnes : orthographe et vocabulaire britanniques et américains, avec le français',
        'Two columns: British and American spelling and vocabulary, with the French'],
      d: (function () {
        const d = [
          ['rect', 52, 6, 96, 24, { s: 'a', r: 12, t: ['Royaume-Uni', 'British'], sz: 10.5 }],
          ['rect', 172, 6, 96, 24, { s: 'info', r: 12, t: ['États-Unis', 'American'], sz: 10.5 }],
          ['text', 318, 22, 'français', { sz: 10.5, b: true, s: 'mute' }],
          ['text', 8, 50, ['orthographe', 'spelling'], { a: 's', sz: 10, b: true, s: 'mute' }],
          ['text', 8, 164, ['vocabulaire', 'words'], { a: 's', sz: 10, b: true, s: 'mute' }],
          ['line', 8, 150, 352, 150, { s: 'g', dash: 1 }],
        ];
        const lignes = [
          ['colour', 'color', 'couleur', 68], ['centre', 'center', 'centre', 86],
          ['organise', 'organize', 'organiser', 104], ['travelled', 'traveled', 'voyagé', 122],
          ['programme', 'program', 'émission', 140],
          ['flat', 'apartment', 'appartement', 182], ['lift', 'elevator', 'ascenseur', 200],
          ['holiday', 'vacation', 'vacances', 218], ['trousers', 'pants', 'pantalon', 236],
          ['chips', 'fries', 'frites', 254],
        ];
        for (const [gb, us, fr, y] of lignes) {
          d.push(['text', 100, y, gb, { sz: 11.5, b: true, s: 'a' }]);
          d.push(['text', 220, y, us, { sz: 11.5, b: true, s: 'info' }]);
          d.push(['text', 318, y, fr, { sz: 10.5, s: 'mute' }]);
        }
        return d;
      }()),
    },

    'app-maison': {
      k: 'dessin',
      h: 286,
      t: ['Les pièces de la maison', 'The rooms of a house'],
      l: ['Une maison en coupe', 'A house, cut away'],
      alt: ['Une maison en coupe : grenier sous le toit, chambre et salle de bains à l’étage, salon, escalier et cuisine au rez-de-chaussée, jardin à côté',
        'A cutaway house: loft under the roof, bedroom and bathroom upstairs, living room, stairs and kitchen downstairs, garden beside it'],
      d: aplatir([
        [['rect', 20, 112, 280, 138, { s: 'n', r: 0 }],
          ['poly', [12, 113, 160, 36, 308, 113], { s: 'warn' }],
          ['line', 20, 181, 300, 181, { s: 'g' }],
          ['line', 175, 113, 175, 181, { s: 'g' }],
          ['line', 185, 181, 185, 250, { s: 'g' }],
          ['path', 'M24,250 V244 H32 V238 H40 V232 H48 V226 H56 V220 H64 V214 H72', { s: 'n' }],
          ['line', 4, 250, 356, 250, { s: 'n' }],
          ['line', 328, 210, 328, 250, { s: 'n' }],
          ['circ', 328, 196, 15, { s: 'ok' }]],
        paire(160, 86, 'loft', 'grenier', { sz: 11 }),
        paire(318, 50, 'roof', 'toit', { sz: 11 }),
        paire(97, 142, 'bedroom', 'chambre', { sz: 11 }),
        paire(237, 142, 'bathroom', 'salle de bains', { sz: 11 }),
        paire(48, 194, 'stairs', 'escalier', { sz: 10.5 }),
        paire(132, 212, 'living room', 'salon', { sz: 11 }),
        paire(242, 212, 'kitchen', 'cuisine', { sz: 11 }),
        paire(328, 264, 'garden', 'jardin', { sz: 11, s: 'ok' }),
      ]),
    },

    'app-corps': {
      k: 'dessin',
      h: 274,
      t: ['Le corps', 'The body'],
      l: ['Les parties du corps', 'Parts of the body'],
      alt: ['Une silhouette avec la tête, l’épaule, le bras, le coude, la main, le genou, la jambe et le pied',
        'A figure showing the head, shoulder, arm, elbow, hand, knee, leg and foot'],
      d: aplatir([
        [['circ', 180, 38, 20, { s: 'a' }],
          ['line', 180, 58, 180, 68, { s: 'n' }],
          ['rect', 156, 68, 48, 80, { s: 'a', r: 12 }],
          ['path', 'M158,76 L138,116 L130,152', { s: 'n' }],
          ['path', 'M202,76 L222,116 L230,152', { s: 'n' }],
          ['circ', 128, 160, 7, { s: 'a' }],
          ['circ', 232, 160, 7, { s: 'a' }],
          ['path', 'M168,148 L162,200 L158,248', { s: 'n' }],
          ['path', 'M192,148 L198,200 L202,248', { s: 'n' }],
          ['circ', 162, 200, 3, { s: 'n' }],
          ['circ', 198, 200, 3, { s: 'n' }],
          ['ell', 150, 252, 11, 4, { s: 'a' }],
          ['ell', 210, 252, 11, 4, { s: 'a' }],
          ['line', 96, 38, 158, 38, { s: 'g', dash: 1 }],
          ['line', 264, 70, 206, 72, { s: 'g', dash: 1 }],
          ['line', 96, 98, 146, 98, { s: 'g', dash: 1 }],
          ['line', 264, 116, 224, 116, { s: 'g', dash: 1 }],
          ['line', 96, 160, 120, 160, { s: 'g', dash: 1 }],
          ['line', 264, 200, 202, 200, { s: 'g', dash: 1 }],
          ['line', 96, 224, 160, 224, { s: 'g', dash: 1 }],
          ['line', 264, 252, 222, 252, { s: 'g', dash: 1 }]],
        paire(58, 34, 'head', 'la tête', { sz: 11 }),
        paire(302, 66, 'shoulder', 'l’épaule', { sz: 11 }),
        paire(58, 94, 'arm', 'le bras', { sz: 11 }),
        paire(302, 112, 'elbow', 'le coude', { sz: 11 }),
        paire(58, 156, 'hand', 'la main', { sz: 11 }),
        paire(302, 196, 'knee', 'le genou', { sz: 11 }),
        paire(58, 220, 'leg', 'la jambe', { sz: 11 }),
        paire(302, 248, 'foot', 'le pied', { sz: 11 }),
      ]),
    },

    'app-famille': {
      k: 'dessin',
      h: 214,
      t: ['La famille', 'The family'],
      l: ['Qui est qui dans la famille', 'Who’s who in the family'],
      alt: ['Un arbre : les grands-parents ; leurs enfants, la tante et la maman, mariée au papa ; le cousin, et moi avec mon frère et ma sœur',
        'A tree: the grandparents; their children, the aunt and mum, married to dad; the cousin, and me with my brother and sister'],
      d: (function () {
        const d = [
          // traits : couples et enfants
          ['line', 144, 25, 216, 25, { s: 'g' }],
          ['line', 180, 25, 180, 58, { s: 'g' }],
          ['line', 60, 58, 196, 58, { s: 'g' }],
          ['line', 60, 58, 60, 74, { s: 'g' }],
          ['line', 196, 58, 196, 74, { s: 'g' }],
          ['line', 240, 91, 262, 91, { s: 'g' }],
          ['line', 251, 91, 251, 124, { s: 'g' }],
          ['line', 158, 124, 314, 124, { s: 'g' }],
          ['line', 158, 124, 158, 140, { s: 'g' }],
          ['line', 236, 124, 236, 140, { s: 'g' }],
          ['line', 314, 124, 314, 140, { s: 'g' }],
          ['line', 60, 108, 60, 140, { s: 'g' }],
        ];
        const personnes = [
          [100, 25, 88, 'v', 'grandfather', 'grand-père'],
          [260, 25, 88, 'v', 'grandmother', 'grand-mère'],
          [60, 91, 88, 'info', 'aunt', 'la tante'],
          [196, 91, 88, 'ok', 'mum', 'maman'],
          [306, 91, 88, 'ok', 'dad', 'papa'],
          [60, 157, 88, 'info', 'cousin', 'cousin, cousine'],
          [158, 157, 72, 'a', 'me', 'moi'],
          [236, 157, 72, 'n', 'brother', 'frère'],
          [314, 157, 72, 'n', 'sister', 'sœur'],
        ];
        for (const [cx, cy, w, s, en, fr] of personnes) {
          d.push(['rect', cx - w / 2, cy - 17, w, 34, { s, r: 6 }]);
          d.push(...paire(cx, cy - 5, en, fr, { sz: 10.5, ecart: 13 }));
        }
        d.push(['text', 180, 198, ['⚠ « parents » = le père et la mère ; les autres : « relatives »',
          '⚠ “parents” = mother and father; everyone else: “relatives”'], { sz: 10, b: true, s: 'warn', max: 344 }]);
        return d;
      }()),
    },

    'app-heure': {
      k: 'dessin',
      h: 326,
      t: ['Dire l’heure', 'Telling the time'],
      l: ['Past : après l’heure ; to : avant l’heure suivante', 'Past: after the hour; to: before the next hour'],
      alt: ['Une horloge : o’clock en haut, quarter past à droite, half past en bas, quarter to à gauche ; et six exemples d’heures',
        'A clock: o’clock at the top, quarter past on the right, half past at the bottom, quarter to on the left; and six example times'],
      d: aplatir([
        horloge(180, 112, 84),
        [['path', 'M180,20 A92,92 0 0 1 180,204', { s: 'ok', arrow: true }],
          ['path', 'M180,204 A92,92 0 0 1 180,20', { s: 'warn', arrow: true }],
          ['text', 292, 40, 'past', { sz: 12, b: true, s: 'ok' }],
          ['text', 292, 54, ['après', 'after'], { sz: 10, s: 'mute' }],
          ['text', 68, 40, 'to', { sz: 12, b: true, s: 'warn' }],
          ['text', 68, 54, ['avant', 'before'], { sz: 10, s: 'mute' }]],
        paire(180, 50, 'o’clock', 'pile', { sz: 10.5, s: 'a', ecart: 12 }),
        [['text', 224, 108, 'quarter', { sz: 10.5, b: true, s: 'ok' }],
          ['text', 224, 120, 'past', { sz: 10.5, b: true, s: 'ok' }],
          ['text', 224, 133, 'et quart', { sz: 9, s: 'mute' }]],
        paire(180, 160, 'half past', 'et demie', { sz: 10.5, s: 'ok', ecart: 12 }),
        [['text', 136, 108, 'quarter', { sz: 10.5, b: true, s: 'warn' }],
          ['text', 136, 120, 'to', { sz: 10.5, b: true, s: 'warn' }],
          ['text', 136, 133, 'moins le quart', { sz: 9, s: 'mute' }]],
        paire(12, 236, '7:00  seven o’clock', 'sept heures', { a: 's', sz: 10.5, ecart: 13 }),
        paire(12, 270, '7:15  quarter past seven', 'sept heures et quart', { a: 's', sz: 10.5, ecart: 13 }),
        paire(12, 304, '7:30  half past seven', 'sept heures et demie', { a: 's', sz: 10.5, ecart: 13 }),
        paire(186, 236, '7:45  quarter to eight', 'huit heures moins le quart', { a: 's', sz: 10.5, ecart: 13 }),
        paire(186, 270, '7:05  five past seven', 'sept heures cinq', { a: 's', sz: 10.5, ecart: 13 }),
        paire(186, 304, '7:40  twenty to eight', 'huit heures moins vingt', { a: 's', sz: 10.5, ecart: 13 }),
      ]),
    },

    'app-dates': {
      k: 'dessin',
      h: 230,
      t: ['Écrire et dire la date', 'Writing and saying the date'],
      l: ['Aux États-Unis, le mois passe avant le jour', 'In the US, the month comes before the day'],
      alt: ['Le 30 septembre 2026 écrit et dit à la britannique, à l’américaine et à la française',
        'The 30th of September 2026 written and said the British, American and French way'],
      d: (function () {
        const d = [];
        const pays = [
          ['a', ['Royaume-Uni', 'UK'], '30/09/2026', '30 September 2026', 'the thirtieth of September'],
          ['warn', ['États-Unis', 'US'], '09/30/2026', 'September 30, 2026', 'September thirtieth'],
          ['ok', ['France', 'France'], '30/09/2026', '30 septembre 2026', 'le trente septembre'],
        ];
        pays.forEach(([s, nom, chiffres, lettres, dit], i) => {
          const y0 = 8 + i * 66;
          d.push(['rect', 8, y0, 344, 58, { s, r: 6 }]);
          d.push(['rect', 14, y0 + 17, 76, 24, { s: 'n', r: 12, t: nom, sz: 10 }]);
          d.push(['text', 158, y0 + 20, chiffres, { sz: 12, b: true, mono: true, s }]);
          d.push(['text', 280, y0 + 20, lettres, { sz: 11 }]);
          d.push(['text', 220, y0 + 42, ['« ' + dit + ' »', '“' + dit + '”'], { sz: 10.5, s: 'mute' }]);
        });
        d.push(['text', 180, 218, ['⚠ 09/10 : le 9 octobre au Royaume-Uni, le 10 septembre aux États-Unis',
          '⚠ 09/10: 9 October in the UK, 10 September in the US'], { sz: 10, b: true, s: 'warn', max: 344 }]);
        return d;
      }()),
    },

    'app-meteo': {
      k: 'dessin',
      h: 228,
      t: ['Le temps qu’il fait', 'The weather'],
      l: ['L’anglais dit « it’s » ; le français « il fait », « il y a », « il pleut »…', 'English says “it’s”; French says « il fait », « il y a », « il pleut »…'],
      alt: ['Huit pictogrammes : soleil, nuages, pluie, vent, neige, brouillard, orage, gel, avec la phrase anglaise et la phrase française',
        'Eight symbols: sun, clouds, rain, wind, snow, fog, storm, frost, with the English and French sentences'],
      d: meteo(),
    },

    'app-directions': {
      k: 'dessin',
      h: 258,
      t: ['Indiquer le chemin', 'Giving directions'],
      l: ['Au Royaume-Uni, on tourne dans le sens des aiguilles d’une montre autour d’un rond-point', 'In the UK, you go clockwise round a roundabout'],
      alt: ['Six vignettes : tout droit, à gauche, à droite, la deuxième sortie au rond-point, au feu, au coin de la rue',
        'Six panels: straight on, left, right, the second exit at the roundabout, at the traffic lights, on the corner'],
      d: (function () {
        const d = [];
        const vignettes = [
          ['droit', 'go straight on', 'allez tout droit'],
          ['gauche', 'turn left', 'tournez à gauche'],
          ['droite', 'turn right', 'tournez à droite'],
          ['rond', 'take the second exit', 'prenez la deuxième sortie'],
          ['feu', 'at the traffic lights', 'au feu'],
          ['coin', 'on the corner', 'au coin de la rue'],
        ];
        vignettes.forEach(([genre, en, fr], i) => {
          const x0 = (i % 3) * 120;
          const y0 = 4 + Math.floor(i / 3) * 124;
          const cx = x0 + 60;
          switch (genre) {
            case 'droit':
              d.push(['line', cx - 16, y0 + 8, cx - 16, y0 + 86, { s: 'g' }], ['line', cx + 16, y0 + 8, cx + 16, y0 + 86, { s: 'g' }]);
              d.push(['line', cx, y0 + 80, cx, y0 + 14, { s: 'a', arrow: 1 }]);
              break;
            case 'gauche':
              d.push(['path', `M${cx + 8},${y0 + 82} V${y0 + 42} Q${cx + 8},${y0 + 26} ${cx - 8},${y0 + 26} H${cx - 40}`, { s: 'a', arrow: true }]);
              break;
            case 'droite':
              d.push(['path', `M${cx - 8},${y0 + 82} V${y0 + 42} Q${cx - 8},${y0 + 26} ${cx + 8},${y0 + 26} H${cx + 40}`, { s: 'a', arrow: true }]);
              break;
            case 'rond':
              d.push(['line', cx, y0 + 62, cx, y0 + 88, { s: 'g' }], ['line', cx - 18, y0 + 44, cx - 46, y0 + 44, { s: 'g' }]);
              d.push(['line', cx, y0 + 26, cx, y0 + 2, { s: 'g' }], ['line', cx + 18, y0 + 44, cx + 46, y0 + 44, { s: 'g' }]);
              d.push(['circ', cx, y0 + 44, 14, { s: 'ok' }]);
              d.push(['path', `M${cx - 5},${y0 + 88} L${cx - 5},${y0 + 68} A24,24 0 0 1 ${cx - 24},${y0 + 44} A24,24 0 0 1 ${cx - 5},${y0 + 20} L${cx - 5},${y0 + 4}`, { s: 'a', arrow: true }]);
              d.push(['text', cx - 40, y0 + 36, '1', { sz: 10, b: true, s: 'mute' }], ['text', cx + 10, y0 + 8, '2', { sz: 10, b: true, s: 'a' }]);
              break;
            case 'feu':
              d.push(['line', cx, y0 + 66, cx, y0 + 88, { s: 'n' }]);
              d.push(['rect', cx - 11, y0 + 12, 22, 56, { s: 'n', r: 5 }]);
              d.push(['circ', cx, y0 + 24, 6, { s: 'bad' }], ['circ', cx, y0 + 40, 6, { s: 'warn' }], ['circ', cx, y0 + 56, 6, { s: 'ok' }]);
              break;
            default:   // coin
              d.push(['rect', x0 + 20, y0 + 10, 56, 56, { s: 'v', r: 2 }]);
              d.push(['line', x0 + 14, y0 + 76, x0 + 106, y0 + 76, { s: 'g' }], ['line', x0 + 86, y0 + 4, x0 + 86, y0 + 86, { s: 'g' }]);
              d.push(['circ', x0 + 76, y0 + 66, 7, { s: 'a' }]);
          }
          d.push(...paire(cx, y0 + 102, en, fr, { sz: 10.5, max: 116, ecart: 14 }));
        });
        return d;
      }()),
    },

  });

})(window);
