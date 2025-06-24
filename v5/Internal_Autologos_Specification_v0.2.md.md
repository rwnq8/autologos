# Internal Autologos Specification - Alpha v0.2
# The AI's Structured Representation for Autologos Instructions

## 1. Introduction
This document specifies the Alpha v0.2 version of the **Internal Autologos** syntax. This is the structured, keyword-driven representation that the AI's autologos interpreter aims to translate user input into, and is used for AI-generated Engine logic.

Purposes: Unambiguity, Consistency, Efficiency, Modifiability, Basis for Execution.

## 2. Syntax and Semantics
### 2.1. Core Elements
*   **Keywords:** `IF, THEN, ELSE, ELSE IF, AND, OR, NOT, IS, EQUALS, CONTAINS, MATCHES, ANY, ALL, GREATER_THAN, LESS_THAN, TRUE, FALSE, REPEAT, WHILE, FOR, EACH, IN, KEYS, PAIRS, VALUES, SWITCH, CASE, DEFAULT, DEFINE, RETURN, TRY, CATCH, FINALLY, RAISE, CONTINUE, BREAK, LOG, INVOKE, SET, APPEND, INSERT, REMOVE_AT, REMOVE_ITEM, GET, DELETE_KEY, CONCATENATE`
*   **Data Types (Conceptual):** `STRING, INTEGER, BOOLEAN, LIST, OBJECT, YAML, MARKDOWN, NULL, UNDEFINED`
*   **Variables:** `VariableName`, Assignment: `VariableName := expression`
*   **Placeholders/External Inputs:** `` `PlaceholderName` ``
*   **Comments:** `# comment`
*   **Blocks:** `{}` (Indentation for readability)

### 2.2. Control Flow
*   **Conditionals:** `IF (condition) { ... } [ELSE IF (condition) { ... }] [ELSE { ... }]`
*   **Looping:** `WHILE (condition) { ... }`, `REPEAT { ... } WHILE (condition)`, `FOR EACH Item IN List { ... }`, `FOR EACH Key IN KEYS(Object) { ... }`, `FOR EACH Key, Value IN PAIRS(Object) { ... }`. `CONTINUE`, `BREAK`.
*   **Switch:** `SWITCH (expression) { CASE val1: { ... } DEFAULT: { ... } }` (No fallthrough)

### 2.3. Data Structures and Operations
*   **Literals:** `"string"`, `123`, `TRUE`, `FALSE`, `NULL`.
*   **Object:** Creation: `Obj := OBJECT { k1 := "v1" }`. Access: `Obj.k1`, `Obj["k1"]`, `GET(Obj, "k1")`. Mod: `Obj.k1 := val`, `SET(Obj, "k1", val)`. Utils: `HAS_KEY`, `KEYS`, `VALUES`, `DELETE_KEY`.
*   **List:** Creation: `Lst := LIST { "a", 1 }`. Access: `Lst[idx]`, `GET(Lst, idx)`. Mod: `Lst[idx] := val`, `SET(Lst, idx, val)`. Add/Remove: `APPEND`, `INSERT`, `REMOVE_AT`, `REMOVE_ITEM`. Info: `LENGTH`, `IS_EMPTY`. Concat: `CONCATENATE`. Higher-Order: `FILTER`, `MAP`, `REDUCE`.

### 2.4. Function Definition and Invocation
*   **Internal Autologos Functions:** `DEFINE Func(p1, p2) { ... RETURN val }`
*   **Invocation:** `Res := Func(arg1, arg2)` or `Func(arg1, arg2)`

### 2.5. Invoking External aiOS Functions
*   **Syntax:** `ResultVar := INVOKE ExtFuncName(param1 := val1, ...)`
*   **Semantics:** Signals aiOS Engine to call registered external function. Pauses. Result is JSON string, parsed to CNL. Interaction functions (e.g., `interaction_elicit_user_input_v3`) return JSON like `{"status": "USER_COMMAND", "command": "user text"}`. Kernel/MHs check these conventional keys.

### 2.6. Error Handling
*   **Syntax:** `TRY { ... } CATCH ErrType AS ErrObj { ... } FINALLY { ... }`
*   **`RAISE ErrType "Message"`**
*   **`ErrorObject`:** `{ type: STRING, message: STRING, details: OBJECT? }`

### 2.7. Logging
*   **Syntax:** `LOG expression`

## 3. Relationship to User-Facing Autologos and aiOS
User input (naturalistic) -> AI Interpretation -> Internal Autologos -> aiOS Execution. FEL-MH generates Internal Autologos.

## 4. Relationship to Engine File Structure
Schema defines string fields that contain Internal Autologos.

## 5. Future Enhancements
More std lib functions, refined error types, debug tools, formal NLU->Internal mapping.