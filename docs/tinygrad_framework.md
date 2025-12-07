# TinyGrad: A Deep Learning Framework In The Mind

## Understanding TinyGrad Before Coding

> This isn't just a guide to using TinyGrad. It's an effort to understand how deep learning frameworks work from first principles.

TinyGrad is a minimalist deep learning framework that implements the core concepts of PyTorch and JAX in approximately 1,000 lines of Python. Created by George Hotz, it's designed to be simple enough to understand completely while powerful enough to train real models. TinyGrad's philosophy: if you can't understand the entire framework, you don't really understand deep learning.

Understanding TinyGrad means understanding automatic differentiation, lazy evaluation, computational graphs, GPU acceleration, and optimization—all without the complexity of production frameworks.

**TinyGrad makes deep learning transparent. Let's understand how it works.**

---

## Learning Path for TinyGrad Mastery

This guide follows a structured learning path designed to understand deep learning from scratch:

### Beginner Path (Weeks 1-2)

1. **Read the Source**: TinyGrad is ~1000 lines—read it all
2. **Tensor Basics**: Understand the Tensor class
3. **Operations**: Study how ops are implemented
4. **Autograd**: Trace gradient computation manually

**Practical Start:**

```python
from tinygrad.tensor import Tensor

# Create tensors
x = Tensor([1.0, 2.0, 3.0])
y = Tensor([4.0, 5.0, 6.0])

# Operations build a computation graph
z = (x * y).sum()

# Backward computes gradients
z.backward()
print(x.grad)  # Gradient of z w.r.t. x
```

### Intermediate Path (Weeks 3-4)

1. **LazyBuffer**: Understand lazy evaluation
2. **Ops**: Study low-level operations (BinaryOps, ReduceOps)
3. **Accelerators**: Learn GPU/Metal/WebGPU backends
4. **Shape Tracker**: Master broadcasting and reshaping

**Key Projects:**

- Implement a custom operation
- Add a new backend
- Build a simple neural network
- Trace execution graph manually

### Advanced Path (Months 2-3)

1. **Kernel Generation**: Study ShapeTracker and Kernel codegen
2. **Optimization**: Understand kernel fusion and scheduling
3. **JIT Compilation**: Learn the JIT decorator
4. **Production Models**: Train ResNet, GPT, etc.

**Advanced Projects:**

- Write custom CUDA kernels
- Implement transformer from scratch
- Optimize model for specific hardware
- Contribute to TinyGrad

### Expert Path (Months 4+)

1. **Compiler Design**: Deep dive into IR and code generation
2. **New Backends**: Add support for new hardware
3. **Research**: Implement novel optimizations
4. **Teaching**: Explain TinyGrad to others

---

## Chapter 1 — TinyGrad Architecture

### The Four-Layer Design

TinyGrad has a beautifully simple architecture:

```
Tensor (High-level API)
    ↓
LazyBuffer (Lazy evaluation)
    ↓
Ops (Low-level operations)
    ↓
Accelerators (Hardware backends: CPU, GPU, Metal, etc.)
```

**Component Breakdown:**

**1. Tensor Layer**

The user-facing API:

```python
class Tensor:
    def __init__(self, data, requires_grad=False):
        self.lazydata = LazyBuffer.fromCPU(data)
        self.grad = None
        self.requires_grad = requires_grad

    def backward(self):
        # Build gradient graph and execute
        pass

    # Operations: +, -, *, /, @, etc.
    def __add__(self, other): return self.add(other)
    def __mul__(self, other): return self.mul(other)
```

**2. LazyBuffer Layer**

Defers execution until absolutely necessary:

```python
class LazyBuffer:
    def __init__(self, op, srcs=None):
        self.op = op      # Operation to perform
        self.srcs = srcs  # Input LazyBuffers
        self.realized = None  # Actual data (when computed)

    def realize(self):
        # Execute the deferred computation
        if self.realized is None:
            # Recursively realize inputs
            inputs = [x.realize() for x in self.srcs]
            # Execute operation
            self.realized = self.op.exec(inputs)
        return self.realized
```

**3. Ops Layer**

Low-level operations:

```python
class Op:
    pass

class UnaryOps(Op):
    NOOP, EXP, LOG, NEG, RELU = range(5)

class BinaryOps(Op):
    ADD, SUB, MUL, DIV, POW, CMPEQ = range(6)

class ReduceOps(Op):
    SUM, MAX = range(2)

class MovementOps(Op):
    RESHAPE, PERMUTE, EXPAND, PAD, SHRINK, STRIDE = range(6)
```

**4. Accelerator Layer**

