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
  // Security category
  {
    name: 'struct task_security_struct',
    category: 'Security',
    description: 'Security information for tasks',
    location: '/security/selinux/include/objsec.h',
    filePath: 'security/selinux/include/objsec.h',
    lineNumber: 19,
    introduction:
      'Contains security-related information for tasks, including security identifiers (SIDs) used by security modules like SELinux. Links process security attributes with access control decisions.',
    usage: ['SELinux security contexts', 'Access control decisions', 'Security policy enforcement'],
    examples: ['Process security labeling', 'SELinux enforcement', 'LSM security attributes'],
  },
  {
    name: 'struct inode_security_struct',
    category: 'Security',
    description: 'Security information for inodes',
    location: '/security/selinux/include/objsec.h',
    filePath: 'security/selinux/include/objsec.h',
    lineNumber: 28,
    introduction:
      'Stores security attributes for filesystem objects (inodes). Used by security modules to enforce file access policies and maintain security labels on files and directories.',
    usage: ['File security labeling', 'Access control enforcement', 'Security policy storage'],
    examples: ['SELinux file contexts', 'File access decisions', 'Security attribute persistence'],
  },
  {
    name: 'struct security_operations',
    category: 'Security',
    description: 'Security module operations structure',
    location: '/include/linux/security.h',
    filePath: 'include/linux/security.h',
    lineNumber: 200,
    introduction:
      'Defines function pointers for security operations, allowing different Linux Security Modules (LSM) to implement their specific access control mechanisms. Part of the LSM framework.',
    usage: ['LSM hook implementations', 'Security module registration', 'Access control callbacks'],
    examples: ['SELinux operations', 'AppArmor operations', 'Custom security modules'],
  },
  // SELinux category
  {
    name: 'struct selinux_state',
    category: 'SELinux',
    description: 'SELinux state structure',
    location: '/security/selinux/include/security.h',
    filePath: 'security/selinux/include/security.h',
    introduction:
      'Represents the current state of SELinux, including policy status, enforcement mode (enforcing/permissive/disabled), and policy version information.',
    usage: ['SELinux state management', 'Policy enforcement control', 'SELinux mode switching'],
    examples: ['Enforcing mode', 'Permissive mode', 'Policy reload'],
  },
  {
    name: 'struct selinux_policy',
    category: 'SELinux',
    description: 'SELinux policy structure',
    location: '/security/selinux/ss/policydb.h',
    filePath: 'security/selinux/ss/policydb.h',
    introduction:
      'Holds the active SELinux security policy rules and configurations. Contains type enforcement rules, role-based access control (RBAC) information, and MLS/MCS labels.',
    usage: ['Policy rule storage', 'Access vector cache', 'Policy decision making'],
    examples: ['Type enforcement rules', 'RBAC policies', 'MLS/MCS labels'],
  },
  {
    name: 'struct selinux_audit_rule',
    category: 'SELinux',
    description: 'SELinux audit rule structure',
    location: '/security/selinux/avc.h',
    filePath: 'security/selinux/avc.h',
    introduction:
      'Represents audit rules for SELinux access vector cache (AVC) decisions. Used to determine which security events should be audited.',
    usage: ['Audit rule configuration', 'AVC audit decisions', 'Security event logging'],
    examples: ['Access denial auditing', 'Policy violation logging'],
  },
  // Task category
  {
    name: 'struct task_struct',
    category: 'Task',
    description: 'Process descriptor - core structure for tasks/processes',
    location: '/include/linux/sched.h',
    filePath: 'include/linux/sched.h',
    lineNumber: 748,
    introduction:
      'The central data structure representing a process or thread in the Linux kernel. Contains all information needed to manage and schedule a task, including credentials, memory, files, and scheduling state.',
    usage: [
      'Process/thread management',
      'Scheduling',
      'Resource tracking',
      'Task state management',
    ],
    examples: ['Process control block', 'Thread descriptor', 'Scheduler entity'],
  },
  {
    name: 'struct task_group',
    category: 'Task',
    description: 'Task group structure for cgroup scheduling',
    location: '/include/linux/sched.h',
    filePath: 'include/linux/sched.h',
    lineNumber: 380,
    introduction:
      'Represents a task group in the control group (cgroup) hierarchy. Used for hierarchical scheduling and resource management, allowing groups of tasks to share CPU and other resources.',
    usage: ['Cgroup scheduling', 'Resource allocation', 'Task grouping'],
    examples: ['CFS group scheduling', 'Cgroup hierarchies', 'Resource limits'],
  },
  {
    name: 'struct sched_entity',
    category: 'Task',
    description: 'Scheduling entity structure',
    location: '/include/linux/sched.h',
    filePath: 'include/linux/sched.h',
    lineNumber: 447,
    introduction:
      'Represents a schedulable entity in the CFS (Completely Fair Scheduler). Contains scheduling statistics, virtual runtime, and load information used by the scheduler to make scheduling decisions.',
    usage: ['CFS scheduling', 'Load balancing', 'Fair scheduling calculations'],
    examples: ['Process scheduling', 'Thread scheduling', 'Group scheduling'],
  },
  // Task Credentials category
  {
    name: 'struct cred',
    category: 'Task Credentials',
    description: 'Task credentials structure',
    location: '/include/linux/cred.h',
    filePath: 'include/linux/cred.h',
    lineNumber: 118,
    introduction:
      'Represents the credentials of a task, including user IDs (UID/GID), group IDs, capabilities, and security context. Used for access control decisions throughout the kernel. Credentials are reference-counted and can be shared among tasks.',
    usage: [
      'Access control',
      'Permission checking',
      'Capability management',
      'User/group ID tracking',
    ],
    examples: ['UID/GID checks', 'Capability checks', 'Security context storage'],
  },
  {
    name: 'struct user_struct',
    category: 'Task Credentials',
    description: 'User accounting structure',
    location: '/include/linux/sched/user.h',
    filePath: 'include/linux/sched/user.h',
    introduction:
      'Tracks resource usage and accounting information for a user ID. Contains process count, file handle limits, and other per-user resource limits. Used for enforcing per-user resource constraints.',
    usage: ['User resource accounting', 'Process limit enforcement', 'File handle limits'],
    examples: ['RLIMIT_NPROC enforcement', 'User process counting', 'Resource limit tracking'],
  },
  {
    name: 'struct group_info',
    category: 'Task Credentials',
    description: 'Group information structure',
    location: '/include/linux/cred.h',
    filePath: 'include/linux/cred.h',
    introduction:
      'Stores supplementary group information for a task. Contains an array of group IDs that the task belongs to, used for group-based access control decisions.',
    usage: ['Group membership tracking', 'Access control', 'Permission checking'],
    examples: ['File group permissions', 'Supplementary groups', 'Group-based access'],
  },
  // MAC category
  {
    name: 'struct security_operations',
    category: 'MAC',
    description: 'Mandatory Access Control operations',
    location: '/include/linux/security.h',
    filePath: 'include/linux/security.h',
    introduction:
      'Defines the interface for Mandatory Access Control (MAC) implementations through the Linux Security Module (LSM) framework. Contains function pointers for security hooks that enforce access control policies.',
    usage: ['LSM framework', 'MAC policy enforcement', 'Security hook implementation'],
    examples: ['SELinux MAC', 'AppArmor MAC', 'SMACK MAC'],
  },
  {
    name: 'struct lsm_info',
    category: 'MAC',
    description: 'Linux Security Module information',
    location: '/include/linux/lsm_hooks.h',
    filePath: 'include/linux/lsm_hooks.h',
    introduction:
      'Contains metadata about a Linux Security Module (LSM), including its name, initialization function, and order. Used by the LSM framework to manage and initialize security modules.',
    usage: ['LSM registration', 'Module initialization', 'LSM ordering'],
    examples: ['SELinux module info', 'AppArmor module info', 'Custom LSM registration'],
  },
  {
    name: 'struct security_hook_list',
    category: 'MAC',
    description: 'Security hook list structure',
    location: '/include/linux/lsm_hooks.h',
    filePath: 'include/linux/lsm_hooks.h',
    introduction:
      'Represents a single security hook in the LSM framework. Contains the hook function pointer and metadata. Multiple hooks are chained together to allow multiple security modules to participate in access control decisions.',
    usage: ['Hook chaining', 'LSM hook registration', 'Security callback management'],
    examples: ['File access hooks', 'Process creation hooks', 'Network access hooks'],
  },
];

interface DataStructureItemProps {
  ds: DataStructure;
  onFileOpen?: (filePath: string, structName: string, lineNumber?: number) => void;
}

const DataStructureItem: React.FC<DataStructureItemProps> = ({ ds, onFileOpen }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleViewSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ds.filePath && onFileOpen) {
      onFileOpen(ds.filePath, ds.name, ds.lineNumber);
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
  onFileOpen?: (filePath: string, structName: string, lineNumber?: number) => void;
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
