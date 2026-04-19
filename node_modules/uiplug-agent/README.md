&nbsp;
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
## Setup

Install dependencies:

```bash
npm install
```

On first run the agent will prompt you for your API keys and save them to `~/.uiplug/config.json`:

```
Enter your UIPlug API key: ...
Enter your Anthropic API key: ...
✓ Keys saved to ~/.uiplug/config
```

&nbsp;
## Usage

Start the agent in dev mode:

```bash
npm run dev
```

Or build and run:

```bash
npm run build
node dist/index.js
```

Type your request at the `❯` prompt. Type `exit` or `quit` to leave.

&nbsp;
## What It Does

The agent gathers your workspace context (git branch, framework, file tree) and passes it to Claude Sonnet 4.6. Claude can then use a set of tools to help you build UI that's consistent with your UIPlug component library.

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
❯ list my components
❯ search for a navbar component in React
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
## Architecture

```
src/
├── index.ts       — CLI entry point and REPL loop
├── agent.ts       — Claude agent loop with tool routing
├── config.ts      — API key loading and first-run setup
├── memory.ts      — Session message history (40 msg cap)
├── context.ts     — Workspace context gathering
└── tools/
    ├── fs.ts      — File system tools
    ├── shell.ts   — Shell execution (whitelisted commands)
    └── uiplug.ts  — UIPlug/Supabase integration
```

The agent uses a streaming agentic loop: Claude streams a response, tool calls are executed, results are fed back, and the loop continues until `end_turn`.
