import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const BASE_URL = process.env.RALLY_BASE_URL;
const API_KEY = process.env.RALLY_API_KEY;
const PORT = process.env.PORT || 3001;

/* ============================== */
/* SSE FUNCTION (KEY FIX) */
/* ============================== */
function startSSE(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no" // important for proxies (Railway)
  });

  console.log("📡 SSE connected");

  // Send initial MCP handshake
  res.write(
    `data: ${JSON.stringify({
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
    })}\n\n`
  );

  // heartbeat (safe format)
  const interval = setInterval(() => {
    try {
      res.write(`: ping\n\n`); // COMMENT line (safe heartbeat)
    } catch (e) {
      clearInterval(interval);
    }
  }, 15000);

  req.on("close", () => {
    console.log("📡 SSE disconnected");
    clearInterval(interval);
    res.end();
  });
}

/* ============================== */
/* 🔥 IMPORTANT FIX */
/* ============================== */

app.get("/", startSSE);              // 👈 THIS FIXES YOUR ERROR
app.get("/mcp/sse", startSSE);
app.get("/mcp/events", startSSE);

/* ============================== */
/* Health */
/* ============================== */

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

/* ============================== */
/* Tools */
/* ============================== */

const TOOLS = [
  {
    name: "getUserStory",
    description: "Get Rally user story"
  },
  {
    name: "getDefects"
  },
  {
    name: "getStoryTasks"
  }
];

app.get("/mcp/tools", (req, res) => {
  res.json({ tools: TOOLS });
});

/* ============================== */
/* EXECUTION */
/* ============================== */

app.post("/mcp/execute", async (req, res) => {
  const { tool, input } = req.body;

  try {
    if (tool === "getUserStory") {
      return res.json(await fetchUserStory(input.storyNumber));
    }
    if (tool === "getDefects") {
      return res.json(await fetchDefects(input.storyNumber));
    }
    if (tool === "getStoryTasks") {
      return res.json(await fetchTasks(input.storyNumber));
    }

    res.status(400).json({ error: "Unknown tool" });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================== */
/* RALLY FUNCTIONS */
/* ============================== */

async function fetchUserStory(storyNumber) {
  const query = `(FormattedID = "${storyNumber}")`;
  const endpoint =
    `${BASE_URL}/hierarchicalrequirement?query=${encodeURIComponent(query)}&fetch=FormattedID,Name,Description,ScheduleState`;

  const response = await axios.get(endpoint, {
    headers: { ZSESSIONID: API_KEY }
  });

  const story = response.data.QueryResult.Results[0];

  return {
    story: {
      FormattedID: story.FormattedID,
      Name: story.Name,
      Description: (story.Description || "").replace(/<[^>]+>/g, ""),
      ScheduleState: story.ScheduleState
    }
  };
}

async function fetchDefects(storyNumber) {
  const query = `(Requirement.FormattedID = "${storyNumber}")`;
  const endpoint =
    `${BASE_URL}/defect?query=${encodeURIComponent(query)}&fetch=FormattedID,Name,State`;

  const response = await axios.get(endpoint, {
    headers: { ZSESSIONID: API_KEY }
  });

  return { defects: response.data.QueryResult.Results };
}

async function fetchTasks(storyNumber) {
  const query = `(WorkProduct.FormattedID = "${storyNumber}")`;
  const endpoint =
    `${BASE_URL}/task?query=${encodeURIComponent(query)}&fetch=FormattedID,Name,State`;

  const response = await axios.get(endpoint, {
    headers: { ZSESSIONID: API_KEY }
  });

  return { tasks: response.data.QueryResult.Results };
}

/* ============================== */
/* START */
/* ============================== */

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
