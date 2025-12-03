/**
 * Kernel Study Markers - Based on "Kernel In The Mind" Guidelines
 * 
 * This module provides annotations and markers for interesting kernel sections,
 * data structures, and routines as outlined in the SPEC.md guidelines.
 */

export interface KernelMarker {
  id: string;
  startLine: number;
  endLine: number;
  type: 'data_structure' | 'routine' | 'concept' | 'critical_section' | 'lock' | 'context_switch' | 'syscall' | 'interrupt';
  title: string;
  description: string;
  kernelMindChapter?: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
}

export interface KernelAnnotation {
  line: number;
  type: 'note' | 'warning' | 'insight' | 'data_structure' | 'routine';
  text: string;
  icon: string;
  color: string;
}

/**
 * Key kernel data structures and concepts from "Kernel In The Mind"
 */
export const KERNEL_CONCEPTS = {
  // Core Data Structures
  TASK_STRUCT: {
    name: 'task_struct',
    description: 'The main process descriptor - represents running processes and threads',
    chapter: 'Chapter 4: Process Management',
    importance: 'critical' as const,
    tags: ['process', 'scheduling', 'state'],
  },
  INODE: {
    name: 'inode',
    description: 'Represents filesystem objects - files, directories, devices',
    chapter: 'Chapter 8: VFS and Filesystems',
    importance: 'high' as const,
    tags: ['filesystem', 'vfs', 'storage'],
  },
  MSG_QUEUE: {
    name: 'msg_queue',
    description: 'IPC message queue structure for inter-process communication',
    chapter: 'Chapter 7: Communication and Cooperation',
    importance: 'medium' as const,
    tags: ['ipc', 'communication'],
  },
  MM_STRUCT: {
    name: 'mm_struct',
    description: 'Memory descriptor for process virtual memory management',
    chapter: 'Chapter 3: Memory Management',
    importance: 'critical' as const,
    tags: ['memory', 'virtual_memory', 'process'],
  },
  VMA: {
    name: 'vm_area_struct',
    description: 'Virtual Memory Area - represents a contiguous virtual memory region',
    chapter: 'Chapter 3: Memory Management',
    importance: 'high' as const,
    tags: ['memory', 'virtual_memory', 'mapping'],
  },

  // Critical Routines
  START_KERNEL: {
    name: 'start_kernel',
    description: 'Main kernel initialization routine - bridges boot to running kernel',
    chapter: 'Chapter 4: Boot, Init, and Entry',
    importance: 'critical' as const,
    tags: ['boot', 'initialization', 'startup'],
  },
  SCHEDULE: {
    name: 'schedule',
    description: 'Core scheduler function - switches between tasks',
    chapter: 'Chapter 6: Execution and Contexts',
    importance: 'critical' as const,
    tags: ['scheduling', 'context_switch', 'cpu'],
  },
  CONTEXT_SWITCH: {
    name: 'context_switch',
    description: 'Low-level task switching - saves/restores CPU state',
    chapter: 'Chapter 6: Execution and Contexts',
    importance: 'critical' as const,
    tags: ['scheduling', 'context_switch', 'cpu'],
  },
  DO_IRQ: {
    name: 'do_IRQ',
    description: 'Hardware interrupt handler entry point',
    chapter: 'Chapter 6: Interrupts',
    importance: 'high' as const,
    tags: ['interrupt', 'hardware', 'irq'],
  },

  // Memory Management
  PAGE_FAULT: {
    name: 'do_page_fault',
    description: 'Page fault handler - manages virtual memory exceptions',
    chapter: 'Chapter 3: Memory Management',
    importance: 'high' as const,
    tags: ['memory', 'page_fault', 'exception'],
  },
  KMALLOC: {
    name: 'kmalloc',
    description: 'Kernel memory allocator - allocates kernel memory',
    chapter: 'Chapter 3: Memory Management',
    importance: 'high' as const,
    tags: ['memory', 'allocation', 'slab'],
  },

  // Synchronization
  SPINLOCK: {
    name: 'spinlock',
    description: 'Low-level synchronization primitive for SMP systems',
    chapter: 'Chapter 6: Synchronization',
    importance: 'high' as const,
    tags: ['synchronization', 'lock', 'smp'],
  },
  MUTEX: {
    name: 'mutex',
    description: 'Sleeping lock - can block waiting threads',
    chapter: 'Chapter 6: Synchronization',
    importance: 'high' as const,
    tags: ['synchronization', 'lock', 'sleep'],
  },
  RCU: {
    name: 'rcu',
    description: 'Read-Copy-Update - lock-free synchronization mechanism',
    chapter: 'Chapter 6: Synchronization Beyond Concurrency',
    importance: 'high' as const,
    tags: ['synchronization', 'lockfree', 'scalability'],
  },
};

