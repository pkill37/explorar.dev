---
owner: mrcxlinux
repo: srv03rtm-anika
defaultBranch: 9e4d6bae9ed79e542f0f3ab463d6b00866019ec1
guideId: windows-server-2003-guide
name: Windows Server 2003 In The Mind
description: A pedagogical reading guide to the Windows Server 2003 source tree
defaultOpenIds:
  - ch1
  - ch2
  - ch3
  - ch4
  - ch5
  - ch6
  - ch7
  - ch8
---

# Windows Server 2003 In The Mind

> This guide is about reading the tree as a product, not just as source.
>
> The goal is to identify the build contract, the subsystem boundaries, and the release routines that turn an NT 5.2 codebase into a server operating system.

Windows Server 2003 is easiest to approach as a product tree with a control plane. The root files explain the build contract, the subsystem `project.mk` files describe what belongs to each area, and the `tools/` routines turn source into a bootable, signed release. Those layers are the architecture.

The important mental shift is this: the tree is not one monolithic program. It is a composition of runtime layers, server-facing services, device support, and build-time policy, all stitched together by repeatable packaging steps.

---
id: ch1
title: Chapter 1 — Start With the Contract
fileRecommendations:
  readingOrder:
    - path: README.md
      description: Historical context, build notes, and caveats for the tree
      type: source
    - path: project.mk
      description: Root build lifecycle, status updates, and cleanup routines
      type: source
    - path: makefil0
      description: Root entry point for the tree-level build flow
      type: source
    - path: base/project.mk
      description: Core runtime composition contract directly under the root build
      type: source
    - path: base/ntos/project.mk
      description: Kernel-facing subsystem contract that makes the product boundary concrete
      type: source
    - path: base/
      description: Core runtime foundations and shared OS code
      type: directory
    - path: tools/
      description: Build tooling that turns the contract into output
      type: directory
---

```chapter-graph
README.md -> project.mk : product expectations to build contract
project.mk -> makefil0 : root build entry
project.mk -> base/project.mk : root contract flows into core runtime
base/project.mk -> base/ntos/project.mk : core runtime narrows into the NT OS layer
```

The first question this chapter answers is: what is this tree allowed to be?

`README.md` gives you provenance and expectations. `project.mk` is the lifecycle file that stamps build identity, updates status, and cleans output. `makefil0` is the entry point. `base/project.mk` shows how the root contract immediately turns into subsystem composition, and `base/ntos/project.mk` makes that contract concrete at the kernel-facing layer.

If you understand those five files, you understand the tree at the level of intention rather than just at the level of filenames.

---
id: ch2
title: Chapter 2 — Learn the Build Routine
fileRecommendations:
  readingOrder:
    - path: tools/razzle64.cmd
      description: 64-bit entry point for initializing the build environment
      type: source
    - path: tools/razzle.cmd
      description: Main build bootstrap wrapper
      type: source
    - path: tools/prebuild.cmd
      description: Prebuild staging and environment preparation
      type: source
    - path: tools/postbuild.cmd
      description: Postbuild signing, missing-file handling, and packaging
      type: source
    - path: tools/oscdimg.cmd
      description: ISO creation and final media packaging
      type: source
    - path: tools/driver.conf
      description: Driver-signing configuration consumed by the release pipeline
      type: source
    - path: tools/driver.pfx
      description: Signing identity material kept alongside the build tools
      type: source
    - path: certutil/generate.sh
      description: Certificate-generation helper for reproducing local trust material
      type: source
    - path: tools/
      description: The entire build control plane lives here
      type: directory
---

```chapter-graph
tools/razzle64.cmd -> tools/razzle.cmd : bootstrap path
tools/razzle.cmd -> tools/prebuild.cmd : initialize stages
tools/prebuild.cmd -> tools/postbuild.cmd : build to package
tools/postbuild.cmd -> tools/oscdimg.cmd : package ISO
tools/driver.conf -> tools/postbuild.cmd : feed signing configuration
tools/driver.pfx -> tools/postbuild.cmd : provide signing identity
certutil/generate.sh -> tools/driver.pfx : reproduce trust material
```

This chapter is about routine, not just tooling.

