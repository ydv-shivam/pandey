export const CALCULATOR_TOOL = {
  name: "calculate",
  description:
    "Calculate a mathematical expression. Use this for arithmetic such as addition, subtraction, multiplication, division, percentages, powers, and parentheses.",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description:
          "A mathematical expression to calculate, for example 125 * 48 or (100 + 50) / 3.",
      },
    },
    required: ["expression"],
  },
};

export async function calculate(expression: string) {
  console.log("TOOL CALLED: calculate");
  console.log("CALCULATION:", expression);

  try {
    if (!/^[0-9+\-*/().%\s^]+$/.test(expression)) {
      return {
        success: false,
        error: "Invalid mathematical expression.",
      };
    }

    const safeExpression = expression.replace(/\^/g, "**");

    const result = Function(
      `"use strict"; return (${safeExpression})`,
    )();

    if (
      typeof result !== "number" ||
      !Number.isFinite(result)
    ) {
      return {
        success: false,
        error: "Calculation produced an invalid result.",
      };
    }

    return {
      success: true,
      expression,
      result,
    };
  } catch {
    return {
      success: false,
      error: "Could not calculate that expression.",
    };
  }
}
