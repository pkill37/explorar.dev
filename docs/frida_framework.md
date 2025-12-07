# Frida Dynamic Instrumentation Framework In The Mind

## Understanding Frida Before Hooking

> This isn't just a guide to using Frida. It's an effort to understand how dynamic instrumentation reshapes running applications.

Frida is a dynamic instrumentation toolkit that lets you inject JavaScript into native applications on Windows, macOS, GNU/Linux, iOS, Android, and QNX. It bridges the gap between high-level scripting and low-level binary manipulation, enabling runtime introspection, modification, and analysis without recompilation or restart.

Understanding Frida means understanding how processes execute, how memory is organized, how functions are called, and how you can intercept and modify all of this at runtime. For Android specifically, it means understanding the Android runtime (ART), JNI, and the Android framework.

**Frida makes the invisible visible. Let's understand how it works.**

---

## Learning Path for Frida Mastery

This guide follows a structured learning path designed to build dynamic instrumentation expertise:

### Beginner Path (Weeks 1-4)

1. **Installation**: Set up Frida on host and target devices
2. **Basic Hooking**: Intercept simple functions in native apps
3. **JavaScript Basics**: Frida scripting fundamentals
4. **Process Exploration**: Enumerate modules, exports, and imports

**Practical Start:**

```javascript
// Hook a simple function
Interceptor.attach(Module.findExportByName(null, 'open'), {
  onEnter: function (args) {
    console.log('Opening file:', args[0].readUtf8String());
  },
  onLeave: function (retval) {
    console.log('File descriptor:', retval.toInt32());
  },
});
```

### Intermediate Path (Months 2-3)

1. **Android Deep Dive**: Hook Java methods, understand ART
2. **Memory Operations**: Read/write memory, pattern scanning
3. **Function Replacement**: Replace entire function implementations
4. **Anti-Detection**: Bypass Frida detection techniques

**Key Projects:**

- Hook Android framework APIs
- Intercept SSL pinning
- Modify function return values
- Trace app behavior dynamically

### Advanced Path (Months 4-6)

1. **Native Instrumentation**: ARM/ARM64 assembly hooking
2. **JNI Bridging**: Deep understanding of JNI layer
3. **Custom Stalkers**: Code tracing and coverage
4. **Scripting Automation**: Build reusable Frida modules

**Advanced Projects:**

- Bypass root detection
- Implement custom SSL unpinning
- Build automated vulnerability scanners
- Trace cryptographic operations

### Expert Path (Months 7+)

1. **Frida Internals**: Understand Frida's architecture
2. **Gum Library**: Use Frida's instrumentation engine directly
3. **Custom Gadgets**: Build standalone instrumentation
4. **Research**: Discover and exploit vulnerabilities

---

## Chapter 1 — Frida Architecture and Core Concepts

### The Three-Layer Architecture

Frida operates through a carefully designed three-layer architecture:

```
Host (Your Computer)
    ↓
Frida Client (Python/Node.js/CLI)
    ↓ [Communication via TCP/USB]
Frida Server (Target Device)
    ↓
Frida Agent (Injected into Target Process)
    ↓
Target Application
```

**Component Breakdown:**

**1. Frida Client**

- Runs on your development machine
- Provides APIs in Python, Node.js, or CLI
- Sends instrumentation scripts to Frida Server
- Receives results and handles communication

**2. Frida Server (frida-server)**

- Runs on the target device (Android/iOS/Linux)
- Listens for client connections
- Manages process injection
- Coordinates agent deployment

**3. Frida Agent**

- JavaScript engine (QuickJS) injected into target process
- Executes your instrumentation scripts
- Uses Frida Gum for low-level operations
- Provides high-level JavaScript API

**4. Frida Gum**

- Low-level instrumentation engine written in C
- Provides code relocation, hooking, stalking
- Cross-platform (x86, ARM, ARM64, MIPS)
- The foundation of all Frida operations

### Core Concepts Deep Dive

**1. Process Injection**

Frida must inject itself into the target process to gain control:

