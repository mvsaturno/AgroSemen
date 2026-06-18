export const BREEDS_CORTE = [
  "Angus (Aberdeen Angus)",
  "Brahman",
  "Braford",
  "Brangus",
  "Caracu",
  "Charolês",
  "Guzerá (Corte)",
  "Hereford",
  "Nelore",
  "Nelore Pintado",
  "Red Angus",
  "Santa Gertrudis",
  "Senepol",
  "Tabapuã",
  "Wagyu",
];

export const BREEDS_LEITE = [
  "Gir Leiteiro",
  "Girolando",
  "Guzerá Leiteiro",
  "Holandês",
  "Jersey",
  "Pardo Suíço",
  "Sindi",
];

export const ALL_BREEDS = [...BREEDS_CORTE, ...BREEDS_LEITE];

export const isKnownBreed = (b: string) => ALL_BREEDS.includes(b);