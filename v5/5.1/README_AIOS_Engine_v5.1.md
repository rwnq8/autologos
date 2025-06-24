# AIOS Project Package - AIOS Engine v5.1 (Minified, Log Optimized)

**Version:** `5.1mfc-logopt` (Class `A_MFC_v5_1`)
**Date:** 2025-05-24 (Simulated)

This package provides the `AIOS_Engine_v5.1.py` script and essential documentation. This version is a runnable, minified Python engine based on the feature-complete `v5.0mfc-conv1` conceptual model. It includes an optimization for log history export (`TID_PERF_002`) to improve performance in long-running sessions by reducing the size of the exported state.

## 1. Overview

The AIOS Engine is designed to orchestrate complex, goal-oriented processes. It operates through a series of Meta-Handlers (MHs) managed by a central Kernel. The engine manages its state and a Central Conceptual Object (CCO) representing the work-in-progress. At key points, it requests external cognitive task fulfillment or user input via an `A_LLM` JSON package.

**Key Features of v5.1:**
*   **Runnable Minified Python Code:** Single script for direct execution.
*   **Complete MH Suite:** IFE, PDF, PLAN, TDE (with sub-MH dispatch), CAG, SEL, KAU, MRO, FEL (with autonomy stubs).
*   **Log Export Optimization:** Reduces exported state size for better performance.
*   **Interaction Model:** Communicates with an "LLM Orchestrator" for cognitive tasks and user input.

## 2. Roles & Responsibilities in the AIOS Ecosystem

*   **Python Script (`AIOS_Engine_v5.1.py`):**
    *   The deterministic "Orchestration Core." Executes its Python logic, manages state and CCO, and makes `A_LLM` requests.
    *   Its *only* direct output to the LLM Orchestrator is the `A_LLM` JSON package.

*   **LLM Orchestrator (e.g., Google AI Studio acting with an LLM like Gemini):**
    *   **Execution Management:** Submits Python code (engine script + orchestration logic) to the execution environment.
    *   **State Persistence:** Manages the engine's `ces` (exported state string) between turns.
    *   **Cognitive Task Fulfillment:** Responds to `CT_...` requests from the engine (simulated in testing, fulfilled by LLM/tools in production).
    *   **User Input Facilitation:** Manages `UIR_...` requests.

*   **Human User:**
    *   **Developer/Tester:** Provides engine script, defines goals, validates behavior, proposes TIDs.
    *   **End User (Production):** Initiates processes, provides substantive inputs for `UIR_...` and `CT_...` requests (often via the LLM Orchestrator).

## 3. Understanding "Simulation," "Conceptual," and "Execution"

*   **Execution:** Direct running of the `AIOS_Engine_v5.1.py` Python code.
*   **Simulation (in Testing):** The LLM Orchestrator generating plausible outputs for Cognitive Task (`CT_...`) requests.
*   **Conceptual (Design/Evolution):** Ideas or engine versions existing as specifications. FEL-MH's "output" of a new engine script is currently a conceptual text artifact.

## 4. How to Run `AIOS_Engine_v5.1.py` (in Google AI Studio)

This procedure assumes a single Google AI Studio chat session (thread).

**4.1. Initial Setup (Once per Session):**
    1.  Start a new chat thread.
    2.  Ensure "Code Execution" is **ENABLED**.
    3.  **Upload `AIOS_Engine_v5.1.py`:** Use the file upload feature. This makes the `A_MFC_v5_1` class definition available for the session.

**4.2. Turn 1: Starting the Engine:**
    *   In the Google AI Studio prompt, paste the following Python *orchestration code*:
        ```python
        import json as jsn, uuid as uid, datetime as dt, time as t 
        print("--- AIOS Engine v5.1: Session Start (Turn 1) ---")
        # A_MFC_v5_1 class is available from the uploaded AIOS_Engine_v5.1.py
        engine_instance = A_MFC_v5_1() 
        output_package = engine_instance.k_st() # Start fresh
        
        print("\n--- ENGINE_OUTPUT_TURN_1 ---")
        print(jsn.dumps(output_package, indent=2))
        ```
    *   The LLM Orchestrator executes this.
    *   From the `ENGINE_OUTPUT_TURN_1` JSON in the `tool_output`, **copy the string value of the `ces` key.** This is your serialized engine state.

**4.3. Subsequent Turns:**
    1.  The engine's previous output (`A_LLM` package) indicates its next need via `tt` (task_type) and `ch` (continuation_hint).
    2.  The LLM Orchestrator (or you, guiding it) prepares the `simulated_llm_response_obj` for the engine.
    3.  In the Google AI Studio prompt, paste the following *short* Python orchestration code (DO NOT re-paste the full engine script unless the session was reset or an error indicates the class is undefined):
        ```python
        import json as jsn, uuid as uid, datetime as dt, time as t
        print("--- AIOS Engine v5.1: Subsequent Turn ---")
        engine_state_from_previous_turn = """PASTE_PREVIOUS_CES_STRING_HERE"""
        
        # A_MFC_v5_1 class is assumed available from the initial upload
        engine_instance = A_MFC_v5_1(i_sjs=engine_state_from_previous_turn)
        
        # LLM Orchestrator prepares this based on engine's last request
        simulated_llm_response_obj = {"s": "UC", "c": "TA"} # Example: Terminate
        
        # Call the method from the *previous* turn's "ch" (continuation_hint)
        # Example: if previous hint was "A_MFC_v5_1().kernel_pirc(r)"
        output_package = engine_instance.kernel_pirc(simulated_llm_response_obj)
        # Example: if previous hint was "A_MFC_v5_1().ife_s3(r)"
        # output_package = engine_instance.ife_s3(simulated_llm_response_obj) 
        
        print("\n--- ENGINE_OUTPUT_CURRENT_TURN ---")
        print(jsn.dumps(output_package, indent=2))
        ```
    4.  Save the new `ces` string from the output. Repeat.

## 5. Package Contents Overview
*   `AIOS_Engine_v5.1.py`: The runnable engine script.
*   `final_exported_state_v5.1_clean.json`: A sample clean starting state.
*   This README.
*   `AIOS_User_Manual_v5.1.md` (Draft): Detailed usage instructions.
*   `AIOS_v5.1_ChangeLog.md`: Changes from v5.0mfc-conv1.
*   `AIOS_v5.1_Roadmap.md`: Future development plans.
*   `AIOS_v5.1_Implemented_TIDs.json`: List of implemented TIDs.
*   Reference schemas and conceptual documents.

This package provides the tools to begin applying AIOS v5.1 to your projects.