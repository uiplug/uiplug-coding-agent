# UIPlug Agent

A terminal coding assistant powered by Claude, built for UIPlug UI consistency.

```
  UIPlug Agent
  AI coding assistant for UI consistency

✓ Connected to UIPlug

────────────────────────────────────────────────────────────────────────
❯ search for a button component
────────────────────────────────────────────────────────────────────────
```

&nbsp;
## Requirements

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [UIPlug API key](https://uiplug.com/dashboard/settings)

&nbsp;
## Installation

```bash
npm install -g uiplug-agent
```

Then run from anywhere:

```bash
uiplug
```

On first run the agent will prompt you for your API keys and save them to `~/.uiplug/config.json`:

```
Enter your UIPlug API key: ...
Enter your Anthropic API key: ...
✓ Keys saved to ~/.uiplug/config
```

&nbsp;
## Slash Commands

Type `/help` at the prompt to see all commands. Quick reference:

| Command | Description |
|---|---|
| `/search <query>` | Search UIPlug components |
| `/list` | List available components |
| `/my` | List your components |
| `/create <name>` | Create a component |
| `/get <id>` | Get a component by ID |
| `/groups` | List your groups |
| `/profile` | Show your UIPlug profile |
| `/help` | Show all commands |

&nbsp;
## Input Queue

While the agent is responding you can type your next prompt and press **Enter** to queue it. It will run automatically when the current response finishes.

```
  [Agent is thinking — type your next prompt and press Enter to queue it]
  ↳ queued: "search for a navbar"
```

&nbsp;
## What It Does

The agent gathers your workspace context (git branch, framework, file tree) and passes it to Claude Sonnet 4.6 with extended thinking enabled. Claude can then use a set of tools to help you build UI that's consistent with your UIPlug component library.

**Always searches UIPlug before writing new code** — if a matching component already exists, it will use that instead.

&nbsp;
## Tools

### File system
| Tool | Description |
|---|---|
| `read_file` | Read a file from the project |
| `write_file` | Create or overwrite a file |
| `list_files` | List directory contents |

### Shell
| Tool | Description |
|---|---|
| `run_command` | Run a whitelisted shell command (`npm`, `npx`, `node`, `git`, `ls`, `cat`, `pwd`, `tsc`, `prettier`) |

### UIPlug
| Tool | Description |
|---|---|
| `list_components` | List published components from the marketplace |
| `search_components` | Search components by name, description, or tag |
| `get_component` | Get full source code for a component by ID |
| `get_my_profile` | View your UIPlug profile and stats |
| `list_my_components` | List all components you've created |
| `search_my_components` | Search your own components |
| `list_groups` | List groups you're a member of |
| `create_component` | Submit a new component for review |

&nbsp;
## Example Prompts

```
❯ /list
❯ /search navbar React
❯ create a primary button component and publish it to UIPlug
❯ read src/components/Card.tsx and turn it into a UIPlug component
❯ run npm run build and fix any errors
```

&nbsp;
## Configuration

Keys are stored in `~/.uiplug/config.json`. To reset, delete that file and restart the agent.

```json
{
  "api_key": "your-uiplug-key",
  "anthropic_key": "your-anthropic-key"
}
```

&nbsp;
## Contributing

```bash
git clone https://github.com/your-org/uiplug-coding-agent
cd uiplug-coding-agent
npm install
npm run dev
```

&nbsp;
## Architecture

```
src/
├── index.ts       — CLI entry point, REPL loop, slash commands, input queue
├── agent.ts       — Claude agent loop with extended thinking and tool routing
├── config.ts      — API key loading and first-run setup
├── memory.ts      — Session message history (40 msg cap)
├── context.ts     — Workspace context gathering
└── tools/
    ├── fs.ts      — File system tools
    ├── shell.ts   — Shell execution (whitelisted commands)
    └── uiplug.ts  — UIPlug/Supabase integration
```

The agent uses a streaming agentic loop: Claude streams a response (with extended thinking), tool calls are executed, results are fed back, and the loop continues until `end_turn`.
