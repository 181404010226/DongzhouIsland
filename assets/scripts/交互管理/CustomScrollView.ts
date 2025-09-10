import { _decorator, Component, Node, Vec2, Vec3, ScrollView, UITransform, view } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 自定义滚动视图组件
 * 从BuildingBarManager中抽取的滚动逻辑
 * 可挂载到Layout节点上提供水平滚动功能
 */
@ccclass('CustomScrollView')
export class CustomScrollView extends Component {
    @property({ type: Node, tooltip: 'ScrollView节点（宽度800）' })
    scrollView: Node = null;
    
    @property({ type: Node, tooltip: 'Layout布局节点（动态获取宽度）' })
    layout: Node = null;
    
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
    
    // 滚动状态变量
    private _autoScrolling: boolean = false;
    private _scrolling: boolean = false;
    
    // 新的边界变量
    private View_leftBoundary: number = 0;
    private View_rightBoundary: number = 0;
    private Lay_leftBoundary: number = 0;
    private Lay_rightBoundary: number = 0;
    private _touchMoveDisplacements: Vec2[] = [];
    private _touchMoveTimeDeltas: number[] = [];
    private _autoScrollTargetDelta: number = 0;
    private _autoScrollAttenuate: boolean = false;
    private _autoScrollStartPosition: number = 0;
    private _autoScrollTotalTime: number = 0;
    private _autoScrollAccumulatedTime: number = 0;
    private _outOfBoundaryAmount: number = 0;
    private _isBouncing: boolean = false;
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
        
