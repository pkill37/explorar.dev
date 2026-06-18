---
curatedRepoId: reactos
owner: reactos
repo: reactos
revision: 0.4.16
guideId: reactos-guide
name: ReactOS In The Mind
description: Understanding ReactOS before reading the NT-compatible source tree
defaultOpenIds:
  - ch1
  - ch2
  - ch3
  - ch4
  - ch5
---

# ReactOS In The Mind

> This is not a guide to reproducing Windows. It is a guide to reading ReactOS as a deliberately layered compatibility tree with its own build, kernel, and user-mode boundaries.

ReactOS is easiest to understand as an operating system that is trying to be structurally familiar to the Windows NT family while remaining an independent implementation. That means the important questions are architectural: where the kernel starts, where Win32 begins, how the build composes the tree, and which directories correspond to kernel, user mode, and hardware support.

The tree is also large enough that reading it by file is the wrong start. Read it by subsystem and by build surface first.

---
id: ch1
title: Chapter 1 — The Tree and the Build Are the First Abstractions
fileRecommendations:
  readingOrder:
    - path: README.md
      description: Project overview, compatibility goals, and build instructions
      type: source
    - path: INSTALL
      description: Installation and build prerequisites
      type: source
    - path: CMakeLists.txt
      description: Top-level build definition
      type: source
    - path: configure.sh
      description: Unix-like configure entry point
      type: source
    - path: configure.cmd
      description: Windows configure entry point
      type: source
---

ReactOS uses the build system as part of the architecture. `README.md` explains the project goals and how the tree is meant to be built. `INSTALL` adds the practical setup constraints. `CMakeLists.txt` and the `configure` entry points show that the repository is composed around generated build files rather than a single hand-written makefile.

That matters because compatibility work is not just code; it is also module selection, platform configuration, and build-time composition. If you understand how the tree is configured, you already understand a large part of how ReactOS behaves.

---
id: ch2
title: Chapter 2 — Kernel, HAL, and Boot Flow
fileRecommendations:
  readingOrder:
    - path: ntoskrnl/
      description: NT kernel core, system services, memory, object manager, and executive code
      type: source
    - path: hal/
      description: Hardware abstraction layer and platform-specific low-level code
      type: source
    - path: boot/
      description: Boot loader and early startup support
      type: source
---

ReactOS keeps the core operating system split into explicit layers. `ntoskrnl/` is where the NT-style kernel and executive live. `hal/` isolates hardware-dependent behavior so the kernel can remain portable across targets. `boot/` is where the system gets from firmware and loader state into the kernel’s control flow.

This split is not cosmetic. It is how the project separates portability from policy and keeps compatibility work localized. When debugging boot or kernel behavior, start by determining which layer owns the failure.

---
id: ch3
title: Chapter 3 — User Mode, Win32, and Shared DLLs
fileRecommendations:
  readingOrder:
    - path: dll/
      description: Shared system DLLs, Win32 APIs, and compatibility surfaces
      type: source
    - path: base/
      description: Base system code and shared runtime pieces
      type: source
    - path: modules/
      description: Application and subsystem modules that compose the OS image
      type: source
---

ReactOS implements a large part of Windows compatibility above the kernel. `dll/` is the obvious place where Win32 APIs, system DLLs, and support libraries accumulate. `base/` holds foundational code that many layers reuse. `modules/` shows how the system is assembled into bootable or runnable pieces.

This layer is where compatibility becomes visible to applications. Kernel correctness matters, but user-mode behavior is where most Windows-facing expectations are actually tested.

---
id: ch4
title: Chapter 4 — Drivers and Hardware Support
fileRecommendations:
  readingOrder:
    - path: drivers/
      description: Device drivers and hardware-facing subsystems
      type: source
    - path: media/
      description: Installation media, sparse docs, and supporting material
      type: source
    - path: sdk/
      description: SDK headers, build support, and developer-facing interfaces
      type: source
---

ReactOS has to speak to real hardware, not just emulate Windows APIs. `drivers/` contains the device-facing code that turns compatibility goals into actual bootable systems. `sdk/` supports the developer and build surface that keeps the tree coherent. `media/` holds supporting content that helps explain the project and its install/build story.

For a tree this size, the hardware boundary and the developer boundary are both part of the architecture. You cannot understand the system if you only look at the kernel.

---
id: ch5
title: Chapter 5 — How to Read ReactOS Effectively
fileRecommendations:
  readingOrder:
    - path: README.md
      description: Re-anchor on project scope and compatibility claims
      type: source
    - path: ntoskrnl/
      description: Follow the kernel layer after the tree shape is clear
      type: source
    - path: dll/
      description: Study Win32 behavior after the kernel boundary
      type: source
    - path: drivers/
      description: Hardware support and portability decisions
      type: source
    - path: sdk/
      description: Developer tooling and shared interfaces
      type: source
---

A good reading order is:

1. `README.md`, `INSTALL`, and `CMakeLists.txt` to understand the project shape and build entry points.
2. `ntoskrnl/` and `hal/` to understand the kernel and low-level portability boundary.
3. `dll/` and `base/` to understand the user-mode compatibility layer.
4. `drivers/` and `boot/` to understand how the system reaches hardware and starts up.
5. `sdk/` and `modules/` to understand how the tree is assembled and extended.

That order works because ReactOS is a compatibility tree, not just a single subsystem. The architecture is spread across build, kernel, user mode, and hardware layers, and the directory layout makes those layers visible before you open an implementation file.
