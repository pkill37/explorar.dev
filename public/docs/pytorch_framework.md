# PyTorch Deep Learning Framework In The Mind

## Understanding PyTorch Before Training

> This isn't just a guide to using PyTorch. It's an effort to understand how modern deep learning frameworks think.

PyTorch is a deep learning framework that provides tensor computation with strong GPU acceleration and automatic differentiation for building neural networks. Unlike other frameworks, PyTorch emphasizes dynamic computation graphs (define-by-run), Pythonic design, and seamless integration between research and production.

Understanding PyTorch means understanding how tensors flow through computation graphs, how gradients are computed automatically, how memory is managed across CPU and GPU, and how models are optimized for production deployment.

**PyTorch powers modern AI. Let's understand how it works.**

---

## Learning Path for PyTorch Mastery

This guide follows a structured learning path designed to build deep learning systems expertise:

### Beginner Path (Weeks 1-4)

1. **Tensor Fundamentals**: Understand PyTorch tensors and operations
2. **Autograd Basics**: Learn automatic differentiation
3. **Simple Models**: Build basic neural networks with nn.Module
4. **Training Loops**: Implement forward pass, loss, backward, optimization

**Practical Start:**

```python
import torch

# Create tensors
x = torch.randn(3, 4, requires_grad=True)
y = x ** 2 + 2 * x + 1

# Automatic differentiation
loss = y.sum()
loss.backward()  # Compute gradients
print(x.grad)    # dy/dx
```

### Intermediate Path (Months 2-3)

1. **Advanced Autograd**: Understand computation graphs deeply
2. **Custom Operations**: Write custom autograd Functions
3. **GPU Programming**: Master CUDA tensors and operations
4. **Model Optimization**: Learn about JIT compilation, quantization

**Key Projects:**

- Implement custom layer with backward pass
- Profile and optimize model performance
- Deploy model with TorchScript
- Build efficient data pipeline

### Advanced Path (Months 4-6)

1. **Distributed Training**: Multi-GPU and multi-node training
2. **C++ Extensions**: Write CUDA kernels for PyTorch
3. **Internal Architecture**: Understand ATen, dispatcher, autograd engine
4. **Production Deployment**: TorchServe, ONNX export, mobile deployment

**Advanced Projects:**

- Write custom CUDA operation
- Implement distributed data parallel training
- Build production inference server
- Optimize model for edge devices

### Expert Path (Months 7+)

1. **PyTorch Internals**: Deep dive into autograd engine, dispatcher
2. **Compiler Integration**: Study TorchDynamo, AOTAutograd
3. **Contributing**: Submit PRs to PyTorch
4. **Research**: Implement cutting-edge optimizations

---

## Chapter 1 — PyTorch Architecture and Core Concepts

### The Layered Architecture

PyTorch is built on multiple abstraction layers:

```
Python API (torch.nn, torch.optim)
    ↓
Autograd Engine (torch.autograd)
    ↓
ATen (C++ tensor library)
    ↓
Dispatcher (operator dispatch system)
    ↓
Backends (CPU, CUDA, MPS, XLA)
    ↓
Hardware (CPU, NVIDIA GPU, Apple Silicon, TPU)
```

**Component Breakdown:**

**1. Tensor Core (ATen)**

ATen (A Tensor Library) is PyTorch's C++ tensor computation core:

- **Type-erased tensors**: Single Tensor class for all dtypes
- **Strided storage**: Efficient memory layout with strides
- **Operator library**: ~2,000+ tensor operations
- **Backend abstraction**: Unified interface for CPU/CUDA/etc.

**2. Autograd Engine**

The automatic differentiation system:

- **Dynamic computation graphs**: Built on-the-fly during forward pass
- **Reverse-mode AD**: Efficient gradient computation (backpropagation)
- **Graph recording**: Tracks all operations for gradient computation
- **Gradient accumulation**: Supports multiple backward passes

**3. Dispatcher**

The operator dispatch mechanism:

