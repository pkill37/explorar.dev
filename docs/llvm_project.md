# LLVM Compiler Infrastructure In The Mind

## Understanding LLVM Before Code

> This isn't just a guide to using LLVM. It's an effort to understand how modern compilers think.

LLVM is a collection of modular and reusable compiler and toolchain technologies that has revolutionized how we build compilers. Unlike traditional monolithic compilers, LLVM separates concerns through a carefully designed intermediate representation (IR) that serves as a universal language between frontends and backends.

Understanding LLVM means understanding the architecture of modern compilation: how source code transforms through multiple representations, how optimizations preserve semantics while improving performance, and how machine-independent code generation enables portability.

**LLVM powers the future of compilation. Let's understand how it works.**

---

## Learning Path for LLVM Exploration

This guide follows a structured learning path designed to build compiler expertise progressively:

### Beginner Path (Months 1-3)

1. **LLVM IR Basics**: Learn to read and write simple LLVM IR
2. **Simple Frontend**: Write a toy language frontend that generates IR
3. **Tool Usage**: Master `clang`, `opt`, `llc`, `lli`
4. **IR Study**: Read IR generated from simple C programs

**Practical Start:**

```bash
# Compile C to LLVM IR
clang -S -emit-llvm hello.c -o hello.ll
# Optimize IR
opt -O2 hello.ll -S -o hello_opt.ll
# Generate assembly
llc hello_opt.ll -o hello.s
```

### Intermediate Path (Months 4-6)

1. **Pass Development**: Write custom optimization passes
2. **Frontend Deep Dive**: Study Clang's AST and code generation
3. **Analysis Passes**: Implement control flow and data flow analysis
4. **Type System**: Understand LLVM's type system deeply

**Key Projects:**

- Write a dead code elimination pass
- Implement constant propagation
- Build a simple static analyzer

### Advanced Path (Months 7-12)

1. **Backend Study**: Understand instruction selection and register allocation
2. **Target Description**: Learn TableGen and target description files
3. **Advanced Optimizations**: Study loop optimizations, vectorization
4. **JIT Compilation**: Explore LLVM's ORC JIT infrastructure

**Advanced Projects:**

- Add a custom backend for a simple architecture
- Implement a new optimization pass
- Build a JIT-compiled language

### Expert Path (Year 2+)

1. **LLVM Contribution**: Contribute patches to LLVM
2. **Compiler Research**: Implement research papers
3. **Production Tools**: Build production compiler infrastructure
4. **Architecture Design**: Design new compiler features

---

## Chapter 1 — Introduction to LLVM

### The Philosophy: Separation of Concerns Through IR

LLVM's revolutionary insight was to create a universal intermediate representation that completely separates:

- **Frontend concerns**: Parsing, semantic analysis, language-specific optimizations
- **Middle-end concerns**: Target-independent optimizations
- **Backend concerns**: Code generation, register allocation, instruction scheduling

This separation enables:

- **Multiple frontends** → Single IR → Multiple backends
- **Reusable optimization infrastructure**
- **Language-agnostic tooling**
- **Incremental compilation and JIT**

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

### Key Concepts Deep Dive

**1. LLVM IR: The Universal Language**

LLVM IR is:

- **Platform-independent**: Abstracts away CPU details
- **Strongly typed**: Every value has a specific type
- **SSA-based**: Static Single Assignment form (each variable assigned once)
- **Three forms**: Human-readable (.ll), bitcode (.bc), in-memory

**Example IR - Simple Addition:**

```llvm
define i32 @add(i32 %a, i32 %b) {
entry:
  %result = add nsw i32 %a, %b
  ret i32 %result
}
```

**IR Properties:**

- `i32`: 32-bit integer type
- `%a, %b`: Virtual registers in SSA form
- `nsw`: "No Signed Wrap" - enables optimizations
- Every instruction produces a new SSA value

**2. Frontends: Language to IR Translation**

**Clang (C/C++/Objective-C):**

- Lexer → Tokens
- Parser → AST (Abstract Syntax Tree)
- Sema → Semantic Analysis
- CodeGen → LLVM IR

**Key Frontend Responsibilities:**

- Type checking and semantic validation
- Symbol table management
- Template instantiation (C++)
- Debug information generation

**3. Optimizers: Transformation Passes**

LLVM optimizations are organized as **passes**:

- **Analysis passes**: Gather information (e.g., dominator tree)
- **Transform passes**: Modify IR (e.g., dead code elimination)
- **Utility passes**: Helper functionality

**Pass Categories:**

