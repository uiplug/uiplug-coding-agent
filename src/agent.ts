import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { fsTools, executeFsTool } from "./tools/fs.js";
import { shellTools, executeShellTool } from "./tools/shell.js";
import { uiplugTools, executeUiplugTool } from "./tools/uiplug.js";
import { gatherContext, contextToPrompt } from "./context.js";
import { SessionMemory } from "./memory.js";

const STABLE_SYSTEM_PROMPT = `You are UIPlug Agent — a terminal coding assistant that helps developers build and maintain consistent UI components using the UIPlug platform.

You have access to:
- File system tools: read, write, and list files in the user's project
- Shell tools: run safe commands (npm, git, tsc, etc.)
- UIPlug tools: search, get, list, and create UI components in the UIPlug library

Your goal is to help developers write UI code that is consistent with their UIPlug component library. When asked to create UI, always search UIPlug first to check if a matching component already exists before writing new code.

Be concise. Show code directly. When you write files, confirm what was written.`;

const allTools = [...fsTools, ...shellTools, ...uiplugTools] as Anthropic.Tool[];

export class Agent {
  private client: Anthropic;
  private memory = new SessionMemory();
  private uiplugApiKey: string;

  constructor(uiplugApiKey: string, anthropicApiKey: string) {
    this.uiplugApiKey = uiplugApiKey;
    this.client = new Anthropic({ apiKey: anthropicApiKey });
  }

  async run(userMessage: string): Promise<void> {
    const ctx = gatherContext();
    const contextBlock = contextToPrompt(ctx);
    const systemPrompt = `${STABLE_SYSTEM_PROMPT}\n\n<workspace>\n${contextBlock}\n</workspace>`;

    this.memory.add({ role: "user", content: userMessage });

    process.stdout.write(chalk.cyan("\nUIPlug Agent: "));

    await this.agentLoop(systemPrompt);
  }

  private async agentLoop(systemPrompt: string): Promise<void> {
    while (true) {
      let inThinkingBlock = false;

      const stream = this.client.messages.stream(
        {
          model: "claude-sonnet-4-6",
          max_tokens: 16000,
          system: systemPrompt,
          tools: allTools,
          messages: this.memory.getMessages(),
          thinking: { type: "enabled", budget_tokens: 8000 },
        } as Anthropic.MessageCreateParamsNonStreaming,
        {
          headers: { "anthropic-beta": "interleaved-thinking-2025-05-14" },
        }
      );

      for await (const event of stream) {
        const e = event as unknown as Record<string, unknown>;

        if (e.type === "content_block_start") {
          const block = e.content_block as Record<string, unknown> | undefined;
          if (block?.type === "thinking") {
            inThinkingBlock = true;
            process.stdout.write(chalk.dim.magenta("\n◆ "));
          }
        }

        if (e.type === "content_block_delta") {
          const delta = e.delta as Record<string, unknown> | undefined;
          if (delta?.type === "thinking_delta" && inThinkingBlock) {
            process.stdout.write(chalk.dim(delta.thinking as string));
          } else if (delta?.type === "text_delta") {
            process.stdout.write(chalk.white(delta.text as string));
          }
        }

        if (e.type === "content_block_stop" && inThinkingBlock) {
          inThinkingBlock = false;
          process.stdout.write(chalk.dim.magenta(" ◆\n"));
        }
      }

      const response = await stream.finalMessage();
      const assistantMessage: Anthropic.MessageParam = {
        role: "assistant",
        content: response.content,
      };
      this.memory.add(assistantMessage);

      if (response.stop_reason === "end_turn") {
        process.stdout.write("\n");
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          const toolName = block.name;
          const toolInput = block.input as Record<string, unknown>;

          process.stdout.write(chalk.yellow(`\n[tool: ${toolName}]`));

          let result: string;
          if (fsTools.some((t) => t.name === toolName)) {
            result = executeFsTool(toolName, toolInput as Record<string, string>);
          } else if (shellTools.some((t) => t.name === toolName)) {
            result = executeShellTool(toolName, toolInput as { command: string });
          } else if (uiplugTools.some((t) => t.name === toolName)) {
            result = await executeUiplugTool(toolName, toolInput, this.uiplugApiKey);
          } else {
            result = `Unknown tool: ${toolName}`;
          }

          result = this.memory.clipToolOutput(result);
          process.stdout.write(chalk.gray(` ${result.split("\n")[0].slice(0, 80)}\n`));

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }

        this.memory.add({ role: "user", content: toolResults });
        process.stdout.write(chalk.cyan("\n"));
      }
    }
  }
}
