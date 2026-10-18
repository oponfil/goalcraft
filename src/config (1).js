// Supabase project for sign-in and data. The publishable key is meant to be public: access to
// rows is limited by row-level security, never by keeping this key secret.
export const SUPABASE_URL = 'https://goalagents.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_VaGOkfWYKFalAUfhQsN9xw_w2phwPCr';
// Public OAuth client ID: Google's sign-in button runs on our own pages.
export const GOOGLE_CLIENT_ID = '994359194611-0l6atv7bfgmdlfsd15p09gjju6h58khf.apps.googleusercontent.com';
// Remote MCP server the agents connect to: cloudflare/worker.js passes it on to supabase/functions/mcp.
export const MCP_URL = 'https://goalagents.run/mcp';