Hardware-specific implementations:

```python
class Device:
    CPU, GPU, METAL, WEBGPU, LLVM, CUDA = range(6)

# Example: CPU backend
class CPU:
    @staticmethod
    def exec(op, inputs):
        if op == BinaryOps.ADD:
            return inputs[0] + inputs[1]
        elif op == BinaryOps.MUL:
            return inputs[0] * inputs[1]
        # ... etc
```

### Core Concepts Deep Dive

**1. Lazy Evaluation**

Operations aren't executed immediately:

```python
# These don't compute anything yet
x = Tensor([1.0, 2.0, 3.0])
y = Tensor([4.0, 5.0, 6.0])
z = x * y + x

# Computation graph built so far:
# z.lazydata.op = BinaryOps.ADD
# z.lazydata.srcs = [
#     LazyBuffer(BinaryOps.MUL, [x.lazydata, y.lazydata]),
#     x.lazydata
# ]

# Only realizes when needed
result = z.numpy()  # Triggers execution
```

**Why Lazy Evaluation?**

1. **Kernel Fusion**: Combine multiple ops into one GPU kernel
2. **Dead Code Elimination**: Skip unused computations
3. **Memory Efficiency**: Don't materialize intermediate results

**2. Shape Tracking**

ShapeTracker handles all shape manipulations without moving data:

```python
class ShapeTracker:
    def __init__(self, shape):
        self.views = [View(shape, strides_for_shape(shape))]

    def reshape(self, new_shape):
        # Change interpretation without copying data
        self.views.append(View(new_shape, ...))

    def permute(self, order):
        # Transpose by changing strides
        self.views.append(View(...))

# Example: Transpose without copying
x = Tensor.rand(100, 200)
y = x.T  # No data movement!
# y.lazydata.st shows different view of same data
```

**3. Automatic Differentiation**

Reverse-mode autodiff (backpropagation):

```python
# Forward pass
x = Tensor([2.0], requires_grad=True)
y = x * x * x  # y = x³

# Build computation graph
# y.lazydata.op = BinaryOps.MUL
# y.lazydata.srcs = [
#     LazyBuffer(BinaryOps.MUL, [x, x]),  # x²
#     x
# ]

# Backward pass
y.backward()

# Gradient computation:
# dy/dx = 3x² = 3 * 4 = 12
print(x.grad.numpy())  # [12.0]
```

**How Backward Works:**

```python
def backward(self):
    # Topological sort of computation graph
    topo = []
    visited = set()

    def build_topo(node):
        if node not in visited:
            visited.add(node)
            for parent in node._ctx.parents:
                build_topo(parent)
            topo.append(node)

    build_topo(self)

    # Initialize gradient
    self.grad = Tensor(np.ones_like(self.data))

    # Reverse pass
    for node in reversed(topo):
        if node._ctx:
            grads = node._ctx.backward(node.grad.data)
            for parent, grad in zip(node._ctx.parents, grads):
                parent.grad = (parent.grad + grad) if parent.grad else grad
```

---

## Chapter 2 — The LazyBuffer: TinyGrad's Secret Weapon

### Deferred Execution

LazyBuffer is the key to TinyGrad's performance:

```python
# Without LazyBuffer (eager execution):
x = np.array([1, 2, 3])
y = x + 1       # GPU kernel 1
z = y * 2       # GPU kernel 2
w = z + 3       # GPU kernel 3
# 3 separate GPU kernel launches!

# With LazyBuffer (lazy execution):
x = Tensor([1, 2, 3])
y = x + 1       # Build graph node
z = y * 2       # Build graph node
w = z + 3       # Build graph node
result = w.numpy()  # Single fused kernel!
# Combined into: (((x + 1) * 2) + 3)
```

### The LazyBuffer Structure

```python
class LazyBuffer:
    def __init__(self, device, st, op, srcs):
        self.device = device         # CPU/GPU/etc.
        self.st = st                 # ShapeTracker
        self.op = op                 # Operation
        self.srcs = srcs            # Input LazyBuffers
        self.realized = None        # Materialized result
        self._base = None

    def schedule(self):
        # Generate execution schedule
        # Returns list of operations to execute
        pass

    def realize(self):
        # Execute scheduled operations
        if self.realized: return self.realized

        # Get schedule
        schedule = self.schedule()

        # Execute each operation
        for op in schedule:
            op.exec()

        return self.realized
```

### Kernel Fusion Example

