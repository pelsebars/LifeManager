import Anthropic from '@anthropic-ai/sdk';

/**
 * Assistant Service — single gateway for all Claude API calls.
 * No other file in this codebase imports @anthropic-ai/sdk directly.
 */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// claude-sonnet-4-6 for conversations, claude-haiku-4-5-20251001 for lightweight tasks
const SONNET = 'claude-sonnet-4-6';
const HAIKU = 'claude-haiku-4-5-20251001';

interface StandupInput {
  messages: Anthropic.MessageParam[];
  todayTasks: object[];
  incompleteTasks: object[];
  today: string;
}

interface QueryInput {
  question: string;
  projects: object[];
}

export const assistantService = {
  async standup({ messages, todayTasks, incompleteTasks, today }: StandupInput): Promise<string> {
    const systemPrompt = `You are LifeManager, a personal life assistant running a daily standup.
Today is ${today}.

Your job:
1. Review tasks that were scheduled for yesterday but not completed. For each, ask the user whether to shift forward, defer, or drop.
2. Present today's scheduled tasks with project/phase context.
3. Flag any deadline risks.
4. Confirm the plan with the user.

Be concise and practical. Use bullet points. Focus on actionable decisions.

Today's tasks:
${JSON.stringify(todayTasks, null, 2)}

Yesterday's incomplete tasks:
${JSON.stringify(incompleteTasks, null, 2)}`;

    const response = await client.messages.create({
      model: SONNET,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.length > 0 ? messages : [
        { role: 'user', content: "Good morning, let's do the standup." }
      ],
    });

    return (response.content[0] as Anthropic.TextBlock).text;
  },

  async query({ question, projects }: QueryInput): Promise<string> {
    const response = await client.messages.create({
      model: SONNET,
      max_tokens: 512,
      system: `You are LifeManager. Answer questions about the user's active projects and tasks concisely.
Active projects data:
${JSON.stringify(projects, null, 2)}`,
      messages: [{ role: 'user', content: question }],
    });

    return (response.content[0] as Anthropic.TextBlock).text;
  },

  /**
   * Lightweight classification — uses Haiku for cost efficiency.
   * Example: classify whether a user message is a reschedule request vs a status update.
   */
  async classify(text: string, categories: string[]): Promise<string> {
    const response = await client.messages.create({
      model: HAIKU,
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: `Classify this text into exactly one category. Categories: ${categories.join(', ')}. Text: "${text}". Reply with only the category name.`
      }],
    });
    return (response.content[0] as Anthropic.TextBlock).text.trim();
  },
};
