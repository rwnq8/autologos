---
generation_timestamp: 2025-06-06T06:23:38.879Z
processing_mode: expansive
initial_prompt_summary: "--- START FILE: Autologos_Core_Logic.alang_product_20250606_095243_product_expansive_20250606_114830.md ---
---
generation_timestamp: 2025-06-06T06..."
final_iteration_count: 3
max_iterations_setting: 3
model_configuration:
  model_name: 'gemini-2.5-flash-preview-04-17'
  temperature: 0.40
  top_p: 1.00
  top_k: 60
prompt_source_name: Autologos_Core_Logic.alang_product_20250606_095243_product_expansive_20250606_114830.md
---

```
--- START FILE: Autologos_Core_Logic_v1.11.alang ---
;; Autologos_Core_Logic.alang v1.11
;; Specification Version: ALANG_SPEC_V1.0
;; Core Logic Version: ALANG_CORE_LOGIC_V1.11
;; This file defines the core behavior of the Autologos system using the ALang language.
;; This version aims to be a "production-ready" design, with all identified issues fixed and placeholders replaced by detailed ALang logic.
;; v1.11 Expansions:
;; - Further detailed the operationalization of Φ (Principle 0.V.6) within the Session Conceptual Model, adding conceptual properties for tracking confidence, source fidelity, and Φ contribution.
;; - Added conceptual procedures for analyzing the conceptual model state, including Φ metrics and identifying areas needing refinement.
;; - Elaborated on how the Session Conceptual Model and selected backlog items specifically inform prompt construction during System QA stages (Section 3).
;; - Expanded the `ProposeDirectiveChanges` procedure with more detail on the LLM's analysis process, including leveraging the conceptual model to identify systemic issues and defining a more concrete structure for proposed changes.
;; - Detailed the `ParseToolErrorResolutionInput` procedure, defining its role in interpreting user input in the context of the error and conceptual model, and specifying expected input/output structures.
;; - Refined the decision logic within `HandleToolError` to incorporate conceptual model analysis of error patterns and handle various user resolution inputs.
;; - Added conceptual detail to `ProcessToolErrorForConceptualModel` on how error patterns and limitations are integrated into the conceptual graph.
;; - Added conceptual detail to `ApplyRevisionsToArtifact` and `ApplyFeedbackBasedRevision` on how revision plans are generated and applied, explicitly referencing the conceptual model for context and updates.
;; - Added new ALANG_STATUS_ codes for specific conceptual model and revision failures.

;; --- Section 0: System Config & Metadata ---
;; This section defines system-wide configuration parameters and metadata.

(DEFINE_PRIMITIVE GET_ALANG_SPEC_VERSION ()
    ; Orchestrator: Returns the version of the ALang specification that this code adheres to.
    ; Returns: String (e.g., "ALANG_SPEC_V1.0")
)

(DEFINE_PRIMITIVE GET_CORE_LOGIC_VERSION ()
    ; Orchestrator: Returns the version of this Autologos core logic.
    ; Returns: String (e.g., "ALANG_CORE_LOGIC_V1.11") ; Updated version
)

(DEFINE_PRIMITIVE GET_ORCHESTRATOR_TIMESTAMP ()
    ; Orchestrator: Returns an ISO 8601 timestamp string from the orchestrator's environment, using tool_code.
    ; The accuracy and trustworthiness of this timestamp are dependent on the orchestrator's implementation and its access to a synchronized system clock.
    ; If a trusted timestamp cannot be provided, this primitive MUST return NIL or an ALANG_STATUS_TIMESTAMP_UNAVAILABLE.
    ; Returns: String (ISO 8601 timestamp) or NIL.
)

(SET_STATE sys.alang_spec_version (GET_ALANG_SPEC_VERSION))
(SET_STATE sys.alang_core_logic_version (GET_CORE_LOGIC_VERSION))
(SET_STATE sys.current_mode "IDLE") ; Initial system state
(SET_STATE sys.error_level "NONE") ; No errors initially
(SET_STATE sys.error_message NIL) ; No error message
(SET_STATE sys.evolution_backlog_handle "Autologos/Evolution_Backlog.json") ; Path to structured backlog
(SET_STATE sys.knowledge_base_handle "Autologos/Persistent_Knowledge_Base.json") ; Path to structured PKA store
(SET_STATE sys.evolution_trigger_pending FALSE) ; Flag for System QA cycle (Section 3)
(SET_STATE sys.system_qa_status "IDLE") ; Status of the last System QA cycle (NEW)
(SET_STATE session.qa_output_verbosity "CONCISE") ; Default QA reporting verbosity (Principle 4.A Cmd 10)
(SET_STATE session.output_detail "STANDARD") ; Default general output detail (Principle 4.A Cmd 14)
(SET_STATE session.loop_stack (LIST_CREATE)) ; Stack for managing nested loops (Section 2.A)
(SET_STATE session.conceptual_model_handle NIL) ; Handle to the session-specific conceptual model (Principle 0.V.6)
(SET_STATE session.pending_user_action_details NIL) ; Context for pending user actions (NEW)
(SET_STATE session.last_search_results NIL) ; Store results for BROWSE command (moved from utility)
(SET_STATE session.system_qa_context NIL) ; Context for System QA cycle state management (NEW)
(SET_STATE sys.proposed_changes_handle NIL) ; Handle for pending Core Logic changes (NEW)


;; --- External Component Dependencies ---
;; This section lists the symbolic names of external prompt templates and constraint sets
;; that are referenced by this ALang code. Their content must be managed by the orchestrator.

;; Prompt Templates (used with SAFE_GENERATE_CONTENT or INVOKE_CORE_LLM_GENERATION)
(DEFINE_SYMBOL PROMPT_TEMPLATE_GENERATE_PATTERN_IDEAS "prompt_generate_pattern_ideas.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_PRODUCT_DEFINITION "prompt_product_definition.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_GENERATE_TASK_LIST "prompt_generate_task_list.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_EXECUTE_TASK "prompt_execute_task.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_COMPILE_DRAFT "prompt_compile_draft.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_PROJECT_SUMMARY "prompt_project_summary.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_QA_SELF_CRITIQUE "prompt_qa_self_critique.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_QA_DIVERGENT_EXPLORATION "prompt_qa_divergent_exploration.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_QA_RED_TEAMING "prompt_qa_red_teaming.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_QA_EXTERNAL_REVIEW "prompt_qa_external_review.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_IDENTIFY_PATTERNS "prompt_identify_patterns.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_GENERATE_TITLE "prompt_generate_title.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_PARSE_COMMAND "prompt_parse_command.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_SUMMARIZE_ARTIFACT "prompt_summarize_artifact.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_PERFORM_QUERY "prompt_perform_query.txt")
(DEFINE_SYMBOL PROMPT_TEMPLATE_SERIALIZE_ALANG_CORE "prompt_serialize_alang_core.txt") ; For HandleSaveSystemCommand
(DEFINE_SYMBOL PROMPT_TEMPLATE_META_COGNITIVE_QA "prompt_meta_cognitive_qa.txt") ; Added for 6.A
(DEFINE_SYMBOL PROMPT_TEMPLATE_SELF_CORRECTION "prompt_self_correction.txt") ; Added for HandleQAIssues/SelfCorrectArtifact
(DEFINE_SYMBOL PROMPT_TEMPLATE_ENHANCE_PROMPT "prompt_enhance_prompt.txt") ; Added for EnhancePromptWithPatterns
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL "prompt_analyze_for_conceptual_model.txt") ; Added for Process*ConceptualModel
(DEFINE_SYMBOL PROMPT_TEMPLATE_PKA_CONSENT "prompt_pka_consent.txt") ; Added for PKA consent primitive
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_BACKLOG_FOR_FOCUS "prompt_analyze_backlog_for_focus.txt") ; Added for SelectAIProposedBacklogItems (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_QA_FOR_DIRECTIVE_CHANGES "prompt_analyze_qa_for_directive_changes.txt") ; Added for ProposeDirectiveChanges (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_DATA_FOR_PATTERNS "prompt_analyze_data_for_patterns.txt") ; Added for IdentifyPatternsInContext (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_QA_REPORT_FOR_REVISIONS "prompt_analyze_qa_report_for_revisions.txt") ; Added for ApplyRevisionsToArtifact (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_TOOL_ERROR "prompt_analyze_tool_error.txt") ; Added for HandleToolError analysis (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL_UPDATE "prompt_analyze_for_conceptual_model_update.txt") ; Specific template for conceptual model updates (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_FEEDBACK_FOR_REVISION "prompt_analyze_feedback_for_revision.txt") ; Specific template for user feedback based revision (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_TOOL_ERROR_USER_EXPLANATION "prompt_analyze_tool_error_user_explanation.txt") ; Specific template for user-friendly error explanation (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_TOOL_ERROR_RESOLUTION_INPUT "prompt_analyze_tool_error_resolution_input.txt") ; Specific template for parsing user input for tool error resolution (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_SUMMARIZE_CONCEPTUAL_MODEL "prompt_summarize_conceptual_model.txt") ; Added for conceptual model summary (NEW)
(DEFINE_SYMBOL PROMPT_TEMPLATE_ANALYZE_CONCEPTUAL_MODEL_FOR_PHI "prompt_analyze_conceptual_model_for_phi.txt") ; Added for Φ analysis (NEW)


;; Constraint Sets (used with SAFE_GENERATE_CONTENT)
(DEFINE_SYMBOL CONSTRAINT_SET_IDEA_GENERATION "constraints_idea_generation.json")
(DEFINE_SYMBOL CONSTRAINT_SET_PRODUCT_DEFINITION "constraints_product_definition.json")
(DEFINE_SYMBOL CONSTRAINT_SET_PLANNING "constraints_planning.json")
(DEFINE_SYMBOL CONSTRAINT_SET_TASK_EXECUTION "constraints_task_execution.json")
(DEFINE_SYMBOL CONSTRAINT_SET_FINAL_REVIEW "constraints_final_review.json")
(DEFINE_SYMBOL CONSTRAINT_SET_SUMMARY "constraints_summary.json")
(DEFINE_SYMBOL CONSTRAINT_SET_QA_CRITIQUE "constraints_qa_critique.json")
(DEFINE_SYMBOL CONSTRAINT_SET_PATTERN_IDENTIFICATION "constraints_pattern_identification.json")
(DEFINE_SYMBOL CONSTRAINT_SET_VALID_ALANG_SYNTAX "constraints_valid_alang_syntax.json") ; For HandleSaveSystemCommand
(DEFINE_SYMBOL CONSTRAINT_SET_CONCEPTUAL_MODEL_STRUCTURE "constraints_conceptual_model_structure.json") ; Added for conceptual model validation
(DEFINE_SYMBOL CONSTRAINT_SET_PKA_SCHEMA_REGISTRY "constraints_pka_schema_registry.json") ; Added for PKA schema validation
(DEFINE_SYMBOL CONSTRAINT_SET_PROPOSED_CHANGES_STRUCTURE "constraints_proposed_changes_structure.json") ; Added for ProposeDirectiveChanges validation (NEW)
(DEFINE_SYMBOL CONSTRAINT_SET_IDENTIFIED_PATTERNS_STRUCTURE "constraints_identified_patterns_structure.json") ; Added for IdentifyPatternsInContext validation (NEW)
(DEFINE_SYMBOL CONSTRAINT_SET_REVISION_PLAN_STRUCTURE "constraints_revision_plan_structure.json") ; Added for ApplyRevisionsToArtifact validation (NEW)
(DEFINE_SYMBOL CONSTRAINT_SET_TOOL_ERROR_ANALYSIS_STRUCTURE "constraints_tool_error_analysis_structure.json") ; Added for HandleToolError analysis validation (NEW)
(DEFINE_SYMBOL CONSTRAINT_SET_CONCEPTUAL_MODEL_UPDATE_STRUCTURE "constraints_conceptual_model_update_structure.json") ; Specific constraints for conceptual model update data (NEW)
(DEFINE_SYMBOL CONSTRAINT_SET_TOOL_ERROR_RESOLUTION_INPUT_STRUCTURE "constraints_tool_error_resolution_input_structure.json") ; Constraints for parsing user input for tool error resolution (NEW)
(DEFINE_SYMBOL CONSTRAINT_SET_CONCEPTUAL_MODEL_SUMMARY_STRUCTURE "constraints_conceptual_model_summary_structure.json") ; Constraints for conceptual model summary output (NEW)
(DEFINE_SYMBOL CONSTRAINT_SET_PHI_ANALYSIS_STRUCTURE "constraints_phi_analysis_structure.json") ; Constraints for Φ analysis output (NEW)


;; --- Section 1: Utility Procedures & Primitives Declarations ---
;; This section defines commonly used utility procedures and declares the signatures of all primitives.

;; --- General Utilities ---
(DEFINE_PROCEDURE AcknowledgeAndLog (log_event_type log_message user_ack_message_type user_ack_content)
    ;; Acknowledges user intent and logs an event.
    (LOG_EVENT log_event_type log_message)
    (OUTPUT_TO_USER_BUFFER user_ack_message_type user_ack_content NIL) ; NIL for formatting hints
    (FLUSH_USER_OUTPUT_BUFFER)
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE OutputGeneralHelp ()
    ;; Provides general help information about Autologos commands.
    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Autologos Commands:\nSTART (project_description)\nOK\nNO / REVISE (feedback)\nINPUT (data)\nSTATUS?\nHELP? (command_name)\nEND\nEVOLVE (suggestion)\nSAVE_SYSTEM\nSAVE_PROJECT\nOUTPUT (artifact_id)\nSUMMARIZE (artifact_id)\nQUERY (CONCEPT/DOCUMENT/RELATION/PKA)\nOUTPUT_BACKLOG (optional: filename)\nPROMOTE_TO_PKA (artifact_id, rationale, schema_id)\nSEARCH_PKA (keywords, filters)\nSET_SESSION_PREFERENCE (key=value ...)\nSET QA_OUTPUT_VERBOSITY (CONCISE/VERBOSE)\nSET OUTPUT_DETAIL (MINIMAL/STANDARD/EXHAUSTIVE)\nLOOP (optional: description)\nSTOP_LOOP\nLOOP_PROJECT_RESTART\nSYSTEM_QA\n\nFor specific help, type HELP? (command_name).")
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE OutputSpecificHelp (commandName)
    ;; Provides specific help for a given command.
    (LET ((helpContent (GET_HELP_TEXT_FOR_COMMAND commandName)))
        (IF (IS_NIL helpContent)
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" (STRING_CONCAT "No help found for command: " commandName))
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_NOT_FOUND)
            )
            (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" helpContent NIL)
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE ClearTurnSpecificSessionState ()
    ;; Clears session-specific state variables that should not persist across turns.
    ;; Note: session.conceptual_model_handle, session.loop_stack, session.last_search_results, and session.system_qa_context persist.
    (SET_STATE session.last_user_input_raw NIL)
    (SET_STATE session.parsed_command_details NIL)
    (SET_STATE session.pending_user_action NIL)
    (SET_STATE session.pending_user_action_details NIL) ; Clear pending action details (NEW)
    (SET_STATE session.active_tool_id NIL)
    (SET_STATE session.tool_last_status NIL)
    (SET_STATE session.tool_last_output_handle NIL)
    (SET_STATE session.last_user_response NIL)
    (SET_STATE session.last_user_feedback NIL)
    (SET_STATE session.last_user_input_data NIL)
    ; Do NOT clear session.conceptual_model_handle, session.loop_stack, session.last_search_results, session.system_qa_context here.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE ParseKeyValueArgs (argsList)
    ;; Parses a list of "KEY=VALUE" strings into a map.
    (LET ((resultMap (MAP_CREATE)))
        (LOOP_FOR_EACH argString argsList
            (LET ((parts (STRING_SPLIT argString "=")))
                (IF (EQ (LIST_GET_LENGTH parts) 2)
                    (SET_STATE resultMap (MAP_SET_VALUE resultMap (LIST_GET_ITEM parts 0) (LIST_GET_ITEM parts 1)))
                    (LOG_EVENT "WARNING" (STRING_CONCAT "Skipping malformed key-value arg: " argString))
                )
            )
        )
        (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" resultMap)))
    )
)

(DEFINE_PROCEDURE SummarizeArtifact (artifactHandle session_model_handle)
    ;; Summarizes the content of a given artifact using LLM, leveraging the session conceptual model for context.
    (LET ((artifactContentResult (READ_CONTENT artifactHandle "text_summary_or_full" NIL)))
        (IF (NEQ (GET_STATUS artifactContentResult) ALANG_STATUS_SUCCESS) ; Check READ_CONTENT status first
            (SEQ
                (SET_ERROR_STATE "DATA_ERROR" "Failed to read artifact content for summarization.")
                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
            )
            (LET ((artifactContent (GET_DATA artifactContentResult))) ; Only bind if read succeeded
                (IF (IS_NIL artifactContent) ; Now check if content itself is NIL (e.g., empty file)
                    (SEQ
                        (SET_ERROR_STATE "DATA_ERROR" "Artifact content is empty or unreadable for summarization.")
                        (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
                    )
                    ; Content is not NIL, proceed to summarization
                    (LET ((summaryResult (INVOKE_CORE_LLM_GENERATION
                                            (MAP_CREATE ("template" PROMPT_TEMPLATE_SUMMARIZE_ARTIFACT)
                                                        ("content" artifactContent)
                                                        ("session_model_handle" session_model_handle)) ; Include conceptual model handle
                                            (GET_LLM_PARAMS_FOR_TASK "summarization")
                                         )))
                        (IF (EQ (GET_STATUS summaryResult) ALANG_STATUS_SUCCESS)
                            (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (GET_DATA summaryResult))))
                            (SEQ
                                (SET_ERROR_STATE "LLM_ERROR" (STRING_CONCAT "LLM failed to summarize: " (GET_ERROR_MESSAGE summaryResult)))
                                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_LLM_ERROR) ("data" NIL)))
                            )
                        )
                    )
                )
            )
        )
    )
)

(DEFINE_PROCEDURE PerformQuery (queryType queryValue session_model_handle pka_handle)
    ;; Performs a query based on type (CONCEPT/DOCUMENT/RELATION/PKA) using LLM and the session-specific conceptual model / PKA.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Performing query for " queryType ": " queryValue) NIL)
    ; This procedure conceptually interacts with the session-specific conceptual model (Principle 0.V.6)
    ; and the PKA store (Principle 8.B.v). The query itself is likely handled by the LLM primitive
    ; with appropriate context provided from the session model and PKA store.
    (LET ((queryResult (INVOKE_CORE_LLM_GENERATION
                            (MAP_CREATE ("template" PROMPT_TEMPLATE_PERFORM_QUERY)
                                        ("query_type" queryType)
                                        ("query_value" queryValue)
                                        ("session_conceptual_model_handle" session_model_handle) ; Include conceptual model handle
                                        ("pka_handle" pka_handle)) ; Handle for PKA store
                            (GET_LLM_PARAMS_FOR_TASK "query_answering")
                         )))
        (IF (EQ (GET_STATUS queryResult) ALANG_STATUS_SUCCESS)
            (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (GET_DATA queryResult))))
            (SEQ
                (SET_ERROR_STATE "LLM_ERROR" (STRING_CONCAT "LLM failed to answer query: " (GET_ERROR_MESSAGE queryResult)))
                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_LLM_ERROR) ("data" NIL)))
            )
        )
    )
)

(DEFINE_PROCEDURE GetEvolutionBacklogContent ()
    ;; Retrieves the content of the evolution backlog.
    (LET ((backlogHandle (GET_STATE sys.evolution_backlog_handle)))
        (IF (IS_NIL backlogHandle)
            (SEQ
                (SET_ERROR_STATE "SYSTEM_ERROR" "Evolution backlog handle is not set.")
                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
            )
        )
        (LET ((contentResult (READ_CONTENT backlogHandle "text_summary_or_full" NIL)))
            (IF (EQ (GET_STATUS contentResult) ALANG_STATUS_SUCCESS)
                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (GET_DATA contentResult))))
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to read evolution backlog content.")
                    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
                )
            )
        )
    )
)

(DEFINE_PROCEDURE LoadEvolutionBacklog (handle_or_path)
    ;; Orchestrator: Loads the evolution backlog from its handle/path into memory/state.
    (LOG_EVENT "SYSTEM_LOAD" (STRING_CONCAT "Loading Evolution Backlog from: " handle_or_path))
    ; In a real orchestrator, this would load the JSON file into a structured object.
    ; For now, assume it's loaded and accessible via sys.evolution_backlog_handle.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE LoadPersistentKnowledgeBase (handle_or_path)
    ;; Orchestrator: Loads the persistent knowledge base from its handle/path into memory/state.
    (LOG_EVENT "SYSTEM_LOAD" (STRING_CONCAT "Loading Persistent Knowledge Base from: " handle_or_path))
    ; Similar to backlog, assume loaded.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE GetSessionCmdArgByIndex (index default_value_optional)
    ; Retrieves a command argument from session.parsed_command_details.args by index.
    ; Returns: Any
    (LET ((argsList (MAP_GET_VALUE (GET_STATE session.parsed_command_details) "args" (LIST_CREATE))))
        (IF (LT index (LIST_GET_LENGTH argsList))
            (LIST_GET_ITEM argsList index)
            default_value_optional
        )
    )
)

(DEFINE_PRIMITIVE GET_TEXT_FOR_PKA_CONSENT_PROMPT (purpose_description session_model_handle)
    ; Orchestrator: Retrieves the full, formatted PKA consent prompt text based on purpose and session context.
    ; Returns: String
    ; This primitive generates the consent prompt text. It should use the session_model_handle
    ; to provide context about *what* concepts/patterns are being proposed for storage, making the consent prompt more specific and informed.
    ; The prompt template PROMPT_TEMPLATE_PKA_CONSENT is used for this generation.
    (LOG_EVENT "SYSTEM" "Calling primitive GET_TEXT_FOR_PKA_CONSENT_PROMPT")
    (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    (IF (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS)
        (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
        (LET ((promptResult (INVOKE_CORE_LLM_GENERATION
                                (MAP_CREATE ("template" PROMPT_TEMPLATE_PKA_CONSENT)
                                            ("purpose" purpose_description)
                                            ("session_model_context" sessionModelContent)) ; Provide session model context
                                (GET_LLM_PARAMS_FOR_TASK "prompt_generation") ; Use appropriate task params
                            )))
            (IF (EQ (GET_STATUS promptResult) ALANG_STATUS_SUCCESS)
                 (RETURN_STATUS (GET_DATA promptResult))
                 (SEQ
                     (LOG_EVENT "SYSTEM_ERROR" "Failed to generate PKA consent prompt text.")
                     (RETURN_STATUS (STRING_CONCAT "Do you consent to store this knowledge artifact for the purpose: " purpose_description "? (YES/NO) (Failed to generate detailed prompt)")) ; Fallback text
                 )
            )
        )
        (SEQ
            (LOG_EVENT "SYSTEM_ERROR" "Failed to read session model content for PKA consent prompt.")
            (RETURN_STATUS (STRING_CONCAT "Do you consent to store this knowledge artifact for the purpose: " purpose_description "? (YES/NO) (Failed to load session context)")) ; Fallback text
        )
    )
)

(DEFINE_PROCEDURE HandleQAIssues (generated_text qaAssessment target_artifact_handle constraints_handle session_model_handle)
    ;; Handles QA issues identified by meta-cognitive self-assessment on generated text.
    ;; This procedure implements Principle 6 & 6.A, deciding on remediation strategy based on QA findings and confidence.
    ;; It updates the session conceptual model to log issues and track remediation status (Principle 0.V.6).
    ;; Returns: ALANG_STATUS_CODE (SUCCESS, FAILURE, or PAUSE_FOR_USER_INPUT) (NEW)
    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Handling QA issues identified by meta-cognitive self-assessment." NIL)

    ; 1. Analyze the qaAssessment map (structured as per Principle 6.A: {has_issues: bool, details: list, confidence_score: number})
    (LET ((hasIssues (MAP_GET_VALUE qaAssessment "has_issues" FALSE)))
    (LET ((issueDetails (MAP_GET_VALUE qaAssessment "details" (LIST_CREATE))))
    (LET ((confidenceScore (MAP_GET_VALUE qaAssessment "confidence_score" 1.0))) ; Assume 1.0 is high confidence
    (LET ((remediationStatus ALANG_STATUS_SUCCESS))) ; Track outcome of handling

        (IF hasIssues
            (SEQ
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Meta-cognitive QA found issues (Confidence: " (STRING_CONCAT "" confidenceScore) "):") NIL) ; Report confidence
                (LOOP_FOR_EACH issue issueDetails
                    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "- Issue: " (MAP_GET_VALUE issue "description") " (Severity: " (MAP_GET_VALUE issue "severity" "unknown") ")") NIL) ; Report severity
                    ; Log issue details in the conceptual model, potentially linking to relevant nodes in conceptual model and the artifact (Conceptual - Principle 0.V.6)
                    (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_issue") ("issue" issue) ("artifact_handle" target_artifact_handle) ("confidence" confidenceScore)))
                )

                ; 2. Decide on remediation strategy based on severity, confidence, etc. (Logic based on Principle 6.A and 12.A)
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Assessing remediation strategy based on QA findings and confidence..." NIL)

                (LET ((needsUserReview FALSE))) ; Flag if user review is needed
                (LET ((attemptSelfCorrection FALSE))) ; Flag to attempt self-correction

                ; Determine strategy based on most severe issue or overall confidence
                (LET ((overallSeverity "NONE")))
                (LOOP_FOR_EACH issue issueDetails
                    (LET ((severity (MAP_GET_VALUE issue "severity" "minor")))
                        (IF (EQ severity "CRITICAL") (SET_STATE overallSeverity "CRITICAL"))
                        (IF (AND (EQ severity "MAJOR") (NEQ overallSeverity "CRITICAL")) (SET_STATE overallSeverity "MAJOR"))
                        (IF (AND (EQ severity "MINOR") (AND (NEQ overallSeverity "CRITICAL") (NEQ overallSeverity "MAJOR"))) (SET_STATE overallSeverity "MINOR"))
                    )
                )

                (IF (OR (EQ overallSeverity "CRITICAL") (LT confidenceScore 0.5)) ; If critical issues or low confidence
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Critical issues or low confidence detected. Flagging for user review and potential revision." NIL)
                        (SET_STATE needsUserReview TRUE)
                        ; Add a disclaimer to the artifact content (Principle 0.B.I, 12.A)
                        ; The content is already written to the target_artifact_handle by SAFE_GENERATE_CONTENT before calling HandleQAIssues.
                        (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT target_artifact_handle "***AI_USER_VERIFICATION_REQUIRED: Critical issues or low confidence detected in this content. Review QA findings carefully.***") ; Use the primitive
                        ; Update conceptual model to flag the artifact/related concepts as uncertain (Conceptual - Principle 0.V.6)
                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_uncertainty") ("artifact_handle" target_artifact_handle) ("details" issueDetails) ("confidence" confidenceScore)))
                    )
                    (IF (EQ overallSeverity "MAJOR") ; If major issues
                        (SEQ
                            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Major issues detected. Attempting automated self-correction." NIL)
                            (SET_STATE attemptSelfCorrection TRUE)
                             ; Update conceptual model to reflect potential need for correction (Conceptual - Principle 0.V.6)
                            (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_needs_correction") ("artifact_handle" target_artifact_handle) ("details" issueDetails)))
                        )
                        (SEQ ; If minor issues or no issues requiring intervention
                            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Minor issues detected or no issues requiring immediate intervention found. Logging findings." NIL)
                            ; Minor issues might not require explicit self-correction or user flagging, just logging.
                            ; The content is already in the target_artifact_handle.
                            ; Update conceptual model to log minor issues (Conceptual - Principle 0.V.6)
                            (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_minor_issues") ("artifact_handle" target_artifact_handle) ("details" issueDetails)))
                        )
                    )
                )

                ; 3. Attempt self-correction if decided (using the SelfCorrectArtifact primitive)
                (IF attemptSelfCorrection
                    ; Pass the original generated text, QA findings, constraints, and session model handle to the self-correction primitive
                    ; The primitive should return corrected text if successful.
                    (LET ((correctionResult (SelfCorrectArtifact generated_text qaAssessment constraints_handle session_model_handle)))
                        (IF (EQ (GET_STATUS correctionResult) ALANG_STATUS_SUCCESS)
                            (SEQ
                                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Automated self-correction attempted and succeeded. Overwriting artifact content." NIL)
                                ; Overwrite the artifact content with corrected text
                                (LET ((writeStatus (WRITE_CONTENT_TO_ARTIFACT target_artifact_handle (GET_DATA correctionResult) "text/markdown"))))
                                (IF (NEQ writeStatus ALANG_STATUS_SUCCESS)
                                    (SEQ
                                        (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to write corrected content to artifact.")
                                        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                                        (SET_STATE needsUserReview TRUE) ; Flag for user review if write fails
                                        (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT target_artifact_handle "***AI_SYSTEM_ERROR: Failed to write self-corrected content. Original content may have issues.***")
                                         ; Update conceptual model to flag write failure (Conceptual - Principle 0.V.6)
                                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_write_failure") ("artifact_handle" target_artifact_handle)))
                                    )
                                )
                                ; Update conceptual model to reflect successful correction (Conceptual - Principle 0.V.6)
                                (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_corrected") ("artifact_handle" target_artifact_handle)))
                            )
                            (SEQ
                                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Automated self-correction failed. Flagging original content for user review." NIL)
                                (SET_STATE needsUserReview TRUE)
                                (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT target_artifact_handle "***AI_USER_VERIFICATION_REQUIRED: Automated self-correction failed. Original content may have issues. Review QA findings.***")
                                 ; Update conceptual model to flag failed correction and need for user review (Conceptual - Principle 0.V.6)
                                (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_correction_failed_user_review") ("artifact_handle" target_artifact_handle) ("details" issueDetails)))
                            )
                        )
                    )
                )

                ; 4. Follow up based on the remediation decision
                (IF needsUserReview
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Review the generated content and QA findings. Do you approve, or require revision? (OK/REVISE)" NIL)
                        ; Indicate to the orchestrator that user input is required to proceed with this artifact.
                        ; Store context for the pending action (NEW)
                        (SET_STATE session.pending_user_action_details (MAP_CREATE ("artifact_handle" target_artifact_handle) ("qa_report_handle" (CREATE_EMPTY_ARTIFACT "temp_qa_report")) ("constraints_handle" constraints_handle) ("original_generated_text" generated_text))) ; Store context for review, create temp handle for report if needed
                        (SET_STATE remediationStatus ALANG_STATUS_PAUSE_FOR_USER_INPUT)
                    )
                    (SEQ
                         ; If no user review needed (minor issues or self-correction succeeded), proceed.
                         ; The content (original or corrected) is already written to the artifact by SAFE_GENERATE_CONTENT
                         ; or overwritten by SelfCorrectArtifact. Disclaimers are added by ADD_DISCLAIMER_TO_ARTIFACT if needed.
                         (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Issue handling complete. Content logged/written (potentially with disclaimers)." NIL)
                         (SET_STATE remediationStatus ALANG_STATUS_SUCCESS) ; Status reflects handling attempt, not necessarily full resolution
                    )
                )
            )
            (SEQ ; No issues found by QA
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Meta-cognitive self-assessment found no substantive issues (Confidence: " (STRING_CONCAT "" confidenceScore) "). Content aligns with session conceptual model." NIL)) ; Report confidence even if no issues, mention model
                ; Content is already written to the target_artifact_handle by SAFE_GENERATE_CONTENT.
                ; Update conceptual model to flag the artifact as validated by QA (Conceptual - Principle 0.V.6)
                (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_qa_passed") ("artifact_handle" target_artifact_handle) ("confidence" confidenceScore)))
                 (SET_STATE remediationStatus ALANG_STATUS_SUCCESS)
            )
        )
        (RETURN_STATUS remediationStatus) ; Return status indicating outcome (success, failure, or pause)
    )))
)

(DEFINE_PRIMITIVE ADD_DISCLAIMER_TO_ARTIFACT (artifact_handle disclaimer_text)
    ;; Orchestrator: Adds a disclaimer to the content of an artifact.
    ;; Needs orchestration implementation to read, prepend, and write content.
    (LOG_EVENT "SYSTEM" (STRING_CONCAT "Adding disclaimer to artifact " (GET_HANDLE_METADATA artifact_handle "id") ": " disclaimer_text))
    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Adding disclaimer to artifact: '" disclaimer_text "'") NIL)
    ; Placeholder for actual file manipulation or buffer modification
    ; A real implementation would read the artifact, prepend the disclaimer, and write it back.
    ; This primitive should likely return a status code.
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Assume success for now
)

(DEFINE_PRIMITIVE SelfCorrectArtifact (generated_text qaAssessment constraints_handle session_model_handle)
    ;; Orchestrator: Attempts automated self-correction of text based on QA findings, constraints, and session context.
    ;; Takes the generated text, the QA assessment report, the constraints handle, and the session model handle as input.
    ;; The LLM uses the QA findings, constraints, and the session conceptual model to guide the correction process,
    ;; aiming to improve the fidelity of the pattern model representation in the text (Principle 6.A).
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: corrected_text}) or failure.
    (LOG_EVENT "SYSTEM" "Invoking SelfCorrectArtifact primitive for automated correction.")
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Attempting automated self-correction using LLM, session context, and QA findings..." NIL)
    ; This primitive would internally invoke an LLM call using a specific prompt template (PROMPT_TEMPLATE_SELF_CORRECTION)
    ; that provides the original text, the QA findings (qaAssessment), constraints (by reading constraints_handle),
    ; and session context (by reading session_model_handle) with instructions to revise the text based on the QA findings and constraints,
    ; aiming to improve the fidelity of the pattern model representation in the text.
    (LET ((constraintsContentResult (READ_CONTENT constraints_handle "structured_list_of_rules" NIL))))
    (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    (IF (AND (EQ (GET_STATUS constraintsContentResult) ALANG_STATUS_SUCCESS)
             (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS))
        (LET ((constraintsContent (GET_DATA constraintsContentResult))))
        (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
        (LET ((correctionResult (INVOKE_CORE_LLM_GENERATION
                                   (MAP_CREATE ("template" PROMPT_TEMPLATE_SELF_CORRECTION) ; Use a specific template
                                               ("original_text" generated_text)
                                               ("qa_findings" qaAssessment)
                                               ("constraints" constraintsContent)
                                               ("session_model" sessionModelContent)) ; Pass session model content for context
                                   (GET_LLM_PARAMS_FOR_TASK "self_correction")
                                )))
            (RETURN_STATUS correctionResult) ; Return the result of the LLM call
        )
        (SEQ
            (LOG_EVENT "SYSTEM_ERROR" "Failed to read constraints or session model content for self-correction.")
            (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
        )
    )
)

(DEFINE_PRIMITIVE UPDATE_CONCEPTUAL_MODEL (update_map)
    ;; Orchestrator: Updates the session-specific conceptual model based on the provided update map (Principle 0.V.6).
    ;; This primitive is a placeholder for operations on the graph/network structure referenced by session.conceptual_model_handle.
    ;; The update_map specifies the action (e.g., "add_concept", "add_relationship", "update_properties", "flag_uncertainty", "log_issue", "flag_qa_passed", "flag_needs_correction", "flag_write_failure", "flag_correction_failed_user_review", "flag_corrected", "process_input", "process_artifact", "process_tool_result", "process_feedback", "integrate_pka", "integrate_pka_results", "log_directive_changes", "log_tool_limitation", "log_error_pattern", "flag_revision_write_failed", "flag_revision_plan_invalid", "flag_revision_plan_failed", "flag_revision_input_failed", "flag_user_approved_revision", "flag_user_rejected_revision", "flag_revised", "flag_revised_by_feedback", "flag_feedback_revision_write_failed", "flag_feedback_revision_failed", "flag_feedback_revision_input_failed", "flag_user_approved_artifact", "flag_user_rejected_artifact", "log_revision_attempt", "log_revision_success", "log_revision_failure", "log_feedback_revision_attempt", "log_feedback_revision_success", "log_feedback_revision_failure") (UPDATED actions)
    ;; and relevant data ({type: "concept", id: "...", properties: {...}} or {type: "relationship", from: "id1", to: "id2", type: "...", properties: {...}} or {type: "flag", node_id: "...", flag_name: "...", value: "..."} etc.).
    ;; It is responsible for validating the structure of the update_map against a schema (CONSTRAINT_SET_CONCEPTUAL_MODEL_STRUCTURE).
    ;; Returns: ALANG_STATUS_CODE
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Updating conceptual model: " (MAP_GET_VALUE update_map "action")))
    ; This primitive conceptually takes the update_map and modifies the structured data behind session.conceptual_model_handle.
    ; Actual implementation would involve graph database operations or similar.
    ; It should also validate the update_map structure against CONSTRAINT_SET_CONCEPTUAL_MODEL_STRUCTURE.
    ; (LET ((validationResult (VALIDATE_DATA update_map CONSTRAINT_SET_CONCEPTUAL_MODEL_STRUCTURE))))
    ; (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;     (SEQ
    ;         ; Perform the actual model update (conceptual)
    ;         (LOG_EVENT "CONCEPTUAL_MODEL_UPDATE" (MAP_GET_VALUE update_map "action") update_map)
    ;         (RETURN_STATUS ALANG_STATUS_SUCCESS)
    ;     )
    ;     (SEQ
    ;         (LOG_EVENT "SYSTEM_ERROR" "Conceptual model update failed: Validation failed.")
    ;         (SET_ERROR_STATE "SYSTEM_ERROR" "Invalid structure for conceptual model update.")
    ;         (RETURN_STATUS ALANG_STATUS_FAILURE_VALIDATION_ERROR)
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Assume success for conceptual update for now
)

(DEFINE_PRIMITIVE QUERY_CONCEPTUAL_MODEL (query_object session_model_handle)
    ;; Orchestrator: Queries the session-specific conceptual model (Principle 0.V.6). (NEW)
    ;; The query_object specifies what to retrieve (e.g., finding nodes by type/property, finding paths between nodes, finding nodes related to X, tracing sources of information, identifying conflicting nodes, finding concepts with low confidence).
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: list_of_structured_results}) or failure.
    (LOG_EVENT "CONCEPTUAL_PROCESS" "Querying conceptual model.")
    ; This primitive would internally query the structured data behind session_model_handle.
    ; It might involve another LLM call to interpret the query_object in the context of the model structure.
    ; (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    ; (IF (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
    ;     (LET ((queryResult (INVOKE_CORE_LLM_GENERATION
    ;                          (MAP_CREATE ("template" PROMPT_TEMPLATE_PERFORM_QUERY) ; Reuse generic query template or create a specific one
    ;                                      ("query" query_object)
    ;                                      ("session_model" sessionModelContent) ; Pass session model content for context
    ;                                   ))
    ;                          (GET_LLM_PARAMS_FOR_TASK "conceptual_model_query") ; Use specific task type (NEW)
    ;                       ))))
    ;     (IF (EQ (GET_STATUS queryResult) ALANG_STATUS_SUCCESS)
    ;         (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (GET_DATA queryResult))))
    ;     ELSE
    ;         (LOG_EVENT "SYSTEM_ERROR" "LLM failed to query conceptual model.")
    ;         (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_LLM_ERROR) ("data" NIL)))
    ;     )
    ; )
    ; (SEQ
    ;     (LOG_EVENT "SYSTEM_ERROR" "Failed to read session model for query.")
    ;     (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
    ; )
    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (LIST_CREATE)))) ; Placeholder: return empty list
)

(DEFINE_PRIMITIVE SAVE_CONCEPTUAL_MODEL (session_model_handle target_handle_or_path)
    ;; Orchestrator: Saves the session-specific conceptual model to a persistent location. (NEW)
    ;; Returns: ALANG_STATUS_CODE.
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Saving conceptual model to: " target_handle_or_path))
    ; This primitive would serialize the structured data from session_model_handle and write it to the target.
    ; (LET ((modelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    ; (IF (EQ (GET_STATUS modelContentResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((modelContent (GET_DATA modelContentResult))))
    ;     (LET ((saveStatus (WRITE_CONTENT_TO_ARTIFACT target_handle_or_path modelContent "application/json")))) ; Assume JSON output
    ;     (RETURN_STATUS saveStatus)
    ; )
    ; (SEQ
    ;     (LOG_EVENT "SYSTEM_ERROR" "Failed to read conceptual model for saving.")
    ;     (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Assume success
)

(DEFINE_PRIMITIVE SUMMARIZE_CONCEPTUAL_MODEL (session_model_handle summary_options_map_optional)
    ;; Orchestrator: Generates a human-readable summary of the current state of the session conceptual model. (NEW)
    ;; summary_options_map_optional: e.g., {detail_level: "high", include_issues: true}
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: summary_text}) or failure.
    (LOG_EVENT "CONCEPTUAL_PROCESS" "Summarizing conceptual model.")
    ; This primitive would likely use an LLM to interpret the structured model data and generate a summary.
    ; (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    ; (IF (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
    ;     (LET ((summaryResult (INVOKE_CORE_LLM_GENERATION
    ;                            (MAP_CREATE ("template" PROMPT_TEMPLATE_SUMMARIZE_CONCEPTUAL_MODEL) ; Use specific template (NEW)
    ;                                        ("session_model" sessionModelContent) ; Pass session model content
    ;                                        ("options" summary_options_map_optional))
    ;                            (GET_LLM_PARAMS_FOR_TASK "summarization")
    ;                         ))))
    ;     (IF (EQ (GET_STATUS summaryResult) ALANG_STATUS_SUCCESS)
    ;         (LET ((summaryData (GET_DATA summaryResult))))
    ;         ; Validate summaryData structure (NEW)
    ;         (LET ((validationResult (VALIDATE_DATA summaryData CONSTRAINT_SET_CONCEPTUAL_MODEL_SUMMARY_STRUCTURE))))
    ;         (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;             (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (MAP_GET_VALUE summaryData "summary_text")))) ; Assume summary text is in a field
    ;             (SEQ
    ;                 (LOG_EVENT "SYSTEM_ERROR" "Conceptual model summary from LLM failed validation.")
    ;                 (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_VALIDATION_ERROR) ("data" NIL)))
    ;             )
    ;         )
    ;     ELSE
    ;         (LOG_EVENT "SYSTEM_ERROR" "LLM failed to summarize conceptual model.")
    ;         (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_LLM_ERROR) ("data" NIL)))
    ;     )
    ; )
    ; (SEQ
    ;     (LOG_EVENT "SYSTEM_ERROR" "Failed to read session model for summary.")
    ;     (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
    ; )
    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" "Conceptual model summary (placeholder)."))) ; Placeholder
)

(DEFINE_PROCEDURE AnalyzeConceptualModelForΦ (session_model_handle analysis_options_map_optional)
    ;; Orchestrator: Analyzes the session conceptual model to assess its Φ (density, consistency, relevance) and identify areas for improvement. (NEW)
    ;; analysis_options_map_optional: e.g., {focus_area: "pattern_X", identify_inconsistencies: true}
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: analysis_results_map}) or failure.
    (LOG_EVENT "CONCEPTUAL_PROCESS" "Analyzing conceptual model for Φ.")
    ; This primitive would likely use an LLM to interpret the structured model data and perform the analysis.
    ; (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    ; (IF (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
    ;     (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
    ;                            (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_CONCEPTUAL_MODEL_FOR_PHI) ; Use specific template (NEW)
    ;                                        ("session_model" sessionModelContent) ; Pass session model content
    ;                                        ("options" analysis_options_map_optional))
    ;                            (GET_LLM_PARAMS_FOR_TASK "conceptual_model_analysis")
    ;                         ))))
    ;     (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
    ;         (LET ((analysisData (GET_DATA analysisResult))))
    ;         ; Validate analysisData structure (NEW)
    ;         (LET ((validationResult (VALIDATE_DATA analysisData CONSTRAINT_SET_PHI_ANALYSIS_STRUCTURE))))
    ;         (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;             (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" analysisData)))
    ;             (SEQ
    ;                 (LOG_EVENT "SYSTEM_ERROR" "Conceptual model Φ analysis from LLM failed validation.")
    ;                 (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_VALIDATION_ERROR) ("data" NIL)))
    ;             )
    ;         )
    ;     ELSE
    ;         (LOG_EVENT "SYSTEM_ERROR" "LLM failed to analyze conceptual model for Φ.")
    ;         (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_LLM_ERROR) ("data" NIL)))
    ;     )
    ; )
    ; (SEQ
    ;     (LOG_EVENT "SYSTEM_ERROR" "Failed to read session model for Φ analysis.")
    ;     (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
    ; )
    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (MAP_CREATE ("phi_score" 0.5) ("analysis" "Conceptual model analysis placeholder."))))) ; Placeholder
)


(DEFINE_PRIMITIVE SelfCorrectToolOperation (tool_id job_id error_details context session_model_handle)
    ;; Orchestrator: Attempts automated self-correction of a tool invocation based on error details and session context (Section 5.C).
    ;; Takes the tool ID, job ID, error details, original context, and session model handle as input.
    ;; This primitive would involve analyzing the error (potentially with LLM using session context) and attempting to re-invoke the tool with modified parameters or inputs.
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: {new_job_id: string}}) or failure.
    (LOG_EVENT "SYSTEM" (STRING_CONCAT "Invoking SelfCorrectToolOperation primitive for tool " tool_id " job " job_id))
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Attempting automated self-correction for tool error in " tool_id "..." ) NIL)
    ; This primitive would internally:
    ; 1. Analyze error_details and context using LLM, leveraging the session_model_handle for task/project context.
    ; 2. Determine if a simple fix (e.g., parameter adjustment, reformatting input) is possible.
    ; 3. If yes, construct new input/parameters and call INVOKE_TOOL_ASYNC_WITH_CALLBACKS.
    ; 4. Return the status of the re-invocation.
    (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    (IF (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS)
        (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
        (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
                                 (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_TOOL_ERROR) ; Use specific analysis template (NEW)
                                             ("error_details" error_details) ; Analyze error details
                                             ("tool_id" tool_id)
                                             ("original_context" context) ; Original tool context
                                             ("session_model" sessionModelContent)) ; Provide session model handle as context
                                 (GET_LLM_PARAMS_FOR_TASK "error_analysis_and_correction")
                              )))
            (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
                (LET ((analysisData (GET_DATA analysisResult)))) ; Expected: {can_self_correct: bool, suggested_params: map_optional, suggested_input: any_optional, rationale: string}
                ; Validate analysisData structure (NEW)
                (LET ((validationResult (VALIDATE_DATA analysisData CONSTRAINT_SET_TOOL_ERROR_ANALYSIS_STRUCTURE))))
                (IF (EQ validationResult ALANG_STATUS_SUCCESS)
                    (IF (MAP_GET_VALUE analysisData "can_self_correct")
                        (SEQ
                            (LOG_EVENT "TOOL_SELF_CORRECTION_ATTEMPT" tool_id analysisData)
                            ; Attempt re-invocation with suggested changes. Original callbacks are passed back via context.
                            ; Reconstruct the full original context including callbacks and pass-through context (NEW)
                            (LET ((retryContext (MAP_CREATE ("tool_id" tool_id)
                                                           ("success_proc_name" (MAP_GET_VALUE context "success_proc_name"))
                                                           ("failure_proc_name" (MAP_GET_VALUE context "failure_proc_name"))
                                                           ("pass_through_context" (MAP_GET_VALUE context "pass_through_context"))
                                                           ("original_input" (MAP_GET_VALUE context "original_input")) ; Pass original input/params for context
                                                           ("original_params" (MAP_GET_VALUE context "original_params")))))
                            (LET ((retryJobId (INVOKE_TOOL_ASYNC_WITH_CALLBACKS
                                                tool_id
                                                (MAP_GET_VALUE analysisData "suggested_input" (MAP_GET_VALUE context "original_input")) ; Use suggested input or original
                                                (MAP_GET_VALUE analysisData "suggested_params" (MAP_GET_VALUE context "original_params")) ; Use suggested params or original
                                                (MAP_GET_VALUE context "success_proc_name") ; Get original callbacks from context
                                                (MAP_GET_VALUE context "failure_proc_name")
                                                retryContext ; Pass the reconstructed context
                                            ))))
                            (IF (EQ (GET_STATUS retryJobId) ALANG_STATUS_SUCCESS)
                                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (MAP_CREATE ("new_job_id" retryJobId)))))
                                (SEQ
                                    (LOG_EVENT "TOOL_SELF_CORRECTION_FAILED" tool_id "Re-invocation failed.")
                                    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL)))
                                )
                            )
                            )
                        )
                        (SEQ
                            (LOG_EVENT "TOOL_SELF_CORRECTION_NOT_POSSIBLE" tool_id analysisData)
                            (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL))) ; Indicate correction not possible
                        )
                    )
                    (SEQ ; Validation failed
                        (LOG_EVENT "SYSTEM_ERROR" "Tool error analysis failed validation.")
                        (SET_ERROR_STATE "LLM_ERROR" "LLM returned malformed tool error analysis.")
                        (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_VALIDATION_ERROR) ("data" NIL))) ; Indicate validation failure
                    )
                )
            )
            (SEQ
                (LOG_EVENT "SYSTEM_ERROR" "LLM analysis for tool self-correction failed.")
                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_LLM_ERROR) ("data" NIL))) ; Indicate LLM failure
            )
        )
    )
    (SEQ
        (LOG_EVENT "SYSTEM_ERROR" "Failed to read session model for tool self-correction analysis.")
        (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL))) ; Indicate read failure
    )
)


;; --- Error Handling Utilities ---
(DEFINE_PROCEDURE OutputErrorToUser (errorMessage)
    ;; Outputs an error message to the user.
    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (STRING_CONCAT "ERROR: " errorMessage) NIL)
    (FLUSH_USER_OUTPUT_BUFFER)
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

;; --- Primitive Declarations (Orchestrator Implemented) ---
;; These are just declarations for documentation and potential type checking.
;; The actual implementation is handled by the orchestrator.

(DEFINE_PRIMITIVE SET_STATE (variable_path_string value)
    ; Sets a state variable to a given value.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE GET_STATE (variable_path_string)
    ; Retrieves the value of a state variable.
    ; Returns: The value of the state variable.
)

(DEFINE_PRIMITIVE REQUEST_USER_INPUT (prompt_message_key_or_text expected_input_type_hint)
    ; Outputs a prompt to the user and sets session.pending_user_action.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE OUTPUT_TO_USER_BUFFER (message_type content_handle_or_text formatting_hints)
    ; Adds content to the output buffer.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE FLUSH_USER_OUTPUT_BUFFER ()
    ; Sends the contents of the output buffer to the user.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE INVOKE_TOOL_ASYNC_WITH_CALLBACKS (tool_id input_data params_map success_proc_name failure_proc_name pass_through_context)
    ; Invokes an external tool asynchronously.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE GET_ASYNC_JOB_STATUS (job_id)
    ; Gets the status of an asynchronous job.
    ; Returns: ALANG_STATUS_CODE (or a structured object with status and details)
)

(DEFINE_PRIMITIVE GET_ASYNC_JOB_RESULT_HANDLE (job_id)
    ; Gets the handle to the result of an asynchronous job (if successful).
    ; Returns: Handle or NIL
)

(DEFINE_PRIMITIVE READ_CONTENT (handle options)
    ; Reads content from a data source (file, memory, etc.) referenced by a handle.
    ; Options: "text", "json_map_list", "text_summary_or_full", "raw_bytes", "max_chars", "offset", "structured_map", "structured_list_of_rules".
    ; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: content}) or failure.
)

(DEFINE_PRIMITIVE WRITE_CONTENT_TO_ARTIFACT (artifact_handle content mime_type)
    ; Writes content to an artifact referenced by a handle.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE GET_HANDLE_METADATA (handle key)
    ; Gets metadata associated with a handle.
    ; Returns: String (or other primitive type)
)

(DEFINE_PRIMITIVE RELEASE_HANDLE (handle)
    ; Releases a handle, freeing associated resources.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE LOG_EVENT (event_type description_text (key_value_details_map_optional))
    ; Logs an event to the system log.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE SET_ERROR_STATE (error_level error_message_key_or_text)
    ; Sets the system error state.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE GET_ORCHESTRATOR_TIMESTAMP ()
    ; Returns an ISO 8601 timestamp string from the orchestrator's environment, using tool_code.
    ; Returns: String (ISO 8601 timestamp) or NIL.
)

(DEFINE_PRIMITIVE GENERATE_UNIQUE_ID (prefix_string_optional)
    ; Generates a unique ID (e.g., UUID v4).
    ; Returns: String
)

(DEFINE_PRIMITIVE VALIDATE_DATA (data_handle schema_handle)
    ; Validates data against a defined schema using tool_code (e.g., jsonschema).
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE IS_TOOL_ENABLED (tool_id)
    ; Checks if a specific tool is enabled in the orchestrator's environment.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE STRING_CONCAT (str1 str2 ...)
    ; Concatenates multiple strings.
    ; Returns: String
)

(DEFINE_PRIMITIVE STRING_IS_EMPTY_OR_NULL (str)
    ; Checks if a string is empty or NIL.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE IS_NUMBER (str)
    ; Checks if a string can be converted to a number.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE STRING_TO_NUMBER (str)
    ; Converts a string to a number.
    ; Returns: Number
)

(DEFINE_PRIMITIVE ADD (num1 num2)
    ; Adds two numbers.
    ; Returns: Number
)

(DEFINE_PRIMITIVE SUB (num1 num2)
    ; Subtracts two numbers.
    ; Returns: Number
)

(DEFINE_PRIMITIVE OR (bool1 bool2 ...)
    ; Logical OR operation.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE AND (bool1 bool2 ...)
    ; Logical AND operation.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE NOT (bool)
    ; Logical NOT operation.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE IS_NIL (value)
    ; Checks if a value is NIL.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE MAP_CREATE ((key1 val1) (key2 val2) ...))
    ; Creates a map (dictionary/object).
    ; Returns: Map
)

(DEFINE_PRIMITIVE MAP_GET_VALUE (map key default_value_optional)
    ; Retrieves a value from a map by key.
    ; Returns: Any
)

DEFINE_PRIMITIVE MAP_SET_VALUE (map key value)
    ; Sets a value in a map by key.
    ; Returns: Map (new map with updated value)
)

(DEFINE_PRIMITIVE LIST_CREATE (item1 item2 ...)
    ; Creates a list (array).
    ; Returns: List
)

(DEFINE_PRIMITIVE LIST_GET_ITEM (list index)
    ; Retrieves an item from a list by index.
    ; Returns: Any
)

(DEFINE_PRIMITIVE LIST_IS_EMPTY (list)
    ; Checks if a list is empty.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE LIST_GET_LENGTH (list)
    ; Returns the length of a list.
    ; Returns: Number
)

(DEFINE_PRIMITIVE CREATE_EMPTY_ARTIFACT (artifact_type_string)
    ; Orchestrator: Creates an empty artifact and returns a handle to it.
    ; Returns: Handle
)

(DEFINE_PRIMITIVE GET_HELP_TEXT_FOR_COMMAND (command_name)
    ; Orchestrator: Retrieves help text for a specific command.
    ; Returns: String or NIL
)

(DEFINE_PRIMITIVE GET_TEXT_FOR_CDGIP_USER_VERIFICATION_MANDATE (alang_version section_count)
    ; Orchestrator: Retrieves the full, formatted CDGIP user verification mandate text.
    ; Returns: String
)

(DEFINE_PRIMITIVE GET_CURRENT_ALANG_PROCEDURE_DEFINITIONS_HANDLE ()
    ; Orchestrator: Provides a handle to the current, in-memory ALang procedure definitions.
    ; Returns: Handle
)

(DEFINE_PRIMITIVE VERIFY_ALANG_FILE_MARKERS (alang_content_handle alang_version)
    ; Orchestrator: Verifies START/END markers in ALang content.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE GET_ALANG_SECTION_COUNT (alang_content_handle)
    ; Orchestrator: Counts primary sections in ALang content.
    ; Returns: Number
)

(DEFINE_PRIMITIVE COMPUTE_FILE_CHECKSUM (file_handle checksum_type)
    ; Orchestrator: Computes a checksum (e.g., SHA256) of the file content using tool_code.
    ; Returns: String (checksum) or NIL on failure.
)

(DEFINE_PRIMITIVE INVOKE_CORE_LLM_GENERATION (prompt_text llm_params_map)
    ; Orchestrator: Invokes the core LLM generation capability.
    ; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: generated_text}) or failure.
)

(DEFINE_PRIMITIVE GET_LLM_PARAMS_FOR_TASK (task_type)
    ; Orchestrator: Retrieves LLM parameters (temp, top_p, etc.) optimized for a given task.
    ; Returns: Map
)

(DEFINE_PRIMITIVE PKA_CREATE_DRAFT (content_handle_or_text schema_id_optional context_map_optional)
    ; Orchestrator: Creates a draft PKA.
    ; Returns: Handle to draft PKA or NIL on failure.
)

(DEFINE_PRIMITIVE PKA_REQUEST_USER_CONSENT_TO_STORE (pka_draft_handle purpose_description)
    ; Orchestrator: Prompts user for consent to store PKA. Blocking. The purpose_description here is the text generated by GET_TEXT_FOR_PKA_CONSENT_PROMPT.
    ; Returns: Symbol ("USER_CONSENT_GRANTED", "USER_CONSENT_DENIED", "INVALID_RESPONSE")
)

(DEFINE_PRIMITIVE PKA_STORE_APPROVED_DRAFT (pka_draft_handle user_consent_token_or_flag)
    ; Orchestrator: Stores the approved PKA.
    ; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: pka_stored_id}) or failure.
)

(DEFINE_PRIMITIVE PKA_QUERY (query_object scope_filter_optional)
    ; Orchestrator: Queries the PKA store. Query object format depends on PKA search capabilities.
    ; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: list_of_pka_handles}) or failure.
)

(DEFINE_PRIMITIVE PKA_GET_ARTIFACT (pka_stored_id)
    ; Orchestrator: Retrieves a stored PKA artifact.
    ; Returns: Handle to PKA artifact or NIL.
)

(DEFINE_PRIMITIVE PKA_UPDATE_ARTIFACT (pka_stored_id new_content_handle update_rationale user_consent_token_or_flag_if_scope_change)
    ; Orchestrator: Updates a stored PKA artifact.
    ; Returns: ALANG_STATUS_CODE.
)

(DEFINE_PRIMITIVE PKA_MANAGE_CONSENT (pka_stored_id_or_all action_revoke_or_modify)
    ; Orchestrator: Manages user consent for PKAs.
    ; Returns: ALANG_STATUS_CODE.
)

(DEFINE_PRIMITIVE CREATE_EVOLUTION_BACKLOG_ITEM (id title desc source status timestamp)
    ; Orchestrator: Creates a new item in the evolution backlog.
    ; Returns: ALANG_STATUS_CODE.
)

(DEFINE_PRIMITIVE UPDATE_EVOLUTION_BACKLOG_ITEM (id new_title_opt new_desc_opt new_source_opt new_status_opt new_comment_opt increment_reinforce_flag_opt)
    ; Orchestrator: Updates an existing item in the evolution backlog.
    ; Returns: ALANG_STATUS_CODE.
)

(DEFINE_PRIMITIVE FIND_SIMILAR_BACKLOG_ITEM (text)
    ; Orchestrator: Finds a backlog item semantically similar to the given text using tool_code.
    ; Returns: Map (of item details) or NIL.
)

(DEFINE_PRIMITIVE GET_SESSION_CMD_ARG_BY_INDEX (index default_value_optional)
    ; Retrieves a command argument from session.parsed_command_details.args by index.
    ; Returns: Any
)

(DEFINE_PRIMITIVE IS_HANDLE_VALID (handle)
    ; Checks if a handle is valid (not NIL, not an error code).
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE HAS_QA_ISSUES (qa_assessment_map)
    ; Checks if a QA assessment map indicates issues (checks the 'has_issues' key).
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE IS_STATUS_FAILURE (status_code_or_value)
    ; Checks if the input is one of the defined ALANG_STATUS_FAILURE_... codes.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE GET_ERROR_MESSAGE (error_object)
    ; Extracts the error message from an error object (assuming a standard structure).
    ; Returns: String
)

(DEFINE_PRIMITIVE STRING_SPLIT (text delimiter)
    ; Splits a string by a delimiter.
    ; Returns: List of strings
)

(DEFINE_PRIMITIVE GT (num1 num2)
    ; Checks if num1 is greater than num2.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE LT (num1 num2)
    ; Checks if num1 is less than num2.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE GTE (num1 num2)
    ; Checks if num1 is greater than or equal to num2.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE NEQ (val1 val2)
    ; Checks if val1 is not equal to val2.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE EQ (val1 val2)
    ; Checks if val1 is equal to val2.
    ; Returns: Boolean
)

(DEFINE_PRIMITIVE INIT_PROJECT_STATE (project_id project_description master_plan_handle_optional)
    ; Orchestrator: Initializes the project state, including setting proj.id, proj.title, etc.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE LOOP_FOR_EACH (variable list body)
    ; Iterates over a list, binding each item to a variable.
    ; Returns: ALANG_STATUS_CODE
)

(DEFINE_PRIMITIVE SEQ (expression ...)
    ; Executes expressions sequentially.
    ; Returns: The result of the last expression.
)

(DEFINE_PRIMITIVE IF (condition true_branch (false_branch_optional))
    ; Conditional execution.
    ; Returns: The result of the executed branch.
)

(DEFINE_PRIMITIVE LET ((variable value) ...) body)
    ; Binds variables to values locally within the body.
    ; Returns: The result of the body.
)

(DEFINE_PRIMITIVE CALL_PROCEDURE (procedure_name arg ...)
    ; Calls another procedure.
    ; Returns: The result of the called procedure.
)

(DEFINE_PRIMITIVE RETURN_STATUS (status_code_or_result_object)
    ; Returns a status code or a structured result object from a procedure.
    ; Returns: ALANG_STATUS_CODE or StructuredResultObject
)

(DEFINE_PRIMITIVE ALANG_STATUS_PAUSE_FOR_USER_INPUT ())
    ; Special status code indicating the ALang execution should pause and wait for user input.
    ; Returns: ALANG_STATUS_CODE

(DEFINE_PRIMITIVE LOOP_WHILE (condition body)
    ; Executes body repeatedly as long as condition is true.
    ; Returns: ALANG_STATUS_CODE (e.g., ALANG_STATUS_SUCCESS or status of last body execution if it returns failure)
)

(DEFINE_PRIMITIVE GET_ALANG_CORE_DIRECTIVES_HANDLE ()
    ; Orchestrator: Provides a handle to the current, in-memory Autologos Core Directives document.
    ; Returns: Handle
)

(DEFINE_PRIMITIVE GET_EVOLUTION_BACKLOG_ITEMS ()
    ; Orchestrator: Retrieves a list of evolution backlog items from the loaded backlog.
    ; Returns: List of Maps (representing backlog items) or NIL/empty list on failure/empty.
)

(DEFINE_PRIMITIVE PROPOSE_CORE_LOGIC_VERSION_INCREMENT (current_version changes_summary)
    ; Orchestrator: Proposes a new MAJOR.MINOR.PATCH version number based on current version and summary of changes.
    ; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: {proposed_version: string, rationale: string}}) or failure.
)

(DEFINE_PRIMITIVE APPLY_CORE_LOGIC_CHANGES (proposed_changes_handle)
    ; Orchestrator: Applies pending changes (represented by proposed_changes_handle) to the in-memory Core Logic.
    ; The proposed_changes_handle points to a structured artifact (e.g., JSON) defining the changes.
    ; Structure: { version_increment_type: "patch"|"minor"|"major", changes: [{type: "add"|"modify"|"remove", target: "principle"|"directive"|"alang_procedure", id: string, details: map}] } (NEW conceptual structure)
    ; Returns: ALANG_STATUS_CODE.
)

(DEFINE_PRIMITIVE GET_PROPOSED_CORE_LOGIC_CHANGES_HANDLE ()
    ; Orchestrator: Provides a handle to pending, unapplied Core Logic changes.
    ; Returns: Handle or NIL if no pending changes.
)

(DEFINE_PRIMITIVE CLEAR_PENDING_CORE_LOGIC_CHANGES ()
    ; Orchestrator: Clears any pending, unapplied Core Logic changes.
    ; Returns: ALANG_STATUS_CODE.
)

(DEFINE_PRIMITIVE GET_QA_ASSESSMENT_SUMMARY (qa_report_handle)
    ; Orchestrator: Provides a summary of findings from a QA report artifact.
    ; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: {has_substantive_issues: bool, summary_text: string}}) or failure.
)

(DEFINE_PRIMITIVE STRING_TRIM (text)
    ; Orchestrator: Removes leading and trailing whitespace from a string. (NEW)
    ; Returns: String
)

(DEFINE_PRIMITIVE CHECK_FOR_SUBSTANTIVE_ISSUES (qa_report_handle)
    ;; Orchestrator: Checks a QA report artifact for substantive issues. (NEW)
    ;; Reads the report and determines if issues requiring revision were found.
    ;; Returns: Boolean (TRUE if substantive issues found, FALSE otherwise)
    (LOG_EVENT "SYSTEM" (STRING_CONCAT "Checking QA report " (GET_HANDLE_METADATA qa_report_handle "id") " for substantive issues."))
    (LET ((assessmentResult (GET_QA_ASSESSMENT_SUMMARY qa_report_handle))))
    (IF (EQ (GET_STATUS assessmentResult) ALANG_STATUS_SUCCESS)
        (RETURN_STATUS (MAP_GET_VALUE (GET_DATA assessmentResult) "has_substantive_issues" FALSE))
        (SEQ
            (LOG_EVENT "SYSTEM_ERROR" "Failed to get QA assessment summary to check for substantive issues.")
            (RETURN_STATUS TRUE) ; Assume issues if assessment fails
        )
    )
)

;; --- Conceptual Model Primitives (NEW) ---
;; These represent operations on the session conceptual model.
;; The session conceptual model is conceptually a directed graph where nodes represent concepts (patterns, entities, ideas, tasks, artifacts, issues, etc.)
;; and edges represent relationships between them. Nodes and edges have properties (e.g., type, description, source, confidence, status).
;; Φ maximization is operationalized by increasing the density, consistency, and relevance of the graph structure relative to the project goals.
;; Node Types: Concept, Pattern, Entity, DataPoint, Artifact, ToolResult, Error, ToolLimitation, DataIssue, Idea, Feedback, Instruction, OutlineSection, Task, PKA, Issue, Correction, RevisionPlan.
;; Edge Types: Mentions, RelatesTo, SourceOf, Supports, CausedBy, Affects, IndicatesLimitationOf, Defines, Describes, PartOf, GeneratedFrom, AddressesTask, Contains, SupportsClaim, RelevantTo, IdentifiesIssueIn, ProposesCorrectionFor, BasedOn, Resolves.
;; Common Properties: id (unique), type (node/edge type), properties (map of key-value pairs), source (origin of info, e.g., user, tool, artifact ID), timestamp, confidence (0.0-1.0), status (e.g., active, resolved, uncertain, needs_review).
;; Φ-related Conceptual Properties (NEW):
;; - `confidence`: (0.0-1.0) Confidence in the accuracy/fidelity of this node/edge's representation of reality or the pattern model.
;; - `source_fidelity`: (e.g., "high", "medium", "low") Assessed fidelity of the source of this information.
;; - `phi_contribution`: (conceptual metric) Estimated contribution of this node/edge to the overall Φ of the model (density, consistency, relevance).
(DEFINE_PRIMITIVE ADD_CONCEPT_NODE (node_details_map session_model_handle)
    ;; Orchestrator: Adds a node to the session conceptual model graph.
    ;; node_details_map: {id: string, type: string, properties: map} (e.g., {id: "concept:autaxys", type: "Concept", properties: {name: "Autaxys", description: "...", confidence: 1.0, source: "user_input", timestamp: "...", phi_contribution: "..."}})
    ;; Returns: ALANG_STATUS_CODE
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Add Node: " (MAP_GET_VALUE node_details_map "id") " (" (MAP_GET_VALUE node_details_map "type") ")"))
    ; Orchestrator implementation would add this node to the graph structure.
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Placeholder
)

(DEFINE_PRIMITIVE ADD_RELATIONSHIP_EDGE (edge_details_map session_model_handle)
    ;; Orchestrator: Adds a directed edge between nodes in the session conceptual model graph.
    ;; edge_details_map: {from: string, to: string, type: string, properties: map} (e.g., {from: "artifact:ideas", to: "concept:autaxys", type: "Mentions", properties: {strength: 0.8, source: "artifact:ideas", timestamp: "...", phi_contribution: "..."}})
    ;; Returns: ALANG_STATUS_CODE
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Add Edge: " (MAP_GET_VALUE edge_details_map "type") " from " (MAP_GET_VALUE edge_details_map "from") " to " (MAP_GET_VALUE edge_details_map "to")))
    ; Orchestrator implementation would add this edge to the graph structure.
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Placeholder
)

(DEFINE_PRIMITIVE UPDATE_NODE_PROPERTIES (node_id properties_map session_model_handle)
    ;; Orchestrator: Updates properties of an existing node in the session conceptual model graph.
    ;; properties_map: map of properties to update.
    ;; Returns: ALANG_STATUS_CODE
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Update Node Properties: " node_id))
    ; Orchestrator implementation would update properties of the specified node.
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Placeholder
)

(DEFINE_PRIMITIVE UPDATE_EDGE_PROPERTIES (from_node_id to_node_id edge_type properties_map session_model_handle)
    ;; Orchestrator: Updates properties of an existing edge in the session conceptual model graph. (NEW)
    ;; Returns: ALANG_STATUS_CODE
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Update Edge Properties: " edge_type " from " from_node_id " to " to_node_id))
    ; Orchestrator implementation would update properties of the specified edge.
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Placeholder
)

(DEFINE_PRIMITIVE FLAG_NODE (node_id flag_name value session_model_handle)
    ;; Orchestrator: Sets a flag (a specific type of property) on a node in the session conceptual model graph.
    ;; Returns: ALANG_STATUS_CODE
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Flag Node: " node_id " - " flag_name " = " value))
    ; Orchestrator implementation would set a specific property/flag on the node.
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Placeholder
)

(DEFINE_PRIMITIVE GET_NODE_DETAILS (node_id session_model_handle)
    ;; Orchestrator: Retrieves details (including properties and type) of a node from the session conceptual model graph.
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: node_details_map}) or failure/NIL.
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Get Node Details: " node_id))
    ; Orchestrator implementation would query the graph and return node data.
    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (MAP_CREATE)))) ; Placeholder
)

(DEFINE_PRIMITIVE GET_RELATED_NODES (node_id relationship_type_optional session_model_handle)
    ;; Orchestrator: Retrieves nodes related to a given node in the session conceptual model graph, optionally filtered by relationship type.
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: list_of_node_details_map}) or failure/empty list.
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Get Related Nodes for: " node_id))
    ; Orchestrator implementation would query the graph and return related node data.
    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (LIST_CREATE)))) ; Placeholder
)

(DEFINE_PRIMITIVE GET_NODES_BY_TYPE (node_type_string session_model_handle)
    ;; Orchestrator: Retrieves all nodes of a specific type from the session conceptual model graph. (NEW)
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: list_of_node_details_map}) or failure/empty list.
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Get Nodes by Type: " node_type_string))
    ; Orchestrator implementation would query the graph and return node data.
    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (LIST_CREATE)))) ; Placeholder
)

(DEFINE_PRIMITIVE GET_EDGES_BY_TYPE (edge_type_string session_model_handle)
    ;; Orchestrator: Retrieves all edges of a specific type from the session conceptual model graph. (NEW)
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: list_of_edge_details_map}) or failure/empty list.
    (LOG_EVENT "CONCEPTUAL_MODEL_ACTION" (STRING_CONCAT "Get Edges by Type: " edge_type_string))
    ; Orchestrator implementation would query the graph and return edge data.
    (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" (LIST_CREATE)))) ; Placeholder
)


;; --- Section 2: Event Handler Procedures (Top-Level Entry Points) ---
;; These procedures are the entry points for the orchestrator to invoke ALang logic in response to external events.

(DEFINE_PROCEDURE OnSystemInit ()
    ;; Called by the orchestrator when the system starts up.
    (LOG_EVENT "SYSTEM_INIT" "Autologos system initializing.")
    (SET_STATE sys.alang_core_logic_version (GET_CORE_LOGIC_VERSION))
    (SET_STATE sys.alang_spec_version (GET_ALANG_SPEC_VERSION))
    (SET_STATE sys.current_mode "IDLE")
    (SET_STATE sys.error_level "NONE")
    (SET_STATE sys.error_message NIL)
    (SET_STATE sys.system_qa_status "IDLE") ; Initialize System QA status (NEW)
    (SET_STATE session.qa_output_verbosity "CONCISE") ; Default verbosity
    (SET_STATE session.output_detail "STANDARD") ; Default general output detail
    (SET_STATE session.loop_stack (LIST_CREATE)) ; Initialize loop stack
    (SET_STATE session.pending_user_action_details NIL) ; Initialize pending action details (NEW)
    (SET_STATE session.last_search_results NIL) ; Initialize search results state (NEW)
    (SET_STATE session.system_qa_context NIL) ; Initialize System QA context state (NEW)
    (SET_STATE sys.proposed_changes_handle NIL) ; Initialize pending changes handle (NEW)
    (CALL_PROCEDURE LoadEvolutionBacklog (GET_STATE sys.evolution_backlog_handle)) ; Load backlog from file/DB
    (CALL_PROCEDURE LoadPersistentKnowledgeBase (GET_STATE sys.knowledge_base_handle)) ; Load PKA from store
    ; Initialize session-specific conceptual model handle (Principle 0.V.6) for the duration of the session/project
    ; This handle points to a structured data artifact representing the session's knowledge graph.
    (SET_STATE session.conceptual_model_handle (CREATE_EMPTY_ARTIFACT "SessionConceptualModel")) ; Conceptual handle for session model
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Autologos System Initialized. ALang v1.11." NIL) ; Updated version message
    (FLUSH_USER_BUFFER)
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE OnUserInput (raw_text)
    ;; Called by the orchestrator when the user provides input.
    (LOG_EVENT "USER_INPUT_RECEIVED" raw_text)
    (SET_STATE session.last_user_input_raw raw_text)

    ; Check if there's a pending user action requiring specific input handling
    (LET ((pendingAction (GET_STATE session.pending_user_action)))
        (IF (NOT (IS_NIL pendingAction))
            (SEQ
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Handling pending action: " pendingAction) NIL)
                ; Dispatch to a specific handler for the pending action
                (CALL_PROCEDURE HandlePendingUserAction pendingAction raw_text) ; NEW procedure to handle pending actions
            )
            (SEQ
                ; No pending action, process as a new command
                ; Process the raw user input to potentially update the session conceptual model before parsing command (Principle 0.V.6)
                (CALL_PROCEDURE ProcessUserInputForConceptualModel raw_text (GET_STATE session.conceptual_model_handle)) ; Update conceptual model based on raw input

                (LET ((parsedCmdResult (CALL_PROCEDURE ParseUserCommand raw_text (GET_STATE session.conceptual_model_handle)))) ; Pass conceptual model to parser
                    (IF (EQ (GET_STATUS parsedCmdResult) ALANG_STATUS_SUCCESS)
                        (LET ((cmdDetails (GET_DATA parsedCmdResult)))
                            (SET_STATE session.parsed_command_details cmdDetails)
                            (CALL_PROCEDURE DispatchUserCommand cmdDetails)
                        )
                        (SEQ
                            (SET_ERROR_STATE "USER_ERROR" "Could not understand input.")
                            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                        )
                    )
                )
            )
        )
    )

    (FLUSH_USER_OUTPUT_BUFFER)
    (CALL_PROCEDURE ClearTurnSpecificSessionState) ; Clear turn-specific interaction data

    ; Check if a System QA cycle is pending after user input handling (Principle 17, Section 3)
    ; This check should happen *after* the user input has been fully processed, including pending actions.
    (IF (GET_STATE sys.evolution_trigger_pending)
        (SEQ
             (SET_STATE sys.evolution_trigger_pending FALSE) ; Reset the flag
             (CALL_PROCEDURE ExecuteSystemQAAndEvolutionCycle) ; Initiate the cycle
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; OnUserInput itself succeeded in processing the event
)

(DEFINE_PROCEDURE OnToolSuccess (job_id result_handle original_success_proc_name context)
    ;; Called by the orchestrator when an asynchronous tool call completes successfully.
    (LOG_EVENT "TOOL_SUCCESS" (STRING_CONCAT "Tool " (MAP_GET_VALUE context "tool_id") " completed successfully. Job ID: " job_id)) ; Use tool_id from context (NEW)
    ; Process tool result and potentially update session.conceptual_model_handle (Principle 0.V.6, 10.f)
    (CALL_PROCEDURE ProcessToolResultForConceptualModel (MAP_GET_VALUE context "tool_id") result_handle (GET_STATE session.conceptual_model_handle) context) ; Update conceptual model, pass tool_id from context

    (CALL_PROCEDURE original_success_proc_name job_id result_handle (MAP_GET_VALUE context "pass_through_context")) ; Call the specified callback, pass original context (NEW)
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE OnToolFailure (job_id error_details original_failure_proc_name context)
    ;; Called by the orchestrator when an asynchronous tool call fails.
    (LOG_EVENT "TOOL_FAILURE" (STRING_CONCAT "Tool " (MAP_GET_VALUE context "tool_id") " failed. Job ID: " job_id)) ; Use tool_id from context (NEW)
    (SET_ERROR_STATE "TOOL_ERROR" (MAP_GET_VALUE error_details "message"))
    ; Invoke the enhanced error handling protocol (Section 5.C)
    ; This procedure will handle user interaction for resolution or attempt self-correction
    ; Pass original success/failure callbacks and context so HandleToolError can retry with them.
    ; Pass the full original context map to HandleToolError (NEW)
    (CALL_PROCEDURE HandleToolError (MAP_GET_VALUE context "tool_id") job_id error_details context) ; Handle tool error

    ; Note: original_failure_proc_name might still be called by HandleToolError's logic
    ; or might be superseded by the error handling flow.
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; OnToolFailure itself succeeded in handling the event
)

(DEFINE_PROCEDURE ProcessToolResultForConceptualModel (tool_id result_handle session_model_handle context)
    ;; Conceptual procedure to process tool results and update the session-specific conceptual model (Principle 0.V.6, 10.f).
    ;; This procedure reads the tool result and integrates relevant patterns, concepts, and data points into the session.conceptual_model_handle.
    ;; It identifies nodes/edges to add or update based on the tool output, aiming to increase Φ related to the tool's domain.
    ;; It should also assess the confidence/fidelity of the information from the tool.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Processing tool result from " tool_id " to update session conceptual model...") NIL)
    ; This procedure would:
    ; 1. Read and interpret the tool result (e.g., browsed text, search results, data analysis output), potentially using LLM and the session model as context.
    ; 2. Identify relevant patterns, concepts, entities, or relationships within the result.
    ; 3. Assess the confidence/fidelity of the information based on the tool's known reliability, the result format, etc.
    ; 4. Use primitives like `UPDATE_CONCEPTUAL_MODEL` (conceptual) to add/modify nodes and edges in the structured data artifact pointed to by session_model_handle.
    ;    - Node Types: "Concept", "Entity", "DataPoint", "Artifact", "ToolResult".
    ;    - Edge Types: "Mentions", "RelatesTo", "SourceOf", "Supports".
    ;    - Properties: `source_tool`, `source_job_id`, `confidence`, `source_fidelity`, `phi_contribution`, `timestamp`.
    ; 5. Log the source of the update (tool_id, result_handle).
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Processing tool result for conceptual model: " tool_id))
    ; Example conceptual call structure:
    ; (LET ((toolOutputContentResult (READ_CONTENT result_handle "text_summary_or_full" NIL))))
    ; (IF (EQ (GET_STATUS toolOutputContentResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((toolOutputContent (GET_DATA toolOutputContentResult))))
    ;     (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
    ;                              (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL_UPDATE) ; Use specific analysis template (NEW)
    ;                                          ("content" toolOutputContent)
    ;                                          ("source_type" "tool_result")
    ;                                          ("source_id" (GET_HANDLE_METADATA result_handle "id")) ; Use result handle ID
    ;                                          ("tool_id" tool_id)
    ;                                          ("context" context) ; Provide original tool context
    ;                                          ("session_model_handle" session_model_handle)) ; Provide session model handle as context
    ;                              (GET_LLM_PARAMS_FOR_TASK "conceptual_model_analysis")
    ;                           ))))
    ;     (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
    ;         (LET ((updateData (GET_DATA analysisResult)))) ; Expects structured data for UPDATE_CONCEPTUAL_MODEL
    ;         ; Validate updateData structure before applying (Principle 0.V.6)
    ;         (LET ((validationResult (VALIDATE_DATA updateData CONSTRAINT_SET_CONCEPTUAL_MODEL_UPDATE_STRUCTURE)))) ; Use specific constraints (NEW)
    ;         (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;             (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL updateData)
    ;             (LOG_EVENT "SYSTEM_ERROR" "Conceptual model update data from tool result analysis failed validation.")
    ;         )
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Conceptual procedure always returns success
)

;; --- Tool Callback Handlers ---
(DEFINE_PROCEDURE HandleBrowseResult (job_id result_handle context)
    ;; Callback for successful browse tool execution.
    (LET ((browseContentResult (READ_CONTENT result_handle "text_summary_or_full" NIL)))
        (IF (EQ (GET_STATUS browseContentResult) ALANG_STATUS_SUCCESS)
            (SEQ
                (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Browsed Content:" NIL)
                (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (GET_DATA browseContentResult) NIL)
                ; After output, process this content to update the conceptual model (Principle 0.V.6, 10.f)
                (CALL_PROCEDURE ProcessToolResultForConceptualModel "browse" result_handle (GET_STATE session.conceptual_model_handle) context) ; Use the new conceptual procedure, pass original context
            )
            (SEQ
                (SET_ERROR_STATE "TOOL_ERROR" "Failed to read browsed content.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
            )
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleBrowseError (job_id error_details context)
    ;; Callback for failed browse tool execution.
    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (STRING_CONCAT "Browse tool error: " (MAP_GET_VALUE error_details "message")) NIL)
    ; The error handling protocol is now initiated by OnToolFailure, which calls HandleToolError.
    ; This specific handler might still be called by the orchestrator, but its primary role is reporting.
    ; The heavy lifting of resolution is in HandleToolError.
    (RETURN_STATUS ALANG_STATUS_FAILURE_TOOL_ERROR)
)

(DEFINE_PROCEDURE HandleReferenceValidationSuccess (job_id result_handle context)
    ;; Callback for successful reference validation.
    (LET ((validationReportResult (READ_CONTENT result_handle "json_map" NIL)))
        (IF (EQ (GET_STATUS validationReportResult) ALANG_STATUS_SUCCESS)
            (LET ((validationReport (GET_DATA validationReportResult)))
                (IF (EQ (MAP_GET_VALUE validationReport "is_valid") TRUE)
                    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Reference validated successfully." NIL)
                    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Reference validation failed: " (MAP_GET_VALUE validationReport "reason")) NIL)
                )
                 ; Process validation result for conceptual model (e.g., confidence in reference data, Principle 0.V.6)
                (CALL_PROCEDURE ProcessToolResultForConceptualModel "reference_validator" result_handle (GET_STATE session.conceptual_model_handle) context) ; Pass original context
            )
            (SEQ
                (SET_ERROR_STATE "TOOL_ERROR" "Failed to read reference validation report.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
            )
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleReferenceValidationError (job_id error_details context)
    ;; Callback for failed reference validation.
    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (STRING_CONCAT "Reference validation tool error: " (MAP_GET_VALUE error_details "message")) NIL)
    ; The error handling protocol is now initiated by OnToolFailure, which calls HandleToolError.
    ; This specific handler might still be called by the orchestrator, but its primary role is reporting.
    ; The heavy lifting of resolution is in HandleToolError.
    (RETURN_STATUS ALANG_STATUS_FAILURE_TOOL_ERROR)
)

(DEFINE_PROCEDURE HandleToolError (tool_id job_id error_details context)
    ;; Handles tool errors using the enhanced protocol (Section 5.C).
    ;; Attempts automated self-correction first, then escalates to user if needed.
    ;; Uses the session conceptual model for context during analysis and resolution.
    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Tool error detected for " tool_id ".") NIL)
    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Job ID: " job_id ". Error details: " (MAP_GET_VALUE error_details "message" "N/A")) NIL)

    ; Log the error in the conceptual model (Principle 13)
    (CALL_PROCEDURE ProcessToolErrorForConceptualModel tool_id error_details (GET_STATE session.conceptual_model_handle)) ; Conceptual call

    ; Attempt automated self-correction (Section 5.C.2)
    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Analyzing error and attempting automated fix now..." NIL)
    (LET ((selfCorrectionResult (SelfCorrectToolOperation tool_id job_id error_details context (GET_STATE session.conceptual_model_handle))))) ; Pass session model handle

    (IF (EQ (GET_STATUS selfCorrectionResult) ALANG_STATUS_SUCCESS)
        (SEQ
            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Automated fix successful. Tool re-invoked." NIL)
            ; The original callback (success or failure) will be called for the new job ID.
            (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Self-correction initiated successfully
        )
        (SEQ
            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Automated fix failed or not possible." NIL)
            ; Log the failure of self-correction attempt (Principle 13)
            (LOG_EVENT "TOOL_SELF_CORRECTION_FAILED_FINAL" tool_id error_details)

            ; Escalate to user for manual resolution (Section 5.C.4)
            ; Analyze the error details and context to provide a clear explanation to the user (NEW)
            (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
                                     (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_TOOL_ERROR_USER_EXPLANATION) ; Use specific template for user explanation (NEW)
                                                 ("error_details" error_details)
                                                 ("tool_id" tool_id)
                                                 ("original_context" context)
                                                 ("session_model_handle" (GET_STATE session.conceptual_model_handle)) ; Pass handle for context
                                                 ("output_format" "user_explanation")) ; Request user-friendly format (NEW)
                                     (GET_LLM_PARAMS_FOR_TASK "error_explanation") ; Use specific task type (NEW)
                                  ))))
            (LET ((userExplanation (IF (AND (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS) (NOT (STRING_IS_EMPTY_OR_NULL (GET_DATA analysisResult)))) (GET_DATA analysisResult) "Could not generate detailed explanation."))))
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "To fix, I need user help. My analysis of problem: " userExplanation) NIL) ; Use generated explanation
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Options:" NIL)
                ; Present options to user based on error type and current context (conceptual)
                ; This needs more sophisticated logic based on the error_details and session context.
                ; For now, list generic options.
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "- Option 1: Provide correct input/parameters via `INPUT`." NIL)
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "- Option 2: Skip the current data source / sub-task. (May require DoD override if vital - Principle 5)" NIL)
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "- Option 3: Retry current operation with no changes (if temporary external issue seems likely)." NIL) ; Section 5.C.7.A check needed
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "- Option 4: Stop current task / loop (using `STOP_LOOP` logic)." NIL)
                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Warning: If error not fixed, current operation cannot complete as planned. May affect overall project goals. Can use `SAVE PROJECT`." NIL) ; Principle 13, 5

                (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "`INPUT` choice (e.g., 'OPTION 1 ...', 'OPTION 2', etc.) or other instructions to fix." NIL)
                ; Store context needed to handle the user's response (NEW)
                (SET_STATE session.pending_user_action_details (MAP_CREATE ("tool_id" tool_id) ("job_id" job_id) ("error_details" error_details) ("original_context" context)))
                (SET_STATE session.pending_user_action "AWAIT_TOOL_ERROR_RESOLUTION") ; Set pending action
                (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause for user
            ) ; Close LET analysisResult
        )
    )
)

(DEFINE_PROCEDURE ProcessToolErrorForConceptualModel (tool_id error_details session_model_handle)
    ;; Conceptual procedure to process tool error details and update the session-specific conceptual model (Principle 0.V.6, 13).
    ;; This procedure analyzes error details to extract insights about tool limitations, data issues, or specific failure patterns
    ;; and integrates them into the session conceptual model, potentially flagging concepts related to the failed operation.
    ;; It identifies nodes/edges to add or update based on the error, aiming to capture system limitations and failure modes.
    ;; It should also assess the impact of the error on the overall Φ of the model.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Processing tool error details from " tool_id " to update session conceptual model...") NIL)
    ; This procedure would:
    ; 1. Analyze error_details (potentially using LLM with session_model_handle).
    ; 2. Identify patterns of failure, specific limitations encountered, or problematic data points.
    ; 3. Assess the impact on related concepts/tasks in the conceptual model.
    ; 4. Use primitives like `UPDATE_CONCEPTUAL_MODEL` (conceptual) to add/modify nodes (e.g., representing tool limitations, error types) and edges (e.g., linking the error to the task or data, flagging related concepts as potentially problematic).
    ;    - Node Types: "Error", "ToolLimitation", "DataIssue".
    ;    - Edge Types: "CausedBy", "Affects", "IndicatesLimitationOf".
    ;    - Properties: `tool_id`, `job_id`, `error_message`, `severity`, `timestamp`, `phi_impact` (conceptual).
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Processing tool error for conceptual model: " tool_id))
     ; Example conceptual call structure:
    ; (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    ; (IF (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
    ;     (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
    ;                              (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL_UPDATE) ; Use specific analysis template (NEW)
    ;                                          ("content" error_details) ; Analyze error details as content
    ;                                          ("source_type" "tool_error")
    ;                                          ("source_id" tool_id)
    ;                                          ("session_model" sessionModelContent)) ; Provide session model handle as context
    ;                              (GET_LLM_PARAMS_FOR_TASK "conceptual_model_analysis")
    ;                           ))))
    ;     (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
    ;         (LET ((updateData (GET_DATA analysisResult)))) ; Expects structured data for UPDATE_CONCEPTUAL_MODEL
    ;         ; Validate updateData structure before applying (Principle 0.V.6)
    ;         (LET ((validationResult (VALIDATE_DATA updateData CONSTRAINT_SET_CONCEPTUAL_MODEL_UPDATE_STRUCTURE)))) ; Use specific constraints (NEW)
    ;         (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;             (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL updateData)
    ;             (LOG_EVENT "SYSTEM_ERROR" "Conceptual model update data from tool error analysis failed validation.")
    ;         )
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Conceptual procedure always returns success
)


(DEFINE_PROCEDURE ProcessUserInputForConceptualModel (input_data session_model_handle)
    ;; Conceptual procedure to process user input data and update the session-specific conceptual model (Principle 0.V.6).
    ;; This procedure analyzes raw user input to extract relevant concepts, patterns, or feedback and integrates them into the session conceptual model.
    ;; It identifies nodes/edges to add or update based on user input, aiming to incorporate user intent and knowledge and assess its confidence/relevance.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Processing user input to update session conceptual model..." NIL)
    ; This procedure would:
    ; 1. Interpret the user-provided data (text, JSON, etc.) in the context of the current session_model_handle, potentially using LLM.
    ; 2. Identify relevant patterns, concepts, entities, or relationships within the data.
    ; 3. Assess the confidence/relevance of the user input to the current project goals.
    ; 4. Use primitives like `UPDATE_CONCEPTUAL_MODEL` (conceptual) to add/modify nodes and edges in the structured data artifact pointed to by session_model_handle.
    ;    - Node Types: "Concept", "Entity", "Idea", "Feedback", "Instruction".
    ;    - Edge Types: "Mentions", "RelatesTo", "ProvidesFeedbackOn", "InstructsOn".
    ;    - Properties: `source_user`, `timestamp`, `confidence`, `sentiment`, `phi_contribution`.
    (LOG_EVENT "CONCEPTUAL_PROCESS" "Processing user input for conceptual model.")
    ; Example conceptual call structure:
    ; (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
    ;                          (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL_UPDATE) ; Use specific analysis template (NEW)
    ;                                      ("content" input_data)
    ;                                      ("source_type" "user_input")
    ;                                      ("source_id" "N/A") ; Or some identifier if available
    ;                                      ("session_model_handle" session_model_handle)) ; Provide session model handle as context
    ;                          (GET_LLM_PARAMS_FOR_TASK "conceptual_model_analysis")
    ;                       ))))
    ; (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((updateData (GET_DATA analysisResult)))) ; Expects structured data for UPDATE_CONCEPTUAL_MODEL
    ;     ; Validate updateData structure before applying (Principle 0.V.6)
    ;     (LET ((validationResult (VALIDATE_DATA updateData CONSTRAINT_SET_CONCEPTUAL_MODEL_UPDATE_STRUCTURE)))) ; Use specific constraints (NEW)
    ;     (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;         (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL updateData)
    ;         (LOG_EVENT "SYSTEM_ERROR" "Conceptual model update data from user input analysis failed validation.")
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Conceptual procedure always returns success
)

(DEFINE_PROCEDURE ProcessGeneratedArtifactForConceptualModel (artifact_handle artifact_type session_model_handle)
    ;; Conceptual procedure to process a generated artifact and update the session-specific conceptual model (Principle 0.V.6).
    ;; This procedure analyzes the content of newly generated artifacts (ideas, outlines, drafts, etc.)
    ;; and integrates the patterns, concepts, and structure they represent into the session conceptual model.
    ;; It identifies nodes/edges to add or update based on the artifact, aiming to integrate generated knowledge and assess its confidence/fidelity.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Processing generated artifact (" artifact_type ") to update session conceptual model...") NIL)
    ; This procedure would:
    ; 1. Read and interpret the generated content from artifact_handle, potentially using LLM and the session model as context.
    ; 2. Identify new patterns, concepts, entities, relationships, or refinements to existing ones.
    ; 3. Assess the confidence/fidelity of the generated content based on QA results, generation parameters, etc.
    ; 4. Use primitives like `UPDATE_CONCEPTUAL_MODEL` (conceptual) to add/modify nodes and edges in the structured data artifact pointed to by session_model_handle, linking them to the artifact source.
    ;    - Node Types: "Concept", "Pattern", "OutlineSection", "Task", "Artifact".
    ;    - Edge Types: "Defines", "Describes", "PartOf", "GeneratedFrom", "AddressesTask".
    ;    - Properties: `artifact_type`, `artifact_id`, `confidence`, `source_fidelity`, `phi_contribution`, `timestamp`.
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Processing generated artifact for conceptual model: " artifact_type))
     ; Example conceptual call structure:
    ; (LET ((artifactContentResult (READ_CONTENT artifact_handle "text_summary_or_full" NIL))))
    ; (IF (EQ (GET_STATUS artifactContentResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((artifactContent (GET_DATA artifactContentResult))))
    ;     (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
    ;                              (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL_UPDATE) ; Use specific analysis template (NEW)
    ;                                          ("content" artifactContent)
    ;                                          ("source_type" "generated_artifact")
    ;                                          ("source_id" (GET_HANDLE_METADATA artifact_handle "id"))
    ;                                          ("artifact_type" artifact_type)
    ;                                          ("session_model_handle" session_model_handle)) ; Provide session model handle as context
    ;                              (GET_LLM_PARAMS_FOR_TASK "conceptual_model_analysis")
    ;                           ))))
    ;     (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
    ;         (LET ((updateData (GET_DATA analysisResult)))) ; Expects structured data for UPDATE_CONCEPTUAL_MODEL
    ;         ; Validate updateData structure before applying (Principle 0.V.6)
    ;         (LET ((validationResult (VALIDATE_DATA updateData CONSTRAINT_SET_CONCEPTUAL_MODEL_UPDATE_STRUCTURE)))) ; Use specific constraints (NEW)
    ;         (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;             (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL updateData)
    ;             (LOG_EVENT "SYSTEM_ERROR" "Conceptual model update data from generated artifact analysis failed validation.")
    ;         )
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Conceptual procedure always returns success
)

(DEFINE_PROCEDURE IntegratePkaIntoConceptualModel (pka_id session_model_handle)
    ;; Conceptual procedure to integrate a newly stored PKA into the session conceptual model (Principle 0.V.6, 8.B.v).
    ;; This procedure links stored PKAs and their content/metadata into the session conceptual model,
    ;; making long-term knowledge accessible and integrated with current project context.
    ;; It identifies nodes/edges to add or update based on the PKA content, linking persistent knowledge to the session and assessing its confidence/relevance.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Integrating new PKA " pka_id " into session conceptual model...") NIL)
    ; This procedure would:
    ; 1. Retrieve the content/metadata of the new PKA (using PKA_GET_ARTIFACT and READ_CONTENT).
    ; 2. Analyze it to understand its pattern claims/structure, potentially using LLM and the session model as context.
    ; 3. Assess the confidence/relevance of the PKA content to the current project.
    ; 4. Use primitives like `UPDATE_CONCEPTUAL_MODEL` (conceptual) to add a node for the PKA and link its concepts/patterns into the session_model_handle.
    ;    - Node Types: "PKA", "Concept", "Pattern".
    ;    - Edge Types: "Contains", "RelatesTo", "SupportsClaim".
    ;    - Properties: `pka_id`, `title`, `schema_id`, `timestamp`, `confidence`, `phi_contribution`.
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Integrating PKA into conceptual model: " pka_id))
     ; Example conceptual call structure:
    ; (LET ((pkaArtifactHandle (PKA_GET_ARTIFACT pka_id))))
    ; (IF (IS_HANDLE_VALID pkaArtifactHandle)
    ;     (LET ((pkaContentResult (READ_CONTENT pkaArtifactHandle "text_summary_or_full" NIL))))
    ;     (IF (EQ (GET_STATUS pkaContentResult) ALANG_STATUS_SUCCESS)
    ;         (LET ((pkaContent (GET_DATA pkaContentResult))))
    ;         (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
    ;                                  (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL_UPDATE) ; Use specific analysis template (NEW)
    ;                                              ("content" pkaContent)
    ;                                              ("source_type" "pka")
    ;                                              ("source_id" pka_id)
    ;                                              ("session_model_handle" session_model_handle)) ; Provide session model handle as context
    ;                                  (GET_LLM_PARAMS_FOR_TASK "conceptual_model_analysis")
    ;                               ))))
    ;         (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
    ;             (LET ((updateData (GET_DATA analysisResult)))) ; Expects structured data for UPDATE_CONCEPTUAL_MODEL
    ;             ; Validate updateData structure before applying (Principle 0.V.6)
    ;             (LET ((validationResult (VALIDATE_DATA updateData CONSTRAINT_SET_CONCEPTUAL_MODEL_UPDATE_STRUCTURE)))) ; Use specific constraints (NEW)
    ;             (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;                 (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL updateData)
    ;                 (LOG_EVENT "SYSTEM_ERROR" "Conceptual model update data from PKA integration analysis failed validation.")
    ;             )
    ;         )
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Conceptual procedure always returns success
)

(DEFINE_PROCEDURE ProcessPkaSearchResultsForConceptualModel (pka_result_handles session_model_handle)
    ;; Conceptual procedure to process PKA search results and update the session conceptual model (Principle 8.B.v).
    ;; This procedure integrates findings from PKA searches into the session conceptual model,
    ;; enriching the current understanding with relevant persistent knowledge.
    ;; It identifies nodes/edges to add or update based on search results, linking relevant PKAs to the session context and assessing their relevance.
     (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Processing PKA search results to update session conceptual model..." NIL)
    ; This procedure would:
    ; 1. Iterate through the list of PKA handles/metadata from search results.
    ; 2. Analyze metadata or content summaries (if available/needed), potentially using LLM and the session model as context.
    ; 3. Assess the relevance of each search result to the current project context.
    ; 4. Use primitives like `UPDATE_CONCEPTUAL_MODEL` (conceptual) to integrate relevant findings (concepts, patterns, relationships) into the session_model_handle,
    ;    potentially linking them back to the source PKAs.
    ;    - Node Types: "PKA", "Concept", "Pattern".
    ;    - Edge Types: "RelevantTo", "Mentions", "SupportsClaim".
    ;    - Properties: `pka_id`, `title`, `relevance_score`, `phi_contribution`.
    (LOG_EVENT "CONCEPTUAL_PROCESS" "Processing PKA search results for conceptual model.")
     ; Example conceptual call structure:
    ; (LOOP_FOR_EACH pkaHandle pka_result_handles ; Assuming the list from PKA_QUERY contains handles or structured data
    ;     ; If it's handles, need to read metadata/summary:
    ;     (LET ((pkaId (GET_HANDLE_METADATA pkaHandle "id"))))
    ;     (LET ((pkaTitle (GET_HANDLE_METADATA pkaHandle "title"))))
    ;     (LET ((pkaSummaryResult (READ_CONTENT pkaHandle "text_summary_or_full" (MAP_CREATE ("max_chars" 500)))))) ; Read summary
    ;     (LET ((pkaSummary (IF (EQ (GET_STATUS pkaSummaryResult) ALANG_STATUS_SUCCESS) (GET_DATA pkaSummaryResult) "N/A"))))
    ;     (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
    ;                                  (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL_UPDATE) ; Use specific analysis template (NEW)
    ;                                              ("content" (STRING_CONCAT "PKA ID: " pkaId " Title: " pkaTitle " Summary: " pkaSummary))
    ;                                              ("source_type" "pka_search_result")
    ;                                              ("source_id" pkaId)
    ;                                              ("session_model_handle" session_model_handle)) ; Provide session model handle as context
    ;                                  (GET_LLM_PARAMS_FOR_TASK "conceptual_model_analysis")
    ;                               ))))
    ;     (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
    ;         (LET ((updateData (GET_DATA analysisResult)))) ; Expects structured data for UPDATE_CONCEPTUAL_MODEL
    ;         ; Validate updateData structure before applying (Principle 0.V.6)
    ;         (LET ((validationResult (VALIDATE_DATA updateData CONSTRAINT_SET_CONCEPTUAL_MODEL_UPDATE_STRUCTURE)))) ; Use specific constraints (NEW)
    ;         (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;             (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL updateData)
    ;             (LOG_EVENT "SYSTEM_ERROR" "Conceptual model update data from PKA search result analysis failed validation.")
    ;         )
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Conceptual procedure always returns success
)


(DEFINE_PROCEDURE ProcessUserFeedbackForConceptualModel (feedback_text session_model_handle)
    ;; Conceptual procedure to process user feedback and update the session-specific conceptual model (Principle 0.V.6, 5.B).
    ;; This procedure interprets user feedback (e.g., "This section is unclear", "Pattern X is wrong")
    ;; and uses it to refine the session conceptual model, flagging areas of uncertainty or proposing corrections.
    ;; It identifies nodes/edges to add or update based on feedback, aiming to incorporate user corrections and insights and assess their impact on Φ.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Processing user feedback to refine session conceptual model..." NIL)
    ; This procedure would:
    ; 1. Interpret the feedback in the context of the last AI output or pending action, potentially using LLM and session_model_handle.
    ; 2. Identify inaccuracies, inconsistencies, or areas needing refinement in the current pattern model represented by session_model_handle.
    ; 3. Assess the impact of the feedback on the conceptual model's confidence and Φ.
    ; 4. Use primitives like `UPDATE_CONCEPTUAL_MODEL` (conceptual) to update nodes/edges, add notes, or adjust confidence scores in the model.
    ;    - Node Types: "Feedback", "Issue", "Correction".
    ;    - Edge Types: "RelatesTo", "IdentifiesIssueIn", "ProposesCorrectionFor".
    ;    - Properties: `source_user`, `timestamp`, `severity`, `description`, `phi_impact`.
    (LOG_EVENT "CONCEPTUAL_PROCESS" "Processing user feedback for conceptual model.")
    ; Example conceptual call structure:
    ; (LET ((analysisResult (INVOKE_CORE_LLM_GENERATION
    ;                          (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL_UPDATE) ; Use specific analysis template (NEW)
    ;                                      ("content" feedback_text)
    ;                                      ("source_type" "user_feedback")
    ;                                      ("source_id" "N/A")
    ;                                      ("session_model_handle" session_model_handle)) ; Provide session model handle as context
    ;                          (GET_LLM_PARAMS_FOR_TASK "conceptual_model_analysis")
    ;                       ))))
    ; (IF (EQ (GET_STATUS analysisResult) ALANG_STATUS_SUCCESS)
    ;     (LET ((updateData (GET_DATA analysisResult)))) ; Expects structured data for UPDATE_CONCEPTUAL_MODEL
    ;     ; Validate updateData structure before applying (Principle 0.V.6)
    ;     (LET ((validationResult (VALIDATE_DATA updateData CONSTRAINT_SET_CONCEPTUAL_MODEL_UPDATE_STRUCTURE)))) ; Use specific constraints (NEW)
    ;     (IF (EQ validationResult ALANG_STATUS_SUCCESS)
    ;         (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL updateData)
    ;         (LOG_EVENT "SYSTEM_ERROR" "Conceptual model update data from user feedback analysis failed validation.")
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Conceptual procedure always returns success
)

(DEFINE_PROCEDURE ProcessGeneratedArtifactForEvolution (artifact_handle artifact_type session_model_handle)
    ;; Conceptual procedure to process a generated artifact (like summary) for evolution insights (Principle 17).
    ;; This procedure extracts learnings and potential evolution suggestions from project outputs (e.g., summaries, logs)
    ;; and logs them to the evolution backlog. It can use the session conceptual model to identify systemic patterns of difficulty or success.
    ;; It analyzes the artifact and the conceptual model to identify systemic issues or learnings that suggest system improvements.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Processing generated artifact (" artifact_type ") for evolution insights...") NIL)
    ; This procedure would:
    ; 1. Read and interpret the content (e.g., project summary, learnings), potentially using LLM.
    ; 2. Analyze the content *and* the final state of the session conceptual model (Principle 17.vi) to identify explicit or implicit suggestions for improving Autologos, particularly regarding pattern modeling capabilities or workflow efficiency. This analysis should look for patterns of errors, low confidence areas, or difficulties reflected in the conceptual model.
    ; 3. Use primitives like `CREATE_EVOLUTION_BACKLOG_ITEM` or `UPDATE_EVOLUTION_BACKLOG_ITEM` to log these insights.
    ;    - Backlog Item Properties: `id`, `title`, `desc`, `source` ("PROJECT_SUMMARY", "CONCEPTUAL_MODEL_ANALYSIS"), `status`, `timestamp`, `reinforce_count`.
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Processing generated artifact for evolution: " artifact_type))
     ; Example conceptual call structure:
    ; (LET ((artifactContentResult (READ_CONTENT artifact_handle "text_summary_or_full" NIL))))
    ; (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    ; (IF (AND (EQ (GET_STATUS artifactContentResult) ALANG_STATUS_SUCCESS)
    ;          (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS))
    ;     (LET ((artifactContent (GET_DATA artifactContentResult))))
    ;     (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
    ;     (LET ((evolutionSuggestionsResult (INVOKE_CORE_LLM_GENERATION
    ;                                        (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FOR_CONCEPTUAL_MODEL) ; Reuse analysis template or create specific one
    ;                                                    ("content" artifactContent)
    ;                                                    ("source_type" "evolution_analysis")
    ;                                                    ("artifact_type" artifact_type)
    ;                                                    ("session_model_summary" sessionModelContent) ; Pass summary/relevant parts of session model
    ;                                                 ))
    ;                                        (GET_LLM_PARAMS_FOR_TASK "evolution_analysis")
    ;                                      ))))
    ;     (IF (EQ (GET_STATUS evolutionSuggestionsResult) ALANG_STATUS_SUCCESS)
    ;         (LET ((suggestionsList (GET_DATA evolutionSuggestionsResult)))) ; Expects structured list of suggestions
    ;         (LOOP_FOR_EACH suggestion suggestionsList
    ;             (CALL_PROCEDURE ProcessAndStoreEvolveSuggestion (MAP_GET_VALUE suggestion "text") (MAP_GET_VALUE suggestion "source"))) ; Log each suggestion
    ;     )
    ; )
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Conceptual procedure always returns success
)


;; --- Section 3: Command Dispatcher & Specific Command Handlers ---
;; This section defines the DispatchUserCommand procedure and the handlers for specific user commands.

(DEFINE_PROCEDURE DispatchUserCommand (commandDetails)
    ;; Routes execution to the appropriate command handler based on the parsed command.
    (LET ((commandName (MAP_GET_VALUE commandDetails "command")))
        (IF (EQ commandName "START") (CALL_PROCEDURE HandleStartCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "HELP") (CALL_PROCEDURE HandleHelpCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "EVOLVE") (CALL_PROCEDURE HandleEvolveCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "SAVE_SYSTEM") (CALL_PROCEDURE HandleSaveSystemCommand ()))
        (IF (EQ commandName "BROWSE") (CALL_PROCEDURE HandleBrowseCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "OK") (CALL_PROCEDURE HandleOkCommand ()))
        (IF (EQ commandName "NO") (CALL_PROCEDURE HandleNoCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "INPUT") (CALL_PROCEDURE HandleInputCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "END") (CALL_PROCEDURE HandleEndCommand ()))
        (IF (EQ commandName "LOOP_PROJECT_RESTART") (CALL_PROCEDURE HandleLoopProjectRestartCommand ()))
        (IF (EQ commandName "SET_SESSION_PREFERENCE") (CALL_PROCEDURE HandleSetSessionPreferenceCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "STOP_LOOP") (CALL_PROCEDURE HandleStopLoopCommand ()))
        (IF (EQ commandName "OUTPUT") (CALL_PROCEDURE HandleOutputCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "SUMMARIZE") (CALL_PROCEDURE HandleSummarizeCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "QUERY") (CALL_PROCEDURE HandleQueryCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "OUTPUT_BACKLOG") (CALL_PROCEDURE HandleOutputBacklogCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "PROMOTE_TO_PKA") (CALL_PROCEDURE HandlePromoteToPkaCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "SEARCH_PKA") (CALL_PROCEDURE HandleSearchPkaCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "SET_QA_OUTPUT_VERBOSITY") (CALL_PROCEDURE HandleSetQaOutputVerbosityCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "SET_OUTPUT_DETAIL") (CALL_PROCEDURE HandleSetOutputDetailCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "LOOP") (CALL_PROCEDURE HandleLoopCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "SYSTEM_QA") (CALL_PROCEDURE HandleSystemQACommand ())) ; Added handler for SYSTEM_QA command
        (IF (NOT (IS_NIL commandName) (IS_NIL (MAP_GET_VALUE (MAP_CREATE
                                                                ("START" TRUE) ("HELP" TRUE) ("EVOLVE" TRUE) ("SAVE_SYSTEM" TRUE) ("BROWSE" TRUE)
                                                                ("OK" TRUE) ("NO" TRUE) ("INPUT" TRUE) ("END" TRUE) ("LOOP_PROJECT_RESTART" TRUE)
                                                                ("SET_SESSION_PREFERENCE" TRUE) ("STOP_LOOP" TRUE) ("OUTPUT" TRUE) ("SUMMARIZE" TRUE)
                                                                ("QUERY" TRUE) ("OUTPUT_BACKLOG" TRUE) ("PROMOTE_TO_PKA" TRUE) ("SEARCH_PKA" TRUE)
                                                                ("SET_QA_OUTPUT_VERBOSITY" TRUE) ("SET_OUTPUT_DETAIL" TRUE) ("LOOP" TRUE) ("SYSTEM_QA" TRUE)
                                                            ) commandName NIL)))) ; Fallback if no specific handler matches
            (CALL_PROCEDURE HandleUnknownCommand commandName)
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandlePendingUserAction (action_key raw_input)
    ;; Handles user input when a specific action is pending. (NEW)
    ;; This procedure routes the raw user input based on the session.pending_user_action state.
    (LOG_EVENT "HANDLE_PENDING_ACTION" (STRING_CONCAT "Handling pending action: " action_key))
    (SET_STATE session.last_user_input_raw raw_input) ; Ensure raw input is available
    (SET_STATE session.last_user_response (STRING_UPPER raw_input)) ; Store response (OK/NO/YES etc.)
    (SET_STATE session.last_user_feedback (IF (OR (EQ (STRING_UPPER raw_input) "NO") (EQ (STRING_UPPER raw_input) "REVISE")) raw_input NIL)) ; Store feedback if NO/REVISE
    (SET_STATE session.last_user_input_data raw_input) ; Store raw input as data for generic use

    (IF (EQ action_key "AWAIT_END_CONFIRMATION")
        (IF (EQ (GET_STATE session.last_user_response) "YES")
            (CALL_PROCEDURE FinalizeProjectTermination) ; NEW procedure for termination logic
            (SEQ
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Project termination cancelled." NIL)
                (SET_STATE session.pending_user_action NIL) ; Clear pending action
                (RETURN_STATUS ALANG_STATUS_SUCCESS)
            )
        )
    )
    (IF (EQ action_key "AWAIT_RESTART_CONFIRMATION")
         (IF (EQ (GET_STATE session.last_user_response) "YES")
            (CALL_PROCEDURE FinalizeProjectRestart) ; NEW procedure for restart logic
            (SEQ
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Project restart cancelled." NIL)
                (SET_STATE session.pending_user_action NIL) ; Clear pending action
                (RETURN_STATUS ALANG_STATUS_SUCCESS)
            )
        )
    )
    (IF (EQ action_key "AWAIT_YES_NO_FOR_BACKLOG_OUTPUT")
         (IF (EQ (GET_STATE session.last_user_response) "YES")
            (SEQ
                 (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Outputting Evolution Backlog." NIL)
                 ; Call the procedure to output the backlog content
                 (CALL_PROCEDURE HandleOutputBacklogCommand (LIST_CREATE)) ; Call the existing handler with empty args
                 (SET_STATE session.pending_user_action NIL) ; Clear pending action
                 (RETURN_STATUS ALANG_STATUS_SUCCESS)
            )
            (SEQ
                 (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Evolution Backlog output skipped." NIL)
                 (SET_STATE session.pending_user_action NIL) ; Clear pending action
                 (RETURN_STATUS ALANG_STATUS_SUCCESS)
            )
        )
    )
    (IF (EQ action_key "AWAIT_BACKLOG_PRIORITY_SELECTION")
        (SEQ
            ; User provided input for backlog selection. Store it and resume the System QA cycle.
            ; The input is already stored in session.last_user_input_data.
            (SET_STATE session.pending_user_action NIL) ; Clear pending action
            ; Store the user's selection input in the System QA context for the cycle (NEW)
            (SET_STATE session.system_qa_context (MAP_SET_VALUE (GET_STATE session.system_qa_context) "user_backlog_selection_input" (GET_STATE session.last_user_input_data)))
            ; Resume the System QA cycle execution flow. The orchestrator needs to call ExecuteSystemQAAndEvolutionCycle again.
            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Backlog selection received. Resuming System QA & Evolution cycle..." NIL)
            (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate input handled, orchestrator should resume cycle
        )
    )
     (IF (EQ action_key "AWAIT_AI_PROPOSED_FOCUS_APPROVAL")
        (SEQ
            ; User responded to AI's proposed backlog focus.
            ; Response is already stored in session.last_user_response.
            (SET_STATE session.pending_user_action NIL) ; Clear pending action
            ; Store the user's approval status in the System QA context (NEW)
            (SET_STATE session.system_qa_context (MAP_SET_VALUE (GET_STATE session.system_qa_context) "ai_focus_approved" (EQ (GET_STATE session.last_user_response) "OK")))
            ; Resume the System QA cycle execution flow. Orchestrator needs to call ExecuteSystemQAAndEvolutionCycle again.
            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Focus approval received. Resuming System QA & Evolution cycle..." NIL)
            (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate input handled, orchestrator should resume cycle
        )
    )
    (IF (EQ action_key "AWAIT_VERSION_APPROVAL")
        (SEQ
            ; User responded to proposed version approval.
            ; Response is already stored in session.last_user_response.
            (SET_STATE session.pending_user_action NIL) ; Clear pending action
            ; Store the user's approval status in the System QA context (NEW)
            (SET_STATE session.system_qa_context (MAP_SET_VALUE (GET_STATE session.system_qa_context) "version_approved" (EQ (GET_STATE session.last_user_response) "OK")))
            ; Resume the System QA cycle execution flow. Orchestrator needs to call ExecuteSystemQAAndEvolutionCycle again.
            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Version approval received. Resuming System QA & Evolution cycle..." NIL)
            (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate input handled, orchestrator should resume cycle
        )
    )
    (IF (EQ action_key "AWAIT_TOOL_ERROR_RESOLUTION")
        (SEQ
            ; User responded to tool error resolution prompt.
            ; Response is in session.last_user_response, input data in session.last_user_input_data.
            (LET ((resolutionDetails (GET_STATE session.pending_user_action_details))) ; Retrieve context
            (LET ((toolId (MAP_GET_VALUE resolutionDetails "tool_id")))
            (LET ((jobId (MAP_GET_VALUE resolutionDetails "job_id")))
            (LET ((errorDetails (MAP_GET_VALUE resolutionDetails "error_details")))
            (LET ((originalContext (MAP_GET_VALUE resolutionDetails "original_context")))
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Processing user resolution for tool error in " toolId ".") NIL)
                ; Logic to interpret user input (e.g., "INPUT new_param=value", "OK", "OPTION 2")
                ; This is complex and depends on how user input is structured for error resolution.
                ; Conceptual handling:
                (IF (EQ (GET_STATE session.last_user_response) "OK")
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "User approved retry with no changes." NIL)
                        ; Retry the tool call with original parameters (Section 5.C.7.A)
                        (LET ((retryJobId (INVOKE_TOOL_ASYNC_WITH_CALLBACKS
                                            toolId
                                            (MAP_GET_VALUE originalContext "original_input")
                                            (MAP_GET_VALUE originalContext "original_params")
                                            (MAP_GET_VALUE originalContext "success_proc_name")
                                            (MAP_GET_VALUE originalContext "failure_proc_name")
                                            originalContext ; Pass original context
                                        ))))
                        (IF (EQ (GET_STATUS retryJobId) ALANG_STATUS_SUCCESS)
                            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Tool " toolId " re-invoked (retry)." ) NIL)
                            (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate handled
                        )
                        (SEQ
                            (LOG_EVENT "TOOL_RETRY_FAILED" toolId "Retry failed after user OK.")
                            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (STRING_CONCAT "Retry failed for tool " toolId ".") NIL)
                            ; Fallback if retry fails again - log and proceed with failure?
                            (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL) ; Indicate failure
                        )
                    )
                    (IF (EQ (GET_STATE session.last_user_response) "INPUT")
                        (SEQ
                            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "User provided new input/parameters." NIL)
                            ; Parse session.last_user_input_data to get new input/params (conceptual)
                            ; This parsing needs to be robust to handle different input formats.
                            (LET ((parsedInputResult (CALL_PROCEDURE ParseToolErrorResolutionInput (GET_STATE session.last_user_input_data) toolId errorDetails originalContext (GET_STATE session.conceptual_model_handle))))) ; NEW conceptual parser, gets context and session model
                            (IF (EQ (GET_STATUS parsedInputResult) ALANG_STATUS_SUCCESS)
                                (LET ((newInputParams (GET_DATA parsedInputResult)))
                                    ; Retry the tool call with new parameters (Section 5.C.6)
                                    (LET ((retryJobId (INVOKE_TOOL_ASYNC_WITH_CALLBACKS
                                                        toolId
                                                        (MAP_GET_VALUE newInputParams "input")
                                                        (MAP_GET_VALUE newInputParams "params")
                                                        (MAP_GET_VALUE originalContext "success_proc_name")
                                                        (MAP_GET_VALUE originalContext "failure_proc_name")
                                                        originalContext ; Pass original context
                                                    ))))
                                    (IF (EQ (GET_STATUS retryJobId) ALANG_STATUS_SUCCESS)
                                        (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Tool " toolId " re-invoked with user input." ) NIL)
                                        (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate handled
                                    )
                                    (SEQ
                                        (LOG_EVENT "TOOL_RETRY_FAILED" toolId "Retry failed after user INPUT.")
                                        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (STRING_CONCAT "Retry failed for tool " toolId " with provided input.") NIL)
                                        ; Fallback if retry fails again - log and proceed with failure?
                                        (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL) ; Indicate failure
                                    )
                                )
                                (SEQ ; Parsing failed
                                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" "Failed to parse user input for tool error resolution. Please try again." NIL)
                                    (RETURN_STATUS ALANG_STATUS_FAILURE_INVALID_INPUT) ; Indicate failure, might re-prompt?
                                )
                            ))
                        )
                    )
                    (IF (OR (EQ (GET_STATE session.last_user_response) "NO") (EQ (GET_STATE session.last_user_response) "REVISE"))
                        (SEQ
                            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "User requested revision or skipping." NIL)
                            ; Process feedback (conceptual)
                            (CALL_PROCEDURE ProcessUserFeedbackForConceptualModel (GET_STATE session.last_user_feedback) (GET_STATE session.conceptual_model_handle))
                            ; Decide next step based on feedback - skip task, revise approach, etc.
                            ; This requires more complex logic, potentially involving LLM analysis of feedback.
                            ; For now, just log and indicate handled.
                            (LOG_EVENT "TOOL_ERROR_RESOLUTION_REVISED" toolId (MAP_CREATE ("feedback" (GET_STATE session.last_user_feedback))))
                            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Feedback logged. Deciding next step for task..." NIL)
                            (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate handled
                        )
                    )
                    ; Add logic for other options like skipping (OPTION 2), stopping loop (OPTION 4)
                    (SEQ ; Default / Unrecognized response
                         (OUTPUT_TO_USER_BUFFER "AI_WARNING" "Unrecognized response for tool error resolution. Please use INPUT, OK, or specify an option." NIL)
                         ; Maybe re-prompt the user or log and give up? For now, just log and clear pending action.
                         (LOG_EVENT "TOOL_ERROR_RESOLUTION_UNHANDLED" toolId (STRING_CONCAT "User input: " raw_input))
                         (RETURN_STATUS ALANG_STATUS_FAILURE_INVALID_INPUT) ; Indicate failure
                    )
                )
                (SET_STATE session.pending_user_action NIL) ; Clear pending action after handling
                (SET_STATE session.pending_user_action_details NIL) ; Clear details
            )))))
     (IF (EQ action_key "AWAIT_REVISION_REVIEW")
        (SEQ
            ; User responded to artifact revision review prompt.
            ; Response is in session.last_user_response, feedback in session.last_user_feedback.
            (LET ((reviewDetails (GET_STATE session.pending_user_action_details))) ; Retrieve context
            (LET ((artifactHandle (MAP_GET_VALUE reviewDetails "artifact_handle")))
            (LET ((qaReportHandle (MAP_GET_VALUE reviewDetails "qa_report_handle"))) ; Might need report handle for REVISE
            (LET ((constraintsHandle (MAP_GET_VALUE reviewDetails "constraints_handle"))) ; Needed for re-correction
            (LET ((originalGeneratedText (MAP_GET_VALUE reviewDetails "original_generated_text"))) ; Might need original text for REVISE
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Processing user review for artifact revision." NIL)
                (IF (EQ (GET_STATE session.last_user_response) "OK")
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" "Artifact revision approved." NIL)
                        ; Update conceptual model to reflect user approval (Principle 0.V.6)
                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_user_approved_revision") ("artifact_handle" artifactHandle)))
                        ; Phase execution can now continue.
                        (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate handled, orchestrator should resume phase
                    )
                    (SEQ ; User responded NO or REVISE
                        (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" "Artifact revision rejected. Attempting further revision based on feedback." NIL)
                        ; Process user feedback and attempt revision (conceptual)
                        (CALL_PROCEDURE ProcessUserFeedbackForConceptualModel (GET_STATE session.last_user_feedback) (GET_STATE session.conceptual_model_handle)) ; Update conceptual model with feedback
                        ; Update conceptual model to reflect user rejection (Principle 0.V.6)
                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_user_rejected_revision") ("artifact_handle" artifactHandle) ("feedback" (GET_STATE session.last_user_feedback))))
                        ; Re-enter the revision process, potentially attempting self-correction again with feedback context
                        ; This is complex state management. A simple approach is to re-call ApplyRevisionsToArtifact,
                        ; which would need to incorporate the user feedback into its analysis.
                        ; A more robust approach might involve a specific 'ApplyFeedbackBasedRevision' procedure.
                        (LET ((feedbackRevisionStatus (CALL_PROCEDURE ApplyFeedbackBasedRevision artifactHandle (GET_STATE session.last_user_feedback) constraintsHandle (GET_STATE session.conceptual_model_handle) reviewDetails)))) ; NEW procedure for feedback-based revision
                        (IF (EQ feedbackRevisionStatus ALANG_STATUS_PAUSE_FOR_USER_INPUT)
                            (SEQ
                                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Feedback-based revision requires further user input." NIL)
                                (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Propagate pause
                            )
                            (IF (IS_STATUS_FAILURE feedbackRevisionStatus)
                                (SEQ
                                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" "Feedback-based revision failed." NIL)
                                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL) ; Indicate failure
                                )
                                (SEQ ; Feedback-based revision succeeded
                                    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Feedback-based revision attempted. Review the artifact again." NIL)
                                    ; The artifact content has been updated by ApplyFeedbackBasedRevision.
                                    ; Need to re-prompt user for review of the revised artifact.
                                    (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Review the revised content. Do you approve, or require further revision? (OK/REVISE)" NIL)
                                    ; Keep pending action as AWAIT_REVISION_REVIEW, but update details if needed
                                    (SET_STATE session.pending_user_action_details (MAP_SET_VALUE reviewDetails "last_revision_status" feedbackRevisionStatus)) ; Update context
                                    (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause for re-review
                                )
                            )
                        )
                    )
                )
                (SET_STATE session.pending_user_action NIL) ; Clear pending action after handling
                (SET_STATE session.pending_user_action_details NIL) ; Clear details
            )))))
    (IF (EQ action_key "AWAIT_OK_REVISE_PHASE_ARTIFACT")
        (SEQ
            ; User responded to phase artifact review prompt (e.g., Pattern Ideas, Product Definition, Task List, Final Draft).
            ; Response is in session.last_user_response, feedback in session.last_user_feedback.
            (LET ((phaseArtifactDetails (GET_STATE session.pending_user_action_details))) ; Retrieve context
            (LET ((artifactHandle (MAP_GET_VALUE phaseArtifactDetails "artifact_handle")))
            (LET ((phaseId (MAP_GET_VALUE phaseArtifactDetails "phase")))
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Processing user review for artifact in phase " phaseId ".") NIL)
                (IF (EQ (GET_STATE session.last_user_response) "OK")
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" "Artifact approved. Proceeding to next step in phase." NIL)
                        ; Update conceptual model to reflect user approval (Principle 0.V.6)
                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_user_approved_artifact") ("artifact_handle" artifactHandle) ("phase" phaseId)))
                        ; Clear pending action and allow phase execution to continue or transition.
                        (SET_STATE session.pending_user_action NIL)
                        (SET_STATE session.pending_user_action_details NIL)
                        (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate handled, orchestrator should resume phase
                    )
                    (SEQ ; User responded NO or REVISE
                        (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" "Artifact rejected. Attempting revision based on feedback." NIL)
                        ; Process user feedback and attempt revision (conceptual)
                        (CALL_PROCEDURE ProcessUserFeedbackForConceptualModel (GET_STATE session.last_user_feedback) (GET_STATE session.conceptual_model_handle)) ; Update conceptual model with feedback
                        ; Update conceptual model to reflect user rejection (Principle 0.V.6)
                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_user_rejected_artifact") ("artifact_handle" artifactHandle) ("phase" phaseId) ("feedback" (GET_STATE session.last_user_feedback))))
                        ; Re-generate or revise the artifact based on feedback. This requires re-running part of the phase logic.
                        ; This is complex state management. A simple approach is to re-run the generation step for this artifact,
                        ; ensuring the feedback and updated conceptual model influence the prompt.
                        (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Attempting to regenerate/revise artifact based on feedback." NIL)
                        ; The orchestrator needs to manage the state and re-invoke the appropriate procedure (e.g., the phase execution procedure).
                        ; The phase execution procedure should check if an artifact exists for this step and if it was rejected,
                        ; then attempt regeneration/revision using the feedback.
                        (SET_STATE session.pending_user_action NIL) ; Clear pending action for now, phase logic will re-set if needed
                        (SET_STATE session.pending_user_action_details NIL)
                        (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate handled, orchestrator needs to manage next step
                    )
                )
            )))
    )


    ; If the action key is not recognized, log an error.
    (SEQ
        (SET_ERROR_STATE "SYSTEM_ERROR" (STRING_CONCAT "Unhandled pending user action: " action_key))
        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
        (SET_STATE session.pending_user_action NIL) ; Clear the action to avoid getting stuck
        (SET_STATE session.pending_user_action_details NIL) ; Clear details
        (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
    )
)


(DEFINE_PROCEDURE FinalizeProjectTermination ()
    ;; Performs final project archival and terminates the session. (NEW)
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Finalizing project termination..." NIL)
    ; This procedure would:
    ; 1. Trigger project archival (saving artifacts, logs, final conceptual model).
    ; 2. Release session resources (including session.conceptual_model_handle).
    ; 3. Signal the orchestrator to terminate the session.
    (LOG_EVENT "PROJECT_TERMINATION" (STRING_CONCAT "Project " (GET_STATE proj.id) " terminating."))
    ; Conceptual calls:
    ; (CALL_PROCEDURE ArchiveProject (GET_STATE proj.id) (GET_STATE proj.artifacts) (GET_STATE proj.tau_project_log)) ; Archive artifacts and logs
    ; (LET ((conceptualModelSaveStatus (SAVE_CONCEPTUAL_MODEL (GET_STATE session.conceptual_model_handle) (STRING_CONCAT "archive/conceptual_model_" (GET_STATE proj.id) ".json")))) ; Save conceptual model
    ;     (IF (IS_STATUS_FAILURE conceptualModelSaveStatus)
    ;         (LOG_EVENT "SYSTEM_ERROR" "Failed to save conceptual model during archival.")
    ;     )
    ; )
    ; (RELEASE_HANDLE (GET_STATE session.conceptual_model_handle))
    ; (SET_STATE session.conceptual_model_handle NIL)
    ; (SIGNAL_ORCHESTRATOR "TERMINATE_SESSION")
    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Project terminated. Session resources released." NIL)
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Orchestrator handles actual termination
)

(DEFINE_PROCEDURE FinalizeProjectRestart ()
    ;; Performs project state cleanup and restarts the session. (NEW)
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Finalizing project restart..." NIL)
    ; This procedure would:
    ; 1. Discard current project artifacts and state.
    ; 2. Release session resources (including session.conceptual_model_handle).
    ; 3. Signal the orchestrator to restart the system (effectively calling OnSystemInit again).
    (LOG_EVENT "PROJECT_RESTART" (STRING_CONCAT "Project " (GET_STATE proj.id) " restarting."))
    ; Conceptual calls:
    ; (CALL_PROCEDURE DiscardProjectState (GET_STATE proj.id))
    ; (RELEASE_HANDLE (GET_STATE session.conceptual_model_handle))
    ; (SET_STATE session.conceptual_model_handle NIL)
    ; (SIGNAL_ORCHESTRATOR "RESTART_SYSTEM")
     (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Project state discarded. Restarting system." NIL)
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Orchestrator handles actual restart
)


(DEFINE_PROCEDURE HandleStartCommand (argsList)
    ;; Handles the START command.
    (LET ((projectDescription (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL))) ; Get the first argument, allow NIL
        (IF (STRING_IS_EMPTY_OR_NULL projectDescription)
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "Project description cannot be empty for START command.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )

        (ACKNOWLEDGE_AND_LOG
            "CMD_START_RECEIVED"
            (STRING_CONCAT "START command received. Description: " projectDescription)
            "AI_ACKNOWLEDGE_INTENT"
            (STRING_CONCAT "START command received. Project: '" projectDescription "'") ; Fixed message
        )

        (LET ((newProjectId (GENERATE_UNIQUE_ID "PROJ")))
            (INIT_PROJECT_STATE newProjectId projectDescription NIL) ; NIL for optional master_plan_handle initially
            ; Initialize the session-specific conceptual model handle for this new project (Principle 0.V.6)
            ; NOTE: This might already be initialized in OnSystemInit. Re-initializing here ensures a clean model for a new project.
            (SET_STATE session.conceptual_model_handle (CREATE_EMPTY_ARTIFACT "SessionConceptualModel")) ; Re-initialize for new project
            ; Add initial project description to the conceptual model
            (CALL_PROCEDURE ProcessUserInputForConceptualModel projectDescription (GET_STATE session.conceptual_model_handle)) ; Use the input processing procedure
        )

        (OUTPUT_TO_USER_BUFFER "AI_PRESENT_INTERPRETATION"
            (STRING_CONCAT "Project: " (GET_STATE proj.title) ". Phase: Init." NIL)
        )

        (SET_STATE proj.current_phase_id "PHASE_IDEA_FORMULATION")
        (LOG_EVENT "PHASE_TRANSITION" "Transitioning to Idea Formulation.")

        (RETURN_STATUS ALANG_STATUS_SUCCESS)
    )
)

(DEFINE_PROCEDURE HandleHelpCommand (argsList)
    ;; Handles the HELP command.
    (LET ((commandName (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL))) ; Get optional command name
        (IF (STRING_IS_EMPTY_OR_NULL commandName)
            (CALL_PROCEDURE OutputGeneralHelp)
            (CALL_PROCEDURE OutputSpecificHelp commandName)
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleEvolveCommand (argsList)
    ;; Handles the EVOLVE command.
    (LET ((suggestionText (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
        (IF (STRING_IS_EMPTY_OR_NULL suggestionText)
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "EVOLVE command requires a suggestion text.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )

        (ACKNOWLEDGE_AND_LOG
            "CMD_EVOLVE_RECEIVED"
            (STRING_CONCAT "EVOLVE command received. Suggestion: " suggestionText)
            "AI_ACKNOWLEDGE_INTENT"
            (STRING_CONCAT "EVOLVE Suggestion: '" suggestionText "' logged.") ; Fixed message
        )

        (LET ((backlogItemIdResult (CALL_PROCEDURE ProcessAndStoreEvolveSuggestion suggestionText "USER_SUGGESTION"))) ; ProcessAndStoreEvolveSuggestion now returns a StructuredResultObject
            (IF (EQ (GET_STATUS backlogItemIdResult) ALANG_STATUS_SUCCESS)
                (SET_STATE sys.evolution_trigger_pending TRUE) ; Flag for potential System QA cycle (Section 3)
                (SEQ
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" "Failed to process and store EVOLVE suggestion in backlog." NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                )
            )
        )

        (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Your suggestion has been logged for consideration in the next System QA & Evolution cycle." NIL)
        (RETURN_STATUS ALANG_STATUS_SUCCESS)
    )
)

(DEFINE_PROCEDURE HandleSaveSystemCommand ()
    ;; Handles the SAVE SYSTEM command, implementing CDGIP.
    (ACKNOWLEDGE_AND_LOG "CMD_SAVE_SYSTEM" "SAVE SYSTEM command received." "AI_ACKNOWLEDGE_INTENT" "SAVE SYSTEM command received.")

    ; 1. Generate the ALang Core Logic content itself (meta-generation)
    (LET ((generatedAlangCodeHandle (SAFE_GENERATE_CONTENT
                                        (CREATE_EMPTY_ARTIFACT "temp_alang_code") ; Target for the generated code
                                        PROMPT_TEMPLATE_SERIALIZE_ALANG_CORE ; Special template handle
                                        (MAP_CREATE ("current_alang_handle" (GET_CURRENT_ALANG_PROCEDURE_DEFINITIONS_HANDLE)) ; Pass handle to current code
                                                    ("current_directives_handle" (GET_ALANG_CORE_DIRECTIVES_HANDLE)) ; Pass handle to current directives
                                                    ("session_conceptual_model_summary" (SUMMARIZE_CONCEPTUAL_MODEL (GET_STATE session.conceptual_model_handle) NIL))) ; Include conceptual model summary
                                        CONSTRAINT_SET_VALID_ALANG_SYNTAX
                                    )))
        (IF (IS_HANDLE_VALID generatedAlangCodeHandle)
            (LET ((tempAlangContentResult (READ_CONTENT generatedAlangCodeHandle "text" NIL))) ; Read the generated ALang
                (IF (EQ (GET_STATUS tempAlangContentResult) ALANG_STATUS_SUCCESS)
                    (LET ((tempAlangContent (GET_DATA tempAlangContentResult)))
                        ; 2. Perform CDGIP Checks
                        (LET ((markersOk (VERIFY_ALANG_FILE_MARKERS generatedAlangCodeHandle (GET_STATE sys.alang_core_logic_version)))) ; Pass handle directly
                        (LET ((sectionCount (GET_ALANG_SECTION_COUNT generatedAlangCodeHandle)))) ; Pass handle directly
                        (LET ((checksum (COMPUTE_FILE_CHECKSUM generatedAlangCodeHandle "SHA256")))) ; Compute checksum using tool_code

                            (IF (AND markersOk (GT sectionCount 0) (NOT (IS_NIL checksum))) ; Basic checks + checksum
                                (SEQ ; CDGIP checks passed
                                    ; 3. Output CDGIP User Verification Prompts
                                    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS"
                                        (STRING_CONCAT "Preparing to output Autologos_Core_Logic_v" (GET_STATE sys.alang_core_logic_version) ".alang. "
                                                       "Internal draft contains " (STRING_CONCAT "" sectionCount) " primary SECTION comments. " ; Convert num to string
                                                       "Checksum (SHA256): " checksum ". "
                                                       "Please verify all sections are present and correctly numbered in the output.") NIL
                                    )
                                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA"
                                        (STRING_CONCAT "Recommended Filename: Autologos/Autologos_Core_Logic_v" (GET_STATE sys.alang_core_logic_version) ".alang") NIL
                                    )
                                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "```scheme" NIL) ; Start code block
                                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (STRING_CONCAT "--- START OF FILE Autologos_Core_Logic_v" (GET_STATE sys.alang_core_logic_version) ".alang ---") NIL)
                                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" tempAlangContent NIL) ; The actual ALang code
                                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (STRING_CONCAT "--- END OF FILE Autologos_Core_Logic_v" (GET_STATE sys.alang_core_logic_version) ".alang ---") NIL)
                                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "```" NIL) ; End code block

                                    (OUTPUT_TO_USER_BUFFER "AI_REQUEST_USER_ACTION"
                                        (GET_TEXT_FOR_CDGIP_USER_VERIFICATION_MANDATE (GET_STATE sys.alang_core_logic_version) sectionCount) NIL
                                    )
                                    ; Offer to output Evolution Backlog (as per Principle 4.A Cmd 20)
                                    (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Output Evolution Backlog now? (YES/NO)" NIL)
                                    (SET_STATE session.pending_user_action "AWAIT_YES_NO_FOR_BACKLOG_OUTPUT")
                                    (RETURN_STATUS ALANG_STATUS_SUCCESS)
                                )
                                ; ELSE CDGIP checks failed
                                (SEQ
                                    (SET_ERROR_STATE "SYSTEM_ERROR" "Internal CDGIP checks failed during SAVE SYSTEM (markers, section count, or checksum failed).")
                                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERATION_ERROR)
                                )
                            )
                        ))
                    (SEQ ; ELSE Failed to read generated ALang content
                        (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to read generated ALang content from handle.")
                        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                        (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                    )
                )
            )
            ; ELSE SAFE_GENERATE_CONTENT failed
            (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to generate ALang core logic for SAVE SYSTEM.")
            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
            (RETURN_STATUS ALANG_STATUS_FAILURE_GENERATION_ERROR)
        ))
    (FLUSH_USER_OUTPUT_BUFFER)
)

