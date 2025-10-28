/**
 * Sample workflow definition for HITL weather/travel plan flow
 */
const hitlWeatherTravelWorkflow = {
  name: "Weather + Travel Plan HITL Workflow",
  description: "Fetch weather, human review, LLM travel plan, human review, output or loop.",
  category: "custom",
  nodes: [
    {
      id: "start-1",
      type: "start",
      position: { x: 100, y: 100 },
      data: { label: "Start" }
    },
    {
      id: "fetch-weather",
      type: "tool",
      position: { x: 300, y: 100 },
      data: {
        label: "Fetch Weather",
        toolName: "fetchWeather",
        parameters: {
          url: "https://api.openweathermap.org/data/2.5/forecast?q=New%20Delhi&units=metric&appid=YOUR_API_KEY",
          method: "GET"
        }
      }
    },
    {
      id: "human-review-1",
      type: "humanReview",
      position: { x: 500, y: 100 },
      data: {
        label: "Review Weather",
        description: "Review weather data and approve/reject.",
        actions: [
          { id: "proceed", label: "Proceed" },
          { id: "reject", label: "Reject", loopBackNodeId: "fetch-weather" }
        ]
      }
    },
    {
      id: "llm-plan",
      type: "llm",
      position: { x: 700, y: 100 },
      data: {
        label: "Create Travel Plan",
        prompt: "Create a travel plan for New Delhi based on the following weather data: {{weatherData}}"
      }
    },
    {
      id: "human-review-2",
      type: "humanReview",
      position: { x: 900, y: 100 },
      data: {
        label: "Review Travel Plan",
        description: "Review travel plan and approve/reject.",
        actions: [
          { id: "proceed", label: "Proceed" },
          { id: "reject", label: "Reject", loopBackNodeId: "llm-plan" }
        ]
      }
    },
    {
      id: "output",
      type: "tool",
      position: { x: 1100, y: 100 },
      data: {
        label: "Output Travel Plan",
        toolName: "printToConsole"
      }
    },
    {
      id: "end-1",
      type: "end",
      position: { x: 1300, y: 100 },
      data: { label: "End" }
    }
  ],
  edges: [
    { id: "e1", source: "start-1", target: "fetch-weather", type: "default" },
    { id: "e2", source: "fetch-weather", target: "human-review-1", type: "default" },
    { id: "e3", source: "human-review-1", target: "llm-plan", type: "default", condition: "proceed" },
    { id: "e4", source: "human-review-1", target: "fetch-weather", type: "default", condition: "reject" },
    { id: "e5", source: "llm-plan", target: "human-review-2", type: "default" },
    { id: "e6", source: "human-review-2", target: "output", type: "default", condition: "proceed" },
    { id: "e7", source: "human-review-2", target: "llm-plan", type: "default", condition: "reject" },
    { id: "e8", source: "output", target: "end-1", type: "default" }
  ],
  tags: ["hitl", "weather", "travel", "review"]
};

module.exports = hitlWeatherTravelWorkflow;