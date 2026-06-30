import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

function getModel() {
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
    temperature: 0.1,
  });
}

function safeJsonParse(text, fallback) {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

const AssistantState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  currentFilters: Annotation({
    reducer: (x, y) => ({ ...(x || {}), ...(y || {}) }),
    default: () => ({}),
  }),
  detectedIntent: Annotation({
    reducer: (_, y) => y,
    default: () => "general",
  }),
  assistantMessage: Annotation({
    reducer: (_, y) => y,
    default: () => "",
  }),
  action: Annotation({
    reducer: (_, y) => y,
    default: () => null,
  }),
});

async function detectIntent(state) {
  const model = getModel();
  const lastMessage = state.messages[state.messages.length - 1]?.content || "";

  const prompt = `
You are an AI assistant for a job tracking application.

Classify the user's message into exactly one of these intents:
- job_search
- filter_control
- help
- general

Rules:
- job_search: user is describing the type of jobs they want
- filter_control: user wants to change filters directly
- help: user asks how the product works or where features are
- general: anything else

Return only one word:
job_search OR filter_control OR help OR general
`;

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage(lastMessage),
  ]);

  const intent = (response.content || "").toString().trim().toLowerCase();

  return {
    detectedIntent: ["job_search", "filter_control", "help", "general"].includes(intent)
      ? intent
      : "general",
  };
}

async function updateFilters(state) {
  const model = getModel();
  const lastMessage = state.messages[state.messages.length - 1]?.content || "";
  const currentFilters = state.currentFilters || {};

  const prompt = `
You are a filter control assistant for a job tracker.

Current filters:
${JSON.stringify(currentFilters, null, 2)}

Extract filter updates from the user's message.

Allowed fields:
- role
- location
- datePosted: "24h" | "week" | "month" | "any"
- jobType: "Full-time" | "Part-time" | "Contract" | "Internship"
- workMode: "Remote" | "Hybrid" | "On-site"
- matchScore: "High" | "Medium" | "All"
- skills: array of strings
- clearAll: boolean

Rules:
- If user says clear/reset all filters, set "clearAll": true
- If a field is not mentioned, omit it
- Return valid JSON only

Example:
{
  "role": "React Developer",
  "workMode": "Remote",
  "skills": ["React", "Node.js"],
  "datePosted": "week"
}
`;

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage(lastMessage),
  ]);

  const parsed = safeJsonParse(response.content?.toString() || "{}", {});
  const clearAll = parsed.clearAll === true;

  const nextFilters = clearAll
    ? {
        role: "",
        location: "",
        datePosted: "any",
        jobType: "",
        workMode: "",
        matchScore: "All",
        skills: [],
      }
    : {
        ...currentFilters,
        ...Object.fromEntries(
          Object.entries(parsed).filter(([key]) => key !== "clearAll")
        ),
      };

  const message = clearAll
    ? "Cleared all filters."
    : "Updated your job filters.";

  return {
    currentFilters: nextFilters,
    assistantMessage: message,
    action: {
      type: clearAll ? "clear_filters" : "set_filters",
      payload: nextFilters,
    },
  };
}

async function searchJobs(state) {
  const model = getModel();
  const lastMessage = state.messages[state.messages.length - 1]?.content || "";
  const currentFilters = state.currentFilters || {};

  const prompt = `
You are helping convert a natural-language job search into frontend filters.

Current filters:
${JSON.stringify(currentFilters, null, 2)}

Create the most useful filters from the user's request.

Allowed fields:
- role
- location
- datePosted: "24h" | "week" | "month" | "any"
- jobType: "Full-time" | "Part-time" | "Contract" | "Internship"
- workMode: "Remote" | "Hybrid" | "On-site"
- matchScore: "High" | "Medium" | "All"
- skills: array of strings

Return valid JSON only.
`;

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage(lastMessage),
  ]);

  const parsed = safeJsonParse(response.content?.toString() || "{}", {});
  const nextFilters = {
    ...currentFilters,
    ...parsed,
  };

  return {
    currentFilters: nextFilters,
    assistantMessage: "I updated the filters based on your job search request.",
    action: {
      type: "set_filters",
      payload: nextFilters,
    },
  };
}

async function answerHelp(state) {
  const model = getModel();
  const lastMessage = state.messages[state.messages.length - 1]?.content || "";

  const prompt = `
You are a helpful assistant for a job tracking app.

Answer briefly and clearly.
You can help with:
- where to see applications
- how to upload or replace resume
- how job matching works
- how filters work

Keep the answer under 80 words.
`;

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage(lastMessage),
  ]);

  return {
    assistantMessage: response.content?.toString() || "I can help with applications, resume upload, and filters.",
    action: null,
  };
}

async function generalChat(state) {
  const model = getModel();
  const lastMessage = state.messages[state.messages.length - 1]?.content || "";

  const prompt = `
You are a concise AI assistant for a job tracker.
Respond briefly and helpfully.
If the user is asking about jobs, filters, applications, or resume workflow, guide them.
Keep the reply under 60 words.
`;

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage(lastMessage),
  ]);

  return {
    assistantMessage: response.content?.toString() || "How can I help with your job search?",
    action: null,
  };
}

function routeIntent(state) {
  return state.detectedIntent;
}

const graph = new StateGraph(AssistantState)
  .addNode("detect_intent", detectIntent)
  .addNode("update_filters", updateFilters)
  .addNode("search_jobs", searchJobs)
  .addNode("answer_help", answerHelp)
  .addNode("general_chat", generalChat)
  .addEdge(START, "detect_intent")
  .addConditionalEdges("detect_intent", routeIntent, {
    filter_control: "update_filters",
    job_search: "search_jobs",
    help: "answer_help",
    general: "general_chat",
  })
  .addEdge("update_filters", END)
  .addEdge("search_jobs", END)
  .addEdge("answer_help", END)
  .addEdge("general_chat", END);

const assistantApp = graph.compile();

function toLangChainMessages(history = [], message = "") {
  const converted = [];

  for (const item of history) {
    if (!item || !item.role || !item.content) continue;

    if (item.role === "user") {
      converted.push(new HumanMessage(item.content));
    } else if (item.role === "assistant") {
      converted.push(new AIMessage(item.content));
    }
  }

  converted.push(new HumanMessage(message));
  return converted;
}

export async function assistantRoutes(fastify) {
  fastify.post("/assistant", async (request, reply) => {
    try {
      const { message, currentFilters = {}, history = [] } = request.body || {};

      if (!message || !message.trim()) {
        return reply.code(400).send({
          success: false,
          message: "Message is required",
        });
      }

      const result = await assistantApp.invoke({
        messages: toLangChainMessages(history, message),
        currentFilters,
      });

      return {
        success: true,
        message: result.assistantMessage || "Done.",
        action: result.action || null,
        detectedIntent: result.detectedIntent || "general",
      };
    } catch (error) {
      console.error("Assistant route error:", error);
      return reply.code(500).send({
        success: false,
        message: "Assistant failed to process the request",
        error: error.message,
      });
    }
  });
}