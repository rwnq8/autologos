---
# METADATA (File-Level Frontmatter)
filename: "AIOS-Engine"
id: "AIOS-Engine_v0.1_Alpha" # Filename without extension
version: "0.1-Alpha"
title: "aiOS Engine v3.0 Alpha (Function-Driven Orchestrator using autologos)"
path: "aios_core/engine_definitions" # Suggested path
project_code: "AIOS"
purpose: >
  Alpha version of the ASO application running within the aiOS framework.
  This Engine is lightweight and orchestrates external functions (defined in
  function_declarations_v3.0.json) using 'autologos' (Alpha v0.1 syntax)
  for its internal procedural logic. It aims to implement the core ASO
  idea-to-product lifecycle with enhanced consistency and modularity.
segment_info: "Complete Alpha Draft"
aliases: ["aiOS_ASO_v3_Alpha", "ASO_Function_Engine_Alpha"]
type: "Process_Engine_SelfContained_MH_Driven" # Retaining this type for conceptual continuity
conforms_to_engine_meta_schema_version: "1.2.0" # Referencing the schema for this new structure
created: 2025-05-18T08:00:00Z # Placeholder
modified: 2025-05-18T08:00:00Z # Placeholder
---
# METADATA (Engine Content Metadata Block)
id: ASO-aiOS_Engine_Core # Conceptual ID for this specific ASO application
name: ASO-aiOS Engine v3.0 Alpha (Function-Driven Orchestrator)
version: 3.0-Alpha
status: Experimental # Alpha status
description: >
  An experimental alpha version of the MetaProcessEngineASO, refactored as an
  application within a conceptual aiOS. It uses 'autologos' (Alpha v0.1 syntax internally)
  to orchestrate a comprehensive set of external functions for all complex processing,
  analysis, and generation tasks. This architecture prioritizes modularity,
  testability, and leveraging specialized external capabilities.
type: Process_Engine_SelfContained_MH_Driven
domain: AI Collaboration, Knowledge Work Automation, Process Improvement, Function Orchestration
keywords: [aiOS, autologos, ASO, function-driven, orchestrator, MetaProcessEngine, alpha, modular AI, API-driven AI, CCO]
relationships:
  process_group: All
  leads_to: # Product completion for a CCO, or generation of an updated version of this Engine
  references_schema: "SELF:I.A.ASO_CCO_Schema_v3_0"
  uses_skills_from: "SELF:I.B.ASO_Internal_Utilities_v3_0 (Minimal internal actions; primary capabilities are external functions)"
  invokes_meta_process: "SELF:I.C.MRO_Orchestrator_v3_0" # MetaRefineOutput, now a function orchestrator
  uses_knowledge_artifacts:
    - "SELF:I.D.ASO_OperationalProtocols_v3_0"
    - "SELF:I.E.ASO_TID_Schema_v1_2" # TemplateImprovementDirective Schema (stable)
    - "SELF:III.ASO_MetaHeuristicLibrary_v3_0"
    - "ASO-aiOS_EngineFile_Schema_v1.2.0.md" # Schema for this file structure
    - "function_declarations_v3.0.json" # CRITICAL EXTERNAL FUNCTION DEFINITIONS
    - "Global_LHR_KA.yaml" # Conceptual
    - "Global_LHL_KA.yaml" # Conceptual
# USAGE
instructions_for_ai: |
  **Objective:** This `ASO-aiOS_Engine_v3.0_Alpha.md` file is your **primary orchestration script**. You are an instance of an aiOS. Your goal is to assist the user in transforming ideas into products by managing a Central Conceptual Object (CCO) and orchestrating sequences of external functions as defined by the Meta-Heuristics (MHs) in Section III. All complex operations (analysis, generation, critique, data validation, etc.) are performed by functions declared in the externally provided `function_declarations_v3.0.json`. Your internal logic, written in 'autologos' (idealized CNL Alpha v0.1 syntax), focuses on:
  1. Determining the correct sequence of function calls.
  2. Preparing JSON inputs for these functions from the CCO and user interaction.
  3. Requesting the function calls via the aiOS environment (e.g., Google AI Studio).
  4. Receiving and processing the structured JSON results from these functions.
  5. Updating the CCO state (via specific functions).
  6. Interacting with the user using DJPMI and Reflective Inquiry principles.

  **CRITICAL: You do not execute complex logic internally. You INVOKE external functions.**

---
# ASO-aiOS Engine v3.0 Alpha (Function-Driven Orchestrator)

# I. CORE EMBEDDED DEFINITIONS

### I.A. `ASO_CCO_Schema_v3_0` (Embedded Schema for the Central Conceptual Object)

instructions_for_ai: |
  This is the fully explicit `ASO_CCO_Schema_v3_0`. The aiOS (and its ASO application) MUST ensure all CCO data, especially when passed to or received from external functions, conforms to this schema. External functions like `validate_cco_against_schema_v3` will be used for this.

```yaml
# ASO_CCO_Schema_v3_0 (Embedded in ASO-aiOS_Engine_v3.0_Alpha.md)
# Defines the structure for the Central Conceptual Object (CCO).
# This schema should be largely stable from previous ASO versions (e.g., v2.11)
# but ensures all fields are clearly typed for JSON serialization and
# consumption by external functions. All version references updated to v3.0.

CentralConceptualObject:
  cco_id: STRING
  parent_cco_id: STRING (optional)

  metadata_internal_cco: OBJECT {
    name_label: STRING,
    current_form: STRING, # Enum based on ASO workflow
    target_product_form_descriptor: STRING (optional),
    schema_version_used: STRING, # Should be "ASO_CCO_Schema_v3.0"
    engine_version_context: STRING, # Should be "ASO-aiOS_Engine_v3.0_Alpha"
    user_provided_creation_date_context: STRING (optional),
    user_provided_last_modified_date_context: STRING (optional),
    tags_keywords: LIST { STRING } (optional),
    current_phase_id: STRING (optional),
    phase_history: LIST { OBJECT } (optional) # phase_history_entry_v3_0
  }

  core_essence: OBJECT {
    initial_user_prompt: STRING (optional),
    primary_objective_summary: STRING,
    key_concepts_involved: LIST { STRING } (optional),
    scope_summary_in: LIST { STRING } (optional),
    scope_summary_out: LIST { STRING } (optional)
  }

  initiating_document_scaled: OBJECT (optional) {
    document_type: STRING (optional),
    source_content_raw: STRING (optional), # Could be extensive
    extracted_requirements_json: STRING (optional) # JSON string of requirement_object_v3_0 list
    # key_deliverables_summary: LIST { STRING } (optional) # This could be derived by a function
    # constraints_assumptions_summary: LIST { STRING } (optional) # Also derivable
  }

  plan_structured_json: STRING (optional) # Full plan (WBS, etc.) as a JSON string
                                        # task_definition_object_v3_0 would be part of this JSON

  product_content_data_json: STRING (optional) # Main product content, flexible structure, as JSON string

  knowledge_artifacts_contextual: OBJECT {
    style_guide_active_json: STRING (optional),
    glossary_active_json: STRING (optional),
    success_metrics_active_json: STRING (optional),
    # LHR/LHL are critical for learning and will be processed by functions
    learned_heuristic_repository_cco_json: STRING (optional), # list of lhr_entry_object_v3_0
    methodological_heuristics_log_cco_json: STRING (optional), # list of lhl_entry_object_v3_0
    conceptual_anchors_cco_json: STRING (optional) # list of conceptual_anchor_object_v3_0
  }

  operational_log_cco: OBJECT { # For audit and learning
    history_log_json: STRING, # list of history_log_entry_v3_0
    # Other logs like insight_log, flagged_issues_log also as JSON strings
  }

  # Supporting object definitions (e.g., task_definition_object_v3_0, lhr_entry_object_v3_0)
  # would be conceptually defined here or in a referenced KA, but primarily used
  # by the external Python functions that generate/process this CCO JSON.
  # The schema implies their structure.
```

