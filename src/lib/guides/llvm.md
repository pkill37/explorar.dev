---
guideId: llvm-guide
name: LLVM Compiler Infrastructure In The Mind
description: Understanding LLVM Before Code
defaultOpenIds: ['ch1']

dataStructures:
  - name: Module
    category: IR
    description: Top-level container for LLVM IR
    location: /llvm/include/llvm/IR/Module.h
    filePath: llvm/include/llvm/IR/Module.h
    lineNumber: 65
---

# LLVM Compiler Infrastructure In The Mind

## Understanding LLVM Before Code

> This guide helps you build a mental model of how LLVM works—the modular compiler infrastructure that powers many modern compilers.

LLVM is a collection of modular and reusable compiler and toolchain technologies, designed around a language-independent intermediate representation (IR).

**The foundation of modern compilers. Let's understand how it works.**

---

id: ch1
title: Chapter 1 — Introduction to LLVM
fileRecommendations:
docs: - path: llvm/docs/
description: LLVM documentation
source: - path: llvm/include/llvm/IR/
description: IR data structures and headers - path: llvm/include/llvm/IR/Type.h
description: Type system - path: llvm/include/llvm/IR/Value.h
description: Base class for all values - path: llvm/include/llvm/IR/Instruction.h
description: Instructions - path: llvm/include/llvm/IR/BasicBlock.h
description: Basic blocks - path: llvm/include/llvm/IR/Function.h
description: Functions - path: llvm/lib/IR/
description: IR implementation - path: llvm/lib/IR/Type.cpp
description: Type implementation - path: llvm/lib/IR/Verifier.cpp
description: IR validation
quiz:

- id: ch1-q1
  question: What is LLVM's revolutionary insight?
  options:
  - To create a single monolithic compiler
  - To create a universal intermediate representation that separates frontend, middle-end, and backend concerns
  - To use assembly language directly
  - To compile only C and C++
    correctAnswer: 1
    explanation: LLVM's revolutionary insight was to create a universal intermediate representation (IR) that completely separates frontend concerns (parsing, semantic analysis), middle-end concerns (target-independent optimizations), and backend concerns (code generation, register allocation).
- id: ch1-q2
  question: What are the three forms of LLVM IR?
  options:
  - Source, binary, and executable
  - Human-readable (.ll), bitcode (.bc), and in-memory
  - Assembly, object, and library
  - C, C++, and Rust
    correctAnswer: 1
    explanation: LLVM IR exists in three forms - human-readable text format (.ll files), binary bitcode format (.bc files), and in-memory representation used by LLVM libraries.
- id: ch1-q3
  question: What does SSA stand for and why is it important?
  options:
  - Single Source Analysis - for code organization
  - Static Single Assignment - enables simpler dataflow analysis and efficient optimizations
  - System Software Architecture - for compiler design
  - Source Syntax Analysis - for parsing
    correctAnswer: 1
    explanation: SSA (Static Single Assignment) means each variable is assigned exactly once. This enables simpler dataflow analysis, efficient optimizations like dead code elimination and constant propagation, and matches how compilers naturally think about values.

---

LLVM is a collection of modular and reusable compiler and toolchain technologies that has revolutionized how we build compilers. Unlike traditional monolithic compilers, LLVM separates concerns through a carefully designed intermediate representation (IR) that serves as a universal language between frontends and backends.

**Key Concepts:**

- **Separation of Concerns Through IR**: Frontend, middle-end, and backend are completely separated
- **LLVM IR: The Universal Language**: Platform-independent, strongly typed, SSA-based
- **Three-Phase Architecture**: Source Code → Frontend → LLVM IR → Optimizer → Backend → Machine Code
- **Multiple frontends** → Single IR → Multiple backends

**The Three-Phase Architecture:**

```
Source Code
    ↓
Frontend (Clang, Swift, Rust)
    ↓
LLVM IR (SSA Form)
    ↓
Optimizer (opt)
    ↓
Optimized IR
    ↓
Backend (x86, ARM, RISC-V)
    ↓
Machine Code
```

**Example IR - Simple Addition:**

```llvm
define i32 @add(i32 %a, i32 %b) {
entry:
  %result = add nsw i32 %a, %b
  ret i32 %result
}
```

---

