import fs from "fs";
import path from "path";

const CWD = process.cwd();

function safePath(filePath: string): string {
  const resolved = path.resolve(CWD, filePath);
  if (!resolved.startsWith(CWD)) throw new Error(`Path outside project: ${filePath}`);
  return resolved;
}

export const fsTools = [
  {
    name: "read_file",
    description: "Read the contents of a file in the current project",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the file" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write or overwrite a file in the current project",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the file" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "List files and directories at a path",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative directory path (default: .)" },
      },
    },
  },
];

export function executeFsTool(name: string, input: Record<string, string>): string {
  if (name === "read_file") {
    const abs = safePath(input.path);
    if (!fs.existsSync(abs)) return `Error: file not found: ${input.path}`;
    return fs.readFileSync(abs, "utf-8");
  }

  if (name === "write_file") {
    const abs = safePath(input.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, input.content);
    return `✓ Written: ${input.path}`;
  }

  if (name === "list_files") {
    const dir = safePath(input.path ?? ".");
    if (!fs.existsSync(dir)) return `Error: directory not found: ${input.path}`;
    return fs.readdirSync(dir).join("\n");
  }

  return `Unknown tool: ${name}`;
}
