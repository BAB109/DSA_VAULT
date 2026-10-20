-- ==============================================================================
-- Migration: 006_cs_fundamentals.sql
-- Description: CS Fundamentals Learning Path – schema + full curriculum seed
-- Engine: PostgreSQL 14+
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING
-- ==============================================================================

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cs_modules (
    id   SERIAL PRIMARY KEY,
    seq  INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    CONSTRAINT uq_cs_modules_seq UNIQUE (seq)
);

CREATE TABLE IF NOT EXISTS cs_sections (
    id        SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES cs_modules(id) ON DELETE CASCADE,
    seq       INTEGER NOT NULL,
    title     TEXT NOT NULL,
    CONSTRAINT uq_cs_sections_module_seq UNIQUE (module_id, seq)
);

CREATE TABLE IF NOT EXISTS cs_topics (
    id          SERIAL PRIMARY KEY,
    module_id   INTEGER NOT NULL REFERENCES cs_modules(id) ON DELETE CASCADE,
    section_id  INTEGER NOT NULL REFERENCES cs_sections(id) ON DELETE CASCADE,
    global_seq  INTEGER NOT NULL,
    section_seq INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NULL,
    objectives  TEXT NULL,
    est_minutes INTEGER NULL,
    CONSTRAINT uq_cs_topics_global_seq UNIQUE (global_seq)
);

CREATE TABLE IF NOT EXISTS cs_topic_checklist_items (
    id       SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES cs_topics(id) ON DELETE CASCADE,
    seq      INTEGER NOT NULL,
    text     TEXT NOT NULL,
    CONSTRAINT uq_cs_checklist_topic_seq UNIQUE (topic_id, seq)
);