- **Scalar optimizations**: Constant folding, dead code elimination
- **Loop optimizations**: Loop unrolling, vectorization
- **Interprocedural**: Inlining, devirtualization
- **Link-time**: Whole-program optimization

**4. Backends: IR to Machine Code**

Backend phases:

- **Instruction Selection**: IR → Machine IR (SelectionDAG or FastISel)
- **Instruction Scheduling**: Reorder for performance
- **Register Allocation**: Assign virtual registers to physical registers
- **Code Emission**: Generate object file

### Study Files and Architecture

**Core LLVM Directory Structure:**

```
llvm/
├── include/llvm/          # Public headers
│   ├── IR/               # IR data structures
│   ├── Analysis/         # Analysis passes
│   ├── Transforms/       # Transformation passes
│   ├── CodeGen/          # Code generation
│   └── Target/           # Target-specific interfaces
├── lib/                   # Implementations
│   ├── IR/               # IR implementation (~50k lines)
│   ├── Analysis/         # Analysis passes (~100k lines)
│   ├── Transforms/       # Optimizations (~300k lines)
│   ├── CodeGen/          # Backend framework (~200k lines)
│   └── Target/           # Target implementations
│       ├── X86/          # x86 backend (~150k lines)
│       ├── ARM/          # ARM backend
│       └── AArch64/      # 64-bit ARM
├── tools/                 # Command-line tools
│   ├── opt/              # Optimizer driver
│   ├── llc/              # Static compiler
│   └── lli/              # Interpreter/JIT
└── unittests/            # Unit tests

clang/
├── include/clang/        # Clang headers
│   ├── AST/              # Abstract Syntax Tree
│   ├── Parse/            # Parser
│   ├── Sema/             # Semantic analysis
│   └── CodeGen/          # IR generation
└── lib/                  # Implementations
    ├── Parse/            # Parser (~30k lines)
    ├── Sema/             # Semantic analysis (~100k lines)
    └── CodeGen/          # CodeGen (~80k lines)
```

**Essential Files to Study (In Order):**

**Week 1-2: IR Fundamentals**

1. `llvm/include/llvm/IR/Type.h` - Type system
2. `llvm/include/llvm/IR/Value.h` - Base class for all values
3. `llvm/include/llvm/IR/Instruction.h` - Instructions
4. `llvm/include/llvm/IR/BasicBlock.h` - Basic blocks
5. `llvm/include/llvm/IR/Function.h` - Functions

**Week 3-4: Core IR Implementation**

1. `llvm/lib/IR/Type.cpp` - Type implementation
2. `llvm/lib/IR/Instructions.cpp` - Instruction details
3. `llvm/lib/IR/Verifier.cpp` - IR validation (learn IR rules!)

**Month 2: Analysis**

1. `llvm/include/llvm/Analysis/CFG.h` - Control flow graph
2. `llvm/lib/Analysis/ScalarEvolution.cpp` - Loop analysis
3. `llvm/lib/Analysis/MemorySSA.cpp` - Memory dependencies

**Month 3: Transformations**

1. `llvm/lib/Transforms/Scalar/DCE.cpp` - Dead code elimination
2. `llvm/lib/Transforms/Scalar/SCCP.cpp` - Constant propagation
3. `llvm/lib/Transforms/Utils/Mem2Reg.cpp` - Promote allocas to registers

## Chapter 2 — LLVM IR and Code Generation

The LLVM Intermediate Representation (IR) is a low-level programming language similar to assembly, but with higher-level type information and a consistent three-address code representation. It serves as the universal language that enables LLVM's modular architecture.

### Understanding LLVM IR - Deep Dive

**Why SSA (Static Single Assignment)?**

SSA form is fundamental to LLVM IR. Each variable is assigned exactly once, which enables:

- **Simpler dataflow analysis**: Definitions and uses are explicit
- **Efficient optimizations**: Dead code elimination, constant propagation
- **Natural representation**: Matches how compilers think about values

**Non-SSA vs SSA Example:**

```c
// Original C code
int x = 1;
if (condition) {
  x = 2;
}
x = x + 1;
```

**Non-SSA IR (hypothetical):**

```llvm
x = 1
if condition:
  x = 2
x = x + 1  // Which x? Ambiguous!
```

**SSA IR (actual LLVM):**

```llvm
define i32 @example(i1 %condition) {
entry:
  %x1 = alloca i32              ; Allocate stack space
  store i32 1, i32* %x1         ; x = 1
  br i1 %condition, label %then, label %merge

then:
  store i32 2, i32* %x1         ; x = 2
  br label %merge

merge:
  %x_val = load i32, i32* %x1   ; Load current value
  %result = add i32 %x_val, 1   ; x + 1
  ret i32 %result
}
```