The Windows build flow is explicit. `tools/razzle64.cmd` and `tools/razzle.cmd` set up the environment. `tools/prebuild.cmd` prepares the tree. `tools/postbuild.cmd` is where the build becomes a product: artifacts are staged, signed, and packaged. `tools/oscdimg.cmd` is the final media step. `tools/driver.conf`, `tools/driver.pfx`, and `certutil/generate.sh` make the trust material visible instead of leaving it as an implied step.

That is the pedagogical lesson: in a large OS tree, the build pipeline is itself a subsystem.

---
id: ch3
title: Chapter 3 — Subsystem Contracts
fileRecommendations:
  readingOrder:
    - path: base/project.mk
      description: Core runtime composition contract
      type: source
    - path: com/project.mk
      description: COM subsystem composition contract
      type: source
    - path: ds/project.mk
      description: Directory and distributed systems contract
      type: source
    - path: inetcore/project.mk
      description: Internet core contract
      type: source
    - path: inetsrv/project.mk
      description: Internet services contract
      type: source
    - path: shell/project.mk
      description: Shell subsystem contract
      type: source
    - path: termsrv/project.mk
      description: Terminal Services contract
      type: source
    - path: multimedia/project.mk
      description: Multimedia subsystem contract
      type: source
    - path: printscan/project.mk
      description: Printing and scanning contract
      type: source
    - path: drivers/project.mk
      description: Driver family contract
      type: source
    - path: sdktools/project.mk
      description: SDK and product tooling contract
      type: source
    - path: base/
      description: Core runtime and shared OS code
      type: directory
    - path: com/
      description: COM infrastructure and component model support
      type: directory
    - path: ds/
      description: Directory and distributed system support
      type: directory
    - path: inetcore/
      description: Shared internet-facing core logic
      type: directory
    - path: inetsrv/
      description: Server-facing network services
      type: directory
    - path: shell/
      description: Shell and user-facing execution environment
      type: directory
    - path: termsrv/
      description: Terminal Services and remote session support
      type: directory
    - path: multimedia/
      description: Audio, video, and media components
      type: directory
    - path: printscan/
      description: Printing and scanning subsystems
      type: directory
    - path: drivers/
      description: Device driver families and hardware support
      type: directory
    - path: sdktools/
      description: SDK and product tooling support
      type: directory
---

The `project.mk` files are the real contracts of the tree. Each one says: this directory is not just a pile of code, it is a buildable subsystem family with a defined scope.

That matters because Windows Server 2003 is not a single kernel build. It is a composition of core runtime, COM, directory services, network services, shell, terminal sessions, multimedia, printing, drivers, and support tooling. If you want to understand architecture, start by noticing where a `project.mk` exists and ask why that family is separated.

The directory names tell you the product boundaries; the `project.mk` files tell you the build boundaries. Those are often the same thing, and when they are not the difference is worth studying.

---
id: ch4
title: Chapter 4 — Core Boundaries and Shared Layers
fileRecommendations:
  readingOrder:
    - path: public/public_changenum.sd
      description: Public change-number marker for product level identity
      type: source
    - path: mergedcomponents/
      description: Shared components that bridge subsystem seams
      type: directory
    - path: public/
      description: Public-facing exported material and release markers
      type: directory
    - path: base/
      description: Foundational runtime code
      type: directory
    - path: com/
      description: Shared COM layer
      type: directory
    - path: ds/
      description: Directory services layer
      type: directory
---

The tree has to teach you where the seams are.

`mergedcomponents/` exists precisely because some boundaries are difficult to keep perfectly clean. `public/public_changenum.sd` is a release marker, not an implementation detail, and that is the point: some files are about policy, not behavior. `base/`, `com/`, and `ds/` are the layer names that keep showing up because they sit at the bottom of many other families.

Read this chapter as an exercise in separating implementation from boundary marker. A healthy OS tree always has both.

---
id: ch5
title: Chapter 5 — Networking, Ownership, and Shared Service Surfaces
fileRecommendations:
  readingOrder:
    - path: net/branch-reasons-and-info.txt
      description: Why branch-specific networking changes exist
      type: source
    - path: net/owners.txt
      description: Ownership map for the networking subtree
      type: source
    - path: net/makefil0
      description: Network subtree build entry point
      type: source
    - path: net/project.mk
      description: Network subtree build contract
      type: source
    - path: inetcore/project.mk
      description: Shared internet core build contract
      type: source
    - path: inetsrv/project.mk
      description: Server networking build contract
      type: source
    - path: net/
      description: Networking stack and transport code
      type: directory
    - path: inetcore/
      description: Internet-facing shared core
      type: directory
    - path: inetsrv/
      description: Web and server networking services
      type: directory
