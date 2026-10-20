import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
const result = await build({
  stdin: {
    contents: "export {createCatalog} from './src/canal/catalog.ts'",
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const { createCatalog } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);
await mkdir("art/canal-town", { recursive: true });
await writeFile(
  "art/canal-town/catalog.json",
  JSON.stringify(createCatalog(), null, 2),
);