        // 初始化边界计算
        this._calculateBoundary();
    }
    
    /**
     * 更新滚动状态（惯性滚动和弹性回弹）
     */
    update(deltaTime: number) {
        if (this._isBouncing) {
            this._updateBounceBack(deltaTime);
        } else if (this._autoScrolling) {
            this._updateAutoScroll(deltaTime);
        }
    }
    
    /**
     * 处理滚动移动（由InteractionControl调用）
     */
    public handleScrollMove(deltaX: number, deltaY: number, speed: number) {
        if (!this.layout) {
            return;
        }
        
        // 获取当前位置
        const currentX = this.layout.position.x;
        
        // 应用滚动敏感度并计算新位置
        const adjustedDeltaX = deltaX * this.scrollSensitivity;
        let newX = currentX + adjustedDeltaX;
        
        console.log(`[CustomScrollView] 滚动移动: 当前位置=${currentX.toFixed(1)}, 偏移=${adjustedDeltaX.toFixed(1)}, 新位置=${newX.toFixed(1)}`);
        
        // 直接设置新位置，实现实时跟随
        this.layout.setPosition(newX, this.layout.position.y, this.layout.position.z);
        
        // 记录触摸移动数据用于惯性滚动
        this._recordTouchMove(new Vec2(deltaX, deltaY), speed);
    }
    
    /**
     * 处理滚动结束（由InteractionControl调用）
     */
    public handleScrollEnd() {
        // 检查是否需要边界回弹
        if (this.elastic && this._isOutOfBoundary()) {
            this._startBounceBackIfNeeded();
        } else if (this.inertia) {
            this._processInertiaScroll();
        }
        
        // 清空触摸移动记录
        this._touchMoveDisplacements.length = 0;
        this._touchMoveTimeDeltas.length = 0;
    }
    
    /**
     * 滚动到指定百分比位置
     * @param percent 滚动百分比 (0-1)
     * @param animated 是否使用动画
     */
    public scrollToPercent(percent: number, animated: boolean = false): void {
        if (!this.layout) {
            return;
        }
        
        // 限制百分比在有效范围内
        const clampedPercent = Math.max(0, Math.min(1, percent));
        
        // 计算边界
        this._calculateBoundary();
        
        // 计算目标位置：基于新的边界逻辑
        // 当percent=0时，Layout应该在最左边界位置
        // 当percent=1时，Layout应该在最右边界位置
        const contentWidth = this._calculateContentWidth();
        const viewWidth = this.viewWidth;
        
        let targetX = this.layout.position.x;
        if (contentWidth > viewWidth) {
            // 可滚动范围：从View_rightBoundary - contentWidth 到 View_leftBoundary
            const minX = this.View_rightBoundary - contentWidth;
            const maxX = this.View_leftBoundary;
            targetX = minX + (maxX - minX) * (1 - clampedPercent); // 注意这里是1-percent，因为向右滚动是负方向
        }
        
        if (animated) {
            // 启动自动滚动到目标位置
            const currentX = this.layout.position.x;
            const deltaMove = targetX - currentX;
            this._startAutoScroll(new Vec2(deltaMove, 0), 0.3, true);
        } else {
            // 直接设置位置
            this.layout.setPosition(targetX, this.layout.position.y, this.layout.position.z);
        }
        
        console.log(`[CustomScrollView] 滚动到百分比: ${clampedPercent.toFixed(3)}, 目标位置: ${targetX.toFixed(1)}`);
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
        targetDelta.multiplyScalar(time);
        this._startAutoScroll(targetDelta, time, true);
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
     * 获取当前滚动百分比
     */
    private _getCurrentScrollPercent(): number {
        if (!this.layout) {
            console.warn(`[CustomScrollView] layout节点为空，返回百分比0`);
            return 0;
        }
        
        this._calculateBoundary();
        const currentX = this.layout.position.x;
        const contentWidth = this._calculateContentWidth();
        
        // 避免除零错误
        const totalScrollRange = contentWidth - this.viewWidth;
        console.log(`[CustomScrollView] 百分比计算: currentX=${currentX}, contentWidth=${contentWidth}, viewWidth=${this.viewWidth}, totalScrollRange=${totalScrollRange}`);
        
        if (totalScrollRange <= 0) {
            console.warn(`[CustomScrollView] 滚动范围无效(${totalScrollRange})，返回百分比0`);
            return 0;
        }
        
        // 计算当前位置相对于边界的百分比 (0表示最左边，1表示最右边)
        const scrollPercent = -currentX / totalScrollRange;
        const clampedPercent = Math.max(0, Math.min(1, scrollPercent));
        console.log(`[CustomScrollView] 计算结果: scrollPercent=${scrollPercent}, clampedPercent=${clampedPercent}`);
        return clampedPercent;
    }
    
    /**
     * 将位移偏量转换为滚动百分比变化量
     */
    private _convertOffsetToScrollPercent(offset: number): number {
        this._calculateBoundary();
        const contentWidth = this._calculateContentWidth();
        
        const totalScrollRange = contentWidth - this.viewWidth;
        if (totalScrollRange <= 0) {
            return 0;
        }
        
        // 应用滚动敏感度并转换为百分比
        const adjustedOffset = offset * this.scrollSensitivity;
        return adjustedOffset / totalScrollRange;
    }
    
    /**
     * 限制滚动百分比在有效范围内，并检测是否到达边界
     */
    private _clampScrollPercent(percent: number): { clampedPercent: number, isAtBoundary: boolean } {
        let clampedPercent = percent;
        let isAtBoundary = false;
        
        if (percent < 0) {
            clampedPercent = 0;
            isAtBoundary = true;
        } else if (percent > 1) {
            clampedPercent = 1;
            isAtBoundary = true;
        }
        
        return { clampedPercent, isAtBoundary };
    }
    
    /**
     * 根据百分比滚动到指定位置
     */
    private _scrollToPercent(percent: number, animated: boolean = false): void {
        if (!this.layout) {
            return;
        }
        
        this._calculateBoundary();
        const contentWidth = this._calculateContentWidth();
        
        // 计算目标位置 (percent=0表示最左边，percent=1表示最右边)
        const targetX = -(contentWidth - this.viewWidth) * percent;
        
        // 设置内容位置
        this.layout.setPosition(targetX, this.layout.position.y, this.layout.position.z);
    }
    
    /**
     * 处理边界回弹
     */
    private _handleBoundaryBounce(originalPercent: number, clampedPercent: number): void {
        if (!this.elastic) {
            return;
        }
        
        const outOfBoundaryAmount = Math.abs(originalPercent - clampedPercent);
        this._outOfBoundaryAmount = outOfBoundaryAmount;
        
        if (outOfBoundaryAmount > this.EPSILON) {
            this._startBounceBackIfNeeded();
        }
    }
    
    /**
     * 启动自动滚动
     */
    private _startAutoScroll(deltaMove: Vec2, timeInSecond: number, attenuated: boolean = false): void {
        const adjustedDeltaMove = deltaMove.clone();
        adjustedDeltaMove.multiplyScalar(this.scrollSensitivity);
        
        this._autoScrolling = true;
        this._autoScrollTargetDelta = adjustedDeltaMove.x;
        this._autoScrollAttenuate = attenuated;
        this._autoScrollStartPosition = this.layout ? this.layout.position.x : 0;
        this._autoScrollTotalTime = timeInSecond;
        this._autoScrollAccumulatedTime = 0;
    }
    
    /**
     * 停止自动滚动
     */
    private _stopAutoScroll(): void {
        this._autoScrolling = false;
        this._autoScrollTargetDelta = 0;
        this._autoScrollAccumulatedTime = 0;
        this._autoScrollTotalTime = 0;
    }
    
    /**
     * 如果需要则启动回弹
     */
    private _startBounceBackIfNeeded(): boolean {
        if (!this.elastic || !this.layout) {
            return false;
        }
        
        // 重新计算边界
        this._calculateBoundary();
        
        const leftDiff = this.Lay_leftBoundary - this.View_leftBoundary;
        const rightDiff = this.Lay_rightBoundary - this.View_rightBoundary;
        
        let targetPosition = this.layout.position.x;
        let needBounce = false;
        
        // 如果Lay_leftBoundary-View_leftBoundary为正值，需要向右移动Layout
        if (leftDiff > this.EPSILON) {
            targetPosition = this.layout.position.x - leftDiff;
            needBounce = true;
            console.log(`[CustomScrollView] 左边界违规，需要向右移动: ${leftDiff}`);
        }
        // 如果Lay_rightBoundary-View_rightBoundary为负值，需要向左移动Layout
        else if (rightDiff < -this.EPSILON) {
            targetPosition = this.layout.position.x - rightDiff;
            needBounce = true;
            console.log(`[CustomScrollView] 右边界违规，需要向左移动: ${Math.abs(rightDiff)}`);
        }
        
        if (needBounce) {
            console.log(`[CustomScrollView] 启动回弹: 当前位置=${this.layout.position.x}, 目标位置=${targetPosition}`);
            
            this._isBouncing = true;
            this._autoScrolling = false;
            
            const bounceBackAmount = Math.abs(targetPosition - this.layout.position.x);
            const bounceBackTime = Math.sqrt(bounceBackAmount / 1000) * this.bounceDuration;
            
            this._autoScrollTotalTime = bounceBackTime;
            this._autoScrollAccumulatedTime = 0;
            this._autoScrollTargetDelta = targetPosition - this.layout.position.x;
            this._autoScrollStartPosition = this.layout.position.x;
            
            return true;
        }
        
        return false;
    }
    
    /**
     * 更新自动滚动
     */
    private _updateAutoScroll(deltaTime: number): void {
        if (!this._autoScrolling || !this.layout) {
            return;
        }
        
        this._autoScrollAccumulatedTime += deltaTime;
        
        let percentage = Math.min(this._autoScrollAccumulatedTime / this._autoScrollTotalTime, 1);
        
        if (this._autoScrollAttenuate) {
            percentage = this.quintEaseOut(percentage);
        }
        
        const newPosition = this._autoScrollStartPosition + this._autoScrollTargetDelta * percentage;
        this.layout.setPosition(newPosition, this.layout.position.y, this.layout.position.z);
        
        // 检查边界
        if (this._isOutOfBoundary()) {
            this._stopAutoScroll();
            this._startBounceBackIfNeeded();
            return;
        }
        
        if (percentage >= 1) {
            this._stopAutoScroll();
        }
    }
    
    /**
     * 更新回弹
     */
    private _updateBounceBack(deltaTime: number): void {
        if (!this._isBouncing || !this.layout) {
            return;
        }
        
        this._autoScrollAccumulatedTime += deltaTime;
        
        let percentage = Math.min(this._autoScrollAccumulatedTime / this._autoScrollTotalTime, 1);
        percentage = this.quintEaseOut(percentage);
        
        const newPosition = this._autoScrollStartPosition + this._autoScrollTargetDelta * percentage;
        this.layout.setPosition(newPosition, this.layout.position.y, this.layout.position.z);
        
        console.log(`[CustomScrollView] 回弹中: 进度=${(percentage * 100).toFixed(1)}%, 位置=${newPosition.toFixed(1)}`);
        
        if (percentage >= 1) {
            this._isBouncing = false;
            this._autoScrollAccumulatedTime = 0;
            console.log(`[CustomScrollView] 回弹完成: 最终位置=${newPosition.toFixed(1)}`);
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
    
    /**
     * 计算边界
     */
    private _calculateBoundary(): void {
        if (!this.layout || !this.scrollView) {
            this.View_leftBoundary = 0;
            this.View_rightBoundary = 0;
            this.Lay_leftBoundary = 0;
            this.Lay_rightBoundary = 0;
            return;
        }
        
        // 获取ScrollView节点的边界（用户可见的视窗边界）
        const scrollViewTransform = this.scrollView.getComponent(UITransform);
        if (!scrollViewTransform) {
            this.View_leftBoundary = 0;
            this.View_rightBoundary = 0;
            this.Lay_leftBoundary = 0;
            this.Lay_rightBoundary = 0;
            return;
        }
        
        // 计算屏幕边界（屏幕的左右边界）
        const screenWidth = view.getVisibleSize().width;
        this.View_leftBoundary = -screenWidth / 2;
        this.View_rightBoundary = screenWidth / 2;
        
        // 获取Layout节点的边界（最左和最右显示边缘）
        const layoutTransform = this.layout.getComponent(UITransform);
        if (!layoutTransform) {
            this.Lay_leftBoundary = 0;
            this.Lay_rightBoundary = 0;
            return;
        }
        
        // 计算Layout的实际内容宽度
        const contentWidth = this._calculateContentWidth();
        
        // Layout锚点在最左侧(Anchor Point.x=0)，所以左边界就是Layout的position.x
        this.Lay_leftBoundary = this.layout.position.x;
        this.Lay_rightBoundary = this.layout.position.x + contentWidth;
        
        console.log(`[CustomScrollView] 边界计算: 内容宽度=${contentWidth}, 视图宽度=${scrollViewTransform.width}`);
        console.log(`[CustomScrollView] View边界: 左=${this.View_leftBoundary}, 右=${this.View_rightBoundary}`);
        console.log(`[CustomScrollView] Layout边界: 左=${this.Lay_leftBoundary}, 右=${this.Lay_rightBoundary}`);
    }
    
    /**
     * 计算内容总宽度
     */
    private _calculateContentWidth(): number {
        if (!this.layout) {
            return 0;
        }
        
        // 遍历Layout的所有子节点计算总宽度
        let maxRight = 0;
        
        for (const child of this.layout.children) {
            if (!child.active) continue;
            
            const childTransform = child.getComponent(UITransform);
            if (childTransform) {
                // 由于Layout锚点在最左侧(Anchor Point.x=0)，子节点的右边界就是position.x + width/2
                const childRight = child.position.x + childTransform.width / 2;
                maxRight = Math.max(maxRight, childRight);
            }
        }
        
        return maxRight;
    }
    

    
    /**
     * 获取超出边界的距离
     */
    private _getHowMuchOutOfBoundary(): number {
        if (!this.layout) {
            return 0;
        }
        
        // 重新计算边界
        this._calculateBoundary();
        
        // 检查边界条件
        const leftDiff = this.Lay_leftBoundary - this.View_leftBoundary;
        const rightDiff = this.Lay_rightBoundary - this.View_rightBoundary;
        
        // 如果Lay_leftBoundary-View_leftBoundary为正值，返回正的超出距离
        if (leftDiff > this.EPSILON) {
            return leftDiff;
        }
        
        // 如果Lay_rightBoundary-View_rightBoundary为负值，返回负的超出距离
        if (rightDiff < -this.EPSILON) {
            return rightDiff;
        }
        
        return 0;
    }
    
    /**
     * 检查是否超出边界
     */
    private _isOutOfBoundary(): boolean {
        if (!this.layout) {
            return false;
        }
        
        // 重新计算边界
        this._calculateBoundary();
        
        // 检查边界条件
        const leftDiff = this.Lay_leftBoundary - this.View_leftBoundary;
        const rightDiff = this.Lay_rightBoundary - this.View_rightBoundary;
        
        console.log(`[CustomScrollView] 检查边界: Lay_left=${this.Lay_leftBoundary}, View_left=${this.View_leftBoundary}, 差值=${leftDiff}`);
        console.log(`[CustomScrollView] 检查边界: Lay_right=${this.Lay_rightBoundary}, View_right=${this.View_rightBoundary}, 差值=${rightDiff}`);
        
        // 如果Lay_leftBoundary-View_leftBoundary为正值，或者Lay_rightBoundary-View_rightBoundary为负值，则需要回弹
        const needBounce = leftDiff > this.EPSILON || rightDiff < -this.EPSILON;
        
        if (needBounce) {
            console.log(`[CustomScrollView] 启动回弹`);
        }
        
        return needBounce;
    }
    
    /**
     * 重置到左边界
     */
    public resetToLeftBoundary(): void {
        this.scrollToPercent(0);
    }
    
    /**
     * 获取当前滚动百分比（公共接口）
     */
    public getCurrentScrollPercent(): number {
        return this._getCurrentScrollPercent();
    }
    
    /**
     * 获取当前滚动偏移量（公共接口）
     * @returns 当前Layout节点的X轴偏移量
     */
    public getCurrentScrollOffset(): number {
        if (!this.layout) {
            return 0;
        }
        return this.layout.position.x;
    }
    
    onDestroy() {
        this._stopAutoScroll();
        this._isBouncing = false;
    }
}