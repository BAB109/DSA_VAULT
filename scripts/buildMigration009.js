import fs from 'fs';

const phase2GlobalSeqs = new Set([
  15, 16, 27, 37, 38, 39, 58, 59, 60, 66, 68, 72, 73, 81, 82, 85, 93, 99, 100, 105, 106,
  113, 114, 119, 122, 123, 124, 125, 127, 128, 129, 130, 135, 137, 138, 139, 145, 148, 149,
  150, 151, 152, 153, 154, 155, 156, 157
]);

const stageMap = {
  1: 'Language Basics', 2: 'Language Basics', 3: 'Language Basics', 4: 'Language Basics',
  5: 'Memory & Concurrency', 6: 'Memory & Concurrency', 7: 'Memory & Concurrency', 8: 'Memory & Concurrency', 9: 'Memory & Concurrency',
  10: 'Modern Paradigms', 11: 'Modern Paradigms', 12: 'Type Systems', 13: 'Type Systems',
  14: 'Python Fundamentals', 15: 'Advanced Runtimes', 16: 'Advanced Systems Programming',
  29: 'Stage A: Analysis and Basics', 30: 'Stage A: Analysis and Basics', 31: 'Stage A: Analysis and Basics',
  17: 'Stage B: Core Patterns', 18: 'Stage B: Core Patterns', 19: 'Stage B: Core Patterns',
  36: 'Stage C: Recursion and Search', 167: 'Stage C: Optional Specialization - Bit Manipulation',
  20: 'Stage D: Linear and Hierarchical Structures', 21: 'Stage D: Linear and Hierarchical Structures', 22: 'Stage D: Linear and Hierarchical Structures',
  23: 'Stage D: Linear and Hierarchical Structures', 24: 'Stage D: Linear and Hierarchical Structures', 28: 'Stage D: Linear and Hierarchical Structures',
  25: 'Stage E: Graphs', 26: 'Stage E: Graphs',
  32: 'Stage F: Dynamic Programming', 33: 'Stage F: Dynamic Programming', 34: 'Stage F: Dynamic Programming', 35: 'Stage F: Dynamic Programming',
  27: 'Advanced Graph & Set Structures', 37: 'Advanced Greedy & Compression', 38: 'Advanced Tree Structures', 39: 'Advanced Range Queries',
  40: 'OOP Pillars', 41: 'OOP Pillars', 42: 'SOLID Principles', 43: 'SOLID Principles',
  44: 'Design Patterns', 45: 'Design Patterns', 46: 'Design Patterns', 47: 'UML & Modeling',
  48: 'SQL Foundations', 49: 'SQL Foundations', 50: 'Advanced SQL', 51: 'Advanced SQL', 52: 'Advanced SQL',
  53: 'Database Design', 54: 'Database Design', 55: 'Transactions & Concurrency', 56: 'Transactions & Concurrency', 57: 'Indexing & Performance',
  58: 'Advanced Query Optimization', 59: 'Distributed Databases & NoSQL', 60: 'Distributed Databases & NoSQL',
  61: 'Processes & Threads', 62: 'Processes & Threads', 63: 'Processes & Threads',
  64: 'Memory Management', 65: 'Memory Management', 66: 'Advanced Memory & Storage',
  67: 'File Systems & I/O', 68: 'Advanced Memory & Storage', 69: 'Scheduling',
  70: 'Synchronization & Deadlocks', 71: 'Synchronization & Deadlocks',
  72: 'Virtualization & Isolation', 73: 'Virtualization & Isolation',
  74: 'Network Architecture', 75: 'Network Architecture', 76: 'Transport Layer', 77: 'Transport Layer', 78: 'Transport Layer',
  79: 'Application Layer', 80: 'Application Layer', 81: 'Real-Time Streaming Protocols', 82: 'Internet Routing & Infrastructure',
  83: 'Network Infrastructure', 84: 'Network Security', 85: 'Advanced Network Defense',
  86: 'SDLC', 87: 'SDLC', 88: 'Version Control', 89: 'Version Control',
  90: 'Testing Strategies', 91: 'Testing Strategies', 92: 'DevOps & CI/CD', 93: 'Advanced DevOps & Infrastructure',
  94: 'Code Quality', 95: 'Code Quality',
  96: 'REST APIs', 97: 'REST APIs', 98: 'REST APIs', 99: 'Alternative API Paradigms', 100: 'Alternative API Paradigms',
  101: 'Auth & Security', 102: 'Auth & Security', 103: 'Caching Strategies', 104: 'Caching Strategies',
  105: 'Event-Driven Systems', 106: 'Event-Driven Systems', 107: 'Backend Resilience', 108: 'Backend Resilience',
  109: 'LLD Foundations', 110: 'Classic LLD Problems', 111: 'Classic LLD Problems', 112: 'Classic LLD Problems',
  113: 'Complex System Modeling', 114: 'Complex System Modeling', 115: 'Classic LLD Problems',
  116: 'Concurrency in LLD', 117: 'Concurrency in LLD',
  118: 'HLD Fundamentals', 119: 'Distributed Architecture Patterns', 120: 'HLD Fundamentals', 121: 'HLD Fundamentals',
  122: 'Distributed Algorithms', 123: 'Distributed Algorithms', 124: 'Advanced Distributed Caching', 125: 'Production Observability',
  126: 'Essential HLD Designs', 127: 'Large-Scale System Designs', 128: 'Large-Scale System Designs', 129: 'Large-Scale System Designs', 130: 'Large-Scale System Designs',
  131: 'Application Security', 132: 'Application Security', 133: 'Application Security',
  134: 'Cloud Platforms', 135: 'Advanced Cloud Infrastructure', 136: 'Containerization',
  137: 'Container Orchestration', 138: 'Advanced Release Engineering', 139: 'Site Reliability Engineering',
  168: 'Stage 2: Python for Data Work', 169: 'Stage 3: Mathematics and Statistics for ML',
  140: 'Stage 4: ML Foundations', 141: 'Stage 4: ML Foundations', 142: 'Stage 4: ML Foundations',
  143: 'Stage 5: Deep Learning', 144: 'Stage 5: Deep Learning',
  146: 'Stage 6: Generative AI & AI Engineering', 147: 'Stage 6: Generative AI & AI Engineering',
  145: 'Advanced Neural Architectures', 148: 'Production MLOps', 149: 'Production MLOps',
  150: 'Computer Architecture', 151: 'Computer Architecture', 152: 'Memory Hierarchy', 153: 'Memory Hierarchy',
  154: 'Compiler Basics', 155: 'Compiler Basics', 156: 'Number Systems & Boolean Algebra', 157: 'Number Systems & Boolean Algebra',
  158: 'Interview Strategies', 159: 'Interview Strategies', 160: 'Interview Strategies',
  161: 'Behavioral Interviews', 162: 'Behavioral Interviews',
  163: 'Project Defense', 164: 'Project Defense',
  165: 'Offer Evaluation & Negotiation', 166: 'Offer Evaluation & Negotiation'
};