**On Android:**

```
1. frida-server runs with root/system privileges
2. Uses ptrace() to attach to target process
3. Allocates memory in target process (mmap)
4. Writes Frida agent code to allocated memory
5. Creates new thread in target process
6. New thread loads QuickJS and executes your script
```

**Injection Methods:**

- **ptrace injection**: Traditional method (requires root)
- **zygote injection**: Inject before app starts (Android)
- **gadget mode**: Embed Frida as a library
- **spawn mode**: Intercept app at launch

**2. Hooking Mechanisms**

Frida provides multiple hooking techniques:

**Inline Hooking (Trampoline):**

```assembly
Original function:
    push {r4-r7, lr}
    sub sp, #0x10
    mov r4, r0
    ...

After Frida hook:
    ldr pc, [pc, #0]    ; Jump to hook handler
    .word 0x12345678    ; Hook address
    ; Original instructions saved elsewhere
```

**Import/Export Hooking:**

```javascript
// Hook by export name
Interceptor.attach(Module.findExportByName('libc.so', 'strcmp'), {
  onEnter(args) {
    console.log('strcmp:', args[0].readUtf8String(), args[1].readUtf8String());
  },
});
```

**Offset Hooking:**

```javascript
// Hook at specific address
const base = Module.findBaseAddress('libnative.so');
const targetFunc = base.add(0x1234);
Interceptor.attach(targetFunc, {
  /* ... */
});
```

**3. Memory Management**

Frida provides powerful memory operations:

```javascript
// Read memory
const addr = ptr('0x12345678');
const bytes = addr.readByteArray(16);
const int = addr.readInt();
const str = addr.readUtf8String();
const ptr = addr.readPointer();

// Write memory
addr.writeByteArray([0x90, 0x90, 0x90]); // NOP instructions
addr.writeInt(42);
addr.writeUtf8String('patched');

// Pattern scanning
const pattern = '48 8B 45 ?? 48 8B 00';
const results = Memory.scanSync(base, size, pattern);

// Memory protection
Memory.protect(addr, 4096, 'rwx'); // Make executable
```

**4. JavaScript Bridge**

Frida's JavaScript API bridges to native code:

```javascript
// Define native function
const openPtr = Module.findExportByName(null, 'open');
const open = new NativeFunction(openPtr, 'int', ['pointer', 'int']);

// Call native function
const fd = open(Memory.allocUtf8String('/etc/passwd'), 0);

// Create callback from JavaScript
const callback = new NativeCallback(
  function (arg) {
    console.log('Callback called with:', arg);
    return 0;
  },
  'int',
  ['int']
);
```

### Android-Specific Architecture

**Android Runtime (ART) Internals:**

```
Java Code
    ↓
Dalvik Bytecode (.dex)
    ↓
ART Compiler (AOT/JIT)
    ↓
Native Machine Code
    ↓
Execution
```

**ART vs Dalvik:**

- **Dalvik**: JIT compilation, slower startup
- **ART**: AOT compilation, faster execution
- **ART (modern)**: Hybrid AOT + JIT for optimization

**Key ART Structures:**

```c
// Simplified ART method structure
class ArtMethod {
    uint32_t declaring_class_;  // Class that owns this method
    uint32_t access_flags_;     // public/private/static/etc.
    uint32_t dex_code_item_offset_;  // Bytecode location
    uint32_t dex_method_index_; // Method index in DEX
    uint16_t method_index_;
    uint16_t hotness_count_;    // For JIT
    void* entry_point_from_quick_compiled_code_;  // Native code entry
    void* entry_point_from_jni_;                  // JNI entry
    void* data_;                // Method-specific data
};
```

---

## Chapter 2 — Android Java Hooking

### Understanding Java.use()

The most powerful feature for Android: hooking Java methods.

**Basic Java Method Hooking:**

```javascript
Java.perform(function () {
  // Get a class reference
  const MainActivity = Java.use('com.example.app.MainActivity');

  // Hook a method
  MainActivity.onCreate.implementation = function (savedInstanceState) {
    console.log('MainActivity.onCreate called!');

    // Call original
    this.onCreate(savedInstanceState);

    // Do additional work
    console.log('Activity:', this.toString());
  };
});
```

