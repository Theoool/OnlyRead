/**
 * 统一导入状态机
 * 
 * 将所有导入方式（文件、URL、文本）统一为一致的状态流转
 */

export type ImportType = 'file' | 'url' | 'text';
export type ImportStatus = 
  | 'idle'           // 空闲
  | 'validating'     // 验证输入
  | 'preparing'      // 准备数据
  | 'saving_local'   // 保存到本地
  | 'uploading'      // 上传到云端
  | 'processing'     // 云端处理中
  | 'syncing'        // 同步元数据
  | 'completed'      // 完成
  | 'error';         // 错误

export interface ImportState {
  status: ImportStatus;
  type?: ImportType;
  progress: number;      // 0-100
  message?: string;      // 用户友好的状态描述
  error?: string;
  localId?: string;      // 本地 ID（如果适用）
  cloudId?: string;      // 云端 ID（如果已同步）
  canReadLocally?: boolean;  // 是否可以本地阅读
}

export interface ImportConfig {
  type: ImportType;
  localFirst?: boolean;  // 是否本地优先（文件默认 true，其他 false）
  backgroundSync?: boolean; // 是否后台同步（文件默认 true）
}

/**
 * 导入状态机
 */
export class ImportStateMachine {
  private state: ImportState;
  private listeners: Set<(state: ImportState) => void>;

  constructor() {
    this.state = {
      status: 'idle',
      progress: 0,
    };
    this.listeners = new Set();
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (state: ImportState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 获取当前状态
   */
  getState(): ImportState {
    return { ...this.state };
  }

  /**
   * 更新状态
   */
  private setState(updates: Partial<ImportState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.setState({
      status: 'idle',
      progress: 0,
      message: undefined,
      error: undefined,
      localId: undefined,
      cloudId: undefined,
      canReadLocally: false,
    });
  }

  /**
   * 开始导入流程
   */
  start(config: ImportConfig): void {
    this.reset();
    this.setState({
      status: 'validating',
      type: config.type,
      progress: 5,
      message: '验证输入...',
    });
  }

  /**
   * 验证完成
   */
  validated(): void {
    this.setState({
      status: 'preparing',
      progress: 10,
      message: '准备数据...',
    });
  }

  /**
   * 开始保存到本地
   */
  savingLocal(): void {
    this.setState({
      status: 'saving_local',
      progress: 20,
      message: '保存到本地...',
    });
  }

  /**
   * 本地保存完成
   */
  localSaved(localId: string): void {
    this.setState({
      status: 'saving_local',
      progress: 40,
      localId,
      canReadLocally: true,
      message: '本地保存完成',
    });
  }

  /**
   * 开始上传
   */
  uploading(progress?: number): void {
    this.setState({
      status: 'uploading',
      progress: progress || 50,
      message: '上传到云端...',
    });
  }

  /**
   * 云端处理中
   */
  processing(progress?: number): void {
    this.setState({
      status: 'processing',
      progress: progress || 70,
      message: '云端处理中...',
    });
  }

  /**
   * 同步元数据
   */
  syncing(): void {
    this.setState({
      status: 'syncing',
      progress: 90,
      message: '同步元数据...',
    });
  }

  /**
   * 完成
   */
  complete(cloudId?: string): void {
    this.setState({
      status: 'completed',
      progress: 100,
      cloudId,
      message: '导入完成',
    });
  }

  /**
   * 错误
   */
  error(error: string): void {
    this.setState({
      status: 'error',
      error,
      message: '导入失败',
    });
  }

  /**
   * 是否可以开始新的导入
   */
  canStartNew(): boolean {
    return this.state.status === 'idle' || 
           this.state.status === 'completed' || 
           this.state.status === 'error';
  }

  /**
   * 是否正在进行中
   */
  isInProgress(): boolean {
    return !['idle', 'completed', 'error'].includes(this.state.status);
  }
}

/**
 * 根据导入类型获取默认配置
 */
export function getDefaultConfig(type: ImportType): ImportConfig {
  switch (type) {
    case 'file':
      return {
        type: 'file',
        localFirst: true,
        backgroundSync: true,
      };
    case 'url':
    case 'text':
      return {
        type,
        localFirst: false,
        backgroundSync: false,
      };
  }
}