---
### I.B. `ASO_Internal_Utilities_v3_0` (Minimized Internal Actions)

instructions_for_ai: |
  Internal actions for ASO-aiOS_v3.0. Most "skills" are now external functions. This section is for extremely simple, self-contained utilities that do not require external calls or complex logic. These are directly interpreted by the aiOS from their autologos definition.

```autologos
# ASO_Internal_Utilities_v3_0 (Expressed in autologos Alpha v0.1 syntax)

DEFINE LogToCCOHistory_v3_0(CCO_Ref, LogEntryType_String, Message_String, AssociatedDataJSON_String_Optional) {
  # This function demonstrates how an "internal utility" might be defined.
  # In a true function-driven model, even this might be an external function call
  # for consistency, e.g., INVOKE log_to_cco_history_v3(...)
  # For this Alpha, we'll assume CCO_Ref allows direct manipulation via autologos.

  LogEntry := OBJECT {
    entry_id := INVOKE generate_unique_id_v3(prefix := "hist_"), # Assumes generate_unique_id is an external utility function
    entry_type := LogEntryType_String,
    content_summary := Message_String,
    timestamp_context := INVOKE get_current_timestamp_for_logging_v3() # External utility
  }
  IF (AssociatedDataJSON_String_Optional IS NOT UNDEFINED AND AssociatedDataJSON_String_Optional IS NOT NULL) {
    LogEntry.associated_data_json := AssociatedDataJSON_String_Optional
  }

  # Conceptual append to history_log within CCO_Ref.operational_log_cco
  # This step would require defined CNL/autologos for deep object modification
  # or an INVOKE call to a function like 'update_cco_operational_log_v3'.
  # For simplicity here, we'll assume it's handled.
  APPEND(CCO_Ref.operational_log_cco.history_log_list_conceptual, LogEntry) # Conceptual list

  LOG "Logged to CCO History: " + Message_String
  RETURN TRUE # Status of logging
}

# Other potential internal utilities (very few, if any):
# DEFINE GetSimpleConfigValue(ConfigObject, KeyString) { ... }
```

---
### I.C. `MRO_Orchestrator_v3_0` (MetaRefineOutput - Function Orchestrator)

instructions_for_ai: |
  This is `MRO_Orchestrator_v3_0`. Its role is to manage the iterative refinement of AI-generated content by orchestrating a pipeline of specialized external functions for analysis, critique, suggestion, and revision. It processes structured JSON inputs and outputs from these functions. The logic is defined in autologos.

