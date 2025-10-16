/**
 * 磨豆机智能推荐工具
 * 提供纯函数工具，不涉及状态管理
 * 
 * 注意：
 * - 状态管理请使用 @/lib/stores/grinderRecommendationStore
 * - 这里只提供纯工具函数和兼容性函数
 */

import { CustomEquipment } from '@/lib/core/config';
import { CustomGrinder } from '@/lib/utils/grindUtils';

/**
 * 检查指定的磨豆机ID是否在用户的磨豆机列表中
 * 
 * @param grinderId - 要检查的磨豆机ID
 * @param userGrinders - 用户的磨豆机ID列表
 * @param customGrinders - 自定义磨豆机列表
 * @returns 磨豆机是否存在
 */
export function isGrinderAvailable(
  grinderId: string,
  userGrinders: string[],
  customGrinders?: CustomGrinder[]
): boolean {
  // 通用磨豆机始终可用
  if (grinderId === 'generic') {
    return true;
  }
  
  // 检查是否在用户的磨豆机列表中
  if (userGrinders.includes(grinderId)) {
    return true;
  }
  
  // 对于自定义磨豆机，还需要检查它是否真实存在
  if (customGrinders) {
    const customGrinder = customGrinders.find(g => g.id === grinderId);
    // 如果是自定义磨豆机，必须同时在用户列表中且在自定义列表中
    return customGrinder !== undefined && userGrinders.includes(grinderId);
  }
  
  return false;
}

/**
 * 获取器具的类型标识
 * 用于区分不同类型的器具，以便记录各自的磨豆机使用偏好
 * 
 * @param equipmentId - 器具ID
 * @param customEquipments - 自定义器具列表
 * @returns 器具类型标识字符串
 */
export function getEquipmentTypeKey(
  equipmentId: string | null,
  customEquipments?: CustomEquipment[]
): string {
  if (!equipmentId) return 'generic';
  
  // 处理预设器具
  switch (equipmentId) {
    case 'V60':
      return 'v60';
    case 'CleverDripper':
      return 'clever';
    case 'Kalita':
      return 'kalita';
    case 'Origami':
      return 'origami';
    case 'Espresso':
      return 'espresso';
    default:
      break;
  }
  
  // 处理自定义器具
  if (customEquipments) {
    const customEquipment = customEquipments.find(
      e => e.id === equipmentId || e.name === equipmentId
    );
    
    if (customEquipment) {
      // 意式机类型归为统一的 espresso 类别
      if (customEquipment.animationType === 'espresso') {
        return 'espresso';
      }
      // 其他自定义器具使用独立的key，以便每个器具有自己的偏好
      return `custom-${customEquipment.id}`;
    }
  }
  
  return 'generic';
}

/**
 * 获取推荐的磨豆机ID（兼容性函数）
 * 
 * ⚠️ 已废弃：推荐使用 useGrinderRecommendationStore().getRecommendedGrinder()
 * 
 * 这个函数保留用于向后兼容，内部实现已改为调用 store
 * 在非 React 组件中使用时很有用
 */
export function getRecommendedGrinder(
  equipmentId: string | null,
  userGrinders: string[],
  lastUsedGrinderByEquipment: Record<string, string> | undefined,
  customEquipments?: CustomEquipment[]
): string {
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
  const lastUsedGrinder = lastUsedGrinderByEquipment?.[equipmentType];
  
  // 如果有历史记录且该磨豆机仍在用户列表中，使用它
  if (lastUsedGrinder && userGrinders.includes(lastUsedGrinder)) {
    return lastUsedGrinder;
  }
  
  // 降级策略：返回第一台磨豆机（按用户添加顺序）
  return userGrinders[0];
}

/**
 * 保存器具类型使用的磨豆机记录（兼容性函数）
 * 
 * ⚠️ 已废弃：推荐直接使用 useGrinderRecommendationStore().updateLastUsedGrinder()
 * 
 * 这个函数保留用于向后兼容，内部实现是调用 Zustand store
 * 在非 React 组件中使用时很有用
 */
export async function saveLastUsedGrinder(
  equipmentId: string | null,
  grinderId: string,
  customEquipments?: CustomEquipment[]
): Promise<void> {
  try {
    const { useGrinderRecommendationStore } = await import('@/lib/stores/grinderRecommendationStore');
    const store = useGrinderRecommendationStore.getState();
    await store.updateLastUsedGrinder(equipmentId, grinderId, customEquipments);
  } catch (error) {
    console.error('[grinderRecommendation] 保存磨豆机使用记录失败:', error);
  }
}
