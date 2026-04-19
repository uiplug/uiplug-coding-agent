import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export interface RepoContext {
  cwd: string;
  gitBranch?: string;
  projectName?: string;
  hasPackageJson: boolean;
  framework?: string;
  fileTree: string;
}

export function gatherContext(): RepoContext {
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, "package.json");
  const hasPackageJson = fs.existsSync(pkgPath);

  let gitBranch: string | undefined;
  try {
    gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf-8" }).trim();
  } catch {
    // not a git repo
  }

  let projectName: string | undefined;
  let framework: string | undefined;
  if (hasPackageJson) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    projectName = pkg.name;
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.react) framework = "react";
    else if (deps.vue) framework = "vue";
    else if (deps.svelte) framework = "svelte";
    else if (deps.next) framework = "next";
  }

  let fileTree = "";
  try {
    fileTree = execSync("find . -not -path '*/node_modules/*' -not -path '*/.git/*' -maxdepth 3", {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    fileTree = cwd;
  }

  return { cwd, gitBranch, projectName, hasPackageJson, framework, fileTree };
}

export function contextToPrompt(ctx: RepoContext): string {
  return [
    `Working directory: ${ctx.cwd}`,
    ctx.projectName ? `Project: ${ctx.projectName}` : null,
    ctx.framework ? `Framework: ${ctx.framework}` : null,
    ctx.gitBranch ? `Git branch: ${ctx.gitBranch}` : null,
    `\nFile tree:\n${ctx.fileTree}`,
  ]
    .filter(Boolean)
    .join("\n");
}
