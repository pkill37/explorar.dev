// Linux Kernel Guide Configuration
import React from 'react';
import ChapterQuiz, { QuizQuestion } from '@/components/ChapterQuiz';
import { createFileRecommendationsComponent, GuideSection } from '@/lib/project-guides';

export function createLinuxKernelGuide(
  openFileInTab: (path: string, searchPattern?: string) => void
): GuideSection[] {
  // Chapter 1 Questions
  const ch1Questions: QuizQuestion[] = [
    {
      id: 'ch1-q1',
      question: 'What is the fundamental difference between the kernel and a process?',
      options: [
        'The kernel is a special process with elevated privileges',
        "The kernel is not a process—it's the system itself that serves processes",
        'The kernel is just a library that processes link against',
        'There is no difference; they are the same thing',
      ],
      correctAnswer: 1,
      explanation:
        "The kernel is not a process—it's the always-present system authority that bridges hardware and software, orchestrating all processes.",
    },
    {
      id: 'ch1-q2',
      question: "What is the kernel's primary responsibility?",
      options: [
        'To manage its own resources efficiently',
        'To support and serve user processes',
        'To optimize hardware performance',
        'To provide a graphical interface',
      ],
      correctAnswer: 1,
      explanation:
        "The kernel's primary role is to support user processes, ensuring their smooth execution rather than managing resources for its own benefit.",
    },
  ];

  // Chapter 2 Questions
  const ch2Questions: QuizQuestion[] = [
    {
      id: 'ch2-q1',
      question: "What is the Linux kernel's architectural model?",
      options: [
        'Microkernel with separate processes',
        'Monolithic in structure but coordinated in behavior',
        'Hybrid kernel with user-space drivers',
        'Exokernel with direct hardware access',
      ],
      correctAnswer: 1,
      explanation:
        'The Linux kernel is monolithic in structure but operates as a coordinated system where subsystems follow shared rules for timing, context, and concurrency.',
    },
    {
      id: 'ch2-q2',
      question: 'How does the kernel ensure safe concurrency?',
      options: [
        'By using only single-threaded code',
        'Through stateless, context-aware code with fine-grained locking',
        'By preventing all concurrent access',
        'By using only user-space synchronization',
      ],
      correctAnswer: 1,
      explanation:
        'The kernel ensures safe concurrency through stateless, context-aware code that operates on private data for each thread or process, using mechanisms like indirection, fine-grained locking, and RCU.',
    },
  ];

  // Chapter 3 Questions
  const ch3Questions: QuizQuestion[] = [
    {
      id: 'ch3-q1',
      question: 'How does the kernel view memory?',
      options: [
        'As a simple flat address space',
        'As a responsibility allocated based on subsystem needs',
        'As a fixed-size pool',
        'As user-space memory only',
      ],
      correctAnswer: 1,
      explanation:
        "The kernel doesn't view memory as a simple map, but as a responsibility, allocating it based on the specific needs and behaviors of each subsystem.",
    },
    {
      id: 'ch3-q2',
      question: 'What does the kernel enforce beyond code execution?',
      options: [
        'Only memory access',
        'Strict control over actions based on permissions, namespaces, capabilities, and execution context',
        'Only file system access',
        'Only network access',
      ],
      correctAnswer: 1,
      explanation:
        'The Linux kernel enforces strict control over actions based on permissions, namespaces, capabilities, and execution context to ensure processes operate within defined boundaries.',
    },
  ];

  // Chapter 4 Questions
  const ch4Questions: QuizQuestion[] = [
    {
      id: 'ch4-q1',
      question: 'What marks the transition from hardware setup to a functioning kernel?',
      options: ['The bootloader', 'The start_kernel() function', 'The init process', 'The shell'],
      correctAnswer: 1,
      explanation:
        'The transition from hardware setup to a fully functioning Linux kernel is marked by the start_kernel() function, which bridges architecture-specific setup and the architecture-neutral kernel core.',
    },
    {
      id: 'ch4-q2',
      question: 'What represents a process in the Linux kernel?',
      options: [
        'A file descriptor',
        'The task_struct data structure',
        'A memory page',
        'A system call',
      ],
      correctAnswer: 1,
      explanation:
        'In Linux, a process is represented by the task_struct, a data structure the kernel uses to manage execution, including memory, CPU state, and open files.',
    },
  ];

  // Chapter 5 Questions
  const ch5Questions: QuizQuestion[] = [
    {
      id: 'ch5-q1',
      question: 'How is the Linux kernel "entered"?',
      options: [
        'Only through system calls',
        'Through system calls, hardware interrupts, or exceptions',
        'Only through interrupts',
        'Only through exceptions',
      ],
      correctAnswer: 1,
      explanation:
        'The Linux kernel is "entered" rather than "run," with execution triggered by system calls, hardware interrupts, or exceptions.',
    },
    {
      id: 'ch5-q2',
      question: 'What happens to a syscall in a virtualized guest OS?',
      options: [
        'It is handled exactly like on the host',
        'It appears normal but may trigger VMEXIT for privileged actions',
        'It is always blocked',
        'It bypasses the guest kernel',
      ],
      correctAnswer: 1,
      explanation:
        'In a guest OS, the syscall appears to be handled normally by the guest kernel, but if privileged actions are needed (like accessing hardware), it triggers a VMEXIT.',
    },
  ];

  // Chapter 6 Questions
  const ch6Questions: QuizQuestion[] = [
    {
      id: 'ch6-q1',
      question: 'How does Linux maintain structure across tasks?',
      options: [
        'By using a stateless CPU and stateful kernel',
        'By keeping all state in the CPU',
        'By using only user-space state',
        'By avoiding context switching',
      ],
      correctAnswer: 0,
      explanation:
        'The division between stateless execution and stateful management defines how Linux maintains structure across tasks. The CPU executes blindly, while the kernel preserves all context externally.',
    },
    {
      id: 'ch6-q2',
      question: 'What is an interrupt in the kernel?',
      options: [
        'An unexpected disruption',
        'A deliberate mechanism prepared in advance for system response',
        'A bug in the code',
        'A user-space event',
      ],
      correctAnswer: 1,
      explanation:
        'An interrupt is a deliberate mechanism, prepared in advance, through which the system responds to events that occur independently of any running task.',
    },
  ];

  // Chapter 7 Questions
  const ch7Questions: QuizQuestion[] = [
    {
      id: 'ch7-q1',
      question: 'How do kernel modules interact with each other?',
      options: [
        'Through direct function calls',
        'Only through explicitly exported symbols',
        'Through shared global variables',
        'Through user-space interfaces',
      ],
      correctAnswer: 1,
      explanation:
        'Kernel modules in Linux interact only through explicitly exported symbols, ensuring isolation and system stability.',
    },
    {
      id: 'ch7-q2',
      question: 'What interfaces exist between user space and the kernel?',
      options: [
        'Only system calls',
        'Syscalls, /proc, ioctl, mmap, and eBPF',
        'Only /proc',
        'Only ioctl',
      ],
      correctAnswer: 1,
      explanation:
        "Understanding the various interfaces between user space and the Linux kernel—such as syscalls, /proc, ioctl, mmap, and eBPF—provides insight into the kernel's flexibility.",
    },
  ];

  // Chapter 8 Questions
  const ch8Questions: QuizQuestion[] = [
    {
      id: 'ch8-q1',
      question: 'What is the key difference between multitasking and virtualization?',
      options: [
        'Multitasking uses multiple CPUs, virtualization uses one',
        'Multitasking manages multiple processes on one OS, virtualization runs multiple OSes on one machine',
        'There is no difference',
        'Multitasking is for servers, virtualization is for desktops',
      ],
      correctAnswer: 1,
      explanation:
        'Multitasking allows a single OS to manage multiple processes, whereas virtualization enables multiple OSes to run on a single machine, each believing it controls its own hardware.',
    },
    {
      id: 'ch8-q2',
      question: 'What is the advantage of io_uring over epoll?',
      options: [
        'It uses fewer system calls',
        'It allows submitting operations in advance via shared memory, reducing overhead',
        'It works only with files',
        'It requires less memory',
      ],
      correctAnswer: 1,
      explanation:
        'io_uring enhances Linux I/O by allowing applications to submit operations in advance via a shared memory ring, reducing overhead and eliminating extra syscalls.',
    },
  ];

  // Chapter 9 Questions
  const ch9Questions: QuizQuestion[] = [
    {
      id: 'ch9-q1',
      question: 'Why is the kernel always present even when not running?',
      options: [
        'It runs continuously in a loop',
        'It is always mapped into memory and activated when needed',
        'It is loaded into every process',
        'It never sleeps',
      ],
      correctAnswer: 1,
      explanation:
        'The kernel remains a constant presence in the system, always mapped into memory but only activated when needed through system calls and interrupts.',
    },
    {
      id: 'ch9-q2',
      question: 'Why do kernels stay in C?',
      options: [
        'Because of tradition',
        'For precision, determinism, full control, and alignment with hardware',
        'Because C is the easiest language',
        'Because other languages are not available',
      ],
      correctAnswer: 1,
      explanation:
        'C remains the language of choice not out of tradition, but because it offers unmatched alignment with hardware, build-time configurability, and structural clarity without abstraction overhead.',
    },
  ];

  return [
    {
      id: 'ch1',
      title: 'Chapter 1 — Understanding Linux Kernel Before Code',
      body: (
        <div>
          <p>
            The kernel isn&apos;t a process—it&apos;s the system. It serves user processes, reacts
            to context, and enforces separation and control.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>
              The kernel is not a process but the very foundation that orchestrates the entire
              system
            </li>
            <li>The kernel&apos;s primary role is to support user processes</li>
            <li>The kernel operates as a layered system that enforces structure at runtime</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Documentation/scheduler/sched-design-CFS.rst',
                description: 'Scheduler design and kernel thread management',
              },
              { path: 'Documentation/core-api/kernel-api.rst', description: 'Kernel thread API' },
            ],
            [
              { path: 'kernel/sched/', description: 'Scheduler implementation' },
              { path: 'kernel/sched/core.c', description: 'Core scheduler logic' },
              { path: 'kernel/sched/fair.c', description: 'CFS scheduler implementation' },
              { path: 'kernel/sched/rt.c', description: 'Real-time scheduler' },
              { path: 'include/linux/sched.h', description: 'Process and thread structures' },
              { path: 'include/linux/sched/task.h', description: 'Task structure definitions' },
              { path: 'kernel/fork.c', description: 'Process creation' },
              { path: 'kernel/exit.c', description: 'Process termination' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch1" questions={ch1Questions} />
        </div>
      ),
    },
    {
      id: 'ch2',
      title: 'Chapter 2 — System Foundations',
      body: (
        <div>
          <p>
            The Linux kernel is a modular, secure core that manages hardware, memory, processes, and
            user space to ensure stability and security.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>Monolithic form with coordinated behavior</li>
            <li>Kernel objects reveal the design (task_struct, msg_queue, inode)</li>
            <li>Safe concurrency through stateless, context-aware code</li>
            <li>The power of indirection for per-thread references</li>
            <li>Device model: how hardware becomes /dev</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Documentation/filesystems/vfs.rst',
                description: 'VFS and inode structures',
              },
              { path: 'Documentation/driver-api/driver-model/', description: 'Device model' },
            ],
            [
              {
                path: 'kernel/',
                description:
                  'Core kernel functionality: scheduling, process management, system calls',
              },
              {
                path: 'mm/',
                description: 'Memory management: allocation, page tables, and virtual memory',
              },
              { path: 'fs/', description: 'Filesystem layer: VFS, inodes, and file operations' },
              {
                path: 'net/',
                description: 'Networking stack: protocols, sockets, and network interfaces',
              },
              {
                path: 'drivers/',
                description: 'Device drivers: hardware abstraction and device model',
              },
              {
                path: 'arch/x86/',
                description:
                  'x86 architecture-specific code: entry points and low-level operations',
              },
              { path: 'include/linux/sched.h', description: 'task_struct definition' },
              { path: 'include/linux/fs.h', description: 'File system structures' },
              { path: 'include/linux/inode.h', description: 'Inode structure definitions' },
              { path: 'include/linux/spinlock.h', description: 'Spinlock primitives' },
              { path: 'include/linux/mutex.h', description: 'Mutex definitions' },
              { path: 'kernel/locking/', description: 'Locking mechanisms' },
              { path: 'drivers/base/core.c', description: 'Device model core' },
              { path: 'drivers/base/bus.c', description: 'Bus subsystem' },
              { path: 'drivers/base/class.c', description: 'Device class management' },
              { path: 'ipc/', description: 'IPC mechanisms' },
              { path: 'ipc/msg.c', description: 'Message queues' },
              { path: 'ipc/sem.c', description: 'Semaphores' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch2" questions={ch2Questions} />
        </div>
      ),
    },
    {
      id: 'ch3',
      title: 'Chapter 3 — Memory, Isolation, and Enforcement',
      body: (
        <div>
          <p>
            The kernel doesn&apos;t view memory as a simple map, but as a responsibility, allocating
            it based on the specific needs and behaviors of each subsystem.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>Memory is not a place—it&apos;s a system (NUMA, zones, pages)</li>
            <li>Memory lifecycle and the roles that shape it</li>
            <li>Shared code, separate state in kernel memory management</li>
            <li>The kernel is always there—understanding its memory structure</li>
            <li>Enforcement beyond code execution: permissions, namespaces, capabilities</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Documentation/core-api/memory-allocation.rst',
                description: 'Memory allocation APIs',
              },
              { path: 'Documentation/admin-guide/mm/', description: 'Memory zones and NUMA' },
            ],
            [
              { path: 'mm/', description: 'Memory management subsystem' },
              { path: 'mm/page_alloc.c', description: 'Page allocation' },
              { path: 'mm/memory.c', description: 'Memory management core' },
              { path: 'mm/vmalloc.c', description: 'Virtual memory allocation' },
              { path: 'mm/slab.c', description: 'Slab allocator' },
              { path: 'mm/slub.c', description: 'SLUB allocator' },
              { path: 'mm/kmemleak.c', description: 'Kmemleak memory leak detector' },
              { path: 'include/linux/gfp.h', description: 'GFP flags for memory allocation' },
              { path: 'include/linux/mm_types.h', description: 'Memory type definitions' },
              { path: 'include/linux/mm.h', description: 'Memory management headers' },
              { path: 'include/linux/slab.h', description: 'Slab allocator definitions' },
              { path: 'kernel/capability.c', description: 'POSIX capabilities' },
              { path: 'include/linux/capability.h', description: 'Capability definitions' },
              { path: 'kernel/user_namespace.c', description: 'User namespace implementation' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch3" questions={ch3Questions} />
        </div>
      ),
    },
    {
      id: 'ch4',
      title: "Chapter 4 — Boot, Init, and the Kernel's Entry",
      body: (
        <div>
          <p>
            The transition from hardware setup to a fully functioning Linux kernel is marked by
            staged initialization that brings online critical subsystems.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>Where boot ends: the kernel begins with start_kernel()</li>
            <li>From vmlinuz to eBPF: what actually runs inside the kernel</li>
            <li>What really happens when you run ./hello</li>
            <li>How a Linux process works from the kernel&apos;s point of view</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Documentation/admin-guide/kernel-parameters.rst',
                description: 'Kernel boot parameters',
              },
              { path: 'Documentation/arch/x86/boot.rst', description: 'x86 boot process' },
            ],
            [
              { path: 'init/main.c', description: 'Kernel initialization - start_kernel()' },
              { path: 'init/initramfs.c', description: 'Initramfs handling' },
              { path: 'kernel/fork.c', description: 'Process creation with fork() and clone()' },
              { path: 'kernel/exit.c', description: 'Process termination' },
              { path: 'kernel/module/main.c', description: 'Kernel module management' },
              { path: 'include/linux/module.h', description: 'Module definitions' },
              {
                path: 'arch/x86/kernel/',
                description: 'x86 architecture-specific initialization',
              },
              { path: 'arch/x86/kernel/head_64.S', description: 'x86_64 boot assembly' },
              { path: 'fs/exec.c', description: 'execve() implementation' },
              { path: 'fs/binfmt_elf.c', description: 'ELF binary format handler' },
              { path: 'include/linux/sched.h', description: 'task_struct definition' },
              { path: 'include/linux/binfmts.h', description: 'Binary format definitions' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch4" questions={ch4Questions} />
        </div>
      ),
    },
    {
      id: 'ch5',
      title: 'Chapter 5 — Entering the Kernel',
      body: (
        <div>
          <p>
            The Linux kernel is &quot;entered&quot; rather than &quot;run,&quot; with execution
            triggered by system calls, hardware interrupts, or exceptions.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>How the kernel is entered: syscalls, traps, and interrupts</li>
            <li>Syscalls from two perspectives: the host and the guest OS</li>
            <li>Where system calls are handled in the Linux kernel</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              { path: 'Documentation/core-api/irq/', description: 'Interrupt handling' },
              {
                path: 'Documentation/userspace-api/',
                description: 'User space API documentation',
              },
            ],
            [
              { path: 'arch/x86/entry/', description: 'System call entry points' },
              { path: 'arch/x86/entry/syscalls/', description: 'System call table' },
              { path: 'arch/x86/entry/entry_64.S', description: 'x86_64 syscall entry assembly' },
              { path: 'arch/x86/entry/common.c', description: 'Common syscall handling' },
              { path: 'kernel/sys.c', description: 'System call implementations' },
              { path: 'kernel/irq/', description: 'Interrupt handling' },
              { path: 'kernel/irq_work.c', description: 'Interrupt work queues' },
              { path: 'kernel/softirq.c', description: 'Software interrupts' },
              { path: 'include/linux/uaccess.h', description: 'User space access helpers' },
              { path: 'include/linux/syscalls.h', description: 'System call definitions' },
              { path: 'arch/x86/lib/usercopy.c', description: 'User space copy functions' },
              { path: 'arch/x86/lib/usercopy_64.c', description: 'x86_64 user copy routines' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch5" questions={ch5Questions} />
        </div>
      ),
    },
    {
      id: 'ch6',
      title: 'Chapter 6 — Execution and Contexts',
      body: (
        <div>
          <p>
            The distinct execution paths in the Linux kernel are designed to ensure system
            stability, responsiveness, and efficiency.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>Stateless CPU, stateful kernel: how execution is orchestrated</li>
            <li>What the kernel builds—layer by layer</li>
            <li>Kernel execution paths: what runs where, and why it matters</li>
            <li>An interrupt is not a disruption—it&apos;s design</li>
            <li>Execution is logical, placement is physical</li>
            <li>Synchronization beyond concurrency</li>
            <li>What makes a kernel thread &quot;kernel&quot;?</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              {
                path: 'Documentation/scheduler/sched-design-CFS.rst',
                description: 'Task state structures and CFS scheduler design',
              },
              {
                path: 'Documentation/core-api/workqueue.rst',
                description: 'Workqueue mechanism',
              },
            ],
            [
              { path: 'kernel/sched/', description: 'Scheduler implementation' },
              { path: 'kernel/sched/core.c', description: 'Core scheduler logic' },
              { path: 'kernel/sched/fair.c', description: 'CFS scheduler' },
              { path: 'kernel/sched/rt.c', description: 'Real-time scheduler' },
              { path: 'kernel/sched/deadline.c', description: 'Deadline scheduler' },
              { path: 'kernel/sched/idle.c', description: 'Idle task scheduling' },
              { path: 'kernel/softirq.c', description: 'Software interrupts' },
              { path: 'kernel/workqueue.c', description: 'Workqueue implementation' },
              { path: 'kernel/irq/', description: 'Interrupt subsystem' },
              { path: 'kernel/irq/manage.c', description: 'Interrupt management' },
              { path: 'kernel/locking/', description: 'Locking primitives' },
              { path: 'kernel/locking/spinlock.c', description: 'Spinlock implementation' },
              { path: 'kernel/locking/mutex.c', description: 'Mutex implementation' },
              { path: 'include/linux/spinlock.h', description: 'Spinlock definitions' },
              { path: 'include/linux/mutex.h', description: 'Mutex definitions' },
              { path: 'include/linux/sched.h', description: 'task_struct and scheduling' },
              { path: 'include/linux/workqueue.h', description: 'Workqueue definitions' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch6" questions={ch6Questions} />
        </div>
      ),
    },
    {
      id: 'ch7',
      title: 'Chapter 7 — Communication and Cooperation',
      body: (
        <div>
          <p>
            Inside the Linux kernel, communication across different contexts is managed through
            specialized tools to ensure safe, efficient coordination.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>How the kernel talks to itself—tools for internal communication</li>
            <li>Kernel modules know each other only through exported symbols</li>
            <li>Bridging the gaps between components</li>
            <li>Beyond libc: how user space really talks to the kernel</li>
            <li>Understanding interface layers from user space to the kernel</li>
            <li>What really happens when you call open() in Linux?</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              { path: 'Documentation/filesystems/vfs.rst', description: 'VFS layer' },
              {
                path: 'Documentation/kernel-hacking/modules.rst',
                description: 'Module management',
              },
            ],
            [
              { path: 'ipc/', description: 'IPC mechanisms' },
              { path: 'ipc/msg.c', description: 'Message queues' },
              { path: 'ipc/sem.c', description: 'Semaphores' },
              { path: 'ipc/shm.c', description: 'Shared memory' },
              { path: 'ipc/namespace.c', description: 'IPC namespace' },
              { path: 'include/linux/msg.h', description: 'Message queue structures' },
              { path: 'include/linux/shm.h', description: 'Shared memory structures' },
              { path: 'fs/open.c', description: 'open() implementation' },
              { path: 'fs/namei.c', description: 'Path resolution (namei)' },
              { path: 'fs/read_write.c', description: 'File read/write operations' },
              { path: 'fs/inode.c', description: 'Inode operations' },
              { path: 'fs/dcache.c', description: 'Directory cache' },
              { path: 'fs/file.c', description: 'File descriptor management' },
              { path: 'include/linux/fs.h', description: 'File system structures' },
              { path: 'include/linux/fcntl.h', description: 'File control definitions' },
              { path: 'kernel/module/main.c', description: 'Module symbol exports' },
              { path: 'include/linux/export.h', description: 'EXPORT_SYMBOL macros' },
              { path: 'kernel/kallsyms.c', description: 'Kernel symbol management' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch7" questions={ch7Questions} />
        </div>
      ),
    },
    {
      id: 'ch8',
      title: 'Chapter 8 — Scheduling, I/O, and Virtualization',
      body: (
        <div>
          <p>
            When an application reads from or writes to a file, the request travels through a series
            of kernel subsystems that transform user-level operations into low-level disk access.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>From intent to I/O: how the kernel sees files, disks, and devices</li>
            <li>The CPU doesn&apos;t move the data—but nothing moves without it</li>
            <li>Time and precision: the kernel&apos;s view of CPU execution</li>
            <li>How select() and poll() paved the way for epoll()</li>
            <li>Beyond epoll(): how io_uring redefines Linux I/O</li>
            <li>Multitasking vs virtualization—what&apos;s the real difference?</li>
            <li>The kernel&apos;s role in virtualization: understanding KVM</li>
            <li>VirtIO: network drivers without emulation</li>
          </ul>
          {createFileRecommendationsComponent(
            [
              { path: 'Documentation/core-api/io_uring.rst', description: 'io_uring interface' },
              { path: 'Documentation/virt/kvm/', description: 'KVM implementation' },
            ],
            [
              { path: 'fs/', description: 'Filesystem layer' },
              { path: 'fs/namei.c', description: 'Path resolution' },
              { path: 'fs/open.c', description: 'File opening' },
              { path: 'fs/read_write.c', description: 'File read/write' },
              { path: 'fs/inode.c', description: 'Inode operations' },
              { path: 'fs/aio.c', description: 'Asynchronous I/O' },
              { path: 'block/', description: 'Block layer' },
              { path: 'block/blk-core.c', description: 'Block core functionality' },
              { path: 'block/blk-mq.c', description: 'Multi-queue block layer' },
              { path: 'drivers/', description: 'Device drivers' },
              { path: 'include/linux/fs.h', description: 'File system structures' },
              { path: 'include/linux/blkdev.h', description: 'Block device definitions' },
              { path: 'include/linux/aio.h', description: 'AIO structures' },
              { path: 'io_uring/', description: 'io_uring implementation' },
              { path: 'io_uring/io_uring.c', description: 'io_uring core' },
              { path: 'io_uring/opdef.c', description: 'io_uring operations' },
              { path: 'kernel/time/', description: 'Time management' },
              { path: 'kernel/time/tick-common.c', description: 'Tick handling' },
              { path: 'arch/x86/kvm/', description: 'KVM x86 implementation' },
              { path: 'arch/x86/kvm/x86.c', description: 'KVM x86 core' },
              { path: 'drivers/virtio/', description: 'VirtIO drivers' },
              { path: 'drivers/virtio/virtio_ring.c', description: 'VirtIO ring implementation' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch8" questions={ch8Questions} />
        </div>
      ),
    },
    {
      id: 'ch9',
      title: 'Chapter 9 — Concluding Insights',
      body: (
        <div>
          <p>
            The kernel remains a constant presence in the system, always mapped into memory but only
            activated when needed.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>Why the kernel is always there—even when it&apos;s not running</li>
            <li>All that still runs through it</li>
            <li>Alignment is understanding</li>
            <li>Efficiency, not legacy: why kernels stay in C</li>
          </ul>
          {createFileRecommendationsComponent(
            [{ path: 'Documentation/kernel-hacking/', description: 'Kernel development guide' }],
            [
              { path: 'arch/x86/entry/', description: 'System call entry points' },
              { path: 'kernel/', description: 'Core kernel subsystems' },
              { path: 'kernel/sched/', description: 'Scheduler subsystem' },
              { path: 'kernel/irq/', description: 'Interrupt subsystem' },
              { path: 'kernel/locking/', description: 'Locking subsystem' },
              { path: 'mm/', description: 'Memory management subsystem' },
              { path: 'fs/', description: 'Filesystem subsystem' },
              { path: 'include/linux/', description: 'Kernel headers' },
              { path: 'include/linux/kernel.h', description: 'Core kernel definitions' },
              { path: 'include/linux/types.h', description: 'Kernel type definitions' },
              { path: 'include/uapi/linux/', description: 'User space API headers' },
            ],
            openFileInTab
          )}
          <ChapterQuiz chapterId="ch9" questions={ch9Questions} />
        </div>
      ),
    },
  ];
}
