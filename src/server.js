import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

console.log("=== Server Startup ===");
console.log("RALLY_BASE_URL:", process.env.RALLY_BASE_URL);
console.log("RALLY_API_KEY:", process.env.RALLY_API_KEY ? "✓ Set" : "✗ NOT SET");

const BASE_URL = process.env.RALLY_BASE_URL;
const API_KEY = process.env.RALLY_API_KEY;
const PORT = 3001;

if (!BASE_URL || !API_KEY) {
  console.error("❌ ERROR: Missing RALLY_BASE_URL or RALLY_API_KEY in .env");
  process.exit(1);
}

console.log("✓ Environment validated");

/* ============================== */
/* Health Check & Root Endpoints */
/* ============================== */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Rally MCP Server is running",
    version: "1.0.0"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

/* ============================== */
/* MCP Protocol Constants */
/* ============================== */

const TOOL_DEFINITIONS = [
  {
    name: "getUserStory",
    description: "Get Rally user story details using story ID like US12345",
    inputSchema: {
      type: "object",
      properties: {
        storyNumber: { type: "string", description: "Rally story ID (e.g., US12345)" }
      },
      required: ["storyNumber"]
    }
  },
  {
    name: "getDefects",
    description: "Get defects linked to a Rally story",
    inputSchema: {
      type: "object",
      properties: {
        storyNumber: { type: "string", description: "Rally story ID (e.g., US12345)" }
      },
      required: ["storyNumber"]
    }
  },
  {
    name: "getStoryTasks",
    description: "Get tasks associated with a Rally story",
    inputSchema: {
      type: "object",
      properties: {
        storyNumber: { type: "string", description: "Rally story ID (e.g., US12345)" }
      },
      required: ["storyNumber"]
    }
  }
];

/* ============================== */
/* MCP SSE Implementation */
/* ============================== */

function sendMCPMessage(res, message) {
  const data = JSON.stringify(message);
  res.write(`data: ${data}\n\n`);
}

app.get("/mcp/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  console.log("📡 SSE client connected");

  // Send initialization message
  sendMCPMessage(res, {
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      serverInfo: {
        name: "rally-mcp-server",
        version: "1.0.0"
      }
    }
  });

  // Periodic keepalive
  const interval = setInterval(() => {
    try {
      sendMCPMessage(res, {
        jsonrpc: "2.0",
        method: "notifications/message",
        params: {
          level: "info",
          logger: "rally-mcp-server"
        }
      });
    } catch (err) {
      console.error("❌ Error sending keepalive:", err.message);
      clearInterval(interval);
    }
  }, 30000);

  req.on("close", () => {
    console.log("📡 SSE client disconnected");
    clearInterval(interval);
  });

  req.on("error", (err) => {
    console.error("❌ SSE error:", err.message);
    clearInterval(interval);
  });
});

app.get("/mcp/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sendMCPMessage(res, {
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      serverInfo: {
        name: "rally-mcp-server",
        version: "1.0.0"
      }
    }
  });

  const interval = setInterval(() => {
    try {
      sendMCPMessage(res, { jsonrpc: "2.0", method: "ping" });
    } catch (err) {
      clearInterval(interval);
    }
  }, 30000);

  req.on("close", () => clearInterval(interval));
});

/* ============================== */
/* Tool Discovery (REST endpoints) */
/* ============================== */

app.get("/mcp/tools", (req, res) => {
  res.json({ tools: TOOL_DEFINITIONS });
});

app.get("/tools", (req, res) => {
  res.json({ tools: TOOL_DEFINITIONS });
});

/* ============================== */
/* Tool Execution */
/* ============================== */

async function executeTool(tool, input) {
  if (tool === "getUserStory") {
    return await fetchUserStory(input.storyNumber);
  }
  if (tool === "getDefects") {
    return await fetchDefects(input.storyNumber);
  }
  if (tool === "getStoryTasks") {
    return await fetchTasks(input.storyNumber);
  }
  throw new Error("Unknown tool: " + tool);
}

app.post("/mcp/call", async (req, res) => {
  const { tool, input } = req.body;
  try {
    const result = await executeTool(tool, input);
    res.json(result);
  } catch (err) {
    console.error("❌ Tool execution error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/mcp/execute", async (req, res) => {
  const { tool, input } = req.body;
  try {
    const result = await executeTool(tool, input);
    res.json(result);
  } catch (err) {
    console.error("❌ Tool execution error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/execute", async (req, res) => {
  const { tool, input } = req.body;
  try {
    const result = await executeTool(tool, input);
    res.json(result);
  } catch (err) {
    console.error("❌ Tool execution error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ============================== */
/* Rally API Functions */
/* ============================== */

async function fetchUserStory(storyNumber) {
  const query = `(FormattedID = "${storyNumber}")`;
  const encodedQuery = encodeURIComponent(query);
  const endpoint = `${BASE_URL}/hierarchicalrequirement?query=${encodedQuery}&fetch=FormattedID,Name,Description,ScheduleState`;

  const response = await axios.get(endpoint, {
    headers: { ZSESSIONID: API_KEY }
  });

  const story = response.data.QueryResult.Results[0];
  if (!story) throw new Error(`Story ${storyNumber} not found`);

  return {
    story: {
      FormattedID: story.FormattedID,
      Name: story.Name,
      Description: cleanHTML(story.Description),
      ScheduleState: story.ScheduleState
    }
  };
}

async function fetchDefects(storyNumber) {
  const query = `(Requirement.FormattedID = "${storyNumber}")`;
  const encodedQuery = encodeURIComponent(query);
  const endpoint = `${BASE_URL}/defect?query=${encodedQuery}&fetch=FormattedID,Name,State`;

  const response = await axios.get(endpoint, {
    headers: { ZSESSIONID: API_KEY }
  });

  return {
    defects: response.data.QueryResult.Results
  };
}

async function fetchTasks(storyNumber) {
  const query = `(WorkProduct.FormattedID = "${storyNumber}")`;
  const encodedQuery = encodeURIComponent(query);
  const endpoint = `${BASE_URL}/task?query=${encodedQuery}&fetch=FormattedID,Name,State`;

  const response = await axios.get(endpoint, {
    headers: { ZSESSIONID: API_KEY }
  });

  return {
    tasks: response.data.QueryResult.Results
  };
}

function cleanHTML(text) {
  if (!text) return "";
  return text.replace(/<[^>]+>/g, "");
}

/* ============================== */
/* Error Handling */
/* ============================== */

app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ error: err.message });
});

/* ============================== */
/* Start Server */
/* ============================== */

app.listen(PORT, () => {
  console.log("🔥 CORRECT SERVER RUNNING");
  console.log(`✓ Rally MCP Server running on port ${PORT}`);
  console.log(`  Health: http://127.0.0.1:${PORT}/health`);
  console.log(`  MCP SSE: http://127.0.0.1:${PORT}/mcp/sse`);
  console.log(`  Tools: http://127.0.0.1:${PORT}/mcp/tools`);
});