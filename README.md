# What is this?

A collection of scripts to analyze the frequency of key names and subtypes for
collections in the ATmosphere.

## Who made this?

[Ms Boba](https://essentialrandomness.com), who you should [follow on
Bluesky](https://essentialrandom.bsky.social), and who _\*winks winks\*_ has [a
Patreon](https://patreon.com/FujoCoded).

## Where can I see this in a spreadsheet?

[Ask no further](https://docs.google.com/spreadsheets/d/1aY6AikjyXaAqMboNoXRkUGjtrGWbPi0uvbwdbCUlp7c/edit?usp=sharing)

## What does this do & how do I use this?

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

1. `collections-summary.csv`, a CSV file with a line for each collection,
   containing (assuming `app.bsky.feed.post` as example):

   - `domain`: The tld + domain of the collection (`app.bsky`)
   - `namespace`: the namespace of the collection (`app.bsky.feed`)
   - `collection`: the full name of the collection (`app.bsky.feed.post`)

1. `keys-to-collections-map.csv`, a CSV file with a line for each key that
   appears in collections, containing:

   - `key`: a key as it appears collection records
   - `collections_count`: how many collections include that key
   - `namespaces_count`: how many namespaces (e.g. `app.bsky.feed`) include
     that key
   - `domains_count`: how many domains (e.g. `app.bsky`) include
     that key
   - `collections`: which collections include that key, joined by ";"
   - `namespaces`: which namespaces include that key, joined by ";"
   - `domains`: which domains (e.g. `app.bsky`) include that key, joined by ";"

1. `types-to-collections-map.csv`, a CSV file with a line for each type that
   appears as a nested type in a collection, containing:

   - `type`: a type as it appears in a $type filed of a collection record (but
     not the top level record)
   - `collections_count`: how many collections include that type
   - `namespaces_count`: how many namespaces (e.g. `app.bsky.feed`) include
     that type
   - `domains_count`: how many domains (e.g. `app.bsky`) include
     that type
   - `collections`: which collections include that type, separated by ;
   - `namespaces`: which namespaces include that type, joined by ";"
   - `domains`: which domains (e.g. `app.bsky`) include that type, joined by ";"