**Better: Using PHI nodes (promoted to registers):**

```llvm
define i32 @example(i1 %condition) {
entry:
  br i1 %condition, label %then, label %merge

then:
  br label %merge

merge:
  %x = phi i32 [ 1, %entry ], [ 2, %then ]  ; x1 or x2?
  %result = add i32 %x, 1
  ret i32 %result
}
```

**PHI Nodes Explained:**

- `phi` instruction selects value based on predecessor block
- Format: `phi type [ value1, %pred1 ], [ value2, %pred2 ]`
- Enables SSA while representing control flow merges

### The Complete LLVM IR Type System

**Primitive Types:**

```llvm
i1      ; 1-bit integer (boolean)
i8      ; 8-bit integer (char)
i16     ; 16-bit integer (short)
i32     ; 32-bit integer (int)
i64     ; 64-bit integer (long)
i128    ; 128-bit integer
half    ; 16-bit floating point
float   ; 32-bit floating point
double  ; 64-bit floating point
```

**Derived Types:**

```llvm
i32*                    ; Pointer to i32
[10 x i32]             ; Array of 10 i32s
<4 x float>            ; Vector of 4 floats (SIMD)
{i32, i8, i32*}        ; Structure type
i32 (i32, i32)         ; Function type (takes 2 i32s, returns i32)
```

**Real Example - String in C:**

```c
char* str = "Hello";
```

**In LLVM IR:**

```llvm
@.str = private unnamed_addr constant [6 x i8] c"Hello\00"

define i8* @get_string() {
entry:
  ret i8* getelementptr inbounds ([6 x i8], [6 x i8]* @.str, i64 0, i64 0)
}
```

Breaking down `getelementptr`:

- Gets pointer to element in aggregate type
- `inbounds`: Tells optimizer access is within bounds
- `[6 x i8]* @.str`: Start from string constant
- `i64 0, i64 0`: First index: array itself, Second: first element

### Essential LLVM IR Instructions

**1. Arithmetic:**

```llvm
%sum = add i32 %a, %b              ; Addition
%diff = sub i32 %a, %b             ; Subtraction
%prod = mul i32 %a, %b             ; Multiplication
%quot = sdiv i32 %a, %b            ; Signed division
%rem = srem i32 %a, %b             ; Signed remainder
%uquot = udiv i32 %a, %b           ; Unsigned division
```

**Overflow Flags:**

```llvm
%sum = add nsw i32 %a, %b     ; No Signed Wrap
%sum = add nuw i32 %a, %b     ; No Unsigned Wrap
%prod = mul nsw nuw i32 %a, %b ; Both flags
```

**2. Memory Operations:**

```llvm
%ptr = alloca i32                  ; Allocate stack memory
%val = load i32, i32* %ptr         ; Load from memory
store i32 42, i32* %ptr            ; Store to memory
%addr = getelementptr i32, i32* %ptr, i64 1  ; Pointer arithmetic
```

**3. Control Flow:**

```llvm
br label %target                   ; Unconditional branch
br i1 %cond, label %true, label %false  ; Conditional branch
switch i32 %val, label %default [  ; Multi-way branch
  i32 0, label %case0
  i32 1, label %case1
]
ret i32 %result                    ; Return from function
```

**4. Function Calls:**

```llvm
%result = call i32 @foo(i32 %x, i32 %y)
%result = tail call i32 @foo(i32 %x, i32 %y)  ; Tail call optimization
```

**5. Comparisons:**

```llvm
%cmp = icmp eq i32 %a, %b          ; Integer compare equal
%cmp = icmp ne i32 %a, %b          ; Not equal
%cmp = icmp slt i32 %a, %b         ; Signed less than
%cmp = icmp ult i32 %a, %b         ; Unsigned less than
%cmp = fcmp olt float %x, %y       ; Floating-point ordered less than
```

**6. Type Conversions:**

```llvm
%ext = sext i32 %val to i64        ; Sign extend
%ext = zext i32 %val to i64        ; Zero extend
%trunc = trunc i64 %val to i32     ; Truncate
%int = ptrtoint i32* %ptr to i64   ; Pointer to integer
%ptr = inttoptr i64 %val to i32*   ; Integer to pointer
%fp = sitofp i32 %val to float     ; Signed int to float
```

### Complete Example: Factorial Function

**C Code:**

```c
int factorial(int n) {
    if (n <= 1)
        return 1;
    return n * factorial(n - 1);
}
```

**LLVM IR (with detailed annotations):**

