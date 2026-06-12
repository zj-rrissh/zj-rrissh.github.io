---
title: Linux 基础知识记录
date: 2026-06-11
tags: Linux，计算机基础
excerpt: 一次关于 Linux 文件系统、进程管理和进程间通信的复习手记
readingTime: 15 min read
---

# Linux 基础知识记录

最近在复习操作系统底层的东西，把 Linux 这部分的知识重新捋了一遍。这篇笔记不追求大而全，主要聚焦在我觉得平时最容易用到、面试也常被问到的三个方向：文件系统、进程管理、进程间通信。


---

## 文件系统

### "万物皆文件"到底是什么意思

刚学 Linux 的时候，听到"万物皆文件"这句话，总觉得有点玄乎。后来理解了才明白，这其实是说 Linux 把所有的 I/O 资源都抽象成了文件接口——你读一个普通文件、往终端写数据、从 socket 收网络包，底层用的都是同一套系统调用：`open`、`read`、`write`、`close`。这样设计的好处很明显，上层开发者只需要学会一套 API 就够了。

![七种文件类型的 ls -l 输出图，展示 - d l p s b c](/img/Linux_ls-l.png)

用 `ls -l` 看文件时，第一列第一个字符就代表了文件类型：`-` 是普通文件，`d` 是目录，`l` 是符号链接，`p` 是管道，`s` 是 socket，`b` 和 `c` 分别是块设备和字符设备。这里面最容易搞混的是普通文件和符号链接——符号链接其实就是个"快捷方式"，后面会带 `->` 指向原始文件。比如：

```bash
lrwxrwxrwx 1 root root 9 Jun 10  2025 /usr/bin/python -> python3
```

看到那个 `l` 和最后的 `-> python3` 了吗？这告诉我们 `/usr/bin/python` 只是个指向 `python3` 的链接文件。

### 文件权限的八进制记忆法

权限这事儿一开始接触觉得有点绕，但后来发现用八进制记特别简单。

![rwx 三组权限对应二进制位和八进制数字的图解](/img/quanxianchaijie.png)

每组权限三个位：读 r（4）、写 w（2）、执行 x（1）。加起来就是 0-7 的数字。比如 `rwx` = 4+2+1 = 7，`rw-` = 4+2+0 = 6，`r--` = 4+0+0 = 4。

整条权限串分成三组：owner、group、others。所以 `chmod 764 file` 的意思就是：文件主人有全部权限（7），同组人能读写（6），其他人只能读（4）。这个"三位数"的记法在写脚本时特别常用。

实际用 `chmod` 的时候，我一般两种方式混着用：

```bash
chmod 755 script.sh       # 八进制方式，干净利落
chmod u+x script.sh       # 符号方式，只加个执行权限
chmod a+x script.sh       # 给所有人加执行权限
```

需要留意的是，目录的权限含义和文件不太一样。目录的 r 让你能列内容，w 让你能创建删除文件，x 让你能 `cd` 进去。所以一个目录至少要有 `r-x` 才能正常访问里面的文件——这个坑我踩过好多次。

### 文件描述符和重定向

文件描述符（FD）是个很朴素的玩意儿——它就是内核给每个打开的文件分配的一个非负整数。每个进程都维护着一张文件描述符表，表里的每一项指向一个打开的文件对象。

三个预定义的标准 FD 值得记牢：

- **0** —— 标准输入 stdin，默认接键盘
- **1** —— 标准输出 stdout，默认输出到屏幕
- **2** —— 标准错误 stderr，也输出到屏幕，但和 1 是分开的

![进程→文件描述符表→打开文件表→inode 的引用链图解](/img/wenjianmiaoshubiao.png)

文件描述符的分配有个规则：**新打开的文件永远用当前最小的可用编号**。这意味着如果你关了 0，再打开一个新文件，它很可能就拿到 0 了。

Shell 里的重定向就是基于这个机制玩的：

```bash
ls > out.txt           # 把 stdout 写进文件
ls 2> err.txt          # 把 stderr 单独重定向
ls > out.txt 2>&1      # 把 stdout 和 stderr 合并到一起
ls &> out.txt          # 上面这行的简写
```

