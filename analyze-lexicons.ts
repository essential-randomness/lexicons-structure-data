import { readdir, readFile } from "node:fs/promises";

const entries = await readdir("./records", { withFileTypes: true });

const lexicons: Record<
  string,
  { keys: Set<string>; types: string[]; recordFolder: string }
> = {};

for (const entry of entries) {
  if (entry.isDirectory()) {
    const lexicon = await readdir(`./records/${entry.name}/`, {
      withFileTypes: true,
    });

    // Initialize the lexicon entry
    lexicons[entry.name] = {
      keys: new Set<string>(),
      types: [],
      recordFolder: `./records/${entry.name}`,
    };

    for (const file of lexicon) {
      if (file.isFile()) {
        if (file.name === "index.json") {
          continue;
        }
        const record = await readFile(
          `./records/${entry.name}/${file.name}`,
          "utf-8"
        );
        const parsedRecord = JSON.parse(record) as Record<string, unknown>;
        const keysByLevel = extractAllKeysByLevel(parsedRecord);
        const foundTypes = findAllTypes(parsedRecord);

        // Accumulate keys and types from all files
        for (const levelKeys of Object.values(keysByLevel)) {
          for (const key of levelKeys) {
            lexicons[entry.name].keys.add(key);
          }
        }
        lexicons[entry.name].types.push(...foundTypes);

        lexicons[entry.name].types = [...new Set(lexicons[entry.name].types)];
      }
    }
  }
}

console.dir(lexicons, { depth: null });

function extractAllKeysByLevel(record: Record<string, unknown>, level = 0) {
  const levelKeys = Object.keys(record);
  const newKeys: Record<number, string[]> = {
    [level]: [],
  };
  for (const key of levelKeys) {
    newKeys[level].push(key);
    if (Array.isArray(record[key])) {
      // Skip arrays - array indices aren't meaningful schema keys
      continue;
    }
    if (typeof record[key] === "object" && record[key] !== null) {
      const nextLevelKeys = extractAllKeysByLevel(
        record[key] as Record<string, unknown>,
        level + 1
      );
      for (const [nextLevel, keys] of Object.entries(nextLevelKeys)) {
        newKeys[nextLevel] = newKeys[nextLevel] ?? [];
        newKeys[nextLevel].push(...keys);
      }
    }
  }
  return newKeys;
}

function findAllTypes(record: Record<string, unknown>) {
  const levelKeys = Object.keys(record);
  const types: string[] = [];
  for (const key of levelKeys) {
    if (key === "$type") {
      types.push(record[key] as string);
    }
    if (Array.isArray(record[key])) {
      for (const item of record[key] as unknown[]) {
        if (typeof item === "object" && item !== null) {
          types.push(...findAllTypes(item as Record<string, unknown>));
        }
      }
    }
    if (typeof record[key] === "object" && record[key] !== null) {
      types.push(...findAllTypes(record[key] as Record<string, unknown>));
    }
  }
  return types;
}