```python
# Three operations
x = Tensor.rand(1000)
y = x.relu()        # max(x, 0)
z = y * 2           # scale
w = z.sum()         # reduce

# Without fusion: 3 kernels
# Kernel 1: max(x, 0)
# Kernel 2: y * 2
# Kernel 3: sum(z)

# With fusion: 1 kernel (up to reduce)
# Kernel 1: sum(max(x, 0) * 2)
# Kernel 2: final reduction

# Generated kernel (pseudocode):
# for i in range(1000):
#     temp = max(x[i], 0) * 2
#     acc += temp
```

---

## Chapter 3 — Operations and the Computational Graph

### Operation Types

TinyGrad has 4 operation categories:

**1. UnaryOps (Element-wise, single input):**

```python
class UnaryOps:
    NOOP = 0    # No operation
    EXP = 1     # Exponential
    LOG = 2     # Natural log
    CAST = 3    # Type cast
    NEG = 4     # Negate
    SIN = 5     # Sine
    RELU = 6    # max(x, 0)

# Usage
x = Tensor([1.0, 2.0, 3.0])
y = x.exp()  # e^x
```

**2. BinaryOps (Element-wise, two inputs):**

```python
class BinaryOps:
    ADD = 0     # Addition
    SUB = 1     # Subtraction
    MUL = 2     # Multiplication
    DIV = 3     # Division
    POW = 4     # Power
    CMPEQ = 5   # Comparison

# Usage
x = Tensor([1, 2, 3])
y = Tensor([4, 5, 6])
z = x + y  # BinaryOps.ADD
```

**3. ReduceOps (Reduce dimensions):**

```python
class ReduceOps:
    SUM = 0     # Summation
    MAX = 1     # Maximum

# Usage
x = Tensor([[1, 2], [3, 4]])
y = x.sum(axis=0)  # [4, 6]
z = x.sum()        # 10
```

**4. MovementOps (Change shape/view):**

```python
class MovementOps:
    RESHAPE = 0    # Change shape
    PERMUTE = 1    # Transpose axes
    EXPAND = 2     # Broadcast
    PAD = 3        # Add padding
    SHRINK = 4     # Crop
    STRIDE = 5     # Take every nth element

# Usage
x = Tensor.rand(10, 20)
y = x.reshape(20, 10)
z = x.T  # Permute([1, 0])
```

### Building the Computation Graph

```python
# Example: f(x) = (x + 2) * 3

x = Tensor([1.0], requires_grad=True)

# Step 1: x + 2
temp1 = x + 2
# temp1.lazydata.op = BinaryOps.ADD
# temp1.lazydata.srcs = [x.lazydata, Tensor([2.0]).lazydata]

# Step 2: temp1 * 3
y = temp1 * 3
# y.lazydata.op = BinaryOps.MUL
# y.lazydata.srcs = [temp1.lazydata, Tensor([3.0]).lazydata]

# Computation graph:
#     y
#     |
#    MUL (×3)
#     |
#   ADD (+2)
#     |
#     x

# Backward pass
y.backward()

# Gradient computation:
# dy/dx = 3  (derivative of (x+2)*3 is just 3)
print(x.grad)  # [3.0]
```

---

## Chapter 4 — Hardware Acceleration

### Device Abstraction

TinyGrad supports multiple backends through a unified interface:

```python
# Available devices
from tinygrad.runtime.lib import Device

Device.DEFAULT = "GPU"  # or "CPU", "METAL", "CUDA", etc.

# Create tensors on different devices
x_cpu = Tensor([1, 2, 3], device="CPU")
x_gpu = Tensor([1, 2, 3], device="GPU")

# Operations stay on same device
y_gpu = x_gpu * 2  # Executes on GPU
```

### The Compiled Runtime

TinyGrad compiles operations to native code:

```python
# For GPU (OpenCL/CUDA):
# 1. Generate kernel code
kernel_code = """
__kernel void add(__global float* a, __global float* b, __global float* c) {
    int idx = get_global_id(0);
    c[idx] = a[idx] + b[idx];
}
"""

# 2. Compile kernel
program = compile(kernel_code)

# 3. Execute
program.run(global_size=(n,), local_size=(256,))
```

**Code Generation Example:**

```python
# TinyGrad operation
x = Tensor.rand(1000)
y = (x * 2 + 1).relu()

# Generated GPU kernel (simplified):
__kernel void fused_kernel(__global float* x, __global float* out) {
    int idx = get_global_id(0);
    float temp = x[idx] * 2.0f + 1.0f;
    out[idx] = max(temp, 0.0f);
}
```

### Accelerator Backends

**1. CPU Backend:**

