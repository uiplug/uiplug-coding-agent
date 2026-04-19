import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

const CONFIG_DIR = path.join(os.homedir(), ".uiplug");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface Config {
  api_key: string;
  anthropic_key: string;
}

export function loadConfig(): Config | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

export function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

export async function setupConfig(): Promise<Config> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const api_key = await ask(rl, "Enter your UIPlug API key: ");
  const anthropic_key = await ask(rl, "Enter your Anthropic API key: ");
  rl.close();

  const config = { api_key, anthropic_key };
  saveConfig(config);
  console.log("\n✓ Keys saved to ~/.uiplug/config\n");
  return config;
}
