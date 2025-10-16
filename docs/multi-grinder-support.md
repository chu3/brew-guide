# 方案多磨豆机支持功能设计

## 功能概述
允许方案支持多个磨豆机的研磨度数据，用户可以在编辑时选择不同的磨豆机，并为每个磨豆机设置对应的研磨度。

## 背景问题

### 当前痛点
1. 自定义方案只能存储一个磨豆机的研磨度数据
2. 当自定义器具设定的磨豆机被删除或用户没有该磨豆机时，显示异常
3. 用户无法为同一方案添加不同磨豆机的研磨度参考值
4. 切换磨豆机后，之前的研磨度数据会丢失

### 场景示例
- 用户有 Comandante 和 1Zpresso K-Plus 两款磨豆机
- 自定义方案原本记录的是 Comandante 的 25 刻度
- 用户想用 K-Plus 时，需要手动换算刻度，且无法保存 K-Plus 的刻度数据
- 下次再切换回 Comandante 时，又要重新输入 25 刻度

## 功能设计

### 1. 数据结构变更

#### 当前结构
```typescript
interface MethodParams {
  grindSize: string;  // 格式："grinderId:value" 或 "value"
  // ... 其他参数
}
```

#### 新结构
```typescript
interface MethodParams {
  grindSize: string;  // 保持兼容性，存储主要/默认的研磨度
  grinderSettings?: {  // 新增：多磨豆机研磨度映射
    [grinderId: string]: string;  // grinderId -> 研磨度值
  };
  // ... 其他参数
}
```

#### 示例数据
```json
{
  "grindSize": "comandante:25",
  "grinderSettings": {
    "comandante": "25",
    "1zpresso-k-plus": "4.5.0",
    "generic": "中细"
  }
}
```

### 2. UI 交互设计

#### 2.1 磨豆机选择下拉栏

**位置**
- 冲煮界面的参数编辑栏
- 手动添加笔记的方案参数编辑区

**下拉栏内容**
```
我的磨豆机
├─ Comandante (25) ✓        // 用户拥有的磨豆机，括号内显示当前方案的刻度值，✓ 表示已选中
├─ 1Zpresso K-Plus          // 用户拥有但方案未设定该磨豆机的刻度
└─ Timemore C2 (3.5)        // 用户拥有的其他磨豆机

方案设定的磨豆机
└─ Kinu M47 (15)            // 方案中设定的但用户未拥有的磨豆机（灰色显示）
```

**交互逻辑**
1. 点击磨豆机名称
2. 如果该磨豆机有存储的研磨度值 → 自动填充研磨度输入框
3. 如果该磨豆机没有存储的研磨度值 → 研磨度输入框为空
4. 用户修改研磨度后，自动保存到 `grinderSettings[grinderId]`

#### 2.2 研磨度输入框行为

**场景 A：切换到有数据的磨豆机**
- 输入框自动填充该磨豆机的研磨度值
- 用户可以修改，修改后立即更新到对应磨豆机的设定

**场景 B：切换到无数据的磨豆机**
- 输入框清空（或显示占位符提示）
- 用户输入研磨度后，自动添加到 `grinderSettings`

**场景 C：方案设定的磨豆机被删除**
- 磨豆机下拉栏中仍显示该磨豆机（标记为"方案设定"）
- 用户可以选择该磨豆机查看/使用其研磨度
- 用户也可以切换到自己拥有的磨豆机

### 3. 数据保存策略

#### 3.1 保存时机
- 用户切换磨豆机时，保存当前研磨度到 `grinderSettings[当前grinderId]`
- 用户修改研磨度并失去焦点时，保存到 `grinderSettings[当前grinderId]`
- 保存笔记/方案时，将当前选中的磨豆机和研磨度更新到 `grindSize` 字段

#### 3.2 兼容性处理
- 读取旧数据：如果 `grinderSettings` 不存在，从 `grindSize` 解析并初始化
- 写入数据：同时更新 `grindSize`（主要值）和 `grinderSettings`（完整映射）
- 向后兼容：旧版本仍能通过 `grindSize` 读取默认值

### 4. 核心功能实现

#### 4.1 数据读取
```typescript
// 获取指定磨豆机的研磨度
function getGrindSizeForGrinder(
  method: Method, 
  grinderId: string
): string | undefined {
  // 优先从 grinderSettings 读取
  if (method.params.grinderSettings?.[grinderId]) {
    return method.params.grinderSettings[grinderId];
  }
  
  // 兼容旧数据：从 grindSize 解析
  const { grinderId: mainGrinderId, value } = parseGrindSize(method.params.grindSize);
  if (mainGrinderId === grinderId) {
    return value;
  }
  
  return undefined;
}
```

#### 4.2 数据写入
```typescript
// 更新指定磨豆机的研磨度
function updateGrindSizeForGrinder(
  method: Method,
  grinderId: string,
  value: string
): Method {
  return {
    ...method,
    params: {
      ...method.params,
      grindSize: combineGrindSize(grinderId, value), // 更新主值
      grinderSettings: {
        ...method.params.grinderSettings,
        [grinderId]: value
      }
    }
  };
}
```