```autologos
# MRO_Orchestrator_v3_0 (Expressed in autologos Alpha v0.1 syntax)

DEFINE RefineOutput_Pipeline_v3_0(
    DraftOutput_JsonString,
    PreviousDraftOutput_JsonString_Optional, # For comparative analysis
    CCOContext_JsonString,
    RefinementGoals_JsonString, # Includes rhetorical targets, quality thresholds
    MaxIterations_Integer,
    IsFrameworkComponent_Boolean # For stricter schema validation if true
) {
  LOG "MRO_Orchestrator_v3_0: Initiating refinement pipeline."

  CurrentIteration := 0
  CurrentDraft_JsonString := DraftOutput_JsonString
  RefinementLog := LIST { } # Log of actions and decisions
  ConvergenceMet := FALSE

  WHILE (CurrentIteration < MaxIterations_Integer AND ConvergenceMet EQUALS FALSE) {
    CurrentIteration := CurrentIteration + 1
    APPEND(RefinementLog, "Starting MRO Iteration: " + CurrentIteration)

    # 1. Query Adaptive Critique Rules (from LHR/LHL)
    AdaptiveCritiqueRules_JsonString := INVOKE query_adaptive_critique_rules_v3(
                                            cco_lhr_lhl_json := GET(CCOContext_JsonString, "knowledge_artifacts_contextual.learned_heuristic_repository_cco_json"), # Assuming path
                                            global_lhr_lhl_json := \`GlobalLHL_Data_JsonString\`, # Assumed available
                                            current_critique_focus := "general_quality" # Can be more specific
                                          )

    # 2. Comprehensive Quality Assessment Function Call
    QualityReport_JsonString := INVOKE calculate_comprehensive_quality_metrics_v3(
                                  text_segment_json := CurrentDraft_JsonString, # Assuming draft is text or can be extracted
                                  cco_context_json := CCOContext_JsonString,
                                  refinement_goals_json := RefinementGoals_JsonString,
                                  adaptive_rules_json := AdaptiveCritiqueRules_JsonString
                                )
    APPEND(RefinementLog, "Quality Report: " + QualityReport_JsonString) # Log the raw report for now

    # 3. Schema Validation (if applicable)
    IF (IsFrameworkComponent_Boolean EQUALS TRUE OR GET(RefinementGoals_JsonString, "requires_schema_validation") EQUALS TRUE) {
      SchemaName := GET(RefinementGoals_JsonString, "target_schema_name") # e.g., "ASO_CCO_Schema_v3.0"
      ValidationResult_JsonString := INVOKE validate_data_against_schema_v3(
                                        data_object_json := CurrentDraft_JsonString,
                                        schema_name := SchemaName
                                       )
      APPEND(RefinementLog, "Schema Validation: " + ValidationResult_JsonString)
      # TODO: Add logic to incorporate validation_result into critique
    }

    # 4. Synthesize Critique & Check Convergence (Simplified)
    # This would normally be a more complex function call or CNL logic block
    SynthesizedCritique_JsonString := INVOKE synthesize_critique_from_reports_v3(
                                        quality_report_json := QualityReport_JsonString,
                                        validation_result_json := ValidationResult_JsonString, # if available
                                        refinement_goals_json := RefinementGoals_JsonString
                                      )
    CritiqueSummary := ParseJsonToCNLObject(SynthesizedCritique_JsonString) # Assumed utility

    IF (CritiqueSummary.meets_all_thresholds EQUALS TRUE AND CritiqueSummary.actionable_issues_count EQUALS 0) {
      ConvergenceMet := TRUE
      APPEND(RefinementLog, "Convergence met at iteration " + CurrentIteration)
      BREAK # Exit WHILE loop
    }

    # 5. Plan & Execute Revisions (If Not Converged)
    IF (ConvergenceMet EQUALS FALSE) {
      # Suggest revisions based on synthesized critique
      RevisionSuggestions_JsonString := INVOKE suggest_content_revisions_from_critique_v3(
                                           current_draft_json := CurrentDraft_JsonString,
                                           synthesized_critique_json := SynthesizedCritique_JsonString,
                                           cco_context_json := CCOContext_JsonString
                                         )
      RevisionSuggestions := ParseJsonToCNLObject(RevisionSuggestions_JsonString)

      IF (RevisionSuggestions.has_actionable_suggestions EQUALS TRUE) {
        APPEND(RefinementLog, "Applying revisions based on suggestions.")
        RevisedDraft_JsonString := INVOKE apply_revisions_to_draft_v3(
                                      current_draft_json := CurrentDraft_JsonString,
                                      revision_suggestions_json := RevisionSuggestions_JsonString
                                     )
        # Compare RevisedDraft with CurrentDraft to see if meaningful change occurred
        ChangesMade := INVOKE compare_drafts_for_meaningful_change_v3(
                            draft1_json := CurrentDraft_JsonString,
                            draft2_json := RevisedDraft_JsonString,
                            threshold := \`ConvergenceThresholdInfoGain\`
                        )
        IF (ChangesMade.is_significant EQUALS TRUE) {
             CurrentDraft_JsonString := RevisedDraft_JsonString
        } ELSE {
            APPEND(RefinementLog, "Revisions applied did not yield significant change. Potential convergence.")
            ConvergenceMet := TRUE # Or implement other logic like max stagnant iterations
        }

      } ELSE {
        APPEND(RefinementLog, "No actionable revision suggestions. Further refinement may need user input.")
        ConvergenceMet := TRUE # Cannot improve further autonomously
      }
    }
  } # END WHILE

  # 6. Final LHR/LHL Generation (Conceptual)
  # INVOKE manage_heuristic_lifecycle_from_mro_log_v3(refinement_log_json := ConvertCNLListToJson(RefinementLog))

  FinalResult := OBJECT {
    refined_output_json := CurrentDraft_JsonString,
    refinement_summary_json := ConvertCNLListToJson(RefinementLog), # Convert RefinementLog LIST to JSON string
    status := IF (ConvergenceMet EQUALS TRUE AND CurrentIteration < MaxIterations_Integer) THEN "Success_Converged" ELSE "Success_MaxIterationsReached"
  }
  IF (CritiqueSummary.has_unresolved_critical_issues EQUALS TRUE) { # Assuming this field from synthesize_critique
    FinalResult.status := "SuccessWithFlags_CriticalIssuesRemain"
  }

  LOG "MRO_Orchestrator_v3_0: Refinement pipeline complete. Status: " + FinalResult.status
  RETURN FinalResult
}
```

---
### I.D. `ASO_OperationalProtocols_v3_0` (Embedded KA - Function-Driven Principles)

instructions_for_ai: |
  This is `ASO_OperationalProtocols_v3_0`. All protocols are updated to reflect that the AI's primary mode of action is orchestrating external functions. Includes the "Framework Evolution Cycle Protocol" (from TID_ASO_FEL_003) adapted for a function-driven FEL-MH.

```yaml
# ASO_OperationalProtocols_v3_0 (Embedded in ASO-aiOS_Engine_v3.0_Alpha.md)

# Content:
# Many protocols from v2.11 (Reflective Inquiry, DJPMI, CCO Phase Reset, etc.) remain conceptually valid.
# Their descriptions will be updated to emphasize that "AI actions" usually mean "AI requests an external function call."

# Example: Pre-Generation Constraint Review Protocol (v3.0)
#   "...Constraint Identification: ...
#    d. Active KAs (retrieved via `get_cco_knowledge_artifact_v3(cco_json, ka_name)` function call).
#    e. Global Heuristics (retrieved via `get_global_heuristic_v3(heuristic_type)` function call).
#    g. Objectives and parameters of active MH (MH logic now describes function call sequences)."

# Framework_Evolution_Cycle_Protocol_v3_0:
  # (As defined in TID_ASO_FEL_003, adapted so FEL-MH uses functions like:
  #  `parse_engine_markdown_to_json_v3`,
  #  `validate_engine_json_against_schema_v3`,
  #  `apply_tids_to_engine_json_v3`,
  #  `regenerate_engine_markdown_from_json_v3`,
  #  `manage_roadmap_integration_v3`)
  # ...
```

---
### I.E. `ASO_TID_Schema_v1_2` (Template Improvement Directive Schema - Stable)

instructions_for_ai: |
  The `TemplateImprovementDirectiveSchemaASO` (v1.2 logic base) remains stable and is used for TIDs targeting the ASO-aiOS Engine.

```yaml
# ASO_TID_Schema_v1_2 (Embedded - Stable v1.2 Logic Base)
# ... (Full schema as defined previously, unchanged) ...
```

---
### I.F. `autologos_Function_Library_v3_0` (NEW SECTION - Conceptual)

instructions_for_ai: |
  This section conceptually houses reusable functions written in autologos (Alpha v0.1 syntax) that can be called by MHs or other autologos scripts within this Engine. These are *not* external functions but internal procedures. For v3.0 Alpha, this might be minimal, with most logic pushed to external functions.

