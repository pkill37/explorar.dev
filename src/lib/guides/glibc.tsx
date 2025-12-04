// glibc Guide Configuration
import React from 'react';
import ChapterQuiz, { QuizQuestion } from '@/components/ChapterQuiz';
import { createFileRecommendationsComponent, GuideSection } from '@/lib/project-guides';

export function createGlibcGuide(
  openFileInTab: (path: string, searchPattern?: string) => void,
  markQuizComplete: (chapterId: string, score: number, total: number) => void,
  getChapterProgress: (chapterId: string) => { quizCompleted: boolean }
): GuideSection[] {
  // Chapter 1 Questions
  const ch1Questions: QuizQuestion[] = [
    {
      id: 'ch1-q1',
      question: "What is glibc's primary role in Linux systems?",
      options: [
        'To provide a graphical interface',
        'To serve as the bridge between user programs and the Linux kernel',
        'To manage hardware directly',
        'To compile programs',
      ],
      correctAnswer: 1,
      explanation:
        'glibc serves as the critical bridge between user programs and the Linux kernel, providing system call wrappers, standard library functions, and POSIX-compliant APIs.',
    },
    {
      id: 'ch1-q2',
      question: 'What happens when you call printf() in a C program?',
      options: [
        'It directly writes to hardware',
        "It goes through glibc's printf implementation, which eventually calls the kernel's write syscall",
        'It bypasses the kernel entirely',
        'It only works in user space',
      ],
      correctAnswer: 1,
      explanation:
        "printf() goes through glibc's implementation in stdio/printf.c, which formats the output and then calls the write() syscall wrapper, which invokes the kernel's sys_write() function.",
    },
    {
      id: 'ch1-q3',
      question: 'What is NPTL in glibc?',
      options: [
        'A network protocol',
        "Native POSIX Thread Library - glibc's threading implementation",
        'A file system',
        'A memory allocator',
      ],
      correctAnswer: 1,
      explanation:
        "NPTL (Native POSIX Thread Library) is glibc's threading implementation, using a 1:1 threading model where each pthread corresponds to one kernel thread.",
    },
  ];

  // Chapter 2 Questions
  const ch2Questions: QuizQuestion[] = [
    {
      id: 'ch2-q1',
      question: 'How does glibc wrap system calls?',
      options: [
        'Through direct function calls',
        'Through assembly code that invokes the syscall instruction',
        'Through JavaScript',
        'Through Python scripts',
      ],
      correctAnswer: 1,
      explanation:
        'glibc wraps system calls using assembly code that invokes the syscall instruction, passing the syscall number and arguments in registers according to the platform ABI.',
    },
    {
      id: 'ch2-q2',
      question: 'What is the syscall entry point on x86-64?',
      options: [
        'The read() function',
        'The syscall instruction in assembly',
        'The printf() function',
        'The malloc() function',
      ],
      correctAnswer: 1,
      explanation:
        'On x86-64, the syscall instruction is the entry point that transfers control from user space to the kernel, with the syscall number in %rax and arguments in %rdi, %rsi, %rdx, etc.',
    },
  ];

  // Chapter 3 Questions
  const ch3Questions: QuizQuestion[] = [
    {
      id: 'ch3-q1',
      question: 'What is a malloc chunk?',
      options: [
        'A file in the file system',
        "The basic unit of memory management in glibc's malloc",
        'A network packet',
        'A thread structure',
      ],
      correctAnswer: 1,
      explanation:
        "A chunk is the basic unit of memory management in glibc's malloc. Each chunk has a header containing size and flags, followed by user data (for allocated chunks) or free list pointers (for free chunks).",
    },
    {
      id: 'ch3-q2',
      question: 'What are fastbins in malloc?',
      options: [
        'Fast network connections',
        'LIFO stacks of recently freed small chunks (16-80 bytes) for fast allocation',
        'Fast file operations',
        'Fast thread creation',
      ],
      correctAnswer: 1,
      explanation:
        'Fastbins are LIFO (stack-like) linked lists of recently freed small chunks (16-80 bytes on 64-bit). They enable very fast allocation for common small sizes without coalescing.',
    },
    {
      id: 'ch3-q3',
      question: 'What is the purpose of arenas in malloc?',
      options: [
        'To organize file systems',
        'To reduce lock contention in multi-threaded programs by having separate memory pools per thread',
        'To manage network connections',
        'To handle signals',
      ],
      correctAnswer: 1,
      explanation:
        'Arenas are separate memory pools that reduce lock contention in multi-threaded programs. Each thread can use its own arena, avoiding the need to lock the main heap for every allocation.',
    },
  ];

  // Chapter 4 Questions
  const ch4Questions: QuizQuestion[] = [
    {
      id: 'ch4-q1',
      question: 'Why does glibc provide optimized string functions?',
      options: [
        'For compatibility only',
        'To leverage SIMD instructions (like AVX2) for 4x faster performance on large strings',
        'To use more memory',
        'To simplify the code',
      ],
      correctAnswer: 1,
      explanation:
        'glibc provides architecture-specific optimized string functions (e.g., strlen-avx2.S) that use SIMD instructions to process multiple bytes in parallel, achieving 4x or better performance.',
    },
    {
      id: 'ch4-q2',
      question: 'What is the fallback strategy for optimized functions?',
      options: [
        'They always use the optimized version',
        'glibc provides generic C implementations as fallbacks when optimizations are not available',
        'They fail if optimization is not available',
        'They use Python instead',
      ],
      correctAnswer: 1,
      explanation:
        'glibc uses a multiarch system where optimized assembly implementations are preferred, but generic C implementations in string/ serve as fallbacks for compatibility.',
    },
  ];

  return [
    {
      id: 'ch1',
      title: 'Chapter 1 — Introduction to glibc',
      body: (
        <div>
          <p>
            glibc serves multiple critical roles: system call wrapper, standard library
            implementation, POSIX layer, optimization layer, and dynamic linker. It&apos;s the
            invisible foundation that makes Linux programming possible.
          </p>
          <p>
            <strong>Key Concepts:</strong>
          </p>
          <ul>
            <li>
              glibc provides the bridge between user programs and the Linux kernel through system
              call wrappers
            </li>
            <li>
              It implements the C standard library (stdio.h, string.h, stdlib.h, etc.) and POSIX
              specifications
            </li>
            <li>NPTL (Native POSIX Thread Library) provides threading support with a 1:1 model</li>
            <li>The dynamic linker (ld.so) loads and links shared libraries at runtime</li>
          </ul>
          <p>
            <strong>The Call Chain:</strong>
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
            {`Your Code: printf("Hello\\n");
    ↓
glibc: printf() in stdio/printf.c
    ↓
glibc: vfprintf() - formatting logic
    ↓
glibc: write() wrapper in sysdeps/unix/sysv/linux/
    ↓
Kernel: syscall entry (arch/x86/entry/entry_64.S)
    ↓
Kernel: sys_write() in fs/read_write.c
    ↓
Hardware: Terminal output`}
          </pre>
          {createFileRecommendationsComponent(
            [
              {
                path: 'sysdeps/unix/sysv/linux/syscalls.list',
                description: 'List of all syscalls and their wrappers',
              },
              {
                path: 'sysdeps/unix/sysv/linux/x86_64/syscall.S',
                description: 'x86-64 syscall assembly implementation',
              },
              {
                path: 'stdio-common/printf.c',
                description: 'printf() implementation',
              },
            ],
            [
              {
                path: 'sysdeps/unix/sysv/linux/read.c',
                description: 'Example: read() syscall wrapper',
              },
              {
                path: 'nptl/pthread_create.c',
                description: 'Thread creation implementation',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz
            chapterId="ch1"
            questions={ch1Questions}
            onComplete={(score, total) => markQuizComplete('ch1', score, total)}
            isCompleted={getChapterProgress('ch1').quizCompleted}
          />
        </div>
      ),
    },
    {
      id: 'ch2',
      title: 'Chapter 2 — System Call Interface',
      body: (
        <div>
          <p>
            glibc provides the interface between user programs and the Linux kernel through system
            calls. Every Linux system call has a glibc wrapper that handles the transition from user
            space to kernel space.
          </p>
          <p>
            <strong>System Call Wrappers:</strong>
          </p>
          <ul>
            <li>Direct syscalls: Functions that directly invoke kernel syscalls using assembly</li>
            <li>Cancellation points: Functions that can be interrupted (like read, write)</li>
            <li>Error handling: Converting errno to appropriate error codes</li>
          </ul>
          <p>
            <strong>Example: read() wrapper</strong>
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
            {`// User calls:
ssize_t n = read(fd, buf, sizeof(buf));

// glibc wrapper (sysdeps/unix/sysv/linux/read.c):
ssize_t __libc_read(int fd, void *buf, size_t nbytes) {
    return INLINE_SYSCALL_CALL(read, fd, buf, nbytes);
}
weak_alias(__libc_read, read)`}
          </pre>
          {createFileRecommendationsComponent(
            [
              {
                path: 'sysdeps/unix/sysv/linux/syscalls.list',
                description: 'Complete list of syscall definitions',
              },
            ],
            [
              {
                path: 'sysdeps/unix/sysv/linux/read.c',
                description: 'read() syscall wrapper',
              },
              {
                path: 'sysdeps/unix/sysv/linux/open.c',
                description: 'open() syscall wrapper',
              },
              {
                path: 'sysdeps/unix/sysv/linux/x86_64/syscall.S',
                description: 'x86-64 syscall assembly implementation',
              },
              {
                path: 'sysdeps/unix/syscall-template.S',
                description: 'Syscall wrapper template',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz
            chapterId="ch2"
            questions={ch2Questions}
            onComplete={(score, total) => markQuizComplete('ch2', score, total)}
            isCompleted={getChapterProgress('ch2').quizCompleted}
          />
        </div>
      ),
    },
    {
      id: 'ch3',
      title: 'Chapter 3 — Memory Management Deep Dive',
      body: (
        <div>
          <p>
            glibc&apos;s malloc is one of the most sophisticated memory allocators in existence.
            Understanding it reveals fundamental concepts in systems programming: memory
            organization, performance optimization, thread safety, and fragmentation management.
          </p>
          <p>
            <strong>Core Concepts:</strong>
          </p>
          <ul>
            <li>
              <strong>Chunks:</strong> The basic unit of memory management. Each chunk has a header
              with size and flags.
            </li>
            <li>
              <strong>Bins:</strong> Free chunks organized into bins (linked lists) by size:
              fastbins (16-80 bytes), small bins (&lt; 512 bytes), large bins (&gt;= 512 bytes).
            </li>
            <li>
              <strong>Arenas:</strong> Separate memory pools per thread to reduce lock contention.
            </li>
            <li>
              <strong>Top Chunk:</strong> The remainder of the heap, source for new allocations.
            </li>
            <li>
              <strong>mmap:</strong> Large allocations (&gt;= 128KB) use mmap directly, bypassing
              the heap.
            </li>
          </ul>
          <p>
            <strong>Chunk Structure:</strong>
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
            {`struct malloc_chunk {
    size_t prev_size;  // Size of previous chunk (if free)
    size_t size;       // Size of this chunk (includes header)
    
    // For free chunks only:
    struct malloc_chunk *fd;  // Forward pointer (next in bin)
    struct malloc_chunk *bk;  // Back pointer (previous in bin)
    
    // User data starts here for allocated chunks
};`}
          </pre>
          <p>
            <strong>Allocation Flow:</strong>
          </p>
          <ol>
            <li>Check fastbins for small sizes (16-80 bytes)</li>
            <li>Check small bins for exact fit</li>
            <li>For large allocations, use mmap directly</li>
            <li>Search unsorted bin</li>
            <li>Search large bins (best fit)</li>
            <li>Use top chunk</li>
            <li>Extend heap via sbrk() or mmap()</li>
          </ol>
          {createFileRecommendationsComponent(
            [
              {
                path: 'malloc/malloc.c',
                description: 'Main allocator implementation (~6,000 lines)',
              },
              {
                path: 'malloc/malloc.h',
                description: 'Internal structures (chunk format)',
              },
            ],
            [
              {
                path: 'malloc/malloc.c',
                description: 'Core allocation logic (_int_malloc)',
              },
              {
                path: 'malloc/arena.c',
                description: 'Multi-arena management',
              },
              {
                path: 'malloc/malloc.c',
                description: 'Deallocation logic (_int_free)',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz
            chapterId="ch3"
            questions={ch3Questions}
            onComplete={(score, total) => markQuizComplete('ch3', score, total)}
            isCompleted={getChapterProgress('ch3').quizCompleted}
          />
        </div>
      ),
    },
    {
      id: 'ch4',
      title: 'Chapter 4 — String and Memory Functions',
      body: (
        <div>
          <p>
            glibc provides highly optimized implementations of standard C string and memory
            functions. These optimizations leverage architecture-specific features like SIMD
            instructions for significant performance gains.
          </p>
          <p>
            <strong>Optimization Strategy:</strong>
          </p>
          <ul>
            <li>
              <strong>Architecture-specific:</strong> Different implementations for x86-64, ARM,
              etc.
            </li>
            <li>
              <strong>SIMD:</strong> Using AVX2, SSE2, and other vector instructions to process
              multiple bytes in parallel
            </li>
            <li>
              <strong>Fallbacks:</strong> Generic C implementations for compatibility
            </li>
          </ul>
          <p>
            <strong>Example: strlen() optimization</strong>
          </p>
          <p>
            The optimized x86-64 version loads 32 bytes at a time using AVX2, processes them 4x
            faster than byte-by-byte, and uses pcmpeqb to find null terminators in parallel.
          </p>
          <p>
            <strong>Multiarch System:</strong>
          </p>
          <p>
            glibc uses a multiarch system where the linker selects the best implementation at
            runtime based on CPU capabilities. The directory structure organizes implementations:
          </p>
          <ul>
            <li>
              <code>sysdeps/x86_64/multiarch/</code> - x86-64 optimized versions
            </li>
            <li>
              <code>string/</code> - Generic fallback implementations
            </li>
          </ul>
          {createFileRecommendationsComponent(
            [
              {
                path: 'string/strlen.c',
                description: 'Generic strlen implementation',
              },
            ],
            [
              {
                path: 'string/strlen.c',
                description: 'Generic strlen fallback',
              },
              {
                path: 'sysdeps/x86_64/multiarch/strlen-avx2.S',
                description: 'AVX2-optimized strlen (4x faster)',
              },
              {
                path: 'string/strcpy.c',
                description: 'Generic strcpy implementation',
              },
              {
                path: 'string/memcpy.c',
                description: 'Generic memcpy implementation',
              },
            ],
            openFileInTab
          )}
          <ChapterQuiz
            chapterId="ch4"
            questions={ch4Questions}
            onComplete={(score, total) => markQuizComplete('ch4', score, total)}
            isCompleted={getChapterProgress('ch4').quizCompleted}
          />
        </div>
      ),
    },
  ];
}
