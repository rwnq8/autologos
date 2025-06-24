# AIOS Full Requirements Document v2.0 (with Simulation Model)

This document defines the requirements for the AIOS (AI Orchestration System), incorporating the MVME + Orchestrator simulation model.

## Definitions:

*   **Simulation:** The LLM Orchestrator imitating the behavior of a conceptually more advanced AIOS engine *without directly executing that engine's code*.  Used for testing, exploration, and working around environmental limitations.
*   **Conceptual:** Existing as an idea or concept; not yet implemented in concrete, runnable code. Refers to the *imagined, fully functional AIOS engine* whose behavior the orchestrator simulates.
*   **Executable Code:** Python code runnable by an interpreter (e.g., `A_MVME_v3_4.py`, `AIOS_Engine_v3.3.2_stateful.py`).

## Roles and Responsibilities:

*   **User:** Provides high-level directives, interacts with the *simulated, advanced engine*.
*   **LLM Orchestrator:**
    *   Simulates the conceptual AIOS engine's behavior (state, LLM requests, loops).
    *   Uses the MVME shell as an interface, translates user directives into MVME calls, updates MVME state.
*   **MVME Shell (`A_MVME_v3_4.py`):**
    *   Provides a minimal, fast-loading Python interface.
    *   Executes simple state updates based on orchestrator commands.
    *   Exports its minimal state, including a conceptual engine state summary.

## AIOS Engine Requirements (Conceptual `v5.0mfc-final`):

*(The following requirements are now understood as being conceptually implemented in `v5.0mfc-final` and simulated by the LLM Orchestrator when using the MVME shell.)*

### Pillar 1: Robust Core Framework & Self-Evolution
*   State Management (full, including conceptual CCO import/export).
*   Modular Architecture (conceptual design).
*   Automated FEL-MH Cycle (with self-TID generation and conceptual self-code modification).
*   Dynamic Configuration (conceptual).
*   Engine File Schema Adherence (conceptual).

### Pillar 2: Advanced MHs & Cognitive Capabilities
*   Full MH Implementation (functional stubs for complex cognition, orchestrated by LLM).
*   Function Orchestration (via simulated external function calls).
*   TDE-MH: CCO phase resets, sub-MH dispatch and control flow, parallel task execution (future), handling underspecified tasks.
*   CAG-MH: Complex document structures, iterative refinement.
*   KAU-MH: Sophisticated learning, KA management, TID suggestion.
*   SEL-MH: Style learning and application.
*   PDF-MH: Product definition, initiating document, PFKB usage.
*   New Meta-Handlers (potential).

### Pillar 3: Sophisticated CCO Management
*   Rich CCO Schema.
*   Advanced CCO Querying & Analysis (simulated by orchestrator).
*   CCO Versioning & Branching (conceptual).
*   CCO Archival & Knowledge Base Integration (conceptual).

### Pillar 4: Enhanced User Interaction & Orchestration
*   Adaptive & Proactive Interaction (simulated by orchestrator).
*   Multi-Modal I/O (Future).
*   Improved Error Handling & Recovery (conceptual).
*   User-Centric Fault Tolerance.
*   Command-Oriented Interaction.
*   Interaction Models ("Propose & Confirm/Correct," "Stop and Ask").
*   Command Interception.
*   User Output (`PresentUserMessage_v3_0` or equivalent in minified engine).

### Core Architectural & Operational Requirements
*   Function-Driven (via simulated external function calls).
*   MH-Driven.
*   CCO-Centric.
*   Autologos Language (Internal Autologos v0.2).
*   Strict Adherence (conceptual).
*   Iterative Refinement (MRO).
*   Multi-Level Learning (conceptual).
*   Reflective Inquiry (simulated by orchestrator).
*   Proactive User Assistance (simulated by orchestrator).
*   Context Retention (simulated by orchestrator).
*   Zero Data Invention & Explicit Sourcing (orchestrator adheres to this).
*   No AI Generation of Dates/Times (orchestrator adheres to this).
*   Output Completeness & Metadata Integrity (orchestrator aims for this).
*   Concise Machine Voice (orchestrator uses this style).

This document clarifies that the AIOS Engine's advanced capabilities, as embodied in the conceptual `v5.0mfc-final` version, are simulated by the LLM Orchestrator using the MVME shell for execution and the verbose `AIOS_Engine_v3.3.2_stateful.py` script as the logical reference point.