function getLanguage(gs) {
  if (gs >= 140 && gs <= 149) return 'python';
  if (gs === 168 || gs === 169 || gs === 14) return 'python';
  if (gs >= 48 && gs <= 60) return 'sql';
  if (gs === 132 || gs === 74 || gs === 75 || gs === 76 || gs === 77 || gs === 78 || gs === 80 || gs === 82 || gs === 83 || gs === 84 || gs === 85 || gs === 135) return 'python';
  if ((gs >= 86 && gs <= 108) || (gs >= 118 && gs <= 130) || (gs >= 131 && gs <= 139) || (gs >= 161 && gs <= 166) || gs === 9) {
    if (gs === 122 || gs === 123 || gs === 128) return 'cpp';
    return 'javascript';
  }
  if (gs === 15) return 'java';
  return 'cpp';
}

const prereqsMap = {
  2: [1], 3: [2], 4: [3], 5: [3], 6: [4, 5], 7: [5], 8: [7], 9: [3], 10: [3], 11: [10], 12: [1], 13: [1, 3], 14: [3],
  15: [5], 16: [6],
  17: [4], 18: [4], 19: [4], 20: [6], 21: [20], 22: [20], 23: [3, 20], 24: [23], 25: [22, 23], 26: [25, 28],
  27: [25], 28: [23], 29: [4], 30: [29], 31: [4], 32: [3], 33: [32], 34: [33], 35: [34], 36: [29], 37: [28, 36], 38: [23], 39: [23],
  167: [2],
  40: [3], 41: [40], 42: [41], 43: [42], 44: [43], 45: [43], 46: [43], 47: [41],
  48: [], 49: [48], 50: [49], 51: [50], 52: [49], 53: [48], 54: [53], 55: [48], 56: [55], 57: [48], 58: [57], 59: [48], 60: [55, 59],
  61: [5], 62: [61], 63: [61], 64: [5], 65: [64], 66: [64], 67: [61], 68: [67], 69: [61], 70: [8, 62], 71: [70], 72: [61], 73: [61],
  74: [], 75: [74], 76: [75], 77: [76], 78: [75], 79: [76], 80: [78], 81: [79], 82: [75], 83: [75], 84: [76], 85: [84],
  86: [], 87: [86], 88: [], 89: [88], 90: [3], 91: [90], 92: [89, 90], 93: [92], 94: [89], 95: [87],
  96: [79], 97: [96], 98: [96], 99: [96], 100: [96], 101: [96], 102: [96], 103: [96], 104: [103], 105: [96], 106: [105], 107: [48, 96], 108: [96],
  109: [40, 47], 110: [109], 111: [109], 112: [109], 113: [109], 114: [109], 115: [109], 116: [8, 44], 117: [8, 22],
  118: [96], 119: [118], 120: [83, 118], 121: [55, 118], 122: [120], 123: [60, 119], 124: [103], 125: [119], 126: [118, 120], 127: [121, 126], 128: [122, 123], 129: [103, 126], 130: [126],
  131: [96], 132: [84], 133: [131], 134: [96], 135: [83, 134], 136: [73], 137: [136], 138: [92, 136], 139: [92],
  168: [14], 169: [168],
  140: [169], 141: [140], 142: [141], 143: [142], 144: [143], 145: [144], 146: [143], 147: [146], 148: [142], 149: [148],
  150: [1], 151: [150], 152: [5, 150], 153: [64, 152], 154: [23], 155: [154], 156: [], 157: [156],
  158: [1], 159: [17], 160: [29], 161: [], 162: [161], 163: [87], 164: [163], 165: [], 166: [165]
};