```llvm
; Function declaration
define i32 @factorial(i32 %n) {
entry:
  ; Compare n <= 1
  %cmp = icmp sle i32 %n, 1
  ; Branch based on comparison
  br i1 %cmp, label %base_case, label %recursive_case

base_case:
  ; Return 1
  ret i32 1

recursive_case:
  ; Calculate n - 1
  %n_minus_1 = sub i32 %n, 1
  ; Recursively call factorial(n-1)
  %rec_result = call i32 @factorial(i32 %n_minus_1)
  ; Multiply n * factorial(n-1)
  %result = mul i32 %n, %rec_result
  ; Return result
  ret i32 %result
}
```

**Optimized Version (tail call):**

```llvm
define i32 @factorial_opt(i32 %n, i32 %acc) {
entry:
  %cmp = icmp sle i32 %n, 1
  br i1 %cmp, label %base_case, label %recursive_case

base_case:
  ret i32 %acc

recursive_case:
  %n_minus_1 = sub i32 %n, 1
  %new_acc = mul i32 %n, %acc
  %result = tail call i32 @factorial_opt(i32 %n_minus_1, i32 %new_acc)
  ret i32 %result
}
```

### IR Generation Pipeline (Clang)

**1. Lexer (clang/lib/Lex/):**

```
Source: "int x = 42;"
↓
Tokens: [INT, IDENTIFIER("x"), EQUAL, NUMBER(42), SEMICOLON]
```

**2. Parser (clang/lib/Parse/):**

```
Tokens
↓
AST: VarDecl(type=int, name="x", init=IntegerLiteral(42))
```

**3. Semantic Analysis (clang/lib/Sema/):**

```
AST
↓
Validated AST (with type information, symbol resolution)
```

**4. CodeGen (clang/lib/CodeGen/):**

```
AST
↓
LLVM IR:
  %x = alloca i32
  store i32 42, i32* %x
```

**Key CodeGen Files:**

- `CodeGenModule.cpp` - Module-level IR generation
- `CodeGenFunction.cpp` - Function-level IR generation
- `CGExpr.cpp` - Expression code generation
- `CGStmt.cpp` - Statement code generation
- `CGCall.cpp` - Function call generation

### Study Files for IR and CodeGen

**IR Core (llvm/lib/IR/):**

- `Type.cpp` (~2,500 lines) - Type system implementation
- `Value.cpp` (~1,000 lines) - Base value class
- `Instruction.cpp` (~1,500 lines) - Instruction base class
- `Instructions.cpp` (~4,000 lines) - All instruction types
- `BasicBlock.cpp` (~500 lines) - Basic block implementation
- `Function.cpp` (~1,500 lines) - Function implementation
- `Module.cpp` (~800 lines) - Module (compilation unit)
- `IRBuilder.cpp` - Helper for building IR programmatically
- `Verifier.cpp` (~4,000 lines) - IR validity checking

**Code Generation (llvm/lib/CodeGen/):**

- `SelectionDAG/` - Instruction selection using DAGs
- `GlobalISel/` - Global instruction selection (newer approach)
- `MachineFunction.cpp` - Machine-level function representation
- `RegisterAllocator/` - Register allocation algorithms
- `ScheduleDAG.cpp` - Instruction scheduling

**Target-Specific (llvm/lib/Target/X86/):**

- `X86ISelLowering.cpp` (~50,000 lines!) - Lower IR to X86
- `X86InstrInfo.td` - X86 instruction descriptions (TableGen)
- `X86RegisterInfo.td` - X86 register descriptions
- `X86CallingConv.td` - Calling conventions

## Chapter 3 — Clang Frontend

Clang is the C/C++/Objective-C compiler frontend for LLVM. It parses source code, performs semantic analysis, and generates LLVM IR.

### Clang Architecture

- **Lexer**: Tokenizes source code
- **Parser**: Builds Abstract Syntax Tree (AST)
- **Sema**: Semantic analysis and type checking
- **CodeGen**: Generates LLVM IR from AST

### Study Files

- `clang/lib/Parse/` - Parser implementation
- `clang/lib/Sema/` - Semantic analysis
- `clang/lib/CodeGen/` - IR generation

## Chapter 4 — Optimization Passes

LLVM's optimizer consists of a series of optimization passes that transform the IR to improve code quality.

### Pass Infrastructure

- **Analysis passes**: Gather information about the code
- **Transformation passes**: Modify the IR
- **Pass manager**: Orchestrates pass execution

### Study Files

- `llvm/lib/Transforms/` - Optimization passes
- `llvm/lib/Analysis/` - Analysis passes
