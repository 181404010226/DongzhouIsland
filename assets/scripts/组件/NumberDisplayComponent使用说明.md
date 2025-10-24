# NumberDisplayComponent 数字显示组件

## 组件简介

NumberDisplayComponent 是一个专门用于显示数字的 Cocos Creator 组件，支持使用图片精灵来显示数字和小数点。该组件可以自动排列数字图片，支持自定义缩放、间距和小数位数，适用于游戏中的分数显示、金币显示、倒计时等场景。

## 主要特性

- ✅ 支持 0-9 数字图片精灵显示
- ✅ 支持小数点图片精灵
- ✅ 自动居中对齐数字排列
- ✅ 可配置数字缩放比例
- ✅ 可配置数字间距
- ✅ 可配置小数位数
- ✅ 自动计算总宽度
- ✅ 实时更新显示
- ✅ 内存管理优化
- ✅ 子节点 Layer 继承父节点（如父为 `UI_2D` 则子也为 `UI_2D`）

## 组件属性

### 必需属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `numberSprites` | SpriteFrame[] | 数字图片数组(0-9)，必须按顺序排列 |
| `decimalPointSprite` | SpriteFrame | 小数点图片精灵 |

### 可选属性

| 属性名 | 类型 | 默认值 | 范围 | 说明 |
|--------|------|--------|------|------|
| `numberScale` | number | 1.0 | 0.01-2.0 | 数字显示缩放比例 |
| `numberSpacing` | number | 1 | 1-30 | 数字之间的间距(像素) |
| `decimalPlaces` | number | 1 | 0-5 | 小数位数 |

## 使用方法

### 1. 基础设置

1. 将 `NumberDisplayComponent` 脚本添加到需要显示数字的节点上
2. 在属性面板中配置数字图片数组（0-9 按顺序）
3. 配置小数点图片精灵
4. 调整缩放、间距等参数

### 2. 代码调用

```typescript
import { NumberDisplayComponent } from '../组件/NumberDisplayComponent';

// 获取组件引用
const numberDisplay = this.node.getComponent(NumberDisplayComponent);

// 设置显示数值
numberDisplay.setValue(123.5);

// 获取当前数值
const currentValue = numberDisplay.getValue();

// 动态调整属性
numberDisplay.setNumberScale(1.5);        // 设置缩放
numberDisplay.setNumberSpacing(5);        // 设置间距
numberDisplay.setDecimalPlaces(2);        // 设置小数位数

// 获取总宽度（用于布局计算）
const totalWidth = numberDisplay.getTotalWidth();
```

### 3. 在其他组件中使用

```typescript
import { NumberDisplayComponent } from '../组件/NumberDisplayComponent';

@ccclass('GameUI')
export class GameUI extends Component {
    @property({ type: NumberDisplayComponent, displayName: '分数显示组件' })
    public scoreDisplay: NumberDisplayComponent | null = null;

    // 更新分数显示
    public updateScore(score: number) {
        if (this.scoreDisplay) {
            this.scoreDisplay.setValue(score);
        }
    }
}
```

## API 参考

### 公共方法

#### setValue(value: number)
设置要显示的数值
- **参数**: `value` - 要显示的数字
- **返回**: 无
- **示例**: `numberDisplay.setValue(1234.56)`

#### getValue(): number
获取当前显示的数值
- **返回**: 当前数值
- **示例**: `const value = numberDisplay.getValue()`

#### setNumberScale(scale: number)
设置数字缩放比例
- **参数**: `scale` - 缩放比例 (0.01-2.0)
- **返回**: 无

#### setNumberSpacing(spacing: number)
设置数字间距
- **参数**: `spacing` - 间距像素值 (1-30)
- **返回**: 无

#### setDecimalPlaces(places: number)
设置小数位数
- **参数**: `places` - 小数位数 (0-5)
- **返回**: 无

#### getTotalWidth(): number
获取数字节点总宽度
- **返回**: 总宽度（像素）
- **用途**: 用于布局计算和对齐

#### updateNumberDisplay()
手动更新数字显示（通常不需要手动调用）
- **返回**: 无

## 使用场景示例

### 1. 游戏分数显示

```typescript
// 游戏分数实时更新
export class ScoreManager extends Component {
    @property(NumberDisplayComponent)
    scoreDisplay: NumberDisplayComponent = null;
    
    private score: number = 0;
    
    addScore(points: number) {
        this.score += points;
        this.scoreDisplay.setValue(this.score);
    }
}
```

### 2. 金币显示

```typescript
// 金币数量显示（无小数）
export class CoinDisplay extends Component {
    @property(NumberDisplayComponent)
    coinDisplay: NumberDisplayComponent = null;
    
    start() {
        // 设置为整数显示
        this.coinDisplay.setDecimalPlaces(0);
    }
    
    updateCoins(amount: number) {
        this.coinDisplay.setValue(amount);
    }
}
```

### 3. 倒计时显示

```typescript
// 倒计时显示（1位小数）
export class CountdownTimer extends Component {
    @property(NumberDisplayComponent)
    timerDisplay: NumberDisplayComponent = null;
    
    private timeLeft: number = 60.0;
    
    start() {
        this.timerDisplay.setDecimalPlaces(1);
        this.schedule(this.updateTimer, 0.1);
    }
    
    updateTimer() {
        this.timeLeft -= 0.1;
        this.timerDisplay.setValue(Math.max(0, this.timeLeft));
        
        if (this.timeLeft <= 0) {
            this.unschedule(this.updateTimer);
        }
    }
}
```

## 注意事项

### 1. 图片资源要求
- 数字图片数组必须包含 0-9 共10个精灵，按顺序排列
- 小数点图片精灵是可选的，如果不需要显示小数可以不设置
- 建议所有数字图片使用相同的尺寸以保证对齐效果

### 2. 性能优化
- 组件会自动管理数字节点的创建和销毁
- 频繁更新数值时，组件会重用节点以提高性能
- 组件销毁时会自动清理所有数字节点

### 3. 布局建议
- 使用 `getTotalWidth()` 方法可以获取数字显示的总宽度，便于进行布局计算
- 数字会自动居中对齐，适合大多数显示场景
- 小数点会自动底部对齐，与数字保持良好的视觉效果

### 4. 常见问题
- **数字不显示**: 检查 numberSprites 数组是否正确配置了 0-9 的图片
- **小数点位置不对**: 确保 decimalPointSprite 已正确设置
- **数字重叠**: 调整 numberSpacing 属性增加间距
- **数字太小/太大**: 调整 numberScale 属性

## 版本信息

- **版本**: 1.0.0
- **兼容性**: Cocos Creator 3.x
- **依赖**: Cocos Creator 核心组件 (Node, Sprite, UITransform)
- **作者**: [您的名字]
- **更新日期**: 2024年

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 支持基础数字显示功能
- 支持自定义缩放、间距、小数位数
- 自动居中对齐和内存管理

---

*该组件已经过充分测试，可以安全地用于生产环境。如有问题或建议，请联系开发团队。*