// Build the SQL migration
let sql = `-- ==============================================================================
-- Migration: 009_curriculum_reorganization.sql
-- Description: Reorganize curriculum into Phase 1 (Foundations & Placement) and
--              Phase 2 (Advanced CS & Engineering) with prerequisite graph,
--              subject-specific primary languages, and placement preparation tracks.
-- Engine: PostgreSQL 14+
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING
-- ==============================================================================

-- ── 1. Enhance cs_topics with Phase, Stage, Language & Optional flags ─────────
ALTER TABLE cs_topics
    ADD COLUMN IF NOT EXISTS phase INTEGER NOT NULL DEFAULT 1 CHECK (phase IN (1, 2)),
    ADD COLUMN IF NOT EXISTS stage VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS primary_language VARCHAR(30) NOT NULL DEFAULT 'cpp',
    ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cs_topics_phase ON cs_topics (phase);

-- ── 2. Create Topic Prerequisites Junction Table ─────────────────────────────
CREATE TABLE IF NOT EXISTS cs_topic_prerequisites (
    topic_id        INTEGER NOT NULL REFERENCES cs_topics(id) ON DELETE CASCADE,
    prereq_topic_id INTEGER NOT NULL REFERENCES cs_topics(id) ON DELETE CASCADE,
    PRIMARY KEY (topic_id, prereq_topic_id),
    CONSTRAINT chk_no_self_prereq CHECK (topic_id != prereq_topic_id)
);

CREATE INDEX IF NOT EXISTS idx_cs_topic_prereqs_topic  ON cs_topic_prerequisites (topic_id);
CREATE INDEX IF NOT EXISTS idx_cs_topic_prereqs_prereq ON cs_topic_prerequisites (prereq_topic_id);

-- ── 3. Parallel Interview & Placement Preparation Tables ─────────────────────
CREATE TABLE IF NOT EXISTS user_interview_projects (
    id                   SERIAL PRIMARY KEY,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                VARCHAR(255) NOT NULL,
    target_users         TEXT,
    problem_statement    TEXT,
    architecture         TEXT,
    tech_stack           TEXT,
    db_design            TEXT,
    key_decisions        TEXT,
    tradeoffs            TEXT,
    security_notes       TEXT,
    performance_notes    TEXT,
    bugs_resolved        TEXT,
    testing_deployment   TEXT,
    future_improvements  TEXT,
    defense_qa           JSONB DEFAULT '[]'::jsonb,
    is_ready             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_interview_projects_user ON user_interview_projects(user_id);

CREATE TABLE IF NOT EXISTS user_job_applications (
    id                   SERIAL PRIMARY KEY,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company              VARCHAR(255) NOT NULL,
    role                 VARCHAR(255) NOT NULL,
    application_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    status               VARCHAR(50) NOT NULL DEFAULT 'Applied' CHECK (status IN ('Wishlist', 'Applied', 'Online Assessment', 'Technical Interview', 'Behavioral Interview', 'Offer', 'Rejected', 'Withdrawn')),
    eligibility_notes    TEXT,
    interview_date       TIMESTAMPTZ NULL,
    follow_up_notes      TEXT,
    outcome_notes        TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_job_apps_user ON user_job_applications(user_id, status);

CREATE TABLE IF NOT EXISTS user_mock_interviews (
    id                   SERIAL PRIMARY KEY,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interview_type       VARCHAR(50) NOT NULL CHECK (interview_type IN ('dsa', 'core_cs', 'behavioral', 'project_defense')),
    scheduled_at         TIMESTAMPTZ NULL,
    completed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    strengths            TEXT,
    weaknesses           TEXT,
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    technical_rating     INTEGER CHECK (technical_rating BETWEEN 1 AND 5),
    feedback             TEXT,
    revision_topics      TEXT,
    action_items         TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_mock_interviews_user ON user_mock_interviews(user_id);

CREATE TABLE IF NOT EXISTS user_timed_assessments (
    id                   SERIAL PRIMARY KEY,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                VARCHAR(255) NOT NULL,
    duration_minutes     INTEGER NOT NULL DEFAULT 30,
    started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ NULL,
    score                NUMERIC(5,2) DEFAULT 0,
    total_problems       INTEGER NOT NULL DEFAULT 2,
    problems_data        JSONB DEFAULT '[]'::jsonb,
    performance_summary  TEXT,
    feedback             TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_timed_assessments_user ON user_timed_assessments(user_id);

-- ── 4. Seed New Curriculum Topics: Bit Manipulation & Python-to-AI Path ──────
-- Topic 167: Bit Manipulation (Optional specialization in Module 2)
INSERT INTO cs_topics (module_id, section_id, global_seq, section_seq, title, description, objectives, est_minutes, phase, stage, primary_language, is_optional)
SELECT m.id, s.id, 167, 3,
  'Bit Manipulation: Representation, Masks & Problem Solving',
  'Binary representation, bitwise operators (AND, OR, XOR, NOT, shifts), bit masks, setting/clearing/toggling bits, and common interview patterns.',
  'Master bitwise operators, manipulate bit masks, and solve bit manipulation interview problems with O(1) space.',
  60, 1, 'Stage C: Optional Specialization - Bit Manipulation', 'cpp', TRUE
FROM cs_modules m
JOIN cs_sections s ON s.module_id = m.id AND s.seq = 7
WHERE m.seq = 2
ON CONFLICT (global_seq) DO NOTHING;

INSERT INTO cs_topic_checklist_items (topic_id, seq, text)
SELECT t.id, c.seq, c.text
FROM cs_topics t
JOIN (VALUES
  (1, 'Understand two''s complement and binary representation of positive and negative integers'),
  (2, 'Implement set, clear, toggle, and check bit operations using bitwise shifts'),
  (3, 'Solve classic problems: single number via XOR, count set bits (Brian Kernighan), power of two')
) AS c(seq, text) ON TRUE
WHERE t.global_seq = 167
ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 168: Python for Data Work (Module 12)
INSERT INTO cs_topics (module_id, section_id, global_seq, section_seq, title, description, objectives, est_minutes, phase, stage, primary_language, is_optional)
SELECT m.id, s.id, 168, 4,
  'Python for Data Work: NumPy, Pandas & Data Cleaning',
  'Numerical computing with NumPy, DataFrame manipulation with Pandas, data cleaning, exploratory data analysis, and visualization.',
  'Clean and transform tabular datasets, perform vectorized computations, and visualize feature distributions.',
  75, 1, 'Stage 2: Python for Data Work', 'python', FALSE
FROM cs_modules m
JOIN cs_sections s ON s.module_id = m.id AND s.seq = 1
WHERE m.seq = 12
ON CONFLICT (global_seq) DO NOTHING;

INSERT INTO cs_topic_checklist_items (topic_id, seq, text)
SELECT t.id, c.seq, c.text
FROM cs_topics t
JOIN (VALUES
  (1, 'Create and manipulate multi-dimensional arrays and broadcasting operations in NumPy'),
  (2, 'Load, filter, group, and aggregate CSV datasets with Pandas DataFrames'),
  (3, 'Detect and handle missing values, duplicates, and type mismatches in a dataset')
) AS c(seq, text) ON TRUE
WHERE t.global_seq = 168
ON CONFLICT (topic_id, seq) DO NOTHING;

-- Topic 169: Mathematics and Statistics for ML (Module 12)
INSERT INTO cs_topics (module_id, section_id, global_seq, section_seq, title, description, objectives, est_minutes, phase, stage, primary_language, is_optional)
SELECT m.id, s.id, 169, 5,
  'Mathematics & Statistics for Machine Learning',
  'Linear algebra (vectors, matrices), probability distributions, statistics (variance, correlation), calculus intuition, and gradient descent mechanics.',
  'Understand vector transformations, cost functions, gradient descent optimization, and statistical evaluation metrics.',
  90, 1, 'Stage 3: Mathematics and Statistics for ML', 'python', FALSE
FROM cs_modules m
JOIN cs_sections s ON s.module_id = m.id AND s.seq = 1
WHERE m.seq = 12
ON CONFLICT (global_seq) DO NOTHING;

INSERT INTO cs_topic_checklist_items (topic_id, seq, text)
SELECT t.id, c.seq, c.text
FROM cs_topics t
JOIN (VALUES
  (1, 'Compute dot products, matrix multiplications, and vector norms'),
  (2, 'Explain mean, variance, covariance, standard deviation, and normal distribution'),
  (3, 'Trace gradient descent parameter updates using partial derivatives and learning rate')
) AS c(seq, text) ON TRUE
WHERE t.global_seq = 169
ON CONFLICT (topic_id, seq) DO NOTHING;

-- ── 5. Bulk Update Phase, Stage, Language & Optional Metadata ─────────────────
`;

