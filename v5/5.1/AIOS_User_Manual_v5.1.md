# AIOS Engine v5.1 - User Manual (Draft)

## 1. Introduction to AIOS v5.1

Welcome to AIOS Engine v5.1 (`5.1mfc-logopt`)! This document guides you on using this minified, runnable Python engine.

**Purpose:** The AIOS Engine is designed to orchestrate complex, goal-oriented processes. It manages state, follows a structured workflow through Meta-Handlers (MHs), and requests external cognitive task fulfillment or user input at key decision points.

**Core Principle:** The `AIOS_Engine_v5.1.py` script is the deterministic "Orchestration Core." It executes Python logic. An "LLM Orchestrator" (like the AI you are currently interacting with) is responsible for:
*   Managing the execution environment (e.g., Google AI Studio).
*   Persisting the engine's state between turns.
*   Fulfilling "Cognitive Task" (`CT_...`) requests from the engine (either by using its own capabilities or by interfacing with other specialized AI models/tools).
*   Facilitating "User Input" (`UIR_...`) requests by prompting the human user or simulating user responses during testing.

## 2. Roles and Responsibilities

*   **Python Script (`AIOS_Engine_v5.1.py` - Class `A_MFC_v5_1`):**
    *   **Role:** Deterministic Orchestration Core. Manages internal state, executes MH process flows, makes decisions, identifies need for external input/cognition.
    *   **Output:** Only outputs structured JSON `A_LLM` request packages (containing request details `rd` and exported state `ces`).
    *   **State:** Stateful within a single execution; state is serialized in `ces` for persistence between executions.

*   **LLM Orchestrator (e.g., the AI Chat Interface):**
    *   **Environment/Execution Management:** Submits Python code (engine script + orchestration logic) to the execution environment.
    *   **State Persistence:** Receives `ces` from the engine, provides it back for rehydration in the next turn.
    *   **Cognitive Task Fulfillment:** Responds to `CT_...` requests from the engine. In testing, this is often simulated. In production, this could involve calls to other LLMs, tools, or human-in-the-loop workflows.
    *   **User Input Facilitation:** Manages `UIR_...` requests, either by prompting the human user or simulating responses.
    *   **Engine Evolution Facilitation (FEL-MH):** Handles complex generation tasks when FEL-MH requests conceptual new engine models or artifacts.

*   **Human User:**
    *   **Developer/Tester:** Provides initial engine script, defines goals, observes, debugs, proposes TIDs, validates new versions.
    *   **End User (Production):** Initiates AIOS processes, provides substantive inputs for `UIR_...` and `CT_...` requests (often by providing detailed prompts or data to the LLM Orchestrator, which then formats it for the engine). Reviews AIOS-generated outputs.

## 3. Understanding "Simulation," "Conceptual," and "Execution"

*   **Execution:** The direct running of the `AIOS_Engine_v5.1.py` Python code by an interpreter.
*   **Simulation (in Testing):** The LLM Orchestrator generating plausible *outputs* for the Cognitive Task (`CT_...`) requests made by the *executing* Python engine. This allows testing the engine's framework without live, complex AI models for every sub-task.
*   **Conceptual (Design/Evolution):** Ideas, plans, or engine versions existing as specifications but not yet as runnable code. FEL-MH's "output" of a new engine script is currently a conceptual text artifact produced by the LLM Orchestrator.

## 4. Setting up and Running an AIOS v5.1 Session (Google AI Studio Example)

**4.1. Initial Setup (Once per Chat Session/Thread):**
    1.  Start a new chat thread in Google AI Studio.
    2.  Ensure "Code Execution" is **ENABLED**.
    3.  **Upload `AIOS_Engine_v5.1.py`:** Use the file upload feature in Google AI Studio to upload the `AIOS_Engine_v5.1.py` script. This makes the `A_MFC_v5_1` class definition available for the duration of the session.

**4.2. Turn 1: Starting the Engine:**
    *   In the Google AI Studio prompt, paste the following Python *orchestration code*:
        ```python
        import json as jsn, uuid as uid, datetime as dt, time as t # Ensure necessary imports for orchestration

        print("--- AIOS Engine v5.1: Session Start (Turn 1) ---")
        # A_MFC_v5_1 class is available from the uploaded AIOS_Engine_v5.1.py
        engine_instance = A_MFC_v5_1() 
        output_package = engine_instance.k_st() # Start fresh
        
        print("\n--- ENGINE_OUTPUT_TURN_1 ---")
        print(jsn.dumps(output_package, indent=2))
        ```
    *   Submit this to the LLM Orchestrator.
    *   The LLM Orchestrator will wrap this in `tool_code` and execute it.
    *   From the `ENGINE_OUTPUT_TURN_1` JSON in the `tool_output`, **copy the entire string value of the `ces` key.** This is your serialized engine state.

