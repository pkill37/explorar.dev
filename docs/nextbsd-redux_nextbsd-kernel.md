---
curatedRepoId: nextbsd-kernel
owner: nextbsd-redux
repo: nextbsd-kernel
revision: dcfa0cda0600d7ecce6216adcc7d8b31982ef702
guideId: nextbsd-kernel-guide
name: NextBSD Kernel In The Mind
description: Understanding NextBSD as a kernel patch and configuration layer
defaultOpenIds:
  - ch1
  - ch2
  - ch3
  - ch4
---

# NextBSD Kernel In The Mind

NextBSD's kernel repository is not a full forked `src` tree. It is a disciplined patch, overlay, configuration, and CI layer on top of a FreeBSD kernel source base. Read it as a record of intentional differences.

---
id: ch1
title: Chapter 1 — Patch Layer, Not Fork
fileRecommendations:
  readingOrder:
    - path: README.md
      description: Repository purpose, layout, and build workflow
      type: docs
    - path: patches/README.md
      description: Patch workflow and contribution rules
      type: docs
    - path: patches/series
      description: Ordered patch list applied to the FreeBSD kernel base
      type: source
    - path: config/NEXTBSD
      description: Kernel configuration used for NextBSD builds
      type: source
---

The most important design choice is that NextBSD records kernel changes as patches and overlays rather than carrying a full rewritten source import. `patches/series` is therefore the table of contents for kernel behavior changes.

This style makes the delta legible. Each patch can explain the upstream context, the local policy, and the risk of divergence. `config/NEXTBSD` then shows how the resulting kernel is built into a named configuration.

---
id: ch2
title: Chapter 2 — Configuration As Identity
fileRecommendations:
  readingOrder:
    - path: config/NEXTBSD
      description: Kernel configuration and identity
      type: source
    - path: README.md
      description: Build trigger and artifact overview
      type: docs
    - path: ci
      description: Continuous-integration support directory
      type: source
---

Kernel identity is partly source code and partly configuration. The `NEXTBSD` config includes the upstream kernel shape but gives the build its own identity and policy surface.

The CI files matter because this repository builds against a prepared FreeBSD source base. That turns kernel maintenance into a repeatable overlay operation: update the base, apply the patch series, build the configured kernel, then publish artifacts for downstream image assembly.

---
id: ch3
title: Chapter 3 — Kernel Policy Patches
fileRecommendations:
  readingOrder:
    - path: patches/0008-NextBSD-enable-unprivileged-mounts-vfs-usermount-1.patch
      description: NextBSD policy patch for unprivileged mounts
      type: source
    - path: patches/0009-NextBSD-default-elf64-fallback_brand-to-ELFOSABI_LINU.patch
      description: NextBSD policy patch for ELF64 Linux fallback branding
      type: source
    - path: patches/series
      description: Ordering context for policy patches
      type: source
---

Some NextBSD kernel changes are not new subsystems; they are policy decisions made persistent in the kernel because the rest of the operating system is intentionally not stock FreeBSD.

The unprivileged mount and ELF branding patches show this clearly. Both are small in code size but large in operating-system behavior. They encode defaults that would otherwise live in FreeBSD rc scripts, sysctl configuration, or local administrator setup.

---
id: ch4
title: Chapter 4 — Overlays And Integration
fileRecommendations:
  readingOrder:
    - path: src-overlay
      description: Source overlay directory applied on top of the base
      type: source
    - path: patches/series
      description: Patch ordering before overlays and build
      type: source
    - path: README.md
      description: Relationship between kernel build, object artifact, and module builds
      type: docs
---

The overlay directory is the other half of the patch story. Patches modify existing base files; overlays can add or replace source paths as part of the kernel build input.

For exploration, keep three layers separate in your head: the upstream FreeBSD source base, the ordered patch series, and the overlay/config/build workflow. NextBSD kernel behavior is the result of all three, not any single file.
