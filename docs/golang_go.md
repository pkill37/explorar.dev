---
owner: golang
repo: go
defaultBranch: go1.22.0
guideId: go-guide
name: Go Runtime In The Mind
description: Understanding the Go runtime before diving into its source code
defaultOpenIds: ['ch1', 'ch2', 'ch3']
---

# Go Runtime In The Mind

## Understanding Go Before Code

> Go is deceptively simple on the surface. The runtime underneath is not.

Go ships its own scheduler, garbage collector, channel implementation, and type system as part of the language itself. The standard library is not a thin wrapper around C — it is written in Go, compiled with the toolchain, and the runtime is deeply integrated into every running program.

This guide explores how Go actually works at the source level: how goroutines are scheduled, how channels synchronize, how the GC manages memory, and how the type system enables interfaces.

**Go runs Go. Let's understand how it does it.**

---
id: ch1
title: Chapter 1 — Goroutines and the Scheduler
fileRecommendations:
  source:
    - path: src/runtime/proc.go
      description: Goroutine scheduler — the heart of the runtime
    - path: src/runtime/runtime.go
      description: Runtime initialization and bootstrap
    - path: src/runtime/runtime2.go
      description: Core data structures — g, m, p
    - path: src/runtime/asm_amd64.s
      description: Low-level assembly — goroutine context switch
---

## Chapter 1 — Goroutines and the Scheduler

Go multiplexes goroutines onto OS threads using a **work-stealing M:N scheduler**. Understanding it requires knowing three concepts: `g`, `m`, and `p`.

### G, M, P

```
G (goroutine)  — unit of concurrent execution; has its own stack
M (machine)    — an OS thread bound to the runtime
P (processor)  — logical CPU; holds a local run queue of goroutines
```

Every goroutine is a `g` struct (`src/runtime/runtime2.go`). The scheduler (`src/runtime/proc.go`) maintains a per-P run queue plus a global queue. When an M parks (e.g., syscall), another M takes over its P.

### Context Switching

Goroutine switches happen cooperatively at function call preambles and at explicit yield points (`runtime.Gosched()`). The actual context switch is assembly in `src/runtime/asm_amd64.s` — it swaps stack pointer, instruction pointer, and saves callee-saved registers into the `g.sched` field.

### Key functions in proc.go

- `newproc` — creates a goroutine (`go func()` desugars to this)
- `schedule` — the main scheduler loop: pick a G, execute it
- `findRunnable` — tries local queue, then global queue, then work-steals
- `goexit` — cleans up when a goroutine returns

---
id: ch2
title: Chapter 2 — Channels and Synchronization
fileRecommendations:
  source:
    - path: src/runtime/chan.go
      description: Channel implementation — send, receive, select
    - path: src/runtime/select.go
      description: Select statement runtime support
    - path: src/runtime/sema.go
      description: Semaphore-based synchronization primitives
    - path: src/sync/mutex.go
      description: sync.Mutex — user-space mutex implementation
---

## Chapter 2 — Channels and Synchronization

Channels are first-class in Go but implemented entirely in `src/runtime/chan.go`. Every channel is a `hchan` struct on the heap.

### hchan structure

```go
type hchan struct {
    qcount   uint           // elements in the buffer
    dataqsiz uint           // capacity
    buf      unsafe.Pointer // circular buffer pointer
    elemsize uint16
    closed   uint32
    sendq    waitq          // goroutines blocked on send
    recvq    waitq          // goroutines blocked on receive
    lock     mutex
}
```

### Send / Receive

A channel send (`chansend`) first checks `recvq` for a waiting receiver — if one exists, the value is copied directly, bypassing the buffer. Otherwise it goes into the buffer if space exists, or the goroutine parks on `sendq`.

`chanrecv` is symmetric. This lock-free fast path (direct G-to-G handoff) is what makes Go channels efficient for small messages.

### Select

`select` with multiple cases is compiled to `selectgo()` in `src/runtime/select.go`. It shuffles the cases randomly to prevent starvation, then tries each case in poll order. If none are ready, it parks on all of them simultaneously — whichever fires first wins.

---
id: ch3
title: Chapter 3 — Memory and Garbage Collection
fileRecommendations:
  source:
    - path: src/runtime/mgc.go
      description: GC driver — triggers, phases, STW
    - path: src/runtime/mheap.go
      description: Heap management — spans and arenas
    - path: src/runtime/mcentral.go
      description: Central free lists per size class
    - path: src/runtime/mcache.go
      description: Per-P allocation cache — the fast path
    - path: src/runtime/malloc.go
      description: Memory allocator entry point — newobject
---