- **Multiple dispatch**: Routes ops based on device, dtype, layout
- **Extensibility**: Add custom backends without modifying core
- **Composability**: Combine transformations (vmap, grad, jit)
- **Performance**: Zero-overhead dispatch in most cases

**4. TorchScript / torch.jit**

Ahead-of-time compilation and optimization:

- **JIT compilation**: Trace or script Python models to optimized IR
- **Graph optimization**: Fuse operations, eliminate dead code
- **Portable serialization**: Save models for C++ deployment
- **Mobile runtime**: Run models on iOS/Android

### Core Concepts Deep Dive

**1. Tensors: The Foundation**

PyTorch tensors are multi-dimensional arrays with additional metadata:

```python
import torch

# Tensor creation
x = torch.tensor([[1, 2], [3, 4]], dtype=torch.float32)

# Tensor properties
print(x.shape)       # torch.Size([2, 2])
print(x.dtype)       # torch.float32
print(x.device)      # cpu
print(x.stride())    # (2, 1) - memory layout
print(x.is_contiguous())  # True

# Tensor metadata structure (simplified C++):
# struct TensorImpl {
#     Storage storage_;      // Underlying data buffer
#     int64_t offset_;       // Offset into storage
#     IntArrayRef sizes_;    // Shape [2, 2]
#     IntArrayRef strides_;  // Strides [2, 1]
#     c10::Device device_;   # CPU/CUDA/etc.
#     ScalarType dtype_;     # float32/int64/etc.
#     bool requires_grad_;   # Track gradients?
# }
```

**Memory Layout and Strides:**

```python
# Contiguous tensor (row-major)
x = torch.randn(2, 3)
# Memory: [a, b, c, d, e, f]
# Shape: (2, 3), Strides: (3, 1)
# x[i,j] = memory[i*3 + j*1]

# Transposed tensor (non-contiguous)
y = x.t()
# Memory: [a, b, c, d, e, f]  (same!)
# Shape: (3, 2), Strides: (1, 3)
# y[i,j] = memory[i*1 + j*3]

# Force contiguous
z = y.contiguous()
# Memory: [a, d, b, e, c, f]  (reordered!)
# Shape: (3, 2), Strides: (2, 1)
```

**2. Autograd: Automatic Differentiation**

PyTorch uses reverse-mode automatic differentiation:

**How Autograd Works:**

```python
# Forward pass builds computation graph
x = torch.tensor(2.0, requires_grad=True)
y = x ** 2      # y.grad_fn = <PowBackward0>
z = y * 3       # z.grad_fn = <MulBackward0>
loss = z + 1    # loss.grad_fn = <AddBackward0>

# Backward pass traverses graph in reverse
loss.backward()
print(x.grad)   # dL/dx = 12.0

# Computation graph:
# x (leaf) → y = x² → z = 3y → loss = z + 1
# Gradient flow:
# dL/dx ← dL/dy ← dL/dz ← dL/dloss = 1
# dL/dy = dL/dz * dz/dy = 1 * 3 = 3
# dL/dx = dL/dy * dy/dx = 3 * 2x = 3 * 4 = 12
```

**Gradient Function Structure:**

```cpp
// Simplified C++ structure
class Node {
    std::vector<Edge> next_edges_;  // Inputs to this operation

    virtual variable_list apply(variable_list&& inputs) {
        // Compute gradients w.r.t. inputs
        // This is the backward() function
    }
};

// Example: AddBackward node
class AddBackward : public Node {
    variable_list apply(variable_list&& grads) override {
        // grad_output is gradient from later layers
        // For addition: d(x+y)/dx = 1, d(x+y)/dy = 1
        return {grads[0], grads[0]};  // Pass gradient to both inputs
    }
};
```

**3. Dynamic vs Static Graphs**

PyTorch's define-by-run approach:

```python
# Dynamic graph: Different structure each iteration
for i in range(10):
    x = torch.randn(1, requires_grad=True)

    # Conditional computation
    if x.item() > 0:
        y = x ** 2
    else:
        y = x ** 3

    y.backward()  # Graph built dynamically
```

