---
curatedRepoId: freebsd-src-15.1
owner: freebsd
repo: freebsd-src
revision: aadd58dddcbc78f4d5594827b46b5633552b15ce
guideId: freebsd-kernel-guide
name: FreeBSD Kernel In The Mind
description: Understanding the FreeBSD kernel inside the full source tree
defaultOpenIds:
  - ch1
  - ch2
  - ch3
  - ch4
  - ch5
---

# FreeBSD Kernel In The Mind

FreeBSD is best read as a whole operating system whose kernel lives under `sys/` but is built, configured, installed, and documented from the same source tree as userland. This guide follows the kernel-facing paths first, then connects them back to release and build structure.

---
id: ch1
title: Chapter 1 — The Kernel Tree
fileRecommendations:
  readingOrder:
    - path: README.md
      description: Top-level source roadmap for the full FreeBSD tree
      type: docs
    - path: sys/README.md
      description: Kernel source roadmap and directory overview
      type: docs
    - path: sys/conf/files
      description: Kernel build manifest that maps source files into configurations
      type: source
    - path: sys/conf/options
      description: Kernel option definitions used by config files and subsystem code
      type: source
    - path: sys/amd64/conf/GENERIC
      description: Representative amd64 kernel configuration
      type: source
---

The FreeBSD kernel is concentrated in `sys/`, but the tree is not a standalone library. Kernel configuration, boot loaders, release scripts, and userland tools live beside it. That shape matters: FreeBSD ships as a base system, so kernel interfaces and userland consumers evolve together.

Start with `sys/README.md` and then read the configuration files. `sys/conf/files` tells you which compilation units belong to the kernel, while `sys/conf/options` records tunables that conditionally expose behavior across subsystems. A platform config such as `sys/amd64/conf/GENERIC` shows how those pieces become a bootable kernel.

---
id: ch2
title: Chapter 2 — Boot And Kernel Entry
fileRecommendations:
  readingOrder:
    - path: stand/man/loader.8
      description: Loader manual covering the pre-kernel boot environment
      type: docs
    - path: sys/amd64/amd64/locore.S
      description: Early amd64 assembly entry path
      type: source
    - path: sys/kern/init_main.c
      description: Kernel initialization and the first process path
      type: source
    - path: sys/kern/kern_linker.c
      description: Kernel linker and module loading support
      type: source
    - path: sys/sys/kernel.h
      description: SYSINIT ordering and kernel initialization declarations
      type: docs
---

FreeBSD boot begins outside `sys/`, in the loader code under `stand/`. The loader prepares the kernel image, modules, environment, and metadata. Once architecture entry code has control, kernel startup becomes a sequence of ordered initializers rather than one single main routine.

`SYSINIT` is the central contract. Subsystems register initialization functions with ordering constraints, and `sys/kern/init_main.c` drives the transition from early kernel state to process creation. This makes the boot path extensible without forcing every subsystem into a hand-written call chain.

---
id: ch3
title: Chapter 3 — Processes, Threads, And Scheduling
fileRecommendations:
  readingOrder:
    - path: sys/sys/proc.h
      description: Process and thread structures visible across the kernel
      type: docs
    - path: sys/kern/kern_proc.c
      description: Process lookup, lifecycle support, and procfs-facing helpers
      type: source
    - path: sys/kern/kern_fork.c
      description: fork() implementation and process creation
      type: source
    - path: sys/kern/kern_exit.c
      description: Process exit and wait semantics
      type: source
    - path: sys/kern/sched_ule.c
      description: ULE scheduler implementation
      type: source
---

FreeBSD separates process identity from runnable execution. `struct proc` holds process-level state such as credentials, signal disposition, and relationships. `struct thread` is the schedulable unit. Reading `sys/sys/proc.h` first gives you the vocabulary used by fork, exec, sleep, wakeup, and scheduler code.

The ULE scheduler in `sys/kern/sched_ule.c` is the default scheduling implementation for common configurations. It turns thread state into CPU placement decisions, balancing responsiveness, affinity, interactivity, and multiprocessor load.

---
id: ch4
title: Chapter 4 — Memory And Filesystems
fileRecommendations:
  readingOrder:
    - path: sys/vm/vm_map.c
      description: Virtual address map management
      type: source
    - path: sys/vm/vm_fault.c
      description: Page fault handling and object lookup
      type: source
    - path: sys/kern/vfs_subr.c
      description: Shared VFS object and vnode support
      type: source
    - path: sys/kern/vfs_syscalls.c
      description: Filesystem-facing syscall implementations
      type: source
    - path: sys/sys/vnode.h
      description: Vnode structure and VFS contracts
      type: docs
---

The VM and VFS subsystems are where FreeBSD's kernel becomes a resource manager. VM tracks address spaces, faults, objects, and page residency. VFS gives filesystems a common vnode interface so UFS, ZFS integration, pseudo-filesystems, and device-backed paths can participate in common syscalls.

Read the fault path and vnode path together. A memory-mapped file crosses both systems: VM resolves address faults, while VFS supplies file-backed objects and coherency rules. The boundary is technical, but the runtime behavior is shared.

---
id: ch5
title: Chapter 5 — Networking And Drivers
fileRecommendations:
  readingOrder:
    - path: sys/net/if.c
      description: Network interface lifecycle and common interface operations
      type: source
    - path: sys/netinet/tcp_subr.c
      description: TCP subsystem support and initialization
      type: source
    - path: sys/dev/pci/pci.c
      description: PCI bus enumeration and device attachment
      type: source
    - path: sys/kern/subr_bus.c
      description: Newbus device model core
      type: source
    - path: sys/sys/bus.h
      description: Device and driver method interfaces
      type: docs
---

FreeBSD's driver model is built around newbus. Buses enumerate children, drivers probe and attach, and devices expose methods through shared kernel interfaces. `sys/kern/subr_bus.c` is the generic machinery; bus families such as PCI specialize the discovery and resource allocation path.

Networking follows the same kernel style: common interfaces, protocol-specific state machines, and subsystem initialization glue. The interface layer in `sys/net/if.c` is the useful starting point because every protocol and driver eventually meets it.