/**
 * Analyze code content and generate kernel markers
 */
export function generateKernelMarkers(content: string): KernelMarker[] {
  const markers: KernelMarker[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Detect data structures
    Object.values(KERNEL_CONCEPTS).forEach(concept => {
      if (line.includes(concept.name)) {
        markers.push({
          id: `${concept.name}-${lineNum}`,
          startLine: lineNum,
          endLine: lineNum,
          type: getMarkerType(concept.name),
          title: concept.name,
          description: concept.description,
          kernelMindChapter: concept.chapter,
          importance: concept.importance,
          tags: concept.tags,
        });
      }
    });

    // Detect system calls
    if (line.match(/SYSCALL_DEFINE[0-9]\(/)) {
      const match = line.match(/SYSCALL_DEFINE[0-9]\(\s*(\w+)/);
      const syscallName = match ? match[1] : 'syscall';
      markers.push({
        id: `syscall-${syscallName}-${lineNum}`,
        startLine: lineNum,
        endLine: lineNum,
        type: 'syscall',
        title: `System Call: ${syscallName}`,
        description: 'System call definition - entry point from user space to kernel',
        kernelMindChapter: 'Chapter 5: Entering the Kernel',
        importance: 'high',
        tags: ['syscall', 'userspace', 'entry'],
      });
    }

    // Detect interrupt handlers
    if (line.match(/irqreturn_t\s+\w+.*_handler/) || line.includes('request_irq')) {
      markers.push({
        id: `irq-${lineNum}`,
        startLine: lineNum,
        endLine: lineNum,
        type: 'interrupt',
        title: 'Interrupt Handler',
        description: 'Hardware interrupt handler - asynchronous event processing',
        kernelMindChapter: 'Chapter 6: An Interrupt Is Not a Disruption. It\'s Design.',
        importance: 'high',
        tags: ['interrupt', 'hardware', 'async'],
      });
    }

    // Detect critical sections and locks
    if (line.includes('spin_lock') || line.includes('spin_unlock')) {
      markers.push({
        id: `spinlock-${lineNum}`,
        startLine: lineNum,
        endLine: lineNum,
        type: 'lock',
        title: 'Spinlock Operation',
        description: 'Atomic lock operation - critical section protection',
        kernelMindChapter: 'Chapter 6: Synchronization Beyond Concurrency',
        importance: 'medium',
        tags: ['synchronization', 'atomic', 'smp'],
      });
    }

    // Detect context switches
    if (line.includes('__switch_to') || line.includes('switch_to')) {
      markers.push({
        id: `context-switch-${lineNum}`,
        startLine: lineNum,
        endLine: lineNum,
        type: 'context_switch',
        title: 'Context Switch',
        description: 'CPU context switching - fundamental scheduling operation',
        kernelMindChapter: 'Chapter 6: Stateless CPU, Stateful Kernel',
        importance: 'critical',
        tags: ['scheduling', 'cpu', 'context'],
      });
    }
  });

  return markers;
}

/**
 * Generate line annotations for kernel code
 */
export function generateKernelAnnotations(content: string): KernelAnnotation[] {
  const annotations: KernelAnnotation[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Annotate key data structures
    if (line.includes('struct task_struct')) {
      annotations.push({
        line: lineNum,
        type: 'data_structure',
        text: 'Core process descriptor - represents every running task',
        icon: '📋',
        color: '#ff6b35',
      });
    }
    
    if (line.includes('struct mm_struct')) {
      annotations.push({
        line: lineNum,
        type: 'data_structure',
        text: 'Memory descriptor - virtual memory layout per process',
        icon: '🧠',
        color: '#4ecdc4',
      });
    }

    if (line.includes('struct inode')) {
      annotations.push({
        line: lineNum,
        type: 'data_structure',
        text: 'VFS inode - filesystem object representation',
        icon: '📁',
        color: '#45b7d1',
      });
    }

    // Annotate important routines
    if (line.includes('start_kernel')) {
      annotations.push({
        line: lineNum,
        type: 'routine',
        text: 'Kernel bootstrap - architecture-neutral initialization',
        icon: '🚀',
        color: '#96ceb4',
      });
    }

    if (line.includes('do_fork') || line.includes('copy_process')) {
      annotations.push({
        line: lineNum,
        type: 'routine',
        text: 'Process creation - duplicates parent task',
        icon: '🌱',
        color: '#ffeaa7',
      });
    }

    // Annotate critical concepts
    if (line.includes('current') && !line.includes('current_')) {
      annotations.push({
        line: lineNum,
        type: 'insight',
        text: 'Per-CPU current pointer - indirection for scalability',
        icon: '🎯',
        color: '#fd79a8',
      });
    }

    if (line.match(/\b(user|kernel)_space\b/)) {
      annotations.push({
        line: lineNum,
        type: 'note',
        text: 'Privilege boundary - isolation and protection',
        icon: '🛡️',
        color: '#6c5ce7',
      });
    }
  });

  return annotations;
}

