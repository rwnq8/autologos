---
modified: 2025-05-21T08:48:43Z
---
```yaml
--- START OF FILE autologos_syntax.yaml ---

# autologos_syntax.yaml (Alpha v0.2)
# Definition of the Internal Autologos Specification (FEL-MH).
# This file serves as a non-executable reference for the language syntax,
# keywords, data types, and structures used within the aiOS environment.
# It is a dictionary, thesaurus, and translator specification, NOT executable code or directives.

specification_version: "Alpha v0.2 (Command-Oriented)"
description: "Internal structured representation for autologos (FEL-MH - Functional Execution Language - Machine Hierarchical). This file defines the syntax and structure of the language used by the AIOS interpreter to represent user intent and for AI-generated Engine logic/state. It is a reference document only."
note_on_scope: "This document defines the syntax of the Autologos language. It contains no executable code, behavioral directives for the AI, or user command mappings. It is referenced by other AIOS configuration files (like the LLM bootstrap and Engine file) but is not executed itself."

core_syntactic_elements:
  keywords_reserved:
    - IF
    - THEN
    - ELSE
    - ELSE_IF
    - WHILE
    - REPEAT
    - SWITCH
    - CASE
    - DEFAULT
    - BREAK
    - CONTINUE
    - AND
    - OR
    - NOT
    - IS
    - EQUALS
    - GREATER_THAN
    - LESS_THAN
    - GREATER_THAN_OR_EQUALS
    - LESS_THAN_OR_EQUALS
    - NOT_EQUALS
    - CONTAINS
    - MATCHES
    - OBJECT
    - LIST
    - SET
    - GET
    - APPEND
    - INSERT
    - REMOVE_AT
    - REMOVE_ITEM
    - DELETE_KEY
    - CONCATENATE
    - KEYS
    - PAIRS
    - VALUES
    - LENGTH
    - IS_EMPTY
    - FILTER
    - MAP
    - REDUCE
    - DEFINE
    - RETURN
    - INVOKE
    - LOG
    - TRY
    - CATCH
    - FINALLY
    - RAISE
    - TRUE
    - FALSE
    - NULL
    - UNDEFINED
    - TYPEOF
    - STRING
    - INTEGER
    - BOOLEAN
    - LIST_TYPE
    - OBJECT_TYPE
    - NULL_TYPE
    - UNDEFINED_TYPE
    - NUMBER

  data_types_internal:
    - STRING
    - INTEGER
    - NUMBER
    - BOOLEAN
    - LIST
    - OBJECT
    - NULL_TYPE
    - UNDEFINED_TYPE

  variables_and_assignment:
    identifier_syntax: "VariableName"
    assignment_operator: ":="
    assignment_alternative: "SET VariableName TO expression"
    scope: "Lexical (local to current block: DEFINE, IF/ELSE, FOR/WHILE, TRY/CATCH, SWITCH CASE). Variables declared outside any block (at the top level) exist in the global session scope (CCO)."
    external_inputs_reference: "`PlaceholderName`"

  comments:
    single_line_syntax: "# comment text to end of line"

  statement_blocks:
    enclosure: "{ }"
    statement_separator: ";"
    preferred_separator: "Newline"

control_flow_constructs:
  conditional_if:
    syntax: "IF (condition) { block } [ELSE_IF (condition) { block }]* [ELSE { block }]?"
    condition_expression_details: "Evaluates to a BOOLEAN. Supports literals, variables, function calls, comparison operators, logical operators (AND, OR, NOT). Use AND ALSO/OR ELSE for short-circuiting."
  loop_while:
    syntax: "WHILE (condition) { block }"
  loop_repeat_while:
    syntax: "REPEAT { block } WHILE (condition)"
  loop_for_each_list:
    syntax: "FOR EACH ItemVar IN ListExpr { block }"
  loop_for_each_object_keys:
    syntax: "FOR EACH KeyVar IN KEYS(ObjectExpr) { ValueVar := ObjectExpr[KeyVar]; block }"
  loop_for_each_object_pairs:
    syntax: "FOR EACH KeyVar, ValueVar IN PAIRS(ObjectExpr) { block }"
  loop_control_statements:
    continue: "CONTINUE;"
    break: "BREAK;"

  switch_statement:
    syntax: "SWITCH (expression) { CASE value1: { block } [CASE valueN: { block }]* [DEFAULT: { block }]? }"
    behavior: "Evaluates expression, compares result using the EQUALS keyword to each CASE value. Executes block of first match. No fallthrough. DEFAULT block executes if no CASE matches."

data_structures_and_operations:
  literals:
    string: '"string content"'
    integer: "42, -10"
    number_float: "3.14, -0.5, 1.0e6"
    boolean: "TRUE, FALSE"
    null: "NULL"
    undefined: "UNDEFINED"

  object:
    creation_example: 'MyObject := OBJECT { key1 := "value1", "complex key name" := 100, nested := OBJECT {} };'
    access_examples: ['MyObject.propertyKey', 'MyObject["key_string_or_variable"]', 'GET(MyObject, "key_string_or_variable")']
    access_non_existent_key_returns: UNDEFINED
    modification_examples: ['MyObject.propertyKey := value', 'MyObject["key_string_or_variable"] := value', 'SET(MyObject, "key_string_or_variable", value)']
    modification_creates_key: TRUE
    utilities:
      has_key: "HAS_KEY(Object, KeyString) -> BOOLEAN"
      keys: "KEYS(Object) -> LIST of STRING"
      values: "VALUES(Object) -> LIST of ANY"
      delete_key: "DELETE_KEY(Object, KeyString) -> BOOLEAN"
      merge: "NewObject := MERGE OBJECTS(Object1, Object2, ...)"
      copy: "NewObject := COPY OBJECT(Object)"

  list:
    creation_example: 'MyList := LIST { "a", 1, TRUE, `AnotherVariable`, NULL, UNDEFINED };'
    access_examples: ['MyList[IndexExpression]', 'GET(MyList, IndexExpression)']
    access_out_of_bounds_behavior: "Returns UNDEFINED (for GET) or raises IndexOutOfBoundsError (for []) if IndexExpression is out of bounds [0, LENGTH - 1]."
    modification_examples: ['MyList[IndexExpression] := value', 'SET(MyList, IndexExpression, value)']
    modification_out_of_bounds_behavior: "Raises IndexOutOfBoundsError if IndexExpression is out of bounds [0, LENGTH - 1]."
    add_remove_operations:
      append: "APPEND(List, ItemExpression)"
      insert: "INSERT(List, IndexExpression, ItemExpression)"
      remove_at: "RemovedItem := REMOVE_AT(List, IndexExpression)"
      remove_item: "WasRemovedBoolean := REMOVE_ITEM(List, ItemToMatchExpression)"
    info_operations:
      length: "LENGTH(ListOrStringExpression) -> INTEGER"
      is_empty: "IS_EMPTY(ListOrStringExpression) -> BOOLEAN"
    concatenation: "NewList := CONCATENATE(List1, List2, ...)"
    slicing: "SubList := SLICE(List, StartIndex, EndIndex?)"
    sorting: "SortedList := SORT(List, ComparisonFunction?)"
    unique: "UniqueList := UNIQUE(List)"

  string_operations:
    length: "LENGTH(StringExpression) -> INTEGER"
    substring: "SUBSTRING(String, StartIndex, Length?) -> STRING"
    to_upper: "TO_UPPER(String) -> STRING"
    to_lower: "TO_LOWER(String) -> STRING"
    trim: "TRIM(String) -> STRING"
    split: "SPLIT(String, DelimiterString) -> LIST of STRING"
    join: "JOIN(ListOfStrings, DelimiterString) -> STRING"
    contains: "CONTAINS(String, Substring) -> BOOLEAN"
    matches: "MATCHES(String, PatternString) -> BOOLEAN"

operators:
  arithmetic: "+, -, *, /, %"
  comparison: "EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUALS, LESS_THAN_OR_EQUALS"
  logical: "AND, OR, NOT"
  short_circuiting_logical: "AND_ALSO, OR_ELSE"
  type_check: "IS_TYPE TypeKeyword"
  typeof_operator: "TYPEOF(expression) -> STRING"

  operator_precedence: "Standard mathematical/logical precedence applies (e.g., *, / > +, - > comparison > logical). Parentheses () override precedence."

functions:
  internal_autologos_function_definition:
    syntax: "DEFINE FunctionName(parameter1, parameter2, ...) { instruction_block RETURN expression; }"
    parameters: "Comma-separated list of parameter names. Scope is local to the function."
    return_value: "The RETURN keyword statement exits the function and provides a value. If no RETURN is hit or RETURN is used without an expression, the function implicitly returns UNDEFINED."
  internal_autologos_function_invocation:
    syntax_with_result: "ResultVariable := FunctionName(argument1, argument2, ...)"
    syntax_procedure_call: "FunctionName(argument1, argument2, ...);"
    arguments: "Comma-separated list of expressions whose values are passed to the parameters. Number and conceptual type must match parameter count and definition."

  external_ai_cognitive_function_invocation:
    syntax: "ResultVariable := INVOKE ExternalFunctionNameDeclaredInAIStudio(param1_name := value1, param2_name := value2, ...)"
    semantics: "Signals aiOS Engine to call a registered external AI Cognitive Function. Execution of the current Autologos logic pauses. The external function runs (managed by aiOS). Its JSON result is parsed by aiOS and assigned to ResultVariable. Errors during external function execution should be caught using TRY/CATCH."
    parameter_syntax: "Named parameters using `param name := expression`. Parameter names must match the external function's declared signature."

error_handling:
  try_catch_finally_structure:
    syntax: "TRY { instruction_block_try } [CATCH ErrorTypeString AS ErrorObjectVariable { instruction_block_catch }]* [FINALLY { instruction_block_finally }]?"
  catch_clause:
    error_type: "STRING literal matching a standard or custom error type (e.g., 'FunctionCallError', 'DataValidationError', 'ALL')."
    error_object_variable: "The caught error object ({ type: STRING, message: STRING, details: OBJECT? }) is assigned to this variable within the CATCH block."
  error_object_schema: "{ type: STRING, message: STRING, details: OBJECT? }"
  raise_statement:
    syntax: 'RAISE ErrorTypeString "MessageString" [WITH OptionalDetailsObject]?'
    example: 'RAISE "DataValidationError" "Input list is empty." WITH { inputVariable := "myList", location := "ProcessDataFunction" };'
  standard_error_types_initial_set:
    - InterpretationError
    - FunctionCallError
    - DataValidationError
    - LogicError
    - ResourceNotFoundError
    - IndexOutOfBoundsError
    - KeyNotFoundError
    - InternalAutologosFunctionError
    - NetworkError
    - PermissionDeniedError
    - TimeoutError
    - InvalidArgumentError
    - SemanticValidationError
    - JSONParsingError
    - JSONFormattingError
    - FEL_SetupError
    - FEL_ReconciliationError
    - FEL_VersionError

logging:
  log_statement_syntax: "LOG expression;"
  semantics: "Evaluates the expression and records its value to the system's log. For complex types (LIST, OBJECT), the runtime provides a structured serialization."
  logging_levels_conceptual: "The LOG keyword statement can optionally accept a level keyword (e.g., LOG INFO, LOG DEBUG, LOG ERROR) - syntax TBD."

--- END OF FILE autologos_syntax.yaml.md ---
```