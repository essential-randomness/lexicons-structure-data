import { writeFile, mkdir, readFile } from "node:fs/promises";
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
async function loadLexicons(): Promise<LexiconEntry[]> {
  try {
    const csvPath = join(process.cwd(), "lexicons.csv");
    const csvContent = await readFile(csvPath, "utf-8");
    return parseLexiconsCsv(csvContent);
  } catch (error) {
    console.error("Error loading lexicons data:", error);
    return [];
  }
}

// Main execution
const lexicons = await loadLexicons();

type RecordGroup = {
  did: string;
  collection: string;
  rkey: string;
  record: Record<string, unknown>;
};

const getRecordsToFetch = async function* () {
  let index = 0;
  const eachTime = 5;
  while (index < lexicons.length) {
    yield lexicons.slice(index, index + eachTime);
    index += eachTime;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
};

for await (const lexiconsBatch of getRecordsToFetch()) {
  await Promise.all(
    lexiconsBatch.map(async (lexicon) => {
      try {
        const response = await fetch(
          `https://ufos-api.microcosm.blue/records?collection=${lexicon.nsid}`
        );
        const result = (await response.json()) as RecordGroup[];
        const [tld, name, collection] = lexicon.nsid.split(".");
        const folder = `${tld}.${name}.${collection}`;

        await mkdir(`./records/${folder}`, { recursive: true });

        for (const group of result) {
          await writeFile(
            `./records/${folder}/${group.rkey}.json`,
            JSON.stringify(group, null, 2)
          );
        }

        await writeFile(
          `./records/${folder}/index.json`,
          JSON.stringify(lexicon, null, 2)
        );

        console.log(`✅ Downloaded records for ${lexicon.nsid}`);
      } catch (error) {
        console.error(`❌ Error downloading ${lexicon.nsid}:`, error);
      }
    })
  );
}

// console.log("\nFirst 100 lexicons:");
// console.log(JSON.stringify(lexicons.slice(0, 100), null, 2));
