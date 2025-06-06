import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { CustomEquipment } from '@/lib/core/config';
import { Stage } from './types';
import { isEspressoMachine, getPourTypeName as _getPourTypeName } from '@/lib/utils/equipmentUtils';

// 预设饮料列表 - 这些将通过翻译函数处理
const PRESET_BEVERAGES_KEYS = [
  'drinkingWater',
  'ice',
  'milk',
  'coconutMilk',
  'oatMilk'
];

// 动画变体
const pageVariants = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
  },
  out: {
    opacity: 0,
  }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.26
};

interface StagesStepProps {
  stages: Stage[];
  totalWater: string;
  customEquipment: CustomEquipment;
  onStageChange: (index: number, field: keyof Stage, value: string | number) => void;
  onPourTypeChange: (index: number, value: string) => void;
  toggleValveStatus: (index: number) => void;
  addStage: () => void;
  removeStage: (index: number) => void;
  calculateTotalTime: () => number;
  calculateCurrentWater: () => number;
  formatTime: (seconds: number) => string;
  editingCumulativeTime: { index: number, value: string } | null;
  setEditingCumulativeTime: React.Dispatch<React.SetStateAction<{ index: number, value: string } | null>>;
  editingCumulativeWater: { index: number, value: string } | null;
  setEditingCumulativeWater: React.Dispatch<React.SetStateAction<{ index: number, value: string } | null>>;
  showWaterTooltip: number | null;
  setShowWaterTooltip: React.Dispatch<React.SetStateAction<number | null>>;
  stagesContainerRef: React.RefObject<HTMLDivElement | null>;
  newStageRef?: React.RefObject<HTMLDivElement | null>;
  coffeeDosage?: string;
}

