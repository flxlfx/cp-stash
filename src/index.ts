#!/usr/bin/env node

import archiver from "archiver";
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { relative, resolve } from "node:path";

type Mode = "--stash" | "--modified" | "--all";

interface CliOptions {
  mode: Mode;
  outputName?: string;
  showHelp: boolean;
  stashRef: string;
  withClaude: boolean;
}

const HELP_TEXT = `
cp-stash — zip de stash e/ou arquivos modificados (estrutura de pastas preservada)
Alias: cpzip

┌────────────────────────────┬──────────────────────────────────────────┐
│          Comando           │                Descrição                 │
├────────────────────────────┼──────────────────────────────────────────┤
│ cp-stash                   │ Zipa stash + arquivos modificados        │
├────────────────────────────┼──────────────────────────────────────────┤
│ cpzip                      │ Alias curto de cp-stash                  │
├────────────────────────────┼──────────────────────────────────────────┤
│ cp-stash --stash           │ Só arquivos do stash                     │
├────────────────────────────┼──────────────────────────────────────────┤
│ cp-stash --modified        │ Só arquivos modificados/staged/untracked │
├────────────────────────────┼──────────────────────────────────────────┤
│ cp-stash --stash stash@{2} │ Stash específico                         │
├────────────────────────────┼──────────────────────────────────────────┤
│ cp-stash -o nome.zip       │ Nome customizado pro zip                 │
├────────────────────────────┼──────────────────────────────────────────┤
│ cp-stash --with-claude     │ Inclui .claude (por padrão fica de fora) │
└────────────────────────────┴──────────────────────────────────────────┘

Opções adicionais:
  --all         Stash + modificados (equivalente ao padrão sem flags)
  --help, -h    Esta ajuda
  -o, --output  Arquivo zip de saída (padrão: cp-stash-<timestamp>.zip)
  stash@{N}     Qual entrada do stash usar (padrão: stash@{0})
`;

function exitWithError(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliOptions {
  const modes = argv.filter(
    (arg): arg is Mode =>
      arg === "--stash" || arg === "--modified" || arg === "--all",
  );
  if (new Set(modes).size > 1) {
    exitWithError("use apenas um modo entre --stash, --modified e --all.");
  }

  let outputName: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "-o" || argv[i] === "--output") {
      const nextArg = argv[i + 1];
      if (!nextArg || nextArg.startsWith("-")) {
        exitWithError("a opção -o/--output precisa de um nome de arquivo.");
      }
      outputName = nextArg;
    }
  }

  return {
    mode: modes[0] ?? "--all",
    outputName,
    showHelp: argv.includes("--help") || argv.includes("-h"),
    stashRef: argv.find((arg) => arg.startsWith("stash@{")) ?? "stash@{0}",
    withClaude: argv.includes("--with-claude"),
  };
}

const options = parseArgs(process.argv.slice(2));

if (options.showHelp) {
  console.log(HELP_TEXT);
  process.exit(0);
}

function runGit(args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

// Check if we're in a git repo
const gitRoot = runGit(["rev-parse", "--show-toplevel"]);
if (!gitRoot) {
  console.error("Error: not inside a git repository.");
  process.exit(1);
}

function getStashFiles(ref: string): string[] {
  const output = runGit(["stash", "show", "--name-only", ref]);
  if (!output) {
    console.warn(`Warning: no stash found at ${ref}`);
    return [];
  }
  return output.split("\n").filter(Boolean);
}

function getModifiedFiles(): string[] {
  // staged + unstaged + untracked
  const staged = runGit(["diff", "--cached", "--name-only"]);
  const unstaged = runGit(["diff", "--name-only"]);
  const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);
  const all = [staged, unstaged, untracked].join("\n");
  return [...new Set(all.split("\n").filter(Boolean))];
}

function isUnderClaude(repoPath: string): boolean {
  return repoPath === ".claude" || repoPath.startsWith(".claude/");
}

// Collect files
const files = new Set<string>();

if (options.mode === "--stash" || options.mode === "--all") {
  for (const f of getStashFiles(options.stashRef)) files.add(f);
}
if (options.mode === "--modified" || options.mode === "--all") {
  for (const f of getModifiedFiles()) files.add(f);
}

if (!options.withClaude) {
  for (const f of [...files]) {
    if (isUnderClaude(f)) files.delete(f);
  }
}

if (files.size === 0) {
  console.log("No files found to zip.");
  process.exit(0);
}

console.log(`Found ${files.size} file(s):`);
for (const f of files) console.log(`  ${f}`);

// Create zip
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outputName = options.outputName ?? `cp-stash-${timestamp}.zip`;
const outputPath = resolve(process.cwd(), outputName);
const repoRelativeOutputPath = relative(gitRoot, outputPath).replace(/\\/g, "/");

if (
  repoRelativeOutputPath &&
  !repoRelativeOutputPath.startsWith("..") &&
  !repoRelativeOutputPath.includes(":")
) {
  files.delete(repoRelativeOutputPath);
}

const output = createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 9 } });

archive.on("error", (err) => {
  console.error("Archive error:", err.message);
  process.exit(1);
});

archive.on("warning", (err) => {
  if (err.code === "ENOENT") {
    console.warn("Warning:", err.message);
  } else {
    throw err;
  }
});

output.on("close", () => {
  console.log(
    `\nCreated: ${outputName} (${(archive.pointer() / 1024).toFixed(1)} KB)`,
  );
});

archive.pipe(output);

for (const filePath of files) {
  const absPath = resolve(gitRoot, filePath);
  if (existsSync(absPath)) {
    archive.file(absPath, { name: filePath });
  } else {
    console.warn(`  Skipped (not found): ${filePath}`);
  }
}

await archive.finalize();
