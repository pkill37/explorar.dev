# CPython In The Mind

## Understanding CPython Before Code

> This isn't a guide to writing Python code. It's an effort to understand how CPython thinks.

CPython is the reference implementation of Python, written in C. It compiles Python source code to bytecode and executes it on a virtual machine. Understanding CPython's internals reveals how Python's elegant syntax translates into efficient execution, how objects are managed in memory, and how the interpreter orchestrates program execution.

This guide is for anyone who wants to build a mental model of how CPython works—before diving deep into the source code. Whether you're exploring Python internals for the first time or returning with new questions, the focus here is on **behavior, not syntax**.

**CPython runs Python. Let's understand how it runs.**

---

## Chapter 1 — Understanding CPython Before Code

### CPython Is Not Just a Compiler. It Is an Interpreter.

CPython is both a compiler and an interpreter. It compiles Python source code to bytecode, then executes that bytecode on a stack-based virtual machine. Understanding this dual nature reveals how Python achieves its balance between high-level expressiveness and runtime efficiency. The compilation phase handles syntax analysis and optimization, while the interpreter handles execution, memory management, and dynamic behavior.

**Documentation:**

- [Doc/c-api/](Doc/c-api/) - Python C API reference
- [Doc/extending/](Doc/extending/) - Extending Python with C

### Everything Is an Object: The Foundation of Python

In Python, everything is an object—integers, functions, classes, modules, even types themselves. This uniform object model simplifies the language design and enables powerful features like introspection, dynamic typing, and metaprogramming. Understanding this principle reveals how CPython manages memory, implements polymorphism, and provides a consistent interface across all language constructs.

**Documentation:**

- [Doc/c-api/object.rst](Doc/c-api/object.rst) - Object protocol
- [Doc/c-api/typeobj.rst](Doc/c-api/typeobj.rst) - Type objects

### The Global Interpreter Lock (GIL): Concurrency in CPython

The Global Interpreter Lock (GIL) is a mutex that protects access to Python objects, preventing multiple native threads from executing Python bytecodes at once. While this simplifies memory management and makes CPython thread-safe, it also means that CPU-bound Python code cannot fully utilize multiple cores. Understanding the GIL reveals the trade-offs in CPython's design and why it exists despite its limitations.

**Documentation:**

- [Doc/c-api/init.rst](Doc/c-api/init.rst) - Initialization and finalization
- [Doc/glossary.rst](Doc/glossary.rst) - GIL definition

### Memory Management: Reference Counting and Garbage Collection

CPython uses a combination of reference counting and a cyclic garbage collector for memory management. Every object maintains a reference count, and when it reaches zero, the object is immediately deallocated. However, reference counting alone cannot handle circular references, so CPython includes a garbage collector that detects and collects cycles. Understanding this dual approach reveals how CPython balances performance with correctness.

**Documentation:**

- [Doc/c-api/memory.rst](Doc/c-api/memory.rst) - Memory management
- [Doc/c-api/gcsupport.rst](Doc/c-api/gcsupport.rst) - Garbage collector support

---

## Learning Path for CPython Exploration

This guide follows a structured learning path designed to master Python internals:

### Beginner Path (Months 1-3)

1. **Python Basics**: Solid understanding of Python language features
2. **C Programming**: Comfortable reading C code
3. **Bytecode Exploration**: Use `dis` module to see bytecode
4. **Simple Tracing**: Trace Python execution with sys.settrace

**Practical Start:**

```python
import dis

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

# See the bytecode
dis.dis(factorial)
```

### Intermediate Path (Months 4-6)

1. **Object Model**: Study PyObject and type system
2. **Memory Management**: Understand reference counting and GC
3. **Built-in Types**: Deep dive into list, dict, str implementations
4. **Extension Modules**: Write C extensions for Python

**Key Projects:**

- Write a simple C extension module
- Implement a custom Python type in C
- Study how built-in functions work

### Advanced Path (Months 7-12)

