import type Anthropic from "@anthropic-ai/sdk";

const MAX_MESSAGES = 40;
const MAX_TOOL_OUTPUT_CHARS = 8000;

export type Message = Anthropic.MessageParam;

export class SessionMemory {
  private messages: Message[] = [];
  private summary = "";

  add(message: Message): void {
    this.messages.push(message);
    if (this.messages.length > MAX_MESSAGES) {
      this.summary = `[Earlier conversation compressed. Key facts: ${this.summary}]`;
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }
  }

  getMessages(): Message[] {
    return this.messages;
  }

  getSummary(): string {
    return this.summary;
  }

  clipToolOutput(output: string): string {
    if (output.length <= MAX_TOOL_OUTPUT_CHARS) return output;
    return output.slice(0, MAX_TOOL_OUTPUT_CHARS) + "\n...[output clipped]";
  }
}