## Chapter 3 — Memory and Garbage Collection

Go uses a **tri-color concurrent mark-and-sweep GC** with short stop-the-world pauses. Memory allocation goes through a multi-level cache:

```
mcache (per-P, lock-free)
  ↓ on miss
mcentral (per size class, one lock)
  ↓ on miss
mheap (global, arena-based)
  ↓ on miss
OS (mmap)
```

### Allocation

`newobject` (in `malloc.go`) is called for every heap allocation. Small objects (<32KB) go through size classes — 67 classes covering 8B to 32KB. Each P has an `mcache` with a span per size class; allocation is a bump pointer with no locking.

Large objects bypass the cache and are allocated directly from the heap.

### GC phases

1. **Mark setup** (STW) — enable write barriers, take roots
2. **Concurrent mark** — mark goroutines scan the heap concurrently with the program
3. **Mark termination** (STW) — drain any remaining work
4. **Sweep** (concurrent) — return unmarked spans to the allocator

The write barrier ensures that any pointer write during concurrent marking is tracked, maintaining the tri-color invariant.

---
id: ch4
title: Chapter 4 — Interfaces and the Type System
fileRecommendations:
  source:
    - path: src/runtime/iface.go
      description: Interface boxing and assertion — itab cache
    - path: src/runtime/type.go
      description: Runtime type descriptors
    - path: src/cmd/compile/internal/types2/check.go
      description: Type checker entry point
    - path: src/cmd/compile/internal/types2/interface.go
      description: Interface type representation in the compiler
---

## Chapter 4 — Interfaces and the Type System

An interface value in Go is a two-word struct: `(itab*, data*)`.

```
interface{}     = (type*, data*)   — empty interface
io.Reader       = (itab*, data*)   — non-empty interface
```

### itab

An `itab` (`src/runtime/iface.go`) is generated at runtime for each `(interface, concrete type)` pair. It holds:
- A pointer to the interface type descriptor
- A pointer to the concrete type descriptor
- An array of function pointers (the method table)

`itab` values are cached globally so the same `(interface, concrete)` pair only pays the setup cost once.

### Type assertions

`x.(T)` compiles to a runtime call that checks `x.itab._type == &T` (or walks the method table for interface assertions). The compiler inserts a nil check first.

### Reflection

The `reflect` package exposes the runtime type system. `reflect.TypeOf(x)` returns the `_type` pointer cast to `reflect.Type`. All type metadata (name, size, alignment, methods) is embedded in the binary by the compiler.

---
id: ch5
title: Chapter 5 — Slices, Maps, and Strings
fileRecommendations:
  source:
    - path: src/runtime/slice.go
      description: Slice header and grow logic
    - path: src/runtime/map.go
      description: Hash map implementation
    - path: src/runtime/map_fast64.go
      description: Optimized fast paths for integer keys
    - path: src/runtime/string.go
      description: String operations and conversions
---

## Chapter 5 — Slices, Maps, and Strings

### Slices

A slice is a three-word header: `(ptr, len, cap)`. `append` calls `growslice` when `len == cap`, which allocates a new backing array and copies. The growth factor starts at 2× for small slices and tapers toward 1.25× for large ones.

### Maps

Go maps are hash tables with **open addressing in chained 8-slot buckets**. Each bucket holds 8 key-value pairs plus an overflow pointer. The load factor is 6.5 — at that point the map is evacuated (rehashed) in the background during writes.

Map reads are a simple hash → bucket → linear scan. The top 8 bits of the hash are stored as `tophash` in each slot, making the scan a fast byte comparison before touching the key.

### Strings

Go strings are immutable byte slices: `(ptr, len)`. String literals are stored in the read-only data segment. Conversions between `string` and `[]byte` copy (unless the compiler can prove safety), which is why hot paths avoid them.

---
id: ch6
title: Chapter 6 — The Compiler and Toolchain
fileRecommendations:
  source:
    - path: src/cmd/compile/internal/gc/main.go
      description: Compiler entry point
    - path: src/cmd/compile/internal/ssa/compile.go
      description: SSA backend — optimization passes
    - path: src/cmd/compile/internal/walk/walk.go
      description: AST lowering — where Go constructs become runtime calls
    - path: src/cmd/compile/internal/escape/escape.go
      description: Escape analysis — stack vs heap decision
---

## Chapter 6 — The Compiler and Toolchain

### Compilation pipeline

```
Source → Parsing → Type checking → AST lowering
  → SSA construction → Optimization passes
  → Machine code → Linker → Binary
```

