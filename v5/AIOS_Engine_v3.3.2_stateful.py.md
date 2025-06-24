# AIOS_Engine_v3.3.2_stateful.py
import json
import uuid
import datetime
import time # For simulating work if needed by orchestrator

class AIOS_Engine_v3_3_2_stateful: # Version updated
    def __init__(self, initial_state_json_string=None):
        self.log_history = []
        self.engine_version_full = "AIOS_Engine_v3.3.2-stateful (Python Orchestrated)" # Updated
        self.engine_version_short = "3.3.2-stateful" # Updated
        self.current_context_mh = "System"
        self.state_schema_version = "1.0" # For state import/export

        # Initialize default empty states
        self._initialize_default_state()

        self.aios_log("System", "AIOS_Engine __init__ sequence: Started.")

        if initial_state_json_string:
            try:
                self.import_state(initial_state_json_string)
                self.aios_log("System", f"AIOS_Engine instance created and state imported from JSON. Schema: {self.state_schema_version}")
            except Exception as e:
                self.aios_log("System", f"ERROR during __init__ state import: {str(e)}. Initializing with default state.")
                self._initialize_default_state() # Ensure clean state on import error
                self.aios_log("System", f"{self.engine_version_full} instance created with default state after import error.")
        else:
            self.aios_log("System", f"{self.engine_version_full} instance created with default state.")
        
        self.aios_log("System", "AIOS_Engine __init__ sequence: Completed.")

    def _initialize_default_state(self):
        # Kernel State
        self.Kernel_ActiveCCO_JsonString = None
        self.Kernel_CurrentMH_ID = None
        self.Kernel_MH_Inputs_JsonString = None

        # CCO Data (Python dictionary representation)
        self.CCO_data = None

        # Internal state for multi-step MHs
        self._ife_s = {}
        self._pdf_s = {}
        self._plan_s = {}
        self._cag_s = {}
        self._tde_s = {}
        self._sel_s = {}
        self._kau_s = {}
        self._fel_s = {} # FEL state itself will be part of the export
        self._mro_s = {}
        
        # Ensure log_history and current_context_mh are initialized if not already
        if not hasattr(self, 'log_history'): self.log_history = []
        if not hasattr(self, 'current_context_mh'): self.current_context_mh = "System"


    def export_state(self) -> str:
        self.aios_log("System", "export_state: Serializing engine state.")
        state_data = {
            "state_schema_version": self.state_schema_version,
            "engine_version_full": self.engine_version_full,
            "engine_version_short": self.engine_version_short,
            "current_context_mh": self.current_context_mh,
            "Kernel_ActiveCCO_JsonString": self.Kernel_ActiveCCO_JsonString,
            "Kernel_CurrentMH_ID": self.Kernel_CurrentMH_ID,
            "Kernel_MH_Inputs_JsonString": self.Kernel_MH_Inputs_JsonString,
            "CCO_data": self.CCO_data, # CCO_data is a dict, will be serialized by json.dumps
            "_ife_s": self._ife_s,
            "_pdf_s": self._pdf_s,
            "_plan_s": self._plan_s,
            "_cag_s": self._cag_s,
            "_tde_s": self._tde_s,
            "_sel_s": self._sel_s,
            "_kau_s": self._kau_s,
            "_fel_s": self._fel_s,
            "_mro_s": self._mro_s,
            "log_history": self.log_history # log_history is a list of strings
        }
        try:
            return json.dumps(state_data)
        except TypeError as e:
            self.aios_log("System", f"ERROR in export_state: JSON serialization failed: {str(e)}")
            # Fallback: try to serialize what can be serialized, log problematic keys
            problematic_keys = []
            for key, value in state_data.items():
                try:
                    json.dumps({key: value})
                except TypeError:
                    problematic_keys.append(key)
                    state_data[key] = f"UNSERIALIZABLE_DATA_TYPE ({type(value).__name__})"
            self.aios_log("System", f"export_state: Problematic keys during fallback serialization: {problematic_keys}")
            return json.dumps(state_data)


    def import_state(self, state_json_string: str):
        self.aios_log("System", "import_state: Deserializing and restoring engine state.")
        try:
            state_data = json.loads(state_json_string)
        except json.JSONDecodeError as e:
            self.aios_log("System", f"ERROR in import_state: JSON deserialization failed: {str(e)}. State not imported.")
            raise ValueError(f"Invalid state JSON: {str(e)}") from e

        imported_schema_version = state_data.get("state_schema_version")
        if imported_schema_version != self.state_schema_version:
            self.aios_log("System", f"WARNING in import_state: Mismatched state_schema_version. Engine: {self.state_schema_version}, Imported: {imported_schema_version}. Attempting import anyway.")
            # Future: Add schema migration logic here if necessary

        # Restore attributes
        self.engine_version_full = state_data.get("engine_version_full", self.engine_version_full)
        self.engine_version_short = state_data.get("engine_version_short", self.engine_version_short)
        self.current_context_mh = state_data.get("current_context_mh", "System")
        
        self.Kernel_ActiveCCO_JsonString = state_data.get("Kernel_ActiveCCO_JsonString")
        self.Kernel_CurrentMH_ID = state_data.get("Kernel_CurrentMH_ID")
        self.Kernel_MH_Inputs_JsonString = state_data.get("Kernel_MH_Inputs_JsonString")
        
        self.CCO_data = state_data.get("CCO_data") # CCO_data is already a dict from JSON

        self._ife_s = state_data.get("_ife_s", {})
        self._pdf_s = state_data.get("_pdf_s", {})
        self._plan_s = state_data.get("_plan_s", {})
        self._cag_s = state_data.get("_cag_s", {})
        self._tde_s = state_data.get("_tde_s", {})
        self._sel_s = state_data.get("_sel_s", {})
        self._kau_s = state_data.get("_kau_s", {})
        self._fel_s = state_data.get("_fel_s", {})
        self._mro_s = state_data.get("_mro_s", {})
        
        self.log_history = state_data.get("log_history", [])
        
        self.aios_log("System", "import_state: Engine state successfully restored.")


    def _get_timestamp(self):
        return datetime.datetime.now(datetime.timezone.utc).isoformat()

    def aios_log(self, context, message):
        timestamp = self._get_timestamp()
        # Ensure engine_version_short is available for logging, even during early __init__
        version_short = getattr(self, 'engine_version_short', 'unknown')
        full_log = f"{timestamp} - AIOS_LOG ({context} v{version_short}): {message}"
        print(full_log)
        if hasattr(self, 'log_history'): # log_history might not be init'd if called too early by a misbehaving method
            self.log_history.append(full_log)
        else: # Fallback if log_history isn't ready (should not happen with proper init order)
            print(f"FALLBACK_LOG (log_history not init'd): {full_log}")


    def _create_llm_request(self, task_type, prompt_to_user=None, cognitive_task_details=None, expected_input_description=None, continuation_hint=None, cco_data_for_context=None):
        request = {
            "request_timestamp": self._get_timestamp(),
            "engine_version_context": self.engine_version_full,
            "current_mh_context": self.current_context_mh,
            "task_type": task_type,
        }
        if prompt_to_user: request["prompt_to_user_for_llm_interaction"] = prompt_to_user
        if cognitive_task_details: request["cognitive_task_details_for_llm"] = cognitive_task_details
        if expected_input_description: request["expected_input_description_for_continuation"] = expected_input_description
        if continuation_hint: request["continuation_hint_for_orchestrator"] = continuation_hint

        current_cco_to_pass = cco_data_for_context if cco_data_for_context is not None else self.CCO_data
        if current_cco_to_pass:
             if isinstance(current_cco_to_pass, dict): request["current_cco_data_for_llm_context"] = current_cco_to_pass
             elif isinstance(current_cco_to_pass, str):
                 try: request["current_cco_data_for_llm_context"] = json.loads(current_cco_to_pass)
                 except: request["current_cco_data_for_llm_context"] = {"unparsed_cco_string_warning": "Could not parse CCO string for LLM context.", "raw_cco_string_preview": current_cco_to_pass[:200] + ("..." if len(current_cco_to_pass) > 200 else "")}

        print("\n---BEGIN_LLM_REQUEST---"); print(json.dumps(request, indent=2)); print("---END_LLM_REQUEST---")
        return {"status": "AWAITING_LLM_ORCHESTRATION", "request_details": request, "current_engine_state_snapshot": self._get_engine_state_snapshot()}

    def _get_engine_state_snapshot(self): # Added more comprehensive state details
        state_snapshot = {
            "Kernel_CurrentMH_ID": self.Kernel_CurrentMH_ID, 
            "Kernel_MH_Inputs_JsonString": self.Kernel_MH_Inputs_JsonString, 
            "Kernel_ActiveCCO_JsonString_first_100_chars": (self.Kernel_ActiveCCO_JsonString[:100] + "...") if self.Kernel_ActiveCCO_JsonString else None, 
            "CCO_data_id": self.CCO_data.get('cco_id', 'N/A') if isinstance(self.CCO_data, dict) else 'N/A', 
            "current_context_mh_for_logging": self.current_context_mh,
            "state_schema_version": self.state_schema_version
        }
        # Add keys of state dictionaries if they are not empty
        for s_dict_name in ['_ife_s', '_pdf_s', '_plan_s', '_cag_s', '_tde_s', '_sel_s', '_kau_s', '_fel_s', '_mro_s']:
            s_dict = getattr(self, s_dict_name, {})
            if s_dict: # Only include if not empty
                state_snapshot[f"{s_dict_name}_keys"] = list(s_dict.keys())
        return state_snapshot

    def PresentUserMessage_v3_0(self, message_type, message_content_obj):
        self.aios_log(self.current_context_mh, f"PresentUserMessage_v3_0 (Type: {message_type}): {message_content_obj}")
        return self._create_llm_request(task_type="PRESENT_USER_MESSAGE_TO_USER", cognitive_task_details={"message_type": message_type, "content": message_content_obj, "requesting_mh": self.current_context_mh}, continuation_hint="LLM presents message. Engine logic flow typically continues unless this message is part of an input request sequence.")
    
    def ParseJsonToCNLObject(self, json_string_input):
        if json_string_input is None or not isinstance(json_string_input, str) or json_string_input.strip() == "": self.aios_log(self.current_context_mh, "ParseJsonToCNLObject: Input JSON string is null or empty. Returning None."); return None
        try: return json.loads(json_string_input)
        except json.JSONDecodeError as e: self.aios_log(self.current_context_mh, f"ERROR in ParseJsonToCNLObject: {str(e)}. Input: '{json_string_input}'"); raise ValueError(f"AIOS_JSONParsingError (v{self.engine_version_short}): {str(e)} on input: {json_string_input}")
    
    def ConvertCNLObjectToJson(self, cnl_object_input):
        if cnl_object_input is None: return "null"
        try: return json.dumps(cnl_object_input)
        except TypeError as e: self.aios_log(self.current_context_mh, f"ERROR in ConvertCNLObjectToJson: {str(e)}"); raise ValueError(f"AIOS_JSONFormattingError (v{self.engine_version_short}): {str(e)}")
    
    def LogToCCOHistory_v3_0(self, cco_data_dict, log_entry_type, message, associated_data_cnl_obj=None):
        self.aios_log(self.current_context_mh, f"LogToCCOHistory_v3_0: Type='{log_entry_type}', Msg='{message}'")
        if not isinstance(cco_data_dict, dict): self.aios_log(self.current_context_mh, "LogToCCOHistory_v3_0: CCO data is not a dict. Creating basic CCO for logging."); cco_data_dict = {"operational_log_cco_json": "[]"}
        op_log_list_str = cco_data_dict.get("operational_log_cco_json", "[]"); op_log_list = self.ParseJsonToCNLObject(op_log_list_str)
        if not isinstance(op_log_list, list): op_log_list = []
        new_log_entry = {"timestamp": self._get_timestamp(), "log_entry_type": log_entry_type, "log_message": message}
        if associated_data_cnl_obj is not None: new_log_entry["associated_data_json"] = self.ConvertCNLObjectToJson(associated_data_cnl_obj)
        op_log_list.append(new_log_entry); cco_data_dict["operational_log_cco_json"] = self.ConvertCNLObjectToJson(op_log_list)
        self.CCO_data = cco_data_dict; self.Kernel_ActiveCCO_JsonString = self.ConvertCNLObjectToJson(cco_data_dict)
        return cco_data_dict

    # --- "AI Cognitive Functions" ---
    def fn_interaction_present_options_v3(self, prompt_message_to_user, options_list_cnl):
        self.aios_log(self.current_context_mh, "fn_interaction_present_options_v3: Requesting LLM to get user choice from options.")
        return self._create_llm_request(task_type="USER_INPUT_REQUIRED_PRESENT_OPTIONS",prompt_to_user=prompt_message_to_user,cognitive_task_details={"options": options_list_cnl, "input_type": "option_selection"},expected_input_description="JSON object from LLM: {'status': 'USER_COMMAND', 'command': <chosen_option_value_or_text>, 'selected_option_value': <value_if_option>, 'user_text': <raw_text>}. See AIOS Kernel interaction model.",continuation_hint="engine.kernel_process_initial_choice_result(llm_interaction_result_obj)")

    def fn_interaction_elicit_user_input_v3(self, prompt_message_to_user):
        self.aios_log(self.current_context_mh, "fn_interaction_elicit_user_input_v3: Requesting LLM to get user text input.")
        return self._create_llm_request(task_type="USER_INPUT_REQUIRED_ELICIT_TEXT",prompt_to_user=prompt_message_to_user,cognitive_task_details={"input_type": "free_text"},expected_input_description="JSON object from LLM: {'status': 'USER_COMMAND', 'command': <user_text>, 'user_text': <user_text>}. See IFE-MH.",continuation_hint="Depends on calling MH. E.g., engine.run_mh_ife_step2_process_core_idea(llm_interaction_result_obj)")

    def fn_utility_generate_unique_id_v3(self, id_prefix):
        self.aios_log(self.current_context_mh, f"fn_utility_generate_unique_id_v3 (prefix: {id_prefix})"); unique_id = f"{id_prefix}{uuid.uuid4()}"; return {"status": "Generated", "unique_id": unique_id}

    def fn_content_draft_text_segment_v3(self, instructions, context_obj, desired_length_hint, rhetorical_goal_hint, output_key_name="draft_text"):
        self.aios_log(self.current_context_mh, f"fn_content_draft_text_segment_v3: Requesting LLM to draft text for '{output_key_name}'.")
        cognitive_details = {"task_name_from_spec": "content_draft_text_segment_v3", "instructions": instructions, "input_context_data_for_llm": context_obj, "desired_length_hint": desired_length_hint, "rhetorical_goal_hint": rhetorical_goal_hint, "output_format_guidance": f"LLM should return a JSON object with a key '{output_key_name}' containing the drafted text string, and a 'status' key (e.g., 'DraftComplete')."}
        return self._create_llm_request(task_type="COGNITIVE_TASK_REQUIRED_DRAFT_TEXT", cognitive_task_details=cognitive_details, expected_input_description=f"JSON object from LLM. Orchestrator provides as 'llm_cognitive_result'.", continuation_hint="Depends on calling MH step.", cco_data_for_context=self.CCO_data )

    def fn_data_update_cco_section_v3(self, cco_data_dict, section_path, new_content_json_str_to_store):
        self.aios_log(self.current_context_mh, f"fn_data_update_cco_section_v3 (Path: {section_path})")
        if not isinstance(cco_data_dict, dict): self.aios_log(self.current_context_mh, "fn_data_update_cco_section_v3: CCO data is not a dict. Update failed."); return cco_data_dict
        keys = section_path.split('.'); current_level = cco_data_dict
        try:
            for i, key in enumerate(keys):
                if i == len(keys) - 1: current_level[key] = new_content_json_str_to_store
                else:
                    if key not in current_level or not isinstance(current_level[key], dict): current_level[key] = {}
                    current_level = current_level[key]
            self.CCO_data = cco_data_dict; self.Kernel_ActiveCCO_JsonString = self.ConvertCNLObjectToJson(cco_data_dict)
        except Exception as e: self.aios_log(self.current_context_mh, f"Error in fn_data_update_cco_section_v3 for path '{section_path}': {e}")
        return cco_data_dict

    def fn_mro_RefineOutput_Pipeline_v3_0(self, draft_content_json_str, refinement_goals_obj, cco_context_json_str, caller_mh_context, caller_continuation_hint):
        self.aios_log(self.current_context_mh, f"fn_mro_RefineOutput_Pipeline_v3_0: Initializing MRO for {caller_mh_context}.")
        return self.run_mro_pipeline_step1_initialize(DraftOutput_JsonString=draft_content_json_str, CCOContext_JsonString=cco_context_json_str, RefinementGoals_JsonString=self.ConvertCNLObjectToJson(refinement_goals_obj), caller_mh_context=caller_mh_context, caller_continuation_hint=caller_continuation_hint)

    def fn_interpret_user_directive_for_next_mh_v3(self, user_input_text):
        self.aios_log(self.current_context_mh, f"fn_interpret_user_directive_for_next_mh_v3 for: '{user_input_text}'"); uit_lower = user_input_text.lower().strip(); next_mh_id = "AWAIT_USER_INPUT"; next_mh_inputs = {}; user_prompt_message = "Command not fully understood. What would you like to do next?"
        if "new process" == uit_lower or "1" == uit_lower or "1." == uit_lower or (uit_lower.startswith("new") and "process" in uit_lower) : next_mh_id = "IFE-MH"; next_mh_inputs = {}; user_prompt_message = None
        elif "evolve engine" == uit_lower or "2" == uit_lower or "2." == uit_lower or (uit_lower.startswith("evolve") and "engine" in uit_lower): next_mh_id = "FEL-MH"; next_mh_inputs = {}; user_prompt_message = None
        elif uit_lower in ["terminate aios", "terminate", "exit", "quit", "3", "3."]: next_mh_id = "TERMINATE_AIOS"; user_prompt_message = None
        elif "define problem" in uit_lower or "pdf" in uit_lower: next_mh_id = "PDF-MH"; user_prompt_message = None
        elif "create plan" in uit_lower or "plan" in uit_lower: next_mh_id = "PLAN-MH"; user_prompt_message = None
        elif "execute plan" in uit_lower or "run tasks" in uit_lower or "tde" in uit_lower: next_mh_id = "TDE-MH"; user_prompt_message = None
        elif "explore solutions" in uit_lower or "sel" in uit_lower: next_mh_id = "SEL-MH"; user_prompt_message = None
        elif "update knowledge" in uit_lower or "kau" in uit_lower or "learn" in uit_lower: next_mh_id = "KAU-MH"; user_prompt_message = None
        result_obj = {"status": "Success" if next_mh_id != "AWAIT_USER_INPUT" else "InterpretationRequiresClarification", "next_mh_id": next_mh_id, "next_mh_inputs_json": self.ConvertCNLObjectToJson(next_mh_inputs)}
        if user_prompt_message: result_obj["user_prompt_message"] = user_prompt_message
        return result_obj

    def fn_query_adaptive_critique_rules_v3(self, cco_context_json_str, current_critique_focus_str):
        self.aios_log(self.current_context_mh, f"MRO: Requesting LLM for fn_query_adaptive_critique_rules_v3. Focus: {current_critique_focus_str}")
        return self._create_llm_request(task_type="COGNITIVE_TASK_MRO_QUERY_CRITIQUE_RULES", cognitive_task_details={"cco_context_json": cco_context_json_str, "current_critique_focus": current_critique_focus_str, "output_format_guidance": "Return JSON string of adaptive rules object: {'rules': [...]}."}, continuation_hint="engine._mro_continue_after_critique_rules(llm_cognitive_result)")

    def fn_analysis_critique_content_v3(self, content_to_critique_json_str, critique_criteria_json_str, context_json_str, adaptive_rules_json_str):
        self.aios_log(self.current_context_mh, "MRO: Requesting LLM for fn_analysis_critique_content_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_MRO_CRITIQUE_CONTENT", cognitive_task_details={"content_to_critique_json": content_to_critique_json_str, "critique_criteria_json": critique_criteria_json_str, "context_json": context_json_str, "adaptive_rules_json": adaptive_rules_json_str, "output_format_guidance": "Return JSON string of quality report object."}, continuation_hint="engine._mro_continue_after_critique_content(llm_cognitive_result)")

    def fn_utility_validate_data_against_schema_v3(self, data_object_json_str, schema_name_str):
        self.aios_log(self.current_context_mh, f"MRO: Requesting LLM for fn_utility_validate_data_against_schema_v3. Schema: {schema_name_str}")
        return self._create_llm_request(task_type="COGNITIVE_TASK_MRO_VALIDATE_SCHEMA", cognitive_task_details={"data_object_json": data_object_json_str, "schema_name": schema_name_str, "output_format_guidance": "Return JSON string of validation result object: {'is_valid':true/false, 'errors':'...'}"}, continuation_hint="engine._mro_continue_after_validation(llm_cognitive_result)")

    def fn_analysis_synthesize_critique_v3(self, raw_critique_reports_json_array_str, synthesis_goals_json_str):
        self.aios_log(self.current_context_mh, "MRO: Requesting LLM for fn_analysis_synthesize_critique_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_MRO_SYNTHESIZE_CRITIQUE", cognitive_task_details={"raw_critique_reports_json_array": raw_critique_reports_json_array_str, "synthesis_goals_json": synthesis_goals_json_str, "output_format_guidance": "Return JSON string of synthesized critique summary object: {'meets_all_thresholds': true/false, 'actionable_issues_count': N, ...}"}, continuation_hint="engine._mro_continue_after_synthesize_critique(llm_cognitive_result)")

    def fn_content_suggest_revisions_v3(self, current_content_json_str, synthesized_critique_json_str, context_json_str):
        self.aios_log(self.current_context_mh, "MRO: Requesting LLM for fn_content_suggest_revisions_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_MRO_SUGGEST_REVISIONS", cognitive_task_details={"current_content_json": current_content_json_str, "synthesized_critique_json": synthesized_critique_json_str, "context_json": context_json_str, "output_format_guidance": "Return JSON string of revision suggestions object: {'has_actionable_suggestions': true/false, 'suggestions_list':[]}"}, continuation_hint="engine._mro_continue_after_suggest_revisions(llm_cognitive_result)")

    def fn_content_apply_revisions_v3(self, current_content_json_str, revision_instructions_json_str, context_json_str):
        self.aios_log(self.current_context_mh, "MRO: Requesting LLM for fn_content_apply_revisions_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_MRO_APPLY_REVISIONS", cognitive_task_details={"current_content_json": current_content_json_str, "revision_instructions_json": revision_instructions_json_str, "context_json": context_json_str, "output_format_guidance": "Return JSON string of revised content object."}, continuation_hint="engine._mro_continue_after_apply_revisions(llm_cognitive_result)")

    def fn_analysis_compare_content_versions_v3(self, content_v1_json_str, content_v2_json_str, comparison_thresholds_json_str):
        self.aios_log(self.current_context_mh, "MRO: Requesting LLM for fn_analysis_compare_content_versions_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_MRO_COMPARE_VERSIONS", cognitive_task_details={"content_version1_json": content_v1_json_str, "content_version2_json": content_v2_json_str, "comparison_thresholds_json": comparison_thresholds_json_str, "output_format_guidance": "Return JSON string of comparison result object: {'is_significant_change':true/false, ...}"}, continuation_hint="engine._mro_continue_after_compare_versions(llm_cognitive_result)")

    def fn_fel_calculate_next_engine_version_v3(self, current_engine_representation_str):
        self.aios_log(self.current_context_mh, "FEL-MH: Requesting LLM for fn_fel_calculate_next_engine_version_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_FEL_CALC_VERSION", cognitive_task_details={"current_engine_representation": current_engine_representation_str, "output_format_guidance": "Return JSON object: {'next_version_string': 'x.y.z', 'status':'Success'}"}, continuation_hint="engine.run_mh_fel_step4_process_version(llm_cognitive_result)")

    def fn_fel_load_tids_v3(self, tid_source_description_obj):
        self.aios_log(self.current_context_mh, "FEL-MH: Requesting LLM for fn_fel_load_tids_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_FEL_LOAD_TIDS", cognitive_task_details={"tid_source_description": tid_source_description_obj, "output_format_guidance": "Return JSON object: {'tids_loaded': [TID_object_1, ...], 'status':'Success'}"}, continuation_hint="engine.run_mh_fel_step3_process_tids(llm_cognitive_result)")

    def fn_fel_apply_tids_to_engine_model_v3(self, engine_model_obj, tids_list_obj):
        self.aios_log(self.current_context_mh, "FEL-MH: Requesting LLM for fn_analysis_apply_tids_to_engine_model_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_FEL_APPLY_TIDS", cognitive_task_details={"current_engine_model": engine_model_obj, "tids_to_apply": tids_list_obj, "output_format_guidance": "Return JSON object: {'evolved_engine_model': {...}, 'application_log': '...', 'status':'Success'}"}, continuation_hint="engine.run_mh_fel_step5_process_applied_tids(llm_cognitive_result)")
    
    # --- Kernel Methods ---
    def start_engine(self, initial_state_json_string=None): # Modified to accept optional initial state
        if initial_state_json_string:
            # If initial state is provided, import it. This bypasses the usual "first run" prompts.
            # This path assumes the orchestrator knows the engine should resume.
            self.import_state(initial_state_json_string)
            self.aios_log("Kernel", f"start_engine: Resumed from provided state. Current MH: {self.Kernel_CurrentMH_ID}")
            # Decide what to do next - e.g., re-issue last LLM request or run current MH if it was mid-process
            # For now, let's assume if state is loaded, we might need to re-issue a prompt or continue an MH.
            # This part needs more sophisticated logic based on what "resuming" means.
            # As a simple start, if there's a current MH, try to run it.
            if self.Kernel_CurrentMH_ID and self.Kernel_CurrentMH_ID != "AWAIT_USER_INPUT":
                return self.kernel_run_current_mh()
            else: # Or fall back to presenting options if no clear continuation point from state.
                 self.aios_log("Kernel", "start_engine: Resumed state, but no active MH. Presenting initial options.")
                 return self.kernel_present_initial_options()

        # Original start_engine logic for a fresh session
        self.aios_log("Kernel", "start_engine sequence: Invoked for new session.") 
        self.current_context_mh = "Kernel"; self.aios_log(self.current_context_mh, f"{self.engine_version_full} - Kernel starting sequence.") 
        self.aios_log("Kernel", "start_engine sequence: Presenting initializing status message.") 
        self.PresentUserMessage_v3_0("Status", f"{self.engine_version_full} Initializing. Ready to present options.")
        self.aios_log("Kernel", "start_engine sequence: Presenting initial options to user.") 
        result = self.kernel_present_initial_options()
        self.aios_log("Kernel", "start_engine sequence: Completed, LLM request for initial options generated.") 
        return result
            
    def kernel_present_initial_options(self):
        self.current_context_mh = "Kernel"; self.aios_log(self.current_context_mh, "Kernel: Presenting initial options.")
        options_list_cnl = [{"value": "New Process", "label": "1. New Process (Full Flow)"}, {"value": "Evolve Engine", "label": "2. Evolve AIOS Engine (FEL-MH)"}, {"value": "Terminate AIOS", "label": "3. Terminate AIOS"}]
        return self.fn_interaction_present_options_v3(prompt_message_to_user=f"AIOS Engine v{self.engine_version_short} Ready. How would you like to begin?", options_list_cnl=options_list_cnl)

    def kernel_process_initial_choice_result(self, llm_interaction_result_obj):
        self.current_context_mh = "Kernel"
        if not llm_interaction_result_obj or not isinstance(llm_interaction_result_obj, dict) or llm_interaction_result_obj.get("status") != "USER_COMMAND":
            self.aios_log(self.current_context_mh, "Invalid result from options. Re-prompting."); self.PresentUserMessage_v3_0("Warning", "Could not process selection."); return self.kernel_present_initial_options()
        command_value = llm_interaction_result_obj.get("command"); self.aios_log(self.current_context_mh, f"Processing initial choice: '{command_value}'")
        interp_result = self.fn_interpret_user_directive_for_next_mh_v3(command_value)
        self.Kernel_CurrentMH_ID = interp_result.get("next_mh_id"); self.Kernel_MH_Inputs_JsonString = interp_result.get("next_mh_inputs_json")
        if self.Kernel_CurrentMH_ID == "TERMINATE_AIOS": self.PresentUserMessage_v3_0("Status", "AIOS termination initiated."); return {"status": "TERMINATION_REQUESTED", "final_engine_state": self._get_engine_state_snapshot()}
        elif self.Kernel_CurrentMH_ID and self.Kernel_CurrentMH_ID != "AWAIT_USER_INPUT": self.aios_log(self.current_context_mh, f"Kernel: Next MH: {self.Kernel_CurrentMH_ID}"); return self.kernel_run_current_mh()
        else: self.PresentUserMessage_v3_0("Warning", interp_result.get("user_prompt_message", f"Unrecognized choice: '{command_value}'.")); return self.kernel_present_initial_options()

    def kernel_run_current_mh(self):
        self.current_context_mh = "Kernel"
        if self.Kernel_CurrentMH_ID == "TERMINATE_AIOS": self.PresentUserMessage_v3_0("Status", "AIOS terminated."); return {"status": "TERMINATED", "final_engine_state": self._get_engine_state_snapshot()}
        elif self.Kernel_CurrentMH_ID == "AWAIT_USER_INPUT" or not self.Kernel_CurrentMH_ID : self.aios_log(self.current_context_mh, "Kernel paused."); return self._create_llm_request(task_type="USER_INPUT_REQUIRED_GENERAL_DIRECTIVE", prompt_to_user="AIOS Engine paused. What next?", expected_input_description="User's command.", continuation_hint="engine.kernel_process_general_user_directive(llm_interaction_result_obj)")
        self.aios_log(self.current_context_mh, f"Kernel: Executing MH: {self.Kernel_CurrentMH_ID}"); self.PresentUserMessage_v3_0("Status", f"Executing MH: {self.Kernel_CurrentMH_ID}")
        mh_inputs_obj = self.ParseJsonToCNLObject(self.Kernel_MH_Inputs_JsonString)
        if self.Kernel_CurrentMH_ID == "IFE-MH": return self.run_mh_ife_step1_get_core_idea(mh_inputs_obj)
        elif self.Kernel_CurrentMH_ID == "PDF-MH": return self.run_mh_pdf_step1_initialize(mh_inputs_obj)
        elif self.Kernel_CurrentMH_ID == "PLAN-MH": return self.run_mh_plan_step1_initialize(mh_inputs_obj)
        elif self.Kernel_CurrentMH_ID == "TDE-MH": return self.run_mh_tde_step1_initialize(mh_inputs_obj)
        elif self.Kernel_CurrentMH_ID == "CAG-MH_SIMPLIFIED_DRAFT": return self.run_mh_cag_simplified_draft_step1_prepare(mh_inputs_obj)
        elif self.Kernel_CurrentMH_ID == "SEL-MH": return self.run_mh_sel_step1_initialize(mh_inputs_obj)
        elif self.Kernel_CurrentMH_ID == "KAU-MH": return self.run_mh_kau_step1_initialize(mh_inputs_obj)
        elif self.Kernel_CurrentMH_ID == "FEL-MH": return self.run_mh_fel_step1_initialize_evolution(mh_inputs_obj)
        else: self.aios_log(self.current_context_mh, f"Error: MH '{self.Kernel_CurrentMH_ID}' not implemented."); self.PresentUserMessage_v3_0("Error", f"MH '{self.Kernel_CurrentMH_ID}' not available."); self.Kernel_CurrentMH_ID = "AWAIT_USER_INPUT"; return self.kernel_run_current_mh()

    def kernel_process_mh_result(self, mh_that_just_ran_id, mh_result_obj_from_mh_step):
        self.current_context_mh = "Kernel"; status = mh_result_obj_from_mh_step.get("status"); self.aios_log(self.current_context_mh, f"Processing result from '{mh_that_just_ran_id}'. Status: '{status}'")
        if not mh_result_obj_from_mh_step or not isinstance(mh_result_obj_from_mh_step, dict):
            self.PresentUserMessage_v3_0("Error", f"Invalid result from '{mh_that_just_ran_id}'."); self.Kernel_CurrentMH_ID = "AWAIT_USER_INPUT"; return self.kernel_run_current_mh()
        if status == "MRO_PIPELINE_COMPLETE_RETURN_TO_CALLER":
            self.aios_log(self.current_context_mh, f"MRO pipeline completed. Returning control to {mh_result_obj_from_mh_step.get('caller_mh_context')} at {mh_result_obj_from_mh_step.get('caller_continuation_hint')}")
            continuation_method_name = mh_result_obj_from_mh_step.get('caller_continuation_hint')
            if continuation_method_name and hasattr(self, continuation_method_name.split('.')[-1]):
                 method_to_call = getattr(self, continuation_method_name.split('.')[-1])
                 return method_to_call(mh_result_obj_from_mh_step)
            else:
                self.aios_log(self.current_context_mh, f"Error: MRO continuation hint '{continuation_method_name}' not found or invalid.")
                self.Kernel_CurrentMH_ID = "AWAIT_USER_INPUT"; return self.kernel_run_current_mh()
        if "updated_cco_json" in mh_result_obj_from_mh_step: self.Kernel_ActiveCCO_JsonString = mh_result_obj_from_mh_step["updated_cco_json"]; self.CCO_data = self.ParseJsonToCNLObject(self.Kernel_ActiveCCO_JsonString); self.aios_log(self.current_context_mh, f"CCO updated by '{mh_that_just_ran_id}'.")
        elif self.CCO_data is not None : self.Kernel_ActiveCCO_JsonString = self.ConvertCNLObjectToJson(self.CCO_data)
        if status == "AWAITING_LLM_ORCHESTRATION": self.aios_log(self.current_context_mh, f"'{mh_that_just_ran_id}' awaits LLM for: {mh_result_obj_from_mh_step.get('request_details',{}).get('task_type')}"); return mh_result_obj_from_mh_step
        log_details = mh_result_obj_from_mh_step.get("details_for_log")
        if self.CCO_data is None: 
            self.CCO_data = {"operational_log_cco_json":"[]", "cco_id": f"kernel_cco_{uuid.uuid4().hex[:8]}"}
            self.Kernel_ActiveCCO_JsonString = self.ConvertCNLObjectToJson(self.CCO_data)
            self.aios_log(self.current_context_mh, "Initialized minimal CCO for logging MH_Completion.")
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "MH_Completion", f"{mh_that_just_ran_id} status: {status}.", log_details)
        if "Error" in status or "Failed" in status: self.PresentUserMessage_v3_0("Error", f"MH {mh_that_just_ran_id} issue: {status}.")
        else: self.PresentUserMessage_v3_0("Status", f"{mh_that_just_ran_id} completed with status: {status}.")
        next_mh = "AWAIT_USER_INPUT"; next_inputs = {}
        if mh_that_just_ran_id == "IFE-MH" and "Complete" in status: next_mh = "PDF-MH"
        elif mh_that_just_ran_id == "PDF-MH" and "Complete" in status: next_mh = "PLAN-MH"
        elif mh_that_just_ran_id == "PLAN-MH" and "Complete" in status: next_mh = "TDE-MH"
        elif mh_that_just_ran_id == "TDE-MH" and "AllTasksComplete" in status : next_mh = "KAU-MH"
        elif mh_that_just_ran_id == "CAG-MH_SIMPLIFIED_DRAFT" and "UserReview" in status: next_mh = "AWAIT_USER_INPUT"
        elif mh_that_just_ran_id == "SEL-MH" and "Complete" in status: next_mh = "KAU-MH"
        elif mh_that_just_ran_id == "KAU-MH" and "Complete" in status: next_mh = "AWAIT_USER_INPUT" 
        elif mh_that_just_ran_id == "FEL-MH" and "FEL_EvolutionProposed_Complete" in status: next_mh = "TERMINATE_AIOS" 
        self.Kernel_CurrentMH_ID = next_mh; self.Kernel_MH_Inputs_JsonString = self.ConvertCNLObjectToJson(next_inputs)
        if "Complete" in status and next_mh != "TERMINATE_AIOS" and self.CCO_data:
            self.PresentUserMessage_v3_0("Suggestion", "Significant work completed. Consider saving CCO state. (Orchestrator/User action)")
        return self.kernel_run_current_mh()

    def kernel_process_general_user_directive(self, llm_interaction_result_obj):
        self.current_context_mh = "Kernel"; user_directive_text = llm_interaction_result_obj.get("command", ""); self.aios_log(self.current_context_mh, f"Processing general directive: '{user_directive_text}'")
        interp_result_obj = self.fn_interpret_user_directive_for_next_mh_v3(user_directive_text)
        self.Kernel_CurrentMH_ID = interp_result_obj.get("next_mh_id", "AWAIT_USER_INPUT"); self.Kernel_MH_Inputs_JsonString = interp_result_obj.get("next_mh_inputs_json", "{}")
        if self.Kernel_CurrentMH_ID == "AWAIT_USER_INPUT" and interp_result_obj.get("user_prompt_message"): return self._create_llm_request(task_type="USER_INPUT_REQUIRED_GENERAL_DIRECTIVE", prompt_to_user=interp_result_obj.get("user_prompt_message"), continuation_hint="engine.kernel_process_general_user_directive(llm_interaction_result_obj)" )
        return self.kernel_run_current_mh()

    # --- IFE-MH Steps ---
    def run_mh_ife_step1_get_core_idea(self, mh_inputs_obj):
        self.current_context_mh = "IFE-MH"; self.aios_log(self.current_context_mh, f"IFE-MH (v{self.engine_version_short}) Step 1: Initiated."); self.PresentUserMessage_v3_0("Status", f"IFE-MH (v{self.engine_version_short}): Starting Idea Formulation & Exploration...")
        self._ife_s = {"UserPromptText_from_kernel": mh_inputs_obj.get("user_initial_prompt_text") if mh_inputs_obj else None, "CCO_JsonString_from_kernel": mh_inputs_obj.get("existing_cco_json_if_reexploring") if mh_inputs_obj else self.Kernel_ActiveCCO_JsonString}
        if self._ife_s["CCO_JsonString_from_kernel"]: self.CCO_data = self.ParseJsonToCNLObject(self._ife_s["CCO_JsonString_from_kernel"])
        else: self.CCO_data = None
        if self._ife_s["UserPromptText_from_kernel"]: self.aios_log(self.current_context_mh, "Core idea from Kernel."); llm_like_result = {"status":"USER_COMMAND", "command":self._ife_s["UserPromptText_from_kernel"], "user_text": self._ife_s["UserPromptText_from_kernel"]}; return self.run_mh_ife_step2_process_core_idea(llm_like_result)
        else: self.aios_log(self.current_context_mh, "Eliciting core idea."); return self.fn_interaction_elicit_user_input_v3(prompt_message_to_user="What is the core idea or problem for this new AIOS process?")

    def run_mh_ife_step2_process_core_idea(self, llm_interaction_result_obj):
        self.current_context_mh = "IFE-MH"; user_provided_text = llm_interaction_result_obj.get("command")
        self.aios_log(self.current_context_mh, f"IFE-MH Step 2: Core idea: '{user_provided_text}'")
        if not user_provided_text: self.PresentUserMessage_v3_0("Error", "IFE-MH: No core idea provided."); return self.kernel_process_mh_result("IFE-MH", {"status": "IFE_Failed_NoCoreIdeaProvided", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        self._ife_s["user_provided_core_idea"] = user_provided_text
        if self.CCO_data is None:
            self.aios_log(self.current_context_mh, "IFE-MH: Initializing new CCO."); id_result_obj = self.fn_utility_generate_unique_id_v3(id_prefix="aios_cco_"); new_cco_id = id_result_obj.get("unique_id", f"fallback_cco_{uuid.uuid4().hex[:8]}")
            prompt_summary = self._ife_s["user_provided_core_idea"];
            if len(prompt_summary) > 50: prompt_summary = prompt_summary[:47] + "..."
            self.CCO_data = {"cco_id": new_cco_id, "parent_cco_id": None, "metadata_internal_cco": {"name_label": f"AIOS CCO for: {prompt_summary}", "current_form": "Initial Idea Exploration (IFE)", "schema_version_used": f"AIOS_CCO_Schema_v3_0 (Engine v{self.engine_version_short})", "engine_version_context": self.engine_version_full, "user_provided_creation_date_context": self._get_timestamp(), "tags_keywords": [kw.strip() for kw in self._ife_s["user_provided_core_idea"].split(" ")[:3] if kw.strip()], "current_phase_id": "IFE_Active", "phase_history_json": self.ConvertCNLObjectToJson([])}, "core_essence_json": self.ConvertCNLObjectToJson(None), "initiating_document_scaled_json": self.ConvertCNLObjectToJson({"user_prompt": self._ife_s["user_provided_core_idea"]}), "knowledge_artifacts_contextual_json": self.ConvertCNLObjectToJson({"conceptual_anchors_cco": []}), "operational_log_cco_json": self.ConvertCNLObjectToJson([]), "plan_structured_json": self.ConvertCNLObjectToJson(None), "product_content_data_json": self.ConvertCNLObjectToJson(None), "execution_log_detailed_json": self.ConvertCNLObjectToJson(None), "associated_data_json": self.ConvertCNLObjectToJson(None), "open_seeds_exploration_json": self.ConvertCNLObjectToJson(None)}
            self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "IFE_MH_Event", "New CCO initialized.", {"new_cco_id": new_cco_id}); self.PresentUserMessage_v3_0("Info", f"IFE-MH: New CCO {new_cco_id} created.")
        else: self.aios_log(self.current_context_mh, f"IFE-MH: Using existing CCO: {self.CCO_data.get('cco_id', 'N/A')}"); self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "IFE_MH_Event", f"Processing idea: '{self._ife_s['user_provided_core_idea']}'", {"prompt": self._ife_s['user_provided_core_idea']})
        self.Kernel_ActiveCCO_JsonString = self.ConvertCNLObjectToJson(self.CCO_data)
        self.aios_log(self.current_context_mh, "IFE-MH Step 2b: Requesting LLM to draft core essence."); draft_context_obj = {"user_provided_idea_text": self._ife_s["user_provided_core_idea"], "cco_id": self.CCO_data.get("cco_id"), "current_phase_id": self.CCO_data.get("metadata_internal_cco",{}).get("current_phase_id"), "engine_guidance": f"Focus on transformative potential. Adhere to AIOS v{self.engine_version_short} principles."}; draft_instructions = ("Based on the user's idea, draft a 'core_essence_text' (1-3 impactful sentences). Format output as JSON: {\"core_essence_text\": \"<your_drafted_essence_string>\", \"status\": \"DraftComplete\"}")
        return self.fn_content_draft_text_segment_v3(instructions=draft_instructions, context_obj=draft_context_obj, desired_length_hint="1-3 sentences, impactful", rhetorical_goal_hint="summarize_inspire_define_core_essence", output_key_name="core_essence_text")

    def run_mh_ife_step3_process_essence_draft(self, llm_cognitive_result):
        self.current_context_mh = "IFE-MH"; self.aios_log(self.current_context_mh, f"IFE-MH Step 3: Received LLM draft for core essence.")
        if not llm_cognitive_result or llm_cognitive_result.get("status") != "DraftComplete" or not llm_cognitive_result.get("core_essence_text"): self.PresentUserMessage_v3_0("Error", "IFE-MH: Failed to get valid core essence draft. Using placeholder."); llm_cognitive_result = {"core_essence_text": "Placeholder essence due to drafting error.", "status":"ErrorFallback_Draft"}
        self._ife_s["drafted_essence_json_str_for_mro"] = self.ConvertCNLObjectToJson(llm_cognitive_result)
        self.aios_log(self.current_context_mh, "IFE-MH Step 3a: Requesting LLM to refine core essence (MRO).");
        refinement_goals_obj = {"quality_criteria_json": self.ConvertCNLObjectToJson({f"AIOS_v{self.engine_version_short}_TransformativeValueNoveltyFocus": True, f"AIOS_v{self.engine_version_short}_InformationDensityConcisenessFocus": True, "ClarityAndImpact": True, "TargetProductForm": "Core Essence for CCO"}), "critique_focus_hint": "Maximize Transformative Value of the 'core_essence_text'.", "requires_schema_validation": False}
        return self.fn_mro_RefineOutput_Pipeline_v3_0(draft_content_json_str=self._ife_s["drafted_essence_json_str_for_mro"], refinement_goals_obj=refinement_goals_obj, cco_context_json_str=self.ConvertCNLObjectToJson(self.CCO_data), caller_mh_context="IFE-MH", caller_continuation_hint="engine.run_mh_ife_step4_finalize_essence")

    def run_mh_ife_step4_finalize_essence(self, mro_pipeline_result_obj):
        self.current_context_mh = "IFE-MH";
        mro_result = mro_pipeline_result_obj.get("mro_result", {})
        self.aios_log(self.current_context_mh, f"IFE-MH Step 4: Received MRO result for core essence. MRO Status: {mro_result.get('status')}")
        if not mro_result or mro_result.get("status") not in ["Success_Converged", "Success_MaxIterationsReached"] or not mro_result.get("refined_output_json"): self.PresentUserMessage_v3_0("Warning", "IFE-MH: MRO did not successfully refine. Using pre-MRO draft."); self._ife_s["refined_essence_json_str_for_cco"] = mro_result.get("refined_output_json", self._ife_s.get("drafted_essence_json_str_for_mro", self.ConvertCNLObjectToJson({"core_essence_text":"Error in MRO."})))
        else: self._ife_s["refined_essence_json_str_for_cco"] = mro_result.get("refined_output_json")
        self.CCO_data = self.fn_data_update_cco_section_v3(self.CCO_data, "core_essence_json", self._ife_s["refined_essence_json_str_for_cco"]); self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "IFE_MH_Event", f"Core essence finalized. MRO Status: {mro_result.get('status', 'N/A')}", self.ParseJsonToCNLObject(self._ife_s["refined_essence_json_str_for_cco"]))
        self.aios_log(self.current_context_mh, "IFE-MH Concluded successfully."); self.PresentUserMessage_v3_0("Status", "IFE-MH: Idea Exploration complete. Core essence in CCO.")
        final_ife_result_to_kernel = {"status": "IFE_ExplorationComplete_ReadyForNext", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data), "details_for_log": {"summary": f"IFE-MH finished for CCO ID: {self.CCO_data.get('cco_id') if self.CCO_data else 'N/A'}."}}
        return self.kernel_process_mh_result("IFE-MH", final_ife_result_to_kernel)

    # --- MRO_Orchestrator_v3_0 (MetaRefineOutput) Steps ---
    def run_mro_pipeline_step1_initialize(self, DraftOutput_JsonString, CCOContext_JsonString, RefinementGoals_JsonString, caller_mh_context, caller_continuation_hint, MaxIterations_Integer=3, IsFrameworkComponent_Boolean=False, PreviousDraftOutput_JsonString_Optional=None):
        self.current_context_mh = "MRO_Orchestrator"; self.aios_log(self.current_context_mh, "MRO Pipeline: Initializing."); self.PresentUserMessage_v3_0("Status", "MRO: Initiating content refinement pipeline...")
        self._mro_s = {"OriginalDraft_JsonString": DraftOutput_JsonString, "CurrentDraft_JsonString": DraftOutput_JsonString, "PreviousDraft_JsonString": PreviousDraftOutput_JsonString_Optional, "CCOContext_JsonString": CCOContext_JsonString, "RefinementGoals_JsonString": RefinementGoals_JsonString, "ParsedRefinementGoals": self.ParseJsonToCNLObject(RefinementGoals_JsonString), "MaxIterations": MaxIterations_Integer, "IsFrameworkComponent": IsFrameworkComponent_Boolean, "CurrentIteration": 0, "RefinementLog": [], "ConvergenceMet": False, "caller_mh_context": caller_mh_context, "caller_continuation_hint": caller_continuation_hint}
        self._mro_s["RefinementLog"].append(f"{self._get_timestamp()} - MRO Initialized. MaxIter: {self._mro_s['MaxIterations']}. Caller: {caller_mh_context}")
        return self._mro_loop_step()

    def _mro_loop_step(self):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s
        if s["CurrentIteration"] >= s["MaxIterations"] or s["ConvergenceMet"]: return self._mro_finalize()
        s["CurrentIteration"] += 1; log_msg = f"--- MRO Iteration: {s['CurrentIteration']}/{s['MaxIterations']} ---"; s["RefinementLog"].append(f"{self._get_timestamp()} - {log_msg}"); self.aios_log(self.current_context_mh, log_msg); self.PresentUserMessage_v3_0("Status", f"MRO Iteration: {s['CurrentIteration']}/{s['MaxIterations']}")
        critique_focus = s["ParsedRefinementGoals"].get("critique_focus_hint", "general_quality")
        return self.fn_query_adaptive_critique_rules_v3(s["CCOContext_JsonString"], critique_focus)

    def _mro_continue_after_critique_rules(self, llm_cognitive_result):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s; s["RefinementLog"].append(f"{self._get_timestamp()} - Adaptive Critique Rules. Status: {llm_cognitive_result.get('status')}"); adaptive_rules_json_str = llm_cognitive_result.get("adaptive_rules_json_string", "{}")
        return self.fn_analysis_critique_content_v3(s["CurrentDraft_JsonString"], s["ParsedRefinementGoals"].get("quality_criteria_json"), s["CCOContext_JsonString"], adaptive_rules_json_str)

    def _mro_continue_after_critique_content(self, llm_cognitive_result):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s; s["RefinementLog"].append(f"{self._get_timestamp()} - Quality Assessment. Status: {llm_cognitive_result.get('status')}"); quality_report_json_str = llm_cognitive_result.get("quality_report_json_string", "{}"); s["_current_quality_report_json_str"] = quality_report_json_str
        if s["IsFrameworkComponent"] or s["ParsedRefinementGoals"].get("requires_schema_validation"): schema_name = s["ParsedRefinementGoals"].get("target_schema_name", "UNKNOWN_SCHEMA"); s["RefinementLog"].append(f"{self._get_timestamp()} - Schema Validation Required for: {schema_name}"); return self.fn_utility_validate_data_against_schema_v3(s["CurrentDraft_JsonString"], schema_name)
        else: s["RefinementLog"].append(f"{self._get_timestamp()} - Schema Validation Skipped."); return self._mro_continue_after_validation(None)

    def _mro_continue_after_validation(self, llm_cognitive_result_or_none):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s
        if llm_cognitive_result_or_none and isinstance(llm_cognitive_result_or_none, dict):
            s["RefinementLog"].append(f"{self._get_timestamp()} - Schema Validation. Status: {llm_cognitive_result_or_none.get('status')}"); s["_current_validation_result_json_str"] = llm_cognitive_result_or_none.get("validation_result_json_string", self.ConvertCNLObjectToJson({"is_valid":False, "errors":"Validation function error"}))
        else:
            s["RefinementLog"].append(f"{self._get_timestamp()} - Schema Validation Skipped or no result."); s["_current_validation_result_json_str"] = "null"
        critique_reports_list = [s["_current_quality_report_json_str"]];
        if s["_current_validation_result_json_str"] != "null": critique_reports_list.append(s["_current_validation_result_json_str"])
        raw_critique_reports_json_array_str = self.ConvertCNLObjectToJson(critique_reports_list)
        return self.fn_analysis_synthesize_critique_v3(raw_critique_reports_json_array_str, s["RefinementGoals_JsonString"])

    def _mro_continue_after_synthesize_critique(self, llm_cognitive_result):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s; s["RefinementLog"].append(f"{self._get_timestamp()} - Critique Synthesis. Status: {llm_cognitive_result.get('status')}"); synthesized_critique_json_str = llm_cognitive_result.get("synthesized_critique_json_string", "{}"); s["_current_synthesized_critique_json_str"] = synthesized_critique_json_str
        critique_summary_obj = self.ParseJsonToCNLObject(synthesized_critique_json_str)
        if critique_summary_obj and critique_summary_obj.get("meets_all_thresholds") and critique_summary_obj.get("actionable_issues_count", 1) == 0: s["ConvergenceMet"] = True; s["RefinementLog"].append(f"{self._get_timestamp()} - Convergence by critique summary."); self.PresentUserMessage_v3_0("Status", "MRO: Convergence by critique."); return self._mro_loop_step()
        return self.fn_content_suggest_revisions_v3(s["CurrentDraft_JsonString"], s["_current_synthesized_critique_json_str"], s["CCOContext_JsonString"])

    def _mro_continue_after_suggest_revisions(self, llm_cognitive_result):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s; s["RefinementLog"].append(f"{self._get_timestamp()} - Revision Suggestions. Status: {llm_cognitive_result.get('status')}"); revision_suggestions_json_str = llm_cognitive_result.get("revision_suggestions_json_string", "{}"); s["_current_revision_suggestions_json_str"] = revision_suggestions_json_str
        suggestions_obj = self.ParseJsonToCNLObject(revision_suggestions_json_str)
        if suggestions_obj and suggestions_obj.get("has_actionable_suggestions"): return self.fn_content_apply_revisions_v3(s["CurrentDraft_JsonString"], s["_current_revision_suggestions_json_str"], s["CCOContext_JsonString"])
        else: s["RefinementLog"].append(f"{self._get_timestamp()} - No actionable suggestions. Convergence."); s["ConvergenceMet"] = True; return self._mro_loop_step()

    def _mro_continue_after_apply_revisions(self, llm_cognitive_result):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s; s["RefinementLog"].append(f"{self._get_timestamp()} - Revisions Applied. Status: {llm_cognitive_result.get('status')}"); revised_draft_json_str = llm_cognitive_result.get("revised_content_json_string", s["CurrentDraft_JsonString"]); s["_candidate_next_draft_json_str"] = revised_draft_json_str
        convergence_thresholds_json_str = self.ConvertCNLObjectToJson(s["ParsedRefinementGoals"].get("convergence_thresholds_json", {}))
        return self.fn_analysis_compare_content_versions_v3(s["CurrentDraft_JsonString"], s["_candidate_next_draft_json_str"], convergence_thresholds_json_str)

    def _mro_continue_after_compare_versions(self, llm_cognitive_result):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s; s["RefinementLog"].append(f"{self._get_timestamp()} - Version Comparison. Status: {llm_cognitive_result.get('status')}"); comparison_obj = self.ParseJsonToCNLObject(llm_cognitive_result.get("comparison_result_json_string", "{}"))
        if comparison_obj and comparison_obj.get("is_significant_change"): s["PreviousDraft_JsonString"] = s["CurrentDraft_JsonString"]; s["CurrentDraft_JsonString"] = s["_candidate_next_draft_json_str"]; s["RefinementLog"].append(f"{self._get_timestamp()} - Significant change applied.")
        else: s["RefinementLog"].append(f"{self._get_timestamp()} - No significant change. Convergence."); s["ConvergenceMet"] = True
        return self._mro_loop_step()

    def _mro_finalize(self):
        self.current_context_mh = "MRO_Orchestrator"; s = self._mro_s; final_status_str = "Success_Converged" if s["ConvergenceMet"] else "Success_MaxIterationsReached"; self.aios_log(self.current_context_mh, f"MRO Pipeline complete. Status: {final_status_str}"); self.PresentUserMessage_v3_0("Result", {"message": "MRO Pipeline completed.", "status": final_status_str})
        mro_final_result_obj = {"refined_output_json": s["CurrentDraft_JsonString"], "refinement_summary_json": self.ConvertCNLObjectToJson(s["RefinementLog"]), "status": final_status_str }
        return {"status": "MRO_PIPELINE_COMPLETE_RETURN_TO_CALLER", "mro_result": mro_final_result_obj, "caller_mh_context": s.get("caller_mh_context"), "caller_continuation_hint": s.get("caller_continuation_hint"), "current_engine_state_snapshot": self._get_engine_state_snapshot()}

    # --- Simplified CAG-MH Steps ---
    def run_mh_cag_simplified_draft_step1_prepare(self, mh_inputs_obj):
        self.current_context_mh = "CAG-MH_SIMPLIFIED_DRAFT"; self.aios_log(self.current_context_mh, "CAG-MH Step 1: Initiated."); self.PresentUserMessage_v3_0("Status", f"CAG-MH (v{self.engine_version_short}): Starting simplified content drafting...")
        cco_json_str_from_input = mh_inputs_obj.get("current_cco_json", self.Kernel_ActiveCCO_JsonString); self.CCO_data = self.ParseJsonToCNLObject(cco_json_str_from_input)
        if not self.CCO_data or not self.ParseJsonToCNLObject(self.CCO_data.get("core_essence_json")): self.PresentUserMessage_v3_0("Error", "CAG-MH: CCO or core_essence_json missing."); return self.kernel_process_mh_result("CAG-MH_SIMPLIFIED_DRAFT", {"status": "CAG_Error_MissingCoreEssence", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        core_essence_obj = self.ParseJsonToCNLObject(self.CCO_data.get("core_essence_json", "{}")); core_essence_text_for_prompt = core_essence_obj.get("core_essence_text", "The defined core idea.")
        self.PresentUserMessage_v3_0("Info", f"CAG-MH: Drafting section based on essence: '{core_essence_text_for_prompt}'")
        draft_context_obj = {"core_essence_statement": core_essence_text_for_prompt, "cco_id": self.CCO_data.get("cco_id"), "conceptual_anchors_from_cco": self.ParseJsonToCNLObject(self.CCO_data.get("knowledge_artifacts_contextual_json", "{}")).get("conceptual_anchors_cco", []), "target_document_part": "Introduction"}; draft_instructions = (f"Draft an introductory section based on core_essence_statement. Elaborate, outline key aspects, engage reader. Apply AIOS v{self.engine_version_short} principles (Transformative Value, Information Density). Integrate conceptual_anchors if relevant.")
        return self.fn_content_draft_text_segment_v3(instructions=draft_instructions, context_obj=draft_context_obj, desired_length_hint="1-2 detailed paragraphs", rhetorical_goal_hint="document_introduction_and_overview", output_key_name="section_draft_text" )

    def run_mh_cag_simplified_draft_step2_process_draft(self, llm_cognitive_result):
        self.current_context_mh = "CAG-MH_SIMPLIFIED_DRAFT"; self.aios_log(self.current_context_mh, f"CAG-MH Step 2: Received LLM draft.")
        if not llm_cognitive_result or llm_cognitive_result.get("status") != "DraftComplete" or not llm_cognitive_result.get("section_draft_text"): self.PresentUserMessage_v3_0("Error", "CAG-MH: Failed to get valid section draft."); llm_cognitive_result = {"section_draft_text":"Placeholder section.","status":"ErrorFallback_Draft"}
        text_for_mro_input = llm_cognitive_result.get("section_draft_text"); self._cag_s = {"draft_section_json_str_for_mro": self.ConvertCNLObjectToJson({"text_to_refine": text_for_mro_input})}
        self.aios_log(self.current_context_mh, "CAG-MH Step 2a: Requesting MRO refinement."); refinement_goals_obj = {"target_product_form_descriptor": "Introductory Document Section", "quality_criteria_json": self.ConvertCNLObjectToJson({f"AIOS_v{self.engine_version_short}_TransformativeValueNoveltyFocus": True, f"AIOS_v{self.engine_version_short}_InformationDensityEfficientComplexity": True, "ClarityAndEngagement": True, "LogicalFlow": True}), "critique_focus_hint": "Refine for compelling narrative and insight."}
        return self.fn_mro_RefineOutput_Pipeline_v3_0(draft_content_json_str=self._cag_s["draft_section_json_str_for_mro"], refinement_goals_obj=refinement_goals_obj, cco_context_json_str=self.ConvertCNLObjectToJson(self.CCO_data), caller_mh_context="CAG-MH_SIMPLIFIED_DRAFT", caller_continuation_hint="engine.run_mh_cag_simplified_draft_step3_finalize_draft")

    def run_mh_cag_simplified_draft_step3_finalize_draft(self, mro_pipeline_result_obj):
        self.current_context_mh = "CAG-MH_SIMPLIFIED_DRAFT";
        mro_result = mro_pipeline_result_obj.get("mro_result", {})
        self.aios_log(self.current_context_mh, f"CAG-MH Step 3: Received MRO result. MRO Status: {mro_result.get('status')}")
        if not mro_result or mro_result.get("status") not in ["Success_Converged", "Success_MaxIterationsReached"] or not mro_result.get("refined_output_json"): self.PresentUserMessage_v3_0("Warning", "CAG-MH: MRO did not successfully refine section."); refined_section_content_json_str = self._cag_s.get("draft_section_json_str_for_mro", self.ConvertCNLObjectToJson({"text_to_refine":"Error in MRO."}))
        else: refined_section_content_json_str = mro_result.get("refined_output_json")
        product_data_dict = self.ParseJsonToCNLObject(self.CCO_data.get("product_content_data_json", "{}"));
        if not isinstance(product_data_dict, dict): product_data_dict = {}
        if "document_sections" not in product_data_dict or not isinstance(product_data_dict["document_sections"], list): product_data_dict["document_sections"] = []
        new_section_entry_obj = {"section_title": "Introduction (Draft 1, Refined)", "content_details_json_str": refined_section_content_json_str, "mro_refinement_summary_json_str": mro_result.get("refinement_summary_json")}; product_data_dict["document_sections"].append(new_section_entry_obj)
        self.CCO_data = self.fn_data_update_cco_section_v3(self.CCO_data, "product_content_data_json", self.ConvertCNLObjectToJson(product_data_dict)); self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "CAG_MH_Event", "Intro section drafted & refined.", self.ParseJsonToCNLObject(refined_section_content_json_str))
        self.PresentUserMessage_v3_0("Status", "CAG-MH: Intro draft complete, refined, stored in CCO.")
        refined_text_obj = self.ParseJsonToCNLObject(refined_section_content_json_str); final_text_for_user = refined_text_obj.get("text_to_refine", "Error displaying draft.")
        self.PresentUserMessage_v3_0("DraftOutput_ForReview", {"section_title": "Draft Introduction (Refined)", "content_text": final_text_for_user, "notes": f"Processed by MRO for AIOS v{self.engine_version_short}."})
        return {"status": "CAG_DraftComplete_UserReview", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data), "details_for_log": {"summary": f"CAG draft for CCO ID '{self.CCO_data.get('cco_id') if self.CCO_data else 'N/A'}' complete."}}

    # --- PDF-MH (Problem Definition & Framing) ---
    def run_mh_pdf_step1_initialize(self, mh_inputs_obj):
        self.current_context_mh = "PDF-MH"; self._pdf_s = {}; self.aios_log(self.current_context_mh, "Initiated."); self.PresentUserMessage_v3_0("Status", "PDF-MH: Starting Problem Definition & Framing...")
        if not self.CCO_data or not self.ParseJsonToCNLObject(self.CCO_data.get("core_essence_json")): self.PresentUserMessage_v3_0("Error", "PDF-MH: CCO or core essence missing."); return self.kernel_process_mh_result("PDF-MH", {"status": "PDF_Error_MissingCCO", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        self._pdf_s["core_essence_obj"] = self.ParseJsonToCNLObject(self.CCO_data.get("core_essence_json"))
        self.PresentUserMessage_v3_0("Info", f"PDF-MH: Reviewing core essence: {self._pdf_s['core_essence_obj']}")
        return self.fn_interaction_elicit_user_input_v3(prompt_message_to_user="PDF-MH: Please provide any further details, constraints, or specific aspects of the problem/idea to focus on for definition.")

    def fn_analysis_decompose_problem_v3(self, problem_statement_text, cco_context_obj):
        self.aios_log(self.current_context_mh, "PDF-MH: Requesting LLM for fn_analysis_decompose_problem_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_PDF_DECOMPOSE_PROBLEM", cognitive_task_details={"problem_statement": problem_statement_text, "cco_context": cco_context_obj, "output_format_guidance": "Return JSON: {'decomposition_details':{...}}"}, continuation_hint="engine.run_mh_pdf_step3_process_decomposition(llm_cognitive_result)")

    def run_mh_pdf_step2_process_details(self, llm_interaction_result_obj):
        self.current_context_mh = "PDF-MH"; user_details = llm_interaction_result_obj.get("command"); self._pdf_s["user_provided_details"] = user_details
        self.aios_log(self.current_context_mh, f"Received further problem details: {user_details}")
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "PDF_MH_Input", "User provided further details for problem definition.", {"details": user_details})
        problem_statement_for_analysis = f"Core Idea: {self._pdf_s['core_essence_obj'].get('core_essence_text','')}\nUser Details: {user_details}"
        return self.fn_analysis_decompose_problem_v3(problem_statement_for_analysis, self.CCO_data)

    def run_mh_pdf_step3_process_decomposition(self, llm_cognitive_result):
        self.current_context_mh = "PDF-MH"; self.aios_log(self.current_context_mh, f"Received problem decomposition: {llm_cognitive_result}")
        self._pdf_s["decomposition_result"] = llm_cognitive_result.get("decomposition_details", llm_cognitive_result)
        ka = self.ParseJsonToCNLObject(self.CCO_data.get("knowledge_artifacts_contextual_json", "{}"))
        if not isinstance(ka, dict): ka = {}
        ka["problem_definition_and_decomposition"] = self._pdf_s["decomposition_result"]
        self.CCO_data = self.fn_data_update_cco_section_v3(self.CCO_data, "knowledge_artifacts_contextual_json", self.ConvertCNLObjectToJson(ka))
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "PDF_MH_Result", "Problem decomposition stored.", self._pdf_s["decomposition_result"])
        self.PresentUserMessage_v3_0("Info", "PDF-MH: Problem decomposition complete and stored.")
        return self.kernel_process_mh_result("PDF-MH", {"status": "PDF_DefinitionComplete_ReadyForPlan", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})

    # --- PLAN-MH (Planning & Strategy) ---
    def run_mh_plan_step1_initialize(self, mh_inputs_obj):
        self.current_context_mh = "PLAN-MH"; self._plan_s = {}; self.aios_log(self.current_context_mh, "Initiated."); self.PresentUserMessage_v3_0("Status", "PLAN-MH: Starting Planning & Strategy...")
        if not self.CCO_data: self.PresentUserMessage_v3_0("Error", "PLAN-MH: CCO missing."); return self.kernel_process_mh_result("PLAN-MH", {"status": "PLAN_Error_MissingCCO"})
        ka = self.ParseJsonToCNLObject(self.CCO_data.get("knowledge_artifacts_contextual_json", "{}"))
        self._plan_s["problem_definition"] = ka.get("problem_definition_and_decomposition", {"problem_statement": "Problem not fully defined from PDF-MH."})
        self.PresentUserMessage_v3_0("Info", f"PLAN-MH: Using problem definition: {self._plan_s['problem_definition']}")
        return self.fn_planning_create_phases_v3(self._plan_s["problem_definition"], self.CCO_data)

    def fn_planning_create_phases_v3(self, problem_def_obj, cco_context_obj):
        self.aios_log(self.current_context_mh, "PLAN-MH: Requesting LLM for fn_planning_create_phases_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_PLAN_CREATE_PHASES", cognitive_task_details={"problem_definition": problem_def_obj, "cco_context": cco_context_obj, "output_format_guidance": "Return JSON: {'phases':[{'id':'phase1', 'name':'...', ...}]}"}, continuation_hint="engine.run_mh_plan_step2_process_phases(llm_cognitive_result)")

    def fn_planning_create_tasks_v3(self, phase_obj, problem_def_obj, cco_context_obj):
        self.aios_log(self.current_context_mh, "PLAN-MH: Requesting LLM for fn_planning_create_tasks_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_PLAN_CREATE_TASKS", cognitive_task_details={"current_phase":phase_obj, "problem_definition": problem_def_obj, "cco_context": cco_context_obj, "output_format_guidance": "Return JSON: {'tasks':[{'id':'task1', 'name':'...', 'type':'...', ...}]}"}, continuation_hint="engine.run_mh_plan_step_process_tasks(llm_cognitive_result)")

    def run_mh_plan_step2_process_phases(self, llm_cognitive_result):
        self.current_context_mh = "PLAN-MH"; self.aios_log(self.current_context_mh, f"Received plan phases: {llm_cognitive_result}")
        self._plan_s["phases"] = llm_cognitive_result.get("phases", [])
        if not self._plan_s["phases"]: self.PresentUserMessage_v3_0("Warning", "PLAN-MH: No phases generated."); return self.kernel_process_mh_result("PLAN-MH", {"status": "PLAN_Error_NoPhases"})
        self._plan_s["plan_object"] = {"phases": self._plan_s["phases"], "tasks_by_phase": {}}
        self._plan_s["current_phase_index"] = 0
        return self._plan_process_next_phase_tasks()

    def _plan_process_next_phase_tasks(self):
        self.current_context_mh = "PLAN-MH"
        if self._plan_s["current_phase_index"] >= len(self._plan_s["phases"]):
            return self.run_mh_plan_step3_finalize_plan()
        current_phase = self._plan_s["phases"][self._plan_s["current_phase_index"]]
        self.aios_log(self.current_context_mh, f"Requesting tasks for phase: {current_phase.get('id')} - {current_phase.get('name')}")
        return self.fn_planning_create_tasks_v3(current_phase, self._plan_s["problem_definition"], self.CCO_data)

    def run_mh_plan_step_process_tasks(self, llm_cognitive_result):
        self.current_context_mh = "PLAN-MH"; phase_idx = self._plan_s["current_phase_index"]
        current_phase_id = self._plan_s["phases"][phase_idx].get("id")
        self.aios_log(self.current_context_mh, f"Received tasks for phase {current_phase_id}: {llm_cognitive_result}")
        tasks = llm_cognitive_result.get("tasks", [])
        self._plan_s["plan_object"]["tasks_by_phase"][current_phase_id] = tasks
        self._plan_s["current_phase_index"] += 1
        return self._plan_process_next_phase_tasks()

    def run_mh_plan_step3_finalize_plan(self):
        self.current_context_mh = "PLAN-MH"; self.aios_log(self.current_context_mh, "All phases processed. Finalizing plan.")
        plan_json_str = self.ConvertCNLObjectToJson(self._plan_s["plan_object"])
        self.CCO_data = self.fn_data_update_cco_section_v3(self.CCO_data, "plan_structured_json", plan_json_str)
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "PLAN_MH_Result", "Plan generated and stored.", self._plan_s["plan_object"])
        self.PresentUserMessage_v3_0("Info", "PLAN-MH: Plan generation complete and stored in CCO.")
        return self.kernel_process_mh_result("PLAN-MH", {"status": "PLAN_Complete_ReadyForExecution", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})

    # --- TDE-MH (Task Dispatch & Execution) ---
    def run_mh_tde_step1_initialize(self, mh_inputs_obj):
        self.current_context_mh = "TDE-MH"; self._tde_s = {}; self.aios_log(self.current_context_mh, "Initiated."); self.PresentUserMessage_v3_0("Status", "TDE-MH: Starting Task Dispatch & Execution...")
        if not self.CCO_data or not self.CCO_data.get("plan_structured_json") or self.CCO_data.get("plan_structured_json") == "null": self.PresentUserMessage_v3_0("Error", "TDE-MH: CCO or plan_structured_json missing."); return self.kernel_process_mh_result("TDE-MH", {"status": "TDE_Error_MissingPlan"})
        self._tde_s["plan"] = self.ParseJsonToCNLObject(self.CCO_data.get("plan_structured_json"))
        if not self._tde_s["plan"] or not self._tde_s["plan"].get("phases"): self.PresentUserMessage_v3_0("Error", "TDE-MH: Plan is empty or malformed."); return self.kernel_process_mh_result("TDE-MH", {"status": "TDE_Error_InvalidPlan"})
        self._tde_s["current_phase_idx"] = 0; self._tde_s["current_task_in_phase_idx"] = 0
        self.PresentUserMessage_v3_0("Info", f"TDE-MH: Loaded plan with {len(self._tde_s['plan']['phases'])} phases.")
        return self._tde_process_next_task()

    def _tde_process_next_task(self):
        self.current_context_mh = "TDE-MH"; s = self._tde_s
        if s["current_phase_idx"] >= len(s["plan"]["phases"]): self.aios_log(self.current_context_mh,"All phases processed."); return self._tde_finalize_execution()
        current_phase = s["plan"]["phases"][s["current_phase_idx"]]
        current_phase_id = current_phase.get("id")
        tasks_for_phase = s["plan"]["tasks_by_phase"].get(current_phase_id, [])
        if s["current_task_in_phase_idx"] >= len(tasks_for_phase):
            self.aios_log(self.current_context_mh, f"Phase {current_phase_id} tasks complete.");
            s["current_phase_idx"] += 1; s["current_task_in_phase_idx"] = 0
            return self._tde_process_next_task()
        current_task = tasks_for_phase[s["current_task_in_phase_idx"]]
        self.aios_log(self.current_context_mh, f"Dispatching task: {current_task.get('id')} - {current_task.get('name')}")
        self.PresentUserMessage_v3_0("Info", f"TDE-MH: Starting task '{current_task.get('name')}'")
        task_type = current_task.get("type", "unknown").lower()
        mh_suggestion = current_task.get("assigned_mh_suggestion", "").upper()
        if mh_suggestion == "CAG-MH" or "draft" in task_type:
            self.aios_log(self.current_context_mh, f"TDE suggests CAG-MH for task: {current_task.get('name')}. Simulating.")
            self.PresentUserMessage_v3_0("Info", f"TDE-MH: Task '{current_task.get('name')}' (CAG-MH suggested) execution simulated.")
            s["current_task_in_phase_idx"] += 1
            return self._tde_process_next_task()
        elif mh_suggestion == "SEL-MH" or "solution" in task_type or "explore" in task_type:
            self.aios_log(self.current_context_mh, f"TDE suggests SEL-MH for task: {current_task.get('name')}. Simulating.")
            self.PresentUserMessage_v3_0("Info", f"TDE-MH: Task '{current_task.get('name')}' (SEL-MH suggested) execution simulated.")
            s["current_task_in_phase_idx"] += 1
            return self._tde_process_next_task()
        else:
            self.aios_log(self.current_context_mh, f"Task type '{task_type}' or MH '{mh_suggestion}' requires direct LLM cognitive action or user input. Simulating.")
            self.PresentUserMessage_v3_0("Info", f"TDE-MH: Task '{current_task.get('name')}' execution simulated (generic cognitive task).")
            s["current_task_in_phase_idx"] += 1
            return self._tde_process_next_task()

    def _tde_finalize_execution(self):
        self.current_context_mh = "TDE-MH"; self.aios_log(self.current_context_mh, "All tasks in plan executed.")
        self.PresentUserMessage_v3_0("Status", "TDE-MH: All planned tasks processed.")
        return self.kernel_process_mh_result("TDE-MH", {"status": "TDE_AllTasksComplete", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})

    # --- SEL-MH (Solution Exploration & Learning) ---
    def run_mh_sel_step1_initialize(self, mh_inputs_obj):
        self.current_context_mh = "SEL-MH"; self._sel_s = {}; self.aios_log(self.current_context_mh, "Initiated."); self.PresentUserMessage_v3_0("Status", "SEL-MH: Starting Solution Exploration...")
        if mh_inputs_obj and mh_inputs_obj.get("current_cco_json"):
            self.CCO_data = self.ParseJsonToCNLObject(mh_inputs_obj.get("current_cco_json"))
            self.Kernel_ActiveCCO_JsonString = mh_inputs_obj.get("current_cco_json")
        problem_context_from_input = mh_inputs_obj.get("problem_context")
        if problem_context_from_input: self._sel_s["problem_context"] = problem_context_from_input
        elif self.CCO_data:
             ka_json = self.CCO_data.get("knowledge_artifacts_contextual_json", "{}")
             ka = self.ParseJsonToCNLObject(ka_json) if ka_json else {}
             self._sel_s["problem_context"] = ka.get("problem_definition_and_decomposition")
        else: self._sel_s["problem_context"] = None
        if not self._sel_s["problem_context"]: self.PresentUserMessage_v3_0("Error", "SEL-MH: Problem context missing."); return self.kernel_process_mh_result("SEL-MH", {"status": "SEL_Error_NoContext", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        return self.fn_analysis_generate_solution_options_v3(self._sel_s["problem_context"], self.CCO_data)

    def fn_analysis_generate_solution_options_v3(self, problem_context_obj, cco_context_obj):
        self.aios_log(self.current_context_mh, "SEL-MH: Requesting LLM for fn_analysis_generate_solution_options_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_SEL_GENERATE_OPTIONS", cognitive_task_details={"problem_context": problem_context_obj, "cco_context": cco_context_obj, "output_format_guidance": "Return JSON: {'solution_options':[{'option_id':'opt1', 'description':'...', ...}]}"}, continuation_hint="engine.run_mh_sel_step2_process_generated_options(llm_cognitive_result)")

    def fn_analysis_evaluate_solution_option_v3(self, solution_option_obj, eval_criteria_obj, cco_context_obj):
        self.aios_log(self.current_context_mh, "SEL-MH: Requesting LLM for fn_analysis_evaluate_solution_option_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_SEL_EVALUATE_OPTION", cognitive_task_details={"solution_option": solution_option_obj, "evaluation_criteria":eval_criteria_obj, "cco_context": cco_context_obj, "output_format_guidance": "Return JSON: {'option_id':'opt1', 'evaluation_scores':{...}, 'summary':'...'}"}, continuation_hint="engine.run_mh_sel_step_process_evaluation_result(llm_cognitive_result)")

    def run_mh_sel_step2_process_generated_options(self, llm_cognitive_result):
        self.current_context_mh = "SEL-MH"; self._sel_s["solution_options"] = llm_cognitive_result.get("solution_options", [])
        if not self._sel_s["solution_options"]: self.PresentUserMessage_v3_0("Warning", "SEL-MH: No solution options generated."); return self.kernel_process_mh_result("SEL-MH", {"status": "SEL_NoOptionsGenerated"})
        self.PresentUserMessage_v3_0("Info", f"SEL-MH: Generated {len(self._sel_s['solution_options'])} solution options.")
        self._sel_s["evaluation_criteria"] = {"criteria": ["feasibility", "impact", "effort", "alignment_with_core_essence"]}
        self._sel_s["evaluated_options"] = []; self._sel_s["current_option_idx"] = 0
        return self._sel_evaluate_next_option()

    def _sel_evaluate_next_option(self):
        self.current_context_mh = "SEL-MH"
        if self._sel_s["current_option_idx"] >= len(self._sel_s["solution_options"]): return self.run_mh_sel_step3_present_evaluated_options()
        current_option = self._sel_s["solution_options"][self._sel_s["current_option_idx"]]
        return self.fn_analysis_evaluate_solution_option_v3(current_option, self._sel_s["evaluation_criteria"], self.CCO_data)

    def run_mh_sel_step_process_evaluation_result(self, llm_cognitive_result):
        self.current_context_mh = "SEL-MH"; self._sel_s["evaluated_options"].append(llm_cognitive_result)
        self._sel_s["current_option_idx"] += 1
        return self._sel_evaluate_next_option()

    def run_mh_sel_step3_present_evaluated_options(self):
        self.current_context_mh = "SEL-MH"; self.PresentUserMessage_v3_0("Info", "SEL-MH: All solution options evaluated.")
        display_options = []
        for opt in self._sel_s.get("evaluated_options", []):
            value = opt.get("option_id", str(uuid.uuid4()))
            label = opt.get("summary", opt.get("description", f"Option {value}"))
            scores_str = json.dumps(opt.get("evaluation_scores", {}))
            full_label = f"{label} (Scores: {scores_str})"
            display_options.append({"value": value, "label": full_label, "details_for_llm_context": opt})
        return self.fn_interaction_present_options_v3("SEL-MH: Please review evaluated solutions and select one:", display_options)

    def run_mh_sel_step4_finalize_selection(self, llm_interaction_result_obj):
        self.current_context_mh = "SEL-MH"; chosen_solution_id = llm_interaction_result_obj.get("command")
        self._sel_s["chosen_solution"] = next((opt for opt in self._sel_s.get("evaluated_options", []) if opt.get("option_id") == chosen_solution_id), None)
        if not self._sel_s["chosen_solution"]: self.PresentUserMessage_v3_0("Error", f"SEL-MH: Invalid solution selected (ID: {chosen_solution_id})."); return self.kernel_process_mh_result("SEL-MH", {"status":"SEL_Error_InvalidSelection", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        ka_json = self.CCO_data.get("knowledge_artifacts_contextual_json", "{}")
        ka = self.ParseJsonToCNLObject(ka_json) if ka_json else {}
        if not isinstance(ka, dict): ka = {}
        ka["selected_solution"] = self._sel_s["chosen_solution"]
        self.CCO_data = self.fn_data_update_cco_section_v3(self.CCO_data, "knowledge_artifacts_contextual_json", self.ConvertCNLObjectToJson(ka))
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "SEL_MH_Result", "Solution selected.", self._sel_s["chosen_solution"])
        self.PresentUserMessage_v3_0("Info", f"SEL-MH: Solution '{chosen_solution_id}' selected and recorded.")
        return self.kernel_process_mh_result("SEL-MH", {"status": "SEL_SolutionSelected_Complete", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})

    # --- KAU-MH (Knowledge Artifact Update) ---
    def run_mh_kau_step1_initialize(self, mh_inputs_obj):
        self.current_context_mh = "KAU-MH"; self._kau_s = {}; self.aios_log(self.current_context_mh, "Initiated."); self.PresentUserMessage_v3_0("Status", "KAU-MH: Starting Knowledge Artifact Update...")
        if mh_inputs_obj and mh_inputs_obj.get("current_cco_json"):
            self.CCO_data = self.ParseJsonToCNLObject(mh_inputs_obj.get("current_cco_json"))
            self.Kernel_ActiveCCO_JsonString = mh_inputs_obj.get("current_cco_json")
        elif not self.CCO_data and self.Kernel_ActiveCCO_JsonString:
             self.CCO_data = self.ParseJsonToCNLObject(self.Kernel_ActiveCCO_JsonString)
        self._kau_s["input_data_for_learning"] = mh_inputs_obj.get("data_to_process", self.CCO_data)
        self._kau_s["learning_focus"] = mh_inputs_obj.get("learning_focus", "general_process_insights")
        if not self._kau_s["input_data_for_learning"]: self.PresentUserMessage_v3_0("Warning", "KAU-MH: No input data for learning provided."); return self.kernel_process_mh_result("KAU-MH", {"status": "KAU_Error_NoInputData", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        return self.fn_analysis_extract_learnings_from_data_v3(self._kau_s["input_data_for_learning"], self._kau_s["learning_focus"], self.CCO_data)

    def fn_analysis_extract_learnings_from_data_v3(self, data_to_analyze_obj, learning_focus_str, cco_context_obj):
        self.aios_log(self.current_context_mh, "KAU-MH: Requesting LLM for fn_analysis_extract_learnings_from_data_v3.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_KAU_EXTRACT_LEARNINGS", cognitive_task_details={"data_to_analyze": data_to_analyze_obj, "learning_focus":learning_focus_str, "cco_context": cco_context_obj, "output_format_guidance": "Return JSON: {'learnings':[{'type':'heuristic', 'content':'...', ...}]}"}, continuation_hint="engine.run_mh_kau_step2_process_learnings(llm_cognitive_result)")

    def run_mh_kau_step2_process_learnings(self, llm_cognitive_result):
        self.current_context_mh = "KAU-MH"; self._kau_s["extracted_learnings"] = llm_cognitive_result.get("learnings", [])
        if not self._kau_s["extracted_learnings"]: self.PresentUserMessage_v3_0("Info", "KAU-MH: No specific learnings extracted."); return self.kernel_process_mh_result("KAU-MH", {"status": "KAU_NoLearningsExtracted", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        if not self.CCO_data: 
            if self.Kernel_ActiveCCO_JsonString: self.CCO_data = self.ParseJsonToCNLObject(self.Kernel_ActiveCCO_JsonString)
            else: self.CCO_data = {"cco_id": f"kau_cco_{uuid.uuid4().hex[:8]}", "knowledge_artifacts_contextual_json": "{}", "operational_log_cco_json":"[]"}; self.Kernel_ActiveCCO_JsonString = self.ConvertCNLObjectToJson(self.CCO_data); self.aios_log(self.current_context_mh, "KAU-MH: Created minimal CCO for storing learnings.")
        ka_json = self.CCO_data.get("knowledge_artifacts_contextual_json", "{}")
        ka = self.ParseJsonToCNLObject(ka_json) if ka_json else {}
        if not isinstance(ka, dict): ka = {}
        if "LHR" not in ka or not isinstance(ka["LHR"], list): ka["LHR"] = []
        ka["LHR"].extend(self._kau_s["extracted_learnings"])
        self.CCO_data = self.fn_data_update_cco_section_v3(self.CCO_data, "knowledge_artifacts_contextual_json", self.ConvertCNLObjectToJson(ka))
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "KAU_MH_Result", "Learnings extracted and stored in CCO.", {"learnings_count": len(self._kau_s["extracted_learnings"])})
        self.PresentUserMessage_v3_0("Info", f"KAU-MH: {len(self._kau_s['extracted_learnings'])} learnings extracted and stored.")
        return self.kernel_process_mh_result("KAU-MH", {"status": "KAU_LearningsStored_Complete", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})

    # --- FEL-MH (Framework Evolution Loop) ---
    def run_mh_fel_step1_initialize_evolution(self, mh_inputs_obj):
        self.current_context_mh = "FEL-MH"; self._fel_s = {}; self.aios_log(self.current_context_mh, "Initiated."); self.PresentUserMessage_v3_0("Status", "FEL-MH: Starting Framework Evolution Loop...")
        self._fel_s["current_engine_representation"] = mh_inputs_obj.get("current_engine_source_or_model", "Conceptual representation of current Python script's logic and structure.")
        return self.fn_interaction_elicit_user_input_v3(prompt_message_to_user="FEL-MH: Please provide the Template Improvement Directives (TIDs) as a JSON string (list of TID objects), or describe where to find them (e.g., a file path or URL to be processed by the LLM).")

    def run_mh_fel_step2_load_tids(self, llm_interaction_result_obj):
        self.current_context_mh = "FEL-MH"; tid_source_input = llm_interaction_result_obj.get("command")
        self.aios_log(self.current_context_mh, f"Received TID source input: {tid_source_input}")
        return self.fn_fel_load_tids_v3({"source_description": tid_source_input, "current_engine_version": self.engine_version_short})

    def run_mh_fel_step3_process_tids(self, llm_cognitive_result):
        self.current_context_mh = "FEL-MH"; self._fel_s["loaded_tids"] = llm_cognitive_result.get("tids_loaded", [])
        if not self._fel_s["loaded_tids"]: self.PresentUserMessage_v3_0("Error", "FEL-MH: No TIDs loaded or parsed from input."); return self.kernel_process_mh_result("FEL-MH", {"status":"FEL_Error_NoTIDsLoaded", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        self.PresentUserMessage_v3_0("Info", f"FEL-MH: Successfully loaded/parsed {len(self._fel_s['loaded_tids'])} TIDs.")
        if self.CCO_data is None:
            self.CCO_data = {"cco_id": f"fel_cco_{uuid.uuid4().hex[:8]}", "operational_log_cco_json":"[]"}
            self.Kernel_ActiveCCO_JsonString = self.ConvertCNLObjectToJson(self.CCO_data)
            self.aios_log(self.current_context_mh, "Initialized minimal CCO for FEL-MH logging.")
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "FEL_MH_TIDs_Loaded", f"Loaded {len(self._fel_s['loaded_tids'])} TIDs.", {"tids": self._fel_s["loaded_tids"]})
        return self.fn_fel_calculate_next_engine_version_v3(self._fel_s["current_engine_representation"])

    def run_mh_fel_step4_process_version(self, llm_cognitive_result):
        self.current_context_mh = "FEL-MH"; self._fel_s["next_version_string"] = llm_cognitive_result.get("next_version_string", f"v{self.engine_version_short}-evolved-{uuid.uuid4().hex[:4]}")
        self.PresentUserMessage_v3_0("Info", f"FEL-MH: Next engine version identified as: {self._fel_s['next_version_string']}")
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "FEL_MH_Version_Calculated", f"Next version: {self._fel_s['next_version_string']}.", {"next_version": self._fel_s['next_version_string']})
        engine_model_for_llm = {"description": "Current AIOS Engine Python Script Logic (as understood by LLM)", "current_version": self.engine_version_short, "key_components_to_evolve_hint": ["KernelLogic", "IFE-MH", "MRO_Orchestrator", "Specific_MH_from_TID"], "full_script_context_available_to_llm": True } 
        return self.fn_fel_apply_tids_to_engine_model_v3(self.ConvertCNLObjectToJson(engine_model_for_llm), self.ConvertCNLObjectToJson(self._fel_s["loaded_tids"]))

    def run_mh_fel_step5_process_applied_tids(self, llm_cognitive_result): 
        self.current_context_mh = "FEL-MH"
        self._fel_s["evolved_engine_model_conceptual"] = llm_cognitive_result.get("evolved_engine_model", {})
        application_log = llm_cognitive_result.get("application_log", "No detailed log from LLM.")
        self.PresentUserMessage_v3_0("Info", f"FEL-MH: TIDs conceptually applied to engine model by LLM. Log: {application_log}")
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data, "FEL_MH_TIDs_Applied_Conceptually", f"LLM conceptually applied TIDs. Log: {application_log[:100]}...", {"application_log": application_log, "conceptual_model": self._fel_s["evolved_engine_model_conceptual"]})
        if not self._fel_s["evolved_engine_model_conceptual"]:
            self.PresentUserMessage_v3_0("Error", "FEL-MH: LLM failed to produce an evolved engine model concept.");
            return self.kernel_process_mh_result("FEL-MH", {"status":"FEL_Error_TIDApplicationFailed", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        return self.fn_utility_regenerate_engine_artefact_v3(self._fel_s["evolved_engine_model_conceptual"], target_format="python_script_text")

    def fn_utility_regenerate_engine_artefact_v3(self, evolved_engine_model_obj, target_format="python_script_text"):
        self.aios_log(self.current_context_mh, f"FEL-MH: Requesting LLM for fn_utility_regenerate_engine_artefact_v3 to format: {target_format}.")
        return self._create_llm_request(task_type="COGNITIVE_TASK_FEL_REGEN_ARTEFACT", cognitive_task_details={"evolved_engine_model": evolved_engine_model_obj, "target_format": target_format, "output_format_guidance": "Return JSON object: {'engine_artefact_text': '<full_text_of_new_script_or_config>', 'changelog_text':'...', 'status':'Success'}"}, continuation_hint="engine.run_mh_fel_step6_finalize_evolution(llm_cognitive_result)")

    def run_mh_fel_step6_finalize_evolution(self, llm_cognitive_result):
        self.current_context_mh = "FEL-MH"; evolved_engine_text = llm_cognitive_result.get("engine_artefact_text")
        changelog = llm_cognitive_result.get("changelog_text", "No changelog generated.")
        if not evolved_engine_text: self.PresentUserMessage_v3_0("Error", "FEL-MH: LLM failed to generate evolved engine artefact."); return self.kernel_process_mh_result("FEL-MH", {"status":"FEL_Error_RegenerationFailed"})
        self.PresentUserMessage_v3_0("Info", f"FEL-MH: Evolved engine artefact (Version: {self._fel_s.get('next_version_string')}) generated by LLM.")
        self.PresentUserMessage_v3_0("GeneratedEngineArtefact", {"new_engine_version": self._fel_s.get('next_version_string'), "engine_script_text": evolved_engine_text, "changelog": changelog})
        self.CCO_data = self.LogToCCOHistory_v3_0(self.CCO_data or {}, "FEL_MH_Result", f"Engine evolution to {self._fel_s.get('next_version_string')} proposed.", {"new_version": self._fel_s.get('next_version_string'), "changelog": changelog}) 
        return self.kernel_process_mh_result("FEL-MH", {"status": "FEL_EvolutionProposed_Complete", "updated_cco_json": self.ConvertCNLObjectToJson(self.CCO_data)})
        
# --- End of AIOS_Engine_v3_3_2_stateful class definition ---