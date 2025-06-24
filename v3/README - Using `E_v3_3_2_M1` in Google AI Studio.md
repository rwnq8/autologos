**AIOS Minified Engine (`E_v3_3_2_M1`) - Quick Start for Google AI Studio**

This document guides you on how to run and interact with the `E_v3_3_2_M1.py` AIOS engine script within Google AI Studio.

**Prerequisites:**

1.  **Google AI Studio Account:** You need access to Google AI Studio.
2.  **Code Execution Enabled:** In your AI Studio chat session settings, ensure "Code Execution" is **ENABLED**.
3.  **Model Parameters (Recommended for Consistency):**
    *   Temperature: `0` (or as low as possible)
    *   Top P: `0.1` (or low)
    *   Top K: `1` (or low)
4.  **The Script File:** Save the Python code from "Artifact 1" above into a plain text file named `E_v3_3_2_M1.py` on your computer.

**How the Engine Works with AI Studio (Orchestration Model):**

*   The Python script (`E_v3_3_2_M1.py`) defines the engine's logic, state transitions, and Meta-Handlers (MHs like IFE, PDF, PLAN).
*   You (the user) act as the **LLM Orchestrator** through the AI Studio chat interface.
*   The Python engine will print `---B_LLM_REQ_M--- ... ---E_LLM_REQ_M---` blocks. These are JSON-formatted requests for you (the orchestrator) to fulfill.
*   You'll provide responses to these requests, which the engine then processes.

**Running the Engine: Step-by-Step**

**Turn 1: Initial Engine Start (Fresh Session)**

1.  **Your Action in AI Studio Chat:**
    *   **Upload File:** Use the AI Studio interface to upload the `E_v3_3_2_M1.py` file you saved.
    *   **Text Prompt:** In the same message where you upload the file, type the following instructions for the AI:
        ```text
        Please execute the attached Python script `E_v3_3_2_M1.py`.
        After the script definition, please ensure the following lines are run to instantiate and start the engine:
        
        engine = E_v3_3_2_M1()
        current_engine_output = engine.k_se()
        print("\\n---FINAL_ENGINE_OUTPUT_FOR_TURN---")
        print(json.dumps(current_engine_output, indent=2))
        print("\\n---CURRENT_ENGINE_STATE_EXPORT_FOR_NEXT_TURN---")
        print(engine.exp_s())
        ```
2.  **AI Studio Execution:**
    *   The AI will create a `tool_code` block containing the full script text from `E_v3_3_2_M1.py`, followed by the instantiation and `engine.k_se()` call.
    *   There will be a one-time parsing delay for the script.
3.  **Expected Output (from the `tool_code` block):**
    *   Engine startup logs.
    *   Several `---B_LLM_REQ_M--- ... ---E_LLM_REQ_M---` blocks will be printed by the engine as it initializes (e.g., PUM for "Init_M.PIO_ready", then UIR_PO_M for initial options).
    *   **`---FINAL_ENGINE_OUTPUT_FOR_TURN---`**: This will show the JSON object returned by `engine.k_se()`. It will be an `AWAIT_LLM_M` request, specifically `UIR_PO_M` (User Interaction Request - Present Options), asking how you want to begin. Note the `ch` (callback handler) field, e.g., `E_v3_3_2_M1.k_pirc(llr)`.
    *   **`---CURRENT_ENGINE_STATE_EXPORT_FOR_NEXT_TURN---`**: This will be a long JSON string. **COPY THIS ENTIRE JSON STRING** and save it to a local text file (e.g., `aios_state_turn1.json`). This is crucial for the next turn.

**Turn 2 (and subsequent turns): Continuing the Interaction**

Let's assume the engine asked for your initial choice (from `UIR_PO_M`) and the `ch` was `E_v3_3_2_M1.k_pirc(llr)`. You want to choose "New Process".

1.  **Your Action in AI Studio Chat:**
    *   **Upload File (Potentially):** Re-upload `E_v3_3_2_M1.py` if AI Studio doesn't keep the class definition in memory between turns. It's safer to re-upload.
    *   **Text Prompt:**
        ```text
        Please execute the attached Python script `E_v3_3_2_M1.py`.
        
        # Restore engine from previous turn's state
        saved_state_string = """
        <PASTE THE ENTIRE JSON STRING YOU SAVED FROM '---CURRENT_ENGINE_STATE_EXPORT_FOR_NEXT_TURN---' OF THE PREVIOUS TURN HERE>
        """
        engine = E_v3_3_2_M1(iss_json_str=saved_state_string)
        
        # Simulate LLM/User Response to the previous request
        # Previous request was UIR_PO_M, ch: E_v3_3_2_M1.k_pirc(llr)
        # User chooses "New Process"
        llm_response_for_engine = {"s": "USR_CMD_M", "c": "New Process"}
        
        # Call the continuation handler from the previous request
        current_engine_output = engine.k_pirc(llm_response_for_engine)
        
        print("\\n---FINAL_ENGINE_OUTPUT_FOR_TURN---")
        print(json.dumps(current_engine_output, indent=2))
        print("\\n---CURRENT_ENGINE_STATE_EXPORT_FOR_NEXT_TURN---")
        print(engine.exp_s())
        ```
