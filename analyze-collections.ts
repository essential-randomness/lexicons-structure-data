import { glob, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const collectionsData = await getAggregatedCollectionsData("./records");

// First, we get the data for each collection, and save it as is to a CSV file
// For each collection, this will tell us which keys and types are present in it
const csvContent = [
  "collection,keys_count,types_count,keys,types,record_folder",
];
for (const [collection, data] of Object.entries(collectionsData)) {
  const keysString = Array.from(data.keys).join(";");
  const typesString = Array.from(data.types).join(";");
  csvContent.push(
    `"${collection}","${data.keys.size}","${data.types.size}","${keysString}","${typesString}","${data.recordFolder}"`
  );
}

await mkdir("./data", { recursive: true });
await writeFile(
  "./data/collections-analysis.csv",
  csvContent.join("\n"),
  "utf-8"
);
console.log("Collections analysis saved to collections-analysis.csv");

// Next, for each key, we get the list of collections that have it
// and save it to another CSV file
const keyMappingContent = [
  "key,collections_count,namespaces_count,collections,namespaces",
];
const keyToCollections: Record<string, string[]> = {};
const keyToNamespaces: Record<string, string[]> = {};

for (const [collection, data] of Object.entries(collectionsData)) {
  for (const key of data.keys) {
    keyToCollections[key] ??= [];
    keyToCollections[key].push(collection);
    const [tld, name, group] = collection.split(".");
    keyToNamespaces[key] ??= [];
    keyToNamespaces[key].push(`${tld}.${name}.${group}`);
  }
}

// Clean up any duplicates in the keyToCollections mapping and push
// it in the CSV file
for (const key of Object.keys(keyToCollections)) {
  keyToCollections[key] = [...new Set(keyToCollections[key])];
  keyToNamespaces[key] = [...new Set(keyToNamespaces[key])];
  keyMappingContent.push(
    [
      `"${key}"`,
      `"${keyToCollections[key].length}"`,
      `"${keyToNamespaces[key].length}"`,
      `"${keyToCollections[key].join(";")}"`,
      `"${keyToNamespaces[key].join(";")}"`,
    ].join(",")
  );
}

await writeFile(
  "./data/key-to-collections-map.csv",
  keyMappingContent.join("\n"),
  "utf-8"
);
console.log("Key-to-collections mapping saved to key-to-collections-map.csv");

// Next, for type in a collection, we get the list of collections that have
// that type in it. Since we've already excluded the top-level type, we don't
// need to exclude the collection of that same type. Some appear to be nested,
// and that's interesting by itself.
const typeMappingContent = [
  "type,collections_count,namespaces_count,collections,namespaces",
];
const typeToCollections: Record<string, string[]> = {};
const typeToNamespaces: Record<string, string[]> = {};

for (const [collection, data] of Object.entries(collectionsData)) {
  for (const type of data.types) {
    typeToCollections[type] ??= [];
    typeToCollections[type].push(collection);
    const [tld, name, group] = collection.split(".");
    typeToNamespaces[type] ??= [];
    typeToNamespaces[type].push(`${tld}.${name}.${group}`);
  }
}

// Clean up any duplicates in the typeToCollections mapping and push it in the CSV file
for (const type of Object.keys(typeToCollections)) {
  typeToCollections[type] = [...new Set(typeToCollections[type])];
  typeToNamespaces[type] = [...new Set(typeToNamespaces[type])];
  typeMappingContent.push(
    [
      `"${type}"`,
      `"${typeToCollections[type].length}"`,
      `"${typeToNamespaces[type].length}"`,
      `"${typeToCollections[type].join(";")}"`,
      `"${typeToNamespaces[type].join(";")}"`,
    ].join(",")
  );
}

await writeFile(
  "./data/type-to-collections-map.csv",
  typeMappingContent.join("\n"),
  "utf-8"
);
console.log("Type-to-collections mapping saved to type-to-collections-map.csv");

/**
 * Goes through through our records folder and aggregates data for each collection
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
  // Get all the collection folders
  const entries = await glob(`${sourceFolder}/**/*.json`, {
    withFileTypes: true,
  });
  for await (const entry of entries) {
    const relativePath = path.relative(process.cwd(), entry.parentPath);
    console.log(`Processing ${relativePath}/`);
    if (entry.name === "index.json") {
      // This is the summary file, so we skip it
      continue;
    }
    const recordFileContent = await readFile(
      `./${relativePath}/${entry.name}`,
      "utf-8"
    );

    const parsedRecordFile = JSON.parse(recordFileContent) as Record<
      string,
      unknown
    >;
    const collection = parsedRecordFile.collection as string;
    console.log(`Collection: ${collection}`);

    yield {
      collection,
      record: parsedRecordFile.record as Record<string, unknown>,
      recordFolder: `./${relativePath}`,
    };
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
