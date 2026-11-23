-- ==============================================================================
-- Migration: 002_seed_topics.sql
-- Description: Seed predefined common Data Structures & Algorithms topics
-- ==============================================================================

INSERT INTO topics (name)
VALUES
    ('Array'),
    ('String'),
    ('Hash Map'),
    ('Two Pointers'),
    ('Sliding Window'),
    ('Stack'),
    ('Queue'),
    ('Linked List'),
    ('Tree'),
    ('Binary Search Tree'),
    ('BFS'),
    ('DFS'),
    ('Backtracking'),
    ('Dynamic Programming'),
    ('Greedy'),
    ('Binary Search'),
    ('Heap'),
    ('Graph'),
    ('Trie'),
    ('Divide & Conquer'),
    ('Union Find'),
    ('Segment Tree'),
    ('Bit Manipulation'),
    ('Math'),
    ('Design'),
    ('Recursion'),
    ('Matrix'),
    ('Sorting'),
    ('Monotonic Stack'),
    ('Prefix Sum'),
    ('Kadane''s Algorithm'),
    ('Doubly Linked List')
ON CONFLICT (name) DO NOTHING;
