# AIOS Development Roadmap (Post v5.1)

**Current Version:** `AIOS_Engine_v5.1.py` (Class `A_MFC_v5_1`, Version `5.1mfc-logopt`)
*   **Status:** Minified, runnable Python script. Core Meta-Handlers (MHs) are functional, designed to orchestrate cognitive tasks. Includes log export optimization (`TID_PERF_002`). This version is the baseline for initial production testing and further targeted optimizations.

**A. Overarching Goal for v5.2 and Beyond: Production Viability through Performance, Robustness, Maintainability, and Enhanced Autonomy**

The primary focus is to drastically reduce user-perceived latency, enhance engine robustness for reliable use in real-world projects, improve code maintainability through planned modularization, and continue advancing the engine's autonomous capabilities.

**B. Performance Optimization & Latency Reduction (High Priority for v5.2)**

1.  **`TID_PERF_001_USER_PERCEIVED_LATENCY_TRACKING` (Full Implementation & Analysis)**:
    *   **Objective:** Establish a rigorous system for tracking, logging, and analyzing all components of user-perceived turn time to identify and address bottlenecks.
    *   **Details:**
        *   **Engine-Side (`AIOS_Engine_v5.x.py`):**
            *   Enhance `_cr()` to log `request_sent_ts`.
            *   Modify MH continuation methods (e.g., `ife_s2`, `mro_cacr`) to calculate and log `cognitive_task_duration_llm_side` (time between `request_sent_ts` and receiving LLM response).
            *   Ensure CCO operational log entries store detailed timestamps for Python execution of MH steps.
        *   **Orchestrator-Side (LLM Interaction Protocol & Reporting):**
            *   The LLM Orchestrator must (as a strict protocol) record `T_orch_interaction_start` and `T_orch_interaction_end` for each full turn it handles.
            *   The `Orchestrator_Turn_Duration` should be explicitly reported to the user by the LLM Orchestrator at the end of each turn during testing phases for immediate feedback.
            *   *Future Enhancement:* Devise a mechanism for the LLM Orchestrator to pass its turn duration back to the AIOS Engine for inclusion in the CCO performance logs (e.g., via a special metadata field in the next simulated input).
        *   **KAU-MH Enhancement:** Define and implement a KAU-MH sub-routine (`kau_analyze_performance_logs`) to parse CCO operational logs and generate reports on Python execution times, cognitive task durations, and (if available) orchestrator turn times, highlighting bottlenecks.
        *   **Reporting:** Develop a system status query (e.g., user command "SYSTEM STATUS PERFORMANCE?") that triggers the KAU-MH analysis and presents a summary.
    *   **Acceptance:** Comprehensive latency metrics are logged and can be analyzed/reported. Clearer understanding of where time is spent.
    *   **Status:** Critical for v5.2.

2.  **`TID_ENV_001_CODE_PERSISTENCE_OPTIMIZATION` (Strategy & Mitigation for v5.2)**:
    *   **Objective:** Minimize redundant engine script transfer and parsing, particularly in environments like Google AI Studio.
    *   **Context:** Current understanding is that Google AI Studio may not persist class definitions across `tool_code` calls without re-supplying the definition.
    *   **Strategy for v5.2:**
        *   **Primary (Mitigation):** Continue to assume the full script text (or at least the class definition) must be sent by the LLM Orchestrator with each `tool_code` call *if the environment requires it*. The primary mitigation is the already minified nature of `AIOS_Engine_v5.1.py`.
        *   **Secondary (Orchestrator-Level Experimentation):** The LLM Orchestrator can *attempt* an optimization:
            *   On the first execution of `AIOS_Engine_v5.1.py` in a session, the orchestrator notes its hash.
            *   On subsequent `tool_code` calls *within the same continuous interaction by the orchestrator*, it can *try* sending only the state rehydration and method invocation logic, *omitting the class definition*.
            *   If a `NameError` occurs, the orchestrator must immediately recognize this failure, revert to sending the full script text in its next attempt for that turn, and log this environmental behavior. This makes the optimization attempt transparent and recoverable.
        *   **Documentation:** Clearly document this environmental constraint and the attempted workaround in the User Manual.
    *   **Acceptance for v5.2:** A clear, documented strategy for handling code definition in the target test environment, prioritizing stability while attempting optimizations where feasible.
    *   **Status:** Active Strategy Refinement for v5.2.

3.  **`TID_PERF_004_STATE_EXPORT_REFINEMENT` (Targeted for v5.2, building on `TID_PERF_002`)**:
    *   **Objective:** Further optimize the `exs()` method if CCO data becomes a bottleneck.
    *   **Details for v5.2:**
        *   Analyze the size contribution of `self.cco` (specifically `self.kAS`) in the `exported_state` during typical test runs.
        *   If significant, consider options for large CCO sections (e.g., `product_content_data_json`):
            *   Implement more aggressive internal minification for JSON strings stored within the CCO if not already done by `cjo()`.
            *   *Investigation for future:* Conceptual design for CCO diffing or referencing externalized CCO parts (lower priority for v5.2 implementation unless critical).
    *   **Acceptance:** `ces` string size is monitored, and further optimizations are applied if CCO data becomes a clear bottleneck after log optimization.
    *   **Status:** Proposed for v5.2.

