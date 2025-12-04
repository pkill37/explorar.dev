// LLVM Guide Configuration
import React from 'react';
import ChapterQuiz, { QuizQuestion } from '@/components/ChapterQuiz';
import { createFileRecommendationsComponent, GuideSection } from '@/lib/project-guides';

export function createLLVMGuide(
  openFileInTab: (path: string, searchPattern?: string) => void,
  markQuizComplete: (chapterId: string, score: number, total: number) => void,
  getChapterProgress: (chapterId: string) => { quizCompleted: boolean }
): GuideSection[] {
  // Chapter 1 Questions
  const ch1Questions: QuizQuestion[] = [
    {
      id: 'ch1-q1',
      question: "What is LLVM's revolutionary insight?",
      options: [
        'To create a single monolithic compiler',
        'To create a universal intermediate representation that separates frontend, middle-end, and backend concerns',
        'To use assembly language directly',
        'To compile only C and C++',
      ],
      correctAnswer: 1,
      explanation:
        "LLVM's revolutionary insight was to create a universal intermediate representation (IR) that completely separates frontend concerns (parsing, semantic analysis), middle-end concerns (target-independent optimizations), and backend concerns (code generation, register allocation).",
    },
    {
      id: 'ch1-q2',
      question: 'What are the three forms of LLVM IR?',
      options: [
        'Source, binary, and executable',
        'Human-readable (.ll), bitcode (.bc), and in-memory',
        'Assembly, object, and library',
        'C, C++, and Rust',
      ],
      correctAnswer: 1,
      explanation:
        'LLVM IR exists in three forms: human-readable text format (.ll files), binary bitcode format (.bc files), and in-memory representation used by LLVM libraries.',
    },
    {
      id: 'ch1-q3',
      question: 'What does SSA stand for and why is it important?',
      options: [
        'Single Source Analysis - for code organization',
        'Static Single Assignment - enables simpler dataflow analysis and efficient optimizations',
        'System Software Architecture - for compiler design',
        'Source Syntax Analysis - for parsing',
      ],
      correctAnswer: 1,
      explanation:
        'SSA (Static Single Assignment) means each variable is assigned exactly once. This enables simpler dataflow analysis, efficient optimizations like dead code elimination and constant propagation, and matches how compilers naturally think about values.',
    },
  ];

  // Chapter 2 Questions
  const ch2Questions: QuizQuestion[] = [
    {
      id: 'ch2-q1',
      question: 'What is a PHI node in LLVM IR?',
      options: [
        'A mathematical function',
        'An instruction that selects a value based on the predecessor basic block',
        'A type conversion instruction',
        'A memory allocation instruction',
      ],
      correctAnswer: 1,
      explanation:
        'A PHI node is an instruction that selects a value based on which basic block the control flow came from. It enables SSA form while representing control flow merges.',
    },
    {
      id: 'ch2-q2',
      question: 'What does the `getelementptr` instruction do?',
      options: [
        'Gets a pointer to an element in an aggregate type (array, struct)',
        'Gets the value at a pointer',
        'Allocates memory',
        'Converts between types',
      ],
      correctAnswer: 0,
      explanation:
        'The `getelementptr` instruction computes a pointer to an element within an aggregate type like an array or structure. It performs pointer arithmetic without dereferencing.',
    },
    {
      id: 'ch2-q3',
      question: 'What is the purpose of overflow flags like `nsw` and `nuw`?',
      options: [
        'To prevent overflow errors',
        'To enable optimizations by providing guarantees about overflow behavior',
        'To slow down execution',
        'To disable optimizations',
      ],
      correctAnswer: 1,
      explanation:
        'Flags like `nsw` (no signed wrap) and `nuw` (no unsigned wrap) tell the optimizer that overflow will not occur, enabling more aggressive optimizations while preserving program semantics.',
    },
  ];

  // Chapter 3 Questions
  const ch3Questions: QuizQuestion[] = [
    {
      id: 'ch3-q1',
      question: 'What are the main phases of Clang frontend?',
      options: [
        'Lexer, Parser, Optimizer, CodeGen',
        'Lexer, Parser, Sema (Semantic Analysis), CodeGen',
        'Parser, Optimizer, Backend',
        'Lexer, Optimizer, CodeGen',
      ],
      correctAnswer: 1,
      explanation:
        'Clang frontend consists of: Lexer (tokenizes source), Parser (builds AST), Sema (semantic analysis and type checking), and CodeGen (generates LLVM IR from AST).',
    },
    {
      id: 'ch3-q2',
      question: 'What is the AST in Clang?',
      options: [
        'Assembly Syntax Tree',
        'Abstract Syntax Tree - a tree representation of source code structure',
        'Application Source Tree',
        'Analysis Syntax Tree',
      ],
      correctAnswer: 1,
      explanation:
        'AST (Abstract Syntax Tree) is a tree representation of the syntactic structure of source code. It captures the hierarchical relationships between language constructs without including all the details of the original syntax.',
    },
  ];

  // Chapter 4 Questions
  const ch4Questions: QuizQuestion[] = [
    {
      id: 'ch4-q1',
      question: 'What is the difference between analysis passes and transformation passes?',
      options: [
        'Analysis passes modify code, transformation passes gather information',
        'Analysis passes gather information about the code, transformation passes modify the IR',
        'They are the same thing',
        'Analysis passes are for frontends, transformation passes are for backends',
      ],
      correctAnswer: 1,
      explanation:
        'Analysis passes gather information about the code (e.g., dominator tree, alias analysis) without modifying it. Transformation passes modify the IR to improve code quality (e.g., dead code elimination, constant propagation).',
    },
    {
      id: 'ch4-q2',
      question: 'What are the main categories of LLVM optimizations?',
      options: [
        'Only scalar optimizations',
        'Scalar optimizations, loop optimizations, interprocedural optimizations, and link-time optimizations',
        'Only loop optimizations',
        'Only interprocedural optimizations',
      ],
      correctAnswer: 1,
      explanation:
        'LLVM optimizations are categorized as: scalar optimizations (constant folding, dead code elimination), loop optimizations (unrolling, vectorization), interprocedural (inlining, devirtualization), and link-time (whole-program optimization).',
    },
  ];

  return [
    {
      id: 'ch1',
      title: 'Chapter 1 — Introduction to LLVM',
      body: (
        <div>
          <p>
            LLVM is a collection of modular and reusable compiler and toolchain technologies that
            has revolutionized how we build compilers. Unlike traditional monolithic compilers, LLVM
            separates concerns through a carefully designed intermediate representation (IR) that
            serves as a universal language between frontends and backends.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>
              <strong>Separation of Concerns Through IR</strong>: Frontend, middle-end, and backend
              are completely separated
            </li>
            <li>
              <strong>LLVM IR: The Universal Language</strong>: Platform-independent, strongly
              typed, SSA-based
            </li>
            <li>
              <strong>Three-Phase Architecture</strong>: Source Code → Frontend → LLVM IR →
              Optimizer → Backend → Machine Code
            </li>
            <li>
              <strong>Multiple frontends</strong> → Single IR → Multiple backends
            </li>
          </ul>
          <p>
            <strong>The Three-Phase Architecture:</strong>
          </p>
          <pre
            style={{
              background: 'var(--vscode-textCodeBlock-background)',
              padding: '12px',
              borderRadius: '4px',
              overflow: 'auto',
            }}
          >
            {`Source Code
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
Machine Code`}
          </pre>
          <p>
            <strong>Example IR - Simple Addition:</strong>
          </p>
          <pre
            style={{
              background: 'var(--vscode-textCodeBlock-background)',
              padding: '12px',
              borderRadius: '4px',
              overflow: 'auto',
            }}
          >
            {`define i32 @add(i32 %a, i32 %b) {
entry:
  %result = add nsw i32 %a, %b
  ret i32 %result
}`}
          </pre>
          {createFileRecommendationsComponent(
            [
              {
                path: 'llvm/docs/',
                description: 'LLVM documentation',
              },
            ],
            [
              {
                path: 'llvm/include/llvm/IR/',
                description: 'IR data structures and headers',
              },
              { path: 'llvm/include/llvm/IR/Type.h', description: 'Type system' },
              { path: 'llvm/include/llvm/IR/Value.h', description: 'Base class for all values' },
              { path: 'llvm/include/llvm/IR/Instruction.h', description: 'Instructions' },
              { path: 'llvm/include/llvm/IR/BasicBlock.h', description: 'Basic blocks' },
              { path: 'llvm/include/llvm/IR/Function.h', description: 'Functions' },
              { path: 'llvm/lib/IR/', description: 'IR implementation' },
              { path: 'llvm/lib/IR/Type.cpp', description: 'Type implementation' },
              { path: 'llvm/lib/IR/Verifier.cpp', description: 'IR validation' },
            ],
            openFileInTab
          )}
          <ChapterQuiz
            chapterId="ch1"
            questions={ch1Questions}
            onComplete={(score, total) => markQuizComplete('ch1', score, total)}
            isCompleted={getChapterProgress('ch1').quizCompleted}
          />
        </div>
      ),
    },
    {
      id: 'ch2',
      title: 'Chapter 2 — LLVM IR and Code Generation',
      body: (
        <div>
          <p>
            The LLVM Intermediate Representation (IR) is a low-level programming language similar to
            assembly, but with higher-level type information and a consistent three-address code
            representation. It serves as the universal language that enables LLVM&apos;s modular
            architecture.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>
              <strong>SSA Form</strong>: Each variable assigned exactly once, enabling simpler
              dataflow analysis
            </li>
            <li>
              <strong>PHI Nodes</strong>: Select values based on predecessor blocks, enabling SSA
              with control flow
            </li>
            <li>
              <strong>Type System</strong>: Strongly typed with primitive types (i32, float) and
              derived types (pointers, arrays, structs)
            </li>
            <li>
              <strong>Instruction Categories</strong>: Arithmetic, memory operations, control flow,
              function calls, comparisons, type conversions
            </li>
          </ul>
          <p>
            <strong>Why SSA (Static Single Assignment)?</strong>
          </p>
          <p>
            SSA form is fundamental to LLVM IR. Each variable is assigned exactly once, which
            enables:
          </p>
          <ul>
            <li>Simpler dataflow analysis: Definitions and uses are explicit</li>
            <li>Efficient optimizations: Dead code elimination, constant propagation</li>
            <li>Natural representation: Matches how compilers think about values</li>
          </ul>
          <p>
            <strong>Example: Factorial Function in LLVM IR</strong>
          </p>
          <pre
            style={{
              background: 'var(--vscode-textCodeBlock-background)',
              padding: '12px',
              borderRadius: '4px',
              overflow: 'auto',
            }}
          >
            {`define i32 @factorial(i32 %n) {
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
}`}
          </pre>
          {createFileRecommendationsComponent(
            [],
            [
              { path: 'llvm/lib/IR/', description: 'IR core implementation' },
              { path: 'llvm/lib/IR/Type.cpp', description: 'Type system implementation' },
              { path: 'llvm/lib/IR/Value.cpp', description: 'Base value class' },
              { path: 'llvm/lib/IR/Instruction.cpp', description: 'Instruction base class' },
              { path: 'llvm/lib/IR/Instructions.cpp', description: 'All instruction types' },
              { path: 'llvm/lib/IR/BasicBlock.cpp', description: 'Basic block implementation' },
              { path: 'llvm/lib/IR/Function.cpp', description: 'Function implementation' },
              { path: 'llvm/lib/IR/Module.cpp', description: 'Module (compilation unit)' },
              { path: 'llvm/lib/IR/IRBuilder.cpp', description: 'Helper for building IR' },
              { path: 'llvm/lib/IR/Verifier.cpp', description: 'IR validity checking' },
              {
                path: 'llvm/lib/CodeGen/',
                description: 'Code generation framework',
              },
              {
                path: 'llvm/lib/CodeGen/SelectionDAG/',
                description: 'Instruction selection using DAGs',
              },
              {
                path: 'llvm/lib/CodeGen/GlobalISel/',
                description: 'Global instruction selection',
              },
              {
                path: 'llvm/lib/CodeGen/MachineFunction.cpp',
                description: 'Machine-level function representation',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz
            chapterId="ch2"
            questions={ch2Questions}
            onComplete={(score, total) => markQuizComplete('ch2', score, total)}
            isCompleted={getChapterProgress('ch2').quizCompleted}
          />
        </div>
      ),
    },
    {
      id: 'ch3',
      title: 'Chapter 3 — Clang Frontend',
      body: (
        <div>
          <p>
            Clang is the C/C++/Objective-C compiler frontend for LLVM. It parses source code,
            performs semantic analysis, and generates LLVM IR.
          </p>
          <p>
            <strong>Clang Architecture:</strong>
          </p>
          <ul>
            <li>
              <strong>Lexer</strong>: Tokenizes source code into tokens (keywords, identifiers,
              operators)
            </li>
            <li>
              <strong>Parser</strong>: Builds Abstract Syntax Tree (AST) from tokens
            </li>
            <li>
              <strong>Sema</strong>: Semantic analysis and type checking, symbol resolution
            </li>
            <li>
              <strong>CodeGen</strong>: Generates LLVM IR from validated AST
            </li>
          </ul>
          <p>
            <strong>IR Generation Pipeline:</strong>
          </p>
          <pre
            style={{
              background: 'var(--vscode-textCodeBlock-background)',
              padding: '12px',
              borderRadius: '4px',
              overflow: 'auto',
            }}
          >
            {`Source: "int x = 42;"
    ↓
Lexer → Tokens: [INT, IDENTIFIER("x"), EQUAL, NUMBER(42), SEMICOLON]
    ↓
Parser → AST: VarDecl(type=int, name="x", init=IntegerLiteral(42))
    ↓
Sema → Validated AST (with type information, symbol resolution)
    ↓
CodeGen → LLVM IR:
  %x = alloca i32
  store i32 42, i32* %x`}
          </pre>
          <p>
            <strong>Key Frontend Responsibilities:</strong>
          </p>
          <ul>
            <li>Type checking and semantic validation</li>
            <li>Symbol table management</li>
            <li>Template instantiation (C++)</li>
            <li>Debug information generation</li>
          </ul>
          {createFileRecommendationsComponent(
            [],
            [
              {
                path: 'clang/include/clang/',
                description: 'Clang headers',
              },
              { path: 'clang/include/clang/AST/', description: 'Abstract Syntax Tree' },
              { path: 'clang/include/clang/Parse/', description: 'Parser' },
              { path: 'clang/include/clang/Sema/', description: 'Semantic analysis' },
              { path: 'clang/include/clang/CodeGen/', description: 'IR generation' },
              { path: 'clang/lib/Parse/', description: 'Parser implementation' },
              { path: 'clang/lib/Sema/', description: 'Semantic analysis implementation' },
              { path: 'clang/lib/CodeGen/', description: 'CodeGen implementation' },
              {
                path: 'clang/lib/CodeGen/CodeGenModule.cpp',
                description: 'Module-level IR generation',
              },
              {
                path: 'clang/lib/CodeGen/CodeGenFunction.cpp',
                description: 'Function-level IR generation',
              },
              { path: 'clang/lib/CodeGen/CGExpr.cpp', description: 'Expression code generation' },
              { path: 'clang/lib/CodeGen/CGStmt.cpp', description: 'Statement code generation' },
              { path: 'clang/lib/CodeGen/CGCall.cpp', description: 'Function call generation' },
            ],
            openFileInTab
          )}
          <ChapterQuiz
            chapterId="ch3"
            questions={ch3Questions}
            onComplete={(score, total) => markQuizComplete('ch3', score, total)}
            isCompleted={getChapterProgress('ch3').quizCompleted}
          />
        </div>
      ),
    },
    {
      id: 'ch4',
      title: 'Chapter 4 — Optimization Passes',
      body: (
        <div>
          <p>
            LLVM&apos;s optimizer consists of a series of optimization passes that transform the IR
            to improve code quality. Optimizations are organized as passes that can be analysis
            (gather information) or transformation (modify IR).
          </p>
          <p>
            <strong>Pass Infrastructure:</strong>
          </p>
          <ul>
            <li>
              <strong>Analysis passes</strong>: Gather information about the code (e.g., dominator
              tree, alias analysis, call graph)
            </li>
            <li>
              <strong>Transformation passes</strong>: Modify the IR to improve code quality (e.g.,
              dead code elimination, constant propagation, inlining)
            </li>
            <li>
              <strong>Pass manager</strong>: Orchestrates pass execution, manages dependencies
            </li>
          </ul>
          <p>
            <strong>Pass Categories:</strong>
          </p>
          <ul>
            <li>
              <strong>Scalar optimizations</strong>: Constant folding, dead code elimination,
              instruction combining
            </li>
            <li>
              <strong>Loop optimizations</strong>: Loop unrolling, vectorization, loop-invariant
              code motion
            </li>
            <li>
              <strong>Interprocedural</strong>: Inlining, devirtualization, global optimizations
            </li>
            <li>
              <strong>Link-time</strong>: Whole-program optimization across multiple compilation
              units
            </li>
          </ul>
          {createFileRecommendationsComponent(
            [],
            [
              {
                path: 'llvm/lib/Transforms/',
                description: 'Optimization passes',
              },
              {
                path: 'llvm/lib/Transforms/Scalar/',
                description: 'Scalar optimizations',
              },
              {
                path: 'llvm/lib/Transforms/Scalar/DCE.cpp',
                description: 'Dead code elimination',
              },
              {
                path: 'llvm/lib/Transforms/Scalar/SCCP.cpp',
                description: 'Constant propagation',
              },
              {
                path: 'llvm/lib/Transforms/Utils/Mem2Reg.cpp',
                description: 'Promote allocas to registers',
              },
              {
                path: 'llvm/lib/Analysis/',
                description: 'Analysis passes',
              },
              {
                path: 'llvm/include/llvm/Analysis/CFG.h',
                description: 'Control flow graph',
              },
              {
                path: 'llvm/lib/Analysis/ScalarEvolution.cpp',
                description: 'Loop analysis',
              },
              {
                path: 'llvm/lib/Analysis/MemorySSA.cpp',
                description: 'Memory dependencies',
              },
              {
                path: 'llvm/lib/Transforms/IPO/',
                description: 'Interprocedural optimizations',
              },
              {
                path: 'llvm/lib/Transforms/Vectorize/',
                description: 'Vectorization passes',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz
            chapterId="ch4"
            questions={ch4Questions}
            onComplete={(score, total) => markQuizComplete('ch4', score, total)}
            isCompleted={getChapterProgress('ch4').quizCompleted}
          />
        </div>
      ),
    },
  ];
}