Compare to static graphs (TensorFlow 1.x):

```python
# Static graph (TF 1.x style - not PyTorch!)
# Graph built once, reused
x = tf.placeholder(tf.float32)
y = tf.cond(x > 0, lambda: x**2, lambda: x**3)
# Graph structure fixed before execution
```

**4. GPU Acceleration**

Moving tensors to GPU:

```python
# Check CUDA availability
print(torch.cuda.is_available())
print(torch.cuda.device_count())

# Create CUDA tensor
x = torch.randn(1000, 1000, device='cuda')
# Or move existing tensor
y = torch.randn(1000, 1000).cuda()

# Operations on CUDA tensors use GPU
z = torch.mm(x, y)  # Matrix multiply on GPU

# Move back to CPU
cpu_result = z.cpu()

# Tensor location tracking:
# - Each tensor has device attribute
# - Operations require tensors on same device
# - PyTorch manages CUDA memory via caching allocator
```

---

## Chapter 2 — Building Neural Networks

### nn.Module: The Building Block

`nn.Module` is the base class for all neural network modules:

**Basic Structure:**

```python
import torch.nn as nn
import torch.nn.functional as F

class SimpleNet(nn.Module):
    def __init__(self):
        super().__init__()
        # Parameters registered automatically
        self.fc1 = nn.Linear(784, 128)
        self.fc2 = nn.Linear(128, 10)

    def forward(self, x):
        # Define forward pass
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        return x

model = SimpleNet()
```

**Under the Hood:**

```python
# nn.Module features:
# 1. Parameter registration
for name, param in model.named_parameters():
    print(f"{name}: {param.shape}")
# fc1.weight: torch.Size([128, 784])
# fc1.bias: torch.Size([128])
# fc2.weight: torch.Size([10, 128])
# fc2.bias: torch.Size([10])

# 2. Submodule tracking
for name, module in model.named_modules():
    print(f"{name}: {type(module).__name__}")

# 3. Device movement
model.cuda()  # Moves all parameters to GPU

# 4. Training/eval modes
model.train()  # Enable dropout, batchnorm training
model.eval()   # Disable dropout, batchnorm eval mode
```

**Parameter vs Buffer:**

```python
class CustomModule(nn.Module):
    def __init__(self):
        super().__init__()
        # Parameter: requires gradients, updated by optimizer
        self.weight = nn.Parameter(torch.randn(10, 10))

        # Buffer: no gradients, but part of state_dict
        self.register_buffer('running_mean', torch.zeros(10))

    def forward(self, x):
        # Update buffer (e.g., running statistics)
        self.running_mean = 0.9 * self.running_mean + 0.1 * x.mean(0)
        return x * self.weight
```

### Common Layers Deep Dive

**1. Linear (Fully Connected):**

```python
# nn.Linear implementation (simplified)
class Linear(nn.Module):
    def __init__(self, in_features, out_features, bias=True):
        super().__init__()
        self.weight = nn.Parameter(torch.randn(out_features, in_features))
        if bias:
            self.bias = nn.Parameter(torch.randn(out_features))

    def forward(self, x):
        # x: (batch, in_features)
        # weight: (out_features, in_features)
        # output: (batch, out_features)
        output = x @ self.weight.t()  # Matrix multiply
        if self.bias is not None:
            output += self.bias
        return output
```

**2. Convolution:**

```python
# Conv2d
conv = nn.Conv2d(
    in_channels=3,    # RGB
    out_channels=64,  # 64 filters
    kernel_size=3,    # 3x3 kernel
    stride=1,
    padding=1
)

# Input: (batch, 3, H, W)
# Output: (batch, 64, H, W)  (with padding=1, stride=1)

# Under the hood:
# - Implements im2col algorithm for efficiency
# - Uses cuDNN on CUDA for optimized convolution
# - Weight shape: (out_channels, in_channels, kernel_h, kernel_w)
```