```python
# Uses NumPy for CPU execution
class CPU:
    @staticmethod
    def exec(op, inputs):
        if op == BinaryOps.ADD:
            return np.add(*inputs)
        elif op == UnaryOps.EXP:
            return np.exp(inputs[0])
        # ...
```

**2. GPU Backend (OpenCL):**

```python
class GPU:
    @staticmethod
    def exec(op, inputs):
        # Compile and run OpenCL kernel
        kernel_code = generate_kernel(op)
        program = cl.Program(kernel_code).build()
        program.run(*inputs)
```

**3. Metal Backend (Apple Silicon):**

```python
class METAL:
    @staticmethod
    def exec(op, inputs):
        # Compile and run Metal shader
        kernel_code = generate_metal_kernel(op)
        # Use Metal API...
```

---

## Chapter 5 — Building Neural Networks in TinyGrad

### The nn Module

TinyGrad provides a minimal nn module:

```python
from tinygrad.nn import Linear, Conv2d

class SimpleNet:
    def __init__(self):
        self.l1 = Linear(784, 128)
        self.l2 = Linear(128, 10)

    def forward(self, x):
        x = self.l1(x).relu()
        return self.l2(x)

model = SimpleNet()
```

### Linear Layer Implementation

```python
class Linear:
    def __init__(self, in_features, out_features):
        self.weight = Tensor.glorot_uniform(out_features, in_features)
        self.bias = Tensor.zeros(out_features)

    def __call__(self, x):
        # x: (batch, in_features)
        # weight: (out_features, in_features)
        # output: (batch, out_features)
        return x.dot(self.weight.T) + self.bias
```

### Convolution Layer

```python
class Conv2d:
    def __init__(self, in_channels, out_channels, kernel_size, stride=1):
        self.weight = Tensor.glorot_uniform(
            out_channels, in_channels, kernel_size, kernel_size
        )
        self.bias = Tensor.zeros(out_channels)
        self.stride = stride

    def __call__(self, x):
        # x: (batch, in_channels, h, w)
        # Uses im2col for efficient convolution
        return x.conv2d(self.weight, stride=self.stride) + self.bias
```

### Training Loop

```python
from tinygrad.nn.optim import SGD

# Model and optimizer
model = SimpleNet()
optimizer = SGD([model.l1.weight, model.l1.bias,
                 model.l2.weight, model.l2.bias], lr=0.001)

# Training loop
for epoch in range(10):
    # Forward pass
    out = model.forward(x_train)
    loss = out.sparse_categorical_crossentropy(y_train)

    # Backward pass
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    print(f"Epoch {epoch}, Loss: {loss.numpy()}")
```

### Optimizer Implementation

```python
class SGD:
    def __init__(self, params, lr=0.001):
        self.params = params
        self.lr = lr

    def zero_grad(self):
        for param in self.params:
            param.grad = None

    def step(self):
        for param in self.params:
            param.assign(param - self.lr * param.grad)
```

---

## Chapter 6 — Advanced Features

### JIT Compilation

```python
from tinygrad.jit import TinyJit

@TinyJit
def fast_forward(x):
    return (x * 2 + 1).relu()

# First call: traces and compiles
out = fast_forward(x)

# Subsequent calls: uses compiled version
out = fast_forward(x)  # Much faster!
```

**How JIT Works:**

1. **Trace**: Record computation graph on first execution
2. **Optimize**: Fuse operations, eliminate dead code
3. **Compile**: Generate optimized kernel code
4. **Cache**: Reuse compiled kernel for future calls

### Memory Optimization

**In-place Operations:**

```python
# Creates new tensor
x = x + 1

# Modifies in-place (when safe)
x.realize()
x.assign(x + 1)
```

**Buffer Reuse:**

```python
# TinyGrad automatically reuses buffers
x = Tensor.rand(1000)
y = x * 2
z = y + 1

# y's buffer can be reused for z if y is no longer needed
```

### Custom Operations

```python
# Define custom operation
def my_custom_op(x):
    # Implement forward pass
    out = Tensor.zeros_like(x)

    # Register backward function
    def backward(grad_output):
        return grad_output * 2  # Example gradient

    # Attach to computation graph
    out._ctx = Context([x], backward)
    return out
```

---

## Chapter 7 — Reading the Source Code

### Essential Files (Ordered by Importance)

**Core (~400 lines):**

1. `tinygrad/tensor.py` - Tensor class and operations
2. `tinygrad/lazy.py` - LazyBuffer implementation
3. `tinygrad/ops.py` - Operation definitions

**Execution (~300 lines):**

