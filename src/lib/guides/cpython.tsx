// CPython Guide Configuration
import React from 'react';
import ChapterQuiz, { QuizQuestion } from '@/components/ChapterQuiz';
import { createFileRecommendationsComponent, GuideSection } from '@/lib/project-guides';

export function createCPythonGuide(
  openFileInTab: (path: string, searchPattern?: string) => void
): GuideSection[] {
  // Chapter 1 Questions
  const ch1Questions: QuizQuestion[] = [
    {
      id: 'ch1-q1',
      question: 'What is CPython?',
      options: [
        'A Python library',
        'The reference implementation of Python, written in C, that compiles Python to bytecode and executes it on a virtual machine',
        'A Python package manager',
        'A Python IDE',
      ],
      correctAnswer: 1,
      explanation:
        'CPython is the reference implementation of Python, written in C. It compiles Python source code to bytecode and executes it on a stack-based virtual machine.',
    },
    {
      id: 'ch1-q2',
      question: 'What does "everything is an object" mean in Python?',
      options: [
        'Only classes are objects',
        'Everything—integers, functions, classes, modules, even types themselves—is an object with a uniform interface',
        'Only functions are objects',
        'Only strings are objects',
      ],
      correctAnswer: 1,
      explanation:
        'In Python, everything is an object. This uniform object model simplifies the language design and enables powerful features like introspection, dynamic typing, and metaprogramming.',
    },
    {
      id: 'ch1-q3',
      question: 'What is the Global Interpreter Lock (GIL)?',
      options: [
        'A file lock',
        'A mutex that protects access to Python objects, preventing multiple native threads from executing Python bytecodes at once',
        'A network lock',
        'A database lock',
      ],
      correctAnswer: 1,
      explanation:
        'The GIL is a mutex that protects access to Python objects, preventing multiple native threads from executing Python bytecodes simultaneously. This simplifies memory management but limits CPU-bound parallelism.',
    },
  ];

  // Chapter 2 Questions
  const ch2Questions: QuizQuestion[] = [
    {
      id: 'ch2-q1',
      question: 'What is the main evaluation loop in CPython?',
      options: [
        'Python/compile.c',
        'Python/ceval.c - the heart of CPython that interprets bytecode',
        'Python/import.c',
        'Python/ast.c',
      ],
      correctAnswer: 1,
      explanation:
        "Python/ceval.c contains the main evaluation loop that interprets bytecode instructions, manipulating a value stack and maintaining execution frames. It's the heart of CPython execution.",
    },
    {
      id: 'ch2-q2',
      question: 'What are the main directories in CPython source?',
      options: [
        'Only Python/',
        'Python/ (core interpreter), Objects/ (object implementations), Include/ (headers), Parser/ (parsing), Modules/ (C extensions)',
        'Only Objects/',
        'Only Modules/',
      ],
      correctAnswer: 1,
      explanation:
        'CPython is organized into: Python/ (~100k lines of core interpreter), Objects/ (~150k lines of object implementations), Include/ (header files), Parser/ (parsing), and Modules/ (C extension modules).',
    },
    {
      id: 'ch2-q3',
      question: 'What is the compilation pipeline in CPython?',
      options: [
        'Source → Executable',
        'Source → Tokens → AST → Bytecode → Execution',
        'Source → Machine code',
        'Source → Assembly',
      ],
      correctAnswer: 1,
      explanation:
        "CPython's compilation pipeline: tokenization (tokenizer.c), parsing (parser.c), AST generation (ast.c), and bytecode generation (compile.c). The bytecode is then executed by the evaluation loop.",
    },
  ];

  // Chapter 3 Questions
  const ch3Questions: QuizQuestion[] = [
    {
      id: 'ch3-q1',
      question: 'What is PyObject?',
      options: [
        'A Python module',
        'The base structure that all Python objects inherit from, containing type pointer and reference count',
        'A Python function',
        'A Python class',
      ],
      correctAnswer: 1,
      explanation:
        'PyObject is the base structure for all Python objects. It contains a type pointer (defining behavior) and a reference count (for memory management). This enables polymorphism.',
    },
    {
      id: 'ch3-q2',
      question: 'How does CPython manage memory?',
      options: [
        'Only garbage collection',
        'A combination of reference counting (immediate deallocation) and cyclic garbage collection (for cycles)',
        'Only reference counting',
        'Manual memory management',
      ],
      correctAnswer: 1,
      explanation:
        'CPython uses reference counting as the primary mechanism (immediate deallocation when count reaches zero) and a cyclic garbage collector to handle circular references that reference counting cannot detect.',
    },
    {
      id: 'ch3-q3',
      question: 'What is a PyTypeObject?',
      options: [
        'A Python type annotation',
        'A structure that defines how objects of a particular type behave: methods, creation, comparison, string representation',
        'A Python variable',
        'A Python function',
      ],
      correctAnswer: 1,
      explanation:
        'PyTypeObject is a structure that defines type behavior. In Python, types are themselves objects, and PyTypeObject contains function pointers for methods, creation, comparison, and other operations.',
    },
  ];

  // Chapter 4 Questions
  const ch4Questions: QuizQuestion[] = [
    {
      id: 'ch4-q1',
      question: 'How are Python integers implemented?',
      options: [
        'As fixed-size 64-bit integers',
        'As arbitrary precision integers using variable-length representation',
        'As 32-bit integers only',
        'As floating point numbers',
      ],
      correctAnswer: 1,
      explanation:
        'Python integers have arbitrary precision, meaning they can represent numbers of any size limited only by available memory. CPython implements this using a variable-length representation.',
    },
    {
      id: 'ch4-q2',
      question: 'How are Python lists implemented?',
      options: [
        'As linked lists',
        'As dynamic arrays (similar to C++ std::vector) with contiguous memory and automatic resizing',
        'As hash tables',
        'As binary trees',
      ],
      correctAnswer: 1,
      explanation:
        'Python lists are implemented as dynamic arrays that maintain a contiguous block of pointers to objects, automatically resizing when capacity is exceeded. This enables O(1) indexing.',
    },
    {
      id: 'ch4-q3',
      question: 'How are Python dictionaries implemented?',
      options: [
        'As binary trees',
        'As hash tables with open addressing, maintaining insertion order (Python 3.7+)',
        'As linked lists',
        'As arrays',
      ],
      correctAnswer: 1,
      explanation:
        'Python dictionaries are implemented as hash tables with open addressing. They use a clever probing strategy and maintain insertion order (as of Python 3.7), achieving average O(1) lookups.',
    },
  ];

  // Chapter 5 Questions
  const ch5Questions: QuizQuestion[] = [
    {
      id: 'ch5-q1',
      question: 'What does the evaluation loop in ceval.c do?',
      options: [
        'Compiles Python code',
        'Interprets bytecode instructions, manipulating a value stack and maintaining execution frames',
        'Parses Python syntax',
        'Generates machine code',
      ],
      correctAnswer: 1,
      explanation:
        'The evaluation loop in ceval.c interprets bytecode instructions one by one, manipulating a value stack and maintaining execution frames. Each bytecode instruction is a case in a large switch statement.',
    },
    {
      id: 'ch5-q2',
      question: 'What is a frame in CPython?',
      options: [
        'A window in the GUI',
        'An execution context containing local variables, value stack, and execution state for a function call',
        'A data structure for graphics',
        'A network frame',
      ],
      correctAnswer: 1,
      explanation:
        'A frame is an execution context created for each function call. It contains local variables, the value stack, and execution state. Frames are linked to form the call stack.',
    },
    {
      id: 'ch5-q3',
      question: 'What are bytecode instructions?',
      options: [
        'Machine code instructions',
        'Simple instructions that operate on a value stack, like LOAD_FAST, STORE_FAST, BINARY_ADD, CALL_FUNCTION',
        'Assembly instructions',
        'Python source code',
      ],
      correctAnswer: 1,
      explanation:
        'Bytecode instructions are simple operations that manipulate a value stack. Examples include LOAD_FAST (load local variable), STORE_FAST (store local), BINARY_ADD (add two values), and CALL_FUNCTION (call a function).',
    },
  ];

  return [
    {
      id: 'ch1',
      title: 'Chapter 1 — Understanding CPython Before Code',
      body: (
        <div>
          <p>
            CPython is both a compiler and an interpreter. It compiles Python source code to
            bytecode, then executes that bytecode on a stack-based virtual machine. Understanding
            this dual nature reveals how Python achieves its balance between high-level
            expressiveness and runtime efficiency.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>
              <strong>Everything is an object:</strong> Integers, functions, classes, modules, even
              types themselves are objects with a uniform interface
            </li>
            <li>
              <strong>The GIL:</strong> A mutex that protects Python objects, simplifying memory
              management but limiting CPU-bound parallelism
            </li>
            <li>
              <strong>Memory Management:</strong> Reference counting (immediate) + cyclic garbage
              collection (for cycles)
            </li>
            <li>
              <strong>Compilation Pipeline:</strong> Source → Tokens → AST → Bytecode → Execution
            </li>
          </ul>
          <p>
            <strong>CPython Architecture:</strong>
          </p>
          <pre
            style={{
              background: 'var(--vscode-textCodeBlock-background)',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
            }}
          >
            {`Python Source Code
    ↓
Tokenizer (tokenizer.c)
    ↓
Parser (parser.c) → AST
    ↓
Compiler (compile.c) → Bytecode
    ↓
Evaluation Loop (ceval.c)
    ↓
Results`}
          </pre>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Doc/c-api/object.rst',
                description: 'Object protocol documentation',
              },
              {
                path: 'Doc/c-api/init.rst',
                description: 'Initialization and finalization',
              },
              {
                path: 'Doc/c-api/memory.rst',
                description: 'Memory management documentation',
              },
            ],
            [
              {
                path: 'Python/ceval.c',
                description: 'Main evaluation loop (~6,000 lines)',
              },
              {
                path: 'Python/compile.c',
                description: 'Bytecode compiler (~6,000 lines)',
              },
              {
                path: 'Objects/object.c',
                description: 'Base object implementation',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch1" questions={ch1Questions} />
        </div>
      ),
    },
    {
      id: 'ch2',
      title: 'Chapter 2 — Source Code Structure',
      body: (
        <div>
          <p>
            The CPython source code is organized into clear directories, each serving a specific
            purpose. Understanding this structure provides a roadmap for exploring the
            interpreter&apos;s internals.
          </p>
          <p>
            <strong>Key Directories:</strong>
          </p>
          <ul>
            <li>
              <strong>Python/</strong> (~100k lines): Core interpreter including ceval.c, compile.c,
              import.c, bltinmodule.c
            </li>
            <li>
              <strong>Objects/</strong> (~150k lines): Object implementations including
              longobject.c, unicodeobject.c, listobject.c, dictobject.c
            </li>
            <li>
              <strong>Include/</strong>: Header files including Python.h, object.h, and internal
              APIs
            </li>
            <li>
              <strong>Parser/</strong> (~30k lines): Tokenization and parsing (PEG parser in 3.9+)
            </li>
            <li>
              <strong>Modules/</strong>: C extension modules like gcmodule.c, _threadmodule.c
            </li>
            <li>
              <strong>Lib/</strong>: Pure Python standard library
            </li>
          </ul>
          <p>
            <strong>Compilation Pipeline:</strong>
          </p>
          <ol>
            <li>
              <strong>Tokenization:</strong> Parser/tokenizer.c converts source to tokens
            </li>
            <li>
              <strong>Parsing:</strong> Parser/parser.c builds an Abstract Syntax Tree (AST)
            </li>
            <li>
              <strong>AST Processing:</strong> Python/ast.c validates and transforms the AST
            </li>
            <li>
              <strong>Bytecode Generation:</strong> Python/compile.c generates bytecode from AST
            </li>
            <li>
              <strong>Execution:</strong> Python/ceval.c interprets the bytecode
            </li>
          </ol>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Doc/c-api/veryhigh.rst',
                description: 'High-level compilation API',
              },
              {
                path: 'Doc/c-api/init.rst',
                description: 'Interpreter initialization',
              },
            ],
            [
              {
                path: 'Parser/tokenizer.c',
                description: 'Tokenizes Python source code',
              },
              {
                path: 'Parser/parser.c',
                description: 'PEG parser (parses tokens into AST)',
              },
              {
                path: 'Python/ast.c',
                description: 'AST manipulation and validation',
              },
              {
                path: 'Python/compile.c',
                description: 'Compiles AST to bytecode',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch2" questions={ch2Questions} />
        </div>
      ),
    },
    {
      id: 'ch3',
      title: 'Chapter 3 — The Object Model',
      body: (
        <div>
          <p>
            All Python objects in CPython are represented by structures that begin with PyObject (or
            PyObject_HEAD). This common header contains the object&apos;s type pointer and reference
            count, enabling polymorphism and uniform memory management.
          </p>
          <p>
            <strong>PyObject Structure:</strong>
          </p>
          <pre
            style={{
              background: 'var(--vscode-textCodeBlock-background)',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
            }}
          >
            {`typedef struct _object {
    Py_ssize_t ob_refcnt;  // Reference count
    PyTypeObject *ob_type; // Type pointer
} PyObject;`}
          </pre>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>
              <strong>Type Objects:</strong> Types are themselves objects (PyTypeObject). They
              define behavior through function pointers for methods, creation, comparison, etc.
            </li>
            <li>
              <strong>Reference Counting:</strong> Every object maintains a reference count. When it
              reaches zero, the object is immediately deallocated. Operations: Py_INCREF(),
              Py_DECREF()
            </li>
            <li>
              <strong>Garbage Collection:</strong> The cyclic garbage collector (gcmodule.c)
              periodically scans for unreachable cycles and collects them, handling cases that
              reference counting cannot.
            </li>
          </ul>
          <p>
            <strong>Memory Management Flow:</strong>
          </p>
          <ol>
            <li>Object created: ob_refcnt = 1</li>
            <li>Reference added: Py_INCREF() → ob_refcnt++</li>
            <li>Reference removed: Py_DECREF() → ob_refcnt--</li>
            <li>When ob_refcnt reaches 0: Object deallocated immediately</li>
            <li>Cyclic references: GC detects and collects cycles periodically</li>
          </ol>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Doc/c-api/object.rst',
                description: 'Object protocol',
              },
              {
                path: 'Doc/c-api/typeobj.rst',
                description: 'Type objects',
              },
              {
                path: 'Doc/c-api/refcounting.rst',
                description: 'Reference counting',
              },
              {
                path: 'Doc/c-api/gcsupport.rst',
                description: 'Garbage collector support',
              },
            ],
            [
              {
                path: 'Objects/object.c',
                description: 'Base object implementation',
              },
              {
                path: 'Include/object.h',
                description: 'Object structure definitions',
              },
              {
                path: 'Objects/typeobject.c',
                description: 'Type object implementation (~8,000 lines)',
              },
              {
                path: 'Modules/gcmodule.c',
                description: 'Garbage collector implementation (~2,000 lines)',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch3" questions={ch3Questions} />
        </div>
      ),
    },
    {
      id: 'ch4',
      title: 'Chapter 4 — Built-in Types',
      body: (
        <div>
          <p>
            CPython implements Python&apos;s built-in types with sophisticated data structures
            optimized for performance and memory efficiency. Understanding these implementations
            reveals how Python achieves its elegant API while maintaining efficiency.
          </p>
          <p>
            <strong>Integer Implementation (longobject.c):</strong>
          </p>
          <ul>
            <li>Arbitrary precision: Can represent numbers of any size (limited by memory)</li>
            <li>Variable-length representation: Allocates more memory as numbers grow</li>
            <li>Small integer caching: Integers from -5 to 256 are cached for performance</li>
          </ul>
          <p>
            <strong>String Implementation (unicodeobject.c):</strong>
          </p>
          <ul>
            <li>Immutable sequences of Unicode code points</li>
            <li>Multiple internal representations: ASCII, compact Unicode, or legacy strings</li>
            <li>String interning: Some strings are interned (cached) for performance</li>
          </ul>
          <p>
            <strong>List Implementation (listobject.c):</strong>
          </p>
          <ul>
            <li>Dynamic arrays: Contiguous block of pointers to objects</li>
            <li>Automatic resizing: Grows when capacity exceeded (typically 1.125x growth)</li>
            <li>O(1) indexing, amortized O(1) append</li>
          </ul>
          <p>
            <strong>Dictionary Implementation (dictobject.c):</strong>
          </p>
          <ul>
            <li>Hash tables with open addressing</li>
            <li>Maintains insertion order (Python 3.7+)</li>
            <li>Average O(1) lookups, insertions, deletions</li>
            <li>Clever probing strategy to handle collisions</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Doc/c-api/long.rst',
                description: 'Integer objects',
              },
              {
                path: 'Doc/c-api/unicode.rst',
                description: 'Unicode objects',
              },
              {
                path: 'Doc/c-api/list.rst',
                description: 'List objects',
              },
              {
                path: 'Doc/c-api/dict.rst',
                description: 'Dictionary objects',
              },
            ],
            [
              {
                path: 'Objects/longobject.c',
                description: 'Integer implementation (~5,000 lines)',
              },
              {
                path: 'Objects/unicodeobject.c',
                description: 'Unicode string implementation (~15,000 lines)',
              },
              {
                path: 'Objects/listobject.c',
                description: 'List implementation (~3,000 lines)',
              },
              {
                path: 'Objects/dictobject.c',
                description: 'Dictionary implementation (~6,000 lines)',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch4" questions={ch4Questions} />
        </div>
      ),
    },
    {
      id: 'ch5',
      title: 'Chapter 5 — The Evaluation Loop',
      body: (
        <div>
          <p>
            The heart of CPython is the evaluation loop in ceval.c. This function interprets
            bytecode instructions, manipulating a value stack and maintaining execution frames. Each
            bytecode instruction is a case in a large switch statement.
          </p>
          <p>
            <strong>Execution Model:</strong>
          </p>
          <ul>
            <li>
              <strong>Stack-based VM:</strong> Bytecode operates on a value stack
            </li>
            <li>
              <strong>Frames:</strong> Each function call creates a new frame with local variables,
              value stack, and execution state
            </li>
            <li>
              <strong>Bytecode Instructions:</strong> Simple operations like LOAD_FAST, STORE_FAST,
              BINARY_ADD, CALL_FUNCTION
            </li>
          </ul>
          <p>
            <strong>Example Bytecode:</strong>
          </p>
          <pre
            style={{
              background: 'var(--vscode-textCodeBlock-background)',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
            }}
          >
            {`def add(a, b):
    return a + b

# Bytecode (use dis.dis() to see):
LOAD_FAST    0  # Load 'a' onto stack
LOAD_FAST    1  # Load 'b' onto stack
BINARY_ADD      # Pop two values, add, push result
RETURN_VALUE    # Return top of stack`}
          </pre>
          <p>
            <strong>Key Bytecode Instructions:</strong>
          </p>
          <ul>
            <li>
              <strong>LOAD_FAST:</strong> Load local variable onto stack
            </li>
            <li>
              <strong>STORE_FAST:</strong> Store value from stack to local variable
            </li>
            <li>
              <strong>BINARY_ADD:</strong> Pop two values, add them, push result
            </li>
            <li>
              <strong>CALL_FUNCTION:</strong> Call a function with arguments from stack
            </li>
            <li>
              <strong>RETURN_VALUE:</strong> Return value from top of stack
            </li>
          </ul>
          <p>
            <strong>Frame Structure:</strong>
          </p>
          <p>Each frame contains:</p>
          <ul>
            <li>Local variables (fast locals array)</li>
            <li>Value stack (for intermediate computations)</li>
            <li>Code object (bytecode and metadata)</li>
            <li>Global and builtin namespaces</li>
            <li>Previous frame (for call stack)</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Doc/c-api/init.rst',
                description: 'Interpreter state',
              },
              {
                path: 'Doc/library/dis.rst',
                description: 'Disassembler module',
              },
            ],
            [
              {
                path: 'Python/ceval.c',
                description: 'Main evaluation loop (the heart of CPython)',
              },
              {
                path: 'Include/opcode.h',
                description: 'Bytecode opcode definitions',
              },
              {
                path: 'Python/frameobject.c',
                description: 'Frame object implementation',
              },
              {
                path: 'Python/compile.c',
                description: 'Bytecode generation',
              },
              {
                path: 'Lib/dis.py',
                description: 'Bytecode disassembler (Python module)',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch5" questions={ch5Questions} />
        </div>
      ),
    },
  ];
}
