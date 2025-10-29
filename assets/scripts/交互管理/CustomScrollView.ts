import { _decorator, Component, Node, Vec2, Vec3, ScrollView, UITransform, view, tween } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 自定义循环滚动视图组件
 * 实现无限循环滚动，中间节点正常大小，两边节点逐渐缩小
 * 支持节点从一边消失后从另一边出现的循环效果
 */
@ccclass('CustomScrollView')
export class CustomScrollView extends Component {
    @property({ type: Node, tooltip: 'ScrollView节点（宽度800）' })
    scrollView: Node = null;
    
    @property({ type: Node, tooltip: 'Layout布局节点（动态获取宽度）' })
    layout: Node = null;
    
    // 循环滚动相关属性
    @property({ tooltip: '是否启用循环滚动模式' })
    enableLoopScroll: boolean = true;
    
    @property({ tooltip: '节点间距' })
    itemSpacing: number = 150;
    
    @property({ tooltip: '中心节点缩放比例' })
    centerScale: number = 1.0;
    
    @property({ tooltip: '边缘节点最小缩放比例' })
    edgeScale: number = 0.6;
    
    @property({ tooltip: '缩放过渡距离（像素）' })
    scaleTransitionDistance: number = 200;
    
    // 内部使用的content节点引用
    private content: Node = null;
    
    // 动态获取的视图宽度
    private viewWidth: number = 800;
    
    @property({ tooltip: '滚动敏感度' })
    scrollSensitivity: number = 3;
    
    // Cocos ScrollView 官方常量
    @property({ tooltip: '惯性滚动制动系数（0-1，越大制动越强）' })
    brake: number = 0.5;
    
    @property({ tooltip: '是否启用惯性滚动' })
    inertia: boolean = true;
    
    @property({ tooltip: '是否启用弹性回弹效果' })
    elastic: boolean = true;
    
    @property({ tooltip: '弹性回弹持续时间（秒）' })
    bounceDuration: number = 1.0;
    
    // Cocos ScrollView 内部常量
    private readonly OUT_OF_BOUNDARY_BREAKING_FACTOR: number = 0.05;
    private readonly EPSILON: number = 1e-4;
    private readonly MOVEMENT_FACTOR: number = 0.7;
    private readonly NUMBER_OF_GATHERED_TOUCHES_FOR_MOVE_SPEED: number = 5;
    
    // 循环滚动状态变量
    private _autoScrolling: boolean = false;
    private _scrolling: boolean = false;
    private _items: Node[] = [];
    private _centerIndex: number = 0;
    private _totalOffset: number = 0;
    
    // 惯性滚动相关
    private _touchMoveDisplacements: Vec2[] = [];
    private _touchMoveTimeDeltas: number[] = [];
    private _autoScrollTargetDelta: number = 0;
    private _autoScrollAttenuate: boolean = false;
    private _autoScrollStartPosition: number = 0;
    private _autoScrollTotalTime: number = 0;
    private _autoScrollAccumulatedTime: number = 0;
    private _touchBeganPosition: Vec2 = new Vec2();
    private _touchMoved: boolean = false;
    
    start() {
        // 使用Layout节点作为content（用于兼容性）
        if (this.layout) {
            this.content = this.layout;
            console.log(`[CustomScrollView] content节点已设置为Layout:`, this.content.name);
        }
        
        // 动态获取ScrollView节点的宽度作为viewWidth
        if (this.scrollView) {
            const uiTransform = this.scrollView.getComponent(UITransform);
            if (uiTransform) {
                this.viewWidth = uiTransform.width;
                console.log(`[CustomScrollView] 从ScrollView获取viewWidth: ${this.viewWidth}`);
            } else {
                console.warn(`[CustomScrollView] ScrollView节点没有UITransform组件`);
            }
        } else {
            console.warn(`[CustomScrollView] ScrollView节点未设置，使用默认viewWidth: ${this.viewWidth}`);
        }
        
        // 初始化循环滚动
        if (this.enableLoopScroll) {
            this._initializeLoopScroll();
        }
    }
    
