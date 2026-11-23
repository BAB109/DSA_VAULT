-- ==============================================================================
-- Migration: 008_cs_assessments.sql
-- Description: Knowledge assessment system for CS Fundamentals Learning Path
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING
-- ==============================================================================

-- ── Assessment question bank ──────────────────────────────────────────────────
-- question_type: 'mcq' | 'short_answer' | 'conceptual'
-- options: JSON array of strings (for MCQ). NULL for other types.
-- correct_answer: The correct option string (MCQ) or model answer (others).
-- explanation: Shown after submission.
-- difficulty: 'easy' | 'medium' | 'hard'

CREATE TABLE IF NOT EXISTS cs_assessment_questions (
    id              SERIAL PRIMARY KEY,
    topic_id        INTEGER     NOT NULL REFERENCES cs_topics(id) ON DELETE CASCADE,
    seq             INTEGER     NOT NULL,
    question_type   VARCHAR(20) NOT NULL CHECK (question_type IN ('mcq', 'short_answer', 'conceptual')),
    question_text   TEXT        NOT NULL,
    options         JSONB       NULL,         -- ["A","B","C","D"] for MCQ
    correct_answer  TEXT        NOT NULL,     -- exact string match for MCQ; used for model answer display for others
    explanation     TEXT        NOT NULL,
    difficulty      VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
    CONSTRAINT uq_cs_assessment_questions_topic_seq UNIQUE (topic_id, seq)
);

-- ── Per-topic assessment configuration ───────────────────────────────────────
-- is_mandatory: if TRUE, user must pass before topic can be marked complete
-- passing_score: 0-100 percentage required to pass
-- question_count: how many questions to show per attempt (NULL = all)

CREATE TABLE IF NOT EXISTS cs_topic_assessment_config (
    topic_id        INTEGER     NOT NULL PRIMARY KEY REFERENCES cs_topics(id) ON DELETE CASCADE,
    is_mandatory    BOOLEAN     NOT NULL DEFAULT FALSE,
    passing_score   INTEGER     NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 0 AND 100),
    question_count  INTEGER     NULL      -- NULL means show all available questions
);

-- ── User assessment attempts ──────────────────────────────────────────────────
-- attempt_number auto-increments per (user, topic) pair.
-- score is 0-100 percentage, calculated by backend only.

CREATE TABLE IF NOT EXISTS user_cs_assessment_attempts (
    id              SERIAL      PRIMARY KEY,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id        INTEGER     NOT NULL REFERENCES cs_topics(id) ON DELETE CASCADE,
    attempt_number  INTEGER     NOT NULL,
    score           NUMERIC(5,2) NOT NULL DEFAULT 0,
    passed          BOOLEAN     NOT NULL DEFAULT FALSE,
    total_questions INTEGER     NOT NULL DEFAULT 0,
    correct_count   INTEGER     NOT NULL DEFAULT 0,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cs_assessment_attempts_user_topic_num UNIQUE (user_id, topic_id, attempt_number)
);

