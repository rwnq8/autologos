---
modified: 2025-05-27T08:21:38Z
---

## Detailed System Requirements for AIOS (vNext - Performance-Focused)

**Document Version:** 2.0 (Performance-Focused Clean Slate)
**Date:** 2025-05-27
**Purpose:** To define the performance-based and functional system requirements for the next generation of the AI Orchestration System (AIOS). This document prioritizes observable outcomes, operational efficiency, and essential capabilities, leaving implementation details flexible where possible, to achieve a highly performant and effective engine. It incorporates lessons learned regarding operational integrity.

**Overarching Goal:**
To create a highly autonomous, self-improving AIOS Engine that is **demonstrably fast and efficient** in its turn-by-turn operation within typical LLM chat environments (e.g., Google AI Studio). It must reliably orchestrate complex processes, manage knowledge, interact efficiently with an LLM Orchestrator, and facilitate its own evolution, minimizing user-perceived latency and maximizing productive throughput.

**Core Performance Principle:**
The AIOS Engine's design and implementation must prioritize **minimal per-turn execution overhead.** This includes minimizing Python script parsing time, optimizing state (de)serialization, and ensuring efficient internal logic.

---

**I. Foundational Operational Integrity & Execution Environment Compliance**
*(This section remains critical as it defines non-negotiable operational constraints)*

*   **REQ-OP-001 (Sandboxed Execution Compliance):** The AIOS Engine's Python execution model MUST ensure that all necessary code definitions are available to the interpreter within each sandboxed `tool_code` turn.
    *   **REQ-OP-001.1:** The primary method for achieving this will be for the LLM Orchestrator to instruct the user/external orchestrator to prepend the complete, current, and minified AIOS Engine script to any `tool_code` block that instantiates or operates the engine.
*   **REQ-OP-002 (CES Integrity & Management):**
    *   **REQ-OP-002.1:** The `ces` (Current Engine State) JSON string is the sole mechanism for AIOS Engine state persistence between `tool_code` turns.
    *   **REQ-OP-002.2:** The LLM Orchestrator MUST instruct the user/external orchestrator to use the exact, complete, and valid JSON `ces` string from the immediately preceding successful AIOS output when preparing a `tool_code` block for AIOS execution. A placeholder and explicit instructions for its replacement must be provided by the LLM.
    *   **REQ-OP-002.3:** The AIOS Engine script (or the `tool_code` block) MUST include a runtime check for the `ces` placeholder and error gracefully if it has not been replaced.
*   **REQ-OP-003 (LLM Orchestrator Error-Driven Learning - LOH System):** The LLM Orchestrator component of the AIOS framework MUST implement a mechanism for learning from its operational failures (e.g., generating faulty `tool_code`, mismanaging `ces`) by formulating internal "LLM Operational Heuristics" (LOHs) and ensuring these LOHs guide future actions and are incorporated into the "instructions_for_ai" of evolved Engine scripts.

**II. Core Engine Performance & State Management**

*   **REQ-PERF-001 (Minimized Turn Latency):** The AIOS Engine's typical interactive turn time (Python script execution + state deserialization/serialization, excluding LLM cognitive task time) within the target environment (e.g., Google AI Studio) MUST be minimized.
    *   **REQ-PERF-001.1 (Target Metric):** (Future) Establish a target benchmark for this latency (e.g., < X seconds for a standard operation).
*   **REQ-PERF-002 (Efficient State Handling):**
    *   **REQ-PERF-002.1:** The `export_state()` method MUST produce a compact JSON `ces` string efficiently.
    *   **REQ-PERF-002.2:** The `import_state(ces_string)` method MUST deserialize the `ces` and restore engine state efficiently.
*   **REQ-PERF-003 (Code Minification):** The AIOS Engine Python script MUST be aggressively minified to reduce parsing time and overall size, while maintaining functional equivalence and syntactic validity.
    *   **REQ-PERF-003.1:** FEL-MH, when generating new engine versions, MUST produce minified code according to established guidelines (e.g., `TID_Minification_Guide_for_AIOS_Engine.md`).