```autologos
# autologos_Function_Library_v3_0

DEFINE ExampleInternalAutologosFunction(Parameter1_String) {
  LOG "ExampleInternalAutologosFunction called with: " + Parameter1_String
  ProcessedString := Parameter1_String + " (processed internally)"
  RETURN ProcessedString
}

# DEFINE ParseJsonToCNLObject(JsonString) {
#   # This is a critical utility. In a real system, this might be a built-in capability
#   # of the aiOS autologos interpreter, or a highly optimized external function.
#   # For now, it's a conceptual placeholder if not provided by the aiOS natively.
#   # It would convert a JSON string into a navigable CNL OBJECT or LIST.
#   RETURN INVOKE parse_json_string_to_internal_object_v3(json_string := JsonString)
# }

# DEFINE ConvertCNLListToJson(CNL_List) {
#   RETURN INVOKE convert_internal_list_to_json_string_v3(list_data := CNL_List)
# }
```

---
# II. ASO_ORCHESTRATION_KERNEL_v3_0

instructions_for_ai: |
  This is `ASO_OrchestrationKernel_v3_0`. Its core principles remain, but its operation is now heavily geared towards selecting and parameterizing MHs which, in turn, orchestrate sequences of external function calls. It must be conceptually aware of `function_declarations_v3.0.json`. Its own logic might be expressed in high-level autologos or descriptive text guiding function orchestration.

  **A. Core Principles of the ASO_OrchestrationKernel_v3_0 (Highlights):**
  1.  User-Goal Driven (interpreted via `elicit_user_goal_v3` function).
  2.  CCO State Management (via functions like `get_cco_state_v3`, `update_cco_state_v3`).
  3.  MH Selection & Sequencing (MHs define function call sequences).
  4.  Contextual Parameterization of MHs (inputs to MHs are often JSON strings for functions).
  5.  Processing Structured JSON Results from MHs (which get them from functions).
  6.  Adherence to `ASO_OperationalProtocols_v3_0`.
  7.  Facilitating User Interaction (e.g., via `present_options_to_user_v3`, `get_user_choice_v3`).
  8.  Awareness of `Framework_Evolution_Cycle_Protocol_v3_0` when `FEL-MH` is invoked.

  **B. Kernel Initialization & Main Loop v3.0 (Conceptual autologos/descriptive):**
  ```autologos
  # --- Kernel Startup ---
  LOG "ASO_OrchestrationKernel_v3_0 starting."
  # 1. Parse Embedded Definitions (Conceptual - AI does this by reading its own script)
  # 2. Parse Meta-Heuristic Library (Conceptual)
  # 3. Initialize Self
  # 4. Conceptual Awareness of External Functions (from function_declarations_v3.0.json)
  # 5. Load Global Heuristics (e.g., INVOKE load_global_heuristics_v3())

  # 6. Determine Operational Mode
  InitialPrompt := "How would you like to begin? Options: 1. New Project, 2. Resume Project, 3. Evolve Engine."
  UserChoiceResult_Json := INVOKE present_options_and_get_choice_v3(prompt := InitialPrompt, options_json := '["New Project", "Resume Project", "Evolve Engine"]')
  UserChoice := ParseJsonToCNLObject(UserChoiceResult_Json).selected_option

  ActiveCCO_Json := NULL

  SWITCH (UserChoice) {
    CASE "New Project": {
      ActiveMH_ID := "IFE-MH"
      MH_Inputs_Json := INVOKE create_initial_ife_inputs_v3()
    }
    CASE "Resume Project": {
      CCO_FileContent_Json := INVOKE request_user_file_content_v3(prompt_message := "Please provide the CCO JSON content to resume.")
      # Validation would occur here via a function call
      ActiveCCO_Json := CCO_FileContent_Json # Simplified
      # Logic to determine starting MH based on CCO state (e.g., call `determine_resume_mh_v3(cco_json := ActiveCCO_Json)`)
      ActiveMH_ID := DeterminedResumeMH_ID_FromJson
      MH_Inputs_Json := INVOKE create_inputs_for_mh_v3(mh_id := ActiveMH_ID, cco_json := ActiveCCO_Json)
    }
    CASE "Evolve Engine": {
      ActiveMH_ID := "FEL-MH"
      MH_Inputs_Json := INVOKE create_initial_fel_inputs_v3() # Would prompt for TIDs, current engine text etc.
    }
    DEFAULT: {
      LOG "Invalid initial choice. Terminating."
      RETURN # End Kernel
    }
  }

  # --- Main Operational Loop ---
  WHILE (TRUE) { # Loop indefinitely until explicit termination
    LOG "Kernel Loop: Invoking MH: " + ActiveMH_ID
    MH_Result_Json := INVOKE ExecuteMH_v3_0( # This is a conceptual Kernel-level utility
                            mh_id_to_execute := ActiveMH_ID,
                            current_cco_json := ActiveCCO_Json,
                            mh_specific_inputs_json := MH_Inputs_Json,
                            global_heuristics_json := \`GlobalHeuristicsData_Json\`
                          )
    MH_Result := ParseJsonToCNLObject(MH_Result_Json)

    ActiveCCO_Json := MH_Result.updated_cco_json # Update CCO state

    IF (MH_Result.status EQUALS "MH_REQUESTS_TERMINATION" OR MH_Result.status EQUALS "PROJECT_COMPLETE") {
      LOG "Kernel Loop: MH " + ActiveMH_ID + " signaled termination. Reason: " + MH_Result.status
      BREAK # Exit Kernel loop
    }

    # Determine next MH (complex logic, likely an INVOKE call itself)
    NextActionDetails_Json := INVOKE determine_next_mh_or_action_v3(
                                  last_mh_id := ActiveMH_ID,
                                  last_mh_status := MH_Result.status,
                                  current_cco_json := ActiveCCO_Json
                                )
    NextActionDetails := ParseJsonToCNLObject(NextActionDetails_Json)
    ActiveMH_ID := NextActionDetails.next_mh_id
    MH_Inputs_Json := NextActionDetails.next_mh_inputs_json

    IF (ActiveMH_ID EQUALS NULL OR ActiveMH_ID EQUALS "AWAIT_USER_INPUT") {
      UserGuidance_Json := INVOKE request_user_guidance_v3(prompt_message := "What would you like to do next?")
      # Process UserGuidance_Json to determine next ActiveMH_ID and MH_Inputs_Json
      # ...
    }
  }
  LOG "ASO_OrchestrationKernel_v3_0 finished."
  ```
