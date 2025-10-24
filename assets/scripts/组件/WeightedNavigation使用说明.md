# WeightedNavigation 组件使用说明

本组件提供基于 A* 的单脚本导航：以挂载节点坐标系为中心，均分 12 个方向进行离散搜索；支持多个区域组（由若干节点构成），每个区域组通过其节点的 `UITransform` 矩形来定义“高代价区域”，从而影响路径选择；路径只计算一次，运行时沿该路径移动，并在编辑器中以只读方式可视化。

## 组件功能概览
- 12 方向离散搜索，步长由 `stepLength` 控制。
- 单次 A* 路径计算，运行时按 `moveSpeed` 跟随路径。
- 区域权重：命中某节点的 `UITransform` 矩形时，移动代价按该组 `weight` 放大。
- 路径预览：可选 `Graphics` 绘制只读路径线段，随场景坐标自动转换。
- 公共接口：`setTarget(node)` 设置目标并重算；`recomputePath()` 重新计算当前目标的路径。

## 安装与挂载
- 在需要导航的节点上添加 `WeightedNavigation` 组件。
- 设置目标节点 `targetNode`（世界坐标有效）。
- 需要可视化时，勾选 `showPath`。可手动拖拽一个 `Graphics` 到 `pathGraphics`，否则组件会在运行时自动创建一个名为 `PathPreview` 的子节点并用于绘制。

## 属性说明
- `stepLength: number` 导航步长，决定 A* 的离散采样间距（默认 50）。
- `moveSpeed: number` 跟随路径的实际移动速度（单位/秒，默认 120）。
- `maxSearchSteps: number` A* 最大扩展步数，防止搜索过久（默认 4000）。
- `maxSearchRadius: number` 从起点出发的最大搜索半径，超出将被剪枝（默认 4000）。
- `maxExpandPerFrame: number` 分帧计算：每帧最多进行的节点展开次数（默认 200）。
- `regionGroups: WeightedNodeGroup[]` 区域组数组，每组包含若干节点和一个权重 `weight`。命中这些节点的 `UITransform` 矩形时，代价放大。
- `targetNode: Node | null` 目标节点。运行时路径将朝该目标计算一次。
- `recomputeOnStart: boolean` 勾选后立即重算一次路径，随后自动复位为未勾选（默认 false）。
- `showPath: boolean` 是否在编辑器/运行时预览路径（默认 true）。
- `pathGraphics: Graphics | null` 用于绘制预览的画布组件，可选。

## 区域权重设置（UITransform 矩形）
- 在需要影响路径的节点上添加 `UITransform`，其 `contentSize` 与 `anchorPoint` 定义了矩形区域。
- 将这些节点加入某个 `WeightedNodeGroup.nodes`，并为该组设置 `weight`（建议 ≥ 1.0）。
- 当前权重组合策略为取最大值：如果同时命中多个组，使用其中最大的 `weight` 作为该步的代价倍数。

## 路径计算与移动
- 计算：A* 在 12 个方向上以 `stepLength` 采样邻居，代价为 `stepLength * weightAt(neighbor)`，其中 `weightAt` 来自区域命中判定。
- 跟随：`update` 中根据 `moveSpeed` 沿着计算好的 `path` 前进；当到达某个路径点（误差阈值很小）时推进到下一个路径点。
- 终止：当到达最终路径点或未找到路径（空路径）时，组件不再移动。

## 路径可视化
- 若 `showPath` 为 true，会将世界坐标路径转换为 `pathGraphics` 的局部坐标并绘制折线。
- 未提供 `pathGraphics` 时将自动创建一个名为 `PathPreview` 的子节点（运行时），用于绘制路径线段。

## 公共接口
- `setTarget(node: Node | null)` 设置目标节点并立即重新计算路径。
- `recomputePath()` 对当前 `targetNode` 重新计算路径。

## 常见问题与排查
- 设置某组 `weight = 2` 后“不移动”：通常表示 A* 未找到路径（返回空路径），跟随逻辑会直接早退。可尝试：
  - 将 `stepLength` 降到 20–30，使采样更细致，绕过矩形边缘更容易；
  - 提高 `maxSearchSteps`（如 10000–15000）与 `maxSearchRadius`（如 6000–8000），放宽搜索；
  - 增加方向采样（例如扩展到 16 或 24 个方向），提升绕行能力；
  - 如果希望“禁止穿越”而非“提高代价”，可以将命中区域直接视为不可达（需要在代码中过滤这些邻居）。
- 路径线未显示：确认 `showPath = true`，并确保存在可用的 `Graphics`。若自动创建的 `PathPreview` 无法绘制，请在该子节点上添加一个 `UITransform` 并设置合理的尺寸（例如 2000×2000）。

## 高级用法与建议
- 权重组合策略：默认使用最大值。如果需要叠乘或相加，可以在 `weightAt` 中调整（注意防止代价爆炸）。
- 键值量化：当前节点键是对世界坐标 `x/y` 进行四舍五入后拼接，必要时可改为以 `stepLength` 归一化的键（例如 `Math.round(x/stepLength)`），可改善绕行稳定性。
- 单次路径：本组件路径只计算一次。如目标或权重区域在运行时发生变化，调用 `recomputePath()` 以更新路径。

## 适用场景与限制
- 适用于 2D 平面、以 UI 矩形作为“软障碍/高代价区域”的路径规划。
- 不内建“硬障碍”与碰撞检测；想要不可穿越效果需在邻居生成时过滤。
- A* 搜索是在离散空间进行的，参数选择（`stepLength`/方向数/步数与半径限制）会显著影响可达性与性能。

## 变更记录
- 使用 `UITransform` 矩形作为区域命中判定，替代此前的圆形半径逻辑。

如需将方向密度、权重叠加策略或不可达区域处理改为可配置项，我可以进一步扩展组件接口与实现。