2.  **AI Studio Execution:**
    *   The script defines the class, instantiates the engine, *imports the previous state*, simulates your response, and calls the correct engine method.
    *   This turn should be much faster as the script parsing is minimal if cached, and state import is quick.
3.  **Expected Output:**
    *   Engine logs for the operations performed (e.g., `IFE_M` starting).
    *   A new `---B_LLM_REQ_M--- ... ---E_LLM_REQ_M---` block from the engine. This will be the *next* request (e.g., `IFE_M` asking for the core idea via `UIR_ET_M`). Note its `ch` field (e.g., `E_v3_3_2_M1.ife_s2(llr)`).
    *   **`---FINAL_ENGINE_OUTPUT_FOR_TURN---`**: The JSON for this new request.
    *   **`---CURRENT_ENGINE_STATE_EXPORT_FOR_NEXT_TURN---`**: A new JSON state string. **COPY and SAVE this new string** (e.g., `aios_state_turn2.json`).

**General Pattern for Subsequent Turns:**

For every turn:
1.  **Identify the Engine's Last Request:** Look at the `---FINAL_ENGINE_OUTPUT_FOR_TURN---` from the *previous* AI Studio turn. Note the `tt` (task type) and `ch` (callback handler).
2.  **Formulate Your Response (as LLM/User):**
    *   If it was `UIR_ET_M` (elicit text), your response is `{"s": "USR_CMD_M", "c": "Your text input"}`.
    *   If it was `CT_..._M` (cognitive task), your response is the JSON object expected by the engine (see `out_fmt_guide` in the request).
3.  **Prepare Your AI Studio Prompt:**
    *   (Upload `E_v3_3_2_M1.py` again for safety).
    *   Include the `saved_state_string = """<PASTE_LATEST_SAVED_STATE>"""`.
    *   Instantiate `engine = E_v3_3_2_M1(iss_json_str=saved_state_string)`.
    *   Set `llm_response_for_engine = { ... your formulated response ... }`.
    *   Call `current_engine_output = engine.method_from_ch(llm_response_for_engine)` (e.g., if `ch` was `E_v3_3_2_M1.ife_s2(llr)`, you call `engine.ife_s2(llm_response_for_engine)`).
    *   Include the print statements for `FINAL_ENGINE_OUTPUT_FOR_TURN` and `CURRENT_ENGINE_STATE_EXPORT_FOR_NEXT_TURN`.
4.  **Execute and Save:** Run the turn, observe the output, and save the new state string.

Repeat this process to step through IFE, PDF, PLAN, and the TDE_STUB.

**Example Flow Through IFE, PDF, PLAN, TDE_STUB (Illustrative LLM Responses):**

*   **Turn 1 (k_se):** Engine asks for initial choice. (You save state_0)
*   **Turn 2 (k_pirc):** You respond `{"s":"USR_CMD_M", "c":"New Process"}`. Engine starts IFE, asks for core idea. (Save state_1)
*   **Turn 3 (ife_s2):** You respond `{"s":"USR_CMD_M", "c":"Marketing plan for eco-coffee"}`. IFE asks LLM to draft essence. (Save state_2)
*   **Turn 4 (ife_s3):** You (as LLM) respond `{"essence_txt":"Compelling eco-coffee strategy...", "s":"Suc_M"}`. IFE completes. PDF starts, asks for details. (Save state_3)
*   **Turn 5 (pdf_s2_proc_details):** You respond `{"s":"USR_CMD_M", "c":"Target millennials, $50k budget..."}`. PDF asks LLM for decomposition. (Save state_4)
*   **Turn 6 (pdf_s3_proc_decomp):** You (as LLM) respond `{"decomposition_obj":{...}, "s":"Suc_M"}`. PDF completes. PLAN starts, asks LLM for phases. (Save state_5)
*   **Turn 7 (plan_s2_proc_phases):** You (as LLM) respond `{"phases_list":[P1, P2], "s":"Suc_M"}`. PLAN asks LLM for tasks for P1. (Save state_6)
*   **Turn 8 (plan_s2c_proc_tasks for P1):** You (as LLM) respond `{"tasks_list":[T1.1, T1.2], "s":"Suc_M"}`. PLAN asks LLM for tasks for P2. (Save state_7)
*   **Turn 9 (plan_s2c_proc_tasks for P2):** You (as LLM) respond `{"tasks_list":[T2.1], "s":"Suc_M"}`. PLAN completes (_plan_s3_finalize_plan is called internally). TDE_STUB runs. Engine pauses at AUI_M. (Save state_8)

This iterative process allows you to simulate the full AIOS flow.