    /**
     * 初始化循环滚动
     */
    private _initializeLoopScroll(): void {
        if (!this.layout) {
            console.warn('[CustomScrollView] Layout节点未设置，无法初始化循环滚动');
            return;
        }
        
        // 收集所有子节点
        this._items = [];
        for (let i = 0; i < this.layout.children.length; i++) {
            const child = this.layout.children[i];
            if (child.active) {
                this._items.push(child);
            }
        }
        
        if (this._items.length === 0) {
            console.warn('[CustomScrollView] 没有找到可用的子节点');
            return;
        }
        
        // 设置中心索引
        this._centerIndex = Math.floor(this._items.length / 2);
        
        // 初始化节点位置
        this._updateItemPositions();
        
        console.log(`[CustomScrollView] 循环滚动初始化完成，节点数量: ${this._items.length}, 中心索引: ${this._centerIndex}`);
    }
    
    /**
     * 更新所有节点的位置和缩放
     */
    private _updateItemPositions(): void {
        if (!this._items || this._items.length === 0) return;
        
        const centerX = 0; // 中心位置
        
        for (let i = 0; i < this._items.length; i++) {
            const item = this._items[i];
            
            // 计算相对于中心的偏移
            let offsetFromCenter = (i - this._centerIndex) * this.itemSpacing + this._totalOffset;
            
            // 循环位置调整
            const totalWidth = this._items.length * this.itemSpacing;
            while (offsetFromCenter > totalWidth / 2) {
                offsetFromCenter -= totalWidth;
            }
            while (offsetFromCenter < -totalWidth / 2) {
                offsetFromCenter += totalWidth;
            }
            
            // 设置位置
            const targetX = centerX + offsetFromCenter;
            item.setPosition(targetX, item.position.y, item.position.z);
            
            // 计算并应用缩放
            const scale = this._calculateScale(Math.abs(offsetFromCenter));
            item.setScale(scale, scale, 1);
            
            // 设置透明度（可选）
            // const opacity = this._calculateOpacity(Math.abs(offsetFromCenter));
            // const uiOpacity = item.getComponent('UIOpacity');
            // if (uiOpacity) {
            //     uiOpacity.opacity = opacity;
            // }
        }
    }
    
    /**
     * 根据距离中心的距离计算缩放比例
     */
    private _calculateScale(distanceFromCenter: number): number {
        if (distanceFromCenter <= 0) {
            return this.centerScale;
        }
        
        if (distanceFromCenter >= this.scaleTransitionDistance) {
            return this.edgeScale;
        }
        
        // 线性插值
        const ratio = distanceFromCenter / this.scaleTransitionDistance;
        return this.centerScale + (this.edgeScale - this.centerScale) * ratio;
    }
    
    /**
     * 根据距离中心的距离计算透明度
     */
    private _calculateOpacity(distanceFromCenter: number): number {
        if (distanceFromCenter <= 0) {
            return 255;
        }
        
        if (distanceFromCenter >= this.scaleTransitionDistance * 1.5) {
            return 100;
        }
        
        // 线性插值
        const ratio = distanceFromCenter / (this.scaleTransitionDistance * 1.5);
        return 255 - (155 * ratio);
    }
    
    /**
     * 更新滚动状态（惯性滚动）
     */
    update(deltaTime: number) {
        if (this._autoScrolling) {
            this._updateAutoScroll(deltaTime);
        }
        
        // 如果启用循环滚动，持续更新节点位置
        if (this.enableLoopScroll) {
            this._updateItemPositions();
        }
    }
    
    /**
     * 处理滚动移动（由InteractionControl调用）
     */
    public handleScrollMove(deltaX: number, deltaY: number, speed: number) {
        if (!this.enableLoopScroll || !this._items || this._items.length === 0) {
            return;
        }
        
        // 应用滚动敏感度
        const adjustedDeltaX = deltaX * this.scrollSensitivity;
        
        // 更新总偏移量
        this._totalOffset += adjustedDeltaX;
        
        // 检查是否需要循环调整
        this._checkAndAdjustLoop();
        
        console.log(`[CustomScrollView] 循环滚动移动: 偏移=${adjustedDeltaX.toFixed(1)}, 总偏移=${this._totalOffset.toFixed(1)}`);
        
        // 记录触摸移动数据用于惯性滚动
        // 仅记录水平方向，清除Y轴偏移以确保水平滚动惯性
        this._recordTouchMove(new Vec2(adjustedDeltaX, 0), speed);
    }
    