**Method Overloading:**

```javascript
Java.perform(function () {
  const String = Java.use('java.lang.String');

  // Hook specific overload
  String.equals.overload('java.lang.Object').implementation = function (obj) {
    console.log('Comparing:', this.toString(), 'with', obj.toString());
    return this.equals(obj); // Call original
  };

  // Hook another overload
  String.valueOf.overload('int').implementation = function (i) {
    console.log('valueOf(int):', i);
    return String.valueOf(i);
  };
});
```

**Constructor Hooking:**

```javascript
Java.perform(function () {
  const SecretKey = Java.use('javax.crypto.spec.SecretKeySpec');

  // Hook constructor
  SecretKey.$init.overload('[B', 'java.lang.String').implementation = function (key, algorithm) {
    console.log('SecretKeySpec created:');
    console.log('  Key:', hexdump(key));
    console.log('  Algorithm:', algorithm);

    // Call original constructor
    return this.$init(key, algorithm);
  };
});
```

### Dealing with Java Objects

**Creating Java Objects:**

```javascript
Java.perform(function () {
  // Create a new String
  const String = Java.use('java.lang.String');
  const str = String.$new('Hello from Frida!');

  // Create Intent
  const Intent = Java.use('android.content.Intent');
  const intent = Intent.$new();
  intent.setAction('com.example.CUSTOM_ACTION');

  // Call methods on created object
  console.log('String length:', str.length());
});
```

**Accessing Object Fields:**

```javascript
Java.perform(function () {
  const MainActivity = Java.use('com.example.app.MainActivity');

  MainActivity.onCreate.implementation = function (savedInstanceState) {
    this.onCreate(savedInstanceState);

    // Access private field
    const privateField = this.myPrivateField.value;
    console.log('Private field:', privateField);

    // Modify field
    this.myPrivateField.value = 'Frida was here!';
  };
});
```

**Working with Arrays:**

```javascript
Java.perform(function () {
  const System = Java.use('java.lang.System');

  // Create array
  const ByteArray = Java.array('byte', [0x01, 0x02, 0x03, 0x04]);

  // Read array in hooked method
  SomeClass.processData.implementation = function (data) {
    console.log('Array length:', data.length);
    for (let i = 0; i < data.length; i++) {
      console.log('  data[' + i + ']:', data[i]);
    }
    return this.processData(data);
  };
});
```

### Advanced Java Techniques

**Reflection Hooking:**

```javascript
Java.perform(function () {
  const Class = Java.use('java.lang.Class');

  // Hook getDeclaredMethod
  Class.getDeclaredMethod.overload('java.lang.String', '[Ljava.lang.Class;').implementation =
    function (name, paramTypes) {
      console.log('Reflection: getDeclaredMethod');
      console.log('  Class:', this.toString());
      console.log('  Method:', name);

      const method = this.getDeclaredMethod(name, paramTypes);

      // Hook the reflected method invocation
      const Method = Java.use('java.lang.reflect.Method');
      // ... further hooking

      return method;
    };
});
```

**ClassLoader Manipulation:**

```javascript
Java.perform(function () {
  // Enumerate all loaded classes
  Java.enumerateLoadedClasses({
    onMatch: function (className) {
      if (className.includes('com.example')) {
        console.log('Found:', className);
      }
    },
    onComplete: function () {
      console.log('Enumeration complete');
    },
  });

  // Use custom ClassLoader
  Java.enumerateClassLoaders({
    onMatch: function (loader) {
      try {
        Java.classFactory.loader = loader;
        const CustomClass = Java.use('com.example.HiddenClass');
        // Hook methods...
      } catch (e) {}
    },
    onComplete: function () {},
  });
});
```

**Dynamic Class Registration:**

