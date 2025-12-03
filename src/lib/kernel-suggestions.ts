// Kernel mind suggestions based on current file context

import { KernelSuggestion } from '@/types';

// Pre-defined suggestions based on kernel mind concepts
const KERNEL_SUGGESTIONS: Record<string, KernelSuggestion[]> = {
  // Memory Management suggestions
  'mm/': [
    {
      id: 'memory-management-overview',
      type: 'concept',
      title: 'Memory Management Subsystem',
      description: 'The memory management subsystem handles virtual memory, page allocation, and memory mapping. Key concepts include page tables, zones, and the buddy allocator.',
      relatedFiles: ['mm/memory.c', 'mm/page_alloc.c', 'mm/vmalloc.c', 'mm/slab.c'],
      kernelMindReference: 'Chapter 8: Memory Management',
      priority: 'high',
    },
    {
      id: 'page-allocation',
      type: 'function',
      title: 'Page Allocation Mechanisms',
      description: 'Linux uses a buddy system for page allocation. Functions like alloc_pages() and __get_free_pages() are the core allocation primitives.',
      relatedFiles: ['mm/page_alloc.c', 'include/linux/gfp.h'],
      kernelMindReference: 'Section 8.2: Page Allocation',
      priority: 'high',
    },
    {
      id: 'vmalloc-vs-kmalloc',
      type: 'concept',
      title: 'vmalloc() vs kmalloc()',
      description: 'kmalloc() allocates physically contiguous memory, while vmalloc() allocates virtually contiguous memory. Choose based on size and contiguity requirements.',
      relatedFiles: ['mm/vmalloc.c', 'mm/slab.c'],
      kernelMindReference: 'Section 8.4: Kernel Memory Allocation',
      priority: 'medium',
    },
  ],

  // Process Management suggestions
  'kernel/': [
    {
      id: 'process-scheduling',
      type: 'concept',
      title: 'Process Scheduling',
      description: 'The Linux scheduler uses the Completely Fair Scheduler (CFS) algorithm. It maintains runqueues per CPU and uses red-black trees for efficient scheduling.',
      relatedFiles: ['kernel/sched/core.c', 'kernel/sched/fair.c', 'kernel/sched/rt.c'],
      kernelMindReference: 'Chapter 4: Process Scheduling',
      priority: 'high',
    },
    {
      id: 'process-creation',
      type: 'function',
      title: 'Process Creation with fork()',
      description: 'Process creation involves copy-on-write semantics, where child processes share memory with parents until modification occurs.',
      relatedFiles: ['kernel/fork.c', 'kernel/exit.c'],
      kernelMindReference: 'Section 3.3: Process Creation',
      priority: 'high',
    },
    {
      id: 'task-struct',
      type: 'structure',
      title: 'Task Structure (task_struct)',
      description: 'The task_struct is the process descriptor containing all information about a process: state, memory, files, signals, etc.',
      relatedFiles: ['include/linux/sched.h', 'kernel/fork.c'],
      kernelMindReference: 'Section 3.1: Process Descriptor',
      priority: 'high',
    },
  ],

  // Security suggestions
  'security/': [
    {
      id: 'security-framework',
      type: 'concept',
      title: 'Linux Security Modules (LSM)',
      description: 'LSM provides a framework for implementing security policies. It uses hooks throughout the kernel to enforce access controls.',
      relatedFiles: ['security/security.c', 'security/selinux/', 'security/apparmor/'],
      kernelMindReference: 'Chapter 9: Security',
      priority: 'high',
    },
    {
      id: 'capability-system',
      type: 'concept',
      title: 'POSIX Capabilities',
      description: 'Capabilities divide root privileges into distinct units, allowing fine-grained permission control without full root access.',
      relatedFiles: ['kernel/capability.c', 'include/linux/capability.h'],
      kernelMindReference: 'Section 9.2: Capabilities',
      priority: 'medium',
    },
  ],

  // IPC suggestions
  'ipc/': [
    {
      id: 'ipc-mechanisms',
      type: 'concept',
      title: 'Inter-Process Communication',
      description: 'Linux provides multiple IPC mechanisms: pipes, FIFOs, message queues, semaphores, and shared memory.',
      relatedFiles: ['ipc/msg.c', 'ipc/sem.c', 'ipc/shm.c'],
      kernelMindReference: 'Chapter 5: System Calls and IPC',
      priority: 'medium',
    },
    {
      id: 'message-queues',
      type: 'function',
      title: 'Message Queues',
      description: 'Message queues allow processes to exchange structured data. Each message has a type and priority.',
      relatedFiles: ['ipc/msg.c', 'include/linux/msg.h'],
      kernelMindReference: 'Section 5.4: Message Queues',
      priority: 'medium',
    },
  ],

  // File System suggestions
  'fs/': [
    {
      id: 'vfs-layer',
      type: 'concept',
      title: 'Virtual File System (VFS)',
      description: 'VFS provides a common interface for all file systems. It abstracts file operations through function pointers.',
      relatedFiles: ['fs/namei.c', 'fs/open.c', 'fs/read_write.c'],
      kernelMindReference: 'Chapter 12: The Virtual Filesystem',
      priority: 'high',
    },
    {
      id: 'inode-structure',
      type: 'structure',
      title: 'Inode Structure',
      description: 'Inodes represent file metadata in the filesystem. They contain permissions, timestamps, and block pointers.',
      relatedFiles: ['fs/inode.c', 'include/linux/fs.h'],
      kernelMindReference: 'Section 12.2: The Inode Object',
      priority: 'medium',
    },
  ],

  // Network suggestions
  'net/': [
    {
      id: 'network-stack',
      type: 'concept',
      title: 'Network Stack Architecture',
      description: 'The Linux network stack implements the OSI model with separate layers for physical, data link, network, and transport protocols.',
      relatedFiles: ['net/core/dev.c', 'net/ipv4/ip_input.c', 'net/socket.c'],
      kernelMindReference: 'Chapter 16: The Networking Subsystem',
      priority: 'medium',
    },
  ],

  // Driver suggestions
  'drivers/': [
    {
      id: 'device-model',
      type: 'concept',
      title: 'Linux Device Model',
      description: 'The device model provides a unified way to represent devices, drivers, and buses. It uses kobjects and sysfs for organization.',
      relatedFiles: ['drivers/base/core.c', 'drivers/base/bus.c'],
      kernelMindReference: 'Chapter 14: The Linux Device Model',
      priority: 'medium',
    },
  ],
};

