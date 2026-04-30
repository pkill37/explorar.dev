---
owner: littlekernel
repo: lk
defaultBranch: a521fe60e1a16d5670fe24b7fca2c5155b3339c4
guideId: littlekernel-lk-guide
name: Little Kernel In The Mind
description: Understanding LK as a compact embedded kernel and second-stage bootloader
defaultOpenIds: ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6']
---

# Little Kernel In The Mind

> LK is small enough to fit in your head, but only if you look at it as a system of constraints rather than as a pile of ports.

This guide is for understanding how **Little Kernel** is shaped: its role as a second-stage bootloader, how its boot flow progresses from power-on to kernel handoff, how build composition works, where architecture code ends and platform code begins, and how the kernel stays useful in tiny bring-up and bootloader environments.

**LK is not Linux scaled down. It is a deliberately compact kernel with a different set of tradeoffs — and it ships in production devices.**

---
id: ch1
title: Chapter 1 — What LK Is and What It Optimizes For
fileRecommendations:
  source:
    - path: README.md
      description: High-level overview, supported architectures, and the project's stated goals
    - path: kernel/
      description: Core kernel subsystem — scheduling, synchronization, timers, and thread lifecycle
    - path: arch/
      description: CPU-family code split by architecture
    - path: app/
      description: Application layer — this is where the bootloader's product behavior lives
  docs:
    - path: docs/
      description: Project documentation index and conceptual notes
---

LK occupies a specific position in the boot stack: it is a **second-stage bootloader**. On ARM SoCs (MediaTek, Qualcomm, and others), a ROM bootloader or preloader transfers control to LK, and LK in turn loads and boots Linux. That role shapes every design decision.

The kernel still needs the essentials: threads, preemption, interrupt handling, synchronization primitives, timers, memory allocation, and platform initialization. What it does not need is a heavyweight process model, virtual memory for multiple user processes, or a large driver universe. The result is a tree that is structurally lean: `kernel/` is small and central, and most variability is pushed outward into architecture, platform, and target configuration.

LK's concrete job on a production device is to:
- Initialize hardware (display, storage, DRAM, power management)
- Determine which OS image to load based on boot reason and key inputs
- Load and verify that image from flash
- Prepare a handoff data structure for the kernel
- Jump to Linux

Reading LK purely as a study in kernel design is valid. But the full picture requires keeping that bootloader context in mind. The `app/` directory is where the product-facing behavior lives — the Android boot app, fastboot protocol handler, and shell. These are not optional extras. They are the visible surface of what LK actually does in production.

---
id: ch2
title: Chapter 2 — The Boot Flow
fileRecommendations:
  source:
    - path: kernel/
      description: Thread initialization and scheduler — the first thing LK runs after architecture setup
    - path: arch/
      description: Early architecture init — cache, MMU, exception vectors, context switch
    - path: platform/
      description: Platform bring-up — interrupt controller, UART, clocks, display
    - path: app/
      description: App threads — mt_boot, aboot, shell — where execution ends up after init
  docs:
    - path: top/
      description: Integration glue that sequences the boot stages
---

LK's boot flow follows a layered initialization sequence. Understanding this order is the most important thing for reading the code:

**1. Early thread initialization.** Before any hardware is touched, LK sets up the threading subsystem. The currently-running context is wrapped into the first kernel thread. This makes the rest of boot code run inside a real kernel thread, which means synchronization primitives and scheduling are available immediately.

**2. Architecture and platform init.** `arch/` code enables the MMU, configures caches, and installs exception vectors. `platform/` code then brings up board-specific hardware: interrupt controller, UART for debug output, clocks, storage controllers, power management, GPIO, and display. This is where the logo is loaded from the `LOGO` partition and rendered.

**3. Boot mode selection.** LK reads the boot reason register and checks hardware key state to select a boot mode. The enumeration covers the full production matrix: `NORMAL_BOOT`, `SW_REBOOT`, `ALARM_BOOT`, `RECOVERY_BOOT`, `META_BOOT` (engineering testing), `FACTORY_BOOT`, `FASTBOOT`, `KERNEL_POWER_OFF_CHARGING_BOOT`, and others. Hardware key combinations (volume buttons) can override the boot reason and trigger a boot menu.