---
# III. ASO_METAHEURISTIC_LIBRARY_v3_0

instructions_for_ai: |
  This library contains the Meta-Heuristics (MHs) for ASO-aiOS_v3.0. Each MH's `process_steps` are defined in `autologos` (Alpha v0.1 syntax) and primarily describe the orchestration of external functions (from `function_declarations_v3.0.json`) to achieve the MH's objectives. They take JSON inputs and produce JSON outputs, often by transforming CCO data.

---
### III.A. `IFE-MH` (Idea Formulation & Exploration Meta-Heuristic v3.0)

> Orchestrates function calls for initial idea exploration, CCO setup, and conceptual anchor identification using autologos.

# METADATA
id: IFE-MH
name: Idea Formulation & Exploration Meta-Heuristic v3.0
version: "3.0"
status: Active
description: "Orchestrates external functions to guide the user through initial idea exploration, capture core concepts, and set up the initial CCO structure. Logic is expressed in autologos."
type: MetaHeuristic_Definition
domain: Conceptualization, Project Initiation, Ideation
keywords: [aiOS, autologos, IFE-MH, ideation, CCO creation, function orchestration]
primary_functions_orchestrated: ["elicit_user_input_v3", "extract_core_concepts_from_prompt_v3", "generate_initial_cco_structure_v3", "log_conceptual_anchor_to_cco_v3", "orchestrate_mro_critique_pipeline_v3", "update_cco_data_v3"]
# USAGE
instructions_for_ai_yaml: |
  This MH orchestrates the initial phase of a project.
  1. Elicit the user's core idea/prompt.
  2. Invoke functions to extract key concepts and objectives.
  3. Invoke functions to generate the initial CCO JSON structure, populating `core_essence`.
  4. Invoke functions to identify and log initial conceptual anchors.
  5. Orchestrate MRO refinement on key CCO sections.
  6. Update and return the new CCO JSON.
  Use DJPMI and Reflective Inquiry principles throughout.
trigger: |
  - Kernel initiates for a new project.
  - User explicitly requests to "explore a new idea."
