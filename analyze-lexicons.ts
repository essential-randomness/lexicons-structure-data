import { readdir, readFile, writeFile } from "node:fs/promises";

const collectionsData = await getAggregatedCollectionsData("./records");

// First, we get the data for each collection, and save it as is to a CSV file
// For each collection, this will tell us which keys and types are present in it
const csvContent = [
  "lexicon_collection,keys_count,types_count,keys,types,record_folder",
];
for (const [collection, data] of Object.entries(collectionsData)) {
  const keysString = Array.from(data.keys).join(";");
  const typesString = Array.from(data.types).join(";");
  csvContent.push(
    `"${collection}","${data.keys.size}","${data.types.size}","${keysString}","${typesString}","${data.recordFolder}"`
  );
}

await writeFile("./lexicons-analysis.csv", csvContent.join("\n"), "utf-8");
console.log("Lexicons analysis saved to lexicons-analysis.csv");

// Next, for each key, we get the list of collections that have it
// and save it to another CSV file
const keyMappingContent = ["key,lexicons_count,lexicons"];
const keyToLexicons: Record<string, string[]> = {};

for (const [collection, data] of Object.entries(collectionsData)) {
  for (const key of data.keys) {
    keyToLexicons[key] ??= [];
    keyToLexicons[key].push(collection);
  }
}

// Clean up any duplicates in the keyToLexicons mapping and push
// it in the CSV file
for (const key of Object.keys(keyToLexicons)) {
  keyToLexicons[key] = [...new Set(keyToLexicons[key])];
  keyMappingContent.push(
    `"${key}","${keyToLexicons[key].length}","${keyToLexicons[key].join(";")}"`
  );
}

await writeFile(
  "./key-to-lexicons-mapping.csv",
  keyMappingContent.join("\n"),
  "utf-8"
);
console.log("Key-to-lexicons mapping saved to key-to-lexicons-mapping.csv");

// Next, for type in a collection, we get the list of collections that have
// that type in it. Since we've already excluded the top-level type, we don't
// need to exclude the collection of that same type. Some appear to be nested,
// and that's interesting by itself.
const typeMappingContent = ["type,lexicons_count,lexicons"];
const typeToLexicons: Record<string, string[]> = {};

for (const [collection, data] of Object.entries(collectionsData)) {
  for (const type of data.types) {
    typeToLexicons[type] ??= [];
    typeToLexicons[type].push(collection);
  }
}

// Clean up any duplicates in the typeToLexicons mapping and push it in the CSV file
for (const type of Object.keys(typeToLexicons)) {
  typeToLexicons[type] = [...new Set(typeToLexicons[type])];
  typeMappingContent.push(
    `"${type}","${typeToLexicons[type].length}","${typeToLexicons[type].join(
      ";"
    )}"`
  );
}

await writeFile(
  "./type-to-lexicons-mapping.csv",
  typeMappingContent.join("\n"),
  "utf-8"
);
console.log("Type-to-lexicons mapping saved to type-to-lexicons-mapping.csv");

/**
 * Goes through through our records folder and aggregates data for each lexicon
 * saved within it, keyed by collection.
 *
 * For each collection, it will create an object containing:
 *   - All the keys found in its records, aside from the root level $type key
 *   - All the types found in its records, aside from the record's own type
 *   - The folder it is stored in, which corresponds to its namespace (for ease of access)
 */
async function getAggregatedCollectionsData(sourceFolder: string) {
  const collectionsData: Record<
    string,
    { keys: Set<string>; types: Set<string>; recordFolder: string }
  > = {};
  const recordsToAggregate = getRecordsToAggregate(sourceFolder);
  for await (const { collection, record, recordFolder } of recordsToAggregate) {
    collectionsData[collection] = {
      keys: new Set<string>(),
      types: new Set<string>(),
      recordFolder,
    };

    const keysByLevel = extractAllKeysByLevel(record);
    const foundTypes = findAllTypes(record);

    Object.values(keysByLevel)
      .flat()
      .forEach((key) => collectionsData[collection].keys.add(key));

    foundTypes.forEach((type) => collectionsData[collection].types.add(type));
  }
  return collectionsData;
}

async function* getRecordsToAggregate(sourceFolder: string): AsyncGenerator<{
  collection: string;
  record: Record<string, unknown>;
  recordFolder: string;
}> {
  const entries = await readdir(sourceFolder, { withFileTypes: true });
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

          yield {
            collection,
            record: parsedRecordFile.record as Record<string, unknown>,
            recordFolder: `./records/${entry.name}`,
          };
        }
      }
    }
  }
}

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
    // However, we don't want to add the type at the root level since it's
    // just the type of the record and every record has it
    if (startingLevel === 0 && key === "$type") {
      continue;
    }
    newKeys[startingLevel].push(key);

    if (Array.isArray(record[key])) {
      for (const item of record[key] as unknown[]) {
        // We don't want to add array indices to the keys
        // so we go straight to the next level
        if (typeof item === "object" && item !== null) {
          // Add the keys at the next level to the next levels keys
          nextLevelsKeys.push(
            extractAllKeysByLevel(
              item as Record<string, unknown>,
              startingLevel + 1
            )
          );
        }
      }
    } else if (typeof record[key] === "object" && record[key] !== null) {
      nextLevelsKeys.push(
        extractAllKeysByLevel(
          record[key] as Record<string, unknown>,
          startingLevel + 1
        )
      );
    }
  }

  for (const nextLevelKey of nextLevelsKeys) {
    for (const [nextLevel, keys] of Object.entries(nextLevelKey)) {
      const level = parseInt(nextLevel);
      newKeys[level] = newKeys[level] ?? [];
      newKeys[level].push(...keys);
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
