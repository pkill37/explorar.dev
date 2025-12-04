# JAX: Composable Transformations for Array Programming In The Mind

## Understanding JAX Before Computing

> This isn't just a guide to using JAX. It's an effort to understand how functional programming revolutionizes numerical computing.

JAX is Google's library for high-performance numerical computing that combines NumPy's familiar API with composable function transformations: `grad` (automatic differentiation), `jit` (just-in-time compilation), `vmap` (automatic vectorization), and `pmap` (parallelization). Unlike PyTorch's object-oriented approach, JAX embraces functional programming: pure functions, immutability, and composable transformations.

Understanding JAX means understanding how pure functions enable powerful optimizations, how XLA compilation achieves peak performance, how automatic differentiation works through program transformations, and how functional design enables research at scale.

**JAX makes numerical computing composable. Let's understand how it works.**

---

## Learning Path for JAX Mastery

This guide follows a structured learning path designed to build functional programming expertise for ML:

### Beginner Path (Weeks 1-4)

1. **NumPy Equivalence**: Learn JAX's NumPy-compatible API
2. **Pure Functions**: Understand functional programming constraints
3. **grad**: Automatic differentiation basics
4. **jit**: Just-in-time compilation fundamentals

**Practical Start:**

```python
import jax
import jax.numpy as jnp

# Pure function (no side effects)
def f(x):
    return x ** 2

# Automatic differentiation
grad_f = jax.grad(f)
print(grad_f(3.0))  # 6.0 (derivative of x²)

# JIT compilation
fast_f = jax.jit(f)
result = fast_f(jnp.array([1.0, 2.0, 3.0]))
```

### Intermediate Path (Months 2-3)

1. **vmap and Batching**: Automatic vectorization
2. **PyTrees**: Nested data structures
3. **Advanced grad**: Jacobians, Hessians, custom gradients
4. **Pseudo-randomness**: JAX's PRNG system

**Key Projects:**

- Implement neural network from scratch
- Use vmap for per-example gradients
- Build custom optimizers
- Understand XLA compilation

### Advanced Path (Months 4-6)

1. **pmap**: Multi-device parallelization
2. **Custom JVP/VJP**: Define custom derivatives
3. **XLA Internals**: Understanding compilation
4. **Advanced Transformations**: Combining grad, jit, vmap

**Advanced Projects:**

- Distributed training on TPUs
- Custom CUDA kernels via JAX
- Implement research papers
- Build production ML systems

### Expert Path (Months 7+)

1. **JAX Internals**: Tracer system, Jaxpr IR
2. **Contributing**: Submit PRs to JAX/Flax/Optax
3. **Compiler Optimization**: XLA optimization strategies
4. **Research**: Novel transformation compositions

---

## Chapter 1 — JAX Philosophy and Architecture

### The Functional Paradigm

JAX enforces functional programming principles:

**1. Pure Functions (No Side Effects):**

```python
# Good: Pure function
def pure_add(x, y):
    return x + y

# Bad: Side effects
counter = 0
def impure_add(x, y):
    global counter
    counter += 1  # Side effect!
    return x + y

# JAX transformations require purity
jax.jit(pure_add)     # ✓ Works
jax.jit(impure_add)   # ✗ Undefined behavior
```

**2. Immutability:**

```python
# NumPy: In-place updates
x = np.array([1, 2, 3])
x[0] = 10  # Mutates x

# JAX: Functional updates
x = jnp.array([1, 2, 3])
x_new = x.at[0].set(10)  # Returns new array
# x is unchanged, x_new has the update
```

**3. Explicit State:**

```python
# Random numbers require explicit state
key = jax.random.PRNGKey(0)
x = jax.random.normal(key, (1000,))

# Split key for next random operation
key, subkey = jax.random.split(key)
y = jax.random.normal(subkey, (1000,))
```

### The Transformation Pipeline

JAX's power comes from composable transformations:

```
Python Function
    ↓
grad (differentiation)
    ↓
jit (compilation)
    ↓
vmap (vectorization)
    ↓
pmap (parallelization)
    ↓
XLA (execution)
```