**3. Batch Normalization:**

```python
# BatchNorm2d
bn = nn.BatchNorm2d(num_features=64)

# Forward pass
def batch_norm_forward(x, gamma, beta, running_mean, running_var):
    # x: (N, C, H, W)
    if training:
        # Compute statistics over batch
        mean = x.mean(dim=(0, 2, 3), keepdim=True)
        var = x.var(dim=(0, 2, 3), keepdim=True, unbiased=False)

        # Update running statistics
        running_mean = 0.9 * running_mean + 0.1 * mean
        running_var = 0.9 * running_var + 0.1 * var
    else:
        mean = running_mean
        var = running_var

    # Normalize
    x_norm = (x - mean) / torch.sqrt(var + eps)

    # Scale and shift
    out = gamma * x_norm + beta
    return out
```

### Loss Functions

**1. Cross Entropy Loss:**

```python
# Combined softmax + negative log likelihood
criterion = nn.CrossEntropyLoss()

# Logits (before softmax)
logits = model(x)  # (batch, num_classes)
labels = torch.tensor([1, 0, 2])  # Class indices

loss = criterion(logits, labels)

# Mathematically:
# loss = -log(exp(logits[i, labels[i]]) / sum(exp(logits[i, :])))
# Equivalent to:
# probs = softmax(logits)
# loss = -log(probs[i, labels[i]])
```

**2. Custom Loss Functions:**

```python
class FocalLoss(nn.Module):
    def __init__(self, alpha=1, gamma=2):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma

    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        focal_loss = self.alpha * (1-pt)**self.gamma * ce_loss
        return focal_loss.mean()
```

---

## Chapter 3 — Autograd Engine Deep Dive

### How Gradients Are Computed

**The Backward Pass:**

```python
# Example computation
x = torch.tensor(3.0, requires_grad=True)
y = torch.tensor(2.0, requires_grad=True)

z = x * y        # MulBackward
loss = z ** 2    # PowBackward

# Call backward
loss.backward()

# What happens internally:
# 1. Start from loss (grad = 1.0)
# 2. PowBackward: d(z²)/dz = 2z = 2*6 = 12
# 3. MulBackward: d(xy)/dx = y = 2, d(xy)/dy = x = 3
# 4. Accumulate: x.grad = 12*2 = 24, y.grad = 12*3 = 36
```

**Gradient Function Chain:**

```python
# Inspect gradient functions
print(loss.grad_fn)  # <PowBackward0>
print(loss.grad_fn.next_functions)
# ((MulBackward0, 0),)
print(loss.grad_fn.next_functions[0][0].next_functions)
# ((AccumulateGrad, 0), (AccumulateGrad, 0))
```

**Custom Autograd Function:**

```python
class MyReLU(torch.autograd.Function):
    @staticmethod
    def forward(ctx, input):
        # Save for backward
        ctx.save_for_backward(input)
        return input.clamp(min=0)

    @staticmethod
    def backward(ctx, grad_output):
        # Retrieve saved tensors
        input, = ctx.saved_tensors
        grad_input = grad_output.clone()
        # ReLU gradient: 1 if x > 0, else 0
        grad_input[input < 0] = 0
        return grad_input

# Use custom function
relu = MyReLU.apply
x = torch.randn(10, requires_grad=True)
y = relu(x)
y.sum().backward()
```

**Advanced: Double Backward (Hessian):**

```python
# Compute second derivatives
x = torch.tensor(2.0, requires_grad=True)
y = x ** 3

# First derivative
grad_y = torch.autograd.grad(y, x, create_graph=True)[0]
print(f"dy/dx = {grad_y.item()}")  # 3x² = 12

# Second derivative
grad2_y = torch.autograd.grad(grad_y, x)[0]
print(f"d²y/dx² = {grad2_y.item()}")  # 6x = 12
```

### In-place Operations and Views

**In-place Operations:**