### 系统调用 vs C 标准库 I/O

Linux 的文件 I/O 实际上有两层 API 可以用。底层是系统调用，直接跟内核打交道；上层是 C 标准库提供的封装，带缓冲、用起来更顺手。理解这两层以及它们之间的关系，才算真正搞懂了文件 I/O。

---

#### 系统调用层：直接跟内核对话

系统调用是内核暴露给用户程序的接口。每次调用都会经历一次"用户态→内核态→用户态"的切换，有一定开销。常用的文件相关系统调用有这几个：

```c
int fd = open(const char *path, int flags, mode_t mode);   // 打开或创建文件
int close(int fd);                                           // 关闭文件
ssize_t read(int fd, void *buf, size_t count);              // 读取
ssize_t write(int fd, const void *buf, size_t count);       // 写入
off_t lseek(int fd, off_t offset, int whence);              // 调整读写位置
int stat(const char *path, struct stat *buf);               // 获取文件信息
int unlink(const char *path);                                // 删除文件
```

先看 `open()`。它最核心的参数就两个：文件路径和访问模式。比如：

```c
int fd = open("/path/to/file", O_RDONLY);
int fd = open("/path/to/file", O_CREAT | O_WRONLY, 0644);
```

第一行只读打开一个已有文件。第二行多了 `O_CREAT`，意思是"文件不存在就创建"，然后给了 0644 权限。这里 0644 就是前面讲的 rw-r--r--。注意，如果没传 `O_CREAT`，mode 参数会被忽略。常用的 flags 还有 `O_TRUNC`（清空文件再写）、`O_APPEND`（追加写）。

打开文件后，用 `read()` 和 `write()` 来读写：

```c
char buf[1024];
ssize_t n = read(fd, buf, sizeof(buf));   // 读到 buf 里，返回实际读取的字节数
if (n == -1) {
    // 出错了
} else if (n == 0) {
    // 读到文件末尾
}

const char *msg = "hello";
write(fd, msg, strlen(msg));              // 把数据写进文件
```

这里有个细节是返回值类型 `ssize_t`，它是有符号的，所以能返回 -1 表示出错。`size_t` 是无符号的，没法表示负数。

`lseek()` 用来调整文件当前的读写位置：

```c
off_t pos = lseek(fd, 0, SEEK_END);          // 跳到末尾，常用来看文件大小
lseek(fd, 0, SEEK_SET);                       // 跳到开头
lseek(fd, 100, SEEK_CUR);                     // 从当前位置往后跳 100 字节
```

`stat()` 可以拿到文件的各种元信息——大小、权限、类型、修改时间等等：

```c
struct stat st;
stat("/path/to/file", &st);
printf("文件大小: %ld\n", st.st_size);
printf("权限模式: %o\n", st.st_mode & 0777);
```

系统调用的特点是很"裸"——读写都直接跟内核交互，不给数据做缓冲。每次 `read()` 和 `write()` 都要切到内核态，频繁调用小数据量读写时性能并不好。

---

#### C 标准库 I/O：带缓冲的封装

为了解决上面的问题，C 标准库在系统调用外面包了一层——也就是 `FILE *` 系列函数。它们自带用户空间缓冲区，攒够了一批数据才真正调用 `read()`/`write()` 去碰内核，减少了上下文切换。

```c
FILE *fp = fopen(const char *path, const char *mode);  // 打开流
int fclose(FILE *fp);                                    // 关闭流
size_t fread(void *ptr, size_t size, size_t nmemb, FILE *fp);    // 二进制读
size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *fp); // 二进制写
char *fgets(char *s, int size, FILE *fp);               // 读一行（遇到 \n 停下）
int fputs(const char *s, FILE *fp);                     // 写字符串
int fprintf(FILE *fp, const char *fmt, ...);            // 格式化写入（printf 的文件版）
int fscanf(FILE *fp, const char *fmt, ...);             // 格式化读取（scanf 的文件版）
int fseek(FILE *fp, long offset, int whence);           // 调整位置
long ftell(FILE *fp);                                   // 当前位置
void rewind(FILE *fp);                                  // 回到开头
int fflush(FILE *fp);                                   // 刷新缓冲区
```

