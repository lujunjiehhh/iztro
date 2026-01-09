## 2024-05-23 - Recursion in Hot Paths
**Learning:** The utility function `fixIndex` was implemented recursively to handle index wrapping. While elegant for small offsets, it caused stack overflows for large inputs and had O(N) complexity. Replacing it with `((index % max) + max) % max` provided O(1) performance and safety.
**Action:** Always prefer mathematical solutions (modulo arithmetic) over recursion for cyclic indexing or simple clamping, especially in utility functions used in core loops.
