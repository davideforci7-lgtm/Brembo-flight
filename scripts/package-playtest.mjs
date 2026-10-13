// SPDX-License-Identifier: AGPL-3.0-only
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
await rm("playtest-package", { recursive: true, force: true });
await mkdir("playtest-package/scripts", { recursive: true });
await cp("dist", "playtest-package/dist", { recursive: true });
await cp("scripts/playtest.mjs", "playtest-package/scripts/playtest.mjs");
await cp("LICENSE", "playtest-package/LICENSE");
await cp("docs/PLAYTEST.md", "playtest-package/LEGGIMI.md");
await cp("docs/PILOT-TEST.md", "playtest-package/PILOT-TEST.md");
await writeFile(
  "playtest-package/AVVIA-WINDOWS.bat",
  '@echo off\r\ncd /d "%~dp0"\r\nnode scripts/playtest.mjs\r\npause\r\n',
);
await writeFile(
  "playtest-package/avvia.sh",
  '#!/bin/sh\ncd -- "$(dirname -- "$0")"\nnode scripts/playtest.mjs\n',
);
console.log(
  "Pacchetto in playtest-package. Il computer ospitante richiede Node; i giocatori solo il browser.",
);
