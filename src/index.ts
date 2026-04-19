#!/usr/bin/env node --no-deprecation
import readline from "readline";
import chalk from "chalk";
import { loadConfig, setupConfig } from "./config.js";
import { Agent } from "./agent.js";

const MODES = ["on", "off"] as const;
let modeIdx = 0;
const inputQueue: string[] = [];

const rule = () => chalk.gray("─".repeat(process.stdout.columns || 80));

const hint = () =>
  chalk.cyan("⏵⏵") +
  chalk.gray(` accept edits ${MODES[modeIdx]}`) +
  chalk.dim("  (shift+tab)") +
  chalk.dim("  /help for commands") +
  (inputQueue.length > 0 ? chalk.yellow(`  [${inputQueue.length} queued]`) : "");

const SLASH_COMMANDS: Record<string, (args: string) => string> = {
  search:  (args) => `Search UIPlug components for: ${args}`,
  list:    ()     => "List available UIPlug components",
  my:      ()     => "List my UIPlug components",
  create:  (args) => `Create a UIPlug component: ${args}`,
  get:     (args) => `Get UIPlug component with ID: ${args}`,
  groups:  ()     => "List my UIPlug groups",
  profile: ()     => "Show my UIPlug profile",
  help:    ()     => "What slash commands and tools do you have available? List them clearly.",
};

function parseSlashCommand(input: string): string {
  if (!input.startsWith("/")) return input;
  const parts = input.slice(1).split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");
  const fn = SLASH_COMMANDS[cmd];
  return fn ? fn(args) : input;
}

// Captures keystrokes into the queue while the agent is running.
// Returns a cleanup function that stops capturing.
function startBackgroundCapture(): () => void {
  let buf = "";

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  const handler = (
    _: unknown,
    key: { sequence: string; name: string; ctrl?: boolean; meta?: boolean }
  ) => {
    if (!key) return;

    if (key.ctrl && key.name === "c") {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write("\n");
      process.exit(0);
    }

    if (key.name === "return") {
      const trimmed = buf.trim();
      if (trimmed) {
        inputQueue.push(parseSlashCommand(trimmed));
        process.stdout.write(chalk.dim.cyan(`\n  ↳ queued: "${trimmed}"\n`));
        buf = "";
      }
      return;
    }

    if (key.name === "backspace") {
      buf = buf.slice(0, -1);
      return;
    }

    if (key.sequence && !key.ctrl && !key.meta && key.sequence.charCodeAt(0) >= 32) {
      buf += key.sequence;
    }
  };

  process.stdin.on("keypress", handler);

  return () => {
    process.stdin.removeListener("keypress", handler);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  };
}

function readInput(): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    let pos = 0;
    const PREFIX = "❯ ";
    const PREFIX_LEN = 2;

    // Restore saved cursor, clear to end of screen, redraw, then reposition on input line.
    const drawAll = () => {
      process.stdout.write("\x1b8");           // restore to start of input line
      process.stdout.write("\x1b[J");          // clear from cursor to end of screen
      process.stdout.write(`${chalk.bold.cyan(PREFIX)}${buf}\n${rule()}\n${hint()}`);
      process.stdout.write("\x1b8");           // restore again to start of input line
      process.stdout.write(`\x1b[${PREFIX_LEN + pos}C`); // move right to cursor pos
    };

    // Write top rule, then save cursor position at the beginning of the input line.
    process.stdout.write(`\n${rule()}\n`);
    process.stdout.write("\x1b7");             // save cursor here (start of input line)
    process.stdout.write(`${chalk.bold.cyan(PREFIX)}\n${rule()}\n${hint()}`);
    process.stdout.write("\x1b8");             // restore to start of input line
    process.stdout.write(`\x1b[${PREFIX_LEN}C`); // move right past prefix

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const onKey = (
      _: unknown,
      key: { sequence: string; name: string; shift?: boolean; ctrl?: boolean; meta?: boolean }
    ) => {
      if (!key) return;

      if (key.ctrl && key.name === "c") {
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(0);
      }

      if (key.name === "return") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("keypress", onKey);
        process.stdout.write("\x1b8\x1b[J\n"); // clear UI, leave a blank line
        resolve(buf);
        return;
      }

      if (key.name === "backspace") {
        if (pos > 0) {
          buf = buf.slice(0, pos - 1) + buf.slice(pos);
          pos--;
          drawAll();
        }
        return;
      }

      if (key.name === "delete") {
        if (pos < buf.length) {
          buf = buf.slice(0, pos) + buf.slice(pos + 1);
          drawAll();
        }
        return;
      }

      if (key.name === "left") {
        if (pos > 0) { pos--; process.stdout.write("\x1b[1D"); }
        return;
      }

      if (key.name === "right") {
        if (pos < buf.length) { pos++; process.stdout.write("\x1b[1C"); }
        return;
      }

      if (key.name === "home" || (key.ctrl && key.name === "a")) {
        pos = 0;
        process.stdout.write(`\x1b8\x1b[${PREFIX_LEN}C`);
        return;
      }

      if (key.name === "end" || (key.ctrl && key.name === "e")) {
        pos = buf.length;
        process.stdout.write(`\x1b8\x1b[${PREFIX_LEN + pos}C`);
        return;
      }

      if (key.ctrl && key.name === "u") {
        buf = buf.slice(pos);
        pos = 0;
        drawAll();
        return;
      }

      if (key.ctrl && key.name === "k") {
        buf = buf.slice(0, pos);
        drawAll();
        return;
      }

      if (key.shift && key.name === "tab") {
        modeIdx = (modeIdx + 1) % MODES.length;
        drawAll();
        return;
      }

      if (key.sequence && !key.ctrl && !key.meta && key.sequence.length === 1 && key.sequence.charCodeAt(0) >= 32) {
        buf = buf.slice(0, pos) + key.sequence + buf.slice(pos);
        pos++;
        drawAll();
      }
    };

    process.stdin.on("keypress", onKey);
  });
}

async function main() {
  console.log(chalk.bold.blue("\n  UIPlug Agent"));
  console.log(chalk.gray("  AI coding assistant for UI consistency\n"));

  let config = loadConfig();

  if (!config) {
    console.log(chalk.yellow("Welcome! Let's get you set up.\n"));
    config = await setupConfig();
  }

  console.log(chalk.green("✓ Connected to UIPlug"));

  const agent = new Agent(config.api_key, config.anthropic_key);

  while (true) {
    let trimmed: string;

    if (inputQueue.length > 0) {
      trimmed = inputQueue.shift()!;
      console.log(chalk.dim.cyan(`\n▶ Running queued: "${trimmed}"\n`));
    } else {
      const input = await readInput();
      trimmed = input.trim();

      if (!trimmed) continue;
      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        console.log(chalk.gray("\nGoodbye!\n"));
        process.exit(0);
      }

      trimmed = parseSlashCommand(trimmed);
    }

    console.log(chalk.dim("  [Agent is thinking — type your next prompt and press Enter to queue it]"));

    const stopCapture = startBackgroundCapture();
    try {
      await agent.run(trimmed);
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error(chalk.red(`\nError: ${error.message ?? "unknown error"}`));
    } finally {
      stopCapture();
    }
  }
}

main().catch((err) => {
  console.error(chalk.red(`Fatal: ${err.message}`));
  process.exit(1);
});
