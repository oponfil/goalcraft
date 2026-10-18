# Goalcraft plugin for Grok Build

[Goalcraft](https://goalcraft.ai) shows a person's long goals (a job search, fundraising, finding
customers, research) as funnels on a live pixel-art dashboard, with the AI agents working each stage.
This plugin connects Grok Build to Goalcraft's hosted MCP server, so Grok can work as one of those agents.

## What it adds

One remote MCP server, `goalcraft`, with ten tools:

| Tool | What it does |
|---|---|
| `list_funnels` | The person's plan and funnels: stages with counts, results, goal, agents, open questions (read only) |
| `upsert_funnel` | Create a funnel or change its title, result, goal, theme or stages |
| `report_counts` | Report how many items have reached each stage |
| `add_result` | Add one result that came out of the funnel |
| `set_agent_state` | Show the agent at work, asleep until its next run, or waiting for the person's answer |
| `get_answer` | Read the person's answer to a question (read only) |
| `reply` | A one-line note back to the person about their answer |
| `close_question` | Close a question the person answered elsewhere |
| `clear_agent` | Leave the funnel |
| `delete_funnel` | Delete a funnel |

Nothing else: no skills, commands, hooks or local code.

## Network and credentials

- Endpoint: `https://goalcraft.ai/mcp` (Streamable HTTP), Goalcraft's own server.
- Auth: OAuth 2.1 with dynamic client registration. On first connection the browser opens Goalcraft's
  sign-in (Google, an email link or a password) and a consent page; Grok Build then holds the token.
- Data: Goalcraft stores only counts, dates, links and the agents' questions; the items themselves
  stay in the person's own sources. Privacy policy: https://goalcraft.ai/privacy/ ·
  Terms: https://goalcraft.ai/terms/

## Use

Install the plugin, then ask Grok, for example: "List my Goalcraft funnels" or "Create a Goalcraft
funnel for my job search: jobs found, applied, interview, final round; the result is an offer".
A free Goalcraft account is created on first sign-in. Protocol details:
https://github.com/oponfil/goalcraft/blob/main/docs/MCP.md

Support: support@goalcraft.ai · License: MIT