// File-specific suggestions based on common patterns
const FILE_PATTERN_SUGGESTIONS: Array<{
  pattern: RegExp;
  suggestions: KernelSuggestion[];
}> = [
  {
    pattern: /kmalloc|kfree|vmalloc|vfree/,
    suggestions: [
      {
        id: 'memory-allocation-best-practices',
        type: 'concept',
        title: 'Memory Allocation Best Practices',
        description: 'Always check for NULL returns, use appropriate GFP flags, and match allocation/deallocation calls.',
        relatedFiles: ['mm/slab.c', 'include/linux/slab.h'],
        priority: 'high',
      },
    ],
  },
  {
    pattern: /spin_lock|mutex_lock|down|up/,
    suggestions: [
      {
        id: 'synchronization-primitives',
        type: 'concept',
        title: 'Kernel Synchronization',
        description: 'Choose the right synchronization primitive: spinlocks for short critical sections, mutexes for longer ones.',
        relatedFiles: ['kernel/locking/', 'include/linux/spinlock.h'],
        priority: 'high',
      },
    ],
  },
  {
    pattern: /copy_from_user|copy_to_user|get_user|put_user/,
    suggestions: [
      {
        id: 'user-kernel-data-transfer',
        type: 'security',
        title: 'User-Kernel Data Transfer',
        description: 'Always validate user pointers and handle potential faults when copying data between user and kernel space.',
        relatedFiles: ['arch/x86/lib/usercopy.c', 'include/linux/uaccess.h'],
        priority: 'high',
      },
    ],
  },
  {
    pattern: /EXPORT_SYMBOL|EXPORT_SYMBOL_GPL/,
    suggestions: [
      {
        id: 'symbol-exports',
        type: 'concept',
        title: 'Symbol Exports',
        description: 'EXPORT_SYMBOL makes functions available to loadable modules. Use GPL variant for GPL-only symbols.',
        relatedFiles: ['kernel/module.c', 'include/linux/export.h'],
        priority: 'medium',
      },
    ],
  },
];


/**
 * Get all suggestions for a file (combines path and content analysis)
 */
export function getAllSuggestionsForFile(filePath: string, content: string): KernelSuggestion[] {
  const suggestions: KernelSuggestion[] = [];
  
  // Add path-based suggestions
  for (const [pathPrefix, pathSuggestions] of Object.entries(KERNEL_SUGGESTIONS)) {
    if (filePath.startsWith(pathPrefix)) {
      suggestions.push(...pathSuggestions);
    }
  }
  
  // Add content-based suggestions
  for (const { pattern, suggestions: patternSuggestions } of FILE_PATTERN_SUGGESTIONS) {
    if (pattern.test(content)) {
      suggestions.push(...patternSuggestions);
    }
  }
  
  // Combine and deduplicate suggestions
  const uniqueSuggestions = suggestions.filter((suggestion, index, array) => 
    array.findIndex(s => s.id === suggestion.id) === index
  );
  
  // Sort by priority
  return uniqueSuggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Get fundamental kernel concepts for new users
 */
export function getFundamentalConcepts(): KernelSuggestion[] {
  return [
    {
      id: 'kernel-space-vs-user-space',
      type: 'concept',
      title: 'Kernel Space vs User Space',
      description: 'The kernel runs in privileged mode with access to all hardware, while user programs run in restricted mode.',
      relatedFiles: ['arch/x86/entry/', 'include/linux/uaccess.h'],
      kernelMindReference: 'Chapter 1: Introduction to the Kernel',
      priority: 'high',
    },
    {
      id: 'system-calls',
      type: 'concept',
      title: 'System Calls',
      description: 'System calls provide the interface between user space and kernel space. They switch from user mode to kernel mode.',
      relatedFiles: ['arch/x86/entry/syscalls/', 'kernel/sys.c'],
      kernelMindReference: 'Chapter 5: System Calls',
      priority: 'high',
    },
    {
      id: 'interrupt-handling',
      type: 'concept',
      title: 'Interrupt Handling',
      description: 'Interrupts allow hardware to signal the CPU. The kernel provides top-half and bottom-half processing.',
      relatedFiles: ['kernel/irq/', 'kernel/softirq.c'],
      kernelMindReference: 'Chapter 7: Interrupts and Interrupt Handlers',
      priority: 'high',
    },
    {
      id: 'kernel-modules',
      type: 'concept',
      title: 'Kernel Modules',
      description: 'Modules allow dynamic loading of kernel code. They use init and exit functions for lifecycle management.',
      relatedFiles: ['kernel/module.c', 'include/linux/module.h'],
      kernelMindReference: 'Chapter 2: Getting Started with the Kernel',
      priority: 'medium',
    },
  ];
} 