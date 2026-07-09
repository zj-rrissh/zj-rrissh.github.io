---
title: 第一次使用MAT
date: 2026-6-26
tags: JVM调试
readingTime: 5 min read
---

以前开发时不太注意各种报错，觉得只要修改代码就行。但是最近重点研究 JVM 后，发现使用一些工具分析底层数据、引用、内存等走向非常必要。今天我用 MAT 做了一个简易测试。

MAT 专注于内存分析，可以快速定位导致 OOM 的罪魁祸首。它通过查看对象引用关系、实例数量和内存占用，帮助我们找到问题位置并进行修正。

要注意的是，MAT 主要用于 OOM 发生后的根因分析，它是解决 OOM 这类“确定性”问题的工具。虽然是在问题发生后再分析，但如果哪天遇到 OOM，能够回溯定位总比一头雾水好。

## 复现 OOM 的测试代码

为了测试，我手写了一个简易的 OOM 演示程序：

```java
import java.util.ArrayList;
import java.util.List;

public class HeapOOM {
    static class OOMObject{}
    public static void main(String[] args) {
        List<OOMObject> list = new ArrayList<>();
        while (true){
            list.add(new OOMObject());
        }
    }
}
```
因为循环没有终止条件，所以很快JVM堆就会被OOMObject对象挤满，最后造成OOM。

## 运行方式

编译运行后：

![OOM 复现截图](/img/mat-oom-1.png)

这里使用 `-Xms200m -Xmx200m` 把 JVM 初始堆和最大堆都设为 200MB，以便快速触发 OOM；`-XX:+HeapDumpOnOutOfMemoryError` 会在 OOM 时生成堆转储文件，然后可以用 MAT 来打开分析。

由于我的代码放在 WSL2 中，而 MAT 下载在 Windows 上，打开堆转储文件时 I/O 较多，所以我把堆转储文件复制到 Windows 后再解析。注意：最新版 MAT 对 Java 版本要求较高，建议使用 Java 21 及以上。

## MAT 分析界面

打开后会加载数据，同时本地会生成很多辅助文件，页面上会出现对应数据：

![MAT 分析界面截图](/img/mat-oom-2.png)

这里用扇形图展示各个对象的保留大小，重点观察 Histogram 和 Dominator Tree。

![MAT 扇形图截图](/img/mat-oom-3.png)

这里还给出了问题嫌疑分析。它分析出 `java.lang.Thread` 占用了最大部分，其中包含 9,230,101 个 `OOMObject` 对象。

## Histogram 表说明

![Histogram 数据截图](/img/mat-oom-4.png)

这里有三个字段：

- `Objects`：该类当前内存堆中存活的实例总数量
- `Shallow Heap`：该类所有实例自身所占用的内存大小，不包括它引用的其他对象
- `Retained Heap`：如果该类所有实例被 GC 回收，总共能释放的内存大小

按 `Retained Heap` 从大到小排列，可以看到 `java.lang.Object[]`、`java.lang.Thread`、`com.oom.HeapOOM$OOMObject` 的保留堆都比较大。因为 `ArrayList` 底层就是 `Object[] elementData`，所以在循环添加时，`elementData` 会不断扩容。

数组在 Java 里一旦创建，长度是固定的。那为什么 ArrayList 感觉能无限添加呢？
当你调用 add() 时，它会检查当前元素的个数 size 是否等于底层数组的长度。

如果满了：它会创建一个新的、更大的数组（通常是原容量的 1.5 倍），然后调用 System.arraycopy() 或者 Arrays.copyOf() 把旧数组里的所有元素全部复制过去。最后把旧的数组丢弃（等待 GC 回收）。

结合 MAT 截图，`Object[]` 是因为 `while(true)` 循环触发了无数次扩容，最终把 923 万个元素装进了一个超大的新数组里。

![ArrayList 扩容截图](/img/mat-oom-5.png)

这里的 `Thread` 类保留堆很大，是因为它内部持有 `Object[]`，占据了大部分内存。
```text
- Thread @ 0xf55924b0                                  [Retained: 184,602,272]
    ├─ java.lang.ThreadGroup ...
    ├─ java.lang.Object[] ... ← 这是某个小数组 (376 KB)
    ├─ ...                                                 
    └─ java.util.ArrayList
         └─ java.lang.Object[9230100] @ 0xfd500000      [Retained: ~184,602,016]  ← 大数组在这里！

```
```text
main 线程 (GC Root)
  → 栈帧局部变量 list
    → ArrayList 对象
      → elementData (Object[9230100])     ← 被 Thread 支配
        → 923 万个 OOMObject               ← 被 Object[] 支配
```

所以本质上循环导致无限创建OOMObject实例对象存储到ArrayList中，ArrayList被迫不断扩容，导致Object[]不断增大，最终导致OOM。

---

这一次是简单试用 MAT，感觉它对定位问题非常方便。之后我准备尝试使用 Arthas，对实际开发中的问题进行定位与分析。

![MAT 分析总结截图](/img/mat-oom-summary.png)