#### 4.3 磨豆机列表生成
```typescript
// 获取可用的磨豆机列表（用户的 + 方案的）
function getAvailableGrinders(
  method: Method,
  userGrinders: string[],
  customGrinders: CustomGrinder[]
): GrinderOption[] {
  const options: GrinderOption[] = [];
  
  // 用户拥有的磨豆机
  userGrinders.forEach(grinderId => {
    const grindSize = getGrindSizeForGrinder(method, grinderId);
    options.push({
      grinderId,
      name: getGrinderName(grinderId, customGrinders),
      grindSize,
      source: 'user',
      available: true
    });
  });
  
  // 方案中设定但用户未拥有的磨豆机
  const methodGrinders = Object.keys(method.params.grinderSettings || {});
  methodGrinders.forEach(grinderId => {
    if (!userGrinders.includes(grinderId)) {
      options.push({
        grinderId,
        name: getGrinderName(grinderId, customGrinders),
        grindSize: method.params.grinderSettings![grinderId],
        source: 'method',
        available: false
      });
    }
  });
  
  return options;
}
```

### 5. 显示逻辑调整

#### 5.1 方案列表显示
- 优先显示用户当前使用的磨豆机的研磨度
- 如果用户的磨豆机没有数据，显示方案的主要研磨度（`grindSize`）
- 显示格式：`磨豆机名称 研磨度值`

#### 5.2 磨豆机推荐逻辑
- 保持现有的智能推荐逻辑
- 但不强制转换，只在用户选择磨豆机时应用
- 如果方案有该磨豆机的数据，直接使用，不进行刻度转换

### 6. 边界情况处理

#### 6.1 磨豆机被删除
- **方案中的磨豆机被删除**
  - 保留在 `grinderSettings` 中
  - 下拉栏显示为"方案设定的磨豆机"（灰色/禁用状态）
  - 用户可以查看但建议切换到拥有的磨豆机

#### 6.2 数据迁移
- **从旧版本升级**
  - 首次加载时，将 `grindSize` 的数据迁移到 `grinderSettings`
  - 不修改原有 `grindSize` 字段，保持兼容性

#### 6.3 空数据处理
- 用户切换到没有数据的磨豆机 → 研磨度输入框为空
- 用户输入后自动保存，下次切换回来能看到之前输入的值

## 实现阶段

### Phase 1：数据结构与基础功能
- [ ] 扩展 `MethodParams` 类型定义，添加 `grinderSettings` 字段
- [ ] 实现 `getGrindSizeForGrinder` 读取函数
- [ ] 实现 `updateGrindSizeForGrinder` 写入函数
- [ ] 实现数据迁移逻辑（从旧格式到新格式）

### Phase 2：UI 组件开发
- [ ] 设计磨豆机选择下拉组件 `GrinderSelector`
- [ ] 实现分组显示（我的磨豆机 / 方案设定的磨豆机）
- [ ] 集成到冲煮参数栏（NavigationBar）
- [ ] 集成到笔记表单（BrewingNoteForm）

### Phase 3：交互逻辑完善
- [ ] 切换磨豆机时自动填充/清空研磨度
- [ ] 修改研磨度时自动保存到对应磨豆机
- [ ] 保存笔记时同步更新 `grindSize` 和 `grinderSettings`

### Phase 4：显示逻辑优化
- [ ] 调整方案列表的研磨度显示逻辑
- [ ] 优化磨豆机推荐系统，避免不必要的转换
- [ ] 处理磨豆机被删除后的显示

### Phase 5：测试与优化
- [ ] 测试数据迁移兼容性
- [ ] 测试多磨豆机切换流程
- [ ] 测试边界情况（删除磨豆机、空数据等）
- [ ] 性能优化与用户体验改进

## 技术要点

### 状态管理
- 在编辑状态下维护当前选中的磨豆机ID
- 使用 `useState` 管理临时的研磨度输入
- 切换磨豆机时先保存当前状态，再加载新磨豆机的数据

### 数据持久化
- 修改 `saveCustomMethod` 函数，支持保存 `grinderSettings`
- 修改 `saveBrewingNote` 函数，同步保存多磨豆机数据
- 确保旧版本读取时的兼容性

### 性能考虑
- 避免频繁的数据保存操作（使用 debounce）
- 磨豆机列表缓存，避免重复计算
- 下拉栏懒加载，仅在展开时渲染完整列表

## 用户价值

1. **数据保留**：切换磨豆机时不会丢失之前的研磨度设定
2. **多设备支持**：为不同磨豆机记录不同的研磨度参考值
3. **灵活性**：可以查看方案原始设定的磨豆机和刻度
4. **渐进式采集**：逐步积累不同磨豆机的研磨度数据
5. **分享友好**：分享方案时包含多种磨豆机的数据，适用性更广

## 后续扩展

### 可能的增强功能
1. **研磨度对比**：并排显示多个磨豆机的刻度对比
2. **智能推荐**：基于用户历史数据，推荐最常用的磨豆机
3. **批量填充**：基于现有磨豆机的刻度，自动换算其他磨豆机的刻度
4. **统计分析**：分析用户最常用的磨豆机和刻度范围
5. **社区数据**：聚合社区中同一方案的不同磨豆机数据

## 注意事项

1. **向后兼容**：确保旧版本能正常读取新数据
2. **数据完整性**：`grindSize` 和 `grinderSettings` 保持同步
3. **用户体验**：切换磨豆机时要流畅，避免闪烁或延迟
4. **错误处理**：磨豆机不存在时的友好提示
5. **性能影响**：多磨豆机数据不应影响应用加载速度

---

**文档版本**：v1.0  
**创建时间**：2025年10月17日  
**状态**：设计中  
**预计开发周期**：2-3周