1. **Evaluation Loop**: Master ceval.c and bytecode execution
2. **Compiler Pipeline**: Study compilation from AST to bytecode
3. **GIL Internals**: Understand GIL acquisition and release
4. **Advanced Features**: Generators, coroutines, metaclasses

**Advanced Projects:**

- Modify CPython to add a custom bytecode
- Implement a tracing JIT for specific operations
- Profile and optimize CPython performance

### Expert Path (Year 2+)

1. **CPython Contribution**: Submit patches to CPython
2. **Performance Optimization**: Profile and optimize critical paths
3. **Alternative Implementations**: Study PyPy, Cython
4. **Research**: Implement PEPs or research papers

---

## Chapter 2 — Source Code Structure

### A Walk Through the CPython Source: Understanding Its Organization

The CPython source code is organized into clear directories, each serving a specific purpose. Understanding this structure provides a roadmap for exploring the interpreter's internals.

**Detailed Directory Structure:**

```
cpython/
├── Python/                    # Core interpreter (~100k lines)
│   ├── ceval.c               # Main evaluation loop (~6,000 lines!)
│   ├── compile.c             # Bytecode compiler (~6,000 lines)
│   ├── ast.c                 # AST manipulation
│   ├── import.c              # Import system
│   ├── bltinmodule.c         # Built-in functions
│   ├── pystate.c             # Interpreter state
│   └── frame.c               # Frame objects
├── Objects/                   # Object implementations (~150k lines)
│   ├── object.c              # Base PyObject
│   ├── typeobject.c          # Type system (~8,000 lines)
│   ├── longobject.c          # Integer implementation (~5,000 lines)
│   ├── unicodeobject.c       # String implementation (~15,000 lines!)
│   ├── listobject.c          # List implementation (~3,000 lines)
│   ├── dictobject.c          # Dictionary (~6,000 lines)
│   ├── setobject.c           # Set implementation
│   ├── funcobject.c          # Function objects
│   ├── classobject.c         # Class/method objects
│   ├── genobject.c           # Generator objects
│   └── descrobject.c         # Descriptors (properties, etc.)
├── Include/                   # Header files
│   ├── Python.h              # Main header (includes everything)
│   ├── object.h              # PyObject definition
│   ├── cpython/              # CPython-specific (not stable API)
│   │   ├── object.h          # Internal object details
│   │   └── pystate.h         # Interpreter state internals
│   ├── internal/             # Internal CPython APIs
│   │   ├── pycore_*.h        # Core internal headers
│   │   └── pycore_gc.h       # GC internals
│   ├── methodobject.h        # Method objects
│   ├── funcobject.h          # Function objects
│   └── code.h                # Code objects
├── Parser/                    # Parsing (~30k lines)
│   ├── tokenizer.c           # Lexical analysis
│   ├── parser.c              # PEG parser (new in 3.9)
│   ├── pegen/                # PEG parser generator
│   └── token.c               # Token definitions
├── Modules/                   # C extension modules
│   ├── _abc.c                # ABC (abstract base classes)
│   ├── gcmodule.c            # Garbage collector (~2,000 lines)
│   ├── _threadmodule.c       # Threading primitives
│   ├── _io/                  # I/O implementation
│   ├── _json.c               # JSON parser
│   └── mathmodule.c          # Math functions
├── Lib/                       # Pure Python stdlib
│   ├── collections/          # Collections module
│   ├── asyncio/              # Async I/O
│   ├── importlib/            # Import implementation
│   ├── dis.py                # Bytecode disassembler
│   └── ast.py                # AST utilities
├── Programs/                  # Main programs
│   └── python.c              # Python executable entry point
└── Doc/                       # Documentation source
    ├── c-api/                # C API documentation
    ├── library/              # Standard library docs
    └── reference/            # Language reference
```

**Key File Statistics:**

- Total C code: ~500,000 lines
- Core interpreter (Python/): ~100,000 lines
- Object implementations (Objects/): ~150,000 lines
- Standard library (Lib/): ~500,000+ lines of Python

**Documentation:**

