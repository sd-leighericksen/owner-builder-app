// Writes the OpenAPI spec to openapi.json. Usage: pnpm openapi
import fs from "node:fs";
import { buildOpenApiDocument } from "./document";

const doc = buildOpenApiDocument();
fs.writeFileSync("openapi.json", JSON.stringify(doc, null, 2));
console.log(`openapi.json written (${Object.keys(doc.paths ?? {}).length} paths)`);