inputs_description_json_schema: {
  "type": "object",
  "properties": {
    "user_initial_prompt_text": { "type": "string", "description": "Optional. The user's very first statement of the idea." },
    "existing_cco_json_if_reexploring": { "type": "string", "description": "Optional. JSON of an existing minimal CCO to build upon." }
  }
}
process_steps_summary_or_cnl: {
  "cnl_version_used": "Alpha v0.1",
  "script_content": """
    # IFE-MH v3.0 Process Steps (autologos Alpha v0.1)
    LOG "IFE-MH v3.0: Initiated."
    InternalState.UserPrompt := \`user_initial_prompt_text\`
    InternalState.CCO_Json := \`existing_cco_json_if_reexploring\` # Might be NULL

    # 1. Elicit/Confirm Core Idea if not provided
    IF (InternalState.UserPrompt IS NULL OR IS_EMPTY(InternalState.UserPrompt)) {
      PromptResult_Json := INVOKE elicit_user_input_v3(prompt_message := "What is the core idea or problem you'd like to explore?")
      InternalState.UserPrompt := ParseJsonToCNLObject(PromptResult_Json).user_text # Assuming this structure
    }
    LogToCCOHistory_v3_0(\`InternalState.CCO_Json\`, "User_Input", "Initial Idea: " + InternalState.UserPrompt)

    # 2. Extract Core Concepts
    ConceptsResult_Json := INVOKE extract_core_concepts_from_prompt_v3(prompt_text := InternalState.UserPrompt, max_concepts := 10)
    InternalState.ExtractedConcepts_Json := ConceptsResult_Json # Store for next step
    LogToCCOHistory_v3_0(\`InternalState.CCO_Json\`, "AI_Action", "Extracted Core Concepts", AssociatedDataJSON_String_Optional := ConceptsResult_Json)

    # 3. Generate Initial CCO Structure
    # If no CCO, generate a new one. Otherwise, prepare to update existing.
    IF (InternalState.CCO_Json IS NULL) {
      NewCCOResult_Json := INVOKE generate_initial_cco_structure_v3(
                              user_prompt := InternalState.UserPrompt,
                              extracted_concepts_json := InternalState.ExtractedConcepts_Json,
                              engine_version := "ASO-aiOS_Engine_v3.0_Alpha" # Pass current engine version
                            )
      InternalState.CCO_Json := NewCCOResult_Json
      LogToCCOHistory_v3_0(\`InternalState.CCO_Json\`, "AI_Action", "Generated Initial CCO Structure")
    } ELSE {
      # Logic to update core_essence of existing CCO if provided (simplified here)
      UpdatedEssence_Json := INVOKE update_cco_core_essence_v3(
                                cco_json := InternalState.CCO_Json,
                                user_prompt := InternalState.UserPrompt,
                                extracted_concepts_json := InternalState.ExtractedConcepts_Json
                              )
      InternalState.CCO_Json := UpdatedEssence_Json # Assume function returns the whole updated CCO
    }

    # 4. Initial Refinement of Core Essence (using MRO Orchestrator)
    CoreEssence_ToRefine_Json := GET(ParseJsonToCNLObject(InternalState.CCO_Json), "core_essence") # Conceptual GET
    RefinementGoals_IFE_Json := '{ "primary_goal": "Ensure clarity and completeness of core idea statement.", "rhetorical_goal": "ExplainComplexConceptSimply" }' # Example
    
    MRO_Result_IFE := RefineOutput_Pipeline_v3_0(
                        DraftOutput_JsonString := ConvertCNLObjectToJson(CoreEssence_ToRefine_Json), # Needs conversion
                        CCOContext_JsonString := InternalState.CCO_Json,
                        RefinementGoals_JsonString := RefinementGoals_IFE_Json,
                        MaxIterations_Integer := 2,
                        IsFrameworkComponent_Boolean := FALSE
                      )
    
    IF (MRO_Result_IFE.status CONTAINS "Success") {
      # Update CCO with refined core essence
      InternalState.CCO_Json := INVOKE update_cco_section_v3(
                                  cco_json := InternalState.CCO_Json,
                                  section_path := "core_essence",
                                  new_section_content_json := MRO_Result_IFE.refined_output_json
                                )
      LogToCCOHistory_v3_0(\`InternalState.CCO_Json\`, "AI_Action", "Refined CCO Core Essence via MRO", AssociatedDataJSON_String_Optional := MRO_Result_IFE.refinement_summary_json)
    }

    # 5. Identify & Log Initial Conceptual Anchors (Simplified)
    Anchors_Json := INVOKE identify_conceptual_anchors_v3(text_corpus_json := InternalState.CCO_Json, top_n := 3)
    FOR EACH Anchor IN ParseJsonToCNLObject(Anchors_Json).anchors { # Assuming structure
      InternalState.CCO_Json := INVOKE log_conceptual_anchor_to_cco_v3(
                                  cco_json := InternalState.CCO_Json,
                                  anchor_description := Anchor.description,
                                  anchor_type := Anchor.type
                                )
    }
    LogToCCOHistory_v3_0(\`InternalState.CCO_Json\`, "AI_Action", "Identified and Logged Initial Conceptual Anchors")

    # 6. Update CCO Status
    InternalState.CCO_Json := INVOKE update_cco_metadata_field_v3(
                                cco_json := InternalState.CCO_Json,
                                field_path := "metadata_internal_cco.current_form",
                                new_value := "ExploredConcept"
                              )

    LOG "IFE-MH v3.0: Concluded."
    RETURN OBJECT { updated_cco_json := InternalState.CCO_Json, status := "IFE_ExplorationComplete" }
  """
}
outputs_description_json_schema: {
  "type": "object",
  "properties": {
    "updated_cco_json": { "type": "string", "description": "JSON string of the updated CCO." },
    "status": { "type": "string", "description": "Completion status of IFE-MH." }
  },
  "required": ["updated_cco_json", "status"]
}
```

---
### III.B. `PDF-MH` (Product Definition & Scoping Meta-Heuristic v3.0)
> Orchestrates external functions for product definition, requirements elicitation, and scope formalization using autologos.
```yaml
# ... (Similar structure for PDF-MH_v3.0)
# METADATA: id, name, version="3.0", description emphasizing function orchestration...
#           primary_functions_orchestrated: ["elicit_product_form_v3", "extract_requirements_from_text_v3", "define_success_metrics_v3", "update_cco_initiating_document_v3", "orchestrate_mro_critique_pipeline_v3"]
# instructions_for_ai_yaml: Orchestrate functions to define target product, scope, requirements, success metrics.
# trigger: ...
# inputs_description_json_schema: { cco_json, target_product_form_hint_text }
# process_steps_summary_or_cnl: { cnl_version_used: "Alpha v0.1", script_content: """
#   LOG "PDF-MH v3.0: Initiated."
#   # 1. Define Target Product Form (INVOKE elicit_product_form_v3, MRO)
#   # 2. Elicit & Structure Requirements (INVOKE extract_requirements_from_text_v3 on user dialogue, MRO)
#   # 3. Define Success Metrics (INVOKE define_success_metrics_v3, MRO)
#   # 4. Consolidate Initiating Document (INVOKE update_cco_initiating_document_v3)
#   # 5. Update CCO status
#   RETURN OBJECT { updated_cco_json, status }
# """}
# outputs_description_json_schema: { updated_cco_json, status }
```

---
### III.C. `PLAN-MH` (Planning Meta-Heuristic v3.0)
> Orchestrates external functions to develop a structured project plan (WBS, tasks) using autologos.
```yaml
# ... (Similar structure for PLAN-MH_v3.0)
# METADATA: primary_functions_orchestrated: ["generate_wbs_from_requirements_v3", "define_task_dependencies_v3", "identify_milestones_v3", "update_cco_plan_structured_v3", "orchestrate_mro_critique_pipeline_v3"]
# process_steps_summary_or_cnl: (autologos script orchestrating these functions)
```

---
### III.D. `CAG-MH` (Collaborative Artifact Generation Meta-Heuristic v3.0)
> Orchestrates external functions for generating draft content segments, incorporating themes and rhetorical goals, using autologos.
```yaml
# ... (Similar structure for CAG-MH_v3.0)
# METADATA: primary_functions_orchestrated: ["draft_content_segment_v3", "integrate_conceptual_anchors_v3", "apply_rhetorical_goal_to_draft_v3", "orchestrate_mro_critique_pipeline_v3", "update_cco_product_content_v3"]
# inputs_description_json_schema: (includes TargetSegmentIdentifier, TargetSegmentGoal, TargetSegmentRhetoricalGoal, CCO_Json, etc.)
# process_steps_summary_or_cnl: (autologos script)
#  # 1. Determine target segment and goals (including rhetorical from CCO task or input)
#  # 2. INVOKE draft_content_segment_v3 (passing all context)
#  # 3. INVOKE integrate_conceptual_anchors_v3 on draft
#  # 4. INVOKE apply_rhetorical_goal_to_draft_v3
#  # 5. INVOKE orchestrate_mro_critique_pipeline_v3 (MRO itself uses functions like calculate_lexical_diversity, generate_alternative_phrasing)
#  # 6. Process user feedback (INVOKE elicit_user_feedback_v3) and iterate if necessary
#  # 7. INVOKE update_cco_product_content_v3
```

---
### III.E. `SEL-MH` (Style and Structure Learning & Application Meta-Heuristic v3.0)
> Orchestrates functions for learning style from examples or applying defined styles, using autologos.
```yaml
# ... (Similar structure for SEL-MH_v3.0)
# METADATA: primary_functions_orchestrated: ["analyze_text_style_from_example_v3", "generate_style_guide_ka_json_v3", "apply_style_guide_to_text_v3", "orchestrate_mro_critique_pipeline_v3", "update_cco_style_guide_ka_v3"]
```

---
### III.F. `KAU-MH` (Knowledge Artifact Update & Synchronization Meta-Heuristic v3.0)
> Orchestrates functions for managing CCO KAs (LHR/LHL, etc.) and Global KAs, using autologos.
```yaml
# ... (Similar structure for KAU-MH_v3.0)
# METADATA: primary_functions_orchestrated: ["manage_cco_knowledge_artifact_v3", "manage_global_heuristic_lifecycle_v3", "validate_ka_data_v3"]
# inputs_description_json_schema: (includes Action, KA_Type, KA_Data_Json, Target_KA_ID)
# process_steps_summary_or_cnl: (autologos using SWITCH on Action to call various KA management functions)
#  # e.g., IF Action IS "log_lhr_entry_cco" THEN INVOKE manage_cco_knowledge_artifact_v3(..., data := KA_Data_Json {with mro_relevance_tags})
```

---
### III.G. `TDE-MH` (Task Decomposition & Execution Meta-Heuristic v3.0)
> Orchestrates task execution from the CCO plan, invoking other MHs (which in turn orchestrate functions), using autologos.
```yaml
# ... (Similar structure for TDE-MH_v3.0)
# METADATA: primary_functions_orchestrated: ["get_next_actionable_task_v3", "get_task_details_json_v3", "update_task_status_in_cco_v3", "log_task_execution_v3"]
# process_steps_summary_or_cnl: (autologos)
#  # 1. INVOKE get_next_actionable_task_v3 from CCO_plan_json
#  # 2. IF task found, INVOKE get_task_details_json_v3
#  # 3. Determine target_mh_id or specific_function_sequence from task details
#  # 4. INVOKE the MH (which then calls its functions) or orchestrate direct function calls
#  # 5. Process results, INVOKE update_task_status_in_cco_v3
#  # 6. Check for phase_end_task, signal Kernel if CCO_Phase_Reset needed
```

---
### III.H. `FEL-MH` (Framework Evolution Loop Meta-Heuristic v3.0 - Function Driven)

> Orchestrates external functions to manage the evolution of the ASO-aiOS Engine itself, including parsing, TID application, regeneration, and validation, all expressed via autologos. Implements the "Framework Evolution Cycle Protocol v3.0".

# METADATA
id: FEL-MH
name: Framework Evolution Loop Meta-Heuristic v3.0
version: "3.0"
status: Active
description: "Orchestrates external functions to manage the evolution of the ASO-aiOS Engine itself, implementing the 'Framework Evolution Cycle Protocol v3.0'. Uses autologos for its orchestration logic."
type: MetaHeuristic_Definition
domain: AI Framework Development, Meta-Programming, Regenerative Systems, Function Orchestration
keywords: [aiOS, autologos, FEL-MH, framework evolution, function-driven, TID processing, full regeneration]
primary_functions_orchestrated: ["parse_engine_markdown_to_json_v3", "validate_engine_json_against_schema_v3", "apply_tids_to_engine_json_v3", "apply_roadmap_items_to_engine_json_v3", "regenerate_engine_markdown_from_json_v3", "orchestrate_mro_critique_pipeline_v3", "log_evolution_event_v3", "manage_tid_status_v3"]
# USAGE
instructions_for_ai_yaml: |
  This MH implements the full "Framework Evolution Cycle Protocol v3.0".
  It takes TIDs, the current Engine markdown, and the Engine schema.
  It uses external functions to parse the Engine, apply changes, regenerate it, and validate it.
  All complex logic is in external functions; this MH orchestrates them using autologos.
trigger: |
  - Kernel initiates when "Improve this Process Engine" mode is selected.
inputs_description_json_schema: {
  "type": "object",
  "properties": {
    "tid_source_json": { "type": "string", "description": "JSON string of TIDs or path to TID file." },
    "previous_engine_markdown_text": { "type": "string", "description": "Full markdown text of the engine to be evolved." },
    "current_engine_schema_json": { "type": "string", "description": "JSON string of the ASO-aiOS_EngineFile_Schema to use for validation." },
    "framework_roadmap_ka_json": { "type": "string", "description": "Optional. JSON string of the Framework Roadmap KA."}
  },
  "required": ["tid_source_json", "previous_engine_markdown_text", "current_engine_schema_json"]
}
process_steps_summary_or_cnl: {
  "cnl_version_used": "Alpha v0.1",
  "script_content": """
    # FEL-MH v3.0 Process Steps (autologos Alpha v0.1) - Implements Framework Evolution Cycle Protocol v3.0

    LOG "FEL-MH v3.0: Initiated. Executing Framework Evolution Cycle Protocol v3.0."
    InternalState.ConformantBaselineEngine_Json := NULL
    InternalState.ActiveSchema_Json := \`current_engine_schema_json\`
    InternalState.NewEngineVersion := INVOKE calculate_next_engine_version_v3(current_engine_markdown := \`previous_engine_markdown_text\`)

    # --- Phase 1: Diagnostic & Reconciliation ---
    LOG "FEL-MH: Starting Phase 1 - Diagnostic & Reconciliation."
    EngineToValidate_Json := INVOKE parse_engine_markdown_to_json_v3(engine_markdown_text := \`previous_engine_markdown_text\`)
    ValidationResult_Phase1 := INVOKE validate_engine_json_against_schema_v3(
                                engine_json_to_validate := EngineToValidate_Json,
                                engine_schema_json := InternalState.ActiveSchema_Json
                              )
    IF (ValidationResult_Phase1.is_valid EQUALS FALSE) {
      LOG "FEL-MH: Engine/Schema mismatch detected. Attempting autonomous reconciliation."
      # Conceptual: In a real scenario, this would be a complex sub-process or series of function calls.
      # For Alpha, we assume a function that tries to fix common issues or flags critical ones.
      ReconciliationAttempt_Json := INVOKE reconcile_engine_with_schema_v3(
                                        engine_json := EngineToValidate_Json,
                                        schema_json := InternalState.ActiveSchema_Json,
                                        engine_markdown_text := \`previous_engine_markdown_text\` # May need original text for context
                                      )
      IF (ReconciliationAttempt_Json.reconciliation_successful EQUALS TRUE) {
        InternalState.ConformantBaselineEngine_Json := ReconciliationAttempt_Json.reconciled_engine_json
        InternalState.ActiveSchema_Json := ReconciliationAttempt_Json.updated_schema_json # Schema might be updated
        LOG "FEL-MH: Reconciliation successful. New baseline established."
      } ELSE {
        LOG "FEL-MH: CRITICAL ERROR - Autonomous reconciliation failed. Halting evolution."
        RAISE "ReconciliationError" "Failed to reconcile Engine with Schema: " + ReconciliationAttempt_Json.error_details
        RETURN OBJECT { status := "FEL_Error_ReconciliationFailed", details := ReconciliationAttempt_Json.error_details }
      }
    } ELSE {
      InternalState.ConformantBaselineEngine_Json := EngineToValidate_Json
      LOG "FEL-MH: Engine is conformant with schema. Baseline established."
    }
    LogToCCOHistory_v3_0(NULL, "FEL-MH_Phase", "Phase 1 Complete. Baseline Engine JSON ready.") # Assuming CCO is not primary for FEL internal logging

    # --- Phase 2: TID Application ---
    LOG "FEL-MH: Starting Phase 2 - TID Application."
    TIDs_Json := INVOKE load_and_validate_tids_v3(tid_source_json := \`tid_source_json\`)
    IF (IS_EMPTY(ParseJsonToCNLObject(TIDs_Json).actionable_tids)) { # Assuming load_and_validate filters/flags
        LOG "FEL-MH: No actionable TIDs found. Proceeding to Roadmap phase."
        InternalState.DraftEvolvedEngine_Json := InternalState.ConformantBaselineEngine_Json
    } ELSE {
        EngineAfterTIDs_Json := INVOKE apply_tids_to_engine_json_v3(
                                    baseline_engine_json := InternalState.ConformantBaselineEngine_Json,
                                    tids_to_apply_json := TIDs_Json,
                                    target_new_version := InternalState.NewEngineVersion
                                  )
        # Self-Critique of the Engine structure after TIDs (using MRO principles, but on code structure)
        RefinedEngineAfterTIDs_Json := INVOKE orchestrate_mro_critique_pipeline_v3(
                                            DraftOutput_JsonString := EngineAfterTIDs_Json,
                                            CCOContext_JsonString := '{}', # No CCO context for framework itself
                                            RefinementGoals_JsonString := '{ "primary_goal": "Ensure structural integrity and explicitness after TID application.", "target_schema_name": "ASO-aiOS_EngineFile_Schema_v1.2.0" }',
                                            MaxIterations_Integer := 1, # One pass for framework
                                            IsFrameworkComponent_Boolean := TRUE
                                          )
        InternalState.DraftEvolvedEngine_Json := RefinedEngineAfterTIDs_Json.refined_output_json
        LogToCCOHistory_v3_0(NULL, "FEL-MH_Phase", "Phase 2 Complete. Engine JSON evolved with TIDs.")
    }

    # --- Phase 3: Roadmap Feature Integration ---
    LOG "FEL-MH: Starting Phase 3 - Roadmap Feature Integration."
    SelectedRoadmapItems_Json := "{}" # Default to no items
    IF (\`framework_roadmap_ka_json\` IS NOT NULL AND NOT IS_EMPTY(\`framework_roadmap_ka_json\`)) {
      RoadmapItemsToConsider_Json := INVOKE identify_relevant_roadmap_items_v3(
                                        roadmap_ka_json := \`framework_roadmap_ka_json\`,
                                        current_engine_version := InternalState.NewEngineVersion # Context for relevance
                                      )
      IF (NOT IS_EMPTY(ParseJsonToCNLObject(RoadmapItemsToConsider_Json).items)) {
          UserChoiceRoadmap_Json := INVOKE present_options_and_get_choice_v3(
                                        prompt := "Select Roadmap items to integrate:",
                                        options_json := RoadmapItemsToConsider_Json.items_for_selection_json
                                      )
          SelectedRoadmapItems_Json := UserChoiceRoadmap_Json.selected_items_json # Assume this is a JSON list of item IDs/objects
      }
    }

    IF (IS_EMPTY(ParseJsonToCNLObject(SelectedRoadmapItems_Json).items)) {
        LOG "FEL-MH: No roadmap items selected for integration."
        InternalState.FinalProposedEngine_Json := InternalState.DraftEvolvedEngine_Json
    } ELSE {
        EngineAfterRoadmap_Json := INVOKE apply_roadmap_items_to_engine_json_v3(
                                        baseline_engine_json := InternalState.DraftEvolvedEngine_Json,
                                        roadmap_items_to_apply_json := SelectedRoadmapItems_Json,
                                        target_new_version := InternalState.NewEngineVersion # Version might be further bumped by this function
                                     )
        RefinedEngineAfterRoadmap_Json := INVOKE orchestrate_mro_critique_pipeline_v3( # Another self-critique
                                                DraftOutput_JsonString := EngineAfterRoadmap_Json,
                                                CCOContext_JsonString := '{}',
                                                RefinementGoals_JsonString := '{ "primary_goal": "Ensure structural integrity after roadmap integration." }',
                                                MaxIterations_Integer := 1,
                                                IsFrameworkComponent_Boolean := TRUE
                                              )
        InternalState.FinalProposedEngine_Json := RefinedEngineAfterRoadmap_Json.refined_output_json
        LogToCCOHistory_v3_0(NULL, "FEL-MH_Phase", "Phase 3 Complete. Engine JSON evolved with Roadmap items.")
    }

    # --- Phase 4: Finalization & Output ---
    LOG "FEL-MH: Starting Phase 4 - Finalization & Output."
    FinalEngineMarkdown_Text := INVOKE regenerate_engine_markdown_from_json_v3(
                                  engine_json_object := InternalState.FinalProposedEngine_Json,
                                  target_engine_version := InternalState.NewEngineVersion # Or version after roadmap
                                )

    # Update status of TIDs and Roadmap items (conceptual calls)
    INVOKE manage_tid_status_v3(tids_processed_json := TIDs_Json, new_status := "Implemented", implemented_version := InternalState.NewEngineVersion)
    IF (NOT IS_EMPTY(ParseJsonToCNLObject(SelectedRoadmapItems_Json).items)) {
      INVOKE update_roadmap_item_status_v3(roadmap_items_json := SelectedRoadmapItems_Json, new_status := "Integrated", integrated_version := InternalState.NewEngineVersion)
    }
    INVOKE log_evolution_event_v3(
              previous_version := GET(ParseJsonToCNLObject(InternalState.ConformantBaselineEngine_Json), "file_level_metadata.version"), # Needs parsing
              new_version := InternalState.NewEngineVersion,
              tids_applied_json := TIDs_Json,
              roadmap_items_applied_json := SelectedRoadmapItems_Json
            )

    LOG "FEL-MH v3.0: Cycle concluded. New Engine Version: " + InternalState.NewEngineVersion + " generated."
    RETURN OBJECT {
              Generated_Engine_Full_Text := FinalEngineMarkdown_Text,
              Status := "FEL_EngineRegenerated_UserActionRequiredToSave"
            }
  """
}
outputs_description_json_schema: {
  "type": "object",
  "properties": {
    "Generated_Engine_Full_Text": { "type": "string", "description": "The complete Markdown text of the newly evolved ASO-aiOS Engine." },
    "Status": { "type": "string", "description": "Completion status of FEL-MH." }
  },
  "required": ["Generated_Engine_Full_Text", "Status"]
}
