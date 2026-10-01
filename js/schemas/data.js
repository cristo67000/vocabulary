'use strict';
/*
 * Schémas de la catégorie « Données et encodage ».
 */
(function (racine) {
  Object.assign(racine.Schemas = racine.Schemas || {}, {

    'data-octet': {
      k: 'cases',
      alt: ['Un octet : huit bits, dont chacun vaut une puissance de deux', 'A byte: eight bits, each worth a power of two'],
      rows: [
        { t: ['Un octet = 8 bits', 'A byte = 8 bits'], cells: ['0', '1', '0', '0', '0', '0', '0', '1'], s: ['', 'a', '', '', '', '', '', 'a'], cap: ['128', '64', '32', '16', '8', '4', '2', '1'], w: 38, gap: [3] },
        { sep: ['64 + 1 = 65 = « A » en ASCII', '64 + 1 = 65 = “A” in ASCII'], s: 'a' },
        { t: ['En hexadécimal : deux chiffres', 'In hexadecimal: two digits'], cells: ['4', '1'], s: 'v', w: 44 },
      ],
    },

    'data-unites': {
      k: 'cases',
      alt: ['Unités décimales (Ko, Mo, Go) et binaires (Kio, Mio, Gio)', 'Decimal units (KB, MB, GB) and binary units (KiB, MiB, GiB)'],
      rows: [
        { t: ['Décimales (×1000)', 'Decimal (×1000)'], cells: [['1 Ko', '1 KB'], ['1 Mo', '1 MB'], ['1 Go', '1 GB']], s: 'a', cap: ['1 000 o', '1 000 Ko', '1 000 Mo'], w: 98, mono: false, sz: 14 },
        { t: ['Binaires (×1024)', 'Binary (×1024)'], cells: ['1 Kio', '1 Mio', '1 Gio'], s: 'v', cap: ['1 024 o', '1 024 Kio', '1 024 Mio'], w: 98, mono: false, sz: 14 },
      ],
      l: ['À Go égal, l’écart grandit : 1 Gio vaut environ 1,07 Go.', 'The gap grows: 1 GiB is about 1.07 GB.'],
    },

    'data-chunk': {
      k: 'cases',
      alt: ['Un gros fichier découpé en morceaux (chunks) traités un à un', 'A big file cut into chunks processed one at a time'],
      rows: [
        { t: ['Gros fichier découpé', 'Big file, cut up'], cells: ['chunk 1', 'chunk 2', 'chunk 3', 'chunk 4'], s: ['ok', 'a', 'mute', 'mute'], w: 76, mono: false, sz: 12 },
        { sep: ['lus un par un', 'read one by one'] },
        { t: ['En mémoire : un seul chunk à la fois', 'In memory: one chunk at a time'], cells: ['chunk 2'], s: 'a', w: 96, mono: false, sz: 12 },
      ],
    },

    'data-buffer': {
      k: 'graphe',
      alt: ['Un tampon absorbe la différence de vitesse entre producteur et consommateur', 'A buffer absorbs the speed difference between producer and consumer'],
      n: [
        { id: 'p', t: ['Producteur\npar à-coups', 'Producer\nin bursts'], c: 0, r: 0, s: 'a', w: 94 },
        { id: 'b', t: ['Buffer\n(tampon)', 'Buffer'], c: 1, r: 0, f: 'db', s: 'warn', w: 90, h: 54 },
        { id: 'c', t: ['Consommateur\nrégulier', 'Consumer\nsteady'], c: 2, r: 0, s: 'ok', w: 100 },
      ],
      e: [['p', 'b', '', 'a'], ['b', 'c', '', 'ok']],
    },

    'data-stream': {
      k: 'graphe',
      alt: ['Un flux transporte des données morceau par morceau, de la source à la destination', 'A stream carries data piece by piece, from source to destination'],
      n: [
        { id: 's', t: 'Source', c: 0, r: 0, f: 'db', s: 'v', w: 86, h: 50 },
        { id: 't', t: ['Traitement', 'Processing'], c: 1, r: 0, s: 'a', w: 90 },
        { id: 'd', t: 'Destination', c: 2, r: 0, s: 'ok', w: 92 },
      ],
      e: [['s', 't', '', 'v'], ['t', 'd', '', 'ok']],
      l: ['Les données circulent morceau par morceau (chunk) : tout n’est jamais en mémoire à la fois.', 'Data flows piece by piece (chunk): it is never all in memory at once.'],
    },

    'data-blob': {
      k: 'graphe',
      alt: ['Un Blob enveloppe des octets bruts avec un type MIME, pour les afficher ou les télécharger', 'A Blob wraps raw bytes with a MIME type, to display or download them'],
      gy: 76,
      n: [
        { id: 'o', t: ['Octets bruts', 'Raw bytes'], c: 0, r: 0.5, s: 'a', w: 94 },
        { id: 'b', t: 'Blob', sub: ['type MIME\n+ taille', 'MIME type\n+ size'], c: 1, r: 0.5, s: 'v', w: 92, h: 58 },
        { id: 'i', t: '<img src=…>', c: 2, r: 0, s: 'ok', w: 96, mono: true, sz: 10 },
        { id: 'a', t: '<a download>', c: 2, r: 1, s: 'ok', w: 96, mono: true, sz: 10 },
      ],
      e: [['o', 'b', '', 'a'], ['b', 'i', '', 'v'], ['b', 'a', '', 'v']],
      l: ['new Blob(octets) puis URL.createObjectURL(blob) donne une adresse temporaire pour l’afficher ou la télécharger.', 'new Blob(bytes) then URL.createObjectURL(blob) gives a temporary address to display or download it.'],
    },

    'data-ascii': {
      k: 'cases',
      alt: ['Quelques caractères ASCII et leur code numérique', 'A few ASCII characters and their numeric code'],
      rows: [
        { t: ['Caractère → code', 'Character → code'], cells: ['A', 'B', 'C', 'a', 'b', '0', '1', '␣'], s: ['a', 'a', 'a', 'v', 'v', 'ok', 'ok', 'mute'], cap: ['65', '66', '67', '97', '98', '48', '49', '32'], w: 38 },
      ],
      l: ['Majuscules à partir de 65, minuscules à partir de 97 : « a » = « A » + 32.', 'Capitals start at 65, lowercase at 97: “a” = “A” + 32.'],
    },

    'data-utf8': {
      k: 'cases',
      alt: ['UTF-8 : un caractère s’écrit sur un à quatre octets', 'UTF-8: a character is written on one to four bytes'],
      rows: [
        { t: ['Caractère', 'Character'], cells: ['A', 'é', '€', '😀'], s: ['a', 'v', 'warn', 'bad'], cap: ['U+0041', 'U+00E9', 'U+20AC', 'U+1F600'], w: 74, sz: 17 },
        { sep: ['UTF-8', 'UTF-8'] },
        { t: ['Octets (hexadécimal)', 'Bytes (hexadecimal)'], cells: ['41', 'C3 A9', 'E2 82 AC', 'F0 9F 98 80'], s: ['a', 'v', 'warn', 'bad'], cap: [['1 octet', '1 byte'], ['2 octets', '2 bytes'], ['3 octets', '3 bytes'], ['4 octets', '4 bytes']], w: 78, sz: 11 },
      ],
    },

    'data-base64': {
      k: 'cases',
      alt: ['Base64 : trois octets deviennent quatre caractères de six bits', 'Base64: three bytes become four six-bit characters'],
      rows: [
        { t: ['3 octets = 24 bits', '3 bytes = 24 bits'], cells: ['M', 'a', 'n'], s: 'a', cap: ['4D', '61', '6E'], w: 58 },
        { sep: ['regroupés par 6 bits', 'regrouped by 6 bits'] },
        { cells: ['010011', '010110', '000101', '101110'], s: 'v', cap: ['19', '22', '5', '46'], w: 72, sz: 11 },
        { sep: ['table Base64', 'Base64 table'] },
        { t: ['4 caractères', '4 characters'], cells: ['T', 'W', 'F', 'u'], s: 'ok', w: 58 },
      ],
    },

    'data-hexa': {
      k: 'cases',
      alt: ['L’hexadécimal compte de 0 à F : deux chiffres suffisent pour un octet', 'Hexadecimal counts from 0 to F: two digits are enough for a byte'],
      rows: [
        { t: ['Les 16 chiffres', 'The 16 digits'], cells: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'], s: ['', '', '', '', '', '', '', '', '', '', 'a', 'a', 'a', 'a', 'a', 'a'], cap: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], w: 20, h: 26, sz: 12, gap: [9] },
        { sep: ['un octet = deux chiffres', 'a byte = two digits'] },
        { cells: ['F', 'F'], s: 'v', cap: ['15 × 16', '15'], w: 50 },
        { sep: ['= 255', '= 255'], s: 'ok' },
      ],
    },

    'data-endian': {
      k: 'cases',
      alt: ['Le nombre 0x12345678 rangé en gros-boutiste et en petit-boutiste', 'The number 0x12345678 laid out as big-endian and little-endian'],
      rows: [
        { t: ['Gros-boutiste (big-endian)', 'Big-endian'], cells: ['12', '34', '56', '78'], s: ['a', '', '', 'ok'], cap: ['adresse 0', '1', '2', '3'], w: 62 },
        { t: ['Petit-boutiste (little-endian)', 'Little-endian'], cells: ['78', '56', '34', '12'], s: ['ok', '', '', 'a'], cap: ['adresse 0', '1', '2', '3'], w: 62 },
      ],
      l: ['En bleu : l’octet de poids fort (12) ; en vert : celui de poids faible (78).', 'In blue: the most significant byte (12); in green: the least significant (78).'],
    },

    'data-json': {
      k: 'arbre',
      alt: ['Un document JSON est un arbre d’objets, de tableaux et de valeurs', 'A JSON document is a tree of objects, arrays and values'],
      racine: {
        t: '{ }', s: 'a', k: [
          { t: 'nom\n"Zoé"', s: 'ok' },
          { t: 'age\n34', s: 'ok' },
          { t: 'langages\n[ ]', s: 'v', k: [{ t: '"js"', s: 'ok' }, { t: '"py"', s: 'ok' }] },
        ],
      },
    },

    'data-serialisation': {
      k: 'graphe',
      alt: ['Sérialiser : transformer un objet en texte pour l’enregistrer ou l’envoyer, puis le reconstruire', 'Serializing: turning an object into text to store or send it, then rebuilding it'],
      gy: 72,
      n: [
        { id: 'o', t: ['Objet\nen mémoire', 'Object\nin memory'], c: 0, r: 0, s: 'a', w: 90 },
        { id: 't', t: ['Texte\nJSON', 'JSON\ntext'], c: 1, r: 0, f: 'file', s: 'v', w: 84 },
        { id: 'd', t: ['Fichier\nou réseau', 'File or\nnetwork'], c: 2, r: 0, s: 'ok', w: 90 },
      ],
      e: [['o', 't', '', 'a'], ['t', 'o', '', 'v dash'], ['t', 'd', '', 'ok']],
      l: ['stringify : objet → texte · parse : texte → objet. Le texte peut alors être écrit ou envoyé.', 'stringify: object → text · parse: text → object. The text can then be written or sent.'],
    },

    'data-parsing': {
      k: 'graphe',
      alt: ['Le parsing transforme un texte en une structure exploitable', 'Parsing turns a text into a usable structure'],
      n: [
        { id: 't', t: ['Texte', 'Text'], sub: '{"a":[1,2]}', c: 0, r: 0, f: 'file', s: 'a', w: 100, h: 50 },
        { id: 'p', t: ['Parseur', 'Parser'], c: 1, r: 0, s: 'v', w: 84 },
        { id: 'a', t: ['Objet', 'Object'], sub: 'a → [1, 2]', c: 2, r: 0, s: 'ok', w: 100, h: 50 },
      ],
      e: [['t', 'p', '', 'a'], ['p', 'a', '', 'v']],
    },

    'data-flottant': {
      k: 'dessin',
      h: 190,
      alt: ['0,1 + 0,2 ne fait pas exactement 0,3 en flottants, et la structure d’un flottant 64 bits', '0.1 + 0.2 is not exactly 0.3 in floats, and the layout of a 64-bit float'],
      d: [
        ['rect', 8, 14, 46, 28, { s: 'a', t: '0.1', mono: true, sz: 12 }],
        ['text', 66, 32, '+', { sz: 15, b: true }],
        ['rect', 80, 14, 46, 28, { s: 'a', t: '0.2', mono: true, sz: 12 }],
        ['text', 138, 32, '=', { sz: 15, b: true }],
        ['rect', 152, 14, 200, 28, { s: 'bad', t: '0.30000000000000004', mono: true, sz: 12 }],
        ['text', 180, 66, ['presque 0,3, mais pas exactement', 'almost 0.3, but not exactly'], { s: 'bad', sz: 11, b: true }],
        ['text', 8, 104, ['Un flottant 64 bits (IEEE 754)', 'A 64-bit float (IEEE 754)'], { a: 's', sz: 11, b: true, s: 'mute' }],
        ['rect', 8, 114, 12, 30, { s: 'bad' }],
        ['rect', 22, 114, 76, 30, { s: 'warn', t: ['11 bits', '11 bits'], sz: 10.5 }],
        ['rect', 100, 114, 252, 30, { s: 'ok', t: ['52 bits', '52 bits'], sz: 10.5 }],
        ['text', 14, 162, ['signe', 'sign'], { s: 'bad', sz: 10, b: true }],
        ['text', 60, 162, ['exposant', 'exponent'], { s: 'warn', sz: 10, b: true }],
        ['text', 226, 162, ['mantisse (les chiffres)', 'mantissa (the digits)'], { s: 'ok', sz: 10, b: true }],
      ],
    },

    'data-id': {
      k: 'dessin',
      h: 164,
      alt: ['Une table où la colonne id distingue deux personnes de même nom', 'A table where the id column tells apart two people with the same name'],
      d: [
        ['text', 20, 14, ['clé primaire', 'primary key'], { a: 's', s: 'warn', sz: 10, b: true }],
        ['rect', 20, 22, 60, 26, { s: 'warn', t: 'id', mono: true, sz: 11, r: 3 }],
        ['rect', 80, 22, 120, 26, { s: 'a', t: 'nom', mono: true, sz: 11, r: 3 }],
        ['rect', 200, 22, 140, 26, { s: 'a', t: 'ville', mono: true, sz: 11, r: 3 }],
        ['rect', 20, 48, 60, 26, { s: 'mute', t: '1', mono: true, sz: 11, r: 3 }],
        ['rect', 80, 48, 120, 26, { s: 'mute', t: 'Zoé', mono: true, sz: 11, r: 3 }],
        ['rect', 200, 48, 140, 26, { s: 'mute', t: 'Lyon', mono: true, sz: 11, r: 3 }],
        ['rect', 20, 74, 60, 26, { s: 'mute', t: '2', mono: true, sz: 11, r: 3 }],
        ['rect', 80, 74, 120, 26, { s: 'mute', t: 'Léo', mono: true, sz: 11, r: 3 }],
        ['rect', 200, 74, 140, 26, { s: 'mute', t: 'Nice', mono: true, sz: 11, r: 3 }],
        ['rect', 20, 100, 60, 26, { s: 'mute', t: '3', mono: true, sz: 11, r: 3 }],
        ['rect', 80, 100, 120, 26, { s: 'mute', t: 'Zoé', mono: true, sz: 11, r: 3 }],
        ['rect', 200, 100, 140, 26, { s: 'mute', t: 'Lille', mono: true, sz: 11, r: 3 }],
        ['text', 180, 148, ['deux « Zoé », mais des identifiants différents', 'two “Zoé”, but different identifiers'], { sz: 10.5, s: 'mute', b: true }],
      ],
    },

    'data-uuid': {
      k: 'dessin',
      h: 78,
      alt: ['Un UUID : 32 chiffres hexadécimaux en cinq groupes de 8, 4, 4, 4 et 12', 'A UUID: 32 hexadecimal digits in five groups of 8, 4, 4, 4 and 12'],
      d: [
        ['rect', 8, 10, 80, 28, { s: 'a', t: '550e8400', mono: true, sz: 11, r: 4 }],
        ['rect', 92, 10, 44, 28, { s: 'v', t: 'e29b', mono: true, sz: 11, r: 4 }],
        ['rect', 140, 10, 44, 28, { s: 'warn', t: '41d4', mono: true, sz: 11, r: 4 }],
        ['rect', 188, 10, 44, 28, { s: 'v', t: 'a716', mono: true, sz: 11, r: 4 }],
        ['rect', 236, 10, 116, 28, { s: 'a', t: '446655440000', mono: true, sz: 11, r: 4 }],
        ['text', 48, 56, ['8 chiffres', '8 digits'], { s: 'a', sz: 10, b: true }],
        ['text', 114, 56, '4', { s: 'v', sz: 10, b: true }],
        ['text', 162, 56, ['4 · version', '4 · version'], { s: 'warn', sz: 10, b: true }],
        ['text', 210, 56, '4', { s: 'v', sz: 10, b: true }],
        ['text', 294, 56, ['12 chiffres', '12 digits'], { s: 'a', sz: 10, b: true }],
      ],
    },

  });
})(window);