```python
# Regular operation: creates new tensor
x = torch.randn(10, requires_grad=True)
y = x * 2

# In-place operation: modifies tensor
x = torch.randn(10, requires_grad=True)
y = x
x.mul_(2)  # In-place multiply

# Warning: in-place operations can break autograd
x = torch.randn(10, requires_grad=True)
x_orig = x
x.mul_(2)  # Modifies x in-place
# x_orig.backward() would fail!
```

**Views:**

```python
# View shares storage with original
x = torch.randn(4, 4, requires_grad=True)
y = x.view(16)    # Reshape (view)
z = x[:2, :2]     # Slice (view)

# Views track base tensor
print(y.is_contiguous())   # May be False
print(y._base is x)        # True (shares storage)

# Gradient flows through views
y.sum().backward()
print(x.grad.shape)  # (4, 4) - gradient accumulated on original
```

---

## Chapter 4 — Optimization and Training

### Optimizers

**1. SGD with Momentum:**

```python
# Stochastic Gradient Descent
optimizer = torch.optim.SGD(
    model.parameters(),
    lr=0.01,
    momentum=0.9,
    weight_decay=1e-4
)

# Training loop
for epoch in range(num_epochs):
    for batch in dataloader:
        # Forward pass
        outputs = model(batch['input'])
        loss = criterion(outputs, batch['target'])

        # Backward pass
        optimizer.zero_grad()  # Clear old gradients
        loss.backward()        # Compute gradients
        optimizer.step()       # Update parameters
```

**SGD Implementation (simplified):**

```python
class SGD:
    def __init__(self, params, lr=0.01, momentum=0.9, weight_decay=0):
        self.params = list(params)
        self.lr = lr
        self.momentum = momentum
        self.weight_decay = weight_decay
        self.velocity = [torch.zeros_like(p) for p in self.params]

    def step(self):
        for i, param in enumerate(self.params):
            if param.grad is None:
                continue

            # Weight decay (L2 regularization)
            if self.weight_decay != 0:
                param.grad = param.grad + self.weight_decay * param.data

            # Momentum
            self.velocity[i] = self.momentum * self.velocity[i] + param.grad

            # Update parameter
            param.data = param.data - self.lr * self.velocity[i]
```

**2. Adam Optimizer:**

```python
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

# Adam combines momentum and RMSProp
# Maintains both first moment (mean) and second moment (variance)
```

**Adam Implementation (simplified):**

```python
class Adam:
    def __init__(self, params, lr=0.001, betas=(0.9, 0.999), eps=1e-8):
        self.params = list(params)
        self.lr = lr
        self.beta1, self.beta2 = betas
        self.eps = eps
        self.m = [torch.zeros_like(p) for p in self.params]  # First moment
        self.v = [torch.zeros_like(p) for p in self.params]  # Second moment
        self.t = 0

    def step(self):
        self.t += 1
        for i, param in enumerate(self.params):
            if param.grad is None:
                continue

            # Update biased first moment estimate
            self.m[i] = self.beta1 * self.m[i] + (1 - self.beta1) * param.grad

            # Update biased second moment estimate
            self.v[i] = self.beta2 * self.v[i] + (1 - self.beta2) * param.grad**2

            # Bias correction
            m_hat = self.m[i] / (1 - self.beta1**self.t)
            v_hat = self.v[i] / (1 - self.beta2**self.t)

            # Update parameters
            param.data = param.data - self.lr * m_hat / (torch.sqrt(v_hat) + self.eps)
```

### Learning Rate Scheduling

```python
# StepLR: decay LR every N epochs
scheduler = torch.optim.lr_scheduler.StepLR(
    optimizer, step_size=30, gamma=0.1
)

# CosineAnnealingLR: cosine annealing
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
    optimizer, T_max=100
)

# Training loop with scheduler
for epoch in range(num_epochs):
    train(...)
    validate(...)
    scheduler.step()  # Update learning rate
```

---

## Chapter 5 — Advanced Features