---

```chapter-graph
net/owners.txt -> net/project.mk : people and build scope
net/branch-reasons-and-info.txt -> net/makefil0 : why changes exist
net/makefil0 -> inetcore/project.mk : network stack composes shared core
inetcore/project.mk -> inetsrv/project.mk : shared core feeds server services
```

This chapter is about the human side of subsystem design.

`net/owners.txt` tells you who owns the surface. `net/branch-reasons-and-info.txt` tells you why branches and exceptions exist. `net/makefil0` and `net/project.mk` turn those governance notes into buildable output. The result is a good model for a large platform tree: code, ownership, and release rationale all live next to each other.

Pedagogically, networking is a good place to learn that a subsystem is not just protocols. It is a service boundary, an ownership boundary, and a change-management boundary.

---
id: ch6
title: Chapter 6 — Shell, Sessions, and the Interactive Environment
fileRecommendations:
  readingOrder:
    - path: shell/common.inc
      description: Shared shell macros and include-time behavior
      type: source
    - path: shell/common.mk
      description: Shared shell build rules
      type: source
    - path: shell/makefile.inc
      description: Shell makefile fragment
      type: source
    - path: shell/gnumakefile
      description: GNU make entry points for shell composition
      type: source
    - path: shell/ccshell.ini
      description: Shell configuration used by the tree
      type: source
    - path: termsrv/project.mk
      description: Terminal Services build contract
      type: source
    - path: shell/
      description: Interactive shell and build scripts for the shell tree
      type: directory
    - path: termsrv/
      description: Remote session infrastructure
      type: directory
---

The shell subtree teaches an important distinction: UI is not the same thing as the interactive environment.

`shell/common.inc` and `shell/common.mk` are the shared layer. `shell/makefile.inc` and `shell/gnumakefile` show how the shell is composed. `shell/ccshell.ini` is a reminder that configuration is part of the product. `termsrv/project.mk` sits alongside that work because remote sessions are not an accessory to the shell; they are another path into it.

If you want to understand the user-facing side of the tree, start by asking how the shell is built, not just what the shell looks like.

---
id: ch7
title: Chapter 7 — Hardware, Media, Printing, and Trust
fileRecommendations:
  readingOrder:
    - path: drivers/archive.txt
      description: Curated driver payloads that were preserved in the tree
      type: source
    - path: drivers/project.mk
      description: Driver family build contract
      type: source
    - path: multimedia/project.mk
      description: Multimedia build contract
      type: source
    - path: multimedia/directx/project.mk
      description: A concrete multimedia leaf contract beneath the family root
      type: source
    - path: printscan/project.mk
      description: Print and scan build contract
      type: source
    - path: certutil/generate.sh
      description: Certificate generation routine for local builds
      type: source
    - path: tools/driver.pfx
      description: Signing material used by the build pipeline
      type: source
    - path: tools/driver.conf
      description: Signing and build configuration for driver-related steps
      type: source
    - path: drivers/
      description: Device-driver families and hardware-facing support
      type: directory
    - path: multimedia/
      description: Audio and video components
      type: directory
    - path: printscan/
      description: Print and scan subsystem
      type: directory
    - path: certutil/
      description: Certificate and trust tooling
      type: directory
    - path: tools/
      description: Signing and packaging support used by release routines
      type: directory
---

This chapter ties together device-facing code and the trust material around it.

The driver tree is not just code. `drivers/archive.txt` records curated payloads, `drivers/project.mk` defines the family boundary, and the signing material in `tools/` makes the release path tangible. `multimedia/project.mk`, `multimedia/directx/project.mk`, and `printscan/project.mk` show the same pattern in other product surfaces: a feature is a build contract plus a directory family, not just a set of `.c` files.

`certutil/generate.sh` is important here because it turns build trust into a reproducible step. In a tree like this, signing and packaging are part of the subsystem story, not an afterthought.

