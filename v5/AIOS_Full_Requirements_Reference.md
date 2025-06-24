# AIOS Full Requirements Document (Reference)

## Overarching Vision:
To create a highly autonomous, self-improving AI Orchestration System (AIOS) capable of understanding complex user goals, formulating and executing plans, generating sophisticated content and artifacts, and continuously learning to enhance its framework and effectiveness. The AIOS Engine is the core component designed to realize this vision.

## Pillar 1: Robust Core Framework & Self-Evolution
*   **State Management:** Reliable state import/export (e.g., v3.3.2-stateful).
*   **Modular Architecture:** Goal to break down monolithic scripts.
*   **Automated FEL-MH Cycle:**
    *   LLM-Driven Artefact Regeneration.
    *   Automated Testing & Validation (conceptual).
    *   TID Prioritization & Selection (potential AI assistance).
*   **Dynamic Configuration.**
*   **Engine File Schema Adherence:** (e.g., EngineMetaSchemaASO, AIOS_EngineFile_Schema_v1.3).

## Pillar 2: Advanced Meta-Heuristics (MHs) & Cognitive Capabilities
*   **Full MH Implementation:** Replace placeholders with sophisticated logic/LLM orchestration. MHs are self-contained.
*   **Function Orchestration:** MHs orchestrate external AI Cognitive Functions using Internal Autologos.
*   **TDE-MH (Task Decomposition & Execution):**
    *   CCO phase resets.
    *   Sub-MH dispatch and control flow.
    *   Parallel task execution (future).
    *   Handle underspecified tasks ("Stop and Ask").
*   **CAG-MH (Collaborative Artifact Generation):** Complex document structures, iterative refinement.
*   **KAU-MH (Knowledge Artifact Update & Synchronization):** Synthesize learnings, update KAs, suggest TIDs, manage KA lifecycle.
*   **SEL-MH (Style and Structure Learning & Application):** Infer conventions, create profiles.
*   **PDF-MH (Product Definition & Scoping):** Define product form, create initiating document, use Product Form Knowledge Base (PFKB).
*   **New Meta-Handlers:** For other complex cognitive processes.

## Pillar 3: Sophisticated CCO (Cognitive Core Object) Management
*   **Rich CCO Schema:** Robust storage (provenance, rationale, alternatives, rich media).
*   **Advanced CCO Querying & Analysis.**
*   **CCO Versioning & Branching.**
*   **CCO Archival & Knowledge Base Integration.**

## Pillar 4: Enhanced User Interaction & Orchestration
*   **Adaptive & Proactive Interaction.**
*   **Multi-Modal I/O (Future).**
*   **Improved Error Handling & Recovery.**
*   **User-Centric Fault Tolerance:** "Try to understand," clarify ambiguities.
*   **Command-Oriented Interaction:** Use ALL CAPS commands (THOUGHTS?, PLAN?, PROCEED, INVOKE).
*   **Interaction Models:** "Propose & Confirm/Correct," "Stop and Ask."
*   **Command Interception:** Graceful handling by MHs/Kernel.
*   **User Output:** Standardized `PresentUserMessage_v3_0`.

## Core Architectural & Operational Requirements
*   **Function-Driven:** Modularity, leverage external capabilities.
*   **MH-Driven:** Operations via MH Library.
*   **CCO-Centric:** All work revolves around CCO.
*   **Autologos Language:** Internal Autologos (Alpha v0.2) for internal logic.
*   **Strict Adherence:** To schemas and protocols.
*   **Iterative Refinement (MRO):** Rigorous self-critique (transformative value, info density, etc.).
*   **Multi-Level Learning:** Update KAs (LHR/LHL), evolve Engine (FEL-MH).
*   **Reflective Inquiry:** Metacognitive transparency, conceptual generalization.
*   **Proactive User Assistance:** Suggest CCO saves.
*   **Context Retention.**
*   **Zero Data Invention & Explicit Sourcing.**
*   **No AI Generation of Dates/Times.**
*   **Output Completeness & Metadata Integrity.**
*   **Concise Machine Voice.**