const StagesStep: React.FC<StagesStepProps> = ({
  stages,
  totalWater,
  customEquipment,
  onStageChange,
  onPourTypeChange,
  toggleValveStatus,
  addStage,
  removeStage,
  calculateTotalTime,
  calculateCurrentWater,
  formatTime,
  editingCumulativeTime,
  setEditingCumulativeTime,
  editingCumulativeWater,
  setEditingCumulativeWater,
  showWaterTooltip,
  setShowWaterTooltip,
  stagesContainerRef,
  newStageRef,
  coffeeDosage = '15g'
}) => {
  const t = useTranslations('brewing.form.steps');

  // 获取翻译后的预设饮料列表
  const PRESET_BEVERAGES = PRESET_BEVERAGES_KEYS.map(key => t(`beverages.${key}`));
  const innerNewStageRef = useRef<HTMLDivElement>(null);
  const _isCustomPreset = customEquipment.animationType === 'custom';
  
  // 添加状态来存储用户自定义的饮料建议列表
  const [beverageSuggestions, setBeverageSuggestions] = useState<string[]>(PRESET_BEVERAGES);
  
  // 初始化时从 localStorage 读取用户自定义的饮料建议
  useEffect(() => {
    const loadBeverageSuggestions = () => {
      try {
        const savedSuggestions = localStorage.getItem('userBeverageSuggestions');
        if (savedSuggestions) {
          const parsedSuggestions = JSON.parse(savedSuggestions) as string[];
          // 合并预设和用户自定义饮料，去除重复
          const uniqueSuggestions = Array.from(
            new Set([...PRESET_BEVERAGES, ...parsedSuggestions])
          );
          setBeverageSuggestions(uniqueSuggestions);
        }
      } catch (error) {
        console.error('Failed to load beverage suggestions:', error);
      }
    };
    
    loadBeverageSuggestions();
  }, []);
  
  // 当用户输入新的饮料名称时，保存到建议列表和localStorage
  const handleBeverageChange = (index: number, value: string) => {
    // 只将值传递给 onStageChange，不进行本地保存
    onStageChange(index, 'label', value);
  };

  // 从suggestions中删除指定的饮料名称
  const handleRemoveBeverage = (value: string) => {
    // 不能删除预设饮料
    if (PRESET_BEVERAGES.includes(value)) {
      return;
    }
    
    try {
      // 从localStorage中读取用户自定义饮料
      const savedSuggestions = localStorage.getItem('userBeverageSuggestions');
      if (savedSuggestions) {
        const userBeverages = JSON.parse(savedSuggestions) as string[];
        // 过滤掉要删除的饮料
        const updatedBeverages = userBeverages.filter(item => item !== value);
        // 保存回localStorage
        localStorage.setItem('userBeverageSuggestions', JSON.stringify(updatedBeverages));
        
        // 更新本地状态
        const newSuggestions = beverageSuggestions.filter(item => item !== value);
        setBeverageSuggestions(newSuggestions);
      }
    } catch (error) {
      console.error('Failed to remove beverage name:', error);
    }
  };
  
  // 判断是否为自定义饮料（可删除）
  const isCustomBeverage = (value: string) => {
    return !PRESET_BEVERAGES.includes(value);
  };

  // 格式化意式咖啡的总水量，显示为各阶段的累加
  const formatEspressoTotalWater = () => {
    if (!stages || stages.length === 0) return "0g";
    
    // 收集水量信息，按完整的饮料名称分组
    const waterByName: Record<string, { label: string; water: number; count: number }> = {};
    
    stages.forEach(stage => {
      if (!stage.water) return;

      const waterValue = typeof stage.water === 'number'
        ? stage.water
        : parseInt(stage.water.toString().replace('g', '') || '0');

      // 只处理有效的水量值（大于0）
      if (waterValue <= 0) return;
      
      // 获取显示的标签
      const displayLabel = stage.pourType === 'extraction' ? t('extractEspresso') :
                           stage.label || (stage.pourType === 'beverage' ? t('beverage') : t('other'));
      
      // 使用完整标签作为键，只有完全相同的标签才会合并
      const key = `${stage.pourType}_${displayLabel}`;
      
      // 如果该名称已存在，则累加水量
      if (waterByName[key]) {
        waterByName[key].water += waterValue;
        waterByName[key].count += 1;
      } else {
        // 否则创建新条目
        waterByName[key] = {
          label: displayLabel,
          water: waterValue,
          count: 1
        };
      }
    });
    
    // 将Map转换为数组
    const waterItems = Object.values(waterByName);
    
    // 如果没有有效数据，返回零
    if (waterItems.length === 0) return "0g";
    
    // 构建显示字符串：水量g(标签) + 水量g(标签) + ...
    return waterItems.map(item => {
      // 只有相同名称有多个时才添加数量
      const countSuffix = item.count > 1 ? `×${item.count}` : '';
      return `${item.water}g(${item.label}${countSuffix})`;
    }).join(' + ');
  };

  return (
    <motion.div
      key="stages-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="space-y-8 max-w-md mx-auto relative"
    >
      {/* 顶部固定导航 */}
      <div className="sticky top-0 pt-2 pb-4 bg-neutral-50 dark:bg-neutral-900 z-10 flex flex-col border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-200">
            {t('title')}
          </h3>
          <button
            type="button"
            onClick={addStage}
            className="text-sm text-neutral-600 dark:text-neutral-400"
          >
            + {t('addStep')}
          </button>
        </div>

        <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="shrink-0">
            {t('totalTime')}: {formatTime(calculateTotalTime())}
          </div>
          <div className={`${isEspressoMachine(customEquipment) ? 'flex-1 ml-4 text-right truncate relative group' : 'shrink-0'}`}>
            <span className="truncate">{t('totalWater')}: {isEspressoMachine(customEquipment)
                  ? formatEspressoTotalWater()
                  : `${calculateCurrentWater()}/ ${parseInt(totalWater)} ${t('grams')}`}</span>
            
            {/* 当水量文本溢出时显示的提示框 */}
            {isEspressoMachine(customEquipment) && (
              <div className="absolute right-0 -bottom-8 hidden group-hover:block z-20 bg-white dark:bg-neutral-800 py-1 px-2 rounded-sm shadow-md text-xs">
                {formatEspressoTotalWater()}
              </div>
            )}
          </div>
        </div>

        {/* 顶部渐变阴影 - 作为导航的伪元素 */}
        <div className="absolute mt-[72px] left-0 right-0 h-12 -bottom-12 bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
      </div>
      {/* 步骤内容 */}
      <div className="space-y-10 pt-2 m-0" ref={stagesContainerRef}>
        {stages.map((stage, index) => (
          <div
            key={index}
            className="space-y-6 pb-6 border-neutral-200 dark:border-neutral-700 transition-colors duration-200"
            ref={index === stages.length - 1 ? (newStageRef || innerNewStageRef) : null}
          >
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 flex items-center">
                {t('step')} {index + 1}
              </h4>
              {stages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStage(index)}
                  className="text-xs text-neutral-500 dark:text-neutral-400"
                >
                  {t('delete')}
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {t('pourType') || '注水方式'}
                  </label>
                  <select
                    value={stage.pourType}
                    onChange={(e) => onPourTypeChange(index, e.target.value)}
                    className={`w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 appearance-none ${!stage.pourType ? 'text-neutral-500 dark:text-neutral-400' : ''}`}
                  >
                    <option value="" disabled>{t('selectPourType')}</option>
                    {/* 意式机特有的注水方式 */}
                    {isEspressoMachine(customEquipment) ? (
                      <>
                        <option value="extraction">{t('extractEspresso')}</option>
                        <option value="beverage">{t('beverage')}</option>
                        <option value="other">{t('other')}</option>
                      </>
                    ) : (
                      /* 普通器具的注水方式 */
                      (<>
                        {/* 显示自定义器具的自定义注水动画 */}
                        {customEquipment.customPourAnimations && customEquipment.customPourAnimations.length > 0 ? (
                          <>
                            {/* 用户创建的自定义注水动画 */}
                            {customEquipment.customPourAnimations
                              .filter(anim => !anim.isSystemDefault)
                              .map(animation => (
                                <option key={animation.id} value={animation.id}>
                                  {animation.name}
                                </option>
                              ))
                            }
                            {/* 如果不是自定义预设，才显示系统默认注水方式 */}
                            {customEquipment.animationType !== 'custom' && (
                              <>
                                {/* 系统默认注水方式 */}
                                {customEquipment.customPourAnimations
                                  .filter(anim => anim.isSystemDefault && anim.pourType)
                                  .map(animation => (
                                    <option key={animation.id} value={animation.pourType || ''}>
                                      {animation.name}
                                    </option>
                                  ))
                                }
                                {/* 如果没有中心注水/绕圈注水/添加冰块的系统预设，添加它们 */}
                                {!customEquipment.customPourAnimations.some(a => a.pourType === 'center') &&
                                  <option value="center">{t('center')}</option>
                                }
                                {!customEquipment.customPourAnimations.some(a => a.pourType === 'circle') &&
                                  <option value="circle">{t('circular')}</option>
                                }
                                {!customEquipment.customPourAnimations.some(a => a.pourType === 'ice') &&
                                  <option value="ice">{t('addIce')}</option>
                                }
                                <option value="other">{t('otherMethod')}</option>
                              </>
                            )}
                            {/* 为自定义预设添加其他方式选项 */}
                            {customEquipment.animationType === 'custom' && (
                              <option value="other">{t('otherMethod')}</option>
                            )}
                          </>
                        ) : (
                          <>
                            {/* 自定义预设器具显示更简化的选项列表 */}
                            {customEquipment.animationType === 'custom' ? (
                              <>
                                <option value="other">{t('otherMethod')}</option>
                                {/* 添加提示信息 */}
                                <option value="" disabled style={{ fontStyle: 'italic', color: '#999' }}>
                                  {t('customAnimationTip')}
                                </option>
                              </>
                            ) : (
                              <>
                                <option value="bloom">{t('bloom')}</option>
                                <option value="center">{t('center')}</option>
                                <option value="circle">{t('circular')}</option>
                                <option value="ice">{t('addIce')}</option>
                                <option value="other">{t('otherMethod')}</option>
                              </>
                            )}
                          </>
                        )}
                      </>)
                    )}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {isEspressoMachine(customEquipment) && stage.pourType === 'beverage' ? t('beverageName') : t('stepName')}
                  </label>
                  <div className="relative">
                    {customEquipment.hasValve && (
                      <button
                        type="button"
                        onClick={() => toggleValveStatus(index)}
                        className={`absolute left-0 bottom-2 px-2 py-1 text-xs rounded-sm ${stage.valveStatus === 'open'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                          }`}
                      >
                        {stage.valveStatus === 'open' ? t('valveOpen') : t('valveClose')}
                      </button>
                    )}
                    {/* 只有意式机的饮料类型步骤才使用AutocompleteInput */}
                    {isEspressoMachine(customEquipment) && stage.pourType === 'beverage' ? (
                      <AutocompleteInput
                        value={stage.label || ''}
                        onChange={(value) => handleBeverageChange(index, value)}
                        suggestions={beverageSuggestions}
                        placeholder={t('beverageNamePlaceholder')}
                        className={`w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 ${customEquipment.hasValve ? 'pl-12' : ''}`}
                        onRemovePreset={handleRemoveBeverage}
                        isCustomPreset={isCustomBeverage}
                      />
                    ) : (
                      <input
                        type="text"
                        value={stage.label || ''}
                        onChange={(e) => onStageChange(index, 'label', e.target.value)}
                        placeholder={t('stepNamePlaceholder')}
                        className={`w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 ${customEquipment.hasValve ? 'pl-12' : ''}`}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 普通器具显示标准字段 */}
              {!isEspressoMachine(customEquipment) && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {t('cumulativeTime')}
                    </label>
                    <div className="relative">
                      <span className="absolute left-0 bottom-2 text-neutral-500 dark:text-neutral-400">{t('atTime')}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          editingCumulativeTime && editingCumulativeTime.index === index
                            ? editingCumulativeTime.value
                            : (stage.time ?? '')
                        }
                        onChange={(e) => {
                          // 先更新本地状态，保留用户输入的值
                          setEditingCumulativeTime({
                            index,
                            value: e.target.value
                          });

                          // 确保输入的值为正整数
                          const timeValue = parseInt(e.target.value) || 0;
                          if (timeValue >= 0) {
                            onStageChange(index, 'time', timeValue);
                          }
                        }}
                        onBlur={() => setEditingCumulativeTime(null)} // 失去焦点时清除本地状态
                        placeholder="0"
                        className="w-full py-2 pl-5 pr-5 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                      />
                      <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">{t('seconds')}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-500">
                      {t('pourTime')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={stage.pourTime ?? ''}
                      onChange={(e) => {
                        const pourTime = parseInt(e.target.value) || 0;
                        
                        // 获取当前阶段的时间
                        const currentTime = stage.time || 0;
                        
                        // 获取上一个阶段的时间（如果存在）
                        let previousTime = 0;
                        if (index > 0) {
                          const previousStage = stages[index - 1];
                          previousTime = previousStage.time || 0;
                        }
                        
                        // 计算阶段时间长度（当前阶段时间与上一阶段时间的差值）
                        const stageDuration = Math.max(0, currentTime - previousTime);
                        
                        // 如果注水时间大于阶段时间长度，则将注水时间设置为阶段时间长度
                        if (pourTime > stageDuration) {
                          onStageChange(index, 'pourTime', stageDuration);
                        } else {
                          onStageChange(index, 'pourTime', pourTime);
                        }
                      }}
                      className="w-full py-2 bg-transparent outline-hidden border-b border-dashed border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                    />
                    
                    {/* 等待时间显示 */}
                    {(() => {
                      // 获取当前阶段的时间
                      const currentTime = stage.time || 0;
                      
                      // 获取上一个阶段的时间（如果存在）
                      let previousTime = 0;
                      if (index > 0) {
                        const previousStage = stages[index - 1];
                        previousTime = previousStage.time || 0;
                      }
                      
                      // 计算阶段总时长
                      const stageDuration = Math.max(0, currentTime - previousTime);
                      
                      // 计算等待时间
                      const pourTime = stage.pourTime || 0;
                      const waitTime = stageDuration - pourTime;
                      
                      // 只有当等待时间大于0时才显示
                      return waitTime > 0 ? (
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-500 mt-1">
                          {t('waitTime')}: {waitTime}{t('units.seconds')}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {t('cumulativeWater')}
                      <button 
                        type="button"
                        className="ml-1 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 focus:outline-hidden relative" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // 切换提示的显示状态
                          if (showWaterTooltip === index) {
                            setShowWaterTooltip(null);
                          } else {
                            setShowWaterTooltip(index);
                          }
                        }}
                        onMouseEnter={() => setShowWaterTooltip(index)}
                        onMouseLeave={() => setShowWaterTooltip(null)}
                        aria-label={t('waterInputFormatHelp')}
                      >
                        <Info className="w-[12px] h-[12px]" />
                        {/* 悬浮提示 */}
                        {showWaterTooltip === index && (
                          <div className="absolute z-10 -right-1 -translate-y-full -top-3 w-[110px] p-2 bg-white dark:bg-neutral-800 shadow-lg rounded-sm text-xs text-neutral-700 dark:text-neutral-300">
                            <p className="font-medium mb-1">{t('autoConvertWithSuffix')}</p>
                            <ul className="space-y-1">
                              <li>% : {t('waterPercentage')}</li>
                              <li>{t('multiplierSuffix')} : {t('coffeeMultiplier')}</li>
                            </ul>
                            {/* 小三角形箭头 */}
                            <div className="absolute right-1 bottom-[-6px] w-3 h-3 rotate-45 bg-white dark:bg-neutral-800"></div>
                          </div>
                        )}
                      </button>
                    </label>
                    <div className="relative">
                      <span className="absolute left-0 bottom-2 text-neutral-500 dark:text-neutral-400">{t('waterAmountShort')}</span>
                      <input
                        type="text"
                        min="0"
                        step="1"
                        placeholder=""
                        value={
                          editingCumulativeWater && editingCumulativeWater.index === index
                            ? editingCumulativeWater.value
                            : stage.water
                              ? (typeof stage.water === 'number'
                                ? String(stage.water)
                                : String(parseInt((stage.water as string).replace('g', '') || '0')))
                              : ''
                        }
                        onChange={(e) => {
                          // 更新本地编辑状态
                          setEditingCumulativeWater({
                            index,
                            value: e.target.value
                          });

                          // 如果输入为空，允许清空
                          if (!e.target.value.trim()) {
                            onStageChange(index, 'water', '');
                            return;
                          }

                          // 检查是否是百分比输入格式
                          if (e.target.value.endsWith('%')) {
                            // 在输入过程中保持原始输入值，不进行转换
                            // 转换将在onBlur时进行
                            return;
                          }

                          // 如果不是百分比，按原有逻辑处理
                          // 直接使用用户输入的值
                          let water;
                          if (e.target.value.includes('.')) {
                            // 处理小数点输入，并四舍五入到整数
                            water = Math.round(parseFloat(e.target.value));
                          } else {
                            water = parseInt(e.target.value) || 0;
                          }

                          // 确保累计水量不超过总水量（只有当总水量大于0时才进行限制）
                          const totalWaterValue = parseInt(totalWater.replace('g', '') || '0');

                          if (totalWaterValue > 0 && water > totalWaterValue) {
                            onStageChange(index, 'water', `${totalWaterValue}`);
                          } else {
                            onStageChange(index, 'water', `${water}`);
                          }
                        }}
                        onBlur={(e) => {
                          // 清除编辑状态
                          setEditingCumulativeWater(null);

                          // 在失去焦点时进行验证和调整
                          const value = e.target.value;

                          // 如果输入为空，清空水量
                          if (!value.trim()) {
                            onStageChange(index, 'water', '');
                            return;
                          }

                          // 获取总水量（用于计算和验证）
                          const totalWaterValue = parseInt(totalWater.replace('g', '') || '0');

                          // 检查是否是百分比输入 (例如 "50%")
                          const percentMatch = value.match(/^(\d+(\.\d+)?)%$/);
                          if (percentMatch) {
                            // 提取百分比值
                            const percentValue = parseFloat(percentMatch[1]);

                            // 只有当总水量大于0时才进行百分比计算
                            if (totalWaterValue > 0) {
                              // 计算实际克数 (百分比 * 总水量)
                              const calculatedWater = Math.round((percentValue / 100) * totalWaterValue);

                              // 确保计算的水量不超过总水量
                              const finalWater = Math.min(calculatedWater, totalWaterValue);

                              // 更新水量
                              onStageChange(index, 'water', `${finalWater}`);
                            } else {
                              // 如果总水量为0，直接使用百分比数值作为水量
                              onStageChange(index, 'water', `${Math.round(percentValue)}`);
                            }
                            return;
                          }

                          // 检查是否是倍数输入 (例如 "2倍"、"2x"、"x2"等)
                          // 匹配：数字+倍、数字+x/X、x/X+数字 格式
                          const multipleMatch = value.match(/^(\d+(\.\d+)?)(倍|[xX])$/) || 
                                              value.match(/^[xX][\s]*(\d+(\.\d+)?)[\s]*$/);
                          if (multipleMatch) {
                            // 提取倍数值
                            // 如果是 x数字 格式，倍率值在第二个正则的第一个捕获组
                            // 如果是 数字倍 或 数字x 格式，倍率值在第一个正则的第一个捕获组
                            const multipleValue = parseFloat(multipleMatch[1]);
                            
                            // 从coffeeDosage中提取咖啡粉量数值
                            const coffeeMatch = coffeeDosage.match(/(\d+(\.\d+)?)/);
                            const coffeeAmount = coffeeMatch ? parseFloat(coffeeMatch[1]) : 15; // 默认15g
                            
                            // 计算实际克数 (倍数 * 咖啡粉量)
                            const calculatedWater = Math.round(multipleValue * coffeeAmount);

                            // 只有当总水量大于0时才进行上限限制
                            const finalWater = totalWaterValue > 0
                              ? Math.min(calculatedWater, totalWaterValue)
                              : calculatedWater;

                            // 更新水量
                            onStageChange(index, 'water', `${finalWater}`);
                            return;
                          }

                          // 如果不是百分比或倍数，按原有逻辑处理
                          // 直接使用用户输入的值
                          let water;
                          if (value.includes('.')) {
                            // 处理小数点输入，并四舍五入到整数
                            water = Math.round(parseFloat(value));
                          } else {
                            water = parseInt(value) || 0;
                          }

                          // 确保累计水量不超过总水量（只有当总水量大于0时才进行限制）
                          if (totalWaterValue > 0 && water > totalWaterValue) {
                            onStageChange(index, 'water', `${totalWaterValue}`);
                          } else {
                            onStageChange(index, 'water', `${water}`);
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-full py-2 pl-9 pr-5 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                      />
                      <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">{t('grams')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 意式机 - 萃取类型 */}
              {isEspressoMachine(customEquipment) && stage.pourType === 'extraction' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {t('time')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        editingCumulativeTime && editingCumulativeTime.index === index
                          ? editingCumulativeTime.value
                          : (stage.time ?? '')
                      }
                      onChange={(e) => {
                        setEditingCumulativeTime({
                          index,
                          value: e.target.value
                        });
                        const timeValue = parseInt(e.target.value) || 0;
                        if (timeValue >= 0) {
                          onStageChange(index, 'time', timeValue);
                        }
                      }}
                      onBlur={() => setEditingCumulativeTime(null)}
                      placeholder="0"
                      className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {t('liquidWeight')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        min="0"
                        step="1"
                        placeholder=""
                        value={
                          editingCumulativeWater && editingCumulativeWater.index === index
                            ? editingCumulativeWater.value
                            : stage.water
                              ? (typeof stage.water === 'number'
                                ? String(stage.water)
                                : String(parseInt((stage.water as string).replace('g', '') || '0')))
                              : ''
                        }
                        onChange={(e) => {
                          setEditingCumulativeWater({
                            index,
                            value: e.target.value
                          });
                          if (!e.target.value.trim()) {
                            onStageChange(index, 'water', '');
                            return;
                          }
                          const water = parseInt(e.target.value) || 0;
                          onStageChange(index, 'water', `${water}`);
                        }}
                        onBlur={() => setEditingCumulativeWater(null)}
                        onFocus={(e) => e.target.select()}
                        className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                      />
                      <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 意式机 - 饮料类型 */}
              {isEspressoMachine(customEquipment) && stage.pourType === 'beverage' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {t('waterAmount')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        min="0"
                        step="1"
                        placeholder=""
                        value={
                          editingCumulativeWater && editingCumulativeWater.index === index
                            ? editingCumulativeWater.value
                            : stage.water
                              ? (typeof stage.water === 'number'
                                ? String(stage.water)
                                : String(parseInt((stage.water as string).replace('g', '') || '0')))
                              : ''
                        }
                        onChange={(e) => {
                          setEditingCumulativeWater({
                            index,
                            value: e.target.value
                          });
                          if (!e.target.value.trim()) {
                            onStageChange(index, 'water', '');
                            return;
                          }
                          const water = parseInt(e.target.value) || 0;
                          onStageChange(index, 'water', `${water}`);
                        }}
                        onBlur={() => setEditingCumulativeWater(null)}
                        onFocus={(e) => e.target.select()}
                        className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                      />
                      <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 所有类型都有的详细说明字段 */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {t('detailedDescription')}
                </label>
                <AutoResizeTextarea
                  value={stage.detail || ''}
                  onChange={(e) => onStageChange(index, 'detail', e.target.value)}
                  placeholder={t('describeStageMethod')}
                  className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                  minRows={2}
                  maxRows={6}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* 底部渐变阴影 - 提示有更多内容 */}
      <div className="sticky bottom-0 left-0 right-0 h-12 bg-linear-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
    </motion.div>
  );
};

export default StagesStep; 