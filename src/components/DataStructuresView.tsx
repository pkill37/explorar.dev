'use client';

import React, { useState } from 'react';

interface DataStructure {
  name: string;
  description: string;
  location: string;
  category: string;
  introduction?: string;
  usage?: string[];
  examples?: string[];
  filePath?: string; // Actual file path in the kernel
  lineNumber?: number; // Line number where struct is defined
}

const dataStructures: DataStructure[] = [
  {
    name: 'struct list_head',
    category: 'Lists',
    description: 'Standard implementation of a circular/doubly-linked list',
    location: '/include/linux/types.h',
    filePath: 'include/linux/types.h',
    lineNumber: 178,
    introduction:
      "Many times operating systems need to hold a list of data structures. In order reduce code duplication the Linux's kernel developers created a standard implementation of a circular/doubly-linked list. This implementation was included in kernel 2.1.45.",
    usage: [
      'LIST_HEAD - macro to initialize',
      'list_add - insert entry after head (stacks)',
      'list_add_tail - insert entry before head (queues)',
      'list_del - delete element from list',
    ],
    examples: ['Circular/doubly-linked lists', 'Process management', 'Device driver lists'],
  },
  {
    name: 'struct hlist_head',
    category: 'Hash Tables',
    description: 'Hash table head with single pointer list head',
    location: '/include/linux/types.h',
    filePath: 'include/linux/types.h',
    lineNumber: 188,
    introduction:
      "Used together with struct hlist_node as part of hash tables. Has only one data member 'first' which points to the first node of a double linked list.",
    usage: [
      'HLIST_HEAD - macro to create list head',
      'hlist_add_head - adds entry at beginning',
      'hlist_move_list - moves list to another head',
    ],
    examples: ['Hash table implementations', 'tun/tap device data flows', 'Open hash table'],
  },
  {
    name: 'struct hlist_node',
    category: 'Hash Tables',
    description: "Hash list node with 'next' and 'pprev' pointers",
    location: '/include/linux/types.h',
    filePath: 'include/linux/types.h',
    lineNumber: 192,
    introduction:
      "Used with struct hlist_head for hash tables. Has two fields: 'next' points to the next node, 'pprev' is a pointer to a pointer to the previous node.",
    usage: ['Used in conjunction with hlist_head', 'Part of hash table implementations'],
  },
  {
    name: 'struct llist_head',
    category: 'Lock-free Lists',
    description: 'Lock-free singly linked list head',
    location: '/include/linux/llist.h',
    filePath: 'include/linux/llist.h',
    lineNumber: 53,
    introduction:
      'Simple lock-free singly linked list implementation. Used for scenarios requiring lock-free operations.',
    usage: ['Lock-free operations', 'High-performance scenarios', 'Interrupt contexts'],
  },
  {
    name: 'struct llist_node',
    category: 'Lock-free Lists',
    description: 'Lock-free singly linked list node',
    location: '/include/linux/llist.h',
    filePath: 'include/linux/llist.h',
    lineNumber: 57,
    introduction: 'Node structure for lock-free singly linked lists.',
  },
  {
    name: 'struct freelist_head',
    category: 'Memory Management',
    description: 'Free list head for memory management',
    location: 'include/linux/types.h',
    filePath: 'include/linux/types.h',
    lineNumber: 200,
    introduction: 'Used for managing free memory blocks and object pools.',
  },
  {
    name: 'struct nsproxy',
    category: 'Namespaces',
    description: 'Namespace proxy structure',
    location: '/include/linux/nsproxy.h',
    filePath: 'include/linux/nsproxy.h',
    lineNumber: 31,
    introduction: 'Contains pointers to various namespace structures, enabling process isolation.',
    usage: ['Container isolation', 'Process namespaces', 'Network namespaces'],
  },
  {
    name: 'struct task_struct',
    category: 'Process Management',
    description: 'Process descriptor - core structure for tasks/processes',
    location: '/include/linux/sched.h',
    filePath: 'include/linux/sched.h',
    lineNumber: 748,
    introduction:
      'The central data structure representing a process or thread in the Linux kernel. Contains all information needed to manage and schedule a task.',
    usage: ['Process/thread management', 'Scheduling', 'Resource tracking'],
    examples: ['Process control block', 'Thread descriptor', 'Scheduler entity'],
  },
  {
    name: 'struct mm_struct',
    category: 'Memory Management',
    description: "Memory descriptor for a process's address space",
    location: '/include/linux/mm_types.h',
    filePath: 'include/linux/mm_types.h',
    lineNumber: 601,
    introduction:
      "Represents a process's address space (virtual memory areas). Contains page tables, memory mappings, and memory management information.",
    usage: ['Virtual memory management', 'Page table management', 'Memory mapping'],
  },
  {
    name: 'struct vm_area_struct',
    category: 'Memory Management',
    description: 'Virtual memory area descriptor',
    location: '/include/linux/mm_types.h',
    filePath: 'include/linux/mm_types.h',
    lineNumber: 490,
    introduction:
      "Represents a contiguous memory area in a process's address space. Used to track permissions, properties, and operations for each memory area.",
    usage: ['Memory region tracking', 'mmap operations', 'Shared libraries', 'Executable areas'],
    examples: ['View with /proc/[PID]/maps', 'Shared library mappings', 'File-backed mappings'],
  },
  {
    name: 'struct thread_info',
    category: 'Process Management',
    description: 'Low-level thread information structure',
    location: '/arch/x86/include/asm/thread_info.h',
    filePath: 'arch/x86/include/asm/thread_info.h',
    lineNumber: 56,
    introduction:
      'Common low-level thread information accessors. Contains flags like signal pending, address space info, CPU-specific data. Architecture-dependent structure.',
    usage: ['Thread flags', 'CPU-specific state', 'Low-level scheduling'],
  },
  {
    name: 'struct thread_struct',
    category: 'Process Management',
    description: 'CPU-specific state of a task',
    location: '/arch/x86/include/asm/processor.h',
    filePath: 'arch/x86/include/asm/processor.h',
    lineNumber: 473,
    introduction:
      'Holds CPU-specific state of a task including page fault information, register sets, and architecture-specific data. Must be at the end of task_struct on x86.',
    usage: ['CPU register state', 'Page fault handling', 'Context switching'],
  },
];