**4. Further hardware init.** Battery controller, RTC, and other peripherals that depend on earlier init are brought up here. The boot logo may be updated to reflect the selected mode.

**5. Apps initialization.** Multiple applications launch as separate kernel threads. On production devices the primary app is `mt_boot` (or `aboot`), which implements the fastboot protocol and handles Android image loading. The `shell` app provides a UART-accessible command interface when enabled.

**6. Kernel load and handoff.** The active app loads the appropriate partition (`BOOTIMG`, `RECOVERY`, or `factory.img`). Before jumping to Linux, LK constructs a **tag memory block** containing: boot mode number, DRAM bank addresses and topology, kernel command line (including timing metrics like `pl_t` and `lk_t`), initrd location, and framebuffer geometry. Linux reads this block during early boot.

This sequence is the skeleton. Every subsystem chapter in this guide connects to a specific phase of it.

---
id: ch3
title: Chapter 3 — The Tree as an Architectural Contract
fileRecommendations:
  source:
    - path: app/
      description: Application layer — product behavior, fastboot, shell, Android boot
    - path: dev/
      description: Device-facing support code — Block I/O, shared hardware abstractions
    - path: lib/
      description: Shared support code used across the tree
    - path: top/
      description: Top-level boot and integration glue
  docs:
    - path: platform/
      description: Board/platform ports that bind the kernel to real hardware
    - path: target/
      description: Target descriptions that choose concrete hardware and configuration
    - path: project/
      description: Build-time composition units for concrete firmware products
---

LK's directory layout is the main way the kernel separates responsibilities. Each layer has a defined scope.

`arch/` owns CPU semantics: interrupt entry, exception handling, context switching, atomics, barriers, and MMU enablement. It may assume CPU behavior but not board wiring.

`platform/` owns SoC and board-family bring-up: timers, interrupt controllers, UART selection, memory layout, clocks, and early display. Platform code on MediaTek SoCs lives at `mediatek/platform/${platform}/lk/` and handles hardware as specific as RGB565 framebuffer allocation for the Mali GPU display driver. It may assume interrupt controller and UART choices, but not product policy.

`target/` names concrete deployment environments: the exact board that chooses one platform, one architecture path, and a particular hardware profile. `project/` composes features into a finished image.

`app/` is the product surface. The decision between shipping `mt_boot`, `aboot`, or `shell` happens here. On production devices, the boot app reads the boot mode determined during platform init and acts on it — loading the right partition, running fastboot if requested, or driving the boot menu.

`dev/` holds reusable hardware-facing support that multiple platforms share: Block I/O drivers, FAT32 and ext2 filesystem support (used when mounting partitions), and other hardware abstractions that sit above raw architecture details.

When reading LK, the key question for any piece of code is: **"Is this behavior fundamental to the kernel, the CPU, a board family, or a shipped product?"** The directory tree is usually already answering it.

---
id: ch4
title: Chapter 4 — Build Composition Is a First-Class Subsystem
fileRecommendations:
  source:
    - path: makefile
      description: Entry point into LK's build flow
    - path: engine.mk
      description: Core build orchestration logic
    - path: make/
      description: Build support machinery and reusable make fragments
    - path: lk_inc.mk.example
      description: Example of local build configuration override patterns
  docs:
    - path: project/
      description: Project-level composition inputs
    - path: target/
      description: Target-level build selection and hardware binding
---

In LK, the build system is not just a way to compile code. It is the mechanism that defines which kernel you are actually shipping.

The distinction between `project/`, `target/`, `platform/`, and `arch/` becomes concrete in the build. A target chooses a hardware context. A project chooses a product shape. The build engine resolves those inputs into a module graph and a final image.

