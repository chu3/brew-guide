/**
 * 磨豆机推荐状态管理 Store
 * 使用 Zustand 管理磨豆机推荐的全局状态，确保所有组件实时同步
 */

import { create } from 'zustand';
import { CustomEquipment } from '@/lib/core/config';
import { getEquipmentTypeKey } from '@/lib/utils/grinderRecommendation';

interface GrinderRecommendationState {
  // 各器具类型最后使用的磨豆机记录
  lastUsedGrinderByEquipment: Record<string, string>;
  
  // 更新特定器具的磨豆机记录
  updateLastUsedGrinder: (
    equipmentId: string | null,
    grinderId: string,
    customEquipments?: CustomEquipment[]
  ) => Promise<void>;
  
  // 从 localStorage 加载初始数据
  loadFromStorage: () => Promise<void>;
  
  // 获取推荐的磨豆机ID（便捷方法）
  getRecommendedGrinder: (
    equipmentId: string | null,
    userGrinders: string[],
    customEquipments?: CustomEquipment[]
  ) => string;
}

export const useGrinderRecommendationStore = create<GrinderRecommendationState>((set, get) => ({
  lastUsedGrinderByEquipment: {},
  
  // 更新磨豆机使用记录
  updateLastUsedGrinder: async (equipmentId, grinderId, customEquipments) => {
    // 不记录通用磨豆机的选择
    if (!grinderId || grinderId === 'generic') {
      return;
    }
    
    const equipmentType = getEquipmentTypeKey(equipmentId, customEquipments);
    
    // 不记录 generic 器具类型
    if (equipmentType === 'generic') {
      return;
    }
    
    const currentState = get().lastUsedGrinderByEquipment;
    
    // 只在值发生变化时才更新
    if (currentState[equipmentType] === grinderId) {
      return;
    }
    
    // 立即更新 Zustand 状态（所有订阅的组件会自动重新渲染）
    const newState = {
      ...currentState,
      [equipmentType]: grinderId
    };
    
    set({ lastUsedGrinderByEquipment: newState });
    
    // 异步保存到 localStorage
    try {
      const { Storage } = await import('@/lib/core/storage');
      const settingsStr = await Storage.get('brewGuideSettings');
      
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        
        if (!settings.lastUsedGrinderByEquipment) {
          settings.lastUsedGrinderByEquipment = {};
        }
        
        settings.lastUsedGrinderByEquipment[equipmentType] = grinderId;
        
        await Storage.set('brewGuideSettings', JSON.stringify(settings));
        
        // 仍然触发事件，以便不使用 Zustand 的组件也能更新
        window.dispatchEvent(new CustomEvent('storageChange', {
          detail: { key: 'brewGuideSettings' }
        }));
      }
    } catch (error) {
      console.error('[GrinderRecommendationStore] 保存失败:', error);
      // 不抛出错误，Zustand 状态已更新，UI 已响应
    }
  },
  
  // 从 localStorage 加载初始数据
  loadFromStorage: async () => {
    try {
      const { Storage } = await import('@/lib/core/storage');
      const settingsStr = await Storage.get('brewGuideSettings');
      
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        
        if (settings.lastUsedGrinderByEquipment) {
          set({ lastUsedGrinderByEquipment: settings.lastUsedGrinderByEquipment });
        }
      }
    } catch (error) {
      console.error('[GrinderRecommendationStore] 加载失败:', error);
    }
  },
  
  // 获取推荐的磨豆机ID
  getRecommendedGrinder: (equipmentId, userGrinders, customEquipments) => {
    // 边界情况：没有可用的磨豆机
    if (!userGrinders || userGrinders.length === 0) {
      return 'generic';
    }
    
    // 单磨豆机场景：直接返回唯一的磨豆机
    if (userGrinders.length === 1) {
      return userGrinders[0];
    }
    
    // 多磨豆机场景：查找该器具类型最后使用的磨豆机
    const equipmentType = getEquipmentTypeKey(equipmentId, customEquipments);
    const lastUsedGrinder = get().lastUsedGrinderByEquipment[equipmentType];
    
    // 如果有历史记录且该磨豆机仍在用户列表中，使用它
    if (lastUsedGrinder && userGrinders.includes(lastUsedGrinder)) {
      return lastUsedGrinder;
    }
    
    // 降级策略：返回第一台磨豆机（按用户添加顺序）
    return userGrinders[0];
  }
}));

/**
 * 自定义 Hook: 获取推荐的磨豆机ID (响应式)
 * 当磨豆机推荐状态变化时，使用此 Hook 的组件会自动重新渲染
 * 
 * @param equipmentId - 器具ID
 * @param userGrinders - 用户的磨豆机ID列表
 * @param customEquipments - 自定义器具列表
 * @returns 推荐的磨豆机ID
 */
export function useRecommendedGrinder(
  equipmentId: string | null,
  userGrinders: string[],
  customEquipments?: CustomEquipment[]
): string {
  // 订阅 store 中的状态，当状态变化时自动重新计算
  return useGrinderRecommendationStore(
    (state) => state.getRecommendedGrinder(equipmentId, userGrinders, customEquipments)
  );
}