---
id: ch8
title: Chapter 8 — How to Read the Tree End to End
fileRecommendations:
  readingOrder:
    - path: README.md
      description: Re-anchor on the project history and build notes
      type: source
    - path: project.mk
      description: Revisit the root build lifecycle
      type: source
    - path: makefil0
      description: Revisit the root entry point
      type: source
    - path: base/project.mk
      description: Revisit how the root contract fans into the core runtime
      type: source
    - path: tools/razzle64.cmd
      description: Revisit environment bootstrap before the packaging pass
      type: source
    - path: tools/prebuild.cmd
      description: Revisit staging before the packaging pass
      type: source
    - path: tools/postbuild.cmd
      description: Revisit the packaging routine after the code makes sense
      type: source
    - path: tools/oscdimg.cmd
      description: Revisit ISO packaging after postbuild
      type: source
    - path: com/project.mk
      description: Revisit COM as one of the core subsystem contracts
      type: source
    - path: ds/project.mk
      description: Revisit directory services as one of the core subsystem contracts
      type: source
    - path: net/project.mk
      description: Revisit networking as a subsystem contract
      type: source
    - path: shell/project.mk
      description: Revisit the shell as a subsystem contract
      type: source
    - path: drivers/project.mk
      description: Revisit drivers as a subsystem contract
      type: source
    - path: net/owners.txt
      description: Revisit networking ownership after the subsystem map is clear
      type: source
    - path: net/branch-reasons-and-info.txt
      description: Revisit networking branch rationale after the subsystem map is clear
      type: source
    - path: shell/common.mk
      description: Revisit the shell shared build layer
      type: source
    - path: shell/makefile.inc
      description: Revisit the shell composition fragment
      type: source
    - path: termsrv/project.mk
      description: Revisit the remote-session boundary beside the shell
      type: source
    - path: certutil/generate.sh
      description: Revisit certificate generation as part of the trust pipeline
      type: source
    - path: tools/driver.conf
      description: Revisit signing configuration as part of the trust pipeline
      type: source
    - path: tools/driver.pfx
      description: Revisit signing identity material as part of the trust pipeline
      type: source
    - path: base/
      description: Revisit the core runtime foundations
      type: directory
    - path: net/
      description: Revisit networking after the subsystem names make sense
      type: directory
    - path: shell/
      description: Revisit the interactive environment after the subsystem names make sense
      type: directory
    - path: drivers/
      description: Revisit hardware-facing code after the subsystem names make sense
      type: directory
    - path: tools/
      description: Revisit the build control plane after the product structure makes sense
      type: directory
    - path: sdktools/appcompat/
      description: Revisit compatibility tooling as a concrete example of a leaf subtree
      type: directory
---

```chapter-graph
README.md -> project.mk : establish the build contract
project.mk -> tools/postbuild.cmd : package the output
tools/postbuild.cmd -> tools/oscdimg.cmd : produce media
project.mk -> base/project.mk : subsystem contracts flow downward
net/project.mk -> inetsrv/project.mk : services layer on shared code
shell/project.mk -> termsrv/project.mk : interactive surface to remote sessions
```

A good reading order is:

1. Start with `README.md`, `makefil0`, `project.mk`, and `base/project.mk` to learn the tree contract.
2. Read `tools/razzle64.cmd`, `tools/prebuild.cmd`, `tools/postbuild.cmd`, and `tools/oscdimg.cmd` to learn the build and packaging routine.
3. Open `base/project.mk`, `com/project.mk`, `ds/project.mk`, `net/project.mk`, `shell/project.mk`, and `drivers/project.mk` to learn subsystem boundaries.
4. Use `net/owners.txt` and `net/branch-reasons-and-info.txt` to see how ownership and branch history shape the tree.
5. Read `shell/common.mk`, `shell/makefile.inc`, and `termsrv/project.mk` to understand the interactive environment and terminal-session boundary.
6. End with `certutil/generate.sh`, `tools/driver.conf`, and `tools/driver.pfx` to see how trust and signing are made repeatable.

That sequence works because the tree is arranged around composition. The build system tells you how the product is assembled, the subsystem contracts tell you what belongs where, and the release routines tell you how the result becomes a distributable server image.

The pedagogical takeaway is simple: read the build, then the contracts, then one subsystem end to end. That is the fastest way to make the tree legible.
