import React from 'react';
import { Equipment, CustomEquipment } from '@/lib/core/config';
import hapticsUtils from '@/lib/ui/haptics';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';

interface EquipmentCategoryBarProps {
  equipmentList: Equipment[];
  customEquipments: CustomEquipment[];
  selectedEquipment: string | null;
  onSelect: (equipmentId: string) => void;
  settings: {
    hapticFeedback?: boolean;
  };
  onAddEquipment?: () => void;  // 添加器具回调
  onEditEquipment?: (equipment: CustomEquipment) => void; // 编辑自定义器具回调
  onDeleteEquipment?: (equipment: CustomEquipment) => void; // 删除自定义器具回调
  onShareEquipment?: (equipment: CustomEquipment) => void; // 分享自定义器具回调
}

const EquipmentCategoryBar: React.FC<EquipmentCategoryBarProps> = ({
  equipmentList,
  customEquipments,
  selectedEquipment,
  onSelect,
  settings,
  onAddEquipment,
  onEditEquipment,
  onDeleteEquipment,
  onShareEquipment
}) => {
  // 处理器具选择
  const handleEquipmentSelect = (equipmentId: string) => {
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
    onSelect(equipmentId);
  };

  // 处理添加器具
  const handleAddEquipment = () => {
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
    if (onAddEquipment) {
      onAddEquipment();
    }
  };

  // 获取当前选中的自定义器具
  const getSelectedCustomEquipment = () => {
    if (!selectedEquipment) return null;
    return customEquipments.find(eq => eq.id === selectedEquipment) || null;
  };

  // 判断当前选中的是否为自定义器具
  const isCustomEquipment = () => {
    return !!getSelectedCustomEquipment();
  };

  // 合并标准器具和自定义器具
  const allEquipments = [...equipmentList, ...customEquipments];

  // 构建操作菜单项
  const getActionMenuItems = (equipment: CustomEquipment) => {
    const items = [];

    if (onEditEquipment) {
      items.push({
        id: 'edit',
        label: '编辑',
        onClick: () => {
          if (settings.hapticFeedback) {
            hapticsUtils.light();
          }
          onEditEquipment(equipment);
        }
      });
    }

    if (onDeleteEquipment) {
      items.push({
        id: 'delete',
        label: '删除',
        color: 'danger' as const,
        onClick: () => {
          if (settings.hapticFeedback) {
            hapticsUtils.light();
          }
          onDeleteEquipment(equipment);
        }
      });
    }

    if (onShareEquipment) {
      items.push({
        id: 'share',
        label: '分享',
        onClick: () => {
          if (settings.hapticFeedback) {
            hapticsUtils.light();
          }
          onShareEquipment(equipment);
        }
      });
    }

    return items;
  };

  // 获取当前选中的自定义器具
  const selectedCustomEquipment = getSelectedCustomEquipment();

  // 处理菜单项点击（直接实现，不通过ActionMenu）
  const handleEditClick = (equipment: CustomEquipment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
    if (onEditEquipment) {
      onEditEquipment(equipment);
    }
  };
  
  const handleDeleteClick = (equipment: CustomEquipment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
    if (onDeleteEquipment) {
      onDeleteEquipment(equipment);
    }
  };
  
  const handleShareClick = (equipment: CustomEquipment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
    if (onShareEquipment) {
      onShareEquipment(equipment);
    }
  };

  return (
    <div className="relative">
      <div className="px-6 py-2 relative">
        <div className="flex overflow-x-auto no-scrollbar pr-20">
          {allEquipments.map((equipment) => (
            <div key={equipment.id} className="relative flex items-center mr-4">
              <button
                onClick={() => handleEquipmentSelect(equipment.id)}
                className={`text-xs whitespace-nowrap relative ${
                  selectedEquipment === equipment.id
                    ? 'text-neutral-800 dark:text-neutral-100'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <span className="relative">{equipment.name}</span>
                {/* {selectedEquipment === equipment.id && (
                  <span className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-800 dark:bg-white"></span>
                )} */}
              </button>
              
              {/* 自定义器具显示操作菜单 - 使用自定义下拉菜单 */}
              {customEquipments.some(e => e.id === equipment.id) && 
               selectedEquipment === equipment.id && (
                <div className="ml-2 flex items-center">
                  {onEditEquipment && (
                    <button 
                      onClick={(e) => handleEditClick(equipment as CustomEquipment, e)}
                      className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 mx-1"
                    >
                      编辑
                    </button>
                  )}
                  {onDeleteEquipment && (
                    <button 
                      onClick={(e) => handleDeleteClick(equipment as CustomEquipment, e)}
                      className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 mx-1"
                    >
                      删除
                    </button>
                  )}
                  {onShareEquipment && (
                    <button 
                      onClick={(e) => handleShareClick(equipment as CustomEquipment, e)}
                      className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-green-500 dark:hover:text-green-400 mx-1"
                    >
                      分享
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 添加器具按钮 - 固定在右侧 */}
        <div className="absolute right-6 top-0 bottom-0 flex items-center bg-neutral-50 dark:bg-neutral-900 pl-1 before:content-[''] before:absolute before:left-[-20px] before:top-0 before:bottom-0 before:w-5 before:bg-gradient-to-r before:from-transparent before:to-neutral-50 dark:before:to-neutral-900 before:pointer-events-none">
          {onAddEquipment && (
            <button
              onClick={handleAddEquipment}
              className="text-xs whitespace-nowrap relative text-neutral-600 dark:text-neutral-400"
            >
              <span className="relative">添加器具</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EquipmentCategoryBar; 