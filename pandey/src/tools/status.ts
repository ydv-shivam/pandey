export const STATUS_TOOL = {
  name: "getPandeyStatus",
  description:
    "Check whether Pandey's cloud system is online. Use this when the user asks whether Pandey is online, running, or available.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function getPandeyStatus() {
  console.log("TOOL CALLED: getPandeyStatus");

  return {
    status: "online",
    message: "Pandey cloud system is online.",
  };
}