*   **REQ-PERF-004 (Selective Loading/Execution - *Key Performance Requirement*):**
    *   **REQ-PERF-004.1:** The AIOS Engine architecture MUST support a mechanism that minimizes the amount of Python code parsed and executed per turn. Ideally, only the Kernel and the currently active Meta-Handler (and essential shared utilities) should be active.
    *   **REQ-PERF-004.2:** This could be achieved via a modular design where MHs are separate, dynamically loadable components/files, or through a single-file engine with highly optimized conditional execution paths that effectively bypass inactive MH code. The chosen method must demonstrably reduce per-turn overhead compared to a monolithic parse-and-execute model.
    *   *(Non-prescriptive note: This implies a departure from simply prepending one massive script if a more performant loading strategy for a modular system can be achieved within the `tool_code` environment, e.g., by having the LLM output only the core loader + necessary module for that turn, assuming modules are stored/accessible as separate file entities.)*

**III. Core Functional Capabilities (Kernel & Meta-Handlers)**

*   **REQ-FUNC-KER-001 (Kernel Orchestration):** The Kernel MUST reliably:
    *   Initialize AIOS and manage startup sequences.
    *   Interpret user directives to select appropriate MHs or system actions.
    *   Dispatch to MHs with correct context (CCO, inputs).
    *   Process MH results, update CCO, and determine subsequent actions (next MH or AUI).
    *   Handle system commands (STATUS, HELP, TEST, TERMINATE with state export).
    *   Provide clear PUM messages to the user regarding AIOS state and actions.
*   **REQ-FUNC-MH-001 (General MH Capabilities):** All core MHs (IFE, PDF, PLAN, TDE, CAG, SEL, KAU, MRO, FEL) MUST be functionally implemented to achieve their chartered purposes. They must:
    *   Operate on and update the CCO.
    *   Utilize Cognitive Wrappers for LLM interactions.
    *   Manage their internal state correctly within the `ces`.
    *   Log their operations.
    *   Handle errors gracefully.
*   **REQ-FUNC-IFE-001 (Idea Formalization):** IFE-MH MUST transform a user's initial idea into a formalized Project Core Essence and a structured initial CCO.
*   **REQ-FUNC-PDF-001 (Project Definition):** PDF-MH MUST take a formalized idea from IFE, facilitate user clarification on scope/constraints/deliverables, and generate a concise Project Definition/Charter summary, updating the CCO accordingly.
*   **REQ-FUNC-PLN-001 (Planning):** PLAN-MH MUST take a defined project from PDF and generate a structured, actionable project plan (phases, tasks with details like dependencies, suggested execution methods, rhetorical goals) within the CCO.
*   **REQ-FUNC-TDE-001 (Task Execution - TID_TDE_FUNCTIONAL_V1):** TDE-MH MUST iterate through the CCO plan, dispatching tasks to appropriate sub-MHs (e.g., CAG, SEL) or orchestrating direct LLM cognitive tasks, and update task statuses in the CCO. It must handle sub-MH completion and resume plan execution.
*   **REQ-FUNC-CAG-001 (Content Generation - TID_ASO_META_001, TID_ASO_META_006):** CAG-MH MUST generate content segments based on CCO context and task specifications (including rhetorical goals), proactively integrating CCO conceptual anchors, and managing draft versions.
*   **REQ-FUNC-MRO-001 (Output Refinement - TID_ASO_META_002, TID_ASO_META_005, FIR_009):** MRO-MH MUST perform iterative self-critique and refinement focusing on Novelty, Transformative Value, Impact, Information Density, and Conciseness, using quantitative proxies where feasible.
*   **REQ-FUNC-SEL-001 (Solution/Style Exploration):** SEL-MH MUST be able to orchestrate the generation and evaluation of solution options for defined problems and (future) learn/apply stylistic preferences.
*   **REQ-FUNC-KAU-001 (Knowledge Update - REQ-KAU-002, REQ-KAU-003):** KAU-MH MUST extract learnings (LHR/LHL) from operations, update CCO KAs, and (future) attempt insight generation and support global heuristic synthesis.
*   **REQ-FUNC-FEL-001 (Framework Evolution - REQ-FEL-001.1, REQ-FEL-002, REQ-FEL-003):** FEL-MH MUST:
    *   Process TIDs to generate design documents or conceptual code changes for AIOS.
    *   When generating new AIOS Engine script text, ensure "instructions_for_ai" embed relevant LOHs.
    *   Produce minified, functionally equivalent code (orchestrating LLM for chunks if necessary).
    *   Incorporate safety protocols (conceptual review/sandboxed testing) for generated code.