打开文件的方式在 mode 参数里指定：

```c
FILE *fp = fopen("test.txt", "r");      // 只读（对应 O_RDONLY）
FILE *fp = fopen("test.txt", "w");      // 只写，清空已有内容（O_WRONLY | O_CREAT | O_TRUNC）
FILE *fp = fopen("test.txt", "a");      // 追加写（O_WRONLY | O_CREAT | O_APPEND）
FILE *fp = fopen("test.txt", "r+");     // 读写（O_RDWR）
FILE *fp = fopen("test.txt", "w+");     // 读写，清空已有内容
```

逐行读取文本文件是 `fgets()` 最常见的用法：

```c
FILE *fp = fopen("log.txt", "r");
if (!fp) {
    perror("fopen");
    return 1;
}

char line[256];
while (fgets(line, sizeof(line), fp)) {
    // 处理每一行，line 里已经包含了末尾的 \n
    printf("读到: %s", line);
}

fclose(fp);
```

`fgets()` 会在遇到换行符或缓冲区填满时停下来，自动在末尾加 `\0`。手动处理逐行读的时候它比 `scanf()` 安全得多。

格式化输出到文件也很实用：

```c
FILE *fp = fopen("report.txt", "w");
fprintf(fp, "姓名: %s, 分数: %d\n", name, score);  // 和 printf 一样的格式，只是写文件
```

`fread()` 和 `fwrite()` 适合读写二进制数据：

```c
int data[100];
size_t n = fread(data, sizeof(int), 100, fp);   // 读 100 个 int
fwrite(data, sizeof(int), n, fp);                // 把读出来的写回去
```

缓冲区相关的操作偶尔也要用到：

```c
fflush(fp);        // 把缓冲区里的数据强制刷到内核（即使还没攒满）
setvbuf(fp, NULL, _IONBF, 0);   // 设置为无缓冲模式
setvbuf(fp, NULL, _IOLBF, BUFSIZ); // 设置为行缓冲模式
```

---

#### 两层的关系与选择

每个 `FILE *` 内部其实都封装了一个文件描述符。你可以通过 `fileno()` 把它掏出来：

```c
FILE *fp = fopen("test.txt", "r");
int fd = fileno(fp);     // 拿到藏在 FILE * 里面的文件描述符
```

反过来，`fdopen()` 可以把一个文件描述符包装成 `FILE *`：

```c
int fd = open("test.txt", O_RDONLY);
FILE *fp = fdopen(fd, "r");   // 给系统调用返回的 fd 套上 stdio 的缓冲层
```

那什么时候用哪一层呢？

**选系统调用的场景：**
- 需要直接跟内核交互时（比如 `ioctl`、`mmap` 这类没有 stdio 封装的调用）
- 高性能网络编程（epoll、非阻塞 I/O 必须用 fd 接口）
- 需要精确控制读写位置和缓冲区时

**选 C 标准库的场景：**
- 日常读写文本文件
- 需要格式化输入输出（`fprintf`、`fscanf`）
- 逐行处理文本（`fgets`）
- 追求代码简洁和可移植性

简单说：**需要精细控制或者极致性能就上系统调用，日常读写文件用 stdio 就够了。**

对了，还有一点值得注意：尽量不要混用同一文件上的 stdio 和系统调用操作。因为 stdio 在用户空间有缓冲区，底层文件描述符的读写位置可能已经不同步了。如果非要混用，记得在切换前 `fflush()`。

```c
// 反面教材 —— 混用可能导致数据错乱
FILE *fp = fopen("test.txt", "w");
fprintf(fp, "hello");       // 数据还在 stdio 缓冲区里
int fd = fileno(fp);
write(fd, "world", 5);      // 直接写进内核
// 文件里最终是 "hello" 还是 "worldhello"？不确定，取决于缓冲区何时被刷
```

这个例子很好地说明了：理解 buffered I/O 和 raw I/O 的差异，才能写出正确无误的程序。

---

## 进程管理

### fork 的"一次调用，两次返回"

`fork()` 创建子进程，这个函数的返回值设计是我见过最巧妙的一个——调一次，但会返回两次。

