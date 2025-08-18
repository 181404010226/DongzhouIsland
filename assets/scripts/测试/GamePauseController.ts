import { _decorator, Component, Node, input, Input, EventKeyboard, KeyCode, game } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 游戏暂停控制器
 * 按下空格键暂停/恢复游戏
 */
@ccclass('GamePauseController')
export class GamePauseController extends Component {
    
    private isPaused: boolean = false;
    
    start() {
        // 注册键盘事件监听
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }
    
    onDestroy() {
        // 移除键盘事件监听
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }
    
    /**
     * 键盘按下事件处理
     */
    private onKeyDown(event: EventKeyboard) {
        if (event.keyCode === KeyCode.SPACE) {
            this.togglePause();
        }
    }
    
    /**
     * 切换游戏暂停状态
     */
    private togglePause() {
        if (this.isPaused) {
            // 恢复游戏
            game.resume();
            this.isPaused = false;
            console.log('游戏已恢复');
        } else {
            // 暂停游戏
            game.pause();
            this.isPaused = true;
            console.log('游戏已暂停');
        }
    }
    
    /**
     * 手动暂停游戏
     */
    public pauseGame() {
        if (!this.isPaused) {
            game.pause();
            this.isPaused = true;
            console.log('游戏已暂停');
        }
    }
    
    /**
     * 手动恢复游戏
     */
    public resumeGame() {
        if (this.isPaused) {
            game.resume();
            this.isPaused = false;
            console.log('游戏已恢复');
        }
    }
    
    /**
     * 获取当前暂停状态
     */
    public getIsPaused(): boolean {
        return this.isPaused;
    }
}