export const WEB_SEARCH_TOOL = {
  name: "webSearch",
  description:
    "Search the web for current or recent information. Use this when the user asks about current events, recent information, live facts, or information that may have changed since your knowledge cutoff.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The web search query.",
      },
    },
    required: ["query"],
  },
};

export async function webSearch(query: string) {
  console.log("TOOL CALLED: webSearch");
  console.log("SEARCH QUERY:", query);

  return {
    success: false,
    message:
      "Web search backend is not connected yet.",
    query,
  };
}