This is especially important because so much policy is static in a bootloader. Feature selection, debug support, shell inclusion, memory layout decisions, and board-specific capabilities happen at build time instead of runtime. Whether the `shell` app is included — and therefore whether a developer can get a UART prompt — is a build-time decision. Whether fastboot is present is a build-time decision. The image that ships encodes those choices permanently.

If you want to understand how an LK image differs between two devices, start from `project/` and `target/` before diving into C files. That tells you which subsystems are even present. `engine.mk`, `makefile`, and the `make/` directory are part of the kernel's architecture, not infrastructure. **Composition is the control plane.**

---
id: ch5
title: Chapter 5 — Concurrency in a Bootloader Kernel
fileRecommendations:
  source:
    - path: kernel/
      description: Threading, synchronization, wait queues, timers, and scheduler internals
    - path: lib/
      description: Support primitives commonly used by kernel subsystems
    - path: arch/
      description: Context-switch and interrupt-sensitive architecture hooks
    - path: app/
      description: Application threads — multiple apps run concurrently during boot
  docs:
    - path: README.md
      description: SMP-aware kernel positioning at the project overview level
---

LK's threading model is not decorative. The boot flow depends on it structurally.

As described in Chapter 2, LK wraps the initial boot context into a kernel thread before any hardware init. By the time apps run, each app is its own thread — `mt_boot`, fastboot, and `shell` can all be live simultaneously. The fastboot protocol handler runs in a thread waiting on USB events while another thread manages the display.

That means LK needs real concurrency primitives: a scheduler, wait queues, spinlocks, mutexes, and timers. These are not "just enough to boot" stubs. They handle genuine concurrent access during the boot window.

What changes compared to a general-purpose kernel is the surrounding complexity. There is no process abstraction layer between you and the scheduler. There is no userspace isolation to worry about. The relationship between threads and platform services is direct. That makes the kernel easier to reason about, but mistakes in locking or interrupt context are exposed immediately and often catastrophically.

SMP support is present. Even in a bootloader context, some SoCs bring up secondary cores during LK's runtime. The scheduler handles this without modification to the core threading model — architecture code and platform init handle core bring-up; the scheduler sees additional CPUs become available.

Read `kernel/` expecting small, reusable, boot-safe abstractions. In this context, a wait queue is not a performance tool. It is what lets the fastboot thread sleep on USB input while the display thread continues running.

---
id: ch6
title: Chapter 6 — How to Read LK Effectively
fileRecommendations:
  source:
    - path: README.md
      description: Re-anchor on the project goals after exploring the tree
    - path: engine.mk
      description: Revisit the build engine once the directory roles make more sense
    - path: top/
      description: Integration glue that ties the image together
    - path: rust/
      description: Emerging Rust support and experimentation in the tree
  docs:
    - path: docs/
      description: Documentation hub for deeper follow-up reading
    - path: app/
      description: Product-facing functionality — the visible behavior of LK on a real device
---

A good LK reading order:

1. `README.md` for the system's stated purpose.
2. `makefile`, `engine.mk`, `project/`, and `target/` to understand build composition and what features are present.
3. `kernel/` to understand the core runtime model: threads, scheduler, wait queues, timers.
4. `arch/` to see how the kernel hits the CPU: exception entry, context switch, MMU.
5. `platform/` and `target/` to see how the abstractions hit real hardware: interrupt controller, UART, display, storage.
6. `app/` to see what the bootloader actually does: Android boot, fastboot, shell.
7. `dev/` and `lib/` for shared infrastructure that crosses the above layers.

That order works because LK is easiest to understand as a complete bootloader system, not as isolated subsystems. The boot flow in Chapter 2 is the thread you can pull through all of these layers — each directory corresponds to a phase or a layer of that flow.

The final mental model: LK is a **kernel kit for constrained boot environments**. The core stays compact. Hardware variance is isolated in `arch/` and `platform/`. Product assembly happens in `project/` and `app/`. The image that ships is defined by the build, not discovered at runtime. And the tree layout encodes the architectural contract before you ever open a C file.
