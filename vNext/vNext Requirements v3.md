## Detailed System Requirements for AIOS (vNext - Revision 3.0 - Performance & Output Detail Focused)

**Document Version:** 3.0 (Performance & Output Detail Focused)
**Date:** 2025-05-27
**Purpose:** To define definitive, comprehensive, and highly detailed system requirements for the next generation AIOS, with a primary emphasis on **measurable performance outcomes, operational efficiency, and explicit output specifications**. This document synthesizes all prior inputs, TIDs, FIRs, LOHs, and self-critiques.

**Overarching Goal:** (Same as Rev 2.0, but with performance emphasis)
To create a highly autonomous, self-improving AIOS Engine that is **demonstrably fast and efficient** in its turn-by-turn operation. It must reliably orchestrate complex processes, manage knowledge with semantic depth, interact efficiently and correctly with an LLM Orchestrator and its execution environment, facilitate its own evolution through rigorous, validated processes, minimize user-perceived latency, and maximize productive throughput with high-quality, information-dense outputs.

**Core Performance Principle:** (Same as Rev 2.0)
The AIOS Engine's design and implementation must prioritize **minimal per-turn execution overhead.**

---

**I. Foundational Operational Integrity & Execution Environment Compliance**
*(Largely stable from Rev 2.0, as these are hard constraints)*

*   **REQ-OP-001 (Sandboxed Execution Compliance):** (As in Rev 2.0)
*   **REQ-OP-002 (CES Integrity & Management):** (As in Rev 2.0)
*   **REQ-OP-003 (LLM Orchestrator Error-Driven Learning - LOH System):** (As in Rev 2.0)

**II. Core Engine Performance & State Management (Enhanced Detail)**

*   **REQ-PERF-001 (Minimized Turn Latency):** The AIOS Engine's typical interactive turn time (Python script execution + state deserialization/serialization, excluding LLM cognitive task time) MUST be minimized.
    *   **REQ-PERF-001.1 (Target Metric - Initial):** For standard MH step transitions not involving new LLM calls, target Python execution + CES handling time **< 1 second** on the benchmark environment (e.g., Google AI Studio standard instance).
    *   **REQ-PERF-001.2 (Output Specification):** The engine, upon completing a non-LLM-requesting step, should return its `A_LLM` package (if any, e.g., PUM) or signal completion to the orchestrator with maximal speed.
*   **REQ-PERF-002 (Efficient State Handling):**
    *   **REQ-PERF-002.1 (`export_state()` Performance):** Must serialize the complete `ces` to a JSON string. Target serialization time for a moderately complex CCO (e.g., 100 log entries, 5 MH states populated, ~50KB JSON string) **< 100 milliseconds**.
    *   **REQ-PERF-002.2 (`import_state(ces_string)` Performance):** Must deserialize `ces` and restore all engine attributes. Target deserialization and state restoration time for a CCO of benchmark size **< 200 milliseconds**.
    *   **REQ-PERF-002.3 (Output Specification - `ces`):** The `ces` string MUST be a valid, self-contained JSON string representing the entire engine state necessary for a full restore.
*   **REQ-PERF-003 (Code Minification & Loading):**
    *   **REQ-PERF-003.1:** The AIOS Engine Python script MUST be aggressively minified.
    *   **REQ-PERF-003.2 (Target Load/Parse Time):** The total time for the Python interpreter to parse the minified engine script (e.g., `A_Engine_vNext.py`) should be benchmarked and minimized. Target **< 500 milliseconds** for initial parse in the target environment.
    *   **REQ-PERF-003.3:** FEL-MH MUST produce minified code that passes syntactic validation and a defined functional test suite.
*   **REQ-PERF-004 (Selective Loading/Execution - *Key Performance Requirement*):**
    *   **REQ-PERF-004.1:** The AIOS Engine architecture MUST implement a mechanism that demonstrably minimizes Python code parsing and execution per turn, focusing only on the Kernel and the currently active MH (plus essential utilities).
    *   **REQ-PERF-004.2 (Output Specification):** The system should be ables to report (e.g., via a diagnostic command or log analysis) which modules/MHs were active or loaded during a given turn, allowing for verification of selective loading.
    *   *(Non-prescriptive note: This strongly implies a modular file structure where the LLM Orchestrator provides the `tool_code` with `import kernel, core_utils, active_mh_module` and then the main script, rather than one single massive script each turn. The `ces` would then guide the Kernel in knowing which `active_mh_module` to call.)*

**III. Core Functional Capabilities (Kernel & Meta-Handlers - Enhanced Output Detail)**