```c
pid_t pid = fork();

if (pid < 0) {
    // 创建失败
} else if (pid == 0) {
    // 我在子进程里
} else {
    // 我在父进程里，pid 就是子进程的 ID
}
```

为什么说它返回两次？因为 fork 成功后，父子进程各自从 fork 返回处继续执行，只不过父进程拿到的是子进程的 PID（大于 0），子进程拿到的是 0。这样就通过一个返回值区分了"我在哪个进程里"。


那子进程复制了父进程的哪些东西？几乎所有东西：代码段、数据段、堆栈、文件描述符表、环境变量……但这里有个关键优化叫**写时复制（Copy-on-Write）**。意思是 fork 之后，父子进程其实共享同一份物理内存，只有当其中一方真正要写入数据时，系统才会复制那页内存。这个机制非常巧妙，也使得 fork 的开销远比想象中小。

### exec 系列——换掉整个进程

如果说 fork 是"生孩子"，那 exec 就是"整容"。它把当前进程的代码段、数据段、堆栈整个换掉，变成另一个程序。调用成功后，之前的代码就不存在了——所以 exec 后面通常跟的是错误处理，因为如果 exec 成功，根本不会执行到这里。

```c
pid_t pid = fork();

if (pid == 0) {
    // 子进程：执行 ls 命令
    execl("/bin/ls", "ls", "-l", NULL);
    // 只有 exec 失败才会走到这里
    perror("exec failed");
    _exit(1);
} else {
    wait(NULL);  // 父进程等着
}
```

这是 fork + exec 的经典组合，shell 运行一条外部命令时就是这么干的：fork 出一个子进程，然后子进程 exec 去加载目标程序。

exec 有好几个变体——`execl`、`execv`、`execlp`、`execvp`……其实区别不大：带 `l` 的是参数列表方式，带 `v` 的是数组方式，带 `p` 的会在 PATH 环境变量里搜可执行文件。

### 僵尸 vs 孤儿，傻傻分不清

这两个概念经常一起出现，但其实是相反的情况。

**僵尸进程**：子进程跑完了，但父进程没有调用 `wait()` 来回收它的"遗物"。子进程虽然已经结束，但还在进程表里占着一个位置，这就是僵尸。处理方式很简单——父进程用 `wait()` 或 `waitpid()` 回收就行。

```c
int status;
wait(&status);
if (WIFEXITED(status)) {
    printf("子进程退出码: %d\n", WEXITSTATUS(status));
}
```

**孤儿进程**：反过来，父进程先挂了，子进程还在跑。这时候孤儿进程会被 `systemd`（PID=1 的进程）收养，由它来负责回收。所以孤儿其实不可怕，系统会管它。

![就绪→运行→阻塞→僵尸状态转移路径](/img/zombie_process.png)

### exit 和 _exit 的差别

这个点我初学的时候一直没搞明白，后来才理解本质区别：`exit()` 是 C 标准库的函数，`_exit()` 是系统调用。

`exit()` 在退出之前会做清理工作——刷新 I/O 缓冲区、调用 `atexit` 注册的清理函数等等。而 `_exit()` 不干这些，直接让内核把进程干掉。

```c
printf("Hello");
exit(0);    // 刷新缓冲区，能输出 Hello
_exit(0);   // 不刷新，Hello 可能还留在缓冲区里就丢了
```

这俩的区别在哪儿用得上？就在上面说的 fork + exec 场景里——子进程的 `exec()` 如果失败，应该用 `_exit()` 而不是 `exit()`。原因是子进程复制了父进程的缓冲区，如果子进程去刷新缓冲区，可能会把父进程的正常数据也搞乱。所以子进程里一律用 `_exit` 退出会更安全。

---

## 进程间通信（IPC）

### 管道——最古老的 IPC

管道（Pipe）是所有 IPC 方式里最古老也最直观的。Shell 里的 `|` 符号，底层就是管道。

```c
int fd[2];
pipe(fd);    // fd[0] 读端, fd[1] 写端
```

![匿名管道在父子进程间的用法，fd[0] 和 fd[1] 连接关系](/img/pipe.png)

