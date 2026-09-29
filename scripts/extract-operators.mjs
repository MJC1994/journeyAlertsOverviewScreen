import { mkdir, readFile, writeFile } from "node:fs/promises";

const xml = await readFile(new URL("../src/data.xml", import.meta.url), "utf8");

function decode(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decode(match[1].trim()) : "";
}

const companies = [];
const re = /<TrainOperatingCompany\b[\s\S]*?<\/TrainOperatingCompany>/g;
for (const block of xml.match(re) ?? []) {
  const code = tag(block, "AtocCode");
  const name = tag(block, "Name");
  const legalName = tag(block, "LegalName");
  const logo = tag(block, "Logo") || null;
  if (!code || !name) continue;
  companies.push({ code, name, legalName: legalName || name, logo });
}

await mkdir(new URL("../src/data", import.meta.url), { recursive: true });
await writeFile(
  new URL("../src/data/operators.json", import.meta.url),
  `${JSON.stringify(companies, null, 2)}\n`,
);

console.log(`${companies.length} operators`);
for (const company of companies) {
  console.log(`${company.code}\t${company.name}\t${company.logo ? "logo" : "no logo"}`);
}