**Example: Composing Transformations:**

```python
def loss_fn(params, x, y):
    pred = params['w'] @ x + params['b']
    return jnp.mean((pred - y) ** 2)

# Compute gradient
grad_fn = jax.grad(loss_fn)

# Vectorize over batch
batch_grad_fn = jax.vmap(grad_fn, in_axes=(None, 0, 0))

# Compile for speed
fast_batch_grad_fn = jax.jit(batch_grad_fn)

# Parallelize across devices
parallel_grad_fn = jax.pmap(fast_batch_grad_fn)
```

### Core Architecture

**Layer Structure:**

```
Python API (jax.numpy, jax.scipy, etc.)
    ↓
Transformation Layer (grad, jit, vmap, pmap)
    ↓
Tracing (builds Jaxpr intermediate representation)
    ↓
XLA Compiler (optimizes and generates code)
    ↓
Hardware (CPU, GPU, TPU)
```

**Component Breakdown:**

**1. Tracers**

When JAX transforms a function, it uses tracers to record operations:

```python
# When you call jax.jit(f)
def f(x):
    return x * 2 + 1

# JAX replaces x with a Tracer
# Records operations: mul(x, 2), add(temp, 1)
# Builds Jaxpr (JAX expression)
```

**2. Jaxpr (JAX Expression)**

Intermediate representation of JAX programs:

```python
from jax import make_jaxpr

def f(x):
    return x ** 2 + 1

# View Jaxpr
jaxpr = make_jaxpr(f)(3.0)
print(jaxpr)

# Output:
# { lambda  ; a.
#   let b = pow a 2.0
#       c = add b 1.0
#   in (c,) }
```

**3. XLA (Accelerated Linear Algebra)**

Google's domain-specific compiler:

- **Fuses operations**: Combine multiple ops into single kernel
- **Memory optimization**: Minimize allocations
- **Hardware-specific**: Generates optimized code for CPU/GPU/TPU
- **Ahead-of-time**: Compiles before execution

---

## Chapter 2 — Automatic Differentiation with grad

### Forward and Reverse Mode AD

JAX supports both forward and reverse-mode differentiation:

**Reverse Mode (grad - for many inputs, few outputs):**

```python
def f(x):
    return jnp.sum(x ** 2)

# Compute gradient
grad_f = jax.grad(f)
x = jnp.array([1.0, 2.0, 3.0])
dx = grad_f(x)  # [2.0, 4.0, 6.0]

# Reverse mode: O(1) backprop regardless of input size
# Efficient for loss functions (1 output, many inputs)
```

**Forward Mode (jvp - for few inputs, many outputs):**

```python
from jax import jvp

def f(x):
    return jnp.array([x**2, x**3, x**4])

# Jacobian-vector product
primals = (3.0,)
tangents = (1.0,)
primal_out, tangent_out = jvp(f, primals, tangents)
# tangent_out = Jacobian @ tangents
```

### Computing Higher-Order Derivatives

**Second Derivatives (Hessian):**

```python
# Function
def f(x):
    return jnp.sum(x ** 4)

# First derivative
grad_f = jax.grad(f)

# Second derivative
hess_f = jax.grad(grad_f)

x = jnp.array([1.0, 2.0])
print(hess_f(x))  # [12.0, 96.0] = 12x²
```

**Hessian Matrix:**

```python
from jax import hessian

def f(x):
    return x[0]**2 + x[1]**3

H = hessian(f)(jnp.array([1.0, 2.0]))
# H[i,j] = ∂²f/∂xi∂xj
```

### Custom Derivatives

**Define custom gradients:**

```python
from jax import custom_jvp

@custom_jvp
def clip_gradient(x, max_norm):
    return x  # Forward pass: identity

@clip_gradient.defjvp
def clip_gradient_jvp(primals, tangents):
    x, max_norm = primals
    x_dot, _ = tangents

    # Clip gradient
    norm = jnp.linalg.norm(x_dot)
    factor = jnp.minimum(1.0, max_norm / norm)

    return x, x_dot * factor
```