    /**
     * 检查并调整循环位置
     */
    private _checkAndAdjustLoop(): void {
        if (!this._items || this._items.length === 0) return;
        
        const itemSpacing = this.itemSpacing;
        
        // // 当偏移量超过一个节点间距时，调整中心索引
        // while (this._totalOffset >= itemSpacing) {
        //     this._totalOffset -= itemSpacing;
        //     this._centerIndex = (this._centerIndex + 1) % this._items.length;
        //     console.log(`[CustomScrollView] 向右循环，新中心索引: ${this._centerIndex}`);
        // }
        
        // while (this._totalOffset <= -itemSpacing) {
        //     this._totalOffset += itemSpacing;
        //     this._centerIndex = (this._centerIndex - 1 + this._items.length) % this._items.length;
        //     console.log(`[CustomScrollView] 向左循环，新中心索引: ${this._centerIndex}`);
        // }
    }
    
    /**
     * 处理滚动结束（由InteractionControl调用）
     */
    public handleScrollEnd() {
        if (this.inertia && this.enableLoopScroll) {
            this._processInertiaScroll();
        }
        
        // 清空触摸移动记录
        this._touchMoveDisplacements.length = 0;
        this._touchMoveTimeDeltas.length = 0;
    }
    
    /**
     * 滚动到指定节点索引
     * @param index 目标节点索引
     * @param animated 是否使用动画
     */
    public scrollToIndex(index: number, animated: boolean = true): void {
        if (!this.enableLoopScroll || !this._items || this._items.length === 0) {
            return;
        }
        
        // 限制索引在有效范围内
        const targetIndex = ((index % this._items.length) + this._items.length) % this._items.length;
        
        // 计算需要移动的距离
        let deltaSteps = targetIndex - this._centerIndex;
        
        // 选择最短路径
        if (Math.abs(deltaSteps) > this._items.length / 2) {
            if (deltaSteps > 0) {
                deltaSteps -= this._items.length;
            } else {
                deltaSteps += this._items.length;
            }
        }
        
        const targetOffset = deltaSteps * this.itemSpacing;
        
        if (animated) {
            this._startAutoScroll(targetOffset, 0.5, true);
        } else {
            this._totalOffset += targetOffset;
            this._checkAndAdjustLoop();
        }
        
        console.log(`[CustomScrollView] 滚动到索引: ${targetIndex}, 移动步数: ${deltaSteps}`);
    }
    
    /**
     * 获取当前中心节点索引
     */
    public getCenterIndex(): number {
        return this._centerIndex;
    }
    
    /**
     * 获取节点总数
     */
    public getItemCount(): number {
        return this._items ? this._items.length : 0;
    }

    /**
     * 重新初始化循环滚动（用于动态添加节点后）
     */
    public reinitializeLoopScroll(): void {
        if (this.enableLoopScroll) {
            this._initializeLoopScroll();
            console.log('[CustomScrollView] 循环滚动重新初始化完成');
        }
    }
    
    /**
     * 滚动到指定百分比位置（兼容性方法）
     * @param percent 滚动百分比 (0-1)
     * @param animated 是否使用动画
     */
    public scrollToPercent(percent: number, animated: boolean = true): void {
        if (!this.enableLoopScroll || !this._items || this._items.length === 0) {
            console.warn('[CustomScrollView] 循环滚动未启用或没有节点，无法滚动到百分比位置');
            return;
        }
        
        // 限制百分比在0-1范围内
        const clampedPercent = Math.max(0, Math.min(1, percent));
        
        // 将百分比转换为节点索引
        const targetIndex = Math.round(clampedPercent * (this._items.length - 1));
        
        // 使用scrollToIndex方法
        this.scrollToIndex(targetIndex, animated);
        
        console.log(`[CustomScrollView] 滚动到百分比: ${clampedPercent.toFixed(3)} -> 节点索引: ${targetIndex}`);
    }
    
    /**
     * 记录触摸移动数据
     */
    private _recordTouchMove(displacement: Vec2, speed: number) {
        const currentTime = this.getTimeInMilliseconds();
        
        this._touchMoveDisplacements.push(displacement.clone());
        this._touchMoveTimeDeltas.push(currentTime);
        
        // 只保留最近的几次移动记录
        if (this._touchMoveDisplacements.length > this.NUMBER_OF_GATHERED_TOUCHES_FOR_MOVE_SPEED) {
            this._touchMoveDisplacements.shift();
            this._touchMoveTimeDeltas.shift();
        }
    }
    
    /**
     * 处理惯性滚动
     */
    private _processInertiaScroll(): void {
        const touchMoveVelocity = this._calculateTouchMoveVelocity();
        
        if (touchMoveVelocity.length() > this.EPSILON) {
            this._startInertiaScroll(touchMoveVelocity);
        }
    }
    