```javascript
Java.perform(function () {
  // Register your own Java class
  const MyClass = Java.registerClass({
    name: 'com.frida.MyClass',
    methods: {
      myMethod: {
        returnType: 'void',
        argumentTypes: ['java.lang.String'],
        implementation: function (str) {
          console.log('MyClass.myMethod called:', str);
        },
      },
    },
  });

  // Use the registered class
  const instance = MyClass.$new();
  instance.myMethod('Hello!');
});
```

---

## Chapter 3 — Native (JNI) Hooking on Android

### Understanding JNI

Java Native Interface (JNI) allows Java code to call native C/C++ functions.

**JNI Function Signature:**

```c
// Java method: public native String getNativeString();
// JNI implementation:
JNIEXPORT jstring JNICALL
Java_com_example_app_MainActivity_getNativeString(
    JNIEnv* env,
    jobject thiz
) {
    return (*env)->NewStringUTF(env, "Native string");
}
```

**JNI Naming Convention:**

```
Java_<package>_<class>_<method>
Replace . with _
Replace _ with _1

Example:
com.example.app.MainActivity.getNativeString
→ Java_com_example_app_MainActivity_getNativeString
```

### Hooking JNI Functions

**Method 1: Hook by Symbol Name**

```javascript
// Find the native library
const nativeLib = Process.findModuleByName('libnative.so');

// Hook JNI function
Interceptor.attach(
  nativeLib.findExportByName('Java_com_example_app_MainActivity_getNativeString'),
  {
    onEnter: function (args) {
      // args[0] = JNIEnv*
      // args[1] = jobject (this)
      console.log('JNI function called');
      this.env = args[0];
    },
    onLeave: function (retval) {
      // retval is jstring
      // Read Java string from JNI
      const env = this.env;
      const getStringUTFChars = env.add(0x2a0).readPointer(); // JNIEnv offset

      console.log('Returning:', retval);
    },
  }
);
```

**Method 2: Hook JNI RegisterNatives**

Many apps dynamically register JNI functions. Hook `RegisterNatives` to intercept:

```javascript
const RegisterNatives = Module.findExportByName(null, 'art_quick_generic_jni_trampoline');

Interceptor.attach(RegisterNatives, {
  onEnter: function (args) {
    const methods = ptr(args[2]);
    const methodCount = args[3].toInt32();

    for (let i = 0; i < methodCount; i++) {
      const method = methods.add(i * Process.pointerSize * 3);
      const name = method.readPointer().readCString();
      const signature = method.add(Process.pointerSize).readPointer().readCString();
      const fnPtr = method.add(Process.pointerSize * 2).readPointer();

      console.log('Registering JNI method:');
      console.log('  Name:', name);
      console.log('  Signature:', signature);
      console.log('  Address:', fnPtr);

      // Hook the registered function
      Interceptor.attach(fnPtr, {
        onEnter: function (args) {
          console.log(name, 'called');
        },
      });
    }
  },
});
```

**Method 3: Hook JNIEnv Functions**

Hook JNI environment functions to intercept all JNI calls:

```javascript
Java.perform(function () {
  // Get JNIEnv pointer
  const env = Java.vm.getEnv();

  // JNIEnv is a struct of function pointers
  // Offset 0x2A4: NewStringUTF (example offsets for Android 11)
  const newStringUTF = env.handle.add(0x2a4).readPointer();

  Interceptor.attach(newStringUTF, {
    onEnter: function (args) {
      // args[0] = JNIEnv*
      // args[1] = const char* (UTF-8 string)
      const str = args[1].readCString();
      console.log('NewStringUTF:', str);
    },
    onLeave: function (retval) {
      console.log('Returned jstring:', retval);
    },
  });
});
```

### Advanced JNI Techniques

**Complete JNIEnv Hook Helper:**

