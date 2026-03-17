"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFlow = runFlow;
async function runFlow(executable, flow, ...args) {
    const steps = flow
        .split("->")
        .map((step) => step.trim())
        .filter(Boolean);
    let current = executable;
    for (const step of steps) {
        const target = current;
        if (!target || typeof target[step] !== "function") {
            throw new Error(`Flow step '${step}' is not available in the current state.`);
        }
        current = await target[step](...args);
    }
    return current;
}