### TorchScript and JIT Compilation

**Tracing:**

```python
# Trace execution with example inputs
model = SimpleNet()
example_input = torch.randn(1, 784)
traced_model = torch.jit.trace(model, example_input)

# Save traced model
traced_model.save('model.pt')

# Load in C++
# torch::jit::script::Module module = torch::jit::load("model.pt");
```

**Scripting:**

```python
# Script annotation for control flow
@torch.jit.script
def scripted_fn(x: torch.Tensor) -> torch.Tensor:
    if x.sum() > 0:
        return x * 2
    else:
        return x * 3

# Script entire module
scripted_model = torch.jit.script(model)
```

**Graph Optimization:**

```python
# View optimized graph
print(traced_model.graph)

# Optimizations applied:
# - Operator fusion
# - Dead code elimination
# - Constant folding
# - Algebraic simplification
```

### Distributed Training

**DataParallel (single-node multi-GPU):**

```python
model = nn.DataParallel(model)
model = model.cuda()

# Splits batch across GPUs automatically
outputs = model(inputs)
```

**DistributedDataParallel (multi-node):**

```python
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

# Initialize process group
dist.init_process_group(backend='nccl')

# Wrap model
model = model.cuda()
model = DDP(model)

# Training (each process handles portion of data)
for batch in dataloader:
    outputs = model(batch)
    # Gradients automatically synchronized across processes
```

### Custom CUDA Extensions

**C++/CUDA Extension:**

```cpp
// custom_op.cu
#include <torch/extension.h>

__global__ void add_kernel(float* a, float* b, float* c, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}

torch::Tensor add_cuda(torch::Tensor a, torch::Tensor b) {
    auto c = torch::zeros_like(a);
    int n = a.numel();
    int threads = 256;
    int blocks = (n + threads - 1) / threads;

    add_kernel<<<blocks, threads>>>(
        a.data_ptr<float>(),
        b.data_ptr<float>(),
        c.data_ptr<float>(),
        n
    );

    return c;
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("add", &add_cuda, "Add two tensors (CUDA)");
}
```

**Build and use:**

```python
from torch.utils.cpp_extension import load

custom_op = load(
    name='custom_op',
    sources=['custom_op.cu'],
    extra_cuda_cflags=['-O3']
)

result = custom_op.add(a, b)
```

---

## Chapter 6 — PyTorch Internals

### ATen: The Tensor Library

**Core Tensor Structure:**

```cpp
// c10/core/TensorImpl.h (simplified)
struct TensorImpl {
    Storage storage_;          // Actual data buffer
    int64_t storage_offset_;   // Offset into storage
    SmallVector<int64_t> sizes_;      // Shape
    SmallVector<int64_t> strides_;    // Memory strides
    c10::Device device_;       // CPU/CUDA/etc.
    ScalarType dtype_;         // Data type
    bool requires_grad_;       // Track gradients?
    std::unique_ptr<c10::AutogradMeta> autograd_meta_;
};
```

**Dispatcher Architecture:**

```cpp
// Simplified dispatch
Tensor add(const Tensor& a, const Tensor& b) {
    // 1. Select backend based on device
    auto& impl = dispatcher.lookup(device);

    // 2. Dispatch to kernel
    return impl.call(a, b);
}

// Register kernels for different backends
TORCH_LIBRARY_IMPL(aten, CPU, m) {
    m.impl("add", &cpu_add);
}

TORCH_LIBRARY_IMPL(aten, CUDA, m) {
    m.impl("add", &cuda_add);
}
```

### Key Source Files

**Directory Structure:**

```
pytorch/
├── torch/                  # Python frontend
│   ├── nn/                # Neural network modules
│   ├── optim/             # Optimizers
│   ├── autograd/          # Autograd Python API
│   └── jit/               # TorchScript
├── aten/                   # C++ tensor library
│   ├── src/
│   │   ├── ATen/          # Tensor operations
│   │   └── THC/           # CUDA kernels
├── c10/                    # Core library
│   ├── core/              # Tensor, Device, etc.
│   └── util/              # Utilities
├── torch/csrc/            # Python-C++ bindings
│   ├── autograd/          # Autograd engine
│   └── jit/               # JIT compiler
└── caffe2/                # Caffe2 backend (legacy)
```

