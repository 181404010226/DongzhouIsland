import { _decorator, Component, Node, input, Input, EventMouse, Camera, Vec2, Vec3, Canvas } from 'cc';
import { TileSelectionManager } from '../地图生成/TileSelectionManager';

const { ccclass, property } = _decorator;

/**
 * 交互管理器
 * 负责处理玩家的输入交互，包括：
 * 1. 相机拖动移动
 * 2. 长按0.5秒后进入框选模式
 */
@ccclass('InteractionManager')
export class InteractionManager extends Component {
    @property({ tooltip: '相机节点' })
    cameraNode: Node = null;
    
    @property({ type: TileSelectionManager, tooltip: '地块选择管理器' })
    tileSelectionManager: TileSelectionManager = null;
    
    @property({ tooltip: '相机移动速度' })
    cameraMoveSpeed: number = 1.0;
    
    @property({ tooltip: '长按触发时间（秒）' })
    longPressTime: number = 0.5;
    
    // 私有变量
    private camera: Camera = null;
    private isDragging: boolean = false;
    private lastMousePos: Vec2 = new Vec2();
    private isLongPressing: boolean = false;
    private longPressTimer: number = 0;
    private longPressStartPos: Vec2 = new Vec2();
    private longPressTriggered: boolean = false;
    private cameraDragEnabled: boolean = true; // 相机拖动功能启用状态
    private readonly LONG_PRESS_THRESHOLD: number = 10; // 长按期间允许的最大移动距离（像素）
    
    start() {
        this.initializeCamera();
        this.setupInput();
        console.log('InteractionManager 初始化完成');
    }
    
    /**
     * 初始化相机
     */
    private initializeCamera() {
        if (this.cameraNode) {
            this.camera = this.cameraNode.getComponent(Camera);
        } else {
            // 自动查找相机
            const canvas = this.node.scene.getComponentInChildren(Canvas);
            if (canvas && canvas.cameraComponent) {
                this.camera = canvas.cameraComponent;
                this.cameraNode = this.camera.node;
            } else {
                const cameraComponent = this.node.scene.getComponentInChildren(Camera);
                if (cameraComponent) {
                    this.camera = cameraComponent;
                    this.cameraNode = this.camera.node;
                }
            }
        }
        
        if (!this.camera) {
            console.error('未找到相机，交互功能可能无法正常工作');
        } else {
            console.log('相机初始化成功:', this.camera.node.name);
        }
    }
    
    /**
     * 设置输入事件监听
     */
    private setupInput() {
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
    
    /**
     * 鼠标按下事件
     */
    private onMouseDown(event: EventMouse) {
        const mousePos = event.getLocation();
        this.lastMousePos.set(mousePos);
        this.longPressStartPos.set(mousePos);
        
        // 开始长按检测
        this.isLongPressing = true;
        this.longPressTimer = 0;
        this.longPressTriggered = false;
        
        // 如果地块选择管理器存在且已启用，暂时禁用它
        if (this.tileSelectionManager) {
            this.tileSelectionManager.setEnabled(false);
        }
        
        console.log('开始长按检测');
    }
    
    /**
     * 鼠标移动事件
     */
    private onMouseMove(event: EventMouse) {
        const mousePos = event.getLocation();
        
        // 检查是否在长按期间移动过多
        if (this.isLongPressing && !this.longPressTriggered) {
            const distance = Vec2.distance(mousePos, this.longPressStartPos);
            if (distance > this.LONG_PRESS_THRESHOLD) {
                // 移动距离过大，取消长按，开始拖动相机
                this.cancelLongPress();
                this.startCameraDrag();
            }
        }
        
        // 处理相机拖动
        if (this.isDragging && this.camera && this.cameraDragEnabled) {
            const deltaX = mousePos.x - this.lastMousePos.x;
            const deltaY = mousePos.y - this.lastMousePos.y;
            
            // 移动相机（注意方向相反，因为是拖动视图）
            const currentPos = this.cameraNode.position;
            const newPos = new Vec3(
                currentPos.x - deltaX * this.cameraMoveSpeed,
                currentPos.y - deltaY * this.cameraMoveSpeed,
                currentPos.z
            );
            this.cameraNode.setPosition(newPos);
        }
        
        this.lastMousePos.set(mousePos);
    }
    
    /**
     * 鼠标抬起事件
     */
    private onMouseUp(event: EventMouse) {
        // 停止相机拖动
        this.isDragging = false;
        
        // 如果长按已触发且地块选择管理器存在，传递鼠标抬起事件
        if (this.longPressTriggered && this.tileSelectionManager) {
            // 这里可以直接调用地块选择管理器的鼠标抬起方法
            // 但由于TileSelectionManager的方法是私有的，我们通过启用它来让它处理后续事件
        }
        
        // 重置长按状态
        this.isLongPressing = false;
        this.longPressTriggered = false;
        
        console.log('鼠标抬起，重置状态');
    }
    
    /**
     * 取消长按
     */
    private cancelLongPress() {
        this.isLongPressing = false;
        this.longPressTriggered = false;
        console.log('长按被取消');
    }
    
    /**
     * 开始相机拖动
     */
    private startCameraDrag() {
        this.isDragging = true;
        console.log('开始相机拖动');
    }
    
    /**
     * 触发长按选择
     */
    private triggerLongPressSelection() {
        this.longPressTriggered = true;
        this.isLongPressing = false;
        
        // 启用地块选择管理器
        if (this.tileSelectionManager) {
            this.tileSelectionManager.setEnabled(true);
            
            // 模拟鼠标按下事件传递给地块选择管理器
            const mouseEvent = new EventMouse(Input.EventType.MOUSE_DOWN, false);
            mouseEvent.setLocation(this.longPressStartPos.x, this.longPressStartPos.y);
            this.tileSelectionManager.onMouseDown(mouseEvent);
        }
        
        console.log('长按触发，进入框选模式');
    }
    
    /**
     * 更新长按计时器
     */
    update(deltaTime: number) {
        if (this.isLongPressing && !this.longPressTriggered) {
            this.longPressTimer += deltaTime;
            
            if (this.longPressTimer >= this.longPressTime) {
                this.triggerLongPressSelection();
            }
        }
    }
    
    /**
     * 设置地块选择管理器
     */
    setTileSelectionManager(manager: TileSelectionManager) {
        this.tileSelectionManager = manager;
    }
    
    /**
     * 设置相机移动速度
     */
    setCameraMoveSpeed(speed: number) {
        this.cameraMoveSpeed = Math.max(0.1, speed);
    }
    
    /**
     * 设置长按触发时间
     */
    setLongPressTime(time: number) {
        this.longPressTime = Math.max(0.1, time);
    }
    
    /**
     * 设置相机拖动功能启用状态
     */
    setCameraDragEnabled(enabled: boolean) {
        this.cameraDragEnabled = enabled;
        // 如果禁用相机拖动，立即停止当前的拖动
        if (!enabled && this.isDragging) {
            this.isDragging = false;
        }
    }
    
    /**
     * 获取当前是否正在拖动相机
     */
    isDraggingCamera(): boolean {
        return this.isDragging;
    }
    
    /**
     * 获取当前是否正在长按
     */
    isCurrentlyLongPressing(): boolean {
        return this.isLongPressing;
    }
    
    /**
     * 获取当前是否已触发长按选择
     */
    isLongPressSelectionActive(): boolean {
        return this.longPressTriggered;
    }
    
    onDestroy() {
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }
}