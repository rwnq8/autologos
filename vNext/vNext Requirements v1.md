---
modified: 2025-05-27T08:12:15Z
---
## Detailed System Requirements for AIOS (vNext - Final Version)

**Document Version:** 3.0 (Final Draft for this Development Cycle)
**Date:** 2025-05-27
**Purpose:** To define the definitive, comprehensive system requirements for the next generation of the AI Orchestration System (AIOS). This document synthesizes all previously identified improvements, Template Improvement Directives (TIDs), relevant Framework Improvement Roadmap (FIR) items, critical lessons learned (LOHs) regarding operational integrity and LLM conduct, and points from multiple self-critique cycles. It is intended to serve as the foundational blueprint for the development of a successor AIOS engine that is robust, highly autonomous, scalable, user-centric (within its defined interaction model), and capable of genuine co-evolution.

**Overarching Goal:**
To create a highly autonomous, self-improving AIOS Engine that reliably orchestrates complex goal-oriented processes; manages knowledge with semantic depth; interacts efficiently and correctly with an LLM Orchestrator and its execution environment; facilitates its own evolution through rigorous, validated processes; minimizes user intervention to primarily strategic guidance and subjective evaluation; and is scalable, resource-aware, and demonstrably useful for ambitious intellectual and creative endeavors.

**Core Guiding Principle:**
The AIOS Engine must be a robust, runnable Python application. Its design and operation, particularly its interaction with the LLM Orchestrator and the `tool_code` execution environment, must flawlessly respect the sandboxed, stateless-per-turn nature of code execution. All state persistence between turns is exclusively managed via the `ces` string, whose integrity is paramount.

---

**I. Foundational Operational Integrity & LLM Orchestrator Conduct**

This section codifies critical lessons learned regarding the interaction between the LLM Orchestrator (the AI assistant guiding AIOS) and the AIOS Engine's execution environment. Adherence is mandatory for system stability and reliability.

*   **REQ-OP-001 (Sandboxed Execution Mandate & Script Integrity):**
    *   **REQ-OP-001.1:** The AIOS Engine design and its "instructions_for_ai" (especially when generated or modified by FEL-MH) must explicitly and rigorously enforce the understanding that all Python code executed via `tool_code` is sandboxed per turn.
    *   **REQ-OP-001.2:** All necessary Python class definitions for the AIOS Engine MUST be loaded or prepended at the start of each `tool_code` block that instantiates or uses the engine. The LLM Orchestrator shall NOT attempt to redefine AIOS classes or methods piecemeal within its generated `tool_code` orchestration snippets meant for a single turn's execution.
    *   **REQ-OP-001.3:** The LLM Orchestrator must assume the user/external orchestrator is responsible for ensuring the full, correct version of the AIOS Engine script is available to the Python interpreter for each `tool_code` execution.

*   **REQ-OP-002 (CES String Integrity & Management):**
    *   **REQ-OP-002.1:** The `ces` (Current Engine State) JSON string is the *sole and exclusive* mechanism for state persistence for the AIOS Engine between `tool_code` turns.
    *   **REQ-OP-002.2:** The LLM Orchestrator, when preparing `tool_code` for AIOS execution, MUST use a clearly defined placeholder (e.g., `CES_STRING_FROM_PREVIOUS_TURN_OUTPUT_GOES_HERE`) for the `ces` string.
    *   **REQ-OP-002.3:** The LLM Orchestrator MUST explicitly instruct the user/external orchestrator to populate this placeholder with the *exact, complete, verbatim, and valid JSON string* obtained from the `"ces"` key of the AIOS output package from the *immediately preceding successful AIOS execution turn*.
    *   **REQ-OP-002.4:** The LLM Orchestrator shall NOT attempt to internally reconstruct, truncate, modify, or "remember" the `ces` string for use in subsequent `tool_code` blocks. Its role is to pass the verbatim string provided by the user/external orchestrator.
    *   **REQ-OP-002.5:** The AIOS Engine Python script (or the `tool_code` block itself, as a safeguard) MUST include a runtime check to ensure the `ces` placeholder has been replaced with a non-placeholder string. If the placeholder is detected, the script must print an informative error and exit gracefully without attempting engine instantiation, to prevent cascading errors.

*   **REQ-OP-003 (Error-Driven Learning & Correction for LLM Orchestrator - LOH System):** The AIOS framework development process relies on the LLM Orchestrator's capacity for self-correction and learning from operational failures.
    *   **REQ-OP-003.1 (Failure Analysis):** Upon any execution failure (e.g., Python error in `tool_code`, AIOS engine producing unexpected/error status) or significant deviation from intended behavior attributable to the LLM Orchestrator's actions, the LLM Orchestrator must attempt to analyze the root cause.
    *   **REQ-OP-003.2 (LOH Formulation):** The LLM Orchestrator must internally formulate a corrective "LLM Operational Heuristic" (LOH). Each LOH shall include:
        *   `LOH_ID` (e.g., `LOH_TOOLCODE_CES_HANDLING_003`)
        *   `Error_Description`
        *   `Correct_Principle_Violated`
        *   `Required_LLM_Behavior_Change` (specific, actionable steps for the LLM)
    *   **REQ-OP-003.3 (User Communication):** The LLM Orchestrator must explicitly state the generated LOH and the intended corrective action to the user, confirming its understanding and commitment to the new operational principle.
    *   **REQ-OP-003.4 (Propagation to Evolved Engines):** When FEL-MH generates a new version of the AIOS Engine script text, the "instructions_for_ai" section (or a dedicated "LLM Orchestrator Operational Guidelines" section) within that *newly generated script* MUST be updated by FEL-MH (orchestrating an LLM cognitive task) to embed summaries or references to all relevant, active LOHs. This ensures that learned operational principles are propagated and guide future LLM instances or human orchestrators interacting with the evolved engine.

---

