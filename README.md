# What is this?

A collection of scripts to analyze the frequency of key names and subtypes for
collections in the ATmosphere.

## Who made it

[Ms Boba](https://essentialrandomness.com), who _\*winks winks\*_ has [a Patreon](https://patreon.com/FujoCoded).

## What it does & How to Use it

It uses the [microcosm.blue](https://ufos-api.microcosm.blue) to:

1. List all collections seen in the ATmosphere (`download-collections.ts`)
   - This will save data in `collections.json`
2. Save a few sample records for each (`download-records.ts`)
   - This will save all sample data downloaded in a `records/` folder
   - It will also create `collections.csv`, with:
     - `nsid`: The namespace id of the collection
     - `domain`: The domain + tld of the collection
     - `url`: The domain + tld of the collection, prefixed with http://
     - `namespace`: The first 3 segnments of the NSID (e.g. `app.bsky.social`)
     - `collection_type`: The portion of the NSID after the namespace
     - `creates`: How many have been created
     - `updates`: How many have been updated
     - `deletes`: How many have been deleted
     - `dids_estimate`: How many dids have them
     - `last_seen`: When was it last seen according to microcosm.blue

With this data, `analize-collections.ts` loops through the saved files and
creates:

1. `collections-analysis.csv`, a CSV file with a line for each collection,
   containing:

   - `collection`: the NSID of the collection
   - `keys_count`: how many separate keys are in this collection's records
   - `types_count`: how many subtypes appear in this collection's records
   - `keys`: all keys in the collection's records, joined by `;`
   - `types`: all subtypes in the collection's records, joined by `;`
   - `record_folder`: the source folder for these records

2. `keys-to-collections-map.csv`, a CSV file with a line for each key that
   appears in collections, containing:

   - `key`: a key as it appears collection records
   - `collections_count`: how many collections include that key
   - `namespaces_count`: how many namespaces (e.g. `app.bsky.social`) include that key
   - `collections`: which collections include that key, joined by ";"
   - `namespaces`: which namespaces include that key, joined by ";"

3. `types-to-collections-map.csv`, a CSV file with a line for each type that
   appears as a nested type in a collection, containing:

   - `type`: a type as it appears in a $type filed of a collection record (but
     not the top level record)
   - `collections_count`: how many collections include that type
   - `namespaces_count`: how many namespaces (e.g. `app.bsky.social`) include that type
   - `collections`: which collections include that type, separated by ;
   - `namespaces`: which namespaces include that type, joined by ";"