**Essential Files to Study:**

**Week 1: Tensor Basics**

1. `c10/core/TensorImpl.h` - Core tensor structure
2. `aten/src/ATen/core/Tensor.h` - Tensor interface
3. `aten/src/ATen/native/cpu/Loops.h` - CPU kernels

**Week 2: Autograd**

1. `torch/csrc/autograd/function.h` - Gradient function base
2. `torch/csrc/autograd/engine.cpp` - Autograd engine
3. `torch/csrc/autograd/variable.cpp` - Variable implementation

**Week 3: Operators**

1. `aten/src/ATen/native/native_functions.yaml` - Operator definitions
2. `aten/src/ATen/native/Linear.cpp` - Linear algebra ops
3. `aten/src/ATen/native/cuda/Normalization.cu` - CUDA batchnorm

---

## Chapter 7 — Production Deployment

### Model Export and Serving

**TorchScript Export:**

```python
# Export model
traced_model = torch.jit.trace(model, example_input)
traced_model.save('model.pt')

# Load in production (C++)
# torch::jit::Module module = torch::jit::load("model.pt");
# auto output = module.forward({input}).toTensor();
```

**ONNX Export:**

```python
# Export to ONNX format
torch.onnx.export(
    model,
    example_input,
    "model.onnx",
    export_params=True,
    opset_version=11,
    input_names=['input'],
    output_names=['output']
)

# Can be loaded by ONNX Runtime, TensorRT, etc.
```

**TorchServe:**

```bash
# Package model
torch-model-archiver \
    --model-name my_model \
    --version 1.0 \
    --serialized-file model.pt \
    --handler image_classifier

# Start server
torchserve --start --model-store model_store --models my_model=my_model.mar

# Inference
curl -X POST http://localhost:8080/predictions/my_model -T image.jpg
```

### Optimization Techniques

**1. Quantization:**

```python
# Post-training quantization
quantized_model = torch.quantization.quantize_dynamic(
    model,
    {nn.Linear},  # Layers to quantize
    dtype=torch.qint8
)

# Reduces model size by ~4x, speeds up CPU inference
```

**2. Pruning:**

```python
import torch.nn.utils.prune as prune

# Prune 30% of weights
prune.l1_unstructured(module.fc1, name='weight', amount=0.3)

# Make pruning permanent
prune.remove(module.fc1, 'weight')
```

**3. Mixed Precision Training:**

```python
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()

for batch in dataloader:
    optimizer.zero_grad()

    # Forward in mixed precision (fp16)
    with autocast():
        outputs = model(inputs)
        loss = criterion(outputs, targets)

    # Backward with gradient scaling
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

---

## References

### Official Resources

- [PyTorch Documentation](https://pytorch.org/docs/)
- [PyTorch Tutorials](https://pytorch.org/tutorials/)
- [PyTorch Source Code](https://github.com/pytorch/pytorch)
- [PyTorch Internals](http://blog.ezyang.com/2019/05/pytorch-internals/)

### Advanced Topics

- [Autograd Mechanics](https://pytorch.org/docs/stable/notes/autograd.html)
- [Extending PyTorch](https://pytorch.org/docs/stable/notes/extending.html)
- [TorchScript](https://pytorch.org/docs/stable/jit.html)
- [Distributed Training](https://pytorch.org/tutorials/beginner/dist_overview.html)

### Community

- [PyTorch Forums](https://discuss.pytorch.org/)
- [PyTorch Blog](https://pytorch.org/blog/)
- [Papers with Code](https://paperswithcode.com/)

---

_This guide provides a foundation for mastering PyTorch. From tensors to production deployment, practice and experiment!_