```javascript
function hookJNIEnv() {
  Java.perform(function () {
    const env = Java.vm.getEnv();
    const handle = env.handle;

    // Hook common JNI functions
    const jniFunctions = {
      FindClass: 0x18,
      GetMethodID: 0x84,
      CallObjectMethod: 0xd0,
      NewStringUTF: 0x2a4,
      GetStringUTFChars: 0x2a8,
    };

    for (const [name, offset] of Object.entries(jniFunctions)) {
      const funcPtr = handle.add(offset).readPointer();

      Interceptor.attach(funcPtr, {
        onEnter: function (args) {
          console.log('[JNI]', name, 'called');

          // Log arguments based on function
          if (name === 'FindClass') {
            console.log('  Class:', args[1].readCString());
          } else if (name === 'GetMethodID') {
            console.log('  Method:', args[2].readCString());
            console.log('  Signature:', args[3].readCString());
          }
        },
      });
    }
  });
}
```

---

## Chapter 4 — Native Code Hooking (ARM/ARM64)

### ARM Assembly Basics for Hooking

**ARM64 (AArch64) Calling Convention:**

- Arguments: x0-x7 (64-bit), w0-w7 (32-bit)
- Return value: x0/w0
- Stack pointer: sp
- Frame pointer: x29
- Link register: x30 (return address)

**Common ARM64 Instructions:**

```assembly
ldr x0, [x1]        ; Load from memory
str x0, [x1]        ; Store to memory
mov x0, x1          ; Move register
add x0, x1, x2      ; Addition
sub x0, x1, x2      ; Subtraction
bl function         ; Branch with link (call)
ret                 ; Return (branch to x30)
```

### Hooking Native Functions

**Basic Native Hook:**

```javascript
const targetModule = Process.findModuleByName('libnative.so');
const targetFunc = targetModule.base.add(0x1234); // Offset from IDA/Ghidra

Interceptor.attach(targetFunc, {
  onEnter: function (args) {
    // ARM64: args[0] = x0, args[1] = x1, etc.
    console.log('Function called');
    console.log('  arg0 (x0):', args[0]);
    console.log('  arg1 (x1):', args[1]);

    // Read string argument
    if (!args[0].isNull()) {
      console.log('  String:', args[0].readUtf8String());
    }

    // Store for onLeave
    this.arg0 = args[0];
  },
  onLeave: function (retval) {
    console.log('Function returning:', retval);

    // Modify return value
    retval.replace(ptr(0x1)); // Return 1 instead
  },
});
```

**Function Replacement:**

```javascript
const targetFunc = Module.findExportByName('libc.so', 'strcmp');

Interceptor.replace(
  targetFunc,
  new NativeCallback(
    function (str1, str2) {
      const s1 = str1.readUtf8String();
      const s2 = str2.readUtf8String();

      console.log('strcmp replaced:', s1, 'vs', s2);

      // Always return 0 (equal)
      return 0;
    },
    'int',
    ['pointer', 'pointer']
  )
);
```

### Inline Assembly with Frida

**Using ARM64Writer:**

```javascript
const targetFunc = Module.findExportByName(null, 'secret_check');

Interceptor.attach(targetFunc, {
  onEnter: function (args) {
    // Allocate code cave
    const cave = Memory.alloc(Process.pageSize);

    Memory.patchCode(cave, 128, function (code) {
      const writer = new Arm64Writer(code, { pc: cave });

      // Write custom assembly
      writer.putPushRegPair('x0', 'x1'); // Save registers
      writer.putLdrRegRegOffset('x0', 'sp', 0); // Load from stack
      writer.putMovRegReg('x1', 'x0'); // Copy
      writer.putPopRegPair('x0', 'x1'); // Restore
      writer.putRet(); // Return

      writer.flush();
    });

    console.log('Code cave at:', cave);
  },
});
```

---

## Chapter 5 — Anti-Frida and Evasion

### Common Frida Detection Techniques

**1. Checking for frida-server process:**

```java
// App code
private boolean isFridaRunning() {
    BufferedReader reader = null;
    try {
        reader = new BufferedReader(new FileReader("/proc/self/maps"));
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.contains("frida")) {
                return true;
            }
        }
    } catch (Exception e) {
    }
    return false;
}
```

**Bypass:**