/**
 * Get marker type based on concept name
 */
function getMarkerType(conceptName: string): KernelMarker['type'] {
  if (conceptName.includes('struct') || conceptName.includes('_struct')) {
    return 'data_structure';
  }
  if (conceptName.includes('lock') || conceptName.includes('mutex') || conceptName.includes('rcu')) {
    return 'lock';
  }
  if (conceptName.includes('schedule') || conceptName.includes('switch')) {
    return 'context_switch';
  }
  if (conceptName.includes('IRQ') || conceptName.includes('irq')) {
    return 'interrupt';
  }
  if (conceptName.includes('SYSCALL') || conceptName.includes('sys_')) {
    return 'syscall';
  }
  return 'routine';
}

/**
 * Get recommended files to study based on kernel concepts
 */
export const RECOMMENDED_STUDY_FILES = [
  {
    path: 'include/linux/sched.h',
    title: 'Process Scheduling Structures',
    description: 'task_struct and scheduling-related data structures',
    priority: 'critical',
    concepts: ['task_struct', 'scheduling', 'process'],
  },
  {
    path: 'kernel/sched/core.c',
    title: 'Core Scheduler Implementation',
    description: 'Main scheduling logic and context switching',
    priority: 'critical',
    concepts: ['schedule', 'context_switch', 'cpu'],
  },
  {
    path: 'include/linux/mm_types.h',
    title: 'Memory Management Types',
    description: 'mm_struct, vm_area_struct, and memory descriptors',
    priority: 'high',
    concepts: ['mm_struct', 'vma', 'memory'],
  },
  {
    path: 'kernel/fork.c',
    title: 'Process Creation',
    description: 'fork(), clone(), and process duplication logic',
    priority: 'high',
    concepts: ['fork', 'process', 'creation'],
  },
  {
    path: 'init/main.c',
    title: 'Kernel Initialization',
    description: 'start_kernel() and boot sequence',
    priority: 'critical',
    concepts: ['start_kernel', 'boot', 'init'],
  },
  {
    path: 'kernel/irq/handle.c',
    title: 'Interrupt Handling',
    description: 'IRQ handling and top-half processing',
    priority: 'high',
    concepts: ['interrupt', 'irq', 'handler'],
  },
  {
    path: 'include/linux/spinlock.h',
    title: 'Spinlock Implementation',
    description: 'Low-level synchronization primitives',
    priority: 'medium',
    concepts: ['spinlock', 'synchronization', 'smp'],
  },
  {
    path: 'arch/x86/entry/entry_64.S',
    title: 'System Call Entry (x86_64)',
    description: 'Assembly entry points for system calls',
    priority: 'high',
    concepts: ['syscall', 'entry', 'assembly'],
  },
  {
    path: 'fs/inode.c',
    title: 'VFS Inode Operations',
    description: 'Virtual filesystem inode management',
    priority: 'medium',
    concepts: ['inode', 'vfs', 'filesystem'],
  },
  {
    path: 'mm/page_alloc.c',
    title: 'Page Allocation',
    description: 'Physical memory allocation and management',
    priority: 'high',
    concepts: ['memory', 'allocation', 'pages'],
  },
];

/**
 * Color scheme for different marker types
 */
export const MARKER_COLORS = {
  data_structure: '#ff6b35',   // Orange-red
  routine: '#4ecdc4',          // Teal
  concept: '#45b7d1',          // Blue
  critical_section: '#96ceb4', // Green
  lock: '#ffeaa7',            // Yellow
  context_switch: '#fd79a8',   // Pink
  syscall: '#6c5ce7',         // Purple
  interrupt: '#e17055',       // Red-orange
};

/**
 * Icons for different marker types
 */
export const MARKER_ICONS = {
  data_structure: '📋',
  routine: '⚙️',
  concept: '💡',
  critical_section: '🔒',
  lock: '🔐',
  context_switch: '🔄',
  syscall: '🌉',
  interrupt: '⚡',
};