CREATE TABLE IF NOT EXISTS user_cs_progress (
    user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id     INTEGER NOT NULL REFERENCES cs_topics(id) ON DELETE CASCADE,
    completed    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ NULL,
    PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS user_cs_checklist_progress (
    user_id UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES cs_topic_checklist_items(id) ON DELETE CASCADE,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_cs_progress_user    ON user_cs_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_cs_checklist_user   ON user_cs_checklist_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_topics_global_seq     ON cs_topics (global_seq);

-- ==============================================================================
-- CURRICULUM SEED
-- Each INSERT uses ON CONFLICT DO NOTHING – safe on repeated migration runs.
-- VALUES columns in topic inserts:
--   (mod_section_seq, global_seq, section_seq, title, description, objectives, est_minutes)
-- ==============================================================================

-- ── Module 1: Programming Language Fundamentals ────────────────────────────────
INSERT INTO cs_modules (seq, title, description) VALUES
(1,'Programming Language Fundamentals','Core programming language concepts, syntax, and paradigms essential for software development.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id, seq, title)
SELECT m.id, s.seq, s.title FROM cs_modules m,
(VALUES (1,'Core Language Syntax & Semantics'),(2,'Memory Management & Pointers'),
        (3,'Concurrency & Asynchronous Programming'),(4,'Functional Programming Concepts'),
        (5,'Type Systems & Language Theory'),(6,'Python / Java / C++ Language Specifics')
) AS s(seq,title) WHERE m.seq=1
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1, 1,  1,'Variables, Data Types & Type Casting','Primitive and composite data types, casting rules, type coercion','Understand static vs dynamic typing, implicit/explicit casting, overflow/underflow',45),
  (1, 2,  2,'Control Flow: Conditionals & Loops','if/else, switch, for, while, do-while, break, continue','Master loop invariants, nested conditionals, and short-circuit evaluation',45),
  (1, 3,  3,'Functions, Scope & Closures','Function declarations, expressions, arrow functions, lexical scope, closures','Understand call stack, closures capturing variables, IIFE patterns',60),
  (1, 4,  4,'Arrays & Strings Fundamentals','Array indexing, slicing, string immutability, common operations','Manipulate arrays and strings efficiently, understand memory layout',45),
  (2, 5,  1,'Stack vs Heap Memory','Stack allocation, heap allocation, garbage collection, memory leaks','Differentiate stack and heap, understand GC roots and reachability',60),
  (2, 6,  2,'Pointers & References','Raw pointers (C/C++), reference semantics, null pointer exceptions','Safely use pointers, understand reference vs value semantics',60),
  (3, 7,  1,'Threads & Processes','Thread creation, process vs thread, context switching, thread pools','Create and manage threads, understand OS scheduling',60),
  (3, 8,  2,'Synchronization Primitives','Mutex, semaphore, monitors, condition variables, deadlocks','Apply synchronization to avoid race conditions and deadlocks',60),
  (3, 9,  3,'Async/Await & Promises','Event loop, callbacks, Promises, async/await, error handling','Write non-blocking code, chain promises, handle async errors',60),
  (4,10,  1,'Higher-Order Functions & Lambdas','map, filter, reduce, function composition, currying','Apply functional transformations, understand immutability',45),
  (4,11,  2,'Immutability & Pure Functions','Side effects, referential transparency, persistent data structures','Write pure functions, understand why immutability aids concurrency',45),
  (5,12,  1,'Static vs Dynamic Typing','Type inference, duck typing, structural vs nominal typing','Compare type systems, understand trade-offs',45),
  (5,13,  2,'Generics & Parametric Polymorphism','Generic classes/functions, type bounds, wildcards','Write reusable type-safe generic code',45),
  (6,14,  1,'Python: List Comprehensions & Generators','Comprehensions, generator expressions, yield, itertools','Write Pythonic code using comprehensions and lazy sequences',45),
  (6,15,  2,'Java: JVM, JIT & Garbage Collection','JVM internals, bytecode, JIT compilation, GC algorithms','Understand JVM lifecycle and tune GC for performance',60),
  (6,16,  3,'C++: RAII, Smart Pointers & Move Semantics','RAII pattern, unique_ptr, shared_ptr, move vs copy semantics','Manage resources safely using RAII and smart pointers',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=1 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 2: Data Structures and Algorithms ──────────────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(2,'Data Structures and Algorithms','Comprehensive coverage of fundamental and advanced data structures and algorithm design techniques.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'Arrays, Strings & Hashing'),(2,'Linked Lists, Stacks & Queues'),
        (3,'Trees & Graphs'),(4,'Heaps & Priority Queues'),
        (5,'Sorting & Searching'),(6,'Dynamic Programming'),
        (7,'Greedy Algorithms'),(8,'Advanced Data Structures')
) AS s(seq,title) WHERE m.seq=2
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,17,1,'Two Pointers & Sliding Window','Fixed/variable window patterns, two-pointer convergence','Solve subarray/substring problems in O(n)',60),
  (1,18,2,'Prefix Sum & Difference Arrays','Prefix sum construction, range queries, difference array updates','Answer range sum queries in O(1) after O(n) preprocessing',45),
  (1,19,3,'Hash Maps & Hash Sets','Hash functions, collision resolution, load factor, set operations','Use hashing to solve lookup and uniqueness problems efficiently',60),
  (2,20,1,'Singly & Doubly Linked Lists','Node structure, insertion, deletion, traversal, reversal','Implement list operations, detect and remove cycles',60),
  (2,21,2,'Stacks: Applications & Monotonic Stacks','LIFO semantics, next greater element, histogram problems','Apply stacks to expression evaluation and span problems',60),
  (2,22,3,'Queues & Deques','FIFO, BFS queues, sliding window maximum with deque','Use queues for BFS, deques for O(1) window max/min',45),
  (3,23,1,'Binary Trees: Traversals & Properties','Inorder, preorder, postorder, level-order, height, diameter','Implement all traversals iteratively and recursively',60),
  (3,24,2,'Binary Search Trees','Search, insert, delete, successor/predecessor, balanced BST','Maintain BST invariants, understand AVL and Red-Black trees',60),
  (3,25,3,'Graph Representation & BFS/DFS','Adjacency list/matrix, BFS shortest path, DFS topological sort','Choose the right graph representation and traversal strategy',75),
  (3,26,4,'Shortest Path Algorithms','Dijkstra, Bellman-Ford, Floyd-Warshall, A*','Apply appropriate shortest path algorithm based on constraints',90),
  (3,27,5,'Union-Find / Disjoint Set Union','Path compression, union by rank, cycle detection in undirected graphs','Implement efficient DSU for connectivity queries',60),
  (4,28,1,'Min/Max Heaps & Priority Queues','Heap invariant, heapify, heap sort, k-th largest','Use heaps for scheduling and order-statistics problems',60),
  (5,29,1,'Comparison Sorts: Merge, Quick, Heap','Divide and conquer sorting, partitioning, time/space complexity','Implement and analyze O(n log n) sorting algorithms',60),
  (5,30,2,'Non-Comparison Sorts: Counting, Radix, Bucket','Linear time sorting under constraints, stable sorting','Apply linear sorts when input range is bounded',45),
  (5,31,3,'Binary Search & Variants','Classic binary search, search on answer, rotated arrays','Apply binary search to monotonic functions and answer spaces',60),
  (6,32,1,'Memoization vs Tabulation','Top-down recursion with memo, bottom-up tabulation, space optimization','Convert recursive solutions to DP, optimize space to O(1) or O(n)',75),
  (6,33,2,'1D DP: Fibonacci, Climbing Stairs, House Robber','State definition, recurrence, base cases','Solve classic 1D DP problems from scratch',60),
  (6,34,3,'2D DP: Grids, LCS, Edit Distance','Grid traversal DP, sequence alignment, string DP','Formulate 2D DP state and transition for grid and string problems',75),
  (6,35,4,'Knapsack Variants','0/1 knapsack, unbounded knapsack, partition equal subset','Identify and solve knapsack-style optimization problems',75),
  (7,36,1,'Interval Scheduling & Greedy Proofs','Activity selection, interval merging, exchange argument','Prove greedy correctness using exchange argument',60),
  (7,37,2,'Huffman Coding & Optimal Substructure','Frequency-based encoding, priority queue usage','Implement Huffman coding, understand optimal substructure',60),
  (8,38,1,'Tries & Suffix Structures','Trie insert/search/delete, prefix matching, autocomplete','Build a trie for efficient prefix and string operations',60),
  (8,39,2,'Segment Trees & Binary Indexed Trees','Range query, point update, lazy propagation','Implement segment tree with lazy propagation for range updates',75)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=2 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 3: Object-Oriented Programming ─────────────────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(3,'Object-Oriented Programming','OOP principles, design patterns, and best practices for building maintainable software.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'OOP Pillars'),(2,'SOLID Principles'),(3,'Design Patterns'),(4,'UML & Modeling')
) AS s(seq,title) WHERE m.seq=3
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,40,1,'Classes, Objects, Encapsulation & Abstraction','Class design, access modifiers, abstract classes, interfaces','Design cohesive classes with clear boundaries',60),
  (1,41,2,'Inheritance & Polymorphism','Single/multiple inheritance, method overriding, dynamic dispatch','Apply inheritance and understand Liskov substitution',60),
  (2,42,1,'Single Responsibility & Open/Closed Principle','SRP motivation, OCP with extension points','Refactor classes to adhere to SRP and OCP',60),
  (2,43,2,'Liskov, Interface Segregation & Dependency Inversion','LSP contracts, ISP fat interfaces, DIP via abstractions','Apply all five SOLID principles in class design',60),
  (3,44,1,'Creational Patterns: Singleton, Factory, Builder','Pattern intent, UML, code example, pitfalls','Implement and choose appropriate creational patterns',75),
  (3,45,2,'Structural Patterns: Adapter, Decorator, Composite','Pattern intent, UML, wrapping objects','Apply structural patterns to extend functionality without modification',75),
  (3,46,3,'Behavioral Patterns: Observer, Strategy, Command','Event-driven design, strategy selection, command queue','Use behavioral patterns to decouple behavior from context',75),
  (4,47,1,'UML Class & Sequence Diagrams','Class relationships, sequence message flows','Read and draw UML class and sequence diagrams for design review',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=3 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 4: Database Management Systems and SQL ─────────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(4,'Database Management Systems and SQL','Relational database design, SQL mastery, transactions, indexing, and NoSQL fundamentals.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'Relational Model & SQL Foundations'),(2,'Advanced SQL'),
        (3,'Database Design & Normalization'),(4,'Transactions & Concurrency'),
        (5,'Indexing & Query Optimization'),(6,'NoSQL Fundamentals')
) AS s(seq,title) WHERE m.seq=4
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,48,1,'SQL CRUD: SELECT, INSERT, UPDATE, DELETE','DML operations, WHERE clauses, ORDER BY, LIMIT','Write correct and efficient DML statements',45),
  (1,49,2,'Joins: INNER, LEFT, RIGHT, FULL, CROSS, SELF','Join semantics, Cartesian products, multi-table joins','Write complex multi-table JOIN queries correctly',60),
  (2,50,1,'Aggregations, GROUP BY & HAVING','COUNT, SUM, AVG, MAX, MIN, GROUP BY, HAVING','Aggregate data correctly with grouping and filtering',45),
  (2,51,2,'Window Functions & CTEs','ROW_NUMBER, RANK, LAG/LEAD, PARTITION BY, WITH clause','Use window functions for running totals and rankings',60),
  (2,52,3,'Subqueries & Correlated Subqueries','Scalar subqueries, IN/EXISTS, correlated queries','Rewrite subqueries using joins and vice versa',60),
  (3,53,1,'Entity-Relationship Modeling','ER diagrams, entity types, relationships, cardinality','Design ER diagrams for a given problem domain',60),
  (3,54,2,'Normalization: 1NF, 2NF, 3NF, BCNF','Functional dependencies, normal form violations, decomposition','Normalize a schema to BCNF without anomalies',75),
  (4,55,1,'ACID Properties & Transaction Isolation Levels','Atomicity, Consistency, Isolation, Durability, isolation levels','Choose the appropriate isolation level for a given use case',60),
  (4,56,2,'Concurrency Problems & Locking','Dirty reads, phantom reads, deadlocks, pessimistic/optimistic locking','Identify and mitigate concurrency anomalies',60),
  (5,57,1,'B-Tree & Hash Indexes','B-tree structure, hash index, clustered vs non-clustered','Choose the right index type for a query workload',60),
  (5,58,2,'Query Execution Plans & Optimization','EXPLAIN/ANALYZE, query planner, index hints, covering indexes','Read query plans and rewrite slow queries',60),
  (6,59,1,'NoSQL Types: Document, Key-Value, Column, Graph','MongoDB, Redis, Cassandra, Neo4j use cases','Select the appropriate NoSQL database for a given workload',60),
  (6,60,2,'CAP Theorem & Eventual Consistency','Consistency vs availability trade-off, BASE vs ACID','Reason about distributed data consistency guarantees',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=4 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 5: Operating Systems ───────────────────────────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(5,'Operating Systems','Process management, memory, file systems, and OS fundamentals for systems-level understanding.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'Processes & Threads'),(2,'Memory Management'),
        (3,'File Systems & I/O'),(4,'Scheduling'),
        (5,'Synchronization & Deadlocks'),(6,'Virtualization & Containers')
) AS s(seq,title) WHERE m.seq=5
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,61,1,'Process Lifecycle & PCB','Process states, PCB fields, fork/exec model','Trace the lifecycle of a process from creation to termination',60),
  (1,62,2,'Multithreading & Thread Models','User-level vs kernel-level threads, POSIX pthreads','Create and manage threads, understand threading models',60),
  (1,63,3,'Inter-Process Communication','Pipes, message queues, shared memory, sockets','Choose the right IPC mechanism for a given scenario',60),
  (2,64,1,'Virtual Memory & Paging','Address translation, TLB, page tables, page faults','Explain the virtual memory mechanism end-to-end',75),
  (2,65,2,'Segmentation & Memory Allocation','Segmentation, buddy system, slab allocator, fragmentation','Compare paging and segmentation, understand allocator strategies',60),
  (2,66,3,'Page Replacement Algorithms','FIFO, LRU, Clock (second chance), optimal, Belady''s anomaly','Simulate and compare page replacement policies',60),
  (3,67,1,'File System Structure & VFS','Inodes, directory entries, VFS layer, ext4 overview','Explain how the OS maps file names to disk blocks',60),
  (3,68,2,'Disk Scheduling Algorithms','FCFS, SSTF, SCAN, C-SCAN, LOOK','Compare disk scheduling algorithms for throughput and latency',45),
  (4,69,1,'CPU Scheduling Algorithms','FCFS, SJF, Round Robin, Priority, Multilevel Feedback Queue','Calculate turnaround, waiting, and response time for each policy',75),
  (5,70,1,'Critical Section Problem & Mutex','Race conditions, mutual exclusion, busy waiting, spinlock','Solve critical section problems with correct synchronization',60),
  (5,71,2,'Deadlock: Detection, Prevention & Recovery','Necessary conditions, resource allocation graph, banker''s algorithm','Apply deadlock prevention and detection strategies',60),
  (6,72,1,'Hypervisors & Virtual Machines','Type 1 vs Type 2 hypervisors, hardware virtualization, para-virtualization','Explain how VMs provide isolation with near-native performance',60),
  (6,73,2,'Containers & Namespaces','Linux namespaces, cgroups, Docker internals, container vs VM','Explain container isolation mechanisms and compare with VMs',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=5 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 6: Computer Networks ───────────────────────────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(6,'Computer Networks','Network protocols, architecture, and communication fundamentals for modern distributed applications.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'OSI & TCP/IP Model'),(2,'Transport Layer'),
        (3,'Application Layer Protocols'),(4,'Network Layer & Routing'),
        (5,'Security in Networks')
) AS s(seq,title) WHERE m.seq=6
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,74,1,'OSI 7-Layer Model','Layer functions, PDUs, encapsulation/decapsulation','Map real protocols to OSI layers',45),
  (1,75,2,'TCP/IP Stack & Internet Architecture','IP addressing, subnetting, CIDR, TCP/IP layers','Subnet an IP range and explain packet flow end-to-end',60),
  (2,76,1,'TCP: Connection Management & Reliability','3-way handshake, 4-way close, sequence numbers, ACK, retransmission','Trace TCP connection setup and teardown',75),
  (2,77,2,'TCP Congestion & Flow Control','Slow start, congestion avoidance, AIMD, receiver window','Explain how TCP prevents network congestion',60),
  (2,78,3,'UDP & Use Cases','Stateless delivery, DNS, gaming, streaming','Choose TCP vs UDP based on reliability vs latency requirements',45),
  (3,79,1,'HTTP/1.1, HTTP/2 & HTTP/3','Request/response model, headers, status codes, pipelining, QUIC','Explain HTTP improvements across versions',60),
  (3,80,2,'DNS: Resolution & Record Types','Recursive vs iterative resolution, A, AAAA, CNAME, MX, TXT','Trace a DNS lookup from browser to authoritative server',60),
  (3,81,3,'WebSockets & Server-Sent Events','Full-duplex communication, upgrade handshake, SSE polling alternative','Choose between WebSocket and SSE for real-time features',45),
  (4,82,1,'IP Routing & BGP Basics','Routing tables, longest prefix match, BGP AS path','Explain how packets are routed across the internet',60),
  (4,83,2,'NAT, Firewalls & Load Balancers','SNAT, DNAT, stateful firewall, L4/L7 load balancing','Design a network topology with NAT and firewall rules',60),
  (5,84,1,'TLS/SSL & PKI','TLS handshake, certificates, CA chain, forward secrecy','Explain TLS and how certificate chains establish trust',60),
  (5,85,2,'Common Network Attacks & Mitigations','DDoS, MITM, DNS spoofing, ARP poisoning','Identify attack vectors and apply appropriate countermeasures',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=6 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 7: Software Engineering and Developer Tools ────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(7,'Software Engineering and Developer Tools','Software development lifecycle, version control, testing, CI/CD, and professional tooling.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'Software Development Lifecycle'),(2,'Version Control with Git'),
        (3,'Testing Strategies'),(4,'CI/CD & DevOps Basics'),
        (5,'Code Quality & Documentation')
) AS s(seq,title) WHERE m.seq=7
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,86,1,'Agile, Scrum & Kanban','Sprint ceremonies, backlog grooming, WIP limits, velocity','Participate in an Agile team and understand sprint planning',60),
  (1,87,2,'Requirements Engineering & System Design Process','Functional vs non-functional requirements, RFC documents','Write clear functional requirements and design documents',60),
  (2,88,1,'Git Internals: Objects, Refs & DAG','Blobs, trees, commits, branches, HEAD, DAG structure','Explain what git commit actually stores',60),
  (2,89,2,'Branching Strategies & Merge Conflicts','GitFlow, trunk-based, feature flags, rebase vs merge','Apply a branching strategy and resolve merge conflicts',60),
  (3,90,1,'Unit Testing & Test-Driven Development','Arrange-Act-Assert, mocking, TDD red-green-refactor cycle','Write effective unit tests and practice TDD',60),
  (3,91,2,'Integration, E2E & Contract Testing','Integration test scope, Playwright/Cypress, consumer-driven contracts','Design a testing pyramid with appropriate test types',60),
  (4,92,1,'CI/CD Pipelines: Build, Test, Deploy','GitHub Actions / GitLab CI, pipeline stages, artifact management','Set up a basic CI/CD pipeline from scratch',75),
  (4,93,2,'Infrastructure as Code & GitOps','Terraform basics, Helm charts, GitOps workflow with ArgoCD','Manage infrastructure using declarative configuration',60),
  (5,94,1,'Code Reviews & Static Analysis','Review guidelines, linters, SAST tools, technical debt','Conduct productive code reviews and integrate static analysis',45),
  (5,95,2,'Documentation: README, ADRs & API Docs','Good README structure, Architecture Decision Records, OpenAPI','Write documentation that reduces onboarding time',45)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=7 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 8: Backend Development and API Engineering ─────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(8,'Backend Development and API Engineering','Server-side development, REST and GraphQL APIs, authentication, caching, and messaging.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'REST API Design'),(2,'GraphQL & gRPC'),
        (3,'Authentication & Authorization'),(4,'Caching Strategies'),
        (5,'Message Queues & Event-Driven Architecture'),(6,'Backend Performance & Scalability')
) AS s(seq,title) WHERE m.seq=8
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1, 96,1,'REST Principles & HTTP Semantics','Statelessness, uniform interface, resource naming, status codes','Design a RESTful API that follows HTTP semantics',60),
  (1, 97,2,'API Versioning & Pagination','URI vs header versioning, cursor vs offset pagination','Version an API without breaking existing clients',45),
  (1, 98,3,'OpenAPI / Swagger Specification','Schema-first design, generating stubs, validation','Write an OpenAPI spec and generate server stubs',60),
  (2, 99,1,'GraphQL: Schema, Resolvers & N+1 Problem','SDL schema, resolver chain, DataLoader pattern','Design a GraphQL schema and solve the N+1 problem with DataLoader',75),
  (2,100,2,'gRPC: Protobuf & Streaming','Protobuf encoding, unary vs server/client/bidirectional streaming','Implement a gRPC service with protocol buffer definitions',75),
  (3,101,1,'JWT, OAuth2 & OpenID Connect','Token structure, access/refresh tokens, authorization code flow','Implement secure JWT authentication with refresh token rotation',75),
  (3,102,2,'Session Management & CSRF Protection','Cookie-based sessions, SameSite, CSRF tokens, double-submit','Secure a session-based authentication system',60),
  (4,103,1,'In-Process, Distributed & CDN Caching','L1/L2 cache, Redis, CDN edge caching, cache-aside pattern','Choose and implement the right caching strategy',60),
  (4,104,2,'Cache Invalidation Strategies','TTL, write-through, write-behind, event-driven invalidation','Design a cache invalidation strategy that avoids stale data',60),
  (5,105,1,'Message Brokers: Kafka & RabbitMQ','Topics, partitions, consumer groups, AMQP exchanges','Model an event-driven flow using a message broker',75),
  (5,106,2,'Event Sourcing & CQRS','Event log as source of truth, read models, projections','Implement a simple CQRS system with event sourcing',75),
  (6,107,1,'Database Connection Pooling & Backpressure','Pool sizing, queue depth, circuit breaker pattern','Configure connection pooling and implement backpressure',60),
  (6,108,2,'Rate Limiting & Throttling','Token bucket, leaky bucket, sliding window counter','Implement rate limiting at the API gateway level',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=8 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 9: Low-Level Design ────────────────────────────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(9,'Low-Level Design','Class-level system design, design patterns applied to real interview problems, and practical OOP.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'LLD Fundamentals & Process'),(2,'Common LLD Problems'),(3,'Concurrency in LLD')
) AS s(seq,title) WHERE m.seq=9
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,109,1,'LLD Process: Requirements to Class Diagram','Identifying actors, entities, relationships, responsibilities','Convert a problem statement into a class diagram in 10 minutes',60),
  (1,110,2,'Design a Parking Lot','Entities: Lot, Floor, Spot, Vehicle, Ticket; strategies for pricing','Implement full parking lot system with multiple vehicle types',90),
  (2,111,1,'Design a Library Management System','Books, members, loans, reservations, fine calculation','Model library domain with correct relationships and behaviors',90),
  (2,112,2,'Design an ATM Machine','Card, account, transaction, dispenser, state machine','Implement ATM with state machine pattern',90),
  (2,113,3,'Design a Chess Game','Board, pieces, moves, check/checkmate validation, game state','Design a chess engine class hierarchy',90),
  (2,114,4,'Design a Hotel Booking System','Rooms, reservations, availability, pricing, cancellation policy','Build a hotel booking domain model',90),
  (2,115,5,'Design an Elevator System','Elevator, controller, request scheduling algorithms','Implement multi-elevator scheduling with different strategies',90),
  (3,116,1,'Thread-Safe Singleton & Object Pools','Double-checked locking, volatile, object pool pattern','Implement thread-safe patterns correctly in Java/Python',60),
  (3,117,2,'Producer-Consumer with Bounded Buffer','BlockingQueue, wait/notify, semaphore-based implementation','Implement producer-consumer without race conditions',75)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=9 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 10: High-Level Design and Distributed Systems ──────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(10,'High-Level Design and Distributed Systems','System design at scale: distributed architectures, consistency, reliability, and real-world system design interviews.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'HLD Fundamentals'),(2,'Scalability Patterns'),
        (3,'Distributed System Concepts'),(4,'Classic HLD Problems')
) AS s(seq,title) WHERE m.seq=10
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,118,1,'HLD Interview Framework & Back-of-Envelope Math','Capacity estimation, QPS, storage, bandwidth calculations','Perform quick capacity estimates for any system',60),
  (1,119,2,'Microservices vs Monolith','Service decomposition, inter-service communication, service mesh','Decide when to decompose a monolith into microservices',60),
  (2,120,1,'Horizontal Scaling & Load Balancing','Stateless services, L4/L7 load balancers, sticky sessions','Design a horizontally scalable service layer',60),
  (2,121,2,'Database Sharding & Replication','Hash sharding, range sharding, read replicas, replication lag','Design a database tier that handles 10x traffic growth',75),
  (2,122,3,'Consistent Hashing & Virtual Nodes','Ring topology, virtual nodes, hotspot mitigation','Apply consistent hashing to minimize data movement on scale changes',60),
  (3,123,1,'Distributed Consensus: Raft & Paxos','Leader election, log replication, quorum, split-brain prevention','Explain the Raft consensus algorithm step-by-step',75),
  (3,124,2,'Distributed Caching: Redis & Memcached','Cache topology, replication, clustering, eviction policies','Design a distributed cache layer for a high-traffic API',60),
  (3,125,3,'Observability: Logging, Metrics & Tracing','Structured logging, Prometheus metrics, distributed tracing, OpenTelemetry','Instrument a service for production observability',60),
  (4,126,1,'Design URL Shortener','Hashing, redirect, analytics, high availability','Design URL shortener handling 100M URLs with <10ms redirect',90),
  (4,127,2,'Design a Social Media Feed','Fan-out on write vs read, timeline aggregation, activity pub','Design a scalable social feed with personalization',90),
  (4,128,3,'Design a Distributed Key-Value Store','Consistent hashing, replication, read/write quorum, gossip protocol','Design a fault-tolerant distributed KV store',90),
  (4,129,4,'Design a Video Streaming Platform','CDN, adaptive bitrate streaming, video encoding pipeline','Design a YouTube-scale video streaming system',90),
  (4,130,5,'Design a Ride-Sharing Service','Matching algorithm, real-time location, surge pricing','Design a ride-sharing backend with driver-rider matching',90)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=10 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 11: Security, Deployment and Cloud Fundamentals ────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(11,'Security, Deployment and Cloud Fundamentals','Application security, cloud platforms, containerization, and production deployment practices.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'Application Security'),(2,'Cloud Platforms & Services'),
        (3,'Containerization & Orchestration'),(4,'Deployment Patterns')
) AS s(seq,title) WHERE m.seq=11
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,131,1,'OWASP Top 10 Vulnerabilities','Injection, XSS, IDOR, SSRF, broken auth, security misconfiguration','Identify and mitigate all OWASP Top 10 vulnerabilities',75),
  (1,132,2,'Cryptography Fundamentals','Symmetric/asymmetric encryption, hashing, digital signatures, PKI','Apply the right cryptographic primitive for each security need',60),
  (1,133,3,'Secrets Management & Secure Configuration','Vault, KMS, environment variable security, secret rotation','Set up secrets management for a production service',60),
  (2,134,1,'AWS Core Services: EC2, S3, RDS, Lambda','Compute, storage, database, serverless use cases','Select the appropriate AWS service for a given workload',60),
  (2,135,2,'Cloud Networking: VPC, Subnets & Security Groups','Public/private subnets, route tables, NACLs, SGs','Design a secure VPC architecture',60),
  (3,136,1,'Docker: Images, Containers & Registries','Dockerfile best practices, image layers, container runtime','Write an optimized multi-stage Dockerfile',60),
  (3,137,2,'Kubernetes: Pods, Services & Deployments','Pod lifecycle, Services, Deployments, ReplicaSets, ConfigMaps','Deploy a multi-tier application to Kubernetes',75),
  (4,138,1,'Blue-Green & Canary Deployments','Zero-downtime deploys, traffic splitting, rollback strategies','Design a deployment pipeline with gradual traffic shifting',60),
  (4,139,2,'SLIs, SLOs & Error Budgets','SLI definition, SLO targets, error budget policy, toil reduction','Define SLOs for a service and use error budgets for reliability',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=11 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 12: AI/ML and AI Engineering ───────────────────────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(12,'AI/ML and AI Engineering','Machine learning fundamentals, deep learning, NLP, and building production AI systems.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'ML Fundamentals'),(2,'Deep Learning & Neural Networks'),
        (3,'NLP & Large Language Models'),(4,'AI Engineering & MLOps')
) AS s(seq,title) WHERE m.seq=12
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,140,1,'Supervised, Unsupervised & Reinforcement Learning','Classification, regression, clustering, RL reward signals','Identify the appropriate ML paradigm for a problem',60),
  (1,141,2,'Linear & Logistic Regression, Decision Trees','Model equations, gradient descent, information gain, pruning','Implement and train linear models and decision trees',75),
  (1,142,3,'Model Evaluation: Metrics, Overfitting & Regularization','Accuracy, precision, recall, F1, AUC-ROC, L1/L2 regularization','Diagnose and fix overfitting using regularization and validation',60),
  (2,143,1,'Neural Networks: Backpropagation & Activations','Forward/backward pass, chain rule, ReLU, sigmoid, batch norm','Implement backpropagation from scratch',90),
  (2,144,2,'CNNs & RNNs','Convolution, pooling, LSTM, vanishing gradient','Apply CNN for image tasks and LSTM for sequential data',75),
  (2,145,3,'Transformer Architecture & Attention','Self-attention, multi-head attention, positional encoding, BERT/GPT','Explain transformer architecture and attention mechanisms',90),
  (3,146,1,'Tokenization, Embeddings & Vector Databases','BPE, word2vec, sentence transformers, cosine similarity, FAISS','Build a semantic search pipeline using embeddings',75),
  (3,147,2,'Prompt Engineering & RAG','Zero/few-shot prompting, chain-of-thought, retrieval-augmented generation','Design a RAG pipeline for document Q&A',75),
  (4,148,1,'ML Pipelines & Feature Stores','Data ingestion, feature engineering, training pipelines, Feast','Design an end-to-end ML training pipeline',60),
  (4,149,2,'Model Serving, Monitoring & Drift Detection','Online inference, batch inference, data drift, model performance decay','Monitor a production model and detect distribution shift',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=12 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 13: Computer Architecture and Compiler Fundamentals ────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(13,'Computer Architecture and Compiler Fundamentals','Hardware architecture, instruction sets, memory hierarchy, and compiler design basics.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'Computer Architecture'),(2,'Memory Hierarchy'),
        (3,'Compiler Basics'),(4,'Number Systems & Boolean Algebra')
) AS s(seq,title) WHERE m.seq=13
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,150,1,'Von Neumann Architecture & ISA','CPU components, fetch-decode-execute cycle, RISC vs CISC','Trace a program''s execution through the CPU pipeline',60),
  (1,151,2,'CPU Pipelining & Hazards','Pipeline stages, data/control/structural hazards, forwarding, branch prediction','Identify and resolve hazards in a 5-stage pipeline',60),
  (2,152,1,'Cache Hierarchy: L1/L2/L3 & Cache Coherence','Cache lines, associativity, write policies, MESI protocol','Calculate cache hit rate and reason about coherence protocols',60),
  (2,153,2,'DRAM, Virtual Memory & TLB','DRAM refresh, page table walk, TLB miss handling','Trace a virtual-to-physical address translation',60),
  (3,154,1,'Lexing, Parsing & AST Generation','Lexer tokens, grammar rules, recursive descent parsing, AST nodes','Implement a simple lexer and recursive descent parser',75),
  (3,155,2,'Semantic Analysis & Intermediate Representation','Symbol tables, type checking, three-address code, SSA form','Generate IR from a simple AST',60),
  (4,156,1,'Binary, Hex & Two''s Complement Arithmetic','Number base conversions, overflow, signed/unsigned arithmetic','Perform arithmetic in binary and detect overflow',45),
  (4,157,2,'Boolean Algebra & Logic Gates','Boolean laws, logic gate circuits, Karnaugh maps, combinational circuits','Simplify Boolean expressions using K-maps',60)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=13 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Module 14: Interview Preparation and Project Defense ──────────────────────