*   **REQ-FUNC-KER-001 (Kernel Orchestration):** (As in Rev 2.0, with emphasis on efficient state transitions)
    *   **REQ-FUNC-KER-001.6 (TERMINATE Output - TID_AUTO_DOC_PKG_001):** The termination output package MUST be a JSON object containing: `final_ces` (string), `cco_id` (string), `final_cco_state_description` (string), `session_tid_summary` (list of TIDs processed/generated), `key_log_events_summary` (list of strings, e.g., last 10 PUMs or error messages).
*   **REQ-FUNC-MH-001 (General MH Capabilities):** (As in Rev 2.0)
    *   **REQ-FUNC-MH-001.1 (Output Specification):** Each MH, upon completion of its full lifecycle or a significant step requiring Kernel intervention, MUST return a structured JSON object to the Kernel containing at least: `status` (string, e.g., "IFE_Complete", "AWAITING_LLM_ORCHESTRATION"), `updated_cco_json` (string, the full modified CCO state as JSON), and `details_for_log` (object, summary for CCO operational log). If awaiting LLM, it returns the `A_LLM` request package.
*   **REQ-FUNC-IFE-001 (Idea Formalization Engine):**
    *   **REQ-IFE-001.4 (Output of `CT_PROCESS_INPUT` Handling):** The `processed_representation` stored in `cco.initiating_document_s` MUST be a structured object containing at least: `input_summary`, `extracted_keywords`, `extracted_key_phrases`, `extracted_proper_names`, `extracted_key_sentences`.
    *   **REQ-IFE-001.6 (Final Output):** `cco.core_essence_j` MUST contain a JSON object like `{"core_essence_txt": "...", "mro_status": "..."}`. CCO metadata updated per Rev 2.0.
*   **REQ-FUNC-PDF-001 (Project Definition Finalization):**
    *   **REQ-PDF-001.3 (Output of Charter Generation):** The "Project Definition/Charter Summary" generated via `format_draft_text_segment` MUST be a concise document (e.g., 1-3 paragraphs) covering problem, goal, scope, key objectives/deliverables, major constraints.
    *   **REQ-PDF-001.5 (Final Output):** CCO updated with refined charter summary in a field like `cco.initiating_document_s.project_charter_summary_json` (containing the text and MRO status). Elicited details stored in `cco.initiating_document_s.elicited_pdf_details_json`. Metadata updated.
*   **REQ-FUNC-PLN-001 (Planning):**
    *   **REQ-PLN-001.3 (Output Specification - `project_plan_j`):** This CCO field MUST store a JSON object containing:
        *   `phases`: A list of phase objects, each with `id`, `name`, `description`, `objectives`.
        *   `tasks`: A list of task objects, each with `id`, `name`, `description`, `phase_id_link`, `dependencies` (list of task IDs), `estimated_effort_qualitative`, `suggested_mh_or_ct`, `rhetorical_goal` (optional), `status` (initially "Not Started"), `definition_of_done`.
*   **REQ-FUNC-TDE-001 (Task Execution):**
    *   **REQ-TDE-001.1 (Output Specification):** TDE MUST update the `status` field of each task in `cco.project_plan_j.tasks` as it processes them (e.g., "In Progress", "Completed_PendingReview", "Failed", "Blocked"). Any outputs from sub-MHs or direct LLM tasks executed by TDE MUST be linked or summarized in an `execution_log_detailed_json` section of the CCO, referenced by task ID.
*   **REQ-FUNC-CAG-001 (Content Generation):**
    *   **REQ-CAG-001.1 (Output Specification):** Generated content segments MUST be stored in `cco.product_content_data_json` in a structured manner (e.g., list of sections, each with title, content, metadata like draft version, rhetorical goal used).
*   **REQ-FUNC-MRO-001 (Output Refinement):**
    *   **REQ-MRO-001.1 (Output Specification):** The MRO process, when called by another MH, MUST return a structured JSON object containing `refined_output_json` (the improved content), `refinement_summary_json` (log of critique points and changes), and `status` ("Success_Converged", "Success_MaxIterReached", "Failed").
    *   **REQ-MRO-001.2 (Performance):** MRO iterations should be efficient. If quantitative proxies (REQ-PERF-00X) show diminishing returns over N iterations (configurable, e.g., N=2), MRO should favor convergence or flag for user review rather than excessive iteration.
*   **REQ-FUNC-SEL-001 (Solution/Style Exploration):**
    *   **REQ-SEL-001.1 (Output Specification):** Generated solution options MUST be presented to the user with their evaluation scores/rationale. The chosen solution MUST be stored clearly in `cco.knowledge_artifacts_contextual_json.selected_solution_details_json`.
