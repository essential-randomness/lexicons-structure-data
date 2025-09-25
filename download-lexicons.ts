import { readFileSync } from "fs";
import { join } from "path";

// Type definition for lexicon entries
interface LexiconEntry {
  nsid: string;
  domain: string;
  url: string;
  category: string;
  type: string;
  quantity: number;
  last: string;
}

// Function to parse CSV data into typed array
function parseLexiconsCsv(csvContent: string): LexiconEntry[] {
  const lines = csvContent.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");

    return {
      nsid: values[0] || "",
      url: values[2] || "",
      domain: values[1] || "",
      category: values[3] || "",
      type: values[4] || "",
      quantity: parseInt(values[5] || "0", 10) || 0,
      last: values[6] || "",
    };
  });
}

// Load and parse the lexicons data
function loadLexicons(): LexiconEntry[] {
  try {
    const csvPath = join(process.cwd(), "lexicons.csv");
    const csvContent = readFileSync(csvPath, "utf-8");
    return parseLexiconsCsv(csvContent);
  } catch (error) {
    console.error("Error loading lexicons data:", error);
    return [];
  }
}

// Main execution
const lexicons = loadLexicons();

await Promise.all(
  lexicons.slice(0, 2).map(async (lexicon) => {
    const response = await fetch(
      `https://ufos-api.microcosm.blue/records?collection=${lexicon.nsid}`
    );
    const data = await response.json();
    console.log(lexicon.nsid);
    console.dir(data, { depth: null });
  })
);

// console.log("\nFirst 100 lexicons:");
// console.log(JSON.stringify(lexicons.slice(0, 100), null, 2));
