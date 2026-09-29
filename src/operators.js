import operators from "./data/operators.json";

const ALIASES = {
  londonnortheasternrailway: "GR",
  londonnortheastrailway: "GR",
  tflrail: "XR",
  tflunderground: "LT",
  underground: "LT",
  tube: "LT",
  swr: "SW",
  gwr: "GW",
  tpe: "TP",
  transpennine: "TP",
  tfw: "AW",
  transportforwalesrail: "AW",
  arrivatrainswales: "AW",
  lnwr: "LN",
  westmidlandstrains: "WM",
};

const byCode = new Map();
const byName = new Map();

for (const operator of operators) {
  byCode.set(operator.code.toUpperCase(), operator);
  indexName(operator.name, operator);
  indexName(operator.legalName, operator);
}

function indexName(value, operator) {
  const compact = compactName(value);
  if (compact) byName.set(compact, operator);
}

function compactName(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function findOperator({ code, name, mode } = {}) {
  const toc = String(code || "").toUpperCase();
  if (toc && byCode.has(toc)) return byCode.get(toc);

  const compact = compactName(operatorName(name));
  if (compact && byName.has(compact)) return byName.get(compact);
  if (compact && ALIASES[compact] && byCode.has(ALIASES[compact])) {
    return byCode.get(ALIASES[compact]);
  }

  if (String(mode || "").toLowerCase() === "metro") return byCode.get("LT") ?? null;
  return null;
}

export function operatorName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || value.code || "";
}

export { operators };
