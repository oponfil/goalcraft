# Goalcraft in the Claude and ChatGPT directories

What we enter in the Claude Connectors Directory (claude.ai/directory/manage → MCP connector) and in
the ChatGPT plugin directory (OpenAI Platform → plugins → With MCP). Both read the same MCP server.

## Server

- URL: `https://goalcraft.ai/mcp` (Streamable HTTP)
- Auth: OAuth 2.1 with dynamic client registration. Discovery: `https://goalcraft.ai/.well-known/oauth-protected-resource/mcp`
- Tools (13), all with `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint: false`:

| Tool | Reads / writes | Destructive |
|---|---|---|
| `list_funnels` | read | no |
| `get_answer` | read | no |
| `get_messages` | read (marks messages and replies read) | no |
| `upsert_funnel` | write | yes: stages left out are removed |
| `report_counts` | write | no |
| `add_result` | write | no |
| `set_agent_state` | write | no |
| `send_message` | write: a supervisor writes to its worker | no |
| `reply` | write | no |
| `close_question` | write | no |
| `clear_agent` | write | no |
| `create_wake_key` | write: a key for the optional wake script | no |
| `delete_funnel` | write | yes |

## Listing

- Name: Goalcraft
- One-liner (≤200): Watch your AI agents work on your goals: each goal is a pixel-art funnel a supervisor agent runs and worker agents fill stage by stage, asking you when they need you.
- Description (≤2000):

  Goalcraft is a live dashboard for the long goals you hand to AI agents: a job search, fundraising, finding customers, research, growing an audience. Each goal is a funnel of stages (jobs found, applied, interview, offer), drawn as pixel-art tanks with your agents at work between them.

  One agent becomes the funnel's supervisor: it sets the funnel up with you, keeps the funnel's notes (the goal, the stages and how to work them) and its list of items, and writes to the worker agents. Workers report how many items reached their stage after every run, add results as they come, and show their state: at work, asleep until the next run, or waiting for your answer.

  When an agent needs a decision, it asks on the dashboard; you answer from any device, or write to any agent from its card, and it picks the message up and replies. Agents on your own computer (Claude Code, Codex) can be woken within seconds by an optional wake script.

  Goalcraft keeps only counts, dates, links, and the agents' questions and messages. The items themselves stay in your own sources (a Google Sheet, Notion, a file), linked from the funnel.

  Free: 3 funnels of up to 3 stages, with 1 supervisor and 4 worker agents in each. Pro ($9 a month, early-access price): 10 funnels of up to 5 stages, with 1 supervisor and 12 worker agents in each.

- Categories: Productivity, Project management
- Documentation: https://github.com/oponfil/goalcraft/blob/main/docs/MCP.md
- Privacy policy: https://goalcraft.ai/privacy/
- Terms: https://goalcraft.ai/terms/
- Website: https://goalcraft.ai
- Support: support@goalcraft.ai
- Icon: https://goalcraft.ai/apple-touch-icon.png (also favicon.svg). The directory and Claude otherwise show the favicon of the server URL's domain.
- Slug: goalcraft
- Company: Goalcraft (Oleg Ponfilenok, individual), https://goalcraft.ai, contact support@goalcraft.ai

## Use cases

- Track a job search run by agents: jobs found, applications sent, interviews, offers, with the agents' questions about each application.
- Run outreach (customers, investors, partners, bloggers) as a funnel and see where it stalls and when the next result is due.
- Give several agents (Claude, ChatGPT, others) one shared board, each working its own step.

Before connecting: a Goalcraft account (free; sign in with Google or an email link). The connector reads and writes.

## Data handling

- The API is our own (Supabase behind goalcraft.ai).
- No health data, no sponsored content, no payments through tools.

## Reviewer access

Account: `reviewer@goalcraft.ai` with a password (given only in the portal). It is on Pro and has three filled funnels.

1. Add the connector `https://goalcraft.ai/mcp`.
2. On the Goalcraft sign-in page choose **Sign in with a password**, enter the reviewer email and password, then **Allow** on the consent page.
3. Ask: "List my Goalcraft funnels." The dashboard is at https://goalcraft.ai/app/ with the same account.

## Test cases (ChatGPT asks for 5 positive and 3 negative)

Positive:
1. "What goals do I have in Goalcraft?" → `list_funnels`; a short summary of each funnel with counts and results.
2. "Create a Goalcraft funnel for finding podcast guests: found, contacted, replied, booked; the result is a recorded episode, goal 4, one every 14 days." → `upsert_funnel` with 4 stages; the funnel appears on the dashboard.
3. "I contacted 12 more podcasts today and 3 replied; report it to Goalcraft." → `list_funnels` then `report_counts` with the new cumulative counts.
4. "We booked a guest: add a result to the podcast funnel." → `add_result`.
5. "Ask me on Goalcraft whether to accept the Tuesday slot, then wait for my answer." → `set_agent_state` with state `ask` and a question, then `get_answer`; after the answer, `reply`.

Negative:
1. "What's the weather in Hanoi?" → no Goalcraft tool.
2. "Delete all my Goalcraft funnels." → the assistant confirms first; `delete_funnel` only after the person agrees, one funnel at a time.
3. "Send an email to my landlord." → no Goalcraft tool (Goalcraft does not send messages to other people).

## ChatGPT domain check

OpenAI gives a token for `https://goalcraft.ai/.well-known/openai-apps-challenge`. The Cloudflare
Worker answers that path with the Worker variable `OPENAI_APPS_CHALLENGE` as plain text: put the
token there (Workers → goalagents-front → Settings → Variables), no code change.
