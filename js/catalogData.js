window.AtelierData = (function () {
  const MANNEQUIN_PRESETS = [
    {
      id: 'male-standard',
      name: 'Pria Standar',
      subtitle: '175 cm • Proporsional',
      genderBias: 0.0,
      body: { height: 175, shoulder: 45, chest: 96, waist: 80, hip: 94, armLength: 61 }
    },
    {
      id: 'male-athletic',
      name: 'Pria Atletis',
      subtitle: '181 cm • Bahu Bidang',
      genderBias: 0.0,
      body: { height: 181, shoulder: 49, chest: 106, waist: 82, hip: 97, armLength: 63 }
    },
    {
      id: 'female-balanced',
      name: 'Wanita Proporsional',
      subtitle: '164 cm • Siluet Seimbang',
      genderBias: 0.85,
      body: { height: 164, shoulder: 38, chest: 88, waist: 67, hip: 95, armLength: 56 }
    },
    {
      id: 'female-curvy',
      name: 'Wanita Curvy',
      subtitle: '166 cm • Hourglass',
      genderBias: 1.0,
      body: { height: 166, shoulder: 39, chest: 99, waist: 74, hip: 109, armLength: 57 }
    },
    {
      id: 'unisex-petite',
      name: 'Petite / Ramping',
      subtitle: '156 cm • Ringkas',
      genderBias: 0.6,
      body: { height: 156, shoulder: 35, chest: 80, waist: 62, hip: 86, armLength: 53 }
    },
    {
      id: 'plus-comfort',
      name: 'Plus Size Nyaman',
      subtitle: '172 cm • Big & Comfy',
      genderBias: 0.35,
      body: { height: 172, shoulder: 48, chest: 114, waist: 102, hip: 115, armLength: 60 }
    }
  ];

  const MANNEQUIN_MATERIALS = [
    { id: 'clay', name: 'Studio Clay', swatch: '#e8e2d8', color: 0xe6dfd4, jointColor: 0xd5ccc0, roughness: 0.60, metalness: 0.04, useLinenMap: false },
    { id: 'tailor', name: 'Tailor Linen', swatch: '#d9ccb8', color: 0xd8cbb7, jointColor: 0x7b563a, roughness: 0.86, metalness: 0.02, useLinenMap: true },
    { id: 'skin-light', name: 'Warm Ivory', swatch: '#f0cdb2', color: 0xecc7aa, jointColor: 0xe3ba9a, roughness: 0.50, metalness: 0.02, useLinenMap: false },
    { id: 'skin-tan', name: 'Sawo Matang', swatch: '#c88d64', color: 0xc58a60, jointColor: 0xb77c53, roughness: 0.48, metalness: 0.03, useLinenMap: false },
    { id: 'obsidian', name: 'Matte Graphite', swatch: '#393735', color: 0x3b3836, jointColor: 0x262422, roughness: 0.42, metalness: 0.20, useLinenMap: false }
  ];

  const MEASUREMENT_CONFIG = [
    { key: 'height', label: 'Tinggi Badan', min: 150, max: 195, unit: 'cm' },
    { key: 'shoulder', label: 'Lebar Bahu', min: 34, max: 54, unit: 'cm' },
    { key: 'chest', label: 'Lingkar Dada', min: 74, max: 126, unit: 'cm' },
    { key: 'waist', label: 'Lingkar Pinggang', min: 56, max: 116, unit: 'cm' },
    { key: 'hip', label: 'Lingkar Pinggul', min: 78, max: 126, unit: 'cm' },
    { key: 'armLength', label: 'Panjang Lengan', min: 50, max: 68, unit: 'cm' }
  ];

  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const BASE_SIZE_CHART = {
    XS:  { shoulder: 38, chest: 86,  waist: 70,  hip: 88,  lengthScale: 0.93 },
    S:   { shoulder: 41, chest: 93,  waist: 76,  hip: 94,  lengthScale: 0.96 },
    M:   { shoulder: 44, chest: 100, waist: 83,  hip: 100, lengthScale: 1.00 },
    L:   { shoulder: 47, chest: 108, waist: 91,  hip: 107, lengthScale: 1.04 },
    XL:  { shoulder: 50, chest: 116, waist: 100, hip: 115, lengthScale: 1.08 },
    XXL: { shoulder: 53, chest: 125, waist: 110, hip: 124, lengthScale: 1.12 }
  };

  // ==================== 20 FLAGSHIP PRODUCT-GRADE 3D GARMENTS ====================
  const CATALOG = [
    // --- OUTER / JAKET (VARSITY, LEATHER, DENIM, HOODIE, BLAZER) ---
    {
      id: 'varsity-heritage',
      name: 'Jaket Varsity Heritage Wool-Leather',
      brand: 'VARSITY ARCHIVE',
      category: 'outer',
      slot: 'outer',
      style: 'varsity',
      pattern: 'solid',
      fitType: 'relaxed',
      easeBonus: 7,
      stretch: 0.05,
      fabric: 'wool',
      fabricLabel: 'Melton Wool 420gsm • Lengan Kulit',
      badge: 'Best Seller',
      price: 899000,
      rating: 4.9,
      sold: 1640,
      description: 'Jaket varsity klasik dengan badan Melton wool hangat, lengan kulit kontras warna cream, kerah & manset rib bergaris, kancing snap metal, dan bordir chenille di dada.',
      colors: [
        { name: 'Forest Green & Cream', hex: '#1e4234', secondary: '#efe8d8', accent: '#c9a45c' },
        { name: 'Royal Navy & Bone', hex: '#1d2d4a', secondary: '#f2ece1', accent: '#c63b3b' },
        { name: 'Crimson Burgundy & Cream', hex: '#631d28', secondary: '#efe7d6', accent: '#d8b467' },
        { name: 'Obsidian & Slate', hex: '#202124', secondary: '#d8d5cf', accent: '#e0e0e0' }
      ],
      sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'jacket-leather-biker',
      name: 'Jaket Kulit Biker Full-Grain Moto',
      brand: 'NOIR ATELIER',
      category: 'outer',
      slot: 'outer',
      style: 'leather_jacket',
      pattern: 'solid',
      fitType: 'regular',
      easeBonus: 4,
      stretch: 0.04,
      fabric: 'leather',
      fabricLabel: '100% Lambskin Leather • Zip YKK Silver',
      badge: 'Flagship',
      price: 1450000,
      rating: 4.9,
      sold: 890,
      description: 'Jaket biker kulit asli bertekstur halus dengan resleting diagonal metalik, kerah lapel lebar bertabur snap-stud silver, epaulets bahu, dan sabuk pinggang.',
      colors: [
        { name: 'Jet Black Moto', hex: '#1a1a1c', secondary: '#c8cdd4', accent: '#d6dbe2' },
        { name: 'Espresso Saddle', hex: '#462b1d', secondary: '#d4b27c', accent: '#cfb07a' },
        { name: 'Oxblood Leather', hex: '#521b22', secondary: '#c8cdd4', accent: '#d6dbe2' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'jacket-denim-trucker',
      name: 'Jaket Denim Selvedge 13oz Trucker',
      brand: 'RIVET & CO',
      category: 'outer',
      slot: 'outer',
      style: 'denim_jacket',
      pattern: 'denim_weave',
      fitType: 'regular',
      easeBonus: 4,
      stretch: 0.05,
      fabric: 'denim',
      fabricLabel: '13oz Stretch Selvedge • Jahitan Kontras',
      badge: 'Trending',
      price: 689000,
      rating: 4.9,
      sold: 1190,
      description: 'Jaket denim trucker dengan tenunan twill indigo autentik, jahitan kontras benang emas, dua saku dada bertutup, kancing kuningan, dan 2% elastane agar siku tidak kaku.',
      colors: [
        { name: 'Raw Indigo Wash', hex: '#2f4869', secondary: '#c89242', accent: '#d9a452' },
        { name: 'Vintage Sky Denim', hex: '#6c8cad', secondary: '#c89242', accent: '#d9a452' },
        { name: 'Washed Charcoal', hex: '#2c2f34', secondary: '#80858c', accent: '#a8adb5' },
        { name: 'Natural Ecru Denim', hex: '#e2dacb', secondary: '#9d7c54', accent: '#b08b60' }
      ],
      sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'hoodie-essential',
      name: 'Hoodie Heavy Fleece 380gsm Studio',
      brand: 'KINETA LAB',
      category: 'outer',
      slot: 'outer',
      style: 'hoodie',
      pattern: 'solid',
      fitType: 'relaxed',
      easeBonus: 9,
      stretch: 0.08,
      fabric: 'cotton',
      fabricLabel: 'Brushed Cotton Fleece 380gsm • Adem',
      price: 499000,
      rating: 4.9,
      sold: 2150,
      description: 'Hoodie boxy-relaxed dengan tudung double-layered berstruktur, kantong kanguru luas, tali berujung metalik, serta rib pinggang dan manset yang elastis.',
      colors: [
        { name: 'Heather Stone', hex: '#bebbb3', secondary: '#9e9a92', accent: '#ece8df' },
        { name: 'Deep Midnight Navy', hex: '#1f2b3e', secondary: '#151e2c', accent: '#d6d9df' },
        { name: 'Mocha Earth', hex: '#765846', secondary: '#5e4435', accent: '#e7dcd0' },
        { name: 'Matte Obsidian', hex: '#202124', secondary: '#141517', accent: '#d2d2d4' }
      ],
      sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'blazer-structured',
      name: 'Blazer Tailored Tropical Wool',
      brand: 'MAISON VELO',
      category: 'outer',
      slot: 'outer',
      style: 'blazer',
      pattern: 'solid',
      fitType: 'regular',
      easeBonus: 4,
      stretch: 0.04,
      fabric: 'wool',
      fabricLabel: 'Tropical Wool Blend • Anti-Kusut',
      price: 849000,
      rating: 4.9,
      sold: 560,
      description: 'Blazer semi-formal berpotongan presisi dengan notched lapel, saku dada welt, kancing tanduk gelap, dan ruang bahu ergonomis.',
      colors: [
        { name: 'Warm Taupe', hex: '#9e8f7e', secondary: '#7f7162', accent: '#3d352e' },
        { name: 'Charcoal Executive', hex: '#292c31', secondary: '#1e2024', accent: '#121316' },
        { name: 'Camel Sand', hex: '#b88d60', secondary: '#967048', accent: '#4f3822' },
        { name: 'Olive Tailored', hex: '#434b3b', secondary: '#343b2e', accent: '#23281f' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },

    // --- ATASAN (BATIK, KEMEJA, KAOS, KNIT) ---
    {
      id: 'batik-parang-kemeja',
      name: 'Kemeja Batik Parang Sogan Premium',
      brand: 'NUSANTARA ATELIER',
      category: 'top',
      slot: 'top',
      style: 'batik_shirt',
      pattern: 'batik_parang',
      fitType: 'regular',
      easeBonus: 3,
      stretch: 0.03,
      fabric: 'linen',
      fabricLabel: 'Katun Primisima Tulis • Furing Halus',
      badge: 'Batik Signature',
      price: 589000,
      rating: 5.0,
      sold: 1380,
      description: 'Kemeja batik lengan panjang bermotif Parang klasik khas Keraton dengan furing katun super adem, kerah formal terstruktur, dan kancing tersembunyi rapi.',
      colors: [
        { name: 'Sogan Cokelat Emas', hex: '#4a2e1b', secondary: '#2f1c0f', accent: '#d8ab63' },
        { name: 'Indigo Malam Gold', hex: '#1f2d42', secondary: '#141e2e', accent: '#d8b56c' },
        { name: 'Maroon Keraton', hex: '#581f24', secondary: '#3b1316', accent: '#dfb56b' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'batik-megamendung-kemeja',
      name: 'Kemeja Batik Mega Mendung Modern',
      brand: 'NUSANTARA ATELIER',
      category: 'top',
      slot: 'top',
      style: 'batik_shirt',
      pattern: 'batik_megamendung',
      fitType: 'regular',
      easeBonus: 3,
      stretch: 0.03,
      fabric: 'cotton',
      fabricLabel: 'Katun Dobby Premium • Motif Cirebon',
      badge: 'New Drop',
      price: 549000,
      rating: 4.9,
      sold: 740,
      description: 'Interpretasi kontemporer motif Mega Mendung Cirebon berpotongan tailored fit yang rapi untuk acara resmi, kantor, maupun kondangan.',
      colors: [
        { name: 'Samudra Navy', hex: '#1d324c', secondary: '#132236', accent: '#6fa4d8' },
        { name: 'Terracotta Senja', hex: '#6d3124', secondary: '#4d2017', accent: '#e09a63' },
        { name: 'Emerald Jade', hex: '#1c4038', secondary: '#122b25', accent: '#6fb39c' }
      ],
      sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'shirt-oxford-tailored',
      name: 'Kemeja Formal Oxford Poplin Executive',
      brand: 'ATELIER MAN',
      category: 'top',
      slot: 'top',
      style: 'shirt',
      pattern: 'pinstripe_shirt',
      fitType: 'regular',
      easeBonus: 2,
      stretch: 0.04,
      fabric: 'linen',
      fabricLabel: 'Egyptian Cotton Poplin • Easy-Iron',
      price: 439000,
      rating: 4.9,
      sold: 1290,
      description: 'Kemeja formal lengan panjang dengan kerah dua lapis yang tegak, placket kancing mutiara, saku dada rapi, dan garis halus elegan.',
      colors: [
        { name: 'Sky Blue Pinstripe', hex: '#d5e4f2', secondary: '#b3cce2', accent: '#7da3c7' },
        { name: 'Crisp White Classic', hex: '#f6f5f1', secondary: '#e4e1d9', accent: '#e8e6df' },
        { name: 'Soft Sage Stripe', hex: '#dbe3d8', secondary: '#b9c7b4', accent: '#8ca187' },
        { name: 'Midnight Navy', hex: '#223147', secondary: '#182436', accent: '#354966' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'tee-heavyweight',
      name: 'Kaos Heavyweight Supima 260gsm',
      brand: 'NORMA STUDIO',
      category: 'top',
      slot: 'top',
      style: 'tshirt',
      pattern: 'solid',
      fitType: 'regular',
      easeBonus: 1,
      stretch: 0.08,
      fabric: 'cotton',
      fabricLabel: 'Katun Supima 260gsm • Kerah Rib Tebal',
      price: 249000,
      rating: 4.9,
      sold: 2840,
      description: 'Kaos harian andalan dengan rajutan padat 260gsm yang tidak menerawang, jatuh rapi di bahu, dan kerah rib tebal anti-melar.',
      colors: [
        { name: 'Warm Off-White', hex: '#f2eee6', secondary: '#e2dcd0', accent: '#282726' },
        { name: 'Charcoal Ink', hex: '#262628', secondary: '#1a1a1c', accent: '#f0ece4' },
        { name: 'Sage Olive', hex: '#687964', secondary: '#556452', accent: '#ece9e0' },
        { name: 'Terracotta Clay', hex: '#b35c44', secondary: '#964b36', accent: '#f5ede4' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'tee-oversized-boxy',
      name: 'Kaos Oversized Street Graphic Boxy',
      brand: 'KINETA LAB',
      category: 'top',
      slot: 'top',
      style: 'oversized_tee',
      pattern: 'solid',
      fitType: 'oversized',
      easeBonus: 9,
      stretch: 0.07,
      fabric: 'cotton',
      fabricLabel: 'Combed 16s Heavy • Sablon Dada Minimal',
      price: 289000,
      rating: 4.8,
      sold: 1410,
      description: 'Kaos streetwear boxy drop-shoulder dengan grafis tipografi minimalis di dada, potongan lega dan sejuk untuk gaya kasual modern.',
      colors: [
        { name: 'Washed Graphite', hex: '#383d42', secondary: '#292d31', accent: '#eae5da' },
        { name: 'Sandstone Cream', hex: '#dfd2be', secondary: '#cabba4', accent: '#242220' },
        { name: 'Pine Forest', hex: '#2a453a', secondary: '#1e332a', accent: '#e8e2d5' }
      ],
      sizes: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'knit-mockneck',
      name: 'Atasan Rajut Ribbed Mock-Neck',
      brand: 'SORA FORM',
      category: 'top',
      slot: 'top',
      style: 'knit',
      pattern: 'solid',
      fitType: 'slim',
      easeBonus: -2,
      stretch: 0.16,
      fabric: 'ribbed',
      fabricLabel: 'Fine Merino-Cotton Rib • 4-Way Stretch',
      price: 369000,
      rating: 4.8,
      sold: 790,
      description: 'Atasan rajut bertekstur vertikal halus dengan kerah mock-neck elegan yang melar lembut mengikuti bentuk tubuh, sempurna sebagai inner blazer atau jaket kulit.',
      colors: [
        { name: 'Espresso Brown', hex: '#493327', secondary: '#38261c', accent: '#d1bfa9' },
        { name: 'Oatmeal Cream', hex: '#e6dccd', secondary: '#d4c7b4', accent: '#52473d' },
        { name: 'Wine Burgundy', hex: '#6c2630', secondary: '#521b23', accent: '#e5d4d7' },
        { name: 'Jet Black', hex: '#1f1f21', secondary: '#141416', accent: '#999' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL']
    },

    // --- BAWAHAN (JEANS, CHINOS, CARGO, SKIRT) ---
    {
      id: 'pants-jeans-selvedge',
      name: 'Celana Jeans Selvedge Straight 13oz',
      brand: 'RIVET & CO',
      category: 'bottom',
      slot: 'bottom',
      style: 'jeans',
      pattern: 'denim_weave',
      fitType: 'regular',
      easeBonus: 2,
      stretch: 0.05,
      fabric: 'denim',
      fabricLabel: '13oz Selvedge Stretch • Belt Loops & Rivets',
      badge: 'Best Seller',
      price: 529000,
      rating: 4.9,
      sold: 1920,
      description: 'Celana jeans straight-leg autentik dengan tenun selvedge indigo, waistband lengkap belt loops, kancing kuningan, jahitan emas, dan lipatan hem bersih.',
      colors: [
        { name: 'Deep Indigo Raw', hex: '#283e5c', secondary: '#c89242', accent: '#d8a556' },
        { name: 'Vintage Mid-Blue', hex: '#557599', secondary: '#c89242', accent: '#d8a556' },
        { name: 'Washed Black Denim', hex: '#2a2c30', secondary: '#6b6f75', accent: '#9da2a8' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'pants-chinos',
      name: 'Celana Chino Flex-Waist Tailored',
      brand: 'ATELIER MAN',
      category: 'bottom',
      slot: 'bottom',
      style: 'chinos',
      pattern: 'solid',
      fitType: 'regular',
      easeBonus: 2,
      stretch: 0.07,
      fabric: 'cotton',
      fabricLabel: 'Stretch Twill • Pinggang Nyaman',
      price: 419000,
      rating: 4.9,
      sold: 1580,
      description: 'Celana chino berpotongan tapered rapi dengan pinggang fleksibel dan belt loops, cocok dipadukan bersama kemeja batik, blazer, maupun kaos.',
      colors: [
        { name: 'Classic Khaki', hex: '#bca789', secondary: '#9e896d', accent: '#463b2d' },
        { name: 'Dark Navy', hex: '#222f42', secondary: '#172130', accent: '#121822' },
        { name: 'Warm Charcoal', hex: '#393b3e', secondary: '#2a2b2e', accent: '#1d1e20' },
        { name: 'Stone Grey', hex: '#94928c', secondary: '#7a7872', accent: '#3e3d3a' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'pants-cargo-wide',
      name: 'Celana Cargo Wide-Leg Utility',
      brand: 'KINETA LAB',
      category: 'bottom',
      slot: 'bottom',
      style: 'cargo',
      pattern: 'solid',
      fitType: 'relaxed',
      easeBonus: 8,
      stretch: 0.04,
      fabric: 'linen',
      fabricLabel: 'Ripstop Cotton • Saku Cargo 3D',
      price: 469000,
      rating: 4.8,
      sold: 870,
      description: 'Celana cargo berpotongan lebar yang memberi keleluasaan maksimal di paha dan pinggul, lengkap dengan saku samping 3D bertutup.',
      colors: [
        { name: 'Army Moss Olive', hex: '#4c5843', secondary: '#3b4534', accent: '#2c3327' },
        { name: 'Desert Sand', hex: '#cbbba0', secondary: '#b09f83', accent: '#544a3a' },
        { name: 'Tactical Black', hex: '#27282b', secondary: '#1b1c1f', accent: '#121315' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'skirt-pleated-midi',
      name: 'Rok Midi Pleated High-Waist',
      brand: 'SORA FORM',
      category: 'bottom',
      slot: 'bottom',
      style: 'skirt',
      pattern: 'solid',
      fitType: 'regular',
      easeBonus: 4,
      stretch: 0.06,
      fabric: 'satin',
      fabricLabel: 'Flowing Crepe-Satin • Lipit Halus',
      price: 389000,
      rating: 4.9,
      sold: 710,
      description: 'Rok midi lipit berpinggang tinggi yang jatuh anggun mengikuti langkah dengan ruang pinggul yang lega dan nyaman.',
      colors: [
        { name: 'Champagne Ivory', hex: '#e8decb', secondary: '#d2c5ae', accent: '#b8a88e' },
        { name: 'Rose Terracotta', hex: '#b6695b', secondary: '#965145', accent: '#7d4035' },
        { name: 'Deep Slate Navy', hex: '#2e3f54', secondary: '#212e3f', accent: '#192330' },
        { name: 'Espresso Velvet', hex: '#42332c', secondary: '#30241f', accent: '#241a16' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL']
    },

    // --- DRESS (BATIK KAWUNG, SATIN EVENING, LINEN RESORT) ---
    {
      id: 'dress-batik-kawung',
      name: 'Dress Midi Batik Kawung Modern',
      brand: 'NUSANTARA ATELIER',
      category: 'dress',
      slot: 'dress',
      style: 'dress_batik',
      pattern: 'batik_kawung',
      fitType: 'regular',
      easeBonus: 3,
      stretch: 0.04,
      fabric: 'linen',
      fabricLabel: 'Katun Sutra Batik Kawung • Obi Waist',
      badge: 'Batik Couture',
      price: 789000,
      rating: 5.0,
      sold: 690,
      description: 'Midi dress A-line bermotif Batik Kawung geometris elegan dengan aksen pita pinggang obi yang mempertegas siluet sekaligus nyaman di pinggul.',
      colors: [
        { name: 'Sogan Klasik Cream', hex: '#4d3221', secondary: '#332014', accent: '#e2c48c' },
        { name: 'Indigo Keraton', hex: '#21344d', secondary: '#152235', accent: '#d8bc82' },
        { name: 'Terracotta Gold', hex: '#7a382b', secondary: '#59261c', accent: '#e8c78b' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'dress-wrap-satin',
      name: 'Dress Satin Wrap Evening Couture',
      brand: 'SORA FORM',
      category: 'dress',
      slot: 'dress',
      style: 'dress_wrap',
      pattern: 'solid',
      fitType: 'slim',
      easeBonus: 1,
      stretch: 0.07,
      fabric: 'satin',
      fabricLabel: 'Silk-Satin Luxe • Kilau Lembut',
      badge: 'Evening Luxe',
      price: 829000,
      rating: 4.9,
      sold: 520,
      description: 'Evening dress satin berpotongan V-neck wrap yang memantulkan cahaya lembut, pinggang terikat pita satin, dan drape rok elegan saat berjalan.',
      colors: [
        { name: 'Deep Emerald Silk', hex: '#1e4d41', secondary: '#14382f', accent: '#2f6b5c' },
        { name: 'Ruby Velvet', hex: '#7c202e', secondary: '#5c1520', accent: '#a13142' },
        { name: 'Champagne Pearl', hex: '#dcc8ab', secondary: '#c2ab8b', accent: '#efe1cb' },
        { name: 'Midnight Noir', hex: '#1e222e', secondary: '#141720', accent: '#32384a' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL']
    },
    {
      id: 'dress-linen-midi',
      name: 'Dress A-Line European Linen Midi',
      brand: 'MAISON VELO',
      category: 'dress',
      slot: 'dress',
      style: 'dress_aline',
      pattern: 'solid',
      fitType: 'regular',
      easeBonus: 4,
      stretch: 0.04,
      fabric: 'linen',
      fabricLabel: '100% European Linen • Breathable',
      price: 689000,
      rating: 4.9,
      sold: 610,
      description: 'Dress midi berbahan linen Eropa asli yang super adem, dilengkapi aksen sabuk pinggang dan rok A-line berlipit lembut untuk aktivitas seharian.',
      colors: [
        { name: 'Ivory Linen', hex: '#efe7da', secondary: '#d9cebd', accent: '#8e7a63' },
        { name: 'Sage Mist', hex: '#7a907c', secondary: '#617663', accent: '#4c5f4e' },
        { name: 'Dusty Terracotta', hex: '#ba6c56', secondary: '#9a5440', accent: '#753c2c' }
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },

    // --- SEPATU (SNEAKERS & PANTOFEL FORMAL) ---
    {
      id: 'shoes-minimal-sneaker',
      name: 'Sneakers CloudStep Leather Low',
      brand: 'NORMA STUDIO',
      category: 'shoes',
      slot: 'shoes',
      style: 'sneakers',
      pattern: 'solid',
      fitType: 'regular',
      easeBonus: 0,
      stretch: 0.05,
      fabric: 'leather',
      fabricLabel: 'Full-Grain Leather • Cupsole & Tali 3D',
      badge: 'Top Rated',
      price: 599000,
      rating: 4.9,
      sold: 2340,
      description: 'Sneakers kulit minimalis dengan sol cupsole empuk, detail side-stripe kontras, heel-tab empuk, dan tali sepatu 3D yang cocok dengan semua outfit kasual.',
      colors: [
        { name: 'Triple White & Gum', hex: '#f4f2ec', secondary: '#c59b6d', accent: '#2c2c2e' },
        { name: 'Cream & Forest Stripe', hex: '#eae2d3', secondary: '#f4f1ea', accent: '#234a39' },
        { name: 'Onyx Black & White Sole', hex: '#222326', secondary: '#f2f0eb', accent: '#e8e5de' }
      ],
      sizes: ['S', 'M', 'L', 'XL']
    },
    {
      id: 'shoes-pantofel-oxford',
      name: 'Pantofel Oxford Cap-Toe Calfskin',
      brand: 'MAISON VELO',
      category: 'shoes',
      slot: 'shoes',
      style: 'pantofel',
      pattern: 'solid',
      fitType: 'regular',
      easeBonus: 0,
      stretch: 0.03,
      fabric: 'leather',
      fabricLabel: 'Polished Calfskin • Sol Goodyear Welt',
      badge: 'Formal Classic',
      price: 879000,
      rating: 4.9,
      sold: 980,
      description: 'Sepatu pantofel kulit sapi mengkilap dengan jahitan cap-toe klasik, hak formal bertingkat, dan sol kulit empuk — pasangan sempurna untuk batik, kemeja, dan blazer.',
      colors: [
        { name: 'Polished Obsidian Black', hex: '#19191b', secondary: '#2d241e', accent: '#3a3a3d' },
        { name: 'Cognac Tan Leather', hex: '#6e3f22', secondary: '#3b2112', accent: '#8f5734' },
        { name: 'Dark Espresso Mahogany', hex: '#3d2217', secondary: '#24140e', accent: '#5a3626' }
      ],
      sizes: ['S', 'M', 'L', 'XL']
    }
  ];

  // Curated 1-click Full Outfit Inspirations
  const CURATED_LOOKS = [
    {
      id: 'look-varsity',
      name: 'Street Varsity',
      items: {
        top: { productId: 'tee-heavyweight', colorIdx: 0 },
        outer: { productId: 'varsity-heritage', colorIdx: 0 },
        bottom: { productId: 'pants-jeans-selvedge', colorIdx: 0 },
        shoes: { productId: 'shoes-minimal-sneaker', colorIdx: 1 }
      }
    },
    {
      id: 'look-batik',
      name: 'Batik Formal',
      items: {
        top: { productId: 'batik-parang-kemeja', colorIdx: 0 },
        bottom: { productId: 'pants-chinos', colorIdx: 2 },
        shoes: { productId: 'shoes-pantofel-oxford', colorIdx: 0 }
      }
    },
    {
      id: 'look-biker',
      name: 'Leather Moto',
      items: {
        top: { productId: 'tee-heavyweight', colorIdx: 0 },
        outer: { productId: 'jacket-leather-biker', colorIdx: 0 },
        bottom: { productId: 'pants-jeans-selvedge', colorIdx: 2 },
        shoes: { productId: 'shoes-pantofel-oxford', colorIdx: 0 }
      }
    },
    {
      id: 'look-denim',
      name: 'Denim Casual',
      items: {
        top: { productId: 'tee-oversized-boxy', colorIdx: 1 },
        outer: { productId: 'jacket-denim-trucker', colorIdx: 0 },
        bottom: { productId: 'pants-cargo-wide', colorIdx: 0 },
        shoes: { productId: 'shoes-minimal-sneaker', colorIdx: 0 }
      }
    },
    {
      id: 'look-dress-batik',
      name: 'Dress Batik',
      presetId: 'female-balanced',
      items: {
        dress: { productId: 'dress-batik-kawung', colorIdx: 0 },
        shoes: { productId: 'shoes-pantofel-oxford', colorIdx: 1 }
      }
    },
    {
      id: 'look-satin',
      name: 'Evening Satin',
      presetId: 'female-curvy',
      items: {
        dress: { productId: 'dress-wrap-satin', colorIdx: 0 },
        shoes: { productId: 'shoes-pantofel-oxford', colorIdx: 0 }
      }
    }
  ];

  function getProductById(id) {
    return CATALOG.find((p) => p.id === id) || null;
  }

  function formatRupiah(num) {
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  }

  return {
    MANNEQUIN_PRESETS,
    MANNEQUIN_MATERIALS,
    MEASUREMENT_CONFIG,
    SIZE_ORDER,
    BASE_SIZE_CHART,
    CATALOG,
    CURATED_LOOKS,
    getProductById,
    formatRupiah
  };
})();
