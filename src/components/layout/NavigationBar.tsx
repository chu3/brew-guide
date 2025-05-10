'use client'

import React, { useState, useEffect } from 'react'
import { equipmentList, Method } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { SettingsOptions } from '@/components/settings/Settings'
import { formatGrindSize } from '@/lib/utils/grindUtils'
import { BREWING_EVENTS } from '@/lib/brewing/constants'
import { listenToEvent } from '@/lib/brewing/events'
import { updateParameterInfo } from '@/lib/brewing/parameters'
import { useTranslations } from 'next-intl'
import { Equal, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import EquipmentCategoryBar from '@/components/method/forms/EquipmentCategoryBar'

// 简化类型定义
type MainTabType = '冲煮' | '咖啡豆' | '笔记';

// 调整BrewingStep类型，使其更准确地反映实际流程
type BrewingStep = 'method' | 'brewing';  // method: 器具和方案选择, brewing: 注水过程

// 方案标签页类型
type MethodTabType = '器具' | '方案';

// 参数信息接口
interface ParameterInfo {
  equipment: string | null
  method: string | null
  params: {
    coffee?: string | null
    water?: string | null
    ratio?: string | null
    grindSize?: string | null
    temp?: string | null
  } | null
}

// 可编辑参数接口
interface EditableParams {
  coffee: string
  water: string
  ratio: string
  grindSize: string
  temp: string
}

// 隐藏滚动条样式
const noScrollbarStyle = `
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

// 标签按钮组件
const TabButton = ({
  tab,
  isActive,
  isDisabled,
  isCompleted,
  onClick,
  hasSecondaryLine,
  className = '',
  dataTab,
}: {
  tab: string
  isActive: boolean
  isDisabled?: boolean
  isCompleted?: boolean
  onClick?: () => void
  hasSecondaryLine?: boolean
  className?: string
  dataTab?: string
}) => {
  const handleClick = () => {
    if (!isDisabled && onClick) onClick();
  };

  return (
    <div
      onClick={!isDisabled ? handleClick : undefined}
      className={`text-xs tracking-widest ${className} ${
        isActive
          ? 'text-neutral-800 dark:text-neutral-100'
          : isCompleted
            ? 'cursor-pointer text-neutral-600 dark:text-neutral-400'
            : isDisabled
              ? 'text-neutral-300 dark:text-neutral-600'
              : 'cursor-pointer text-neutral-500 dark:text-neutral-400'
      }`}
      data-tab={dataTab}
    >
      <span className="relative">
        {tab}
        <span
          className={`absolute -bottom-1 left-0 right-0 h-px ${
            hasSecondaryLine
              ? 'bg-neutral-200 dark:bg-neutral-700 opacity-100'
              : 'bg-neutral-200 dark:bg-neutral-700 opacity-0'
          }`}
        />
       <span
          className={`absolute -bottom-1 left-0 right-0 z-10 h-px bg-neutral-800 dark:bg-neutral-100 ${
            isActive ? 'opacity-100 w-full' : 'opacity-0 w-0'
          }`}
        />
      </span>
    </div>
  )
}

// 可编辑参数组件
const EditableParameter = ({
  value,
  onChange,
  unit,
  className = '',
  prefix = '',
  isGrindSize = false,
  originalGrindSize = '',
}: {
  value: string
  onChange: (value: string) => void
  unit: string
  className?: string
  prefix?: string
  isGrindSize?: boolean
  originalGrindSize?: string
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(isGrindSize && originalGrindSize ? originalGrindSize : value)
  const inputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setTempValue(isGrindSize && originalGrindSize ? originalGrindSize : value)
  }, [value, isGrindSize, originalGrindSize])

  const handleBlur = () => {
    setIsEditing(false)
    if (tempValue !== (isGrindSize && originalGrindSize ? originalGrindSize : value)) {
      onChange(tempValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setTempValue(value)
      setIsEditing(false)
    }
  }

  return (
    <span
      className={`group relative inline-flex items-center ${className} cursor-pointer min-w-0`}
      onClick={() => setIsEditing(true)}
    >
      {prefix && <span className="flex-shrink-0">{prefix}</span>}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full border-b border-neutral-300 bg-transparent text-center text-[10px] outline-none px-0.5"
        />
      ) : (
        <span className="inline-flex items-center whitespace-nowrap">
          {value}
          {unit && <span className="ml-0.5 flex-shrink-0">{unit}</span>}
        </span>
      )}
    </span>
  )
}

// 导航栏组件接口
interface NavigationBarProps {
  activeMainTab: MainTabType;
  setActiveMainTab: (tab: MainTabType) => void;
  activeBrewingStep: BrewingStep;
  setActiveBrewingStep: (step: BrewingStep) => void;
  parameterInfo: ParameterInfo;
  setParameterInfo: (info: ParameterInfo) => void;
  editableParams: EditableParams | null;
  setEditableParams: (params: EditableParams | null) => void;
  isTimerRunning: boolean;
  showComplete: boolean;
  selectedEquipment: string | null;
  selectedMethod: {
    name: string;
    params: {
      coffee: string;
      water: string;
      ratio: string;
      grindSize: string;
      temp: string;
      stages: Array<{
        label: string;
        time: number;
        water: string;
        detail: string;
      }>;
    };
  } | null;
  handleParamChange: (type: keyof EditableParams, value: string) => void;
  setShowHistory: (show: boolean) => void;
  setActiveTab: (tab: MethodTabType) => void;
  onTitleClick: () => void;
  settings: SettingsOptions;
  navigateToStep?: (step: BrewingStep, options?: {
    resetParams?: boolean,
    preserveMethod?: boolean,
    preserveEquipment?: boolean,
    force?: boolean
  }) => void;
  customEquipments?: any[];
  onSelectEquipment?: (equipmentId: string) => void;
  onAddEquipment?: () => void;
  onEditEquipment?: (equipment: any) => void;
  onDeleteEquipment?: (equipment: any) => void;
  onShareEquipment?: (equipment: any) => void;
  showEquipmentBar?: boolean;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
  activeMainTab,
  setActiveMainTab,
  activeBrewingStep,
  setActiveBrewingStep,
  parameterInfo,
  setParameterInfo,
  editableParams,
  setEditableParams,
  isTimerRunning,
  showComplete,
  selectedEquipment,
  selectedMethod,
  handleParamChange,
  setShowHistory,
  setActiveTab,
  onTitleClick,
  settings,
  navigateToStep,
  customEquipments,
  onSelectEquipment,
  onAddEquipment,
  onEditEquipment,
  onDeleteEquipment,
  onShareEquipment,
  showEquipmentBar
}) => {
  const t = useTranslations('nav');

  // 事件处理函数
  const handleMainTabClick = (tab: MainTabType) => {
    if (activeMainTab === tab) return;
    if (settings.hapticFeedback) hapticsUtils.light();

    setActiveMainTab(tab);
    if (tab === '冲煮' && activeMainTab === '笔记') {
      setShowHistory(false);
    } else if (tab === '笔记') {
      setShowHistory(true);
    }
  };

  const handleBackButtonClick = () => {
    if (settings.hapticFeedback) hapticsUtils.light();
    if (activeBrewingStep === 'brewing') {
      // 清除记录表单状态标记
      localStorage.setItem("brewingNoteInProgress", "false");
      
      // 在从注水步骤返回时，需要确保状态被正确重置
      if (navigateToStep) {
        // 增加force参数，确保即使在其他状态下也能返回
        navigateToStep('method', { 
          preserveEquipment: true,
          force: true,
          // 保留方法，这样可以在返回后重新选择相同的方法
          preserveMethod: true
        });
        
        // 触发一个事件，通知其他组件已返回方法步骤
        window.dispatchEvent(new CustomEvent('brewing:returnToMethod', {
          detail: { fromBrewing: true }
        }));
      } else {
        setActiveBrewingStep('method');
      }
    }
  };

  // 处理参数更新事件
  useEffect(() => {
    const handleStepChanged = async (detail: {
      step: BrewingStep;
      resetParams?: boolean;
      preserveStates?: string[];
      preserveMethod?: boolean;
      preserveEquipment?: boolean;
    }) => {
      try {
        const { loadCustomEquipments } = await import('@/lib/managers/customEquipments');
        const customEquipments = await loadCustomEquipments();
        
        // 由于类型不兼容问题，在这里进行明确类型断言
        // 实际使用的 Method 类型与接口可能有所不同，但功能上是兼容的
        updateParameterInfo(
          detail.step, 
          selectedEquipment, 
          selectedMethod as any, // 使用类型断言解决类型不兼容问题
          equipmentList,
          customEquipments
        );
      } catch (error) {
        console.error('加载自定义设备失败:', error);
        // 失败时使用标准设备列表
        updateParameterInfo(detail.step, selectedEquipment, selectedMethod as any, equipmentList);
      }
    };

    const cleanup = listenToEvent(BREWING_EVENTS.STEP_CHANGED, handleStepChanged);
    return cleanup;
  }, [selectedEquipment, selectedMethod]);

  useEffect(() => {
    const handleParameterInfoUpdate = (detail: {
      equipment: string | null;
      method: string | null;
      params: {
        coffee?: string | null;
        water?: string | null;
        ratio?: string | null;
        grindSize?: string | null;
        temp?: string | null;
      } | null;
    }) => {
      // 添加状态判断：当计时器停止且冲煮已完成时（可能正在显示记录表单），不更新参数栏
      // 这可以防止在显示记录表单时参数栏被意外更新
      if (!isTimerRunning && showComplete) {
        return; // 跳过更新
      }
      setParameterInfo(detail);
    };

    const cleanup = listenToEvent(BREWING_EVENTS.PARAMS_UPDATED, handleParameterInfoUpdate);
    return cleanup;
  }, [setParameterInfo, isTimerRunning, showComplete]);

  // UI 显示条件
  const shouldHideHeader = activeBrewingStep === 'brewing' && isTimerRunning && !showComplete;
  const shouldShowContent = activeMainTab === '冲煮' && (!isTimerRunning || showComplete);
  // 修改显示参数栏的条件：即使在method步骤也应该显示参数，如果有选择了方法的话
  const shouldShowParams = (
    (activeBrewingStep === 'brewing' || (activeBrewingStep === 'method' && selectedMethod)) && 
    parameterInfo.method !== null && 
    selectedMethod !== null
  );
  const shouldShowBackButton = activeMainTab === '冲煮' && (activeBrewingStep === 'brewing' && selectedMethod);

  // 渲染参数列表
  const renderParameters = () => {
    if (!parameterInfo.params) return null;
    
    // 只有有方法名和参数时才显示
    if (!shouldShowParams) return null;

    return (
      <div>
        {editableParams ? (
          <div
            key="editable"
            className="flex items-center justify-end bg-neutral-100 dark:bg-neutral-800 space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar pl-3"
          >
            <EditableParameter
              value={editableParams.coffee.replace('g', '')}
              onChange={(v) => handleParamChange('coffee', v)}
              unit="g"
              className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
            />
            <span className="flex-shrink-0">·</span>
            <EditableParameter
              value={editableParams.ratio.replace('1:', '')}
              onChange={(v) => handleParamChange('ratio', v)}
              unit=""
              prefix="1:"
              className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
            />
            {parameterInfo.params?.grindSize && (
              <>
                <span className="flex-shrink-0">·</span>
                <EditableParameter
                  value={formatGrindSize(editableParams.grindSize, settings.grindType)}
                  onChange={(v) => handleParamChange('grindSize', v)}
                  unit=""
                  className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                  isGrindSize={true}
                  originalGrindSize={editableParams.grindSize}
                />
              </>
            )}
            {parameterInfo.params?.temp && (
              <>
                <span className="flex-shrink-0">·</span>
                <EditableParameter
                  value={editableParams.temp.replace('°C', '')}
                  onChange={(v) => handleParamChange('temp', v)}
                  unit="°C"
                  className="border-b border-dashed border-neutral-200 dark:border-neutral-700"
                />
              </>
            )}
          </div>
        ) : (
          <span
            key="readonly"
            className="cursor-pointer flex items-center justify-end space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar bg-gradient-to-r from-transparent via-neutral-100/95 to-neutral-100/95 dark:via-neutral-800/95 dark:to-neutral-800/95 pl-6"
            onClick={() => {
              if (selectedMethod && !isTimerRunning) {
                setEditableParams({
                  coffee: selectedMethod.params.coffee,
                  water: selectedMethod.params.water,
                  ratio: selectedMethod.params.ratio,
                  grindSize: selectedMethod.params.grindSize,
                  temp: selectedMethod.params.temp,
                });
              }
            }}
          >
            <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
            <span className="flex-shrink-0">·</span>
            <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
            <span className="flex-shrink-0">·</span>
            <span className="whitespace-nowrap">
              {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType)}
            </span>
            <span className="flex-shrink-0">·</span>
            <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
          </span>
        )}
      </div>
    );
  };

  // 渲染导航主体
  return (
    <div className="sticky top-0 z-20 pt-safe-top bg-neutral-50/95 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
      <style jsx global>{noScrollbarStyle}</style>

      <AnimatePresence>
        {!shouldHideHeader && (
          <motion.div 
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <div className="flex items-center justify-between px-6 pb-4">
              <div 
                onClick={shouldShowBackButton ? handleBackButtonClick : onTitleClick}
                className="cursor-pointer text-xs tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center"
              >
                {shouldShowBackButton ? (
                  <X className="w-4 h-4 mr-1" />
                ) : (
                  <Equal className="w-4 h-4 mr-1" />
                )}
              </div>

              {!shouldShowBackButton && (
                <div className="flex items-center space-x-6">
                  <TabButton
                    tab={t('main.brewing')}
                    isActive={activeMainTab === '冲煮'}
                    onClick={() => handleMainTabClick('冲煮')}
                    dataTab="冲煮"
                  />
                  <TabButton
                    tab={t('main.beans')}
                    isActive={activeMainTab === '咖啡豆'}
                    onClick={() => handleMainTabClick('咖啡豆')}
                    dataTab="咖啡豆"
                  />
                  <TabButton
                    tab={t('main.notes')}
                    isActive={activeMainTab === '笔记'}
                    onClick={() => handleMainTabClick('笔记')}
                    dataTab="笔记"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 设备选择栏 */}
      <div>
        {!shouldHideHeader && showEquipmentBar && customEquipments && onSelectEquipment && (
          <div>
              <EquipmentCategoryBar
                equipmentList={equipmentList}
                customEquipments={customEquipments}
                selectedEquipment={selectedEquipment}
                onSelect={onSelectEquipment}
                settings={settings}
                onAddEquipment={onAddEquipment}
                onEditEquipment={onEditEquipment}
                onDeleteEquipment={onDeleteEquipment}
                onShareEquipment={onShareEquipment}
              />
          </div>
        )}
        {shouldShowContent && shouldShowParams && (
          <div>
            <div className="px-6 py-2 bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 relative">
              <div className="flex items-center min-w-0 overflow-x-auto no-scrollbar max-w-full">
                {parameterInfo.method && (
                  <span className="whitespace-nowrap">
                    {parameterInfo.method}
                  </span>
                )}
              </div>

              {parameterInfo.params && (
                <div className="absolute top-2 right-6 min-w-0 max-w-full text-right z-10">
                  {renderParameters()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

        
    </div>
  );
};

export default NavigationBar;