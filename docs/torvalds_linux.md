---
owner: torvalds
repo: linux
defaultBranch: v6.1
guideId: linux-kernel-guide
name: Linux Kernel In The Mind
description: Understanding Linux Kernel Before Code
defaultOpenIds: ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9']
---

# Linux Kernel In The Mind

> This isn't a guide to writing kernel code. It's an effort to understand how the Linux kernel thinks.

Each chapter is a self-contained reflection on kernel behavior — not on function calls, but on **behavior, not syntax**. Taken together they build a conceptual map of how the kernel responds, enforces, isolates, and serves.

**The kernel runs everything. Let's understand how it runs.**

---
id: ch1
title: Chapter 1 — The Kernel Is Not a Process
fileRecommendations:
  source:
    - path: init/main.c
      description: start_kernel() — the first C function after boot
    - path: include/linux/sched.h
      description: task_struct — every process/thread as the kernel sees it (~850 fields)
    - path: kernel/fork.c
      description: kernel_clone() — how fork() and clone() create tasks
    - path: kernel/kthread.c
      description: Kernel threads — how they differ from user processes
  docs:
    - path: Documentation/scheduler/sched-design-CFS.rst
      description: Scheduler design and kernel thread management
    - path: Documentation/core-api/kernel-api.rst
      description: Kernel thread API
    - path: Documentation/kernel-hacking/hacking.rst
      description: Rules for writing correct kernel code
---

The kernel is not a process — it has no PID, no user-space memory, no scheduler slot. It is the framework that gives those things to others.

When a process calls `getdents`, the CPU switches from ring 3 to ring 0. The same CPU core now executes kernel code *in the context of your process*, reads `task_struct` via the `current` pointer, and returns. The kernel never "runs alongside" your program; it runs *as* it, briefly, on request. Kernel threads exist for background work (memory reclamation, IRQ processing) but they're the exception, not the rule.

Every process's virtual address space includes a kernel mapping at high addresses. Those pages carry supervisor-only PTEs, so they're inaccessible from ring 3. The mapping exists so syscall entry doesn't require a full address-space switch — just a privilege-level change.

This distinction explains three things at once: why kernel code must be non-blocking (no separate process to schedule away), why kernel bugs crash the whole machine (no isolation from the rest of the kernel), and why synchronization in the kernel is so different from user-space threading.

---
id: ch2
title: Chapter 2 — Subsystem Map
fileRecommendations:
  source:
    - path: arch/x86/entry/entry_64.S
      description: SYSCALL/SYSRET and interrupt entry for x86-64
    - path: mm/mmap.c
      description: Virtual memory area management — mmap() implementation
    - path: mm/page_alloc.c
      description: Buddy allocator — physical page allocation
    - path: fs/namei.c
      description: Path lookup — how /a/b/c resolves to an inode
    - path: net/socket.c
      description: Socket syscall interface
  docs:
    - path: Documentation/scheduler/
      description: Scheduler documentation
    - path: Documentation/mm/
      description: Memory management internals
    - path: Documentation/filesystems/
      description: VFS and filesystem documentation
    - path: Documentation/networking/
      description: Networking stack documentation
    - path: Documentation/driver-api/
      description: Driver development API
---

Six directories account for nearly all kernel behavior.

**`kernel/`** holds the scheduler (`sched/`), process creation (`fork.c`), signal delivery (`signal.c`), and timers. The CFS scheduler alone spans `fair.c` (~12k lines), `core.c` (~11k lines), and `rt.c` for real-time policies.

**`mm/`** owns physical and virtual memory. `page_alloc.c` is the buddy allocator for page-granularity requests; `slub.c` is the slab allocator for small kernel objects; `mmap.c` manages virtual memory areas (VMAs) and implements the `mmap(2)` syscall.

**`fs/`** provides the Virtual Filesystem Switch — a uniform interface over all filesystems. `namei.c` resolves paths to dentries; `open.c` and `read_write.c` implement the syscalls; concrete filesystems (`ext4/`, `btrfs/`, `xfs/`) plug in below.

**`net/`** implements the full TCP/IP stack. Socket buffers (`sk_buff`) flow through `net/core/dev.c` (device layer), `net/ipv4/tcp.c` (protocol), and `net/netfilter/` (packet filtering).

**`drivers/`** (~20M lines) abstracts every hardware category through a bus-device-driver model registered with `kobject`/sysfs.

**`arch/x86/`** contains everything that can't be written portably: syscall entry (`arch/x86/entry/entry_64.S`), page-fault handling (`arch/x86/mm/fault.c`), SMP bring-up, and KVM virtualization.

Subsystems interact through well-defined interfaces. A `read(2)` syscall enters via `entry_64.S`, dispatches through `fs/read_write.c:vfs_read()`, lands in the filesystem's `->read_iter()` hook, hits the page cache in `mm/filemap.c`, and issues block I/O through `block/bio.c` to a driver.