**4.3. Subsequent Turns: Interacting with the Engine:**
    1.  The engine's previous output (the `A_LLM` package) will indicate what it needs next via the `tt` (task_type) and `pu` (prompt_to_user) fields.
    2.  **You (as the user/cognitive provider) formulate your response.**
        *   If `tt` is `UIR_PO` (options), your response is the chosen option value (e.g., "NP").
        *   If `tt` is `UIR_ET` (elicit text), your response is the requested text.
        *   If `tt` is a `CT_...` (cognitive task), your response is the JSON object fulfilling that task (e.g., for `CT_DDT`, it's `{"cet": "drafted text...", "s": "DraftComplete"}`).
    3.  **Provide your response and the saved state to the LLM Orchestrator.** Instruct it to continue.
    4.  **LLM Orchestrator Action:** The LLM will prepare a *short* Python script for the `tool_code` block:
        ```python
        import json as jsn, uuid as uid, datetime as dt, time as t

        print("--- AIOS Engine v5.1: Subsequent Turn ---")
        engine_state_from_previous_turn = """PASTE_PREVIOUS_CES_STRING_HERE"""
        
        # A_MFC_v5_1 class is assumed available from the initial upload
        engine_instance = A_MFC_v5_1(i_sjs=engine_state_from_previous_turn)
        
        # This is the simulated response to the engine's last request
        simulated_llm_response_obj = {"s": "UC", "c": "YOUR_CHOICE_OR_TEXT_INPUT"} 
        # OR, for a cognitive task:
        # simulated_llm_response_obj = {"qr": {"overall_assessment": "Looks good."}, "s": "CritiqueComplete"}

        # Get the continuation_hint (e.g., "A_MFC_v5_1().kernel_pirc(r)") 
        # from the engine's *previous* A_LLM output package's "rd.ch" field.
        # Call the appropriate method:
        # Example: output_package = engine_instance.kernel_pirc(simulated_llm_response_obj)
        # Example: output_package = engine_instance.mro_cacc(simulated_llm_response_obj)
        
        # Replace with the actual call based on the previous continuation_hint:
        # output_package = engine_instance.ACTUAL_METHOD_FROM_HINT(simulated_llm_response_obj)
        
        # For this example, let's assume the previous hint was to call ife_s3
        # and we are providing a drafted essence:
        # simulated_llm_response_obj = {"cet": "A brilliant new core essence.", "s": "DraftComplete"}
        # output_package = engine_instance.ife_s3(simulated_llm_response_obj) # Replace with actual method

        # Placeholder for actual call - LLM must fill this based on context
        output_package = {"s": "PLACEHOLDER_ORCHESTRATOR_NEEDS_TO_CALL_CORRECT_METHOD"}
        if engine_instance.kCI == "PDF" and engine_instance.cM == "PDF": # Example: if engine is in PDF asking for details
             simulated_pdf_details = {"s":"UC", "c":"Target audience is technical experts. Focus on API integration."}
             output_package = engine_instance.pdf_s2(simulated_pdf_details)


        print("\n--- ENGINE_OUTPUT_CURRENT_TURN ---")
        print(jsn.dumps(output_package, indent=2))
        ```
    5.  **Save the new `ces` string** from the output and repeat.

## 5. Understanding Engine Output (`A_LLM` Package)
*   `s`: Status (always "A_LLM" when engine requests orchestrator action).
*   `rd` (Request Details):
    *   `tt`: Task Type (e.g., `UIR_PO`, `UIR_ET`, `CT_DDT`, `CT_MRO_...`).
    *   `pu`: Prompt to User (if applicable).
    *   `ctd`: Cognitive Task Details (if applicable).
    *   `eid`: Expected Input Description for LLM response.
    *   `ch`: Continuation Hint (e.g., `A_MFC_v5_1().ife_s3(r)`).
*   `ces`: Current Exported State (JSON string). Essential for the next turn.
*   Engine logs (`LG (...)`) will also be printed by the script.

## 6. Terminating a Session
*   When prompted for a choice where "Terminate" is an option, select it (e.g., provide "TA").
*   Or, if the engine is awaiting other input, you can direct the LLM Orchestrator to issue a "TA" command through `k_pgud`.
*   The final output package will have `s: "TERM"` or `s: "TERM_REQ"`. The `fes` key will contain the final state.

This manual provides a starting point. Refer to specific MH documentation (conceptually part of the full engine design) for details on their steps.