- [Doc/](Doc/) - Official Python documentation
- [Doc/using/](Doc/using/) - Using Python
- [Doc/c-api/](Doc/c-api/) - Complete C API reference
- [InternalDocs/](InternalDocs/) - Internal implementation notes

### The Compilation Pipeline: From Source to Bytecode

CPython's compilation process transforms Python source code into bytecode through several stages: tokenization, parsing, AST generation, and bytecode generation. Understanding this pipeline reveals how Python's syntax is analyzed and how optimizations are applied before execution.

**Key Files:**

- `Parser/tokenizer.c` - Tokenizes Python source code
- `Parser/parser.c` - Parses tokens into abstract syntax trees
- `Python/ast.c` - AST manipulation and validation
- `Python/compile.c` - Compiles AST to bytecode

**Documentation:**

- [Doc/c-api/veryhigh.rst](Doc/c-api/veryhigh.rst) - High-level compilation API

### The Execution Model: Bytecode to Results

CPython executes bytecode using a stack-based virtual machine. The main evaluation loop (`ceval.c`) interprets bytecode instructions, manipulating a value stack and maintaining execution frames. Understanding this model reveals how Python's dynamic features—like dynamic attribute access and method resolution—are implemented at runtime.

**Key Files:**

- `Python/ceval.c` - Main evaluation loop (the heart of CPython)
- `Python/frameobject.c` - Execution frame management
- `Include/opcode.h` - Bytecode instruction definitions

**Documentation:**

- [Doc/c-api/init.rst](Doc/c-api/init.rst) - Interpreter initialization

---

## Chapter 3 — The Object Model

### PyObject: The Base of Everything

All Python objects in CPython are represented by structures that begin with `PyObject` (or `PyObject_HEAD`). This common header contains the object's type pointer and reference count. This design enables polymorphism: any function that accepts a `PyObject*` can work with any Python object, and the type system determines the correct behavior at runtime.

**Key Files:**

- `Objects/object.c` - Base object implementation
- `Include/object.h` - Object structure definitions
- `Objects/typeobject.c` - Type object implementation

**Documentation:**

- [Doc/c-api/object.rst](Doc/c-api/object.rst) - Object protocol

### Type Objects: Defining Behavior

In Python, types are themselves objects. The `PyTypeObject` structure defines how objects of a particular type behave: what methods they support, how they're created, how they're compared, and how they're represented as strings. Understanding type objects reveals how Python's dynamic typing and method resolution work.

**Key Files:**

- `Objects/typeobject.c` - Type object implementation
- `Include/cpython/object.h` - Type object structure
- `Objects/abstract.c` - Abstract object protocol

**Documentation:**

- [Doc/c-api/typeobj.rst](Doc/c-api/typeobj.rst) - Type objects

### Reference Counting: Automatic Memory Management

CPython uses reference counting as its primary memory management mechanism. Every object maintains a count of how many references point to it. When this count reaches zero, the object is immediately deallocated. This provides deterministic memory management but requires careful handling to avoid premature deallocation or leaks.

**Key Files:**

- `Objects/object.c` - Reference counting operations (`Py_INCREF`, `Py_DECREF`)
- `Include/object.h` - Reference counting macros

**Documentation:**

- [Doc/c-api/refcounting.rst](Doc/c-api/refcounting.rst) - Reference counting

### Garbage Collection: Handling Cycles

While reference counting handles most memory management, it cannot detect or break circular references. CPython includes a cyclic garbage collector that periodically scans for unreachable cycles and collects them. Understanding the garbage collector reveals how CPython handles complex object graphs and why some objects may not be immediately deallocated.

**Key Files:**

- `Modules/gcmodule.c` - Garbage collector implementation
- `Include/internal/pycore_gc.h` - GC internal definitions

**Documentation:**

- [Doc/c-api/gcsupport.rst](Doc/c-api/gcsupport.rst) - Garbage collector support

---

## Chapter 4 — Built-in Types

### Integers: Arbitrary Precision

Python integers have arbitrary precision, meaning they can represent numbers of any size limited only by available memory. CPython implements this using a variable-length representation that allocates more memory as numbers grow larger. Understanding integer implementation reveals how Python achieves both performance for small numbers and correctness for large ones.