创建管道后一般紧接着 fork，然后父子进程各关掉不需要的一端——一个关读端，一个关写端，这样数据才能单向流动。管道是半双工的，如果两个方向都要通信，得建两个管道。

管道的精髓在于四个边界情况，我当年面阿里的时候就被问到过：

- **写端已关，读端继续读**——管道空了，`read` 返回 0，表现像读到 EOF
- **写端还在，读端在读空管道**——`read` 会阻塞，等数据来
- **读端已关，写端还在写**——写端收到 `SIGPIPE` 信号，被关闭
- **管道写满了，写端还在写**——`write` 阻塞，等读端取走数据

这几个情况如果能讲清楚，面试官一般会觉得你对管道理解到位了。

匿名管道只能用于有亲缘关系的进程。如果想让任意进程通信，可以用**命名管道（FIFO）**，用 `mkfifo` 创建，用法和文件差不多：

```bash
mkfifo mypipe
echo "hello" > mypipe &    # 写到管道
cat mypipe                  # 从管道读
```

### 消息队列——解耦才是王道

管道的最大问题是通信双方必须同时在线——写端和读端需要同时存在。消息队列解决的就是这个问题。

你可以把消息队列想象成一个"邮筒"。进程 A 把消息投进去，然后就不用管了。进程 B 啥时候有空了来取就行，双方不需要同时运行。这就是所谓的**异步解耦**。

另一个区别是数据结构。管道传的是无结构的字节流——一个 `write` 和一个 `read` 之间没有消息边界。而消息队列里的每条消息都有明确的类型和长度：

```c
struct msgbuf {
    long mtype;          // 消息类型，可以用来区分不同类别的消息
    char mtext[256];     // 消息内容
};
```


接收方还可以按消息类型来取——只想读类型为 1 的消息，系统能做到。

当然消息队列也有缺点：多了一次内核态和用户态之间的数据复制，速度不如共享内存快。

### 共享内存——为什么它最快

共享内存是所有 IPC 里速度最快的。原因很简单：它不需要数据复制。

管道和消息队列都是"进程 A → 内核 → 进程 B"的路径，数据要复制两次。而共享内存是多个进程各自把同一块物理内存映射到自己的虚拟地址空间里，然后直接读写，**零次复制**。


你可以想象成一块黑板——进程 A 在黑板上写，进程 B 转身就能看到。不需要"传纸条"。

```c
// 创建一块 4KB 的共享内存
int shmid = shmget(IPC_PRIVATE, 4096, IPC_CREAT | 0666);

// 附加到当前进程的地址空间
void *ptr = shmat(shmid, NULL, 0);

// 直接写
sprintf(ptr, "Hello from PID %d", getpid());

// 另一个进程 attach 上来直接读
printf("Read: %s\n", (char *)ptr);

// 用完分离
shmdt(ptr);
```

但共享内存有一个大问题——**同步**。因为多个进程可以同时读写同一块内存，不加保护的话就会出现数据竞争。比如进程 A 写到一半，进程 B 来读，读到的就是半成品数据。

解决办法是配合**信号量**或**互斥锁**使用：

```c
sem_wait(sem);             // 等锁
sprintf(shm_ptr, "data");  // 写共享内存
sem_post(sem);             // 解锁
```

这个"共享内存 + 信号量"的组合，是 Linux 下高性能 IPC 的经典模式。

---

## 最后

写这篇笔记的时候，我把 IPC 的几种方式又对比了一下。拿**管道**比作两个人对着管子喊话——简单直接但只能单向；**消息队列**像发邮件——发出去了就不用管了，对方啥时候看都行；**共享内存**就像大家用同一块黑板——最快最直接，但得约定好不能同时写。

如果你跟我一样刚接触这些概念不久，建议动手写写 demo 跑一遍。`fork()` 那点代码量跑完看 `pstree` 观察进程树，会比只看文字清楚得多。遇到不懂的，可以 `strace` 追踪系统调用、`man` 查手册——这两样工具能帮你理解任何 Linux 程序的内核交互。

明天复习准备看看信号和 socket 编程，到时候再写一篇出来。
