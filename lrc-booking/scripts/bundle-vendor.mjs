import * as esbuild from "esbuild";

const common = {
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
};

await esbuild.build({
  ...common,
  stdin: {
    contents: `export { createClient } from "@supabase/supabase-js";`,
    resolveDir: process.cwd(),
    sourcefile: "supabase-entry.js",
  },
  outfile: "js/vendor/supabase.js",
});

await esbuild.build({
  ...common,
  stdin: {
    contents: `import { jsPDF } from "jspdf";\nexport { jsPDF };`,
    resolveDir: process.cwd(),
    sourcefile: "jspdf-entry.js",
  },
  outfile: "js/vendor/jspdf.js",
});

await esbuild.build({
  ...common,
  stdin: {
    contents: `import * as XLSX from "xlsx";\nexport { XLSX };`,
    resolveDir: process.cwd(),
    sourcefile: "xlsx-entry.js",
  },
  outfile: "js/vendor/xlsx.js",
});
