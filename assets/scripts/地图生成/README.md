# 地图框选管理系统

这是一个为Cocos Creator开发的地图框选管理系统，允许玩家通过鼠标框选的方式选择地图上的多个地块。

## 功能特性

- 🖱️ **鼠标框选**: 支持鼠标拖拽框选多个地块
- 🎨 **视觉反馈**: 根据选择区域大小显示不同颜色
  - 蓝色：有效选择（≤ 3x3）
  - 红色：无效选择（> 3x3）
- 📏 **尺寸限制**: 可配置最大选择区域尺寸
- 🔄 **实时更新**: 拖拽过程中实时显示选择状态
- 🎯 **精确定位**: 支持菱形网格的精确地块定位

## 组件说明

### 1. ImprovedMapGenerator（改进版地图生成器）
- 负责生成菱形网格地图
- 支持菱形遮罩和矩形地块两种模式
- 自动管理TileSelectionManager组件
- 提供地块访问和管理接口

### 2. TileSelectionManager（地块框选管理器）
- 处理鼠标输入事件
- 管理地块选择状态
- 控制地块颜色变化
- 提供选择区域验证
- 完全独立，不依赖地图生成器
- 通过数据传递方式与地图生成器协作

## 快速开始

### 1. 场景设置

1. 创建一个空的Node作为地图根节点
2. 添加 `ImprovedMapGenerator` 组件到该节点
3. 框选功能会自动启用（可通过enableTileSelection属性控制）

### 2. 组件配置

#### ImprovedMapGenerator 配置
```typescript
// 在编辑器中设置或通过代码配置
mapGenerator.tileSprites = [sprite1, sprite2, sprite3]; // 地块图片数组
mapGenerator.rows = 10;           // 网格行数
mapGenerator.columns = 10;        // 网格列数
mapGenerator.tileWidth = 100;     // 地块宽度
mapGenerator.tileHeight = 100;    // 地块高度
mapGenerator.useDiamondMask = true; // 使用菱形遮罩
mapGenerator.enableTileSelection = true; // 启用框选功能（默认true）
```

#### 自动配置
- TileSelectionManager会被自动创建和配置
- 摄像机引用会自动查找和设置
- 地块数据和地图配置会自动传递给框选管理器
- 框选管理器完全独立运行，无循环依赖

### 3. 使用方法

#### 基本操作
- **框选地块**: 按住鼠标左键并拖拽
- **完成选择**: 松开鼠标左键
- **清除选择**: 点击空白区域或调用清除方法

#### 代码示例
```typescript
// 获取框选管理器
const selectionManager = mapGenerator.getTileSelectionManager();

// 获取当前选择信息
const selectionInfo = selectionManager.getSelectionInfo();
if (selectionInfo) {
    console.log(`选择了 ${selectionInfo.tileCount} 个地块`);
    console.log(`选择区域: ${selectionInfo.width}x${selectionInfo.height}`);
    console.log(`是否有效: ${selectionInfo.isValid}`);
}

// 清除当前选择
selectionManager.clearSelection();

// 设置最大选择尺寸
selectionManager.setMaxSelectionSize(5);

// 获取选中的地块节点
const selectedTiles = selectionManager.getSelectedTiles();

// 启用/禁用框选功能
mapGenerator.setTileSelectionEnabled(false);
```

## API 参考

### ImprovedMapGenerator

#### 主要方法
- `generateMap()`: 生成地图
- `getTileAt(row, col)`: 获取指定位置的地块
- `getAllTiles()`: 获取所有地块
- `getTileAtWorldPosition(worldPos)`: 根据世界坐标获取地块
- `getMapInfo()`: 获取地图信息

#### 配置方法
- `setMapSize(rows, cols)`: 设置地图尺寸
- `setTileSize(width, height)`: 设置地块尺寸
- `toggleDiamondMask(useMask)`: 切换遮罩模式

### TileSelectionManager

#### 主要方法
- `getSelectedTiles()`: 获取选中的地块
- `getSelectionInfo()`: 获取选择区域信息
- `clearSelection()`: 清除选择
- `setMaxSelectionSize(size)`: 设置最大选择尺寸

#### 事件处理
- 自动处理鼠标输入事件
- 支持实时选择状态更新
- 提供选择完成回调

## 自定义配置

### 颜色配置
```typescript
// 修改选择框颜色
selectionManager.selectionBoxColor = new Color(0, 255, 255, 100);

// 修改有效选择颜色（蓝色）
selectionManager.validSelectionColor = new Color(0, 0, 255, 150);

// 修改无效选择颜色（红色）
selectionManager.invalidSelectionColor = new Color(255, 0, 0, 150);
```

### 尺寸限制
```typescript
// 设置不同的最大选择尺寸
selectionManager.maxSelectionSize = 5; // 允许5x5选择
```

## 注意事项

1. **摄像机引用**: 确保正确设置摄像机引用，用于坐标转换
2. **地块图片**: 至少提供一张地块图片才能正常生成地图
3. **性能考虑**: 大地图时建议适当调整更新频率
4. **坐标系统**: 系统使用世界坐标进行计算，确保节点层级正确

## 扩展功能

### 添加选择完成回调
```typescript
// 获取框选管理器并添加回调
const selectionManager = mapGenerator.getTileSelectionManager();

// 可以通过继承或修改TileSelectionManager来添加回调
// 或者通过轮询方式检测选择状态变化
let lastSelectionCount = 0;
this.schedule(() => {
    const currentSelection = selectionManager.getSelectedTiles();
    if (currentSelection.length !== lastSelectionCount) {
        lastSelectionCount = currentSelection.length;
        if (currentSelection.length > 0) {
            this.onSelectionChanged(currentSelection);
        }
    }
}, 0.1);
```

### 添加建造系统集成
```typescript
// 监听选择变化
onSelectionChanged(tiles: Node[]) {
    const selectionManager = this.mapGenerator.getTileSelectionManager();
    const info = selectionManager.getSelectionInfo();
    
    if (info && info.isValid) {
        // 执行建造逻辑
        this.buildingSystem.startBuilding(tiles, info);
    } else {
        // 显示错误提示
        this.showErrorMessage('选择区域过大，无法建造');
    }
}
```

## 故障排除

### 常见问题

1. **框选不响应**
   - 确认enableTileSelection属性为true
   - 检查控制台是否有摄像机查找失败的警告
   - 确认场景中存在摄像机组件

2. **地块颜色不变化**
   - 检查地块是否包含Sprite组件
   - 确认地块层级结构是否正确
   - 检查地块图片是否正确设置

3. **选择区域计算错误**
   - 检查地图生成器的网格配置
   - 确认坐标转换是否正确
   - 检查地块命名是否符合Tile_row_col格式

### 调试技巧

```typescript
// 开启调试日志
const selectionManager = mapGenerator.getTileSelectionManager();
console.log('选择信息:', selectionManager.getSelectionInfo());
console.log('地图信息:', mapGenerator.getMapInfo());
console.log('选中地块:', selectionManager.getSelectedTiles());
console.log('框选功能状态:', mapGenerator.enableTileSelection);
```

## 版本历史

- **v1.0.0**: 初始版本，支持基本框选功能
- 支持菱形网格地图
- 支持尺寸限制和颜色反馈
- 提供完整的API接口

## 许可证

本项目采用 MIT 许可证。