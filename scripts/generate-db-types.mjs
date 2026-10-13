import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
// Generation writes only after CLI success; a failed connection never erases types.
const executable = path.resolve("node_modules/supabase/dist/supabase.js");
const result = spawnSync(
  process.execPath,
  [
    executable,
    "gen",
    "types",
    process.argv.includes("--linked") ? "--linked" : "--local",
    "--schema",
    "public",
  ],
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
);
if (result.error || result.status !== 0) {
  process.stderr.write(
    "Type generation failed. Start local Supabase (Docker required), or link a project and pass --linked.\n",
  );
  process.exitCode = 1;
} else {
  writeFileSync(path.resolve("types/database.ts"), result.stdout);
  process.stdout.write("Updated types/database.ts\n");
}