INSERT INTO cs_modules (seq,title,description) VALUES
(14,'Interview Preparation and Project Defense','Structured preparation for technical interviews, behavioral questions, and project presentation skills.')
ON CONFLICT (seq) DO NOTHING;

INSERT INTO cs_sections (module_id,seq,title)
SELECT m.id,s.seq,s.title FROM cs_modules m,
(VALUES (1,'Technical Interview Skills'),(2,'Behavioral Interview Mastery'),
        (3,'Project Defense & Presentation'),(4,'Offer Evaluation & Negotiation')
) AS s(seq,title) WHERE m.seq=14
ON CONFLICT (module_id,seq) DO NOTHING;

INSERT INTO cs_topics (module_id,section_id,global_seq,section_seq,title,description,objectives,est_minutes)
SELECT m.id,sec.id,t.gs,t.ss,t.title,t.descr,t.obj,t.mins
FROM cs_modules m JOIN cs_sections sec ON sec.module_id=m.id
JOIN (VALUES
  (1,158,1,'Coding Interview Strategy & Time Management','Clarify → plan → code → test cycle, managing 45 minutes','Complete a medium LeetCode problem in 35 minutes with explanation',60),
  (1,159,2,'Problem Patterns & Recognition','Two pointers, sliding window, BFS/DFS, DP pattern signals','Recognize the right pattern within 5 minutes of reading a problem',60),
  (1,160,3,'Complexity Analysis & Code Communication','Big-O time and space, explaining trade-offs clearly','Analyze and communicate complexity during a live coding interview',45),
  (2,161,1,'STAR Method for Behavioral Questions','Situation, Task, Action, Result framework, story banking','Prepare 5 strong behavioral stories covering common competencies',60),
  (2,162,2,'Common Behavioral Topics & Anti-Patterns','Leadership, conflict, failure, ambiguity, impact questions','Answer behavioral questions without common pitfalls',60),
  (3,163,1,'Presenting Your Projects: Structure & Clarity','Problem → solution → impact → challenges structure','Present any project in 5 minutes with clear technical depth',45),
  (3,164,2,'Handling Deep Technical Questions on Your Project','Anticipating architecture questions, tradeoffs, alternative designs','Defend design decisions under pressure with confidence',60),
  (4,165,1,'Evaluating Job Offers: Comp, Equity & Culture','TC calculation, vesting schedules, culture fit evaluation','Compare two offers using a structured framework',45),
  (4,166,2,'Salary Negotiation Tactics','Anchoring, competing offers, negotiating non-salary benefits','Negotiate a higher offer without risking rescission',45)
) AS t(ms,gs,ss,title,descr,obj,mins)
WHERE m.seq=14 AND sec.seq=t.ms
ON CONFLICT (global_seq) DO NOTHING;