interface DataStructureItemProps {
  ds: DataStructure;
  onFileOpen?: (filePath: string, structName: string) => void;
}

const DataStructureItem: React.FC<DataStructureItemProps> = ({ ds, onFileOpen }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleViewSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ds.filePath && onFileOpen) {
      onFileOpen(ds.filePath, ds.name);
    }
  };

  return (
    <div className="data-structure-item">
      <div className="data-structure-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="icon">{isExpanded ? '▼' : '▶'}</span>
        <span className="struct-name">{ds.name}</span>
        {ds.filePath && (
          <button className="view-source-btn" onClick={handleViewSource} title="Open source file">
            📄
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="data-structure-details">
          <div className="ds-description">{ds.description}</div>
          <div className="ds-location">
            <strong>Location:</strong>
            {ds.filePath ? (
              <code
                className="clickable-path"
                onClick={handleViewSource}
                title="Click to open file"
              >
                {ds.location}
              </code>
            ) : (
              <code>{ds.location}</code>
            )}
          </div>
          {ds.introduction && (
            <div className="ds-intro">
              <strong>Overview:</strong>
              <p>{ds.introduction}</p>
            </div>
          )}
          {ds.usage && ds.usage.length > 0 && (
            <div className="ds-usage">
              <strong>Usage:</strong>
              <ul>
                {ds.usage.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {ds.examples && ds.examples.length > 0 && (
            <div className="ds-examples">
              <strong>Examples:</strong>
              <ul>
                {ds.examples.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface DataStructuresViewProps {
  onStructSelect?: (ds: DataStructure) => void;
  onFileOpen?: (filePath: string, structName: string) => void;
}

const DataStructuresView: React.FC<DataStructuresViewProps> = ({ onFileOpen }) => {
  const categories = Array.from(new Set(dataStructures.map((ds) => ds.category)));

  return (
    <div className="data-structures-view">
      {categories.map((category) => (
        <div key={category} className="ds-category">
          <div className="ds-category-header">{category}</div>
          {dataStructures
            .filter((ds) => ds.category === category)
            .map((ds) => (
              <DataStructureItem key={ds.name} ds={ds} onFileOpen={onFileOpen} />
            ))}
        </div>
      ))}
    </div>
  );
};

export default DataStructuresView;
export type { DataStructure };