```javascript
// Rename frida-server binary
// Or hook file operations
const fopen = Module.findExportByName(null, 'fopen');
Interceptor.attach(fopen, {
  onEnter: function (args) {
    const path = args[0].readUtf8String();
    if (path === '/proc/self/maps') {
      console.log('Intercepted maps access');
      // Return fake file or redirect
    }
  },
});
```

**2. Port Scanning:**

Apps may scan for Frida's default port (27042).

**Bypass:**

```bash
# Change Frida server port
./frida-server -l 0.0.0.0:1234

# Use USB instead
frida -U -f com.example.app
```

**3. Stack Trace Checking:**

```java
// App checks stack traces for Frida frames
private boolean checkStack() {
    for (StackTraceElement element : Thread.currentThread().getStackTrace()) {
        if (element.getClassName().contains("frida")) {
            return true;
        }
    }
    return false;
}
```

**Bypass:**

```javascript
Java.perform(function () {
  const Thread = Java.use('java.lang.Thread');
  Thread.currentThread.overload().implementation = function () {
    const thread = this.currentThread();
    // Filter stack trace
    return thread;
  };
});
```

### Advanced Evasion Techniques

**Hooking Detection Functions:**

```javascript
function bypassFridaDetection() {
  // Hook strstr (used to find "frida" strings)
  const strstr = Module.findExportByName(null, 'strstr');
  Interceptor.attach(strstr, {
    onEnter: function (args) {
      this.haystack = args[0].readUtf8String();
      this.needle = args[1].readUtf8String();
    },
    onLeave: function (retval) {
      if (this.needle === 'frida' || this.needle === 'FRIDA') {
        retval.replace(ptr(0)); // Return NULL (not found)
      }
    },
  });

  // Hook access() for file existence checks
  const access = Module.findExportByName(null, 'access');
  Interceptor.attach(access, {
    onEnter: function (args) {
      const path = args[0].readUtf8String();
      if (path.includes('frida') || path.includes('/data/local/tmp/re.frida.server')) {
        // Return -1 (file not found)
        args[0].replace(ptr(0));
      }
    },
  });
}

Java.perform(bypassFridaDetection);
```

---

## Chapter 6 — Practical Examples

### SSL Pinning Bypass

```javascript
Java.perform(function () {
  console.log('SSL Pinning Bypass loaded');

  // Hook OkHttp3
  try {
    const CertificatePinner = Java.use('okhttp3.CertificatePinner');
    CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation =
      function (hostname, peerCertificates) {
        console.log('SSL Pinning bypassed for:', hostname);
        return; // Do nothing, allow any certificate
      };
  } catch (e) {}

  // Hook TrustManager
  const X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
  const SSLContext = Java.use('javax.net.ssl.SSLContext');

  const TrustManager = Java.registerClass({
    name: 'com.frida.TrustManager',
    implements: [X509TrustManager],
    methods: {
      checkClientTrusted: function (chain, authType) {},
      checkServerTrusted: function (chain, authType) {},
      getAcceptedIssuers: function () {
        return [];
      },
    },
  });

  const trustManager = TrustManager.$new();
  const sslContext = SSLContext.getInstance('TLS');
  sslContext.init(null, [trustManager], null);

  console.log('TrustManager replaced');
});
```

### Root Detection Bypass

```javascript
Java.perform(function () {
  // Hook common root detection methods

  // 1. File existence checks
  const File = Java.use('java.io.File');
  File.exists.implementation = function () {
    const path = this.getAbsolutePath();
    if (path.includes('su') || path.includes('magisk') || path.includes('xposed')) {
      console.log('Hiding root file:', path);
      return false;
    }
    return this.exists();
  };

  // 2. Build.TAGS check
  const Build = Java.use('android.os.Build');
  Build.TAGS.value = 'release-keys'; // Not "test-keys"

  // 3. Runtime.exec check
  const Runtime = Java.use('java.lang.Runtime');
  Runtime.exec.overload('java.lang.String').implementation = function (cmd) {
    if (cmd.includes('su') || cmd.includes('which')) {
      console.log('Blocked command:', cmd);
      throw new Error('Command not found');
    }
    return this.exec(cmd);
  };

  console.log('Root detection bypassed');
});
```

