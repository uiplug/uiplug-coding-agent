import { execSync } from "child_process";

const ALLOWED_COMMANDS = ["npm", "npx", "node", "git", "ls", "cat", "pwd", "tsc", "prettier"];

export const shellTools = [
  {
    name: "run_command",
    description: "Run a shell command in the current project directory. Only safe commands are allowed.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run" },
      },
      required: ["command"],
    },
  },
];

export function executeShellTool(name: string, input: { command: string }): string {
  if (name !== "run_command") return `Unknown tool: ${name}`;

  const base = input.command.trim().split(" ")[0];
  if (!ALLOWED_COMMANDS.includes(base)) {
    return `Error: command '${base}' is not allowed. Allowed: ${ALLOWED_COMMANDS.join(", ")}`;
  }

  try {
    return execSync(input.command, { cwd: process.cwd(), encoding: "utf-8", timeout: 30000 });
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    return `Error: ${error.stderr ?? error.message ?? "unknown error"}`;
  }
}