---
id: ch3
title: Chapter 3 — Memory as Responsibility
fileRecommendations:
  source:
    - path: mm/mmap.c
      description: mmap() implementation — VMA creation and management
    - path: mm/page_alloc.c
      description: Physical page allocator — buddy system
    - path: include/linux/mm_types.h
      description: mm_struct, vm_area_struct, page — the core data structures
  docs:
    - path: Documentation/mm/
      description: Memory management overview and internals
    - path: Documentation/admin-guide/mm/
      description: Memory zones, NUMA, huge pages
    - path: Documentation/core-api/memory-allocation.rst
      description: Which allocator to use and when
    - path: Documentation/x86/x86_64/mm.rst
      description: x86-64 virtual address space layout
    - path: Documentation/virt/
      description: Virtual memory documentation
---

The kernel doesn't view memory as a flat map — it tracks it as a responsibility. Every byte of physical RAM is represented by a `struct page`. Every range of a process's virtual address space is a `struct vm_area_struct` (VMA). The process as a whole carries a `struct mm_struct` linking them together.

Physical memory is organized into NUMA nodes → zones → page blocks → pages. The buddy allocator (`page_alloc.c`) satisfies page-granularity requests, splitting and coalescing power-of-two blocks to fight fragmentation. Smaller allocations go through SLUB (`slub.c`), which maintains per-CPU caches of fixed-size objects.

Virtual memory is lazily populated. `mmap()` creates a VMA and returns immediately; no physical page is allocated until a first access triggers a page fault. The fault handler (`arch/x86/mm/fault.c`) checks permissions, allocates a page, and installs a PTE. Copy-on-write for `fork()` uses the same mechanism: child VMAs share parent pages (read-only), and a write fault splits them.

Isolation is enforced structurally. Each process has its own `mm_struct` and its own page tables. The kernel is mapped into every process's address space at high virtual addresses, but those pages carry supervisor-only PTEs — inaccessible from ring 3. The canonical x86-64 layout is documented in `Documentation/x86/x86_64/mm.rst`.

---
id: ch4
title: Chapter 4 — From Power-On to PID 1
fileRecommendations:
  source:
    - path: init/main.c
      description: start_kernel() — subsystem initialization sequence
    - path: arch/x86/boot/main.c
      description: Early x86 boot — real mode setup before protected mode
    - path: init/init_task.c
      description: Statically-allocated init process (PID 0 → PID 1)
  docs:
    - path: Documentation/x86/boot.rst
      description: x86 boot protocol — from BIOS/UEFI to the kernel entry
    - path: Documentation/admin-guide/kernel-parameters.rst
      description: Every boot parameter the kernel accepts
    - path: Documentation/admin-guide/binfmt-misc.rst
      description: How the kernel recognizes and loads binary formats
    - path: Documentation/bpf/
      description: eBPF subsystem — runtime extensibility
---

The boot sequence splits into two worlds: architecture-specific and architecture-neutral.

The firmware (BIOS/UEFI) loads the bootloader, which decompresses the kernel image and jumps to `arch/x86/boot/main.c`. This code runs in real mode, probes hardware, switches to protected mode, then long mode, and finally jumps to `start_kernel()` in `init/main.c`.

`start_kernel()` is the first function that looks like normal C. It initializes subsystems in strict dependency order: memory first (so everything else can allocate), then the scheduler, IRQs, the VFS, and network. Each `xxx_init()` call is a one-time setup; a panic here means the system cannot boot.

The last act of `start_kernel()` is `rest_init()`, which creates kernel thread PID 1 running `kernel_init()`. This thread mounts the root filesystem, executes the init binary (`/sbin/init` or systemd), and transitions to user space. From this point the kernel is purely reactive — it only runs when something asks it to.

Running `./hello` from a shell involves the shell calling `execve(2)`, which reaches `fs/exec.c`. The kernel reads the ELF header, maps segments as VMAs, sets up the stack with `argv`/`envp`, and returns to user space at `_start` — not `main()`.

---
id: ch5
title: Chapter 5 — Entering the Kernel
fileRecommendations:
  source:
    - path: arch/x86/entry/entry_64.S
      description: SYSCALL entry — where user space crosses into the kernel
    - path: kernel/sys.c
      description: Generic system call implementations
    - path: include/uapi/asm-generic/unistd.h
      description: Syscall number table
  docs:
    - path: Documentation/core-api/
      description: System call interface
    - path: Documentation/core-api/irq/
      description: Interrupt subsystem internals
    - path: Documentation/virt/kvm/
      description: KVM — guest syscall handling via VMEXIT
    - path: Documentation/virt/kvm/api.rst
      description: KVM API reference
---