**IV. Central Conceptual Object (CCO) & Data Management**

*   **REQ-CCO-001 (Schema and Integrity):** The CCO MUST adhere to a defined schema (`AIOS_CCO_Schema_vNext`). The engine must ensure data integrity.
    *   **REQ-CCO-001.1 (Schema Evolution - TID_CCO_SCHEMA_UPDATE_PLANNING_V1, FIR_META_002):** The CCO schema must evolve to support new MH functionalities (e.g., `project_plan_j`). FEL-MH must manage these schema updates within the engine definition.
    *   **REQ-CCO-001.2 (Schema Version Management - Perspective 1 Critique):** AIOS must implement a mechanism to handle CCOs created with older schema versions (e.g., migration path, graceful handling, or informative error).
*   **REQ-CCO-002 (Comprehensive Logging):** The CCO's `op_log_j` MUST record all significant engine operations, MH transitions, LLM requests, and CCO modifications.
*   **REQ-CCO-003 (Knowledge Artifacts):** The CCO MUST effectively store and allow retrieval of diverse KAs (LHR, LHL, plans, definitions, anchors).
*   **REQ-CCO-004 (Scalability - Perspective 2 Critique):** CCO data structures and access methods should be designed considering potential for large data volumes, aiming for efficient processing.

**V. User Interaction & Experience (Minimized but Critical Role)**

*   **REQ-UIX-001 (Clarity of Interaction):** All PUMs and prompts for user input MUST be clear, concise, and contextually relevant.
*   **REQ-UIX-002 (Decision Support - Perspective 2 Critique):** When user input is required for strategic decisions or subjective evaluations, AIOS MUST provide well-structured summaries of context, options, and implications.
*   **REQ-UIX-003 (Transparency of Reasoning - Perspective 2 Critique, TID_ASO_META_003):** AIOS (Kernel & MHs) MUST articulate its interpretation of user intent (Reflective Inquiry) and provide high-level traceability for its actions through logs and PUMs.
*   **REQ-UIX-004 (Minimized Intervention):** AIOS MHs MUST maximize autonomy, only prompting the user for input that cannot be derived from the CCO, reasonably inferred via a cognitive task, or when internal confidence scores for an autonomous decision fall below a defined threshold.

**VI. Testing, Validation, and Quality Assurance (NEW SECTION - Perspective 1 Self-Critique)**

*   **REQ-TEST-001 (Unit Testability):** Core Engine Python functions and methods within MHs SHOULD be designed to be conceptually unit-testable (i.e., their logic should be clear enough that unit tests *could* be written for them).
*   **REQ-TEST-002 (Integration Test Scenarios):** Define conceptual test scenarios for validating MH-to-MH handovers and Kernel-MH interactions (e.g., IFE output correctly processed by PDF).
*   **REQ-TEST-003 (End-to-End Functional Scenarios):** Define a suite of representative end-to-end project scenarios (e.g., "draft a short research proposal from idea to plan") that AIOS must be able to complete successfully, demonstrating the integrated functionality of core MHs.
*   **REQ-TEST-004 (Regression Testing for FEL-MH):** Before FEL-MH finalizes a new engine version, a conceptual regression test suite (based on REQ-TEST-003 scenarios) MUST be "executed" (simulated if necessary by the LLM Orchestrator analyzing the conceptual code changes against test case logic) to identify potential regressions. The results of this conceptual regression testing must be part of the FEL output.
*   **REQ-TEST-005 (Performance Benchmarking):** Establish baseline performance metrics for key operations (e.g., `ces` handling, typical MH step execution time excluding LLM calls) and track these across engine versions.

---

This "Performance-Focused" requirements document attempts to be less prescriptive about *how* internal components are specifically coded (beyond the Python class structure for the sandboxed environment) and more focused on *what functional and performance outcomes* are necessary. It also strongly emphasizes the operational integrity lessons.

Is this version more aligned with your directive for a performance-based, clean-slate approach, while still capturing all critical functionalities and learnings?