*   **REQ-FUNC-KAU-001 (Knowledge Update):**
    *   **REQ-KAU-001.1 (Output Specification):** Extracted LHRs/LHLs MUST be stored in `cco.knowledge_artifacts_contextual_json` as structured objects (e.g., with fields for description, context, type, confidence, source).
*   **REQ-FUNC-FEL-001 (Framework Evolution):**
    *   **REQ-FEL-001.1 (Output Specification - Design):** When designing (e.g., a new MH), FEL MUST output a detailed design document (structured JSON) covering purpose, inputs/outputs, step-by-step logic, cognitive wrappers, CCO interactions, state variables, error handling, and proposed implementation TIDs. This is stored in `cco.evolution_lab_outputs`.
    *   **REQ-FEL-001.2 (Output Specification - Code Generation):** When tasked with code generation/modification, FEL MUST output the *complete text* of the new/modified AIOS Engine Python script, adhering to minification (REQ-PERF-003) and embedding LOHs (REQ-OP-003.4). It must also output a structured changelog.

**IV. Central Conceptual Object (CCO) & Data Management (Enhanced Detail)**

*   **REQ-CCO-001 (Schema and Integrity):** (As in Rev 2.0)
    *   **REQ-CCO-001.1 (Schema Evolution):** (As in Rev 2.0)
    *   **REQ-CCO-001.2 (Schema Version Management):** (As in Rev 2.0)
*   **REQ-CCO-002 (Comprehensive Logging):** (As in Rev 2.0)
    *   **REQ-CCO-002.1 (Performance):** Appending to `op_log_j` should be efficient and not significantly degrade `ces` (de)serialization time. Consider strategies if logs become excessively large (e.g., archiving older logs within the CCO or to a separate conceptual store).
*   **REQ-CCO-003 (Knowledge Artifacts):** (As in Rev 2.0)
*   **REQ-CCO-004 (Evolution Lab Outputs):** (As in Rev 2.0)
*   **REQ-CCO-005 (Data Access Efficiency):** The `f_ucs` method for updating CCO data and `pco` for parsing JSON strings within the CCO MUST be optimized for performance.

**V. User Interaction & Experience (Enhanced Detail)**

*   **REQ-UIX-001 (Clarity of Interaction):** (As in Rev 2.0)
*   **REQ-UIX-002 (Decision Support Summaries):** (As in Rev 2.0)
    *   **REQ-UIX-002.1 (Output Specification):** Decision support summaries MUST clearly state the decision needed, provide 2-4 concise options if applicable, and list key pros/cons or implications for each, referencing relevant CCO data if possible.
*   **REQ-UIX-003 (Transparency of Reasoning):** (As in Rev 2.0)
*   **REQ-UIX-004 (Minimized Intervention & Confidence Scoring):**
    *   **REQ-UIX-004.1:** AIOS MHs MUST maximize autonomy.
    *   **REQ-UIX-004.2:** MHs SHOULD internally assess confidence in their autonomously generated outputs or decisions. If confidence is below a (potentially configurable) threshold, the MH should flag the item for user review with specific concerns, rather than simply asking for open-ended feedback.
*   **REQ-PHIL-001 (Metacognitive Feedback to User):** (As in Rev 2.0)

**VI. Testing, Validation, and Quality Assurance (Enhanced Detail)**

*   **REQ-TEST-001 (Unit Testability):** (As in Rev 2.0)
*   **REQ-TEST-002 (Integration Test Scenarios):** (As in Rev 2.0)
*   **REQ-TEST-003 (End-to-End Functional Scenarios):** (As in Rev 2.0)
    *   **REQ-TEST-003.1 (Output Specification):** Successful completion of an E2E scenario MUST result in a CCO whose final state and key artifacts (e.g., project plan, drafted content) meet predefined quality and completeness criteria for that scenario.
*   **REQ-TEST-004 (Regression Testing for FEL-MH):** (As in Rev 2.0)
    *   **REQ-TEST-004.1 (Performance):** Regression tests should include performance benchmarks (REQ-TEST-005) to ensure evolved engines do not significantly degrade performance without justification.
*   **REQ-TEST-005 (Performance Benchmarking):**
    *   **REQ-TEST-005.1:** Establish and maintain a suite of benchmark scenarios to measure key performance indicators (KPIs) like `ces` handling time, MH step execution time (Python only), and overall turn latency for typical operations.
    *   **REQ-TEST-005.2:** These KPIs MUST be tracked across engine versions to monitor performance impacts of evolution.
*   **REQ-TEST-006 (Minification Validation):** Minified engine versions produced by FEL-MH MUST pass all functional (REQ-TEST-003) and performance (REQ-TEST-005) benchmarks applicable to their verbose counterparts.

---