There are three paths into the kernel: **syscalls** (intentional, from user space), **hardware interrupts** (asynchronous, from devices), and **exceptions** (synchronous CPU faults — page fault, divide-by-zero, breakpoints). All three converge on `arch/x86/entry/entry_64.S`.

A syscall uses the `SYSCALL` instruction, which atomically loads the kernel stack pointer, switches to ring 0, and jumps to the entry point. `entry_64.S` saves all registers onto the kernel stack, then `do_syscall_64()` indexes `sys_call_table` by syscall number and calls the handler. On return, registers are restored and `SYSRET` drops back to ring 3.

Hardware interrupts use a separate path. Each vector in the IDT (Interrupt Descriptor Table) points to a handler in `entry_64.S`. IRQ handlers run in **interrupt context** — no sleeping, no blocking locks, fast completion. Slow work is deferred to softirqs, tasklets, or workqueues.

In virtualization, a guest OS sees its own `entry_64.S` and believes it runs on bare metal. But when the guest executes a privileged instruction, the CPU performs a VMEXIT, saving guest registers and handing control to KVM on the host. KVM inspects the exit reason, emulates or delegates, then resumes the guest with `VMRESUME` — all without leaving host kernel mode.

---
id: ch6
title: Chapter 6 — Execution and Contexts
fileRecommendations:
  source:
    - path: kernel/fork.c
      description: kernel_clone() — complete process/thread creation path
    - path: kernel/exit.c
      description: do_exit() — process termination and resource cleanup
    - path: fs/exec.c
      description: execve() — loading and starting a new program image
    - path: kernel/sched/core.c
      description: schedule() and context_switch() — the core dispatcher
    - path: kernel/sched/fair.c
      description: CFS — virtual runtime and the red-black tree
  docs:
    - path: Documentation/scheduler/
      description: Scheduler documentation
    - path: Documentation/scheduler/sched-design-CFS.rst
      description: CFS design — virtual runtime, weights, and red-black tree
    - path: Documentation/locking/
      description: All locking primitives — spinlocks, mutexes, RCU
    - path: Documentation/core-api/workqueue.rst
      description: Workqueues — deferred work from interrupt context
---

The CPU is stateless — it executes whatever instruction `%rip` points to, regardless of ownership. The kernel supplies all the state: each task gets a `task_struct`, a kernel stack, and a set of page tables. The `current` macro is a per-CPU pointer to the running task's `task_struct`; all kernel code uses it to know whose context it's in.

`fork()` calls `kernel_clone()`, which duplicates the parent's `task_struct`, copies or shares file descriptors, signal handlers, and the memory descriptor, and places the new task on a run queue. Threads share the `mm_struct` (same address space); processes get a copy-on-write duplicate.

The CFS scheduler tracks each task's **virtual runtime** — actual CPU time weighted by priority. It always picks the task with the lowest vruntime. Tasks live in a per-CPU red-black tree keyed by vruntime; `schedule()` pops the leftmost node. A context switch saves the outgoing task's registers onto its kernel stack and restores the incoming task's — the entire CPU state changes in a few dozen instructions.

Interrupt context is categorically different: there's no `current` task you can assume is sleeping, blocking is forbidden, and the code must complete quickly. Work that needs to block is deferred — softirqs run immediately after the IRQ handler returns; workqueues run later in dedicated kernel threads with full process context.

---
id: ch7
title: Chapter 7 — Communication and Cooperation
fileRecommendations:
  source:
    - path: kernel/signal.c
      description: Signal generation, queueing, and delivery
    - path: kernel/futex/core.c
      description: Fast userspace mutex — kernel-side wait/wake implementation
    - path: kernel/sched/wait.c
      description: Wait queues — the general sleep-until-event mechanism
  docs:
    - path: Documentation/locking/
      description: Locking primitives — spinlocks, mutexes, RCU
    - path: Documentation/RCU/
      description: Read-Copy-Update synchronization mechanism
    - path: Documentation/core-api/workqueue.rst
      description: Workqueues — cross-context deferred work
    - path: Documentation/filesystems/proc.rst
      description: /proc filesystem — the kernel's primary user-space window
    - path: Documentation/bpf/
      description: eBPF — programmable kernel hooks
---

Signals are the kernel's oldest delivery mechanism. `kill()` queues a `siginfo_t` on the target task's signal queue. Delivery happens at the next return from kernel mode: `entry_64.S` checks `TIF_SIGPENDING` on every kernel exit and, if set, calls `do_signal()` to dispatch. Signal handlers run in user space — the kernel builds a special stack frame so the handler returns through `sigreturn(2)`.

User-space mutexes are built on **futexes** (fast userspace mutexes). The fast path is a single atomic compare-and-swap in user memory — the kernel is never involved. Only on contention does `futex(2)` enter the kernel to park the waiting thread. Uncontested locks cost ~5 ns with zero syscalls; contended locks pay one syscall to sleep and one to wake.

