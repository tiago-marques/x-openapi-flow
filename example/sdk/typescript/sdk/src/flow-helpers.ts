export interface FlowExecutable {
  [methodName: string]: (...args: unknown[]) => Promise<unknown>;
}

export async function runFlow(
  executable: FlowExecutable,
  flow: string,
  ...args: unknown[]
): Promise<unknown> {
  const steps = flow
    .split("->")
    .map((step) => step.trim())
    .filter(Boolean);

  let current: unknown = executable;
  for (const step of steps) {
    const target = current as FlowExecutable;
    if (!target || typeof target[step] !== "function") {
      throw new Error(`Flow step '${step}' is not available in the current state.`);
    }

    current = await target[step](...args);
  }

  return current;
}
