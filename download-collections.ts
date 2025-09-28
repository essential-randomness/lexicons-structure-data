import { writeFile } from "fs/promises";

const url = new URL("https://ufos-api.microcosm.blue/collections");
url.searchParams.set("limit", "200");

type MicrocosmCollection = {
  nsid: string;
  creates: number;
  updates: number;
  deletes: number;
  dids_estimate: number;
};
const allCollections: MicrocosmCollection[] = [];
while (true) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch collections: ${response.statusText}`);
  }
  const data = (await response.json()) as {
    collections: MicrocosmCollection[];
    cursor: null | string;
  };
  const { collections } = data;
  console.log(`Fetched ${collections.length} collections:`);
  console.log(`${collections.map((c) => c.nsid).join(", ")}`);
  allCollections.push(...collections);

  if (!data.cursor) {
    break;
  }
  url.searchParams.set("cursor", data.cursor);
}

await writeFile("collections.json", JSON.stringify(allCollections, null, 2));
console.log(`Saved ${allCollections.length} collections to collections.json`);

export {};