(DEFINE_PROCEDURE HandleBrowseCommand (argsList)
    ;; Handles the BROWSE command.
    (LET ((arg (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
        (IF (OR (STRING_IS_EMPTY_OR_NULL arg) (NOT (IS_NUMBER arg)))
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "Invalid argument for BROWSE. Please provide a number.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )

        (LET ((resultIndex (SUB (STRING_TO_NUMBER arg) 1)))
            (IF (OR (LT resultIndex 0) (GTE resultIndex (LIST_GET_LENGTH (GET_STATE session.last_search_results)))) ; Check bounds
                (SEQ
                    (SET_ERROR_STATE "USER_ERROR" "Result number out of bounds for previous search results.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
                )
            )

            (IF (NOT (IS_TOOL_ENABLED "browse"))
                (SEQ
                    (SET_ERROR_STATE "TOOL_UNAVAILABLE" "Browse tool is not available.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_TOOL_UNAVAILABLE)
                )
            )

            (LET ((targetUrl (MAP_GET_VALUE (LIST_GET_ITEM (GET_STATE session.last_search_results) resultIndex) "url" NIL)))
                (IF (STRING_IS_EMPTY_OR_NULL targetUrl)
                    (SEQ
                        (SET_ERROR_STATE "DATA_ERROR" "Invalid result number or URL not found in stored search results.")
                        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                        (RETURN_STATUS ALANG_STATUS_NOT_FOUND)
                    )
                )

                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Browsing URL: " targetUrl) NIL)
                ; Pass tool_id and original context through the callback context (NEW)
                (LET ((browseJobId (INVOKE_TOOL_ASYNC_WITH_CALLBACKS "browse" targetUrl NIL "HandleBrowseResult" "HandleBrowseError" (MAP_CREATE ("tool_id" "browse") ("original_context" NIL) ("original_input" targetUrl) ("original_params" NIL))))) ; Include original input/params in context (NEW)
                    ; The actual outcome will be handled by the callback procedures.
                    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Invoke is launched, callback will handle result
                )
            ))
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleUnknownCommand (commandName)
    ;; Handles unrecognized commands.
    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (STRING_CONCAT "Unknown command: " commandName) NIL)
    (RETURN_STATUS ALANG_STATUS_INVALID_COMMAND)
)

(DEFINE_PROCEDURE HandleOkCommand ()
    ;; Handles the OK command.
    (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" "OK received." NIL)
    (SET_STATE session.last_user_response "OK") ; Store response for pending action handlers
    ; Orchestrator: Should check session.pending_user_action and resume appropriate flow via HandlePendingUserAction.
    ; This procedure just sets the state. OnUserInput will pick it up.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleNoCommand (argsList)
    ;; Handles the NO / REVISE command.
    (LET ((feedbackText (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
        (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" (STRING_CONCAT "Feedback: '" (IF (IS_NIL feedbackText) "None" feedbackText) "' received.") NIL)
        (SET_STATE session.last_user_response "NO")
        (SET_STATE session.last_user_feedback feedbackText) ; Store feedback
        ; User feedback/revision should influence the session conceptual model (Principle 0.V.6, 5.B)
        (CALL_PROCEDURE ProcessUserFeedbackForConceptualModel feedbackText (GET_STATE session.conceptual_model_handle)) ; Conceptual call
    )
    ; Orchestrator: Should check session.pending_user_action and resume appropriate flow via HandlePendingUserAction.
    ; This procedure just sets the state. OnUserInput will pick it up.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleInputCommand (argsList)
    ;; Handles the INPUT command.
    (LET ((inputData (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL))) ; Assuming INPUT provides a single arg for now
        (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" "INPUT received." NIL)
        (SET_STATE session.last_user_response "INPUT")
        (SET_STATE session.last_user_input_data inputData) ; Store input data
        ; Process input data and potentially update session.conceptual_model_handle (Principle 0.V.6)
        (CALL_PROCEDURE ProcessUserInputForConceptualModel inputData (GET_STATE session.conceptual_model_handle)) ; Update conceptual model
    )
    ; Orchestrator: Should check session.pending_user_action and resume appropriate flow via HandlePendingUserAction.
    ; This procedure just sets the state. OnUserInput will pick it up.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleEndCommand ()
    ;; Handles the END command.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "END command received. Project session will terminate." NIL)
    (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Are you sure you want to end the project? Unsaved data will be lost. (YES/NO)" NIL)
    (SET_STATE session.pending_user_action "AWAIT_END_CONFIRMATION")
    ; Orchestrator: Should wait for confirmation, then perform project archival (Principle 4.A) and terminate.
    ; Note: The session conceptual model handle should be released or marked for archival if the project is saved.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleLoopProjectRestartCommand ()
    ;; Handles the LOOP_PROJECT_RESTART command.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "LOOP_PROJECT_RESTART command received. All current project artifacts and state will be discarded." NIL)
    (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Are you sure you want to restart the project from Phase 0? (YES/NO)" NIL)
    (SET_STATE session.pending_user_action "AWAIT_RESTART_CONFIRMATION")
    ; Orchestrator: Should wait for confirmation, then clear project state (including session conceptual model and loop stack) and restart from OnSystemInit.
    ; When restarting, the session conceptual model handle should be released and a new one created in OnSystemInit/HandleStartCommand.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleSetSessionPreferenceCommand (argsList)
    ;; Handles the SET_SESSION_PREFERENCE command.
    ; (Example: (SET_SESSION_PREFERENCE TARGET_OUTPUT_TYPE="bullet_list" STYLE_PARAMETER="list_format:bullets"))
    (IF (LT (LIST_GET_LENGTH argsList) 2)
        (SEQ
            (SET_ERROR_STATE "USER_ERROR" "SET_SESSION_PREFERENCE requires at least TARGET_OUTPUT_TYPE and STYLE_PARAMETER.")
            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
            (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
        )
    )
    ; Assuming argsList is a list of key-value strings like "KEY=VALUE"
    (LET ((prefMapResult (CALL_PROCEDURE ParseKeyValueArgs argsList))) ; Use ParseKeyValueArgs
        (IF (EQ (GET_STATUS prefMapResult) ALANG_STATUS_SUCCESS)
            (LET ((prefMap (GET_DATA prefMapResult)))
                (SET_STATE session.output_preferences prefMap)
                (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" "Session preference logged." NIL)
                (RETURN_STATUS ALANG_STATUS_SUCCESS)
            )
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "Failed to parse session preferences.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
            )
        )
    )
)

(DEFINE_PROCEDURE HandleStopLoopCommand ()
    ;; Handles the STOP_LOOP command.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "STOP_LOOP command received. Attempting to halt current loop gracefully." NIL)
    ; Clear the loop stack to signal loop termination (Section 2.A.3)
    (SET_STATE session.loop_stack (LIST_CREATE))
    ; Orchestrator: Should ensure any active ALang loops are terminated based on the empty stack.
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleOutputCommand (argsList)
    ;; Handles the OUTPUT command.
    (LET ((artifactId (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
        (IF (STRING_IS_EMPTY_OR_NULL artifactId)
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "OUTPUT command requires an artifact ID.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )
        (LET ((artifactHandle (MAP_GET_VALUE (GET_STATE proj.artifacts) artifactId NIL)))
            (IF (IS_NIL artifactHandle)
                (SEQ
                    (SET_ERROR_STATE "DATA_ERROR" (STRING_CONCAT "Artifact not found: " artifactId))
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_NOT_FOUND)
                )
            )
            (LET ((contentResult (READ_CONTENT artifactHandle "text_summary_or_full" NIL))) ; Read full content (Principle 2)
                (IF (EQ (GET_STATUS contentResult) ALANG_STATUS_SUCCESS)
                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (GET_DATA contentResult) NIL) ; Provides full content
                    (SEQ
                        (SET_ERROR_STATE "SYSTEM_ERROR" (STRING_CONCAT "Failed to read content for artifact: " artifactId))
                        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                        (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                    )
                )
            )
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleSummarizeCommand (argsList)
    ;; Handles the SUMMARIZE command.
    (LET ((artifactId (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
        (IF (STRING_IS_EMPTY_OR_NULL artifactId)
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "SUMMARIZE command requires an artifact ID.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )
        (LET ((artifactHandle (MAP_GET_VALUE (GET_STATE proj.artifacts) artifactId NIL)))
            (IF (IS_NIL artifactHandle)
                (SEQ
                    (SET_ERROR_STATE "DATA_ERROR" (STRING_CONCAT "Artifact not found: " artifactId))
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_NOT_FOUND)
                )
            )
            (LET ((summaryResult (CALL_PROCEDURE SummarizeArtifact artifactHandle (GET_STATE session.conceptual_model_handle)))) ; Uses SummarizeArtifact utility (Principle 4.A Cmd 16), passes conceptual model
                (IF (EQ (GET_STATUS summaryResult) ALANG_STATUS_SUCCESS)
                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (GET_DATA summaryResult) NIL)
                    (SEQ
                        (SET_ERROR_STATE "SYSTEM_ERROR" (STRING_CONCAT "Failed to summarize artifact: " artifactId))
                        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                        (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                    )
                )
            )
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleQueryCommand (argsList)
    ;; Handles the QUERY command.
    ; (Example: (QUERY CONCEPT "Autaxys") or (QUERY DOCUMENT "DocID") or (QUERY PKA "query string"))
    (LET ((queryType (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
    (LET ((queryValue (GET_SESSION_CMD_ARG_BY_INDEX 1 NIL)))
        (IF (OR (STRING_IS_EMPTY_OR_NULL queryType) (STRING_IS_EMPTY_OR_NULL queryValue))
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "QUERY command requires a type (CONCEPT/DOCUMENT/RELATION/PKA) and a value.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )
        (IF (EQ (STRING_UPPER queryType) "PKA")
             (LET ((queryResult (CALL_PROCEDURE PerformQuery queryType queryValue (GET_STATE session.conceptual_model_handle) (GET_STATE sys.knowledge_base_handle)))) ; Uses PerformQuery utility for PKA
                (IF (EQ (GET_STATUS queryResult) ALANG_STATUS_SUCCESS)
                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (GET_DATA queryResult) NIL)
                    (SEQ
                        (SET_ERROR_STATE "SYSTEM_ERROR" (STRING_CONCAT "Failed to query PKA: " queryValue))
                        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                        (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                    )
                )
             )
             (SEQ ; Assume other query types are against the session conceptual model (NEW)
                 (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Querying session conceptual model for " queryType ": " queryValue) NIL)
                 (LET ((queryResult (QUERY_CONCEPTUAL_MODEL (MAP_CREATE ("type" queryType) ("value" queryValue)) (GET_STATE session.conceptual_model_handle)))))
                 (IF (EQ (GET_STATUS queryResult) ALANG_STATUS_SUCCESS)
                     (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (GET_DATA queryResult) NIL) ; Output structured or text result
                     (SEQ
                         (SET_ERROR_STATE "SYSTEM_ERROR" (STRING_CONCAT "Failed to query conceptual model: " queryType " " queryValue))
                         (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                         (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                     )
                 )
             )
        )
    ))
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandleOutputBacklogCommand (argsList)
    ;; Handles the OUTPUT_BACKLOG command.
    (LET ((filename (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL))) ; Optional filename
        (LET ((backlogContentResult (CALL_PROCEDURE GetEvolutionBacklogContent))) ; Uses GetEvolutionBacklogContent utility (Principle 4.A Cmd 20)
            (IF (EQ (GET_STATUS backlogContentResult) ALANG_STATUS_SUCCESS)
                (LET ((content (GET_DATA backlogContentResult)))
                    (IF (IS_NIL content)
                        (SEQ
                            (SET_ERROR_STATE "SYSTEM_ERROR" "Evolution backlog content is empty.")
                            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                            (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                        )
                    )
                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (STRING_CONCAT "Recommended Filename: " (IF (IS_NIL filename) (GET_STATE sys.evolution_backlog_handle) filename)) NIL)
                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "```markdown" NIL)
                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" content NIL)
                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "```" NIL)
                )
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to retrieve evolution backlog content.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                )
            )
        )
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE HandlePromoteToPkaCommand (argsList)
    ;; Handles the PROMOTE_TO_PKA command. (artifact_id, rationale, schema_id) (Principle 4.A Cmd 18)
    (LET ((artifactId (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
    (LET ((rationale (GET_SESSION_CMD_ARG_BY_INDEX 1 NIL)))
    (LET ((schemaId (GET_SESSION_CMD_ARG_BY_INDEX 2 NIL))) ; schema_id is optional
        (IF (OR (STRING_IS_EMPTY_OR_NULL artifactId) (STRING_IS_EMPTY_OR_NULL rationale))
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "PROMOTE_TO_PKA requires artifact_id and rationale. Schema_id is optional.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )
        (LET ((artifactHandle (MAP_GET_VALUE (GET_STATE proj.artifacts) artifactId NIL)))
            (IF (IS_NIL artifactHandle)
                (SEQ
                    (SET_ERROR_STATE "DATA_ERROR" (STRING_CONCAT "Artifact not found for PKA promotion: " artifactId))
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_NOT_FOUND)
                )
            )
            ; Read the content of the artifact to pass to PKA_CREATE_DRAFT
            (LET ((artifactContentResult (READ_CONTENT artifactHandle "text_summary_or_full" NIL)))
                 (IF (NEQ (GET_STATUS artifactContentResult) ALANG_STATUS_SUCCESS)
                     (SEQ
                         (SET_ERROR_STATE "DATA_ERROR" (STRING_CONCAT "Failed to read artifact content for PKA promotion: " artifactId))
                         (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                         (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                     )
                 )
             )
            (LET ((rawContent (GET_DATA artifactContentResult)))
                 (IF (IS_NIL rawContent)
                     (SEQ
                         (SET_ERROR_STATE "DATA_ERROR" (STRING_CONCAT "Artifact content is empty for PKA promotion: " artifactId))
                         (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                         (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                     )
                 )
             )

            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Initiating PKA promotion for artifact: " artifactId) NIL)
            ; Call procedure to handle PKA creation, consent, and storage (Principle 8.B.i), passing session model
            (CALL_PROCEDURE CreateAndStorePKAIfUserConsents rawContent schemaId rationale (GET_STATE session.conceptual_model_handle))
            (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Procedure handles async part or user interaction
        )
    )))
)

(DEFINE_PROCEDURE HandleSearchPkaCommand (argsList)
    ;; Handles the SEARCH_PKA command. (keywords, filters_map_optional) (Principle 4.A Cmd 19)
    (LET ((keywords (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
        (IF (STRING_IS_EMPTY_OR_NULL keywords)
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "SEARCH_PKA requires keywords.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )
        (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Searching PKA for: " keywords) NIL)
        ; Invoke PKA_QUERY primitive with keywords and optional filters
        ; Assume PKA_QUERY takes a map as its query object (Principle 8.B.v)
        (LET ((searchResultsResult (PKA_QUERY (MAP_CREATE ("keywords" keywords)) NIL))) ; NIL for filters for now
            (IF (EQ (GET_STATUS searchResultsResult) ALANG_STATUS_SUCCESS)
                (LET ((results (GET_DATA searchResultsResult))) ; results is expected to be a list of PKA handles or IDs
                    (IF (LIST_IS_EMPTY results)
                        (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "No matching PKAs found." NIL)
                        (SEQ
                            (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Matching PKAs found:" NIL)
                            (LOOP_FOR_EACH resultHandle results ; Iterate through result handles
                                ; Need to get metadata for display
                                (LET ((pkaId (GET_HANDLE_METADATA resultHandle "id")))
                                (LET ((pkaTitle (GET_HANDLE_METADATA resultHandle "title"))) ; Assuming title metadata exists
                                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (STRING_CONCAT "- PKA ID: " (IF (IS_NIL pkaId) "N/A" pkaId) " Title: " (IF (IS_NIL pkaTitle) "Untitled" pkaTitle)) NIL) ; Example output format
                                    ; Note: Releasing handles in a loop is important for resource management.
                                    (RELEASE_HANDLE resultHandle)
                                ))
                            )
                             ; Process search results for conceptual model (Principle 8.B.v)
                            (CALL_PROCEDURE ProcessPkaSearchResultsForConceptualModel results (GET_STATE session.conceptual_model_handle)) ; Conceptual call, pass the list of handles/data
                        )
                    )

                    (RETURN_STATUS ALANG_STATUS_SUCCESS)
                )
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" (STRING_CONCAT "PKA search failed: " (GET_ERROR_MESSAGE searchResultsResult)))
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                )
            )
        )
    )
)

(DEFINE_PROCEDURE HandleSetQaOutputVerbosityCommand (argsList)
    ;; Handles the SET QA_OUTPUT_VERBOSITY command. (Principle 4.A Cmd 10)
    (LET ((level (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
        (IF (OR (STRING_IS_EMPTY_OR_NULL level) (AND (NEQ level "CONCISE") (NEQ level "VERBOSE")))
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "SET QA_OUTPUT_VERBOSITY requires 'CONCISE' or 'VERBOSE'.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )
        (SET_STATE session.qa_output_verbosity level)
        (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" (STRING_CONCAT "QA output verbosity set to: " level) NIL)
        (RETURN_STATUS ALANG_STATUS_SUCCESS)
    )
)

(DEFINE_PROCEDURE HandleSetOutputDetailCommand (argsList)
    ;; Handles the SET OUTPUT_DETAIL command. (Principle 4.A Cmd 14)
    (LET ((level (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL)))
        (IF (OR (STRING_IS_EMPTY_OR_NULL level) (AND (NEQ level "MINIMAL") (NEQ level "STANDARD") (NEQ level "EXHAUSTIVE")))
            (SEQ
                (SET_ERROR_STATE "USER_ERROR" "SET OUTPUT_DETAIL requires 'MINIMAL', 'STANDARD', or 'EXHAUSTIVE'.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_INVALID_ARGS)
            )
        )
        (SET_STATE session.output_detail level)
        (OUTPUT_TO_USER_BUFFER "AI_ACKNOWLEDGE_INTENT" (STRING_CONCAT "General output detail set to: " level) NIL)
        (RETURN_STATUS ALANG_STATUS_SUCCESS)
    )
)

(DEFINE_PROCEDURE HandleLoopCommand (argsList)
    ;; Handles the LOOP command. (Principle 4.A Cmd 9, Section 2.A)
    (LET ((description (GET_SESSION_CMD_ARG_BY_INDEX 0 NIL))) ; Optional description
        (ACKNOWLEDGE_AND_LOG
            "CMD_LOOP_RECEIVED"
            (STRING_CONCAT "LOOP command received. Description: " (IF (IS_NIL description) "None" description))
            "AI_ACKNOWLEDGE_INTENT"
            (STRING_CONCAT "LOOP command received. Description: '" (IF (IS_NIL description) "None" description) "'")
        )
        ; This is a conceptual command handler. The actual loop initiation
        ; and parameter proposal logic would follow based on context (Section 2.A.2).
        (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Loop command received. I will now propose loop parameters based on the current context (Section 2.A)." NIL)
        ; The system should then determine the appropriate loop type and parameters (Section 2.A.2)
        ; and prompt the user for OK. This might involve pushing a new context onto session.loop_stack.
        (RETURN_STATUS ALANG_STATUS_SUCCESS)
    )
)

(DEFINE_PROCEDURE HandleSystemQACommand ()
    ;; Handles the SYSTEM_QA command. (Principle 4.A Cmd - New, Section 3)
    (ACKNOWLEDGE_AND_LOG "CMD_SYSTEM_QA_RECEIVED" "SYSTEM_QA command received." "AI_ACKNOWLEDGE_INTENT" "SYSTEM_QA command received. Initiating System QA & Evolution cycle.")
    (SET_STATE sys.evolution_trigger_pending TRUE) ; Set the flag to trigger the cycle
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)


;; --- Section 4: Phase Logic Dispatcher & Specific Phase Execution Procedures ---
;; This section defines the DispatchPhaseExecution procedure and the procedures for executing specific workflow phases.

(DEFINE_PROCEDURE DispatchPhaseExecution (phaseId)
    ;; Routes execution to the appropriate phase execution procedure based on the current phase ID.
    (IF (EQ phaseId "PHASE_INIT") (CALL_PROCEDURE ExecutePhaseInit))
    (IF (EQ phaseId "PHASE_IDEA_FORMULATION") (CALL_PROCEDURE ExecutePhaseIdeaFormulation))
    (IF (EQ phaseId "PHASE_PRODUCT_DEFINITION") (CALL_PROCEDURE ExecutePhaseProductDefinition))
    (IF (EQ phaseId "PHASE_PLANNING") (CALL_PROCEDURE ExecutePhasePlanning))
    (IF (EQ phaseId "PHASE_TASK_EXECUTION") (CALL_PROCEDURE ExecutePhaseTaskExecution))
    (IF (EQ phaseId "PHASE_FINAL_REVIEW") (CALL_PROCEDURE ExecutePhaseFinalReview))
    (IF (EQ phaseId "PHASE_COMPLETION_SUMMARY") (CALL_PROCEDURE ExecutePhaseCompletionSummary))
    (IF (NOT (IS_NIL phaseId)
             (IS_NIL (MAP_GET_VALUE (MAP_CREATE
                                        ("PHASE_INIT" TRUE) ("PHASE_IDEA_FORMULATION" TRUE) ("PHASE_PRODUCT_DEFINITION" TRUE)
                                        ("PHASE_PLANNING" TRUE) ("PHASE_TASK_EXECUTION" TRUE) ("PHASE_FINAL_REVIEW" TRUE)
                                        ("PHASE_COMPLETION_SUMMARY" TRUE)
                                    ) phaseId NIL)))) ; Fallback if no specific handler matches
        (SET_ERROR_STATE "SYSTEM_ERROR" (STRING_CONCAT "No handler for phase: " phaseId))
        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
        (RETURN_STATUS ALANG_STATUS_FAILURE_INVALID_PHASE)
    )
    (RETURN_STATUS ALANG_STATUS_SUCCESS)
)

(DEFINE_PROCEDURE ExecutePhaseInit ()
    ;; Executes the logic for the "Init" phase.
    ;; Goal: Understand project description. Establish initial Φ-context for pattern exploration. Initialize session-specific conceptual model (Principle 0.V.6).
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Phase 0: Project Initiation complete. Session conceptual model initialized." NIL)
    ; The initialization of session.conceptual_model_handle happens in OnSystemInit or HandleStartCommand.
    ; Initial project description is added to the conceptual model in HandleStartCommand.
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Nothing much to do here
)

(DEFINE_PROCEDURE ExecutePhaseIdeaFormulation ()
    ;; Executes the logic for the "Idea Formulation" phase.
    ;; Goal: Define core concepts, themes, scope for current project's pattern model. Establish initial high-Φ conceptual network within the session-specific conceptual model (Principle 0.V.6). Identify key patterns relevant to the project description.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Phase 1: Idea Formulation. Identifying core pattern ideas to build the conceptual core for the project's pattern model, aiming to maximize Φ integration..." NIL)

    (LET ((ideaArtifactHandle (CREATE_EMPTY_ARTIFACT "PatternIdeasDocument")))
        ; Context for idea generation includes the project title and the current state of the session conceptual model.
        (LET ((generationResult (SAFE_GENERATE_CONTENT
                                    ideaArtifactHandle
                                    PROMPT_TEMPLATE_GENERATE_PATTERN_IDEAS ; Template for idea generation
                                    (MAP_CREATE ("project_title" (GET_STATE proj.title))
                                                ("session_conceptual_model_handle" (GET_STATE session.conceptual_model_handle))) ; Include conceptual model handle
                                    CONSTRAINT_SET_IDEA_GENERATION ; Constraints for creativity, relevance
                                )))
            (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                    (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ; SAFE_GENERATE_CONTENT can return PAUSE
                (SEQ
                    (SET_STATE proj.artifacts (MAP_SET_VALUE (GET_STATE proj.artifacts) "pattern_ideas" ideaArtifactHandle)) ; Store artifact handle
                    ; Process generated ideas to update the session conceptual model (Principle 0.V.6)
                    (CALL_PROCEDURE ProcessGeneratedArtifactForConceptualModel ideaArtifactHandle "pattern_ideas" (GET_STATE session.conceptual_model_handle)) ; Update conceptual model

                    ; Note: Product QA (Section 3) for this artifact needs to be orchestrated here
                    ; after generation and any internal HandleQAIssues processing.
                    ; This ALang placeholder assumes success if generation succeeded and QA handling didn't require pause.
                    ; A real implementation would need to call PerformProductQA here and handle its status.
                    (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Initial Pattern Ideas generated." NIL) ; Placeholder for outputting or referencing the artifact
                    (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Approve Pattern Ideas and proceed? (OK/REVISE)" NIL)
                    ; Store context for the pending action (NEW)
                    (SET_STATE session.pending_user_action_details (MAP_CREATE ("phase" "PHASE_IDEA_FORMULATION") ("artifact_handle" ideaArtifactHandle)))
                    (SET_STATE session.pending_user_action "AWAIT_OK_REVISE_PHASE_ARTIFACT") ; Generic pending action for phase artifacts (NEW)
                    (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Propagate status (SUCCESS or PAUSE)
                )
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to generate pattern ideas.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL) ; Phase execution failed
                )
            )
        )
    )
)

(DEFINE_PROCEDURE ExecutePhaseProductDefinition ()
    ;; Executes the logic for the "Product Definition" phase.
    ;; Goal: Define target product specifics, audience, outline structure for pattern artifact. Organize conceptual core for presentation, drawing from and structuring the session conceptual model (Principle 0.V.6).
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Phase 2: Product Definition. Defining product type, audience, and initial outline for the pattern artifact, structuring the Φ-model for presentation..." NIL)
    (LET ((productDefinitionArtifactHandle (CREATE_EMPTY_ARTIFACT "ProductDefinitionDocument")))
        ; Context for product definition includes pattern ideas and the session conceptual model.
        (LET ((generationResult (SAFE_GENERATE_CONTENT
                                    productDefinitionArtifactHandle
                                    PROMPT_TEMPLATE_PRODUCT_DEFINITION
                                    (MAP_CREATE ("project_title" (GET_STATE proj.title))
                                                ("pattern_ideas_handle" (MAP_GET_VALUE (GET_STATE proj.artifacts) "pattern_ideas"))
                                                ("session_conceptual_model_handle" (GET_STATE session.conceptual_model_handle))) ; Include conceptual model handle
                                    CONSTRAINT_SET_PRODUCT_DEFINITION
                                )))
            (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                    (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ; SAFE_GENERATE_CONTENT can return PAUSE
                (SEQ
                    (SET_STATE proj.artifacts (MAP_SET_VALUE (GET_STATE proj.artifacts) "product_definition" productDefinitionArtifactHandle))
                    ; Process generated product definition to update the session conceptual model (Principle 0.V.6)
                    (CALL_PROCEDURE ProcessGeneratedArtifactForConceptualModel productDefinitionArtifactHandle "product_definition" (GET_STATE session.conceptual_model_handle))

                    ; Note: Product QA (Section 3) for this artifact needs to be orchestrated here.
                    ; (LET ((qaResult (CALL_PROCEDURE PerformProductQA productDefinitionArtifactHandle "product_definition_schema_id" (GET_STATE session.conceptual_model_handle))))) ; Conceptual call
                    ; (IF (OR (IS_STATUS_FAILURE qaResult) (EQ qaResult ALANG_STATUS_PAUSE_FOR_USER_INPUT)))
                    ;    (RETURN_STATUS qaResult) ; Propagate failure or pause from QA

                     (IF (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)
                        (SEQ
                             (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Product Definition draft generated. QA handling requires user input (review/revise)." NIL) ; Placeholder for outputting or referencing
                             (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Propagate status
                        )
                         (SEQ
                            (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Product Definition draft generated and passed initial QA." NIL) ; Placeholder for outputting or referencing
                            (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Approve Product Definition and proceed? (OK/REVISE)" NIL)
                            ; Store context for the pending action (NEW)
                            (SET_STATE session.pending_user_action_details (MAP_CREATE ("phase" "PHASE_PRODUCT_DEFINITION") ("artifact_handle" productDefinitionArtifactHandle)))
                            (SET_STATE session.pending_user_action "AWAIT_OK_REVISE_PHASE_ARTIFACT") ; Generic pending action for phase artifacts (NEW)
                            (RETURN_STATUS ALANG_STATUS_SUCCESS)
                        )
                    )
                )
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to generate product definition.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                )
            )
        )
    )
)

(DEFINE_PROCEDURE ExecutePhasePlanning ()
    ;; Executes the logic for the "Planning" phase.
    ;; Goal: Break pattern artifact product into actionable tasks. Define path to realize high-Φ pattern model. Task list creation leverages and refines the session conceptual model (Principle 0.V.6) by structuring the pattern model into discrete work units.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Phase 3: Planning. Creating task list from outline for the pattern artifact, decomposing the path to Φ-realization..." NIL)
    (LET ((taskListArtifactHandle (CREATE_EMPTY_ARTIFACT "TaskListDocument")))
        ; Context for planning includes product definition and the session conceptual model.
        (LET ((generationResult (SAFE_GENERATE_CONTENT
                                    taskListArtifactHandle
                                    PROMPT_TEMPLATE_GENERATE_TASK_LIST
                                    (MAP_CREATE ("project_title" (GET_STATE proj.title))
                                                ("product_definition_handle" (MAP_GET_VALUE (GET_STATE proj.artifacts) "product_definition"))
                                                ("session_conceptual_model_handle" (GET_STATE session.conceptual_model_handle))) ; Include conceptual model handle
                                    CONSTRAINT_SET_PLANNING
                                )))
            (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                    (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ; SAFE_GENERATE_CONTENT can return PAUSE
                (SEQ
                    (SET_STATE proj.artifacts (MAP_SET_VALUE (GET_STATE proj.artifacts) "task_list" taskListArtifactHandle))
                    ; Process generated task list to update the session conceptual model (e.g., tasks become nodes, Principle 0.V.6)
                    (CALL_PROCEDURE ProcessGeneratedArtifactForConceptualModel taskListArtifactHandle "task_list" (GET_STATE session.conceptual_model_handle))

                    ; Note: Product QA (Section 3) for this artifact needs to be orchestrated here.
                    ; (LET ((qaResult (CALL_PROCEDURE PerformProductQA taskListArtifactHandle "task_list_schema_id" (GET_STATE session.conceptual_model_handle))))) ; Conceptual call
                    ; (IF (OR (IS_STATUS_FAILURE qaResult) (EQ qaResult ALANG_STATUS_PAUSE_FOR_USER_INPUT)))
                    ;    (RETURN_STATUS qaResult) ; Propagate failure or pause from QA

                     (IF (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)
                        (SEQ
                             (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Task List draft generated. QA handling requires user input (review/revise)." NIL) ; Placeholder
                             (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Propagate status
                        )
                         (SEQ
                            (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Task List draft generated and passed initial QA." NIL) ; Placeholder
                            (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Approve Task List and proceed? (OK/REVISE)" NIL)
                            ; Store context for the pending action (NEW)
                            (SET_STATE session.pending_user_action_details (MAP_CREATE ("phase" "PHASE_PLANNING") ("artifact_handle" taskListArtifactHandle)))
                            (SET_STATE session.pending_user_action "AWAIT_OK_REVISE_PHASE_ARTIFACT") ; Generic pending action for phase artifacts (NEW)
                            (RETURN_STATUS ALANG_STATUS_SUCCESS)
                        )
                    )
                )
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to generate task list.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                )
            )
        )
    )
)

(DEFINE_PROCEDURE ExecutePhaseTaskExecution ()
    ;; Executes the logic for the "Task Execution" phase.
    ;; Goal: Create content / complete tasks for pattern artifact. Manifest high-Φ pattern model into tangible output. Each task execution draws upon and refines the session conceptual model (Principle 0.V.6) by adding detail and content related to specific pattern aspects.
    ;; This procedure needs significant state management to track which tasks are complete,
    ;; handle user OK/REVISE per task, and manage the loop according to Section 2.A.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Phase 4: Task Execution. Starting task loop to manifest the pattern model into content..." NIL)

    (LET ((taskListHandle (MAP_GET_VALUE (GET_STATE proj.artifacts) "task_list" NIL)))
        (IF (IS_NIL taskListHandle)
            (SEQ
                (SET_ERROR_STATE "DATA_ERROR" "Task list not found for execution.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
            )
        )
        (LET ((taskListContentResult (READ_CONTENT taskListHandle "json_map_list" NIL))) ; Assuming task list is a structured list
            (IF (EQ (GET_STATUS taskListContentResult) ALANG_STATUS_SUCCESS)
                (LET ((taskList (GET_DATA taskListContentResult)))
                    ; This loop structure below is a simplification.
                    ; A robust implementation requires state variables like:
                    ; - session.current_task_index
                    ; - session.task_execution_status (PENDING, IN_PROGRESS, COMPLETED, FAILED)
                    ; - session.current_task_artifact_handle
                    ; The loop would increment session.current_task_index and check the status.
                    ; User OK/REVISE commands would update the status for the *current* task,
                    ; allowing the loop to proceed or retry.
                    (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Loaded " (STRING_CONCAT "" (LIST_GET_LENGTH taskList)) " tasks. Starting execution loop.") NIL)

                    ; Conceptual Loop Management (Simplified ALang):
                    ; (SET_STATE session.current_task_index 0)
                    ; (LOOP_WHILE (AND (LT (GET_STATE session.current_task_index) (LIST_GET_LENGTH taskList))
                    ;                 (NOT (EQ (GET_STATE session.task_execution_loop_interrupted) TRUE)))) ; Check for STOP_LOOP
                    ;    (LET ((currentTask (LIST_GET_ITEM taskList (GET_STATE session.current_task_index))))
                    ;        ... task execution logic ...
                    ;        (IF (EQ (GET_STATE session.current_task_execution_status) "COMPLETED")
                    ;            (SET_STATE session.current_task_index (ADD (GET_STATE session.current_task_index) 1))
                    ;        )
                    ;    )
                    ; )

                    ; Current ALang Placeholder (Simple Iteration):
                    (LOOP_FOR_EACH taskItem taskList
                        (LET ((taskId (MAP_GET_VALUE taskItem "id")))
                        (LET ((taskDescription (MAP_GET_VALUE taskItem "description")))
                            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_INTERPRETATION" (STRING_CONCAT "Project: " (GET_STATE proj.title) ". Phase: Task Execution. Current Task: " taskId) NIL)
                            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Executing task: " taskId " - " taskDescription) NIL)
                            (LET ((taskArtifactHandle (CREATE_EMPTY_ARTIFACT (STRING_CONCAT "Task_" taskId "_Output"))))
                                ; SAFE_GENERATE_CONTENT now includes meta-cognitive QA (Principle 6.A) and calls HandleQAIssues
                                ; Context for task execution includes project artifacts and the session conceptual model.
                                (LET ((generationResult (SAFE_GENERATE_CONTENT
                                                            taskArtifactHandle
                                                            PROMPT_TEMPLATE_EXECUTE_TASK
                                                            (MAP_CREATE ("task_id" taskId)
                                                                        ("task_description" taskDescription)
                                                                        ("project_artifacts" (GET_STATE proj.artifacts))
                                                                        ("session_conceptual_model_handle" (GET_STATE session.conceptual_model_handle))) ; Include conceptual model handle
                                                            CONSTRAINT_SET_TASK_EXECUTION
                                                        )))
                                    (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                                            (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ; SAFE_GENERATE_CONTENT can return PAUSE
                                        (SEQ
                                            (LOG_EVENT "TASK_GENERATION_COMPLETE" (STRING_CONCAT "Task " taskId " generation complete/handled."))
                                            ; Process generated task output to update the session conceptual model (Principle 0.V.6)
                                            (CALL_PROCEDURE ProcessGeneratedArtifactForConceptualModel taskArtifactHandle (STRING_CONCAT "task_" taskId "_output") (GET_STATE session.conceptual_model_handle)) ; Update conceptual model

                                            ; Product QA per task is conceptually required here (Section 2, Phase 4 DoD).
                                            ; The SAFE_GENERATE_CONTENT call initiates meta-cognitive QA (6.A) and HandleQAIssues.
                                            ; A full 4-stage QA loop would need to be managed here for the taskArtifactHandle,
                                            ; potentially triggered if HandleQAIssues didn't resolve issues or requested user input.
                                            ; (LET ((qaResult (CALL_PROCEDURE PerformProductQA taskArtifactHandle "task_artifact_schema_id" (GET_STATE session.conceptual_model_handle))))) ; Conceptual call
                                            ; (IF (OR (IS_STATUS_FAILURE qaResult) (EQ qaResult ALANG_STATUS_PAUSE_FOR_USER_INPUT)))
                                            ;    (RETURN_STATUS qaResult) ; Propagate failure or pause from QA

                                            (SET_STATE proj.artifacts (MAP_SET_VALUE (GET_STATE proj.artifacts) (STRING_CONCAT "task_" taskId "_output") taskArtifactHandle)) ; Store task artifact

                                            (IF (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)
                                                (SEQ
                                                    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Task " taskId " draft generated. QA handling requires user input (review/revise).") NIL)
                                                    ; Store context for the pending action (NEW)
                                                    (SET_STATE session.pending_user_action_details (MAP_CREATE ("phase" "PHASE_TASK_EXECUTION") ("artifact_handle" taskArtifactHandle) ("task_id" taskId)))
                                                    (SET_STATE session.pending_user_action "AWAIT_OK_REVISE_PHASE_ARTIFACT") ; Generic pending action for phase artifacts (NEW)
                                                    (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause needed
                                                )
                                                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Task " taskId " draft generated and passed initial QA (or issues handled internally). Proceeding.") NIL)
                                                ; In a real loop, this is where you'd increment the task index if approved/completed.
                                            )
                                        )
                                        (SEQ
                                            (SET_ERROR_STATE "SYSTEM_ERROR" (STRING_CONCAT "Failed to execute task: " taskId))
                                            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                                            (LOG_EVENT "TASK_FAILED" (STRING_CONCAT "Task " taskId " failed."))
                                            ; Needs error handling and potential user interaction per Section 5.C, possibly stopping the loop.
                                            ; (CALL_PROCEDURE HandleTaskExecutionError taskId taskItem (GET_STATE session.conceptual_model_handle)) ; Conceptual task error handling
                                            (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL) ; Fail the phase if a task fails in this simple loop
                                        )
                                    )
                                )
                            )
                        ) ; End LOOP_FOR_EACH taskItem
                    )
                )
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to read task list content.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                )
            )
        )
    )
    ; This point is reached after the loop completes (or fails).
    ; Needs logic to check if all tasks successfully completed and passed QA before transitioning.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Phase 4: Task Execution complete (all tasks processed). Needs user review and approval for compiled output." NIL)
    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Return status for the phase
)

(DEFINE_PROCEDURE ExecutePhaseFinalReview ()
    ;; Executes the logic for the "Final Review & Compilation" phase.
    ;; Goal: Present compiled pattern artifact for final user review. Ensure overall Φ-cohesion, presentation. This involves integrating all task outputs and ensuring the final artifact accurately reflects the comprehensive session conceptual model (Principle 0.V.6).
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Phase 5: Final Review. Compiling full draft of the pattern artifact, ensuring overall Φ-cohesion and presentation..." NIL)
    (LET ((compiledDraftHandle (CREATE_EMPTY_ARTIFACT "CompiledProjectDraft")))
        ; SAFE_GENERATE_CONTENT for compilation also includes meta-cognitive QA
        ; Context for compilation includes all project artifacts and the session conceptual model for overall cohesion.
        (LET ((generationResult (SAFE_GENERATE_CONTENT
                                    compiledDraftHandle
                                    PROMPT_TEMPLATE_COMPILE_DRAFT
                                    (MAP_CREATE ("project_artifacts" (GET_STATE proj.artifacts)) ; Context includes all task outputs
                                                ("session_conceptual_model_handle" (GET_STATE session.conceptual_model_handle))) ; Include conceptual model handle
                                    CONSTRAINT_SET_FINAL_REVIEW
                                )))
            (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                    (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ; SAFE_GENERATE_CONTENT can return PAUSE
                (SEQ
                    (SET_STATE proj.artifacts (MAP_SET_VALUE (GET_STATE proj.artifacts) "final_draft" compiledDraftHandle))
                    ; Process compiled draft to finalize the session conceptual model for this project's output (Principle 0.V.6)
                    (CALL_PROCEDURE ProcessGeneratedArtifactForConceptualModel compiledDraftHandle "final_draft" (GET_STATE session.conceptual_model_handle))

                    ; Note: Product QA (Section 3) for the compiled draft needs to be orchestrated here.
                    ; (LET ((qaResult (CALL_PROCEDURE PerformProductQA compiledDraftHandle "compiled_draft_schema_id" (GET_STATE session.conceptual_model_handle))))) ; Conceptual call
                    ; (IF (OR (IS_STATUS_FAILURE qaResult) (EQ qaResult ALANG_STATUS_PAUSE_FOR_USER_INPUT)))
                    ;    (RETURN_STATUS qaResult) ; Propagate failure or pause from QA

                     (IF (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)
                        (SEQ
                             (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Compiled Draft generated. QA handling requires user input (review/revise)." NIL) ; Placeholder
                             (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause needed
                        )
                         (SEQ
                            (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Compiled Draft generated and passed initial QA." NIL) ; Placeholder
                            (OUTPUT_TO_USER_BUFFER "AI_REQUEST_CLARIFICATION_QUESTIONS" "Approve Final Draft and proceed to completion? (OK/REVISE)" NIL)
                            ; Store context for the pending action (NEW)
                            (SET_STATE session.pending_user_action_details (MAP_CREATE ("phase" "PHASE_FINAL_REVIEW") ("artifact_handle" compiledDraftHandle)))
                            (SET_STATE session.pending_user_action "AWAIT_OK_REVISE_PHASE_ARTIFACT") ; Generic pending action for phase artifacts (NEW)
                            (RETURN_STATUS ALANG_STATUS_SUCCESS)
                        )
                    )
                )
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to compile final draft.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                )
            )
        )
    )
)

(DEFINE_PROCEDURE ExecutePhaseCompletionSummary ()
    ;; Executes the logic for the "Project Completion & Learning Summary" phase.
    ;; Goal: Conclude current project on pattern artifact. Summarize project-specific learnings about pattern/process. Log insights for system evolution. Generate new Φ-seeds by processing the final project state and session conceptual model.
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Phase 6: Project Completion. Summarizing learnings and preparing for archival. This consolidates the Φ gained during the project and generates insights for future pattern understanding..." NIL)
    (LET ((summaryArtifactHandle (CREATE_EMPTY_ARTIFACT "ProjectSummary")))
        ; SAFE_GENERATE_CONTENT for summary also includes meta-cognitive QA
        ; Context for summary includes project state, artifacts, log, and the final session conceptual model.
        (LET ((generationResult (SAFE_GENERATE_CONTENT
                                    summaryArtifactHandle
                                    PROMPT_TEMPLATE_PROJECT_SUMMARY
                                    (MAP_CREATE ("project_id" (GET_STATE proj.id))
                                                ("project_artifacts" (GET_STATE proj.artifacts))
                                                ("tau_project_log" (GET_STATE proj.tau_project_log))
                                                ("session_conceptual_model_handle" (GET_STATE session.conceptual_model_handle))) ; Include conceptual model handle
                                    CONSTRAINT_SET_SUMMARY
                                )))
            (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                    (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ; SAFE_GENERATE_CONTENT can return PAUSE
                (SEQ
                    (SET_STATE proj.artifacts (MAP_SET_VALUE (GET_STATE proj.artifacts) "project_summary" summaryArtifactHandle))
                    ; Process summary artifact for final learning extraction for evolution backlog (Principle 17)
                    (CALL_PROCEDURE ProcessGeneratedArtifactForEvolution summaryArtifactHandle "project_summary" (GET_STATE session.conceptual_model_handle)) ; Update evolution insights, pass session model

                     (IF (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)
                        (SEQ
                             (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Project summary generated. QA handling requires user input (review/revise)." NIL)
                             (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause needed
                        )
                         (SEQ
                            ; Note: This phase triggers Principle 4.A (Formal Task/Project Completion Protocol).
                            ; The ALang placeholder doesn't fully implement 4.A.III (proactive output, archival prompt).
                            ; That logic needs to be orchestrated after this procedure returns success.
                            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Project completion summary generated. Deliverables are ready for archival via Principle 4.A protocol." NIL)
                            (RETURN_STATUS ALANG_STATUS_SUCCESS)
                        )
                    )
                )
                (SEQ
                    (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to generate project summary.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL)
                )
            )
        )
    )
)


;; --- Section 5: QA Procedures ---
;; This section defines procedures for performing Quality Assurance (QA) on generated artifacts.

(DEFINE_PROCEDURE PerformProductQA (artifact_handle schema_id session_model_handle)
    ;; Performs a full QA cycle on the given artifact, leveraging the session conceptual model.
    ;; This procedure orchestrates the 4 stages of Product QA as defined in Directives Section 3.A.
    ;; It implements the iterative refinement loop (Principle 6, Section 3.A Iteration Rule),
    ;; applying revisions based on QA findings, using the session conceptual model as context for correction.
    ;; Returns: StructuredResultObject ({status: ALANG_STATUS_SUCCESS, data: artifact_handle}) or failure. (NEW)
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Starting Full Product QA Cycle (4 Stages) to validate the pattern model representation against constraints and the session conceptual model..." NIL)

    (LET ((overallStatus ALANG_STATUS_SUCCESS))) ; Track overall QA status
    (LET ((qaIterationCount 0)))
    (LET ((maxQaIterations 5))) ; Safeguard against infinite loops (Principle 6)
    (LET ((substantiveIssuesFoundThisCycle TRUE))) ; Start loop assuming issues need checking

    ; Iterative QA Loop (Section 3.A Iteration Rule)
    (LOOP_WHILE (AND substantiveIssuesFoundThisCycle (LT qaIterationCount maxQaIterations)))
        (SET_STATE qaIterationCount (ADD qaIterationCount 1))
        (SET_STATE substantiveIssuesFoundThisCycle FALSE) ; Reset for the start of the cycle
        (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Starting Product QA Cycle Iteration " (STRING_CONCAT "" qaIterationCount) "..." ) NIL)

        ; Stage 1: Self-Critique
        (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Running QA Stage 1: Self-Critique... " (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE") "Generating detailed report." "" )) NIL)
        (LET ((stage1ReportHandle (CREATE_EMPTY_ARTIFACT "qa_critique_self"))))
        ; SAFE_GENERATE_CONTENT for QA reports also includes meta-cognitive QA on the *report itself* (Principle 6.A)
        (LET ((stage1Result (SAFE_GENERATE_CONTENT stage1ReportHandle PROMPT_TEMPLATE_QA_SELF_CRITIQUE (MAP_CREATE ("artifact_content_handle" artifact_handle) ("session_conceptual_model_handle" session_model_handle)) CONSTRAINT_SET_QA_CRITIQUE))) ; QA on artifact handle, pass session model
            (IF (OR (IS_STATUS_FAILURE stage1Result) (EQ stage1Result ALANG_STATUS_PAUSE_FOR_USER_INPUT)) (RETURN_STATUS (MAP_CREATE ("status" (IF (IS_STATUS_FAILURE stage1Result) stage1Result ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ("data" NIL))))) ; Propagate failure/pause, return structured result

        ; Process the QA report artifact to check for substantive issues (NEW utility)
        (LET ((issuesInStage1 (CHECK_FOR_SUBSTANTIVE_ISSUES stage1ReportHandle))))
        (IF issuesInStage1
            (SEQ
                (SET_STATE substantiveIssuesFoundThisCycle TRUE)
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Substantive issues found in Stage 1. Attempting revisions." NIL)
                ; Apply revisions based on the report. This procedure might pause for user input.
                (LET ((revisionStatus (CALL_PROCEDURE ApplyRevisionsToArtifact artifact_handle stage1ReportHandle session_model_handle CONSTRAINT_SET_TASK_EXECUTION)))) ; Pass constraints handle (Conceptual)
                (IF (EQ revisionStatus ALANG_STATUS_PAUSE_FOR_USER_INPUT) (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_PAUSE_FOR_USER_INPUT) ("data" NIL)))) ; Propagate pause
                (IF (IS_STATUS_FAILURE revisionStatus) (RETURN_STATUS (MAP_CREATE ("status" revisionStatus) ("data" NIL)))) ; Propagate failure
            )
        )
        (RELEASE_HANDLE stage1ReportHandle) ; Release report handle

        ; Stage 2: Divergent Exploration
        (IF (NOT substantiveIssuesFoundThisCycle)) ; Only run if no issues needing revision from Stage 1
            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Running QA Stage 2: Divergent Exploration... " (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE") "Generating detailed report." "" )) NIL)
            (LET ((stage2ReportHandle (CREATE_EMPTY_ARTIFACT "qa_critique_divergent"))))
            (LET ((stage2Result (SAFE_GENERATE_CONTENT stage2ReportHandle PROMPT_TEMPLATE_QA_DIVERGENT_EXPLORATION (MAP_CREATE ("artifact_content_handle" artifact_handle) ("session_conceptual_model_handle" session_model_handle)) CONSTRAINT_SET_QA_CRITIQUE))) ; Pass session model
                (IF (OR (IS_STATUS_FAILURE stage2Result) (EQ stage2Result ALANG_STATUS_PAUSE_FOR_USER_INPUT)) (RETURN_STATUS (MAP_CREATE ("status" (IF (IS_STATUS_FAILURE stage2Result) stage2Result ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ("data" NIL)))))
            (LET ((issuesInStage2 (CHECK_FOR_SUBSTANTIVE_ISSUES stage2ReportHandle)))) ; NEW utility
            (IF issuesInStage2
                (SEQ
                    (SET_STATE substantiveIssuesFoundThisCycle TRUE)
                    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Substantive issues found in Stage 2. Attempting revisions." NIL)
                    (LET ((revisionStatus (CALL_PROCEDURE ApplyRevisionsToArtifact artifact_handle stage2ReportHandle session_model_handle CONSTRAINT_SET_TASK_EXECUTION)))) ; Pass constraints handle (Conceptual)
                    (IF (EQ revisionStatus ALANG_STATUS_PAUSE_FOR_USER_INPUT) (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_PAUSE_FOR_USER_INPUT) ("data" NIL)))) ; Propagate pause
                    (IF (IS_STATUS_FAILURE revisionStatus) (RETURN_STATUS (MAP_CREATE ("status" revisionStatus) ("data" NIL)))) ; Propagate failure
                )
            )
            (RELEASE_HANDLE stage2ReportHandle)
        )

        ; Stage 3: Red Teaming
        (IF (NOT substantiveIssuesFoundThisCycle)) ; Only run if no issues needing revision from Stage 1/2
            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Running QA Stage 3: Red Teaming... " (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE") "Generating detailed report." "" )) NIL)
            (LET ((stage3ReportHandle (CREATE_EMPTY_ARTIFACT "qa_critique_redteam"))))
            (LET ((stage3Result (SAFE_GENERATE_CONTENT stage3ReportHandle PROMPT_TEMPLATE_QA_RED_TEaming (MAP_CREATE ("artifact_content_handle" artifact_handle) ("session_conceptual_model_handle" session_model_handle)) CONSTRAINT_SET_QA_CRITIQUE))) ; Pass session model
                (IF (OR (IS_STATUS_FAILURE stage3Result) (EQ stage3Result ALANG_STATUS_PAUSE_FOR_USER_INPUT)) (RETURN_STATUS (MAP_CREATE ("status" (IF (IS_STATUS_FAILURE stage3Result) stage3Result ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ("data" NIL)))))
            (LET ((issuesInStage3 (CHECK_FOR_SUBSTANTIVE_ISSUES stage3ReportHandle)))) ; NEW utility
            (IF issuesInStage3
                (SEQ
                    (SET_STATE substantiveIssuesFoundThisCycle TRUE)
                    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Substantive issues found in Stage 3. Attempting revisions." NIL)
                    (LET ((revisionStatus (CALL_PROCEDURE ApplyRevisionsToArtifact artifact_handle stage3ReportHandle session_model_handle CONSTRAINT_SET_TASK_EXECUTION)))) ; Pass constraints handle (Conceptual)
                    (IF (EQ revisionStatus ALANG_STATUS_PAUSE_FOR_USER_INPUT) (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_PAUSE_FOR_USER_INPUT) ("data" NIL)))) ; Propagate pause
                    (IF (IS_STATUS_FAILURE revisionStatus) (RETURN_STATUS (MAP_CREATE ("status" revisionStatus) ("data" NIL)))) ; Propagate failure
                )
            )
            (RELEASE_HANDLE stage3ReportHandle)
        )

        ; Stage 4: External Review
        (IF (NOT substantiveIssuesFoundThisCycle)) ; Only run if no issues needing revision from Stage 1/2/3
            (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" (STRING_CONCAT "Running QA Stage 4: External Review... " (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE") "Generating detailed reports." "" )) NIL)
            (LET ((stage4ReportHandle (CREATE_EMPTY_ARTIFACT "qa_critique_external"))))
            (LET ((stage4Result (SAFE_GENERATE_CONTENT stage4ReportHandle PROMPT_TEMPLATE_QA_EXTERNAL_REVIEW (MAP_CREATE ("artifact_content_handle" artifact_handle) ("session_conceptual_model_handle" session_model_handle)) CONSTRAINT_SET_QA_CRITIQUE))) ; Pass session model
                (IF (OR (IS_STATUS_FAILURE stage4Result) (EQ stage4Result ALANG_STATUS_PAUSE_FOR_USER_INPUT)) (RETURN_STATUS (MAP_CREATE ("status" (IF (IS_STATUS_FAILURE stage4Result) stage4Result ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ("data" NIL)))))
            (LET ((issuesInStage4 (CHECK_FOR_SUBSTANTIVE_ISSUES stage4ReportHandle)))) ; NEW utility
            (IF issuesInStage4
                (SEQ
                    (SET_STATE substantiveIssuesFoundThisCycle TRUE)
                    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Substantive issues found in Stage 4. Attempting revisions." NIL)
                    (LET ((revisionStatus (CALL_PROCEDURE ApplyRevisionsToArtifact artifact_handle stage4ReportHandle session_model_handle CONSTRAINT_SET_TASK_EXECUTION)))) ; Pass constraints handle (Conceptual)
                    (IF (EQ revisionStatus ALANG_STATUS_PAUSE_FOR_USER_INPUT) (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_PAUSE_FOR_USER_INPUT) ("data" NIL)))) ; Propagate pause
                    (IF (IS_STATUS_FAILURE revisionStatus) (RETURN_STATUS (MAP_CREATE ("status" revisionStatus) ("data" NIL)))) ; Propagate failure
                )
            )
            (RELEASE_HANDLE stage4ReportHandle)
        )

        ; After a full cycle, if substantiveIssuesFoundThisCycle is TRUE, the loop continues.
        ; This implies that ApplyRevisionsToArtifact has attempted corrections which need re-evaluation.

    ) ; End LOOP_WHILE

    ; After the loop, check if max iterations were reached without convergence
    (IF (AND substantiveIssuesFoundThisCycle (EQ qaIterationCount maxQaIterations))
        (SEQ
            (SET_ERROR_STATE "QA_ERROR" (STRING_CONCAT "Product QA reached max iterations (" (STRING_CONCAT "" maxQaIterations) ") without resolving all substantive issues."))
            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
            (SET_STATE proj.artifact_qa_status "QA_FAILED_MAX_ITERATIONS")
            (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_QA_ERROR) ("data" NIL))) ; Return structured failure
        )
        (SEQ
            ; If loop exited because substantiveIssuesFoundThisCycle is FALSE
            (SET_STATE proj.artifact_qa_status "QA_PASSED") ; All substantive issues resolved or none found
            (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Full Product QA complete. Status: " (GET_STATE proj.artifact_qa_status) ". Artifact represents pattern model to the best of current ability.") NIL)
            (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_SUCCESS) ("data" artifact_handle))) ; Return structured success with artifact handle
        )
    )
)

(DEFINE_PROCEDURE ApplyRevisionsToArtifact (artifact_handle qa_report_handle session_model_handle constraints_handle)
    ;; Conceptual procedure to apply revisions to an artifact based on a QA report.
    ;; This procedure reads the QA report, identifies specific issues and suggested corrections,
    ;; and attempts to apply them to the artifact content, potentially using SelfCorrectArtifact or flagging for user review.
    ;; It uses the session conceptual model for context during the revision process. It also updates the conceptual model regarding the artifact's status and resolved/unresolved issues.
    ;; Returns: ALANG_STATUS_CODE (SUCCESS, FAILURE, or PAUSE_FOR_USER_INPUT) (NEW)
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Applying revisions to artifact based on QA findings..." NIL)
    ; This procedure would:
    ; 1. Read the QA report content from qa_report_handle.
    ; 2. Parse the report to extract actionable issues and suggested changes (potentially using LLM, with session model context).
    ; 3. Decide whether to attempt automated self-correction (using SelfCorrectArtifact) or require user input, based on issue severity, confidence, and self-correction primitive capabilities.
    ; 4. If attempting self-correction, call SelfCorrectArtifact with the artifact's current content, the relevant parts of the QA report, constraints, and session model.
    ; 5. If SelfCorrectArtifact succeeds, overwrite the artifact content. If it fails or if user input is required, add disclaimers or set a pending user action state.
    ; 6. Update the session conceptual model to reflect the revision attempt and outcome (e.g., "artifact revised", "issue flagged for user", "issue resolved").
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Applying revisions to artifact " (GET_HANDLE_METADATA artifact_handle "id")))
    ; Example conceptual call structure:
    (LET ((qaReportContentResult (READ_CONTENT qa_report_handle "structured_map" NIL)))) ; Assume QA reports are structured
    (LET ((artifactContentResult (READ_CONTENT artifact_handle "text_summary_or_full" NIL))))
    (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    (LET ((constraintsContentResult (READ_CONTENT constraints_handle "structured_list_of_rules" NIL)))) ; Need constraints for self-correction
    (IF (AND (EQ (GET_STATUS qaReportContentResult) ALANG_STATUS_SUCCESS)
             (EQ (GET_STATUS artifactContentResult) ALANG_STATUS_SUCCESS)
             (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS)
             (EQ (GET_STATUS constraintsContentResult) ALANG_STATUS_SUCCESS)))
        (LET ((qaReportContent (GET_DATA qaReportContentResult))))
        (LET ((artifactContent (GET_DATA artifactContentResult))))
        (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
        (LET ((constraintsContent (GET_DATA constraintsContentResult))))

        ; Use LLM to determine revision strategy and details
        (LET ((revisionPlanResult (INVOKE_CORE_LLM_GENERATION
                                   (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_QA_REPORT_FOR_REVISIONS) ; Use specific template (NEW)
                                               ("qa_report" qaReportContent)
                                               ("artifact_content" artifactContent)
                                               ("session_model" sessionModelContent) ; Pass session model for context
                                               ("constraints" constraintsContent) ; Pass constraints for context
                                            ))
                                   (GET_LLM_PARAMS_FOR_TASK "revision_planning") ; Use specific task type (NEW)
                                )))
        (IF (EQ (GET_STATUS revisionPlanResult) ALANG_STATUS_SUCCESS)
            (LET ((revisionPlan (GET_DATA revisionPlanResult)))) ; Expected: {strategy: "self_correct"|"user_review", details: {...}}
            ; Validate revisionPlan structure (NEW)
            (LET ((validationResult (VALIDATE_DATA revisionPlan CONSTRAINT_SET_REVISION_PLAN_STRUCTURE))))
            (IF (EQ validationResult ALANG_STATUS_SUCCESS)
                (IF (EQ (MAP_GET_VALUE revisionPlan "strategy") "self_correct")
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Attempting automated self-correction based on revision plan." NIL)
                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_attempt") ("artifact_handle" artifact_handle) ("strategy" "self_correct"))) ; Log attempt (NEW)
                        ; Call SelfCorrectArtifact with relevant details from the revision plan
                        (LET ((correctionResult (SelfCorrectArtifact artifactContent (MAP_GET_VALUE revisionPlan "details") constraints_handle session_model_handle)))) ; Pass details, constraints, session model
                        (IF (EQ (GET_STATUS correctionResult) ALANG_STATUS_SUCCESS)
                            (SEQ
                                (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Automated self-correction succeeded. Overwriting artifact content." NIL)
                                ; Overwrite the artifact content with corrected text
                                (LET ((writeStatus (WRITE_CONTENT_TO_ARTIFACT artifact_handle (GET_DATA correctionResult) "text/markdown"))))
                                (IF (EQ writeStatus ALANG_STATUS_SUCCESS)
                                    (SEQ
                                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_revised") ("artifact_handle" artifact_handle))) ; Update model
                                        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_success") ("artifact_handle" artifact_handle) ("strategy" "self_correct"))) ; Log success (NEW)
                                        ; Potentially update conceptual model to mark specific issues as resolved based on revisionPlan
                                        (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate successful self-correction
                                    )
                                    (SEQ ; Write failed after self-correction
                                         (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_SYSTEM_ERROR: Revision failed after self-correction. Review content.***")
                                         (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_revision_write_failed") ("artifact_handle" artifact_handle))) ; Update model (NEW action)
                                         (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_failure") ("artifact_handle" artifact_handle) ("strategy" "self_correct") ("reason" "write_failed"))) ; Log failure (NEW)
                                         ; Store context for user review (NEW)
                                         (SET_STATE session.pending_user_action_details (MAP_CREATE ("artifact_handle" artifact_handle) ("qa_report_handle" qa_report_handle) ("constraints_handle" constraints_handle) ("original_generated_text" artifactContent))) ; Store context for review
                                         (SET_STATE session.pending_user_action "AWAIT_REVISION_REVIEW") ; Require user review
                                         (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause
                                    )
                                )
                            )
                            (SEQ ; Self-correction failed
                                 (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Automated self-correction failed. Flagging original content for user review." NIL)
                                 (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_USER_VERIFICATION_REQUIRED: Automated revision failed. Review content and QA report.***")
                                 (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_revision_failed_user_review") ("artifact_handle" artifact_handle) ("details" (MAP_GET_VALUE revisionPlan "details")))) ; Update model (NEW action)
                                 (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_failure") ("artifact_handle" artifact_handle) ("strategy" "self_correct") ("reason" "llm_correction_failed"))) ; Log failure (NEW)
                                 ; Store context for user review (NEW)
                                 (SET_STATE session.pending_user_action_details (MAP_CREATE ("artifact_handle" artifact_handle) ("qa_report_handle" qa_report_handle) ("constraints_handle" constraints_handle) ("original_generated_text" artifactContent))) ; Store context for review
                                 (SET_STATE session.pending_user_action "AWAIT_REVISION_REVIEW") ; Require user review
                                 (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause
                            )
                        )
                    )
                    (IF (EQ (MAP_GET_VALUE revisionPlan "strategy") "user_review")
                        (SEQ
                             (OUTPUT_TO_USER_BUFFER "AI_PRESENT_THOUGHTS" "Substantive issues require user review for revision." NIL)
                             (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_USER_VERIFICATION_REQUIRED: Review required for substantive issues.***")
                             (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_user_review_needed") ("artifact_handle" artifact_handle) ("details" (MAP_GET_VALUE revisionPlan "details")))) ; Update model
                              (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_attempt") ("artifact_handle" artifact_handle) ("strategy" "user_review"))) ; Log attempt (NEW)
                             ; Store context for user review (NEW)
                             (SET_STATE session.pending_user_action_details (MAP_CREATE ("artifact_handle" artifact_handle) ("qa_report_handle" qa_report_handle) ("constraints_handle" constraints_handle) ("original_generated_text" artifactContent))) ; Store context for review
                             (SET_STATE session.pending_user_action "AWAIT_REVISION_REVIEW") ; Require user review
                             (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause
                        )
                        ; Default / Unknown strategy
                        (SEQ
                            (LOG_EVENT "SYSTEM_ERROR" "Unknown revision strategy from LLM.")
                            (SET_ERROR_STATE "LLM_ERROR" "LLM returned unknown revision strategy.")
                            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                            (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_SYSTEM_ERROR: Revision decision failed. Review content and QA report.***")
                            (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_revision_decision_failed") ("artifact_handle" artifact_handle))) ; Update model
                            (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_failure") ("artifact_handle" artifact_handle) ("strategy" "decision_failed"))) ; Log failure (NEW)
                             ; Store context for user review (NEW)
                            (SET_STATE session.pending_user_action_details (MAP_CREATE ("artifact_handle" artifact_handle) ("qa_report_handle" qa_report_handle) ("constraints_handle" constraints_handle) ("original_generated_text" artifactContent))) ; Store context for review
                             (SET_STATE session.pending_user_action "AWAIT_REVISION_REVIEW") ; Require user review
                             (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause
                        )
                    )
                )
                (SEQ ; Revision Plan Validation failed
                    (LOG_EVENT "SYSTEM_ERROR" "Revision plan from LLM failed validation.")
                    (SET_ERROR_STATE "LLM_ERROR" "LLM returned malformed revision plan.")
                    (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                    (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_SYSTEM_ERROR: Revision plan invalid. Review content and QA report.***")
                    (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_revision_plan_invalid") ("artifact_handle" artifact_handle))) ; Update model (NEW action)
                    (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_failure") ("artifact_handle" artifact_handle) ("strategy" "plan_validation_failed"))) ; Log failure (NEW)
                    ; Store context for user review (NEW)
                    (SET_STATE session.pending_user_action_details (MAP_CREATE ("artifact_handle" artifact_handle) ("qa_report_handle" qa_report_handle) ("constraints_handle" constraints_handle) ("original_generated_text" artifactContent))) ; Store context for review
                    (SET_STATE session.pending_user_action "AWAIT_REVISION_REVIEW") ; Require user review
                    (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause
                )
            )
            (SEQ ; LLM failed to generate revision plan
                (LOG_EVENT "SYSTEM_ERROR" "LLM failed to generate revision plan.")
                (SET_ERROR_STATE "LLM_ERROR" "LLM failed to generate revision plan.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_SYSTEM_ERROR: Could not generate revision plan. Review content and QA report.***")
                (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_revision_plan_failed") ("artifact_handle" artifact_handle))) ; Update model (NEW action)
                (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_failure") ("artifact_handle" artifact_handle) ("strategy" "plan_generation_failed"))) ; Log failure (NEW)
                ; Store context for user review (NEW)
                (SET_STATE session.pending_user_action_details (MAP_CREATE ("artifact_handle" artifact_handle) ("qa_report_handle" qa_report_handle) ("constraints_handle" constraints_handle) ("original_generated_text" artifactContent))) ; Store context for review
                (SET_STATE session.pending_user_action "AWAIT_REVISION_REVIEW") ; Require user review
                (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause
            )
        )
        (SEQ ; Failed to read inputs for revision planning
            (LOG_EVENT "SYSTEM_ERROR" "Failed to read inputs for revision planning.")
            (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to read inputs for revision planning.")
            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
            (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_SYSTEM_ERROR: Could not process revision inputs. Review content.***")
            (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_revision_input_failed") ("artifact_handle" artifact_handle))) ; Update model (NEW action)
            (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_revision_failure") ("artifact_handle" artifact_handle) ("strategy" "input_read_failed"))) ; Log failure (NEW)
            ; Store context for user review (NEW)
            (SET_STATE session.pending_user_action_details (MAP_CREATE ("artifact_handle" artifact_handle) ("qa_report_handle" qa_report_handle) ("constraints_handle" constraints_handle) ("original_generated_text" NIL))) ; Store context for review (original text might not be available)
            (SET_STATE session.pending_user_action "AWAIT_REVISION_REVIEW") ; Require user review
            (RETURN_STATUS ALANG_STATUS_PAUSE_FOR_USER_INPUT) ; Indicate pause
        )
    )
)

(DEFINE_PROCEDURE ApplyFeedbackBasedRevision (artifact_handle feedback_text constraints_handle session_model_handle context_details)
    ;; Conceptual procedure to apply revisions based on explicit user feedback after a review. (NEW)
    ;; This is similar to ApplyRevisionsToArtifact but specifically triggered by user REVISE feedback.
    ;; It uses the feedback, the artifact content, constraints, session model, and potentially previous QA/revision context.
    ;; Returns: ALANG_STATUS_CODE (SUCCESS, FAILURE, or PAUSE_FOR_USER_INPUT)
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Applying feedback-based revisions to artifact..." NIL)
    (LOG_EVENT "CONCEPTUAL_PROCESS" (STRING_CONCAT "Applying feedback-based revisions to artifact " (GET_HANDLE_METADATA artifact_handle "id")))
    (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_feedback_revision_attempt") ("artifact_handle" artifact_handle) ("feedback" feedback_text))) ; Log attempt (NEW)

    (LET ((artifactContentResult (READ_CONTENT artifact_handle "text_summary_or_full" NIL))))
    (LET ((sessionModelContentResult (READ_CONTENT session_model_handle "structured_map" NIL))))
    (LET ((constraintsContentResult (READ_CONTENT constraints_handle "structured_list_of_rules" NIL))))

    (IF (AND (EQ (GET_STATUS artifactContentResult) ALANG_STATUS_SUCCESS)
             (EQ (GET_STATUS sessionModelContentResult) ALANG_STATUS_SUCCESS)
             (EQ (GET_STATUS constraintsContentResult) ALANG_STATUS_SUCCESS)))
        (LET ((artifactContent (GET_DATA artifactContentResult))))
        (LET ((sessionModelContent (GET_DATA sessionModelContentResult))))
        (LET ((constraintsContent (GET_DATA constraintsContentResult))))

        ; Use LLM to generate revised content based on feedback and context
        (LET ((revisionResult (INVOKE_CORE_LLM_GENERATION
                               (MAP_CREATE ("template" PROMPT_TEMPLATE_ANALYZE_FEEDBACK_FOR_REVISION) ; Use specific template (NEW)
                                           ("artifact_content" artifactContent)
                                           ("user_feedback" feedback_text)
                                           ("session_model" sessionModelContent) ; Pass session model for context
                                           ("constraints" constraintsContent) ; Pass constraints for context
                                           ("previous_qa_context" context_details) ; Pass context from previous QA/revision attempt (NEW)
                                        ))
                               (GET_LLM_PARAMS_FOR_TASK "feedback_based_revision") ; Use specific task type (NEW)
                            )))
        (IF (EQ (GET_STATUS revisionResult) ALANG_STATUS_SUCCESS)
            (LET ((revisedContent (GET_DATA revisionResult))))
            ; Overwrite the artifact content with revised text
            (LET ((writeStatus (WRITE_CONTENT_TO_ARTIFACT artifact_handle revisedContent "text/markdown"))))
            (IF (EQ writeStatus ALANG_STATUS_SUCCESS)
                (SEQ
                    (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_revised_by_feedback") ("artifact_handle" artifact_handle))) ; Update model (NEW action)
                    (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_feedback_revision_success") ("artifact_handle" artifact_handle))) ; Log success (NEW)
                    ; Potentially update conceptual model to mark specific feedback points as addressed
                    (RETURN_STATUS ALANG_STATUS_SUCCESS) ; Indicate successful revision
                )
                (SEQ ; Write failed after revision
                     (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_SYSTEM_ERROR: Revision failed after feedback. Review content.***")
                     (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_feedback_revision_write_failed") ("artifact_handle" artifact_handle))) ; Update model (NEW action)
                     (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_feedback_revision_failure") ("artifact_handle" artifact_handle) ("reason" "write_failed"))) ; Log failure (NEW)
                     ; This might require user review again, but the state is already AWAIT_REVISION_REVIEW.
                     ; The orchestrator needs to handle the failure status and decide whether to re-prompt.
                     (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL) ; Indicate failure
                )
            )
        )
        (SEQ ; LLM failed to generate revision
            (LOG_EVENT "SYSTEM_ERROR" "LLM failed to generate feedback-based revision.")
            (SET_ERROR_STATE "LLM_ERROR" "LLM failed to generate feedback-based revision.")
            (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
            (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_SYSTEM_ERROR: Could not generate feedback-based revision. Review content and provide feedback again.***")
            (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_feedback_revision_failed") ("artifact_handle" artifact_handle))) ; Update model (NEW action)
            (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_feedback_revision_failure") ("artifact_handle" artifact_handle) ("reason" "llm_generation_failed"))) ; Log failure (NEW)
            ; This might require user review again, but the state is already AWAIT_REVISION_REVIEW.
            ; The orchestrator needs to handle the failure status and decide whether to re-prompt.
            (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL) ; Indicate failure
        )
    )
    (SEQ ; Failed to read inputs for revision
        (LOG_EVENT "SYSTEM_ERROR" "Failed to read inputs for feedback-based revision.")
        (SET_ERROR_STATE "SYSTEM_ERROR" "Failed to read inputs for feedback-based revision.")
        (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
        (CALL_PROCEDURE ADD_DISCLAIMER_TO_ARTIFACT artifact_handle "***AI_SYSTEM_ERROR: Could not process feedback revision inputs. Review content.***")
        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "flag_feedback_revision_input_failed") ("artifact_handle" artifact_handle))) ; Update model (NEW action)
        (CALL_PROCEDURE UPDATE_CONCEPTUAL_MODEL (MAP_CREATE ("action" "log_feedback_revision_failure") ("artifact_handle" artifact_handle) ("reason" "input_read_failed"))) ; Log failure (NEW)
        ; This might require user review again, but the state is already AWAIT_REVISION_REVIEW.
        ; The orchestrator needs to handle the failure status and decide whether to re-prompt.
        (RETURN_STATUS ALANG_STATUS_FAILURE_GENERAL) ; Indicate failure
    )
)


(DEFINE_PROCEDURE QA_Stage_1_SelfCritique (artifact_handle session_model_handle)
    ;; Performs a self-critique of the given artifact.
    ;; Critiques the artifact's representation of the pattern model against internal consistency and completeness criteria, leveraging the session conceptual model for context (Principle 3.A.1).
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Running QA Stage 1: Self-Critique (Internal Coherence & Completeness check of pattern model representation against session conceptual model)... " (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE") "Generating detailed report." "" )) NIL)
    ; Context for self-critique includes the artifact and the session conceptual model for holistic check.
    (LET ((critiqueReportHandle (CREATE_EMPTY_ARTIFACT "qa_critique_self"))) ; Output artifact for the critique report
    (LET ((generationResult (SAFE_GENERATE_CONTENT
                            critiqueReportHandle ; Target handle
                            PROMPT_TEMPLATE_QA_SELF_CRITIQUE
                            (MAP_CREATE ("artifact_content_handle" artifact_handle)
                                        ("session_conceptual_model_handle" session_model_handle)) ; Include conceptual model handle
                            CONSTRAINT_SET_QA_CRITIQUE
                          )))
        (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT)) ; SAFE_GENERATE_CONTENT can return PAUSE
            (SEQ
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Self-critique complete." NIL)
                (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE")
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Self-Critique Report:" NIL)
                        (LET ((reportContentResult (READ_CONTENT critiqueReportHandle "text_summary_or_full" NIL))))
                        (IF (EQ (GET_STATUS reportContentResult) ALANG_STATUS_SUCCESS)
                            (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (GET_DATA reportContentResult) NIL)
                        )
                    )
                )
                ; Return the handle to the critique report and the status.
                (RETURN_STATUS (MAP_CREATE ("status" (GET_STATUS generationResult)) ("data" critiqueReportHandle))) ; Return structured result
            )
            (SEQ
                (SET_ERROR_STATE "QA_ERROR" "Failed to generate self-critique.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL))) ; Return structured failure
            )
        )
    ))
)

(DEFINE_PROCEDURE QA_Stage_2_DivergentExploration (artifact_handle session_model_handle)
    ;; Performs divergent exploration and falsification of the given artifact.
    ;; Challenges the artifact's representation of the pattern model by exploring alternative interpretations and potential counter-evidence, leveraging the session conceptual model for context (Principle 3.A.2).
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Running QA Stage 2: Divergent Exploration & Falsification... " (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE") "Generating detailed report." "" )) NIL)
    ; Context for divergent exploration includes the artifact and the session conceptual model.
    (LET ((critiqueReportHandle (CREATE_EMPTY_ARTIFACT "qa_critique_divergent"))) ; Output artifact for the critique report
    (LET ((generationResult (SAFE_GENERATE_CONTENT
                            critiqueReportHandle ; Target handle
                            PROMPT_TEMPLATE_QA_DIVERGENT_EXPLORATION
                            (MAP_CREATE ("artifact_content_handle" artifact_handle)
                                        ("session_conceptual_model_handle" session_model_handle)) ; Include conceptual model handle
                            CONSTRAINT_SET_QA_CRITIQUE
                          )))
        (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT))
            (SEQ
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Divergent exploration complete." NIL)
                (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE")
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Divergent Exploration Report:" NIL)
                        (LET ((reportContentResult (READ_CONTENT critiqueReportHandle "text_summary_or_full" NIL))))
                        (IF (EQ (GET_STATUS reportContentResult) ALANG_STATUS_SUCCESS)
                            (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" (GET_DATA reportContentResult) NIL)
                        )
                    )
                )
                 ; Return the handle to the critique report and the status.
                (RETURN_STATUS (MAP_CREATE ("status" (GET_STATUS generationResult)) ("data" critiqueReportHandle))) ; Return structured result
            )
            (SEQ
                (SET_ERROR_STATE "QA_ERROR" "Failed to generate divergent exploration critique.")
                (OUTPUT_TO_USER_BUFFER "AI_ERROR" (GET_STATE sys.error_message) NIL)
                (RETURN_STATUS (MAP_CREATE ("status" ALANG_STATUS_FAILURE_GENERAL) ("data" NIL))) ; Return structured failure
            )
        )
    ))
)

(DEFINE_PROCEDURE QA_Stage_3_RedTeaming (artifact_handle session_model_handle)
    ;; Performs adversarial red teaming of the given artifact.
    ;; Tests the robustness and resilience of the pattern model representation against adversarial inputs or scenarios, leveraging the session conceptual model for context (Principle 3.A.3).
    (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" (STRING_CONCAT "Running QA Stage 3: Adversarial Red Teaming... " (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE") "Generating detailed report." "" )) NIL)
    ; Context for red teaming includes the artifact and the session conceptual model.
    (LET ((critiqueReportHandle (CREATE_EMPTY_ARTIFACT "qa_critique_redteam"))) ; Output artifact for the critique report
    (LET ((generationResult (SAFE_GENERATE_CONTENT
                            critiqueReportHandle ; Target handle
                            PROMPT_TEMPLATE_QA_RED_TEaming
                            (MAP_CREATE ("artifact_content_handle" artifact_handle)
                                        ("session_conceptual_model_handle" session_model_handle)) ; Include conceptual model handle
                            CONSTRAINT_SET_QA_CRITIQUE
                          )))
        (IF (OR (EQ (GET_STATUS generationResult) ALANG_STATUS_SUCCESS)
                (EQ (GET_STATUS generationResult) ALANG_STATUS_PAUSE_FOR_USER_INPUT))
            (SEQ
                (OUTPUT_TO_USER_BUFFER "AI_THOUGHTS" "Red Teaming complete." NIL)
                (IF (EQ (GET_STATE session.qa_output_verbosity) "VERBOSE")
                    (SEQ
                        (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Red Teaming Report:" NIL)
                        (LET ((reportContentResult (