**Custom VJP (Vector-Jacobian Product):**

```python
from jax import custom_vjp

@custom_vjp
def f(x):
    return x ** 2

def f_fwd(x):
    return f(x), x  # Forward + save for backward

def f_bwd(x, g):
    # Custom gradient computation
    return (2 * x * g,)  # Return gradient for each input

f.defvjp(f_fwd, f_bwd)
```

---

## Chapter 3 — JIT Compilation with jax.jit

### How JIT Works

**Just-in-Time Compilation:**

```python
def slow_fn(x):
    return jnp.sum(x ** 2)

# Compile with JIT
fast_fn = jax.jit(slow_fn)

# First call: trace and compile
result = fast_fn(x)  # Slow (compilation overhead)

# Subsequent calls: use compiled code
result = fast_fn(x)  # Fast!
```

**What Happens During JIT:**

1. **Tracing**: JAX replaces inputs with tracers
2. **Build Jaxpr**: Records operations in IR
3. **XLA Compilation**: Compiles Jaxpr to optimized code
4. **Caching**: Stores compiled function
5. **Execution**: Runs compiled code

**Example Optimization:**

```python
def compute(x):
    a = x + 1
    b = x + 2
    c = a + b
    return c

# Without JIT: 3 separate operations
# With JIT: Fused into single kernel
# Kernel: c = (x + 1) + (x + 2) = 2*x + 3
```

### Static vs Traced Arguments

**Traced Arguments:**

```python
@jax.jit
def f(x, y):
    return x + y

# x and y are traced
# Function recompiles if shapes change
```

**Static Arguments:**

```python
@partial(jax.jit, static_argnums=(1,))
def f(x, n):
    for i in range(n):  # n must be static
        x = x * 2
    return x

# n is not traced (Python int)
# Different n values trigger recompilation
```

### Donation and Memory Efficiency

```python
# Donate buffers (in-place updates)
@partial(jax.jit, donate_argnums=(0,))
def update(x, delta):
    return x + delta  # Can reuse x's buffer

# Memory efficient for large arrays
```

---

## Chapter 4 — Automatic Vectorization with vmap

### Vectorizing Over Batches

**Manual Batching:**

```python
def f(x):
    return x ** 2

# Compute for batch manually
X = jnp.array([[1, 2], [3, 4], [5, 6]])
results = jnp.array([f(x) for x in X])  # Slow!
```

**Automatic Vectorization:**

```python
# vmap automatically vectorizes
batch_f = jax.vmap(f)
results = batch_f(X)  # Fast! Single operation
```

### Controlling Vectorization Axes

```python
# vmap with axis specification
def matmul(A, x):
    return A @ x

# A: (batch, n, n)
# x: (batch, n)
# Want: batch of matrix-vector products

batch_matmul = jax.vmap(matmul)
# Automatically handles batch dimension
```

**Custom Axes:**

```python
# Different batch axes
def f(x, y):
    return x + y

# x has batch on axis 0, y on axis 1
vmap_f = jax.vmap(f, in_axes=(0, 1), out_axes=0)
```

### Per-Example Gradients

**Extremely powerful for ML:**

```python
def loss_fn(params, x, y):
    pred = apply_model(params, x)
    return jnp.mean((pred - y) ** 2)

# Gradient over batch (usual)
grad_fn = jax.grad(loss_fn)

# Per-example gradients
per_example_grads = jax.vmap(
    grad_fn,
    in_axes=(None, 0, 0)  # params shared, x and y batched
)

# Useful for:
# - Privacy (DP-SGD)
# - Influence functions
# - Meta-learning
```

### Combining vmap and jit

```python
# Compose transformations
@jax.jit
@partial(jax.vmap, in_axes=(None, 0))
def batch_apply(params, x):
    return apply_model(params, x)

# JIT compilation happens once for vectorized version
```

---

## Chapter 5 — Parallel Computation with pmap

### Multi-Device Parallelization

**Distribute across GPUs/TPUs:**