    /**
     * 启动惯性滚动
     */
    private _startInertiaScroll(touchMoveVelocity: Vec2): void {
        const flattenedVelocity = this._flattenVectorByDirection(touchMoveVelocity);
        this._startAttenuatingAutoScroll(flattenedVelocity, flattenedVelocity);
    }
    
    /**
     * 启动衰减自动滚动
     */
    private _startAttenuatingAutoScroll(deltaMove: Vec2, initialVelocity: Vec2): void {
        const time = this._calculateAutoScrollTimeByInitialSpeed(initialVelocity.length());
        const targetDelta = deltaMove.clone();
        targetDelta.multiplyScalar(time * this.scrollSensitivity);
        this._startAutoScroll(targetDelta.x, time, true);
    }
    
    /**
     * 根据方向平坦化向量（只保留水平方向）
     */
    private _flattenVectorByDirection(vector: Vec2): Vec2 {
        return new Vec2(vector.x, 0); // 只保留水平滚动
    }
    
    /**
     * 根据初始速度计算自动滚动时间
     */
    private _calculateAutoScrollTimeByInitialSpeed(initalSpeed: number): number {
        return Math.sqrt(Math.sqrt(initalSpeed / 5));
    }
    

    
    /**
     * 启动自动滚动
     */
    private _startAutoScroll(deltaMove: number, timeInSecond: number, attenuated: boolean = false): void {
        this._autoScrolling = true;
        this._autoScrollTargetDelta = deltaMove;
        this._autoScrollAttenuate = attenuated;
        this._autoScrollStartPosition = this._totalOffset;
        this._autoScrollTotalTime = timeInSecond;
        this._autoScrollAccumulatedTime = 0;
        
        console.log(`[CustomScrollView] 启动自动滚动: 目标偏移=${deltaMove.toFixed(1)}, 时间=${timeInSecond.toFixed(2)}s`);
    }
    
    /**
     * 停止自动滚动
     */
    private _stopAutoScroll(): void {
        this._autoScrolling = false;
        this._autoScrollTargetDelta = 0;
        this._autoScrollAccumulatedTime = 0;
        this._autoScrollTotalTime = 0;
        
        console.log(`[CustomScrollView] 停止自动滚动`);
    }
    

    
    /**
     * 更新自动滚动
     */
    private _updateAutoScroll(deltaTime: number): void {
        if (!this._autoScrolling) {
            return;
        }
        
        this._autoScrollAccumulatedTime += deltaTime;
        
        let percentage = Math.min(this._autoScrollAccumulatedTime / this._autoScrollTotalTime, 1);
        
        if (this._autoScrollAttenuate) {
            percentage = this.quintEaseOut(percentage);
        }
        
        // 更新总偏移量
        const newOffset = this._autoScrollStartPosition + this._autoScrollTargetDelta * percentage;
        this._totalOffset = newOffset;
        
        // 检查循环调整
        this._checkAndAdjustLoop();
        
        if (percentage >= 1) {
            this._stopAutoScroll();
        }
    }
    

    
    /**
     * 五次方缓出函数
     */
    private quintEaseOut(t: number): number {
        return 1 - Math.pow(1 - t, 5);
    }
    
    /**
     * 获取当前时间（毫秒）
     */
    private getTimeInMilliseconds(): number {
        return Date.now();
    }
    
    /**
     * 计算衰减因子
     */
    private _calculateAttenuatedFactor(distance: number): number {
        return (0.998 * distance) / (1 + distance * 0.001);
    }
    
    /**
     * 计算触摸移动速度
     */
    private _calculateTouchMoveVelocity(): Vec2 {
        const totalTime = this._touchMoveTimeDeltas.length > 1 ? 
            (this._touchMoveTimeDeltas[this._touchMoveTimeDeltas.length - 1] - this._touchMoveTimeDeltas[0]) / 1000 : 0;
        
        if (totalTime <= 0 || this._touchMoveDisplacements.length === 0) {
            return new Vec2(0, 0);
        }
        
        const totalDisplacement = this._touchMoveDisplacements.reduce((sum, displacement) => {
            return sum.add(displacement);
        }, new Vec2(0, 0));
        
        return new Vec2(totalDisplacement.x / totalTime, totalDisplacement.y / totalTime);
    }
    
    onDestroy() {
        // 清理资源
        this._touchMoveDisplacements.length = 0;
        this._touchMoveTimeDeltas.length = 0;
        this._items.length = 0;
    }
}