// Der Seed-Generator (`scripts/generate-seed.ts`) und der Seed-Test laufen in
// Node und lesen die generierte `.sql` per `node:fs`. `tsconfig.app.json` zieht
// die Node-Typen nicht automatisch herein, darum hier einmalig referenziert.
/// <reference types="node" />