**Key Files:**

- `Objects/longobject.c` - Integer implementation
- `Include/longintrepr.h` - Integer representation

**Documentation:**

- [Doc/c-api/long.rst](Doc/c-api/long.rst) - Integer objects

### Strings: Unicode and Immutability

Python strings are immutable sequences of Unicode code points. CPython uses several internal representations to optimize for different string characteristics (ASCII, compact Unicode, or legacy strings). Understanding string implementation reveals how Python handles text encoding, string interning, and memory efficiency.

**Key Files:**

- `Objects/unicodeobject.c` - Unicode string implementation
- `Objects/stringobject.c` - Legacy string implementation (Python 2 compatibility)
- `Include/unicodeobject.h` - Unicode object definitions

**Documentation:**

- [Doc/c-api/unicode.rst](Doc/c-api/unicode.rst) - Unicode objects

### Lists: Dynamic Arrays

Python lists are implemented as dynamic arrays (similar to C++'s `std::vector`). They maintain a contiguous block of pointers to objects, automatically resizing when capacity is exceeded. Understanding list implementation reveals how Python achieves O(1) indexing while supporting dynamic growth.

**Key Files:**

- `Objects/listobject.c` - List implementation
- `Include/listobject.h` - List object definitions

**Documentation:**

- [Doc/c-api/list.rst](Doc/c-api/list.rst) - List objects

### Dictionaries: Hash Tables

Python dictionaries are implemented as hash tables with open addressing. They use a clever probing strategy and maintain insertion order (as of Python 3.7). Understanding dictionary implementation reveals how Python achieves average O(1) lookups while maintaining predictable iteration order.

**Key Files:**

- `Objects/dictobject.c` - Dictionary implementation
- `Include/dictobject.h` - Dictionary object definitions

**Documentation:**

- [Doc/c-api/dict.rst](Doc/c-api/dict.rst) - Dictionary objects

---

## Chapter 5 — The Evaluation Loop

### The Main Loop: ceval.c

The heart of CPython is the evaluation loop in `ceval.c`. This function interprets bytecode instructions, manipulating a value stack and maintaining execution state. Each bytecode instruction is a case in a large switch statement, and the loop continues until the frame completes or an exception is raised.

**Key Files:**

- `Python/ceval.c` - Main evaluation loop
- `Include/opcode.h` - Bytecode opcodes
- `Python/ceval.h` - Evaluation loop internals

**Documentation:**

- [Doc/c-api/init.rst](Doc/c-api/init.rst) - Interpreter state

### Frames: Execution Context

Each function call creates a new execution frame that contains local variables, the value stack, and execution state. Frames are linked together to form a call stack, enabling function calls, returns, and exception propagation. Understanding frames reveals how Python manages execution context and enables features like generators and coroutines.

**Key Files:**

- `Python/frameobject.c` - Frame object implementation
- `Include/frameobject.h` - Frame object definitions

**Documentation:**

- [Doc/c-api/init.rst](Doc/c-api/init.rst) - Frame objects

### Bytecode Instructions: The Language of the VM

CPython bytecode consists of simple instructions that operate on a value stack. Instructions like `LOAD_FAST`, `STORE_FAST`, `BINARY_ADD`, and `CALL_FUNCTION` form the building blocks of Python execution. Understanding bytecode reveals how Python's high-level constructs translate to low-level operations.

**Key Files:**

- `Include/opcode.h` - Bytecode opcode definitions
- `Python/compile.c` - Bytecode generation
- `Lib/dis.py` - Bytecode disassembler (Python module)

**Documentation:**

- [Doc/library/dis.rst](Doc/library/dis.rst) - Disassembler module

---

## Chapter 6 — Import System and Modules

### The Import System: Loading Code Dynamically

Python's import system is responsible for finding, loading, and initializing modules. It searches through a list of paths (sys.path), caches loaded modules, and handles both built-in modules (written in C) and Python modules. Understanding the import system reveals how Python organizes code and enables dynamic program structure.

**Key Files:**

- `Python/import.c` - Import system implementation
- `Python/importlib.h` - Import library internals
- `Lib/importlib/` - Import library (Python implementation)

**Documentation:**

- [Doc/c-api/import.rst](Doc/c-api/import.rst) - Import system
- [Doc/library/importlib.rst](Doc/library/importlib.rst) - Import library

### Module Objects: Namespaces as Objects

In Python, modules are objects that serve as namespaces for code organization. Module objects contain a dictionary of their attributes and maintain metadata about their location and loading. Understanding module objects reveals how Python's namespace system works and how code is organized and accessed.

**Key Files:**

- `Objects/moduleobject.c` - Module object implementation
- `Include/moduleobject.h` - Module object definitions

**Documentation:**

- [Doc/c-api/module.rst](Doc/c-api/module.rst) - Module objects

---

## Chapter 7 — Exception Handling

### Exceptions: Error Propagation

Python's exception system provides a structured way to handle errors and propagate them through the call stack. Exceptions are objects that can be raised, caught, and inspected. CPython implements exceptions using a combination of bytecode instructions and C-level setjmp/longjmp for efficient propagation.

**Key Files:**

- `Python/errors.c` - Exception handling
- `Objects/exceptions.c` - Built-in exception types
- `Include/pyerrors.h` - Exception definitions

**Documentation:**

- [Doc/c-api/exceptions.rst](Doc/c-api/exceptions.rst) - Exception handling

### Tracebacks: Understanding Errors

When an exception is raised, Python builds a traceback object that records the call stack at the point of the error. This traceback provides detailed information about where the error occurred and how execution reached that point. Understanding tracebacks reveals how Python provides helpful error messages and debugging information.

**Key Files:**

- `Python/traceback.c` - Traceback implementation
- `Objects/traceback.c` - Traceback object
- `Include/traceback.h` - Traceback definitions

**Documentation:**

- [Doc/c-api/exceptions.rst](Doc/c-api/exceptions.rst) - Traceback objects

---

## Chapter 8 — Advanced Topics

### Descriptors: The Magic Behind Properties

Python's descriptor protocol enables powerful features like properties, class methods, and static methods. Descriptors are objects that define how attribute access works for a class. Understanding descriptors reveals how Python's object-oriented features are implemented and how you can create custom behavior for attribute access.

**Key Files:**

- `Objects/descrobject.c` - Descriptor implementation
- `Include/descrobject.h` - Descriptor definitions

**Documentation:**

- [Doc/c-api/descriptor.rst](Doc/c-api/descriptor.rst) - Descriptor protocol

### Generators and Coroutines: Pausable Execution

Python generators and coroutines enable pausable execution through the use of special frame objects that can be suspended and resumed. Understanding how generators work reveals how Python implements iteration, async/await, and other advanced control flow features.

**Key Files:**

- `Objects/genobject.c` - Generator implementation
- `Include/genobject.h` - Generator definitions
- `Python/genobject.c` - Generator internals

**Documentation:**

- [Doc/c-api/gen.rst](Doc/c-api/gen.rst) - Generator objects

### The C API: Extending Python

CPython provides a comprehensive C API that allows you to extend Python with C code or embed Python in C applications. Understanding the C API reveals how Python's features are implemented and how you can create high-performance extensions.

**Key Files:**

- `Include/Python.h` - Main C API header
- `Include/object.h` - Object API
- `Include/pyerrors.h` - Exception API

**Documentation:**

- [Doc/c-api/](Doc/c-api/) - Complete C API reference
- [Doc/extending/](Doc/extending/) - Extending Python guide

---

## References

- [Python Developer's Guide](https://devguide.python.org/) - Official Python development guide
- [CPython Internals: Your Guide to the Python 3 Interpreter](https://realpython.com/cpython-source-code-guide/) - Comprehensive guide to CPython internals
- [Exploring CPython's Internals](https://devguide.python.org/internals/exploring/) - Official guide to exploring CPython
- [Python Documentation](https://docs.python.org/) - Official Python documentation
