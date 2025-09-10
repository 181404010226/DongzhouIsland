import { _decorator, Component, Node, Label, Sprite, Button, resources, JsonAsset, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 对话数据接口
 */
interface DialogueSegment {
    characterName: string;
    avatar: string;
    content: string;
    order: number;
}

/**
 * 剧情信息接口
 */
interface DialogueInfo {
    name: string;
    fileName: string;
    createdAt: string;
    type: string;
    segmentCount: number;
}

/**
 * 剧情JSON数据接口
 */
interface StoryData {
    dialogueInfo: DialogueInfo;
    dialogueSegments: DialogueSegment[];
}

/**
 * 剧情配置数据接口
 */
interface StoryConfig {
    id: number;
    name: string;
    requiredPopularity: number;
    storyJsonIndex: number;
    storyJsonFile: string;
    unlockedBuildings: any[];
    totalBuildingCount: number;
}

/**
 * 剧情系统管理器
 * 负责控制剧情对话的显示、角色立绘、自动播放等功能
 */
@ccclass('StoryDialogueManager')
export class StoryDialogueManager extends Component {
    
    @property(Node)
    dialoguePanel: Node = null!; // 对话面板
    
    @property(Label)
    characterNameLabel: Label = null!; // 角色名字标签
    
    @property(Label)
    dialogueContentLabel: Label = null!; // 对话内容标签
    
    @property(Sprite)
    characterAvatarSprite: Sprite = null!; // 角色立绘/头像
    
    @property(Button)
    nextStoryButton: Button = null!; // 切换下一个剧情的按钮
    
    @property(Button)
    skipDialogueButton: Button = null!; // 跳过当前对话的按钮
    
    @property({
        tooltip: "对话文字显示速度（字符/秒）"
    })
    textDisplaySpeed: number = 30;
    
    @property({
        tooltip: "下一段对话切换间隔时间（秒）"
    })
    dialogueSwitchInterval: number = 3.0;
    
    @property({
        tooltip: "是否自动播放对话"
    })
    autoPlayDialogue: boolean = true;
    
    @property({
        type: JsonAsset,
        tooltip: "剧情建筑配置文件 (story-building-config.json)"
    })
    storyConfigAsset: JsonAsset = null!;
    
    @property({
        type: [JsonAsset],
        tooltip: "剧情JSON文件数组 - 直接拖拽所有剧情JSON文件到这里"
    })
    storyJsonAssets: JsonAsset[] = [];
    
    // 私有属性
    private storyQueue: StoryConfig[] = []; // 剧情队列
    private currentStoryIndex: number = 0; // 当前剧情索引
    private currentDialogueIndex: number = 0; // 当前对话索引
    private currentStoryData: StoryData | null = null; // 当前剧情数据
    private isPlayingDialogue: boolean = false; // 是否正在播放对话
    private textDisplayTimer: number = 0; // 文字显示计时器
    private dialogueSwitchTimer: number = 0; // 对话切换计时器
    private currentDisplayText: string = ''; // 当前显示的文字
    private targetText: string = ''; // 目标文字
    private isTextAnimating: boolean = false; // 是否正在播放文字动画
    
    // 所有剧情配置数据
    private allStories: StoryConfig[] = [
        { id: 1, name: "开场（人气值0）", requiredPopularity: 0, storyJsonIndex: 14, storyJsonFile: "开场（人气值0）.json", unlockedBuildings: [], totalBuildingCount: 1 },
        { id: 2, name: "人气值10", requiredPopularity: 10, storyJsonIndex: 0, storyJsonFile: "人气值10.json", unlockedBuildings: [], totalBuildingCount: 7 },
        { id: 3, name: "人气值40", requiredPopularity: 40, storyJsonIndex: 7, storyJsonFile: "人气值40.json", unlockedBuildings: [], totalBuildingCount: 6 },
        { id: 4, name: "人气值100", requiredPopularity: 100, storyJsonIndex: 1, storyJsonFile: "人气值100.json", unlockedBuildings: [], totalBuildingCount: 2 },
        { id: 5, name: "人气值150", requiredPopularity: 150, storyJsonIndex: 3, storyJsonFile: "人气值150.json", unlockedBuildings: [], totalBuildingCount: 8 },
        { id: 6, name: "人气值500", requiredPopularity: 500, storyJsonIndex: 9, storyJsonFile: "人气值500.json", unlockedBuildings: [], totalBuildingCount: 5 },
        { id: 7, name: "人气值2000", requiredPopularity: 2000, storyJsonIndex: 4, storyJsonFile: "人气值2000.json", unlockedBuildings: [], totalBuildingCount: 4 },
        { id: 8, name: "人气值5000", requiredPopularity: 5000, storyJsonIndex: 10, storyJsonFile: "人气值5000.json", unlockedBuildings: [], totalBuildingCount: 5 },
        { id: 9, name: "人气值10000", requiredPopularity: 10000, storyJsonIndex: 2, storyJsonFile: "人气值10000.json", unlockedBuildings: [], totalBuildingCount: 4 },
        { id: 10, name: "人气值18000", requiredPopularity: 18000, storyJsonIndex: 5, storyJsonFile: "人气值18000.json", unlockedBuildings: [], totalBuildingCount: 7 },
        { id: 11, name: "人气值28000", requiredPopularity: 28000, storyJsonIndex: 6, storyJsonFile: "人气值28000.json", unlockedBuildings: [], totalBuildingCount: 4 },
        { id: 12, name: "人气值40000", requiredPopularity: 40000, storyJsonIndex: 8, storyJsonFile: "人气值40000.json", unlockedBuildings: [], totalBuildingCount: 4 },
        { id: 13, name: "人气值55000", requiredPopularity: 55000, storyJsonIndex: 11, storyJsonFile: "人气值55000.json", unlockedBuildings: [], totalBuildingCount: 5 },
        { id: 14, name: "人气值72000", requiredPopularity: 72000, storyJsonIndex: 12, storyJsonFile: "人气值72000.json", unlockedBuildings: [], totalBuildingCount: 6 },
        { id: 15, name: "人气值90000", requiredPopularity: 90000, storyJsonIndex: 13, storyJsonFile: "人气值90000.json", unlockedBuildings: [], totalBuildingCount: 3 },
        { id: 16, name: "人气值110000", requiredPopularity: 110000, storyJsonIndex: 15, storyJsonFile: "结束（人气值110000）.json", unlockedBuildings: [], totalBuildingCount: 0 }
    ];
    
    onLoad() {
        // 初始化按钮事件
        if (this.nextStoryButton) {
            this.nextStoryButton.node.on(Button.EventType.CLICK, this.onNextStoryClicked, this);
        }
        
        if (this.skipDialogueButton) {
            this.skipDialogueButton.node.on(Button.EventType.CLICK, this.onSkipDialogueClicked, this);
        }
        
        // 尝试从配置文件加载剧情队列，如果没有则使用默认列表
        this.loadStoryConfigFromAsset();
        if (this.storyQueue.length === 0) {
            this.storyQueue = [...this.allStories];
        }
        
        // 隐藏对话面板
        if (this.dialoguePanel) {
            // this.dialoguePanel.active = false; // 暂时注释掉，让剧情模块一直显示
        }
    }
    
    start() {
        // 游戏开始时自动播放第一个剧情
        this.playNextStoryInQueue();
    }
    
    update(deltaTime: number) {
        if (!this.isPlayingDialogue) return;
        
        // 处理文字逐字显示动画
        if (this.isTextAnimating) {
            this.textDisplayTimer += deltaTime;
            const charactersToShow = Math.floor(this.textDisplayTimer * this.textDisplaySpeed);
            
            if (charactersToShow >= this.targetText.length) {
                // 文字显示完成
                this.currentDisplayText = this.targetText;
                this.isTextAnimating = false;
                this.textDisplayTimer = 0;
                
                // 开始计时切换到下一段对话
                if (this.autoPlayDialogue) {
                    this.dialogueSwitchTimer = 0;
                }
            } else {
                // 逐字显示
                this.currentDisplayText = this.targetText.substring(0, charactersToShow);
            }
            
            // 更新对话内容显示
            if (this.dialogueContentLabel) {
                this.dialogueContentLabel.string = this.currentDisplayText;
            }
        }
        
        // 处理自动切换到下一段对话
        if (this.autoPlayDialogue && !this.isTextAnimating) {
            this.dialogueSwitchTimer += deltaTime;
            
            if (this.dialogueSwitchTimer >= this.dialogueSwitchInterval) {
                this.playNextDialogue();
                this.dialogueSwitchTimer = 0;
            }
        }
    }
    
    /**
     * 播放队列中的下一个剧情
     */
    public playNextStoryInQueue(): void {
        if (this.currentStoryIndex >= this.storyQueue.length) {
            this.hideDialoguePanel();
            return;
        }
        
        const storyConfig = this.storyQueue[this.currentStoryIndex];
        
        this.loadStoryData(storyConfig.storyJsonFile, () => {
            this.startStoryDialogue();
        });
    }
    
    /**
     * 加载剧情数据
     */
    private loadStoryData(fileName: string, callback: () => void): void {
        // 暂时注释掉资源加载逻辑，改用直接从拖拽的JsonAsset数组中查找
        /*
        const resourcePath = `JSON资源管理/${fileName}`;
        
        resources.load(resourcePath, JsonAsset, (err, jsonAsset) => {
            if (err) {
                console.error(`加载剧情文件失败: ${fileName}`, err);
                return;
            }
            
            this.currentStoryData = jsonAsset.json as StoryData;
            this.currentDialogueIndex = 0;
            
            console.log(`成功加载剧情数据: ${fileName}`, this.currentStoryData);
            callback();
        });
        */
        
        // 从拖拽的JsonAsset数组中查找对应的文件
        const targetAsset = this.storyJsonAssets.find(asset => {
            return asset.name === fileName || asset.name === fileName.replace('.json', '');
        });
        
        if (!targetAsset) {
            console.error(`在拖拽的JSON资源中找不到文件: ${fileName}`);
            return;
        }
        
        this.currentStoryData = targetAsset.json as StoryData;
        this.currentDialogueIndex = 0;
        
        callback();
    }
    
    /**
     * 从配置文件加载剧情列表
     */
    private loadStoryConfigFromAsset(): void {
        if (this.storyConfigAsset) {
            const configData = this.storyConfigAsset.json;
            if (configData && configData.stories) {
                this.storyQueue = [...configData.stories];
            } else {
                console.warn("配置文件格式不正确，使用默认剧情列表");
            }
        }
    }
    
    /**
     * 开始播放剧情对话
     */
    private startStoryDialogue(): void {
        if (!this.currentStoryData || !this.currentStoryData.dialogueSegments.length) {
            console.error("没有可播放的对话数据");
            return;
        }
        
        this.isPlayingDialogue = true;
        this.showDialoguePanel();
        this.playCurrentDialogue();
    }
    
    /**
     * 播放当前对话
     */
    private playCurrentDialogue(): void {
        if (!this.currentStoryData || this.currentDialogueIndex >= this.currentStoryData.dialogueSegments.length) {
            // 当前剧情播放完毕，准备播放下一个剧情
            this.onCurrentStoryFinished();
            return;
        }
        
        const dialogue = this.currentStoryData.dialogueSegments[this.currentDialogueIndex];
        
        // 更新角色名字
        if (this.characterNameLabel) {
            this.characterNameLabel.string = dialogue.characterName;
        }
        
        // 加载角色头像
        this.loadCharacterAvatar(dialogue.avatar);
        
        // 开始文字动画
        this.targetText = dialogue.content;
        this.currentDisplayText = '';
        this.isTextAnimating = true;
        this.textDisplayTimer = 0;
    }
    
    /**
     * 播放下一段对话
     */
    private playNextDialogue(): void {
        this.currentDialogueIndex++;
        this.playCurrentDialogue();
    }
    
    /**
     * 当前剧情播放完毕
     */
    private onCurrentStoryFinished(): void {
        this.isPlayingDialogue = false;
        
        // 显示切换下一个剧情的按钮
        if (this.nextStoryButton) {
            this.nextStoryButton.node.active = true;
        }
    }
    
    /**
     * 加载角色头像
     */
    private loadCharacterAvatar(avatarPath: string): void {
        if (!this.characterAvatarSprite) return;
        
        // 处理路径：移除"resources/"前缀（如果存在）
        let processedPath = avatarPath;
        if (processedPath.startsWith('resources/')) {
            processedPath = processedPath.substring('resources/'.length);
        }
        
        // 尝试多种路径格式
        const pathsToTry = [
            `${processedPath}/SpriteFrame`,  // 标准SpriteFrame路径
            processedPath,                   // 直接路径
            `${processedPath}/spriteFrame`,  // 小写spriteFrame
        ];
        
        this.tryLoadAvatarWithPaths(pathsToTry, 0);
    }
    
    /**
     * 尝试用不同路径加载头像
     */
    private tryLoadAvatarWithPaths(paths: string[], index: number): void {
        if (index >= paths.length) {
            console.error(`所有路径都尝试失败，无法加载头像`);
            return;
        }
        
        const currentPath = paths[index];
        
        resources.load(currentPath, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                // 尝试下一个路径
                this.tryLoadAvatarWithPaths(paths, index + 1);
                return;
            }
            
            this.characterAvatarSprite.spriteFrame = spriteFrame;
        });
    }
    
    /**
     * 显示对话面板
     */
    private showDialoguePanel(): void {
        if (this.dialoguePanel) {
            this.dialoguePanel.active = true;
        }
        
        // 隐藏切换剧情按钮
        if (this.nextStoryButton) {
            this.nextStoryButton.node.active = false;
        }
    }
    
    /**
     * 隐藏对话面板
     */
    private hideDialoguePanel(): void {
        if (this.dialoguePanel) {
            // this.dialoguePanel.active = false; // 暂时注释掉，让剧情模块一直显示
        }
    }
    
    /**
     * 下一个剧情按钮点击事件
     */
    private onNextStoryClicked(): void {
        this.currentStoryIndex++;
        this.playNextStoryInQueue();
    }
    
    /**
     * 跳过当前对话按钮点击事件
     */
    private onSkipDialogueClicked(): void {
        if (this.isTextAnimating) {
            // 如果正在播放文字动画，立即显示完整文字
            this.currentDisplayText = this.targetText;
            this.isTextAnimating = false;
            
            if (this.dialogueContentLabel) {
                this.dialogueContentLabel.string = this.currentDisplayText;
            }
        } else {
            // 如果文字已显示完毕，跳转到下一段对话
            this.playNextDialogue();
        }
    }
    
    /**
     * 手动触发指定剧情（用于测试或特殊情况）
     */
    public triggerStory(storyId: number): void {
        const story = this.allStories.find(s => s.id === storyId);
        if (!story) {
            console.error(`找不到ID为 ${storyId} 的剧情`);
            return;
        }
        
        // 将指定剧情添加到队列前端
        this.storyQueue.unshift(story);
        
        // 如果当前没有播放剧情，立即开始播放
        if (!this.isPlayingDialogue) {
            this.playNextStoryInQueue();
        }
    }
    
    /**
     * 设置对话显示速度
     */
    public setTextDisplaySpeed(speed: number): void {
        this.textDisplaySpeed = Math.max(1, speed);
    }
    
    /**
     * 设置对话切换间隔
     */
    public setDialogueSwitchInterval(interval: number): void {
        this.dialogueSwitchInterval = Math.max(0.5, interval);
    }
    
    /**
     * 设置是否自动播放
     */
    public setAutoPlay(autoPlay: boolean): void {
        this.autoPlayDialogue = autoPlay;
    }
    
    /**
     * 获取当前剧情进度信息
     */
    public getCurrentProgress(): string {
        if (!this.isPlayingDialogue || !this.currentStoryData) {
            return "当前没有播放剧情";
        }
        
        const currentStory = this.storyQueue[this.currentStoryIndex];
        return `${currentStory.name} (${this.currentDialogueIndex + 1}/${this.currentStoryData.dialogueSegments.length})`;
    }
}