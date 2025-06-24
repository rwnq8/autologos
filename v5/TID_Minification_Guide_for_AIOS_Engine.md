# TID_Minification_Guide_for_AIOS_Engine.md
# Guide for Minifying the AIOS Engine (Conceptual TID)

This document provides guidelines and examples for transforming the verbose `AIOS_Engine_v3.3.2_stateful.py` script (or its conceptually evolved successors) into a highly minified version for improved performance in execution environments like Google AI Studio.

## Goal:

The primary goal of minification is to **reduce the character count and token count of the AIOS Engine script text**, thereby decreasing parsing overhead and enabling faster load times and more complex simulations within time constraints.

## Principles:

1.  **Prioritize Machine Readability:** The minified code is primarily for machine interpretation (Python interpreter, LLM). Human readability is not a priority.
2.  **Minimize Token Count:** Shorten names aggressively to reduce the number of tokens processed by the execution environment.
3.  **Preserve Python Keywords:** Do not change Python reserved words (e.g., `import`, `class`, `def`, `if`, `else`, `for`, `while`, `try`, `except`, `return`, `True`, `False`, `None`, etc.).
4.  **Preserve External Interface Signatures (Ideally):**  The names of methods that are called directly by the orchestrator (e.g., `kernel_start`, `kernel_process_choice`, MH entry points, etc.) should ideally remain the same or have a clear, documented mapping in the minified version. This simplifies interaction.
5.  **Ensure Functional Equivalence:** The minified code must be logically and functionally equivalent to the original verbose code.  All behavior, state transitions, and LLM requests should be preserved.

## Minification Strategies:

1.  **Short, Symbolic Names:** Replace verbose variable and method names with short, symbolic equivalents.
    *   Examples:
        *   `self.log_history` -> `self.lh`
        *   `engine_version_full` -> `evf`
        *   `_initialize_default_state` -> `_ids`
        *   `run_mh_ife_step1_get_core_idea` -> `ife_s1`
        *   `_create_llm_request` -> `_cr`
        *   `kernel_process_mh_result` -> `kpmr`
2.  **Acronyms and Abbreviations:** Use acronyms and abbreviations where appropriate.
    *   Examples:
        *   `current_context_mh` -> `ccm`
        *   `Template Improvement Directive` -> `TID`
        *   `Central Conceptual Object` -> `CCO`
3.  **Single-Letter Variables (Where Unambiguous):** Use single-letter variable names for loop counters, temporary variables, or parameters within small, localized scopes where their meaning is clear.
4.  **Sequential Numbering/Alpha-Numeric:** For internal state dictionaries (e.g., `_ife_s`, `_pdf_s`), consider using single letters or short alphanumeric sequences for keys if the original keys are very verbose.
5.  **Remove Comments and Docstrings (Optional):**  For extreme minification, comments and docstrings can be removed. However, it's recommended to keep high-level comments that explain the purpose of major sections or methods, especially in the minified version.
6.  **Compact JSON and Dictionary Literals:**  Use compact JSON formatting (no unnecessary whitespace) when defining dictionaries or JSON strings within the Python code.

## Example Transformation:

```python
# Verbose Code (AIOS_Engine_v3.3.2_stateful.py)
def _get_timestamp(self):
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def aios_log(self, context, message):
    timestamp = self._get_timestamp()
    full_log = f"{timestamp} - AIOS_LOG ({context} v{self.engine_version_short}): {message}"
    print(full_log)
    self.log_history.append(full_log)

# Minified Code (Conceptual AIOS_Engine_v5.0mfc.py)
def _gt(self): return dt.datetime.now(dt.timezone.utc).isoformat() # _get_timestamp
def lg(self,c,m): # aios_log (context, message)
    ts=self._gt();vs=getattr(self,'evs','unk');fl=f"{ts} - LG ({c} v{vs}): {m}";print(fl);self.lh.append(fl) # evs: engine_version_short, lh: log_history, fl: full_log