-- ── Per-question answers within an attempt ────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_cs_assessment_answers (
    id              SERIAL      PRIMARY KEY,
    attempt_id      INTEGER     NOT NULL REFERENCES user_cs_assessment_attempts(id) ON DELETE CASCADE,
    question_id     INTEGER     NOT NULL REFERENCES cs_assessment_questions(id) ON DELETE CASCADE,
    user_answer     TEXT        NOT NULL,
    is_correct      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_cs_assessment_questions_topic ON cs_assessment_questions (topic_id, seq);
CREATE INDEX IF NOT EXISTS idx_user_assessment_attempts_user ON user_cs_assessment_attempts (user_id, topic_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_assessment_answers_attempt ON user_cs_assessment_answers (attempt_id);

-- ==============================================================================
-- ASSESSMENT QUESTION BANK
-- Covers topics with global_seq 1-16 (Module 1: Programming Language Fundamentals)
-- and selected topics from other modules.
-- Each INSERT uses ON CONFLICT DO NOTHING for idempotency.
-- ==============================================================================

-- Topic 1: Variables, Data Types & Type Casting
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'Which of the following is an example of implicit type coercion in JavaScript?',
  '["1 + \"1\" evaluates to \"11\"", "parseInt(\"42\") returns 42", "Number(\"3.14\") returns 3.14", "typeof null returns \"null\""]',
  '1 + "1" evaluates to "11"',
  'JavaScript implicitly converts the number 1 to a string when concatenating with "+". This is implicit coercion — no explicit cast was written.',
  'medium'
FROM cs_topics WHERE global_seq = 1 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is the key difference between static typing and dynamic typing?',
  '["Static: types checked at runtime; Dynamic: types checked at compile time","Static: types checked at compile time; Dynamic: types checked at runtime","Static: only primitives allowed; Dynamic: objects allowed","Static: always slower execution"]',
  'Static: types checked at compile time; Dynamic: types checked at runtime',
  'Statically-typed languages (Java, C++, TypeScript) verify types at compile time, catching type errors early. Dynamically-typed languages (Python, JavaScript, Ruby) check types at runtime, allowing more flexibility but potentially deferring type errors.',
  'easy'
FROM cs_topics WHERE global_seq = 1 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What happens in most signed 32-bit integer implementations when INT_MAX + 1 is computed in C/C++?',
  '["Throws a runtime exception","Wraps around to INT_MIN (undefined behavior in C/C++)","Allocates more bits automatically","Result is set to 0"]',
  'Wraps around to INT_MIN (undefined behavior in C/C++)',
  'In C/C++, signed integer overflow is technically undefined behavior. On most architectures using two''s complement, the value wraps to INT_MIN. Java explicitly guarantees two''s-complement wrap-around for int and long.',
  'hard'
FROM cs_topics WHERE global_seq = 1 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 4, 'mcq',
  'Which type casting operation can cause data loss?',
  '["int to long","float to double","double to int","short to int"]',
  'double to int',
  'Casting from a wider type (double) to a narrower type (int) truncates the fractional part and may overflow, causing data loss. Widening conversions (int to long, float to double) are always safe.',
  'easy'
FROM cs_topics WHERE global_seq = 1 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 2: Control Flow
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What does short-circuit evaluation mean in the expression: if (a != null && a.getValue() > 0)?',
  '["Both conditions are always evaluated","a.getValue() is only evaluated if a != null is true","a.getValue() is always evaluated first","The expression always returns true if a is not null"]',
  'a.getValue() is only evaluated if a != null is true',
  'With &&, if the left operand is false, the right operand is not evaluated because the overall result is already determined (false). This prevents NullPointerException when a is null.',
  'medium'
FROM cs_topics WHERE global_seq = 2 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is a loop invariant?',
  '["A variable that never changes inside a loop","A condition that holds true before and after each loop iteration","A loop that runs exactly once","A loop with no exit condition"]',
  'A condition that holds true before and after each loop iteration',
  'A loop invariant is a property that is true before the loop starts, remains true after each iteration, and when combined with the loop termination condition, proves the loop''s correctness. It is a formal technique for proving loops correct.',
  'medium'
FROM cs_topics WHERE global_seq = 2 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What is the output of: for(int i=0; i<5; i++) { if(i==3) continue; System.out.print(i); }',
  '["01234","0124","012","01245"]',
  '0124',
  'continue skips the rest of the current iteration and moves to the next. When i=3, the print is skipped, so only 0,1,2,4 are printed.',
  'easy'
FROM cs_topics WHERE global_seq = 2 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 4, 'mcq',
  'Which control flow structure best fits selecting one of many fixed constant values?',
  '["if-else chain","switch statement","while loop","ternary operator"]',
  'switch statement',
  'switch is designed for selecting among discrete constant values. The compiler can often optimize it into a jump table making it O(1), whereas an if-else chain is O(n). For non-constant or range conditions, if-else is appropriate.',
  'easy'
FROM cs_topics WHERE global_seq = 2 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 3: Functions, Scope & Closures
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What does a closure capture in JavaScript?',
  '["Only the values of variables at the time of function creation","A reference to the surrounding lexical scope (variables by reference)","A snapshot copy of all global variables","Only the function''s own local variables"]',
  'A reference to the surrounding lexical scope (variables by reference)',
  'A closure closes over (captures references to) variables in the enclosing lexical scope, not their values at creation time. This means if the outer variable changes later, the closure sees the updated value.',
  'medium'
FROM cs_topics WHERE global_seq = 3 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is the call stack used for during function execution?',
  '["Storing global variables permanently","Tracking active function calls, local variables, and return addresses","Allocating heap memory for objects","Garbage collecting unused objects"]',
  'Tracking active function calls, local variables, and return addresses',
  'The call stack is a LIFO data structure that tracks the currently executing functions. Each function call pushes a stack frame containing local variables, parameters, and the return address. The frame is popped when the function returns.',
  'medium'
FROM cs_topics WHERE global_seq = 3 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What does IIFE stand for and what problem does it solve?',
  '["Immediately Invoked Function Expression — creates a new scope to avoid polluting the global namespace","Inherited Interface Function Expression — allows interface reuse","Implicit Inline Function Expression — speeds up execution","Iterative Invoked Function Expression — enables loops"]',
  'Immediately Invoked Function Expression — creates a new scope to avoid polluting the global namespace',
  'An IIFE is a function that is defined and called immediately. Before ES6 modules, IIFEs were used to encapsulate code in a local scope, preventing variables from leaking into the global namespace.',
  'medium'
FROM cs_topics WHERE global_seq = 3 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 4, 'mcq',
  'What is lexical scope?',
  '["Scope determined by where a function is called","Scope determined by where a function is defined in the source code","Scope shared across all modules","Scope that exists only during compilation"]',
  'Scope determined by where a function is defined in the source code',
  'Lexical (static) scope means variable lookup is based on where the function was written in the source code, not where it is called. This is why closures work — the function remembers its definition-time environment.',
  'easy'
FROM cs_topics WHERE global_seq = 3 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 4: Arrays & Strings Fundamentals
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'Why are strings immutable in Java and Python?',
  '["To prevent them from being garbage collected","To enable safe sharing, caching (string pool/interning), and use as hash map keys","Because strings are stored on the stack","To enforce maximum string length limits"]',
  'To enable safe sharing, caching (string pool/interning), and use as hash map keys',
  'Immutable strings can be safely shared between multiple references without copying. They can be cached (string pool in Java). Since their content never changes, their hash code is stable, making them safe as hash map keys.',
  'medium'
FROM cs_topics WHERE global_seq = 4 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is the time complexity of accessing an element in an array by index?',
  '["O(n)","O(log n)","O(1)","O(n²)"]',
  'O(1)',
  'Arrays store elements in contiguous memory. The address of element at index i is: base_address + i * element_size. This arithmetic is computed in constant time regardless of array size.',
  'easy'
FROM cs_topics WHERE global_seq = 4 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What is the time complexity of appending to a Python list (amortized)?',
  '["O(n) every time","O(1) amortized","O(log n)","O(n²)"]',
  'O(1) amortized',
  'Python lists use dynamic arrays that double their capacity when full. Although individual resizing operations are O(n), they happen infrequently. Amortized over many appends, the cost per append is O(1).',
  'medium'
FROM cs_topics WHERE global_seq = 4 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 4, 'mcq',
  'Which operation on a string in Java creates a new String object?',
  '["Calling str.length()","Calling str.charAt(0)","Using str + \" world\"","Passing str to a method"]',
  'Using str + " world"',
  'String concatenation with + in Java creates a new String object because String is immutable. The original string is unchanged. For repeated concatenation, StringBuilder is more efficient.',
  'easy'
FROM cs_topics WHERE global_seq = 4 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 5: Stack vs Heap Memory
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'Where are local variables typically stored in most compiled languages?',
  '["Heap","Static/data segment","Stack","Register file only"]',
  'Stack',
  'Local variables and function parameters are stored in stack frames. The stack grows and shrinks as functions are called and return. Stack allocation is fast (just a pointer decrement) but limited in size.',
  'easy'
FROM cs_topics WHERE global_seq = 5 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What causes a stack overflow error?',
  '["Allocating too many objects on the heap","Too many nested/recursive function calls exhausting the call stack size limit","Accessing an array out of bounds","Dereferencing a null pointer"]',
  'Too many nested/recursive function calls exhausting the call stack size limit',
  'Each function call allocates a stack frame. If recursion is too deep or infinite, the stack runs out of space, causing a stack overflow. This is commonly encountered with unbounded recursion.',
  'easy'
FROM cs_topics WHERE global_seq = 5 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What is a memory leak and where does it occur?',
  '["Accessing freed stack memory","Heap memory that is allocated but never released, making it unavailable for future allocations","Stack overflow from deep recursion","Null pointer dereference"]',
  'Heap memory that is allocated but never released, making it unavailable for future allocations',
  'A memory leak occurs when heap-allocated memory is no longer reachable by the program (no references point to it) but has not been freed. In garbage-collected languages, GC handles this; in C/C++, developers must manually free memory.',
  'medium'
FROM cs_topics WHERE global_seq = 5 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 4, 'mcq',
  'What determines when an object becomes eligible for garbage collection in Java?',
  '["When the program calls System.gc() explicitly","When no live references (roots) can reach the object","When the object''s memory size exceeds a threshold","When the object''s constructor completes"]',
  'When no live references (roots) can reach the object',
  'Java''s GC uses reachability. An object is eligible for collection when it is not reachable from any GC root (thread stacks, static fields, JNI references). The GC traces the object graph from roots and collects unreachable objects.',
  'medium'
FROM cs_topics WHERE global_seq = 5 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 6: Pointers & References
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is a dangling pointer?',
  '["A pointer that points to NULL","A pointer that points to memory that has already been freed or gone out of scope","A pointer to a pointer","A pointer with an invalid type cast"]',
  'A pointer that points to memory that has already been freed or gone out of scope',
  'A dangling pointer references memory that has been deallocated or is no longer valid (e.g., a local variable after its function returns). Dereferencing it is undefined behavior and a common source of security vulnerabilities.',
  'medium'
FROM cs_topics WHERE global_seq = 6 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What does the & operator do when applied to a variable in C?',
  '["Bitwise AND of the variable","Returns the memory address (pointer) of the variable","Dereferences the pointer","Creates a copy of the variable"]',
  'Returns the memory address (pointer) of the variable',
  'In C, &x returns a pointer to x — the memory address where x is stored. This is the address-of operator. The dereference operator * then reads or writes the value at that address.',
  'easy'
FROM cs_topics WHERE global_seq = 6 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What is the key difference between a C++ reference and a pointer?',
  '["References can be null; pointers cannot","References must be initialized and cannot be reseated to another object; pointers can be reassigned","Pointers are safer than references","References use -> syntax; pointers use . syntax"]',
  'References must be initialized and cannot be reseated to another object; pointers can be reassigned',
  'A C++ reference is an alias for an existing object, must be bound at initialization, cannot be null, and cannot be made to refer to a different object later. Pointers can be null, uninitialized, and reassigned to point to different objects.',
  'medium'
FROM cs_topics WHERE global_seq = 6 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 4, 'mcq',
  'What does a null pointer dereference cause in C?',
  '["A compile-time error","Undefined behavior — typically a segmentation fault at runtime","The pointer is automatically set to a valid address","The value 0 is returned"]',
  'Undefined behavior — typically a segmentation fault at runtime',
  'Dereferencing a null pointer in C is undefined behavior. On most operating systems, address 0 is protected and the OS sends SIGSEGV (segmentation fault), terminating the program. This is a common cause of crashes and security vulnerabilities.',
  'easy'
FROM cs_topics WHERE global_seq = 6 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 7: Threads & Processes (global_seq=7)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the key difference between a process and a thread?',
  '["Processes share memory; threads have separate memory spaces","Threads share the same memory space within a process; processes have isolated memory","Threads are slower to create than processes","Processes are always single-threaded"]',
  'Threads share the same memory space within a process; processes have isolated memory',
  'A process has its own isolated virtual address space, file descriptors, and resources. Threads within the same process share heap memory, file descriptors, and global state, but each has its own stack and registers. This sharing makes thread communication fast but introduces race conditions.',
  'easy'
FROM cs_topics WHERE global_seq = 7 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is context switching?',
  '["Switching between programming languages","The OS saving the state of one thread/process and restoring another to give the CPU to it","Switching between network connections","Swapping RAM to disk"]',
  'The OS saving the state of one thread/process and restoring another to give the CPU to it',
  'Context switching is the mechanism by which the OS scheduler saves the register state, program counter, and stack pointer of the currently running thread and restores those of another thread so it can run. It has overhead (cache invalidation, TLB flushes).',
  'medium'
FROM cs_topics WHERE global_seq = 7 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What is a thread pool and why is it used?',
  '["A collection of idle threads waiting to execute tasks — avoids the overhead of creating/destroying threads per task","A memory pool shared by threads","A pool of processes","A lock that multiple threads can hold simultaneously"]',
  'A collection of idle threads waiting to execute tasks — avoids the overhead of creating/destroying threads per task',
  'Creating and destroying threads is expensive. Thread pools maintain a fixed set of pre-created threads. Tasks are submitted to a queue, and worker threads pick them up. This bounds resource usage and eliminates per-task thread creation overhead.',
  'medium'
FROM cs_topics WHERE global_seq = 7 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 8: Synchronization Primitives (global_seq=8)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is a race condition?',
  '["A situation where two threads complete at the same time","A bug where program behavior depends on the relative timing/interleaving of concurrent operations","A deadlock between two processes","When a thread runs faster than expected"]',
  'A bug where program behavior depends on the relative timing/interleaving of concurrent operations',
  'A race condition occurs when two or more threads access shared data concurrently and at least one modifies it, without proper synchronization. The outcome depends on which thread runs first, making the bug non-deterministic and hard to reproduce.',
  'medium'
FROM cs_topics WHERE global_seq = 8 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What are the four necessary conditions for deadlock (Coffman conditions)?',
  '["Mutual exclusion, hold and wait, no preemption, circular wait","Starvation, livelock, priority inversion, busy waiting","Mutex, semaphore, monitor, condition variable","Read lock, write lock, shared lock, exclusive lock"]',
  'Mutual exclusion, hold and wait, no preemption, circular wait',
  'All four Coffman conditions must hold simultaneously for deadlock: (1) Mutual exclusion: resources can''t be shared. (2) Hold and wait: process holds resources while waiting for more. (3) No preemption: resources can''t be forcibly taken. (4) Circular wait: cycle of processes each waiting for the next.',
  'hard'
FROM cs_topics WHERE global_seq = 8 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What is the difference between a mutex and a semaphore?',
  '["Mutex can be held by multiple threads; semaphore by only one","A mutex provides mutual exclusion for one thread at a time; a semaphore can allow N concurrent accessors","Semaphores are faster","They are identical constructs"]',
  'A mutex provides mutual exclusion for one thread at a time; a semaphore can allow N concurrent accessors',
  'A mutex (mutual exclusion lock) allows exactly one thread to hold it at a time and must be released by the thread that acquired it. A semaphore maintains a count and allows up to N concurrent acquisitions (binary semaphore = N=1, counting semaphore for resource pools).',
  'medium'
FROM cs_topics WHERE global_seq = 8 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 9: Async/Await & Promises (global_seq=9)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the JavaScript event loop?',
  '["A built-in for-loop for iterating arrays","A mechanism that processes the call stack and callback/task queues to enable non-blocking I/O in a single-threaded environment","A thread pool for parallel execution","A loop that refreshes the browser DOM"]',
  'A mechanism that processes the call stack and callback/task queues to enable non-blocking I/O in a single-threaded environment',
  'JavaScript is single-threaded. The event loop continuously checks if the call stack is empty, then picks the next task from the queue (macro-task or micro-task). This allows async I/O without blocking the main thread.',
  'medium'
FROM cs_topics WHERE global_seq = 9 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What are the three states of a Promise?',
  '["Running, Paused, Stopped","Pending, Fulfilled, Rejected","Open, Closed, Error","Active, Inactive, Cancelled"]',
  'Pending, Fulfilled, Rejected',
  'A Promise starts in Pending state. If the async operation succeeds, it transitions to Fulfilled with a value. If it fails, it transitions to Rejected with a reason. Once settled (fulfilled or rejected), a promise''s state cannot change.',
  'easy'
FROM cs_topics WHERE global_seq = 9 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What does "await" do inside an async function?',
  '["Blocks the entire JavaScript thread until the promise resolves","Pauses execution of the async function until the awaited promise settles, yielding control back to the event loop","Creates a new thread","Converts a callback to a promise"]',
  'Pauses execution of the async function until the awaited promise settles, yielding control back to the event loop',
  'await suspends the current async function, returning control to the caller/event loop. When the promise settles, execution resumes. This is syntactic sugar over .then() chains and does NOT block the main thread.',
  'medium'
FROM cs_topics WHERE global_seq = 9 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 10: Higher-Order Functions & Lambdas (global_seq=10)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is a higher-order function?',
  '["A function defined inside a class","A function that takes other functions as arguments and/or returns a function","A function with more than 3 parameters","A recursive function"]',
  'A function that takes other functions as arguments and/or returns a function',
  'Higher-order functions treat functions as first-class citizens — passing them as values. Examples: map(fn, list), filter(predicate, list), reduce(fn, list, init). This enables function composition and declarative programming style.',
  'easy'
FROM cs_topics WHERE global_seq = 10 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is currying?',
  '["Converting a multi-argument function into a sequence of single-argument functions","Sorting a list using a comparison function","Combining two functions into one","Memoizing function results"]',
  'Converting a multi-argument function into a sequence of single-argument functions',
  'Currying transforms f(a, b, c) into f(a)(b)(c). Each call returns a new function that takes the next argument. This enables partial application — creating specialized functions by pre-filling some arguments.',
  'medium'
FROM cs_topics WHERE global_seq = 10 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 3, 'mcq',
  'What does Array.prototype.reduce do?',
  '["Filters elements matching a predicate","Transforms each element independently","Accumulates array elements into a single value using a reducer function and initial value","Sorts the array in-place"]',
  'Accumulates array elements into a single value using a reducer function and initial value',
  'reduce(fn, init) iterates over the array, calling fn(accumulator, element) for each element. The result becomes the new accumulator. After all elements, the final accumulator value is returned. Useful for sums, products, building objects, etc.',
  'medium'
FROM cs_topics WHERE global_seq = 10 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topics 17-20 (Module 2 - DSA): Two Pointers, Prefix Sum, Hash Maps, Linked Lists
-- Topic 17: Two Pointers & Sliding Window
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the time complexity of the sliding window approach for finding the maximum sum subarray of size k?',
  '["O(n²)","O(n log n)","O(n)","O(k)"]',
  'O(n)',
  'The sliding window maintains a running sum. As the window slides right, we add the new element and remove the leftmost element — both O(1) operations. Total: O(n) for n elements, vs O(nk) for the naive approach.',
  'medium'
FROM cs_topics WHERE global_seq = 17 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'When should you use the two-pointer technique with converging pointers?',
  '["On any unsorted array","On a sorted array or when you need to find pairs satisfying a condition","When searching for a single element","When you have more than 2 arrays"]',
  'On a sorted array or when you need to find pairs satisfying a condition',
  'Converging two pointers (start and end moving toward each other) works on sorted data or when the problem has a monotonic property. E.g., two-sum on sorted array: if sum > target, move right pointer left; if sum < target, move left pointer right.',
  'medium'
FROM cs_topics WHERE global_seq = 17 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 19: Hash Maps & Hash Sets (global_seq=19)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the average time complexity of a lookup in a hash map?',
  '["O(n)","O(log n)","O(1)","O(n²)"]',
  'O(1)',
  'Hash maps compute the hash of the key to find the bucket directly, making average-case lookup O(1). Worst case (all keys hash to the same bucket) is O(n), but a good hash function and load factor management keeps it O(1) amortized.',
  'easy'
FROM cs_topics WHERE global_seq = 19 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is a hash collision and how does separate chaining resolve it?',
  '["Two keys having identical hash codes — resolved by storing them in a linked list at the same bucket","A hash map exceeding its capacity — resolved by rehashing","Two hash maps having the same data — resolved by merging","A key returning null — resolved by a default value"]',
  'Two keys having identical hash codes — resolved by storing them in a linked list at the same bucket',
  'A collision occurs when two different keys hash to the same bucket index. Separate chaining stores a linked list (or tree) at each bucket. Lookup walks the list comparing keys. Java''s HashMap uses a linked list, converting to a balanced tree when the chain grows long (>8).',
  'medium'
FROM cs_topics WHERE global_seq = 19 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 23: Binary Trees (global_seq=23)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'In which traversal order does inorder traversal visit nodes of a BST to produce a sorted sequence?',
  '["Preorder: root, left, right","Inorder: left, root, right","Postorder: left, right, root","Level-order: top to bottom"]',
  'Inorder: left, root, right',
  'Inorder traversal (left → root → right) on a Binary Search Tree visits nodes in ascending sorted order because all left subtree values are less than the root, and all right subtree values are greater.',
  'easy'
FROM cs_topics WHERE global_seq = 23 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is the height of a balanced binary tree with n nodes?',
  '["O(n)","O(n²)","O(log n)","O(1)"]',
  'O(log n)',
  'A balanced binary tree has height O(log n) because each level doubles the number of nodes. With n nodes, the height is ⌊log₂ n⌋. An unbalanced (degenerate) tree degrades to O(n) height like a linked list.',
  'easy'
FROM cs_topics WHERE global_seq = 23 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 32: Memoization vs Tabulation (global_seq=32)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the main difference between memoization and tabulation in dynamic programming?',
  '["Memoization uses iteration; tabulation uses recursion","Memoization is top-down recursion with caching; tabulation is bottom-up iteration filling a table","They are identical techniques","Tabulation only works for 1D problems"]',
  'Memoization is top-down recursion with caching; tabulation is bottom-up iteration filling a table',
  'Memoization starts from the original problem, recurses to subproblems, and caches results (lazy). Tabulation starts from the smallest subproblems and builds up (eager). Tabulation avoids recursion overhead and stack overflow risks; memoization only computes needed subproblems.',
  'medium'
FROM cs_topics WHERE global_seq = 32 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is overlapping subproblems, and why is it key to dynamic programming?',
  '["Subproblems that share the same input data","Subproblems that are solved multiple times in naive recursion — DP avoids this by storing/reusing their results","Subproblems that cannot be solved independently","Subproblems with identical outputs"]',
  'Subproblems that are solved multiple times in naive recursion — DP avoids this by storing/reusing their results',
  'Without memoization, naive recursion recomputes the same subproblems exponentially. E.g., Fibonacci: fib(5) calls fib(3) twice. DP stores results the first time and reuses them, reducing exponential time to polynomial.',
  'medium'
FROM cs_topics WHERE global_seq = 32 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 40: OOP - Classes & Encapsulation (global_seq=40)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What does encapsulation mean in OOP?',
  '["Inheriting behavior from a parent class","Bundling data and the methods that operate on it within a class, restricting direct access from outside","Creating multiple instances of a class","Having a class implement multiple interfaces"]',
  'Bundling data and the methods that operate on it within a class, restricting direct access from outside',
  'Encapsulation hides internal implementation details by making fields private and exposing behavior through public methods. This protects invariants, reduces coupling, and allows the implementation to change without breaking client code.',
  'easy'
FROM cs_topics WHERE global_seq = 40 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is abstraction in the context of OOP?',
  '["Making all fields public","Hiding implementation complexity and exposing only a clean, minimal interface to clients","Creating sub-classes","Running code in a virtual machine"]',
  'Hiding implementation complexity and exposing only a clean, minimal interface to clients',
  'Abstraction separates what an object does from how it does it. Abstract classes and interfaces define contracts (what), while concrete implementations provide the how. Clients interact with the abstraction, remaining unaffected by implementation changes.',
  'easy'
FROM cs_topics WHERE global_seq = 40 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 48: SQL CRUD (global_seq=48)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What does the WHERE clause do in a SELECT statement?',
  '["Specifies which columns to return","Filters rows based on a condition","Groups rows together","Orders the result set"]',
  'Filters rows based on a condition',
  'WHERE filters the rows returned by a query. Only rows satisfying the condition are included in the result. It is evaluated before GROUP BY and HAVING. ORDER BY affects output ordering.',
  'easy'
FROM cs_topics WHERE global_seq = 48 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'What is the difference between DELETE and TRUNCATE in SQL?',
  '["They are identical","DELETE removes specific rows (can be filtered with WHERE and rolled back); TRUNCATE removes all rows quickly without row-by-row logging, often non-transactional","TRUNCATE can target specific rows; DELETE cannot","DELETE is faster than TRUNCATE"]',
  'DELETE removes specific rows (can be filtered with WHERE and rolled back); TRUNCATE removes all rows quickly without row-by-row logging, often non-transactional',
  'DELETE is a DML statement — it fires triggers, logs each deleted row, and can be rolled back. TRUNCATE is a DDL statement — it deallocates data pages, is much faster for large tables, but cannot be filtered or rolled back in some databases.',
  'medium'
FROM cs_topics WHERE global_seq = 48 ON CONFLICT (topic_id, seq) DO NOTHING;

-- ==============================================================================
-- ASSESSMENT CONFIGURATION
-- Set is_mandatory=TRUE with passing_score=70 for a representative set of topics.
-- Topics without config default to optional assessments.
-- ==============================================================================

-- Make first 10 topics have assessments configured (optional by default)
-- Topics with mandatory assessments: 1,2,3,5,7,8,9,17,23,32,40,48
INSERT INTO cs_topic_assessment_config (topic_id, is_mandatory, passing_score, question_count)
SELECT t.id, cfg.mandatory, cfg.score, cfg.qcount::integer
FROM cs_topics t
JOIN (VALUES
  (1,  FALSE, 70, NULL::integer),
  (2,  FALSE, 70, NULL::integer),
  (3,  FALSE, 70, NULL::integer),
  (4,  FALSE, 70, NULL::integer),
  (5,  FALSE, 70, NULL::integer),
  (6,  FALSE, 70, NULL::integer),
  (7,  FALSE, 70, NULL::integer),
  (8,  FALSE, 70, NULL::integer),
  (9,  FALSE, 70, NULL::integer),
  (10, FALSE, 70, NULL::integer),
  (17, FALSE, 70, NULL::integer),
  (19, FALSE, 70, NULL::integer),
  (23, FALSE, 70, NULL::integer),
  (32, FALSE, 70, NULL::integer),
  (40, FALSE, 70, NULL::integer),
  (48, FALSE, 70, NULL::integer)
) AS cfg(gs, mandatory, score, qcount) ON t.global_seq = cfg.gs
ON CONFLICT (topic_id) DO NOTHING;