### Crypto Key Extraction

```javascript
Java.perform(function () {
  const SecretKeySpec = Java.use('javax.crypto.spec.SecretKeySpec');

  SecretKeySpec.$init.overload('[B', 'java.lang.String').implementation = function (
    key,
    algorithm
  ) {
    console.log('=== Crypto Key Detected ===');
    console.log('Algorithm:', algorithm);
    console.log('Key (hex):', hexdump(key, { ansi: true }));
    console.log('Key (base64):', Java.use('android.util.Base64').encodeToString(key, 0));

    return this.$init(key, algorithm);
  };

  // Also hook Cipher.init
  const Cipher = Java.use('javax.crypto.Cipher');
  Cipher.init.overload('int', 'java.security.Key').implementation = function (mode, key) {
    console.log('=== Cipher Initialized ===');
    console.log('Mode:', mode === 1 ? 'ENCRYPT' : 'DECRYPT');
    console.log('Key:', key);

    return this.init(mode, key);
  };
});
```

---

## Chapter 7 — Frida Tools and Ecosystem

### Essential Frida Commands

```bash
# List processes
frida-ps -U

# Attach to running app
frida -U com.example.app

# Spawn and attach
frida -U -f com.example.app

# Load script
frida -U -l script.js com.example.app

# Trace Java methods
frida-trace -U -j '*!*' com.example.app

# Trace native calls
frida-trace -U -i 'open*' com.example.app

# Python scripting
python my_frida_script.py
```

### Useful Frida Scripts

**Objection - Mobile Security Testing Framework:**

```bash
# Install
pip install objection

# Run
objection -g com.example.app explore

# In objection console
android hooking list classes
android hooking watch class com.example.MainActivity
android heap search instances com.example.User
```

**Frida-tools:**

```bash
# Compile frida-gadget
frida-compile agent.js -o compiled.js

# Create standalone agent
frida-gadget --version
```

---

## Chapter 8 — Building Reusable Frida Modules

### Module Template

```javascript
// my-module.js
(function () {
  const MyModule = {
    name: 'MyModule',

    init: function () {
      console.log('[*] Initializing', this.name);
      this.hookJava();
      this.hookNative();
    },

    hookJava: function () {
      Java.perform(function () {
        // Your Java hooks
      });
    },

    hookNative: function () {
      // Your native hooks
    },

    utils: {
      hexdump: function (buffer) {
        return hexdump(buffer, { ansi: true });
      },

      stacktrace: function () {
        console.log(
          Thread.backtrace(this.context, Backtracer.ACCURATE)
            .map(DebugSymbol.fromAddress)
            .join('\n')
        );
      },
    },
  };

  // Auto-initialize
  MyModule.init();

  // Export for use
  rpc.exports = {
    callMyFunction: function (arg) {
      return MyModule.someFunction(arg);
    },
  };
})();
```

### Best Practices

1. **Error Handling**: Always wrap in try-catch
2. **Performance**: Minimize onEnter/onLeave work
3. **Readability**: Use meaningful variable names
4. **Modularity**: Separate concerns into functions
5. **Documentation**: Comment complex logic

---

## References

### Official Resources

- [Frida Documentation](https://frida.re/docs/)
- [Frida JavaScript API](https://frida.re/docs/javascript-api/)
- [Frida CodeShare](https://codeshare.frida.re/)

### Android Resources

- [Android Internals](http://newandroidbook.com/)
- [ART Internals](https://source.android.com/docs/core/runtime)
- [JNI Specification](https://docs.oracle.com/javase/8/docs/technotes/guides/jni/)

### Tools

- [objection](https://github.com/sensepost/objection)
- [frida-tools](https://github.com/frida/frida-tools)
- [r2frida](https://github.com/nowsecure/r2frida)

---

_This guide provides a foundation for mastering Frida. Practice, experiment, and explore!_