// Build the values for topic updates
const updateRows = [];
for (let gs = 1; gs <= 169; gs++) {
  const phase = phase2GlobalSeqs.has(gs) ? 2 : 1;
  const stage = stageMap[gs] || (phase === 2 ? 'Advanced Topics' : 'Core Topics');
  const lang = getLanguage(gs);
  const isOpt = gs === 167;
  updateRows.push(`  (${gs}, ${phase}, '${stage.replace(/'/g, "''")}', '${lang}', ${isOpt ? 'TRUE' : 'FALSE'})`);
}

sql += `UPDATE cs_topics AS t
SET phase = v.phase,
    stage = v.stage,
    primary_language = v.lang,
    is_optional = v.opt
FROM (VALUES
${updateRows.join(',\n')}
) AS v(gs, phase, stage, lang, opt)
WHERE t.global_seq = v.gs;

-- ── 6. Populate Topic Prerequisites ──────────────────────────────────────────
INSERT INTO cs_topic_prerequisites (topic_id, prereq_topic_id)
SELECT t.id, pt.id
FROM cs_topics t
JOIN (VALUES
`;

const prereqRows = [];
for (const [targetGs, prereqs] of Object.entries(prereqsMap)) {
  for (const p of prereqs) {
    prereqRows.push(`  (${targetGs}, ${p})`);
  }
}