Wait queues (`kernel/sched/wait.c`) are the general sleep mechanism inside the kernel. A subsystem declares a `wait_queue_head_t`; a task calls `wait_event()` to sleep until a condition is true; another path calls `wake_up()` to wake waiters. Block I/O completion, network data arrival, and pipe writes all follow this pattern.

The modern kernel provides multiple user-space communication channels: `/proc` exposes per-process and system state as a synthetic filesystem; `ioctl` is a device-specific escape hatch; `mmap` creates shared memory regions without copying; eBPF lets user space attach verified programs to thousands of kernel tracepoints and hooks, without loading a kernel module.

---
id: ch8
title: Chapter 8 — I/O, Scheduling, and Virtualization
fileRecommendations:
  source:
    - path: kernel/sched/core.c
      description: schedule() — the core dispatcher
    - path: kernel/sched/fair.c
      description: CFS — vruntime, red-black tree, and load balancing
    - path: block/blk-core.c
      description: Block I/O core — submit_bio() and request dispatch
  docs:
    - path: Documentation/block/
      description: Block layer — request queues and I/O schedulers
    - path: Documentation/core-api/dma-api.rst
      description: DMA API — device memory transfers without the CPU
    - path: Documentation/core-api/timekeeping.rst
      description: Kernel time sources and timer subsystem
    - path: Documentation/x86/
      description: x86 architecture documentation
    - path: Documentation/virt/kvm/
      description: KVM — hardware-assisted virtualization
    - path: Documentation/virt/kvm/api.rst
      description: KVM API reference
---

I/O in the kernel is layered. A `read(2)` on a regular file checks the **page cache** (`mm/filemap.c`) first; on a miss it submits a `bio` (block I/O descriptor) downward through the block layer. The block layer (`block/blk-core.c`) merges and reorders requests via an I/O scheduler, then dispatches to the driver via `submit_bio()`. The driver programs DMA so the device writes directly into kernel memory; an interrupt fires on completion and wakes the sleeping task.

`select()`/`poll()` check readiness synchronously, rescanning the entire fd set on every call — O(n) per wakeup, which degrades badly with thousands of sockets. `epoll` registers interest once and delivers only ready events. `io_uring` goes further: applications submit operations to a shared-memory ring buffer and harvest completions from a second ring, eliminating per-operation syscall overhead entirely.

Scheduling and I/O interact constantly: a task blocked on I/O sits in `TASK_INTERRUPTIBLE`, removed from the CFS run queues. When the I/O completes the interrupt handler calls `wake_up()`, the task moves to `TASK_RUNNING`, and CFS will schedule it at its next opportunity.

KVM turns Linux into a Type-1 hypervisor. In VMX root mode the host kernel manages guest CPU state (`struct kvm_vcpu`). When the guest executes a privileged instruction the CPU performs a VMEXIT, saving all guest registers. KVM inspects the exit reason, emulates or delegates to user-space QEMU, and resumes the guest with `VMRESUME` — all transparent to the guest OS.

---
id: ch9
title: Chapter 9 — Where to Go Next
fileRecommendations:
  docs:
    - path: Documentation/process/howto.rst
      description: How to contribute patches to the Linux kernel
    - path: Documentation/admin-guide/
      description: Linux kernel administration documentation
    - path: Documentation/kernel-hacking/hacking.rst
      description: Kernel hacking guide — rules and patterns for contributors
    - path: Documentation/kbuild/
      description: Kernel build system — Kconfig, Makefiles, modules
---

The mental model from these chapters — kernel as a reactive system, memory as tracked responsibility, execution as context-switching over shared code — makes the source tree navigable. Each subsystem now has a clear owner and a clear interface.

A recommended path for reading code:

1. `init/main.c` — follow `start_kernel()` top-to-bottom; every call names a subsystem
2. `arch/x86/entry/entry_64.S` — trace a single syscall from `SYSCALL` to `SYSRET`
3. `kernel/fork.c` — read `kernel_clone()` to see how a task is assembled from parts
4. `mm/mmap.c` — read `do_mmap()` to see how a VMA is created and registered
5. `kernel/sched/fair.c` — read `enqueue_task_fair()` and `pick_next_task_fair()`

Don't read linearly. Pick a specific path — a syscall, a page fault, an IRQ — and trace it from user space to hardware and back. Each complete trace illuminates a different cross-section of the tree.

For contributing: `Documentation/process/howto.rst` covers the patch workflow. `scripts/checkpatch.pl` validates style before submission. The mailing lists (`linux-kernel`, subsystem-specific lists) are the primary review forum — there is no GitHub PR workflow for mainline Linux.

The kernel cannot be understood through documentation, code, or runtime behavior alone. Alignment between intent, implementation, and observed behavior is what makes the system legible. These chapters supply the intent; the source is right there.