1. `tinygrad/shape/shapetracker.py` - ShapeTracker for views
2. `tinygrad/shape/symbolic.py` - Symbolic shape manipulation
3. `tinygrad/codegen/kernel.py` - Kernel code generation

**Backends (~200 lines each):**

1. `tinygrad/runtime/ops_cpu.py` - CPU backend
2. `tinygrad/runtime/ops_gpu.py` - OpenCL backend
3. `tinygrad/runtime/ops_metal.py` - Metal backend

**Neural Networks (~100 lines):**

1. `tinygrad/nn/__init__.py` - Layer definitions
2. `tinygrad/nn/optim.py` - Optimizers

### Reading Path

**Week 1:**

1. Start with `tensor.py` - understand the Tensor API
2. Read `ops.py` - see all operation types
3. Study simple operations: add, mul, sum

**Week 2:**

1. Read `lazy.py` - understand lazy evaluation
2. Trace execution of a simple computation
3. Study how .realize() works

**Week 3:**

1. Read `shapetracker.py` - understand shape manipulation
2. Study broadcasting and reshaping
3. Understand how transpose works without copying

**Week 4:**

1. Pick one backend (start with CPU)
2. Read kernel generation code
3. See how operations compile to kernels

---

## Chapter 8 — Philosophy and Design Principles

### Why TinyGrad?

**1. Simplicity:**

- Entire framework in ~1000 lines
- No magic, everything is explicit
- Easy to understand and modify

**2. Performance:**

- Lazy evaluation enables kernel fusion
- Minimal overhead
- Competitive with PyTorch for many tasks

**3. Educational:**

- Learn how deep learning frameworks work
- Understand autodiff, compilation, GPU programming
- Build intuition for optimization

### Design Decisions

**Lazy vs Eager:**

```python
# Eager (PyTorch):
x = torch.tensor([1, 2, 3])
y = x + 1       # Immediately computes
z = y * 2       # Immediately computes

# Lazy (TinyGrad):
x = Tensor([1, 2, 3])
y = x + 1       # Builds graph
z = y * 2       # Builds graph
result = z.numpy()  # Computes everything
```

**Single Backend vs Multiple:**

TinyGrad chooses simplicity: one unified backend interface, multiple implementations.

**Minimal API:**

Only essential operations; everything else built from basics.

---

## Chapter 9 — Practical Projects

### Project 1: MNIST Classifier

```python
from tinygrad.tensor import Tensor
from tinygrad.nn import Linear
from tinygrad.nn.optim import Adam

class MNISTNet:
    def __init__(self):
        self.l1 = Linear(784, 128)
        self.l2 = Linear(128, 10)

    def forward(self, x):
        return self.l2(self.l1(x).relu())

# Training code (simplified)
model = MNISTNet()
opt = Adam(get_parameters(model), lr=0.001)

for epoch in range(10):
    for x, y in train_loader:
        out = model.forward(x)
        loss = out.sparse_categorical_crossentropy(y)
        opt.zero_grad()
        loss.backward()
        opt.step()
```

### Project 2: Custom CUDA Kernel

```python
# Add custom operation with CUDA kernel
def custom_activation(x):
    # Forward: f(x) = x^3 if x > 0 else x
    return x.where(x > 0, x**3)

# Use in model
y = custom_activation(x)
```

### Project 3: Transformer from Scratch

```python
class Attention:
    def __init__(self, dim, n_heads):
        self.n_heads = n_heads
        self.qkv = Linear(dim, 3*dim)
        self.out = Linear(dim, dim)

    def __call__(self, x):
        qkv = self.qkv(x).reshape(x.shape[0], x.shape[1], 3, self.n_heads, -1)
        q, k, v = qkv[:,:,0], qkv[:,:,1], qkv[:,:,2]
        # Attention computation...
        return self.out(out)
```

---

## References

### Official Resources

- [TinyGrad GitHub](https://github.com/tinygrad/tinygrad)
- [TinyGrad Discord](https://discord.gg/ZjZadyC7PK)
- [George Hotz Streams](https://www.youtube.com/@geohotz)

### Learning Resources

- [Matrix Calculus for Deep Learning](http://www.cs.columbia.edu/~mcollins/notes/BackPropagation.pdf)
- [Automatic Differentiation](https://arxiv.org/abs/1502.05767)
- [GPU Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/)

### Related Projects

- [micrograd](https://github.com/karpathy/micrograd) - Even simpler (60 lines)
- [PyTorch](https://github.com/pytorch/pytorch) - Production framework
- [JAX](https://github.com/google/jax) - Composable transformations

---

_TinyGrad proves that deep learning frameworks don't need to be complex. Understand it completely, and you understand them all._
