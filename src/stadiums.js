// UK venues for UEFA EURO 2028 (Dublin Arena is outside the UK), each paired with
// the closest National Rail station. `uefaName` is the name UEFA uses during the tournament.
export const STADIUMS = [
  {
    id: "wembley",
    name: "Wembley Stadium",
    uefaName: "Wembley Stadium",
    city: "London",
    crs: "WCX",
    point: [51.556, -0.2795],
    aliases: ["england"],
  },
  {
    id: "tottenham-hotspur",
    name: "Tottenham Hotspur Stadium",
    uefaName: "Tottenham Hotspur Stadium",
    city: "London",
    crs: "WHL",
    point: [51.6043, -0.0664],
    aliases: ["spurs", "white hart lane"],
  },
  {
    id: "etihad",
    name: "Etihad Stadium",
    uefaName: "Manchester City Stadium",
    city: "Manchester",
    crs: "ABY",
    point: [53.4831, -2.2004],
    aliases: ["man city", "city of manchester stadium"],
  },
  {
    id: "everton",
    name: "Hill Dickinson Stadium",
    uefaName: "Everton Stadium",
    city: "Liverpool",
    crs: "SDL",
    point: [53.4243, -3.0011],
    aliases: ["bramley-moore dock"],
  },
  {
    id: "st-james-park",
    name: "St James' Park",
    uefaName: "St James' Park",
    city: "Newcastle",
    crs: "NCL",
    point: [54.9756, -1.6217],
    aliases: ["st james park", "newcastle united"],
  },
  {
    id: "villa-park",
    name: "Villa Park",
    uefaName: "Villa Park",
    city: "Birmingham",
    crs: "WTT",
    point: [52.5091, -1.8848],
    aliases: ["aston villa"],
  },
  {
    id: "hampden-park",
    name: "Hampden Park",
    uefaName: "Hampden Park",
    city: "Glasgow",
    crs: "MFL",
    point: [55.8259, -4.252],
    aliases: ["scotland"],
  },
  {
    id: "principality",
    name: "Principality Stadium",
    uefaName: "National Stadium of Wales",
    city: "Cardiff",
    crs: "CDF",
    point: [51.4782, -3.1826],
    aliases: ["millennium stadium", "wales"],
  },
];

export function stadiumById(id) {
  return STADIUMS.find((stadium) => stadium.id === id) || null;
}

export function stadiumByCrs(crs) {
  const code = String(crs || "").toUpperCase();
  return STADIUMS.find((stadium) => stadium.crs === code) || null;
}

export function searchStadiums(query) {
  const tokens = words(query);
  if (!tokens.length || tokens.join("").length < 2) return [];
  return STADIUMS.filter((stadium) => {
    const haystack = words([stadium.name, stadium.uefaName, stadium.city, ...stadium.aliases].join(" "));
    return tokens.every((token) => haystack.some((word) => word.startsWith(token)));
  });
}

function words(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