id: ch2
title: Chapter 2 — LLVM IR and Code Generation
fileRecommendations:
docs: []
source: - path: llvm/lib/IR/
description: IR core implementation - path: llvm/lib/IR/Type.cpp
description: Type system implementation - path: llvm/lib/IR/Value.cpp
description: Base value class - path: llvm/lib/IR/Instruction.cpp
description: Instruction base class - path: llvm/lib/IR/Instructions.cpp
description: All instruction types - path: llvm/lib/IR/BasicBlock.cpp
description: Basic block implementation - path: llvm/lib/IR/Function.cpp
description: Function implementation - path: llvm/lib/IR/Module.cpp
description: Module (compilation unit) - path: llvm/lib/IR/IRBuilder.cpp
description: Helper for building IR - path: llvm/lib/IR/Verifier.cpp
description: IR validity checking - path: llvm/lib/CodeGen/
description: Code generation framework - path: llvm/lib/CodeGen/SelectionDAG/
description: Instruction selection using DAGs - path: llvm/lib/CodeGen/GlobalISel/
description: Global instruction selection - path: llvm/lib/CodeGen/MachineFunction.cpp
description: Machine-level function representation
quiz:

- id: ch2-q1
  question: What is a PHI node in LLVM IR?
  options:
  - A mathematical function
  - An instruction that selects a value based on the predecessor basic block
  - A type conversion instruction
  - A memory allocation instruction
    correctAnswer: 1
    explanation: A PHI node is an instruction that selects a value based on which basic block the control flow came from. It enables SSA form while representing control flow merges.
- id: ch2-q2
  question: What does the `getelementptr` instruction do?
  options:
  - Gets a pointer to an element in an aggregate type (array, struct)
  - Gets the value at a pointer
  - Allocates memory
  - Converts between types
    correctAnswer: 0
    explanation: The `getelementptr` instruction computes a pointer to an element within an aggregate type like an array or structure. It performs pointer arithmetic without dereferencing.
- id: ch2-q3
  question: What is the purpose of overflow flags like `nsw` and `nuw`?
  options:
  - To prevent overflow errors
  - To enable optimizations by providing guarantees about overflow behavior
  - To slow down execution
  - To disable optimizations
    correctAnswer: 1
    explanation: Flags like `nsw` (no signed wrap) and `nuw` (no unsigned wrap) tell the optimizer that overflow will not occur, enabling more aggressive optimizations while preserving program semantics.

---

The LLVM Intermediate Representation (IR) is a low-level programming language similar to assembly, but with higher-level type information and a consistent three-address code representation. It serves as the universal language that enables LLVM's modular architecture.

**Key Concepts:**

- **SSA Form**: Each variable assigned exactly once, enabling simpler dataflow analysis
- **PHI Nodes**: Select values based on predecessor blocks, enabling SSA with control flow
- **Type System**: Strongly typed with primitive types (i32, float) and derived types (pointers, arrays, structs)
- **Instruction Categories**: Arithmetic, memory operations, control flow, function calls, comparisons, type conversions

**Why SSA (Static Single Assignment)?**

SSA form is fundamental to LLVM IR. Each variable is assigned exactly once, which enables:

- Simpler dataflow analysis: Definitions and uses are explicit
- Efficient optimizations: Dead code elimination, constant propagation
- Natural representation: Matches how compilers think about values

**Example: Factorial Function in LLVM IR**

```llvm
define i32 @factorial(i32 %n) {
entry:
  %cmp = icmp sle i32 %n, 1
  br i1 %cmp, label %base_case, label %recursive_case

base_case:
  ret i32 1

recursive_case:
  %n_minus_1 = sub i32 %n, 1
  %rec_result = call i32 @factorial(i32 %n_minus_1)
  %result = mul i32 %n, %rec_result
  ret i32 %result
}
```

---

id: ch3
title: Chapter 3 — Clang Frontend
fileRecommendations:
docs: []
source: - path: clang/include/clang/
description: Clang headers - path: clang/include/clang/AST/
description: Abstract Syntax Tree - path: clang/include/clang/Parse/
description: Parser - path: clang/include/clang/Sema/
description: Semantic analysis - path: clang/include/clang/CodeGen/
description: IR generation - path: clang/lib/Parse/
description: Parser implementation - path: clang/lib/Sema/
description: Semantic analysis implementation - path: clang/lib/CodeGen/
description: CodeGen implementation - path: clang/lib/CodeGen/CodeGenModule.cpp
description: Module-level IR generation - path: clang/lib/CodeGen/CodeGenFunction.cpp
description: Function-level IR generation - path: clang/lib/CodeGen/CGExpr.cpp
description: Expression code generation - path: clang/lib/CodeGen/CGStmt.cpp
description: Statement code generation - path: clang/lib/CodeGen/CGCall.cpp
description: Function call generation
quiz:

