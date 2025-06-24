---
modified: 2025-05-17T12:37:53Z
---
# MetaProcessEngineASO v3.0 Framework Guide (Function-Driven Architecture)

## 1. Welcome to the AI Orchestration Engine!

Welcome to the **Meta Process Engine (Autonomous Self-Improving Orchestrator v3.0)**! This version marks a major architectural evolution towards a **lightweight, function-driven framework**. The core `MetaProcessEngineASO_v3.0.md` file now primarily acts as an orchestrator, delegating complex processing, analysis, and generation tasks to a comprehensive library of external functions.

**Key Architectural Shift in v3.0:**
*   **Function-Driven Core:** Most of the Engine's "skills" and detailed logic are now implemented as external functions (conceptually listed in `function_declarations_v3.0.json`). The `.md` Engine template guides the AI (e.g., Gemini) to request these functions and process their structured JSON results.
*   **Lightweight Engine Template:** The `MetaProcessEngineASO_v3.0.md` is streamlined, focusing on high-level Meta-Heuristic orchestration and core protocols.
*   **Enhanced Modularity & Extensibility:** This architecture allows for easier updates to specific functionalities (by updating the external Python functions) without altering the core Engine template as frequently.
*   **Structured Data Exchange:** Interactions between the Engine and its functions heavily rely on JSON for inputs and outputs.

This guide provides an overview. For detailed operational protocols and how the AI orchestrates function calls, refer to the **`[[Manual_of_AI_Process_v3.0]]`**.

## 2. Critical User Setup: Function Declarations

**IMPORTANT:** For `MetaProcessEngineASO v3.0` to operate correctly, **YOU, THE USER, MUST CONFIGURE THE FUNCTION DECLARATIONS IN YOUR AI STUDIO ENVIRONMENT.**
1.  Obtain the `function_declarations_v3.0.json` file. This file lists all external functions the Engine is designed to call.
2.  In Google AI Studio, navigate to "Run settings" -> "Function calling".
3.  Select the "Code Editor" tab and paste the *entire content* of `function_declarations_v3.0.json` into this editor.
4.  Save the function declarations.
The Engine will not be able to perform most of its tasks if these functions are not declared to the AI model. You are also responsible for providing the corresponding Python (or other language) implementations for these functions that will be executed when the AI requests a function call.

## 3. Key Framework Components (v3.0)

1.  **`MetaProcessEngineASO_v3.0.md` (Engine Orchestrator Template):** The primary Markdown file you provide to the AI.
2.  **`function_declarations_v3.0.json` (Function Toolbox Specification):** **User-configured in AI Studio.** Defines the external functions available to the Engine.
3.  **Your Python (or other language) Function Implementations:** External code you manage that executes the logic for the declared functions.
4.  **`Manual_of_AI_Process_v3.0.md` (Human-Readable Guide):** Explains the v3.0 architecture and interaction model.
5.  **`EngineMetaSchemaASO_v1.2.0.md` (KA):** Schema for the `.md` Engine file, used by `FEL-MH`.
6.  CCO Data Files & Other KAs (e.g., Global LHR/LHL).

## 4. Getting Started with `MetaProcessEngineASO v3.0`

1.  **Configure Function Declarations in AI Studio (See Section 2).**
2.  Provide the Engine Template: Copy `MetaProcessEngineASO_v3.0.md` to the AI.
3.  AI Startup: AI performs "CRITICAL STARTUP PROTOCOL" and prompts for initial mode/goal.
4.  Collaborate: Interact. The AI will now frequently indicate it needs to "call function X". You will then execute your corresponding Python code for function X with the arguments the AI provides, and then feed the JSON result from your Python code back to the AI in AI Studio.

## 5. General Interaction Workflow & Key Principles (v3.0)

*   **Orchestration of External Functions:** The AI's primary role is to determine the correct sequence of function calls.
*   **Structured JSON Data Exchange:** Expect inputs to functions and results from functions to be in JSON format.
*   **User as Function Executor:** In the AI Studio UI workflow, the user is responsible for running the external Python code when the AI requests a function call and providing the result.
# ... (other principles adapted for v3.0)