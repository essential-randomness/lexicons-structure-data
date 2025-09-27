import { readdir, readFile, writeFile } from "node:fs/promises";

const entries = await readdir("./records", { withFileTypes: true });

const lexiconsData: Record<
  string,
  { keys: Set<string>; types: Set<string>; recordFolder: string }
> = {};

for (const entry of entries) {
  if (entry.isDirectory()) {
    const lexiconFolder = await readdir(`./records/${entry.name}/`, {
      withFileTypes: true,
    });

    for (const file of lexiconFolder) {
      if (file.isFile()) {
        if (file.name === "index.json") {
          // This is the summary file, so we skip it
          continue;
        }
        const recordFileContent = await readFile(
          `./records/${entry.name}/${file.name}`,
          "utf-8"
        );

        const parsedRecordFile = JSON.parse(recordFileContent) as Record<
          string,
          unknown
        >;
        const collection = parsedRecordFile.collection as string;

        lexiconsData[collection] = {
          keys: new Set<string>(),
          types: new Set<string>(),
          recordFolder: `./records/${entry.name}`,
        };
        const record = parsedRecordFile.record as Record<string, unknown>;

        const keysByLevel = extractAllKeysByLevel(record);
        const foundTypes = findAllTypes(record);

        // Accumulate keys and types from all files
        for (const levelKeys of Object.values(keysByLevel)) {
          for (const key of levelKeys) {
            lexiconsData[collection].keys.add(key);
          }
        }
        lexiconsData[collection].types = new Set([
          ...lexiconsData[collection].types,
          ...foundTypes,
        ]);
      }
    }
  }
}

// Generate CSV content
const csvRows: string[] = [];
csvRows.push("lexicon,keys_count,types_count,keys,types,record_folder");

for (const [lexiconName, data] of Object.entries(lexiconsData)) {
  const keysArray = Array.from(data.keys);
  const keysString = keysArray.join(";");
  const typesString = Array.from(data.types).join(";");

  csvRows.push(
    `"${lexiconName}","${data.keys.size}","${data.types.size}","${keysString}","${typesString}","${data.recordFolder}"`
  );
}

const csvContent = csvRows.join("\n");
await writeFile("./lexicons-analysis.csv", csvContent, "utf-8");
console.log("Lexicons analysis saved to lexicons-analysis.csv");

// Generate key-to-lexicons mapping CSV
const keyToLexicons: Record<string, string[]> = {};

// Build the reverse mapping
for (const [lexiconName, data] of Object.entries(lexiconsData)) {
  for (const key of data.keys) {
    if (!keyToLexicons[key]) {
      keyToLexicons[key] = [];
    }
    keyToLexicons[key].push(lexiconName);
  }
}

// Generate CSV for key-to-lexicons mapping
const keyMappingRows: string[] = [];
keyMappingRows.push("key,lexicons_count,lexicons");

for (const [key, lexiconsList] of Object.entries(keyToLexicons)) {
  const lexiconsString = lexiconsList.join(";");
  keyMappingRows.push(`"${key}","${lexiconsList.length}","${lexiconsString}"`);
}

const keyMappingContent = keyMappingRows.join("\n");
await writeFile("./key-to-lexicons-mapping.csv", keyMappingContent, "utf-8");
console.log("Key-to-lexicons mapping saved to key-to-lexicons-mapping.csv");

const typeToLexicons: Record<string, string[]> = {};

for (const [lexiconName, data] of Object.entries(lexiconsData)) {
  for (const type of data.types) {
    typeToLexicons[type] = typeToLexicons[type] ?? [];
    typeToLexicons[type].push(lexiconName);
  }
}

const typeMappingRows: string[] = [];
typeMappingRows.push("type,lexicons_count,lexicons");

for (const [type, lexiconsList] of Object.entries(typeToLexicons)) {
  const lexiconsString = lexiconsList
    .filter((lexicon) => lexicon != type)
    .join(";");
  if (lexiconsString.length > 0) {
    typeMappingRows.push(
      `"${type}","${lexiconsList.length}","${lexiconsString}"`
    );
  }
}

const typeMappingContent = typeMappingRows.join("\n");
await writeFile("./type-to-lexicons-mapping.csv", typeMappingContent, "utf-8");
console.log("Type-to-lexicons mapping saved to type-to-lexicons-mapping.csv");

function extractAllKeysByLevel(
  record: Record<string, unknown>,
  startingLevel = 0
) {
  const levelKeys = Object.keys(record);
  const newKeys: Record<number, string[]> = {
    [startingLevel]: [],
  };
  let nextLevelsKeys: Record<number, string[]>[] = [];
  for (const key of levelKeys) {
    // Add the keys at this level to the current level
    newKeys[startingLevel].push(key);
    if (Array.isArray(record[key])) {
      for (const item of record[key] as unknown[]) {
        // We don't want to add array indices to the keys
        // so we go straight to the next level
        if (typeof item === "object" && item !== null) {
          // Add the keys at the next level to the next levels keys
          nextLevelsKeys = nextLevelsKeys.concat(
            extractAllKeysByLevel(
              item as Record<string, unknown>,
              startingLevel + 1
            )
          );
        }
      }
    } else if (typeof record[key] === "object" && record[key] !== null) {
      nextLevelsKeys = nextLevelsKeys.concat(
        extractAllKeysByLevel(
          record[key] as Record<string, unknown>,
          startingLevel + 1
        )
      );
    }
  }
  for (const nextLevelKey of nextLevelsKeys) {
    for (const [nextLevel, keys] of Object.entries(nextLevelKey)) {
      newKeys[nextLevel] = newKeys[nextLevel] ?? [];
      newKeys[nextLevel].push(...keys);
    }
  }
  return newKeys;
}

function findAllTypes(record: Record<string, unknown>, startingLevel = 0) {
  const levelKeys = Object.keys(record);
  const types: string[] = [];
  for (const key of levelKeys) {
    // We don't want to add the type at the root level since it's
    // just the type of the record
    if (key === "$type" && startingLevel !== 0) {
      types.push(record[key] as string);
    }
    if (Array.isArray(record[key])) {
      for (const item of record[key] as unknown[]) {
        if (typeof item === "object" && item !== null) {
          types.push(
            ...findAllTypes(item as Record<string, unknown>, startingLevel + 1)
          );
        }
      }
    } else if (typeof record[key] === "object" && record[key] !== null) {
      types.push(
        ...findAllTypes(
          record[key] as Record<string, unknown>,
          startingLevel + 1
        )
      );
    }
  }
  return types;
}