-- ── Checklist Items ───────────────────────────────────────────────────────────
-- Inserted by joining on global_seq to resolve topic IDs safely.

INSERT INTO cs_topic_checklist_items (topic_id, seq, text)
SELECT t.id, c.seq, c.text
FROM cs_topics t
JOIN (VALUES
  -- Topic global_seq=1 : Variables, Data Types & Type Casting
  (1,1,'Identify primitive types in at least two languages (e.g., Java and Python)'),
  (1,2,'Demonstrate implicit and explicit type casting with examples'),
  (1,3,'Explain integer overflow and how to prevent it'),
  -- Topic 2: Control Flow
  (2,1,'Implement a loop with break/continue and explain behavior'),
  (2,2,'Explain short-circuit evaluation in && and || operators'),
  (2,3,'Identify the difference between do-while and while loops'),
  -- Topic 3: Functions, Scope & Closures
  (3,1,'Write a closure that captures an outer variable'),
  (3,2,'Explain the call stack with a recursive function example'),
  (3,3,'Differentiate between function declaration and expression'),
  -- Topic 4: Arrays & Strings
  (4,1,'Reverse a string in-place and explain why strings may be immutable'),
  (4,2,'Write a sliding-window over an array without extra allocation'),
  (4,3,'Implement binary search on a sorted array'),
  -- Topic 5: Stack vs Heap Memory
  (5,1,'Draw a memory diagram for a simple recursive function call'),
  (5,2,'Explain why stack overflow occurs'),
  (5,3,'Describe what garbage collection roots are'),
  -- Topic 6: Pointers & References
  (6,1,'Implement a swap function using pointers in C'),
  (6,2,'Explain the difference between pass-by-value and pass-by-reference'),
  (6,3,'Identify a dangling pointer scenario and its fix'),
  -- Topic 7: Threads & Processes
  (7,1,'List the differences between a process and a thread'),
  (7,2,'Implement a simple thread using language primitives'),
  (7,3,'Explain context switching overhead'),
  -- Topic 8: Synchronization Primitives
  (8,1,'Implement a mutex-protected counter'),
  (8,2,'Demonstrate the four necessary conditions for deadlock'),
  (8,3,'Explain the difference between mutex and semaphore'),
  -- Topic 9: Async/Await & Promises
  (9,1,'Convert callback-based code to Promise-based'),
  (9,2,'Handle errors in an async/await function correctly'),
  (9,3,'Explain the JavaScript event loop with a diagram'),
  -- Topic 10: Higher-Order Functions
  (10,1,'Implement map, filter, and reduce from scratch'),
  (10,2,'Write a curried add function'),
  (10,3,'Use function composition to build a data pipeline'),
  -- Topic 11: Immutability & Pure Functions
  (11,1,'Identify side effects in a given function'),
  (11,2,'Rewrite an impure function as a pure function'),
  (11,3,'Explain how immutability enables safe parallelism'),
  -- Topic 12: Static vs Dynamic Typing
  (12,1,'Give an example of a type error caught at compile time vs runtime'),
  (12,2,'Explain duck typing with an example in Python'),
  (12,3,'Compare structural and nominal typing systems'),
  -- Topic 13: Generics
  (13,1,'Write a generic Stack<T> class in Java or TypeScript'),
  (13,2,'Explain type bounds (extends / super in Java)'),
  (13,3,'Show how generics prevent ClassCastException'),
  -- Topic 14: Python Comprehensions
  (14,1,'Write a list comprehension that filters and transforms a list'),
  (14,2,'Implement a generator that yields Fibonacci numbers lazily'),
  (14,3,'Explain the difference between a generator and a list comprehension'),
  -- Topic 15: JVM & GC
  (15,1,'Describe the JVM class-loading process'),
  (15,2,'Explain when the JIT compiler kicks in'),
  (15,3,'Compare G1GC and ZGC garbage collectors'),
  -- Topic 16: C++ RAII
  (16,1,'Implement a RAII-based file handle class'),
  (16,2,'Explain the difference between unique_ptr and shared_ptr'),
  (16,3,'Demonstrate move semantics with std::move'),
  -- Topic 17: Two Pointers & Sliding Window
  (17,1,'Solve "Maximum Sum Subarray of Size K" using sliding window'),
  (17,2,'Solve "Two Sum II" using two pointers on a sorted array'),
  (17,3,'Identify when variable vs fixed window applies'),
  -- Topic 18: Prefix Sum
  (18,1,'Build a prefix sum array and answer 5 range sum queries in O(1)'),
  (18,2,'Use a difference array to apply range updates efficiently'),
  (18,3,'Solve "Subarray Sum Equals K" using prefix sums + hash map'),
  -- Topic 19: Hash Maps & Hash Sets
  (19,1,'Implement a hash map using open addressing'),
  (19,2,'Solve "Two Sum" and explain time complexity'),
  (19,3,'Use a hash set to detect duplicate characters'),
  -- Topic 23: Binary Trees
  (23,1,'Implement inorder traversal iteratively with a stack'),
  (23,2,'Implement level-order traversal using a queue'),
  (23,3,'Calculate height and diameter of a binary tree recursively'),
  -- Topic 25: Graph BFS/DFS
  (25,1,'Implement BFS and return shortest path in an unweighted graph'),
  (25,2,'Implement DFS iteratively and recursively'),
  (25,3,'Use DFS to detect cycles in a directed graph'),
  -- Topic 26: Shortest Path
  (26,1,'Implement Dijkstra with a min-heap'),
  (26,2,'Explain why Bellman-Ford handles negative weights'),
  (26,3,'State when to use Floyd-Warshall vs Dijkstra'),
  -- Topic 27: Union-Find
  (27,1,'Implement DSU with path compression and union by rank'),
  (27,2,'Use DSU to detect a cycle in an undirected graph'),
  (27,3,'Apply DSU to solve "Number of Connected Components"'),
  -- Topic 32: Memoization vs Tabulation
  (32,1,'Convert a top-down memoized solution to bottom-up DP'),
  (32,2,'Optimize a 2D DP table to O(n) space'),
  (32,3,'Explain overlapping subproblems with the Fibonacci example'),
  -- Topic 40: OOP Pillars
  (40,1,'Implement encapsulation using private fields and getters/setters'),
  (40,2,'Create an abstract class with abstract methods'),
  (40,3,'Demonstrate polymorphism with method overriding'),
  -- Topic 42: SOLID SRP & OCP
  (42,1,'Identify an SRP violation in a given class'),
  (42,2,'Refactor a class to use OCP via the strategy pattern'),
  (42,3,'Explain why OCP reduces regression risk during feature additions'),
  -- Topic 43: LSP, ISP, DIP
  (43,1,'Give a concrete example of an LSP violation and fix it'),
  (43,2,'Refactor a fat interface into smaller segregated interfaces'),
  (43,3,'Apply DIP by injecting a dependency instead of instantiating it'),
  -- Topic 44: Creational Patterns
  (44,1,'Implement a thread-safe Singleton using double-checked locking'),
  (44,2,'Implement a Factory Method pattern with a concrete example'),
  (44,3,'Build a Builder pattern for a complex object with 5+ fields'),
  -- Topic 48: SQL CRUD
  (48,1,'Write SELECT with WHERE, ORDER BY, and LIMIT'),
  (48,2,'Write an UPDATE with a correlated subquery condition'),
  (48,3,'Explain the difference between DELETE and TRUNCATE'),
  -- Topic 49: SQL Joins
  (49,1,'Write a LEFT JOIN and explain the NULL rows in the result'),
  (49,2,'Write a self-join to find employees sharing the same manager'),
  (49,3,'Explain the difference between CROSS JOIN and INNER JOIN'),
  -- Topic 51: Window Functions
  (51,1,'Compute a running total using SUM() OVER (ORDER BY ...)'),
  (51,2,'Rank employees by salary within their department using RANK()'),
  (51,3,'Find the difference between consecutive rows using LAG()'),
  -- Topic 54: Normalization
  (54,1,'Identify a 1NF violation and fix it'),
  (54,2,'Decompose a table with a partial dependency to reach 2NF'),
  (54,3,'Normalize a schema to BCNF step-by-step'),
  -- Topic 55: ACID Properties
  (55,1,'Explain each ACID property with a banking transaction example'),
  (55,2,'Choose the correct isolation level for a reporting query'),
  (55,3,'Describe how READ COMMITTED prevents dirty reads'),
  -- Topic 57: Indexes
  (57,1,'Explain the B-tree structure and how it speeds up range queries'),
  (57,2,'Create a covering index and explain why it avoids a table scan'),
  (57,3,'Describe when a hash index outperforms a B-tree index'),
  -- Topic 61: Process Lifecycle
  (61,1,'Draw the process state diagram with all transitions'),
  (61,2,'Explain the fork() and exec() system calls'),
  (61,3,'List the fields stored in a Process Control Block'),
  -- Topic 64: Virtual Memory & Paging
  (64,1,'Trace a virtual address through a two-level page table'),
  (64,2,'Explain the role of the TLB and the cost of a TLB miss'),
  (64,3,'Describe what happens when a page fault occurs'),
  -- Topic 69: CPU Scheduling
  (69,1,'Calculate turnaround and waiting time for Round Robin (Q=3)'),
  (69,2,'Explain why SJF is optimal in average waiting time'),
  (69,3,'Describe the Multilevel Feedback Queue algorithm'),
  -- Topic 74: OSI Model
  (74,1,'Map HTTP, TCP, IP, and Ethernet to the correct OSI layers'),
  (74,2,'Explain encapsulation at each layer with PDU names'),
  (74,3,'Describe what happens at each layer when you open a webpage'),
  -- Topic 76: TCP Connection
  (76,1,'Draw the TCP 3-way handshake with SYN/SYN-ACK/ACK flags'),
  (76,2,'Explain sequence numbers and cumulative ACKs'),
  (76,3,'Describe what happens during a TCP TIME_WAIT state'),
  -- Topic 79: HTTP versions
  (79,1,'Explain the head-of-line blocking problem in HTTP/1.1'),
  (79,2,'Describe how HTTP/2 multiplexing solves it'),
  (79,3,'Explain why HTTP/3 uses QUIC instead of TCP'),
  -- Topic 84: TLS/SSL
  (84,1,'Draw the TLS 1.3 handshake and identify when keys are derived'),
  (84,2,'Explain how a certificate chain establishes trust to a root CA'),
  (84,3,'Define forward secrecy and explain why ephemeral keys achieve it'),
  -- Topic 88: Git Internals
  (88,1,'Run git cat-file -p on a commit object and read its content'),
  (88,2,'Explain the difference between a blob, tree, and commit object'),
  (88,3,'Draw the DAG for a merge commit with two parents'),
  -- Topic 90: Unit Testing & TDD
  (90,1,'Write a unit test using Arrange-Act-Assert with a mock'),
  (90,2,'Practice the TDD red-green-refactor cycle on a fizzbuzz function'),
  (90,3,'Explain the difference between a mock, stub, and spy'),
  -- Topic 92: CI/CD Pipelines
  (92,1,'Write a GitHub Actions workflow that builds, tests, and lints'),
  (92,2,'Explain the difference between a CI and CD pipeline'),
  (92,3,'Describe how artifact caching speeds up pipelines'),
  -- Topic 96: REST Principles
  (96,1,'Design REST endpoints for a TODO application'),
  (96,2,'Explain idempotency and which HTTP methods are idempotent'),
  (96,3,'Map HTTP status codes to error scenarios correctly'),
  -- Topic 101: JWT & OAuth2
  (101,1,'Decode a JWT and identify header, payload, and signature'),
  (101,2,'Draw the OAuth2 authorization code flow diagram'),
  (101,3,'Explain access token vs refresh token lifecycle and storage'),
  -- Topic 103: Caching
  (103,1,'Implement the cache-aside pattern in pseudocode'),
  (103,2,'Explain when to use a CDN vs an application-level cache'),
  (103,3,'Describe the difference between write-through and write-behind'),
  -- Topic 105: Message Brokers
  (105,1,'Explain the difference between a Kafka topic and a RabbitMQ queue'),
  (105,2,'Describe consumer groups and how they enable parallel consumption'),
  (105,3,'Model an order processing system using Kafka topics'),
  -- Topic 118: HLD Framework
  (118,1,'Estimate QPS, storage, and bandwidth for a Twitter-scale system'),
  (118,2,'Identify functional and non-functional requirements for any system'),
  (118,3,'Apply the HLD interview framework within a 45-minute session'),
  -- Topic 126: URL Shortener
  (126,1,'Design the data model for a URL shortener'),
  (126,2,'Choose a hash/ID generation strategy and justify it'),
  (126,3,'Design the redirect flow with a caching layer'),
  -- Topic 123: Distributed Consensus
  (123,1,'Explain the Raft leader election process step-by-step'),
  (123,2,'Describe what happens during a network partition in Raft'),
  (123,3,'Compare Paxos and Raft in terms of understandability'),
  -- Topic 131: OWASP Top 10
  (131,1,'Demonstrate a SQL injection attack and its parameterized fix'),
  (131,2,'Explain stored XSS vs reflected XSS with examples'),
  (131,3,'Identify IDOR in a given API endpoint example and fix it'),
  -- Topic 136: Docker
  (136,1,'Write an optimized multi-stage Dockerfile for a Node.js app'),
  (136,2,'Explain the difference between a Docker image and a container'),
  (136,3,'Describe how image layers and the union filesystem work'),
  -- Topic 137: Kubernetes
  (137,1,'Deploy an nginx pod with a Service exposing port 80'),
  (137,2,'Write a Deployment with 3 replicas and a rolling update strategy'),
  (137,3,'Explain the difference between a ClusterIP and LoadBalancer Service'),
  -- Topic 143: Neural Networks
  (143,1,'Implement forward pass for a 2-layer neural network in NumPy'),
  (143,2,'Derive the backpropagation update rule using chain rule'),
  (143,3,'Explain what batch normalization does and why it helps training'),
  -- Topic 145: Transformers
  (145,1,'Explain the scaled dot-product attention formula'),
  (145,2,'Describe how positional encoding injects order information'),
  (145,3,'Explain the difference between encoder-only, decoder-only, and encoder-decoder models'),
  -- Topic 150: Von Neumann Architecture
  (150,1,'Trace the fetch-decode-execute cycle for a simple ADD instruction'),
  (150,2,'Explain the difference between RISC and CISC architectures'),
  (150,3,'Describe the role of each CPU component: ALU, CU, registers'),
  -- Topic 154: Compiler - Lexing & Parsing
  (154,1,'Write a simple lexer that tokenizes arithmetic expressions'),
  (154,2,'Implement a recursive descent parser for a context-free grammar'),
  (154,3,'Draw the AST for the expression: (3 + 4) * 2'),
  -- Topic 158: Interview Strategy
  (158,1,'Practice the clarify → plan → code → test cycle on 3 problems'),
  (158,2,'Complete a timed mock interview within 45 minutes'),
  (158,3,'Write clean, readable code with meaningful variable names during a mock'),
  -- Topic 161: STAR Method
  (161,1,'Write STAR stories for: conflict, failure, leadership, and impact'),
  (161,2,'Practice delivering each story aloud in under 2 minutes'),
  (161,3,'Tailor stories to the target company''s leadership principles'),
  -- Topic 163: Project Presentation
  (163,1,'Prepare a 5-minute project presentation using the P→S→I→C structure'),
  (163,2,'Anticipate 5 deep technical questions about your project and answer them'),
  (163,3,'Practice presenting to a non-technical audience and a technical one'),
  -- Topic 165: Offer Evaluation
  (165,1,'Calculate total compensation including base, bonus, and equity'),
  (165,2,'Compare two offers using a weighted scoring rubric'),
  (165,3,'List 5 non-salary benefits worth negotiating'),
  -- Topic 166: Negotiation
  (166,1,'Practice the anchoring technique in a mock negotiation'),
  (166,2,'Script a response to "What is your current salary?"'),
  (166,3,'Explain how to leverage a competing offer ethically')
) AS c(gseq,seq,text)
ON c.gseq = t.global_seq
ON CONFLICT (topic_id,seq) DO NOTHING;
