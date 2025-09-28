import { writeFile, mkdir, readFile } from "node:fs/promises";

type MicrocosmCollection = {
  nsid: string;
  creates: number;
  updates: number;
  deletes: number;
  dids_estimate: number;
};
type MicrocosmRecordSample = {
  did: string;
  collection: string;
  rkey: string;
  record: Record<string, unknown>;
  time_us: number;
};
type RecordSummary = {
  nsid: string;
  domain: string;
  url: string;
  namespace: string;
  collection_type: string;
  creates: number;
  updates: number;
  deletes: number;
  dids_estimate: number;
  last_seen: string | null;
};

const allCollections = await readFile("./collections.json", "utf-8");
const collections = JSON.parse(allCollections) as MicrocosmCollection[];

const csvContent = [
  "nsid,domain,url,namespace,collection_type,creates,updates,deletes,dids_estimate,last_seen",
];

const fetchRecordsInBatches = async function* () {
  let batchFrom = 0;
  const batchSize = 5;
  while (batchFrom < collections.length) {
    yield collections.slice(batchFrom, batchFrom + batchSize);
    batchFrom += batchSize;
    // We wait 2 seconds between batches to be nice to the API
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
};

const allErrors: string[] = [];
for await (const recordsBatch of fetchRecordsInBatches()) {
  await Promise.all(
    recordsBatch.map(async (collectionSample) => {
      try {
        // This gets the most recent records seen, so we can use the created
        // date to know when this record was last seen
        const response = await fetch(
          `https://ufos-api.microcosm.blue/records?collection=${collectionSample.nsid}`
        );
        const recordSamples =
          (await response.json()) as MicrocosmRecordSample[];
        const [tld, name, group] = collectionSample.nsid.split(".");
        const parentFolder = `${tld}.${name}`;
        const destinationFolder = `./records/${parentFolder}/${collectionSample.nsid}`;

        await mkdir(destinationFolder, {
          recursive: true,
        });

        for (const recordSample of recordSamples) {
          await writeFile(
            `${destinationFolder}/${recordSample.rkey}.json`,
            JSON.stringify(recordSample, null, 2)
          );
        }

        // Get the type of the record within the collection, which is the part
        // of the nsid after the collection group
        let collectionType = collectionSample.nsid.replace(
          `${tld}.${name}.${group}`,
          ""
        );
        if (collectionType.startsWith(".")) {
          collectionType = collectionType.substring(1);
        }

        // Get when the collection was last seen in microseconds
        const lastSeenUs = Math.max(...recordSamples.map((r) => r.time_us));

        // This is the summary file for the collection
        const summary: RecordSummary = {
          nsid: collectionSample.nsid,
          domain: `${name}.${tld}`,
          url: `https://${name}.${tld}`,
          namespace: `${tld}.${name}.${group}`,
          collection_type: collectionType,
          creates: collectionSample.creates,
          updates: collectionSample.updates,
          deletes: collectionSample.deletes,
          dids_estimate: collectionSample.dids_estimate,
          last_seen:
            lastSeenUs !== -Infinity
              ? new Date(lastSeenUs / 1000).toISOString()
              : null,
        };
        await writeFile(
          `${destinationFolder}/index.json`,
          JSON.stringify(summary, null, 2)
        );

        csvContent.push(
          `${summary.nsid},${summary.domain},${summary.url},${
            summary.namespace
          },${summary.collection_type},${summary.creates},${summary.updates},${
            summary.deletes
          },${summary.dids_estimate},${summary.last_seen ?? ""}`
        );
        console.log(`✅ Downloaded records for ${collectionSample.nsid}`);
      } catch (error) {
        console.error(`❌ Error downloading ${collectionSample.nsid}:`, error);
        console.dir(error, { depth: null });
      }
    })
  );
}

console.log(`✅ Downloaded ${collections.length} collections`);
console.log(`❌ Errors: ${allErrors.length}`);
allErrors.length && console.log(JSON.stringify(allErrors, null, 2));

console.log(`Writing ${csvContent.length - 1} lines to data/collections.csv`);
await mkdir("./data", { recursive: true });
await writeFile("./data/collections.csv", csvContent.join("\n"), "utf-8");
console.log("Collections saved to data/collections.csv");
