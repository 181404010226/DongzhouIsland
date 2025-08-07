# 交互管理系统

这个交互管理系统提供了完整的玩家输入处理功能，包括相机拖动和地块框选。

## 功能特性

### 1. 相机拖动
- 玩家可以通过拖动屏幕来移动相机
- 支持自定义移动速度
- 自动检测相机组件

### 2. 长按框选
- 长按0.5秒后进入地块框选模式
- 可自定义长按触发时间
- 长按期间移动距离过大会取消长按，转为相机拖动
- 与TileSelectionManager无缝集成

## 组件说明

### InteractionManager
主要的交互管理器，负责处理所有输入事件。

**属性：**
- `cameraNode`: 相机节点（可选，会自动查找）
- `tileSelectionManager`: 地块选择管理器
- `cameraMoveSpeed`: 相机移动速度（默认1.0）
- `longPressTime`: 长按触发时间（默认0.5秒）

**主要方法：**
- `setTileSelectionManager(manager)`: 设置地块选择管理器
- `setCameraMoveSpeed(speed)`: 设置相机移动速度
- `setLongPressTime(time)`: 设置长按触发时间
- `isDraggingCamera()`: 检查是否正在拖动相机
- `isCurrentlyLongPressing()`: 检查是否正在长按
- `isLongPressSelectionActive()`: 检查是否已激活长按选择

### InteractionExample
使用示例组件，展示如何将各个组件组合使用。

**属性：**
- `mapGenerator`: 地图生成器
- `interactionManager`: 交互管理器
- `tileSelectionManager`: 地块选择管理器

## 使用方法

### 1. 基本设置

1. 在场景中创建一个空节点作为管理器容器
2. 添加以下组件到该节点：
   - `InteractionManager`
   - `TileSelectionManager`
   - `InteractionExample`（可选，用于快速设置）

### 2. 手动配置

```typescript
// 获取组件
const interactionManager = this.node.getComponent(InteractionManager);
const tileSelectionManager = this.node.getComponent(TileSelectionManager);

// 建立连接
interactionManager.setTileSelectionManager(tileSelectionManager);

// 初始化地块选择管理器
const tiles = getAllTiles(); // 获取所有地块
const mapConfig = {
    rows: 10,
    columns: 10,
    tileSize: 100
};
tileSelectionManager.initialize(tiles, mapConfig);
tileSelectionManager.setEnabled(false); // 初始禁用，由交互管理器控制
```

### 3. 自定义配置

```typescript
// 设置相机移动速度
interactionManager.setCameraMoveSpeed(2.0);

// 设置长按触发时间
interactionManager.setLongPressTime(0.3);

// 设置最大选择尺寸
tileSelectionManager.setMaxSelectionSize(5);
```

## 交互逻辑

### 输入处理流程

1. **鼠标按下**：
   - 开始长按检测
   - 暂时禁用地块选择管理器
   - 记录起始位置

2. **鼠标移动**：
   - 检查移动距离
   - 如果移动距离过大：取消长按，开始相机拖动
   - 如果正在拖动：移动相机

3. **长按触发**（0.5秒后）：
   - 启用地块选择管理器
   - 将鼠标按下事件传递给地块选择管理器
   - 进入框选模式

4. **鼠标抬起**：
   - 停止相机拖动
   - 重置长按状态

### 状态管理

- `isDragging`: 是否正在拖动相机
- `isLongPressing`: 是否正在长按检测
- `longPressTriggered`: 是否已触发长按选择

## 注意事项

1. **组件依赖**：InteractionManager需要与TileSelectionManager配合使用
2. **初始化顺序**：确保地图生成完成后再初始化地块选择管理器
3. **相机设置**：如果没有手动指定相机，系统会自动查找场景中的相机
4. **性能考虑**：长按检测在update中进行，频率较高

## 扩展建议

1. **触摸支持**：可以扩展支持移动设备的触摸事件
2. **手势识别**：可以添加更多手势识别功能
3. **快捷键**：可以添加键盘快捷键支持
4. **多点触控**：支持缩放等多点触控操作