- id: ch3-q1
  question: What are the main phases of Clang frontend?
  options:
  - Lexer, Parser, Optimizer, CodeGen
  - Lexer, Parser, Sema (Semantic Analysis), CodeGen
  - Parser, Optimizer, Backend
  - Lexer, Optimizer, CodeGen
    correctAnswer: 1
    explanation: Clang frontend consists of - Lexer (tokenizes source), Parser (builds AST), Sema (semantic analysis and type checking), and CodeGen (generates LLVM IR from AST).
- id: ch3-q2
  question: What is the AST in Clang?
  options:
  - Assembly Syntax Tree
  - Abstract Syntax Tree - a tree representation of source code structure
  - Application Source Tree
  - Analysis Syntax Tree
    correctAnswer: 1
    explanation: AST (Abstract Syntax Tree) is a tree representation of the syntactic structure of source code. It captures the hierarchical relationships between language constructs without including all the details of the original syntax.

---

Clang is the C/C++/Objective-C compiler frontend for LLVM. It parses source code, performs semantic analysis, and generates LLVM IR.

**Clang Architecture:**

- **Lexer**: Tokenizes source code into tokens (keywords, identifiers, operators)
- **Parser**: Builds Abstract Syntax Tree (AST) from tokens
- **Sema**: Semantic analysis and type checking, symbol resolution
- **CodeGen**: Generates LLVM IR from validated AST

**IR Generation Pipeline:**

```
Source: "int x = 42;"
    ↓
Lexer → Tokens: [INT, IDENTIFIER("x"), EQUAL, NUMBER(42), SEMICOLON]
    ↓
Parser → AST: VarDecl(type=int, name="x", init=IntegerLiteral(42))
    ↓
Sema → Validated AST (with type information, symbol resolution)
    ↓
CodeGen → LLVM IR:
  %x = alloca i32
  store i32 42, i32* %x
```

**Key Frontend Responsibilities:**

- Type checking and semantic validation
- Symbol table management
- Template instantiation (C++)
- Debug information generation

---

id: ch4
title: Chapter 4 — Optimization Passes
fileRecommendations:
docs: []
source: - path: llvm/lib/Transforms/
description: Optimization passes - path: llvm/lib/Transforms/Scalar/
description: Scalar optimizations - path: llvm/lib/Transforms/Scalar/DCE.cpp
description: Dead code elimination - path: llvm/lib/Transforms/Scalar/SCCP.cpp
description: Constant propagation - path: llvm/lib/Transforms/Utils/Mem2Reg.cpp
description: Promote allocas to registers - path: llvm/lib/Analysis/
description: Analysis passes - path: llvm/include/llvm/Analysis/CFG.h
description: Control flow graph - path: llvm/lib/Analysis/ScalarEvolution.cpp
description: Loop analysis - path: llvm/lib/Analysis/MemorySSA.cpp
description: Memory dependencies - path: llvm/lib/Transforms/IPO/
description: Interprocedural optimizations - path: llvm/lib/Transforms/Vectorize/
description: Vectorization passes
quiz:

- id: ch4-q1
  question: What is the difference between analysis passes and transformation passes?
  options:
  - Analysis passes modify code, transformation passes gather information
  - Analysis passes gather information about the code, transformation passes modify the IR
  - They are the same thing
  - Analysis passes are for frontends, transformation passes are for backends
    correctAnswer: 1
    explanation: Analysis passes gather information about the code (e.g., dominator tree, alias analysis) without modifying it. Transformation passes modify the IR to improve code quality (e.g., dead code elimination, constant propagation).
- id: ch4-q2
  question: What are the main categories of LLVM optimizations?
  options:
  - Only scalar optimizations
  - Scalar optimizations, loop optimizations, interprocedural optimizations, and link-time optimizations
  - Only loop optimizations
  - Only interprocedural optimizations
    correctAnswer: 1
    explanation: LLVM optimizations are categorized as - scalar optimizations (constant folding, dead code elimination), loop optimizations (unrolling, vectorization), interprocedural (inlining, devirtualization), and link-time (whole-program optimization).

---

LLVM's optimizer consists of a series of optimization passes that transform the IR to improve code quality. Optimizations are organized as passes that can be analysis (gather information) or transformation (modify IR).

**Pass Infrastructure:**

- **Analysis passes**: Gather information about the code (e.g., dominator tree, alias analysis, call graph)
- **Transformation passes**: Modify the IR to improve code quality (e.g., dead code elimination, constant propagation, inlining)
- **Pass manager**: Orchestrates pass execution, manages dependencies

**Pass Categories:**

- **Scalar optimizations**: Constant folding, dead code elimination, instruction combining
- **Loop optimizations**: Loop unrolling, vectorization, loop-invariant code motion
- **Interprocedural**: Inlining, devirtualization, global optimizations
- **Link-time**: Whole-program optimization across multiple compilation units