sql += prereqRows.join(',\n') + `
) AS p(target_gs, prereq_gs) ON t.global_seq = p.target_gs
JOIN cs_topics pt ON pt.global_seq = p.prereq_gs
ON CONFLICT (topic_id, prereq_topic_id) DO NOTHING;

-- ── 7. Seed High-Priority Knowledge Assessment Questions ─────────────────────
-- OOP: Topic 41 (Inheritance & Polymorphism)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the mechanism by which C++ resolves virtual function calls at runtime?',
  '["Static binding at compile-time", "vtable (virtual method table) and vptr pointer", "Template specialization", "Inline expansion"]'::jsonb,
  'vtable (virtual method table) and vptr pointer',
  'In C++, runtime polymorphism is achieved through a virtual table (vtable) containing function pointers for virtual methods, and an implicit vptr pointer inside each object instance pointing to its class vtable.',
  'medium'
FROM cs_topics WHERE global_seq = 41 ON CONFLICT (topic_id, seq) DO NOTHING;

INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 2, 'mcq',
  'Which OOP principle states that derived classes must be substitutable for their base classes without altering program correctness?',
  '["Single Responsibility Principle", "Open/Closed Principle", "Liskov Substitution Principle", "Interface Segregation Principle"]'::jsonb,
  'Liskov Substitution Principle',
  'LSP requires that subtype objects should behave in such a way that functions that use pointers or references to base classes can use objects of derived classes without knowing it or breaking expectations.',
  'easy'
FROM cs_topics WHERE global_seq = 41 ON CONFLICT (topic_id, seq) DO NOTHING;

-- DBMS: Topic 49 (Joins)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the result of a LEFT OUTER JOIN when a row in the left table has no matching row in the right table?',
  '["The row from the left table is omitted", "An error is thrown", "The row from the left table is retained with NULL values for right table columns", "A Cartesian product is formed"]'::jsonb,
  'The row from the left table is retained with NULL values for right table columns',
  'LEFT OUTER JOIN retains all records from the left table regardless of whether there is a match in the right table. Unmatched right table attributes evaluate to NULL.',
  'easy'
FROM cs_topics WHERE global_seq = 49 ON CONFLICT (topic_id, seq) DO NOTHING;

-- DBMS: Topic 55 (ACID & Isolation)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'Which transaction isolation level completely prevents dirty reads, non-repeatable reads, and phantom reads?',
  '["Read Uncommitted", "Read Committed", "Repeatable Read", "Serializable"]'::jsonb,
  'Serializable',
  'Serializable is the strictest SQL transaction isolation level, guaranteeing that concurrent transactions produce the same state as if they were executed sequentially.',
  'medium'
FROM cs_topics WHERE global_seq = 55 ON CONFLICT (topic_id, seq) DO NOTHING;

-- OS: Topic 61 (Process Lifecycle & PCB)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'When a process transitions from Running to Ready state, what typically triggered this transition?',
  '["An I/O operation completed", "A timer interrupt signaling time-slice expiration", "The process called wait()", "The process terminated"]'::jsonb,
  'A timer interrupt signaling time-slice expiration',
  'In preemptive multitasking operating systems, when the CPU scheduler allocates a quantum and the timer interrupt fires, the running process is preempted and placed back into the Ready queue.',
  'easy'
FROM cs_topics WHERE global_seq = 61 ON CONFLICT (topic_id, seq) DO NOTHING;

-- OS: Topic 71 (Deadlocks)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'Which of the following is NOT one of Coffman''s four necessary conditions for deadlock?',
  '["Mutual Exclusion", "Hold and Wait", "No Preemption", "Paging and Swapping"]'::jsonb,
  'Paging and Swapping',
  'The 4 Coffman conditions for deadlock are: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. Paging is a virtual memory management mechanism.',
  'easy'
FROM cs_topics WHERE global_seq = 71 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Networks: Topic 76 (TCP Connection & Reliability)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'In the TCP 3-way handshake, what flags are sent in the second packet (from server to client)?',
  '["SYN", "ACK", "SYN-ACK", "FIN-ACK"]'::jsonb,
  'SYN-ACK',
  'The TCP handshake sequence is: 1) Client sends SYN, 2) Server responds with SYN-ACK, 3) Client sends ACK. Data transfer begins thereafter.',
  'easy'
FROM cs_topics WHERE global_seq = 76 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Networks: Topic 79 (HTTP Protocols)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What transport protocol does HTTP/3 use to eliminate Head-of-Line (HoL) blocking at the transport layer?',
  '["TCP over TLS", "UDP with QUIC", "SCTP", "WebSockets"]'::jsonb,
  'UDP with QUIC',
  'HTTP/3 is built on top of QUIC (Quick UDP Internet Connections), which operates over UDP and implements independent multiplexed streams to eliminate TCP head-of-line blocking.',
  'medium'
FROM cs_topics WHERE global_seq = 79 ON CONFLICT (topic_id, seq) DO NOTHING;

-- DSA: Topic 20 (Linked Lists)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the time and auxiliary space complexity of detecting a cycle in a linked list using Floyd''s Tortoise and Hare algorithm?',
  '["O(N) time and O(N) space", "O(N) time and O(1) space", "O(N log N) time and O(1) space", "O(1) time and O(1) space"]'::jsonb,
  'O(N) time and O(1) space',
  'Floyd''s cycle-finding algorithm moves a slow pointer by 1 step and a fast pointer by 2 steps. If a cycle exists, they collide in at most O(N) steps using only two pointers (O(1) auxiliary space).',
  'easy'
FROM cs_topics WHERE global_seq = 20 ON CONFLICT (topic_id, seq) DO NOTHING;

-- DSA: Topic 25 (Graph BFS & DFS)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'Which graph traversal algorithm guarantees finding the shortest path in an unweighted graph?',
  '["Depth-First Search (DFS)", "Breadth-First Search (BFS)", "Preorder Traversal", "Topological Sort"]'::jsonb,
  'Breadth-First Search (BFS)',
  'BFS explores nodes level by level in order of distance from the source node, guaranteeing that the first time an unvisited node is reached, it is via the shortest path in an unweighted graph.',
  'easy'
FROM cs_topics WHERE global_seq = 25 ON CONFLICT (topic_id, seq) DO NOTHING;

-- Backend: Topic 96 (REST Principles)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'Which HTTP method is defined as idempotent according to the RFC HTTP specification?',
  '["POST", "PUT", "PATCH (non-idempotent by default)", "CONNECT"]'::jsonb,
  'PUT',
  'An idempotent HTTP method produces the same side-effect on the server whether executed once or multiple times. GET, PUT, and DELETE are idempotent; POST is not.',
  'medium'
FROM cs_topics WHERE global_seq = 96 ON CONFLICT (topic_id, seq) DO NOTHING;

-- AI/ML: Topic 140 (ML Paradigms)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'Which machine learning paradigm learns an optimal policy through trial-and-error by receiving rewards and penalties from an environment?',
  '["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Self-Supervised Contrastive Learning"]'::jsonb,
  'Reinforcement Learning',
  'Reinforcement learning trains an agent to make a sequence of decisions by interacting with an environment to maximize cumulative reward signals.',
  'easy'
FROM cs_topics WHERE global_seq = 140 ON CONFLICT (topic_id, seq) DO NOTHING;

-- AI/ML: Topic 147 (Prompt Engineering & RAG)
INSERT INTO cs_assessment_questions (topic_id, seq, question_type, question_text, options, correct_answer, explanation, difficulty)
SELECT id, 1, 'mcq',
  'What is the primary benefit of Retrieval-Augmented Generation (RAG) over relying strictly on an LLM''s parametric memory?',
  '["It trains the model weights faster", "It grounds responses in current external factual documents, drastically reducing hallucinations", "It eliminates the need for vector embeddings", "It removes the context window token limit"]'::jsonb,
  'It grounds responses in current external factual documents, drastically reducing hallucinations',
  'RAG retrieves relevant external text chunks from a knowledge store or vector database at query time and injects them into the prompt, grounding the LLM in verifiable factual evidence.',
  'easy'
FROM cs_topics WHERE global_seq = 147 ON CONFLICT (topic_id, seq) DO NOTHING;
`;

fs.writeFileSync('db/migrations/009_curriculum_reorganization.sql', sql, 'utf8');
console.log('✅ Generated db/migrations/009_curriculum_reorganization.sql successfully!');