```python
# Parallelize function across devices
@jax.pmap
def parallel_fn(x):
    return x * 2

# Input shape: (num_devices, ...)
x = jnp.arange(8).reshape(4, 2)  # 4 devices, 2 elements each
result = parallel_fn(x)

# Each device processes its shard
```

### Data Parallelism

**Typical training setup:**

```python
# Replicate params across devices, shard data
@partial(jax.pmap, axis_name='batch')
def update(params, x, y):
    # Compute gradients on local data
    grads = jax.grad(loss_fn)(params, x, y)

    # Average gradients across devices
    grads = jax.lax.pmean(grads, axis_name='batch')

    # Update parameters
    return params - 0.01 * grads

# params: replicated
# x, y: sharded across devices
```

### Collective Operations

```python
# Reduce across devices
@jax.pmap
def reduce_sum(x):
    return jax.lax.psum(x, axis_name='devices')

# Gather from all devices
@jax.pmap
def allgather(x):
    return jax.lax.all_gather(x, axis_name='devices')
```

---

## Chapter 6 — Random Number Generation

### Functional PRNG

JAX uses a functional approach to randomness:

```python
# Create key
key = jax.random.PRNGKey(42)

# Generate random numbers
x = jax.random.normal(key, (1000,))

# Key is "consumed" - must split for next use
key, subkey = jax.random.split(key)
y = jax.random.normal(subkey, (1000,))

# Or split into multiple keys
keys = jax.random.split(key, num=10)
```

**Why Explicit Keys?**

1. **Reproducibility**: Same key → same results
2. **Parallelism**: Independent keys for parallel RNG
3. **No global state**: Functional purity

**Counter-Based PRNG:**

```python
# JAX uses Threefry counter-based RNG
# Key = (counter, seed)
# Fast, parallel, reproducible

# Internal (simplified):
def prng_internal(key):
    counter, seed = key
    return threefry_hash(counter, seed)
```

---

## Chapter 7 — PyTrees and Nested Structures

### What Are PyTrees?

PyTrees are JAX's way of handling nested structures:

```python
# PyTree: nested dict/list/tuple of arrays
params = {
    'layer1': {'w': jnp.array(...), 'b': jnp.array(...)},
    'layer2': {'w': jnp.array(...), 'b': jnp.array(...)}
}

# JAX functions work on PyTrees
grads = jax.grad(loss_fn)(params)
# grads has same structure as params
```

### Tree Operations

**Map over PyTree:**

```python
from jax import tree_map

# Apply function to all leaves
scaled_params = tree_map(lambda x: x * 0.9, params)

# Element-wise operations
new_params = tree_map(lambda p, g: p - 0.01 * g, params, grads)
```

**Flatten and Unflatten:**

```python
from jax.tree_util import tree_flatten, tree_unflatten

# Flatten to list
flat, tree_def = tree_flatten(params)
# flat: [w1, b1, w2, b2]
# tree_def: structure information

# Reconstruct
params_reconstructed = tree_unflatten(tree_def, flat)
```

### Custom PyTree Classes

```python
from jax.tree_util import register_pytree_node

class Model:
    def __init__(self, w, b):
        self.w = w
        self.b = b

# Register as PyTree
def model_flatten(model):
    return (model.w, model.b), None

def model_unflatten(aux, children):
    return Model(*children)

register_pytree_node(Model, model_flatten, model_unflatten)

# Now Model instances work with JAX transformations
model = Model(jnp.array([1, 2]), jnp.array([3]))
grads = jax.grad(loss_fn)(model)
```

---

## Chapter 8 — Building Neural Networks

### Flax: JAX Neural Network Library

```python
import flax.linen as nn

class MLP(nn.Module):
    hidden_dim: int
    output_dim: int

    @nn.compact
    def __call__(self, x):
        x = nn.Dense(self.hidden_dim)(x)
        x = nn.relu(x)
        x = nn.Dense(self.output_dim)(x)
        return x

# Create model
model = MLP(hidden_dim=128, output_dim=10)

# Initialize parameters
key = jax.random.PRNGKey(0)
params = model.init(key, jnp.ones((1, 784)))

# Forward pass
y = model.apply(params, x)
```