4.  **`TID_BENCH_001_BENCHMARK_SUITE_EXECUTION` (Initiate for v5.2)**:
    *   **Objective:** Define and execute an initial benchmark suite.
    *   **Details for v5.2:**
        *   Define 2-3 core end-to-end test scenarios (e.g., "IFE to simple PDF with MRO", "Full IFE->PLAN->TDE(CAG) cycle with simple content").
        *   For each scenario, define standard inputs for cognitive tasks.
        *   Manually (orchestrator-timed) run these scenarios 3-5 times with `AIOS_Engine_v5.1.py`.
        *   Document:
            *   Python execution times (from engine logs).
            *   LLM Orchestrator turn times (manually recorded by orchestrator).
            *   Total user-perceived turn times (manually recorded by user/orchestrator).
            *   Final CCO size and log size.
    *   **Acceptance:** Baseline performance data for `v5.1` is documented, providing a reference for `v5.2` and beyond.
    *   **Status:** Proposed for v5.2.

**C. Architectural Evolution, Robustness & Usability (v5.2 and beyond)**

5.  **`TID_ARCH_001_MODULARIZE_ENGINE_V1` (Investigation & Prototyping for v5.2/v5.3)**:
    *   **Objective:** Plan and prototype breaking the monolithic script into a more modular Python package structure.
    *   **Details for v5.2 (Investigation/Design):**
        *   Define a target modular structure (e.g., `aios/kernel.py`, `aios/core/cco.py`, `aios/mhs/ife.py`, etc.).
        *   Design class interfaces and dependencies between modules.
        *   Investigate packaging (e.g., `setup.py`) and import strategies.
        *   Analyze implications for state management if MHs become separate, potentially stateful objects.
        *   Critically assess how a modular package would be utilized in Google AI Studio (e.g., requiring upload of a zip file and custom import logic in the `tool_code`).
    *   **Rationale:** Long-term maintainability, testability, independent MH development.
    *   **Status:** Design & Investigation for v5.2, Prototyping/Implementation targeted for v5.3+.

6.  **`TID_AUTO_DOC_PKG_001` (Implementation for v5.2)**:
    *   **Objective:** Implement automated generation of a basic documentation package upon engine termination.
    *   **Details for v5.2:**
        *   Kernel's termination sequence to call a new internal method `_generate_termination_package()`.
        *   This method will assemble:
            *   The `exported_state` string.
            *   A basic README string (containing `self.vF`, `self.vS`, `self.sV`, timestamp).
            *   A simple Change Log string (e.g., "Evolved from [previous version if known via CCO/state] to current version. Key TIDs implemented in this version: [list TIDs if tracked, e.g., `TID_PERF_002` for v5.1]"). This part needs a mechanism to track applied TIDs or version differences. Initially, it might be a placeholder for manual filling.
            *   A list of "Implemented TIDs" (from a static list within the class for now, representing the TIDs that define the current version's feature set).
        *   The final package returned by the engine will be a dictionary containing these items.
    *   **Acceptance:** Termination output includes these structured documentation elements.
    *   **Status:** High Priority for v5.2.

7.  **`TID_FEL_ENHANCE_AUTONOMY_V1` (Iterative Implementation for v5.2)**:
    *   **Objective:** Make initial concrete progress on FEL-MH's autonomous capabilities, focusing on `fel_gst`.
    *   **Details for v5.2:**
        *   The `fel_gst` method will construct a detailed prompt for the LLM Orchestrator when `auto_tid` is true. This prompt will include: current engine version (`self.vS`), the evolution goal (`self.sFe["eg"]`), and a request for the LLM to analyze a (conceptually provided) summary of current engine requirements or known issues (from a KA or a simplified internal list) to formulate *one specific, actionable TID* conforming to `AIOS_TID_Schema_v1_2.md`.
        *   The LLM Orchestrator will then fulfill this, acting as the "insight engine" to generate the TID JSON.
        *   The engine will then proceed to `fel_s2lt` (or a new `fel_sXpgt` - process generated TID) with this single, AI-generated TID.
    *   **Acceptance:** FEL-MH can successfully orchestrate the generation of one valid TID via an LLM call based on a high-level goal.
    *   **Status:** In Progress for v5.2.

8.  **`TID_ERROR_HANDLING_IMPL_V1` (Iterative Implementation for v5.2)**:
    *   **Objective:** Improve robustness when interacting with (simulated) LLM cognitive tasks and handling internal errors.
    *   **Details for v5.2:**
        *   In MH methods processing LLM responses (e.g., `ife_s3`, `mro_cacr`), add more specific `try-except` blocks for `JSONDecodeError` or `KeyError` if expected fields are missing.
        *   If such an error occurs, log it verbosely and transition the MH to an error state, returning an informative error status to the Kernel (e.g., `IFE_ERR_MALFORMED_LLM_RESPONSE`).
        *   The Kernel (`k_pmr`) should then present a more user-friendly error message and potentially offer options like "Retry last cognitive task" (which would re-issue the `A_LLM` request) or "Abort MH."
    *   **Acceptance:** Engine handles common LLM response errors more gracefully and provides clearer diagnostic information.
    *   **Status:** In Progress for v5.2.

**D. Documentation & Usability (Ongoing for v5.2)**

9.  **`TID_DOC_001_USER_MANUAL_V1` (First Full Draft for v5.2)**:
    *   **Objective:** Produce a comprehensive first draft of the User Manual based on the structure outlined previously, covering `AIOS_Engine_v5.1/v5.2` operation.
    *   **Status:** High priority for v5.2.

10. **`TID_SCHEMA_REFINE_V1` (Review and Minor Updates for v5.2)**:
    *   **Objective**: Review `AIOS_CCO_Schema_v3_0.md` and `AIOS_TID_Schema_v1_2.md` based on `v5.1` testing and identify any immediate needs for clarification, additions, or corrections. Implement minor, non-breaking changes.
    *   **Status**: Proposed for v5.2.