The compiler is in `src/cmd/compile`. The frontend (parsing, type-checking) produces a typed AST; `walk` lowers high-level constructs (range loops, interface calls, channel ops) into explicit runtime calls. The backend builds SSA and applies standard optimization passes.

### Escape analysis

`src/cmd/compile/internal/escape/escape.go` determines whether each allocation can stay on the stack or must escape to the heap. Variables that outlive their function (stored in closures, returned by pointer, stored in interfaces) escape. Escape analysis is interprocedural and conservative.

### Inlining

The compiler inlines small functions automatically (budget-based). Inlining decisions are visible with `go build -gcflags='-m'`. Inlined calls skip the goroutine stack check and function call overhead.

---
id: ch7
title: Chapter 7 — The Standard Library
fileRecommendations:
  source:
    - path: src/net/net.go
      description: Network I/O — integrated with the runtime poller
    - path: src/net/fd_unix.go
      description: File descriptor management on Unix
    - path: src/os/file.go
      description: OS file abstraction
    - path: src/io/io.go
      description: Core I/O interfaces
    - path: src/fmt/print.go
      description: Formatted I/O — Printf, Sprintf
---

## Chapter 7 — The Standard Library

Go's standard library is written in Go. There is no C shim layer for most packages — the runtime provides the primitives that everything else builds on.

### Network I/O

`src/net` integrates with the runtime's **netpoller** — an epoll/kqueue wrapper that parks goroutines on I/O without blocking OS threads. A `net.Conn` read that would block causes the goroutine to park; the M is free to run other goroutines. When the fd becomes readable, the poller wakes the goroutine.

### io.Reader / io.Writer

The two core interfaces used throughout the standard library. Their simplicity (`Read([]byte) (int, error)`) enables composition: `io.TeeReader`, `io.LimitReader`, `bufio.Reader`, `gzip.Reader` all implement the same interface, chain without allocations, and integrate with `io.Copy`.

---
id: ch8
title: Chapter 8 — Concurrency Patterns in the Source
fileRecommendations:
  source:
    - path: src/sync/rwmutex.go
      description: Read/write mutex implementation
    - path: src/sync/waitgroup.go
      description: WaitGroup — counting semaphore
    - path: src/sync/once.go
      description: Once — single initialization guarantee
    - path: src/sync/pool.go
      description: sync.Pool — temporary object reuse
    - path: src/sync/map.go
      description: sync.Map — concurrent map
---

## Chapter 8 — Concurrency Patterns in the Source

### sync.Pool

`src/sync/pool.go` is one of the most performance-sensitive packages. It maintains a per-P victim/local pair of pools to reduce GC pressure for frequently allocated, short-lived objects. The GC clears pools at each collection cycle.

### sync.Once

A single `uint32` state field plus a `Mutex`. The fast path (`atomic.LoadUint32`) has no locking. The slow path double-checks under lock — classic double-checked locking, correctly implemented in Go.

### sync.Map

Optimized for two use cases: keys only written once and read many times, or keys written and read by disjoint goroutines. Uses two internal maps: a read-only `atomic.Pointer` for lock-free reads and a dirty map protected by a mutex.

---
id: ch9
title: Chapter 9 — Putting It All Together
fileRecommendations:
  source:
    - path: src/runtime/traceback.go
      description: Stack unwinding and panic recovery
    - path: src/runtime/panic.go
      description: Panic and recover implementation
    - path: src/runtime/signal_unix.go
      description: Signal handling — SIGSEGV, SIGBUS, etc.
---

## Chapter 9 — Putting It All Together

### Panic and recover

`panic` allocates a `_panic` struct on the current goroutine's stack and begins unwinding. Each deferred function is called in LIFO order. A `recover()` inside a deferred function catches the panic by clearing the `_panic` struct — execution continues normally after the deferred function returns.

Stack overflows also go through panic via `sigpanic`. The runtime uses guard pages (a small unmapped region at the bottom of each goroutine stack) to detect overflows.

### Signal handling

`src/runtime/signal_unix.go` installs signal handlers for SIGSEGV, SIGBUS, and others. Receiving SIGSEGV during a GC write barrier or unsafe pointer dereference invokes `sigpanic`, which can be caught by recover. Signals delivered to non-Go threads are forwarded to the registered Go signal handler.

## References

- [Go specification](https://go.dev/ref/spec)
- [Go memory model](https://go.dev/ref/mem)
- [Runtime package docs](https://pkg.go.dev/runtime)
- [Go internals blog posts](https://go.dev/blog/)
- [Dmitry Vyukov's scheduler design doc](https://docs.google.com/document/d/1TTj4T2JO42uD5ID9e89oa0sLKhJYD0Y_kqxDv3I3XMw)