### Custom Layers

```python
class CustomLayer(nn.Module):
    out_dim: int

    @nn.compact
    def __call__(self, x):
        # Define parameters
        w = self.param('w',
                      nn.initializers.glorot_normal(),
                      (x.shape[-1], self.out_dim))
        b = self.param('b',
                      nn.initializers.zeros,
                      (self.out_dim,))

        return x @ w + b
```

### Training Loop

```python
import optax  # JAX optimization library

# Loss function
def loss_fn(params, x, y):
    logits = model.apply(params, x)
    return optax.softmax_cross_entropy_with_integer_labels(logits, y).mean()

# Create optimizer
optimizer = optax.adam(learning_rate=0.001)
opt_state = optimizer.init(params)

# Training step
@jax.jit
def train_step(params, opt_state, x, y):
    loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
    updates, opt_state = optimizer.update(grads, opt_state)
    params = optax.apply_updates(params, updates)
    return params, opt_state, loss

# Training loop
for epoch in range(num_epochs):
    for x_batch, y_batch in dataloader:
        params, opt_state, loss = train_step(params, opt_state, x_batch, y_batch)
```

---

## Chapter 9 — JAX Internals

### The Tracer System

**How JAX Traces Functions:**

```python
# When you call jax.jit(f)
# JAX creates Tracer objects

class Tracer:
    def __init__(self, aval):
        self.aval = aval  # Abstract value (shape, dtype)

    def __add__(self, other):
        # Record operation in Jaxpr
        return bind_operation(add_p, self, other)
```

**Abstract Values:**

```python
from jax.core import ShapedArray

# Abstract representation of array
aval = ShapedArray(shape=(10, 20), dtype=jnp.float32)
# No actual data, just shape/dtype info
```

### Jaxpr (JAX Expression)

**Intermediate Representation:**

```python
from jax import make_jaxpr

def f(x, y):
    temp = x * 2
    return temp + y

jaxpr = make_jaxpr(f)(3.0, 4.0)
print(jaxpr)

# Output:
# { lambda  ; a b.
#   let c = mul a 2.0
#       d = add c b
#   in (d,) }
```

**Jaxpr Structure:**

- **Variables**: a, b, c, d (SSA form)
- **Primitives**: mul, add (operations)
- **Equations**: c = mul a 2.0 (assignments)

### XLA Compilation

**XLA (Accelerated Linear Algebra):**

```
Jaxpr → HLO (High-Level Operations)
    ↓
HLO Optimizations (fusion, layout, etc.)
    ↓
LLVM IR or GPU code
    ↓
Native code (CPU/GPU/TPU)
```

**Key Optimizations:**

1. **Operator Fusion**: Combine multiple ops
2. **Layout Optimization**: Choose memory layouts
3. **Constant Folding**: Compute constants at compile time
4. **Buffer Allocation**: Minimize memory usage

---

## References

### Official Resources

- [JAX Documentation](https://jax.readthedocs.io/)
- [JAX GitHub](https://github.com/google/jax)
- [JAX Reference Documentation](https://jax.readthedocs.io/en/latest/jax.html)

### Ecosystem

- [Flax](https://github.com/google/flax) - Neural network library
- [Optax](https://github.com/deepmind/optax) - Gradient processing and optimization
- [Haiku](https://github.com/deepmind/dm-haiku) - DeepMind's NN library
- [RLax](https://github.com/deepmind/rlax) - RL building blocks

### Learning

- [JAX Quickstart](https://jax.readthedocs.io/en/latest/notebooks/quickstart.html)
- [Autodiff Cookbook](https://jax.readthedocs.io/en/latest/notebooks/autodiff_cookbook.html)
- [Common Gotchas](https://jax.readthedocs.io/en/latest/notebooks/Common_Gotchas_in_JAX.html)

---

_JAX proves that functional programming and numerical computing are a perfect match. Master transformations, master ML._
