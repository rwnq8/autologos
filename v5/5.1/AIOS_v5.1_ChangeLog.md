# AIOS Engine v5.1 Change Log

## Version 5.1mfc-logopt (Released: 2025-05-24, Simulated)

This version builds upon the conceptual `v5.0mfc-conv1` baseline.

### New Features & Improvements:

*   **Log History Export Optimization (`TID_PERF_002_LOG_HISTORY_EXPORT_OPTIMIZATION`)**:
    *   The `exs()` (export_state) method in `AIOS_Engine_v5.1.py` has been modified.
    *   Instead of exporting the entire log history (`lh`) in the state string (`ces`), the method now exports only the last N (currently N=50) log entries.
    *   If the log history exceeds N entries, a summary object (`lh_s`) is included in the state, containing the total number of entries, the number of entries shown, and timestamps for the oldest and newest entries being shown.
    *   The `is_()` (import_state) method was updated to recognize and log this summary if present.
    *   **Rationale:** To significantly reduce the size of the exported state string, thereby mitigating latency issues caused by transferring and re-parsing large state objects.
    *   **Impact:** Reduces data transfer and processing overhead for the LLM Orchestrator and the execution environment, especially in long-running sessions.

*   **Internal Versioning Update:**
    *   Class name updated to `A_MFC_v5_1`.
    *   Internal version strings (`vF`, `vS`) updated to "AIOS_Engine_v5.1mfc-logopt" and "5.1mfc-logopt" respectively.
    *   State schema version (`sV`) updated to "2.1mfc-lo".
    *   Continuation hints (`ch`) in function wrappers updated to refer to `A_MFC_v5_1()`.

### Inherited Features from v5.0mfc-conv1:
Version 5.1 inherits all the features and conceptually implemented TIDs from the `v5.0mfc-conv1` model, including:
*   Full suite of Meta-Handlers (IFE, PDF, PLAN, TDE with sub-MH dispatch, CAG, SEL, KAU, FEL with autonomy stubs, MRO with advanced cognition).
*   Validated Kernel logic.
*   Minified codebase for efficient execution.
*   Conceptual modular design and robust error handling principles.
(Refer to `AIOS_v5.1_Implemented_TIDs.json` for a full list of inherited TIDs.)