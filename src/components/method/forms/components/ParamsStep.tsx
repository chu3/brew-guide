import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { hasSpecificGrindScale, getGrindScaleUnit, parseGrindSize, getMyGrinders, combineGrindSize, smartConvertGrindSize } from '@/lib/utils/grindUtils';
import { getRecommendedGrinder, saveLastUsedGrinder } from '@/lib/utils/grinderRecommendation';
import { Grinder, availableGrinders, CustomEquipment } from '@/lib/core/config';
import { SettingsOptions } from '@/components/settings/Settings';
import { isEspressoMachine } from '@/lib/utils/equipmentUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/coffee-bean/ui/select';

// 动画变体
const pageVariants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  out: { opacity: 0 }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.26
};

interface ParamsStepProps {
  params: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
    // 意式机特有参数
    extractionTime?: number;
    liquidWeight?: string;
  };
  onCoffeeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRatioChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGrindSizeChange: (grindSize: string) => void;
  onTempChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // 意式机特有参数的处理函数
  onExtractionTimeChange?: (value: number) => void;
  onLiquidWeightChange?: (value: string) => void;
  // 新增：磨豆机切换处理
  onGrinderChange?: (grinderId: string) => void;
  settings: SettingsOptions;
  customEquipment?: CustomEquipment;
}

const ParamsStep: React.FC<ParamsStepProps> = ({ 
  params, 
  onCoffeeChange, 
  onRatioChange, 
  onGrindSizeChange,
  onTempChange,
  onExtractionTimeChange,
  onLiquidWeightChange,
  onGrinderChange,
  settings,
  customEquipment
}) => {
  // 检查是否是意式机
  const isEspresso = customEquipment ? isEspressoMachine(customEquipment) : false;
  
  // 解析当前研磨度值,提取磨豆机ID和刻度值
  const { grinderId: currentGrinderId, value: currentGrindValue } = parseGrindSize(params.grindSize);
  
  // 使用智能推荐获取实际磨豆机ID
  // 如果研磨度中已携带磨豆机ID，使用它；否则根据器具类型智能推荐
  const recommendedGrinderId = getRecommendedGrinder(
    customEquipment?.id || null,
    settings.myGrinders || ['generic'],
    settings.lastUsedGrinderByEquipment,
    customEquipment ? [customEquipment] : undefined
  );
  const actualGrinderId = currentGrinderId || recommendedGrinderId;
  
  // 查找选定的研磨机
  const selectedGrinder = availableGrinders.find((g: Grinder) => g.id === actualGrinderId);
  const grinderName = selectedGrinder ? selectedGrinder.name : '通用';

  // 获取用户的磨豆机列表
  const myGrinders = getMyGrinders(settings.myGrinders || ['generic'], settings.customGrinders);

  // 使用 ref 追踪是否已经为当前器具推荐过，避免循环更新
  const lastRecommendedEquipment = useRef<string | null>(null);
  
  // 当器具变化或推荐的磨豆机改变时，自动转化研磨度
  useEffect(() => {
    const equipmentKey = customEquipment?.id || 'none';
    
    // 如果已经为这个器具推荐过，跳过
    if (lastRecommendedEquipment.current === equipmentKey) return;
    
    // 如果研磨度没有携带磨豆机ID，或者携带的是通用磨豆机
    if (!currentGrinderId || currentGrinderId === 'generic') {
      // 且推荐的磨豆机不是通用的
      if (recommendedGrinderId !== 'generic' && currentGrindValue) {
        // 转化研磨度
        const convertedValue = smartConvertGrindSize(
          currentGrindValue,
          currentGrinderId || 'generic',
          recommendedGrinderId,
          settings.customGrinders
        );
        const newGrindSize = combineGrindSize(recommendedGrinderId, convertedValue);
        
        // 只有当转化后的值不同时才更新
        if (newGrindSize !== params.grindSize) {
          onGrindSizeChange(newGrindSize);
        }
        
        // 标记已经为这个器具推荐过
        lastRecommendedEquipment.current = equipmentKey;
      }
    } else {
      // 如果研磨度已经有磨豆机ID，也标记为已推荐
      lastRecommendedEquipment.current = equipmentKey;
    }
  }, [customEquipment?.id, recommendedGrinderId, currentGrinderId, currentGrindValue, params.grindSize, settings.customGrinders, onGrindSizeChange]);

  // 研磨度参考提示渲染函数
  const renderGrindSizeHints = () => {
    if (currentGrindValue) return null;
    
    return (
      <div className="mt-1 text-xs space-y-1">
        <p className="text-neutral-500 dark:text-neutral-400">研磨度参考 (可自由输入):</p>
        {selectedGrinder && selectedGrinder.grindSizes ? (
          // 显示特定研磨机的提示
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(selectedGrinder.grindSizes)
              .filter(([key]) => {
                // 只显示粗细度类型，而不是冲煮器具名称
                const basicKeywords = ['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗'];
                return basicKeywords.includes(key);
              })
              .map(([key, value]) => (
                <p key={key} className="text-neutral-500 dark:text-neutral-400">· {key}: {value}</p>
              ))
            }
          </div>
        ) : (
          // 显示通用提示
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {isEspresso ? (
              <>
                <p className="text-neutral-500 dark:text-neutral-400">· 极细 特细</p>
                <p className="text-neutral-500 dark:text-neutral-400">· 浓缩咖啡级</p>
              </>
            ) : (
              <>
                <p className="text-neutral-500 dark:text-neutral-400">· 极细 特细</p>
                <p className="text-neutral-500 dark:text-neutral-400">· 细</p>
                <p className="text-neutral-500 dark:text-neutral-400">· 中细</p>
                <p className="text-neutral-500 dark:text-neutral-400">· 中粗 粗</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // 处理磨豆机切换
  const handleGrinderChange = async (newGrinderId: string) => {
    // 使用智能转换函数
    const newGrindSizeValue = smartConvertGrindSize(
      currentGrindValue,
      actualGrinderId,
      newGrinderId,
      settings.customGrinders
    );
    
    // 组合新的研磨度字符串
    const newGrindSize = combineGrindSize(newGrinderId, newGrindSizeValue);
    
    // 通知父组件
    onGrindSizeChange(newGrindSize);
    
    // 记录用户的磨豆机选择（用于智能推荐）
    await saveLastUsedGrinder(
      customEquipment?.id || null,
      newGrinderId,
      customEquipment ? [customEquipment] : undefined
    );
    
    // 如果提供了 onGrinderChange 回调，也调用它
    if (onGrinderChange) {
      onGrinderChange(newGrinderId);
    }
  };

  // 处理研磨度值输入变化
  const handleGrindValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // 组合磨豆机ID和新值
    const newGrindSize = combineGrindSize(actualGrinderId, newValue);
    onGrindSizeChange(newGrindSize);
  };

  return (
    <motion.div
      key="params-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="space-y-10 max-w-md mx-auto pt-10 pb-20"
    >
      <div className="grid grid-cols-2 gap-6">
        {/* 咖啡粉量 */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            咖啡粉量
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={isEspresso ? '例如：18' : '例如：15'}
              value={params.coffee.replace('g', '')}
              onChange={onCoffeeChange}
              onFocus={(e) => e.target.select()}
              className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
            />
            <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
          </div>
        </div>

        {/* 水粉比 */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            水粉比
          </label>
          <div className="relative">
            <span className="absolute left-0 bottom-2 text-neutral-500 dark:text-neutral-400">1:</span>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={isEspresso ? '例如：2' : '例如：15'}
              value={params.ratio.replace('1:', '')}
              onChange={onRatioChange}
              onFocus={(e) => e.target.select()}
              className="w-full py-2 pl-6 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
            />
          </div>
        </div>

        {/* 意式机特有字段 - 液重 */}
        {isEspresso && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              液重
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="例如：36"
                value={(params.liquidWeight || params.water).replace('g', '')}
                onChange={(e) => {
                  if (onLiquidWeightChange) {
                    onLiquidWeightChange(`${e.target.value}g`);
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
              />
              <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
            </div>
          </div>
        )}

        {/* 意式机特有字段 - 萃取时间 */}
        {isEspresso && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              萃取时间
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="例如：25"
                value={params.extractionTime || ''}
                onChange={(e) => {
                  if (onExtractionTimeChange) {
                    onExtractionTimeChange(parseInt(e.target.value) || 0);
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
              />
              <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">秒</span>
            </div>
          </div>
        )}

        {/* 磨豆机 + 研磨度 */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            磨豆机 研磨度
          </label>
          
          <div className="flex items-center gap-2">
            {/* 磨豆机选择器 */}
            <div className="flex-1 relative">
              <Select value={actualGrinderId} onValueChange={handleGrinderChange}>
                <SelectTrigger className="w-full py-2 bg-transparent border-0 border-b border-neutral-300 dark:border-neutral-700 focus-within:border-neutral-800 dark:focus-within:border-neutral-400 shadow-none rounded-none h-auto px-0 text-base [&>span]:text-left">
                  <SelectValue placeholder="磨豆机">
                    {grinderName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[40vh] overflow-y-auto border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-xs bg-white/95 dark:bg-neutral-900/95 rounded-lg">
                  {myGrinders.map((grinder) => (
                    <SelectItem key={grinder.id} value={grinder.id} className="text-xs">
                      {grinder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 研磨度值输入 */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={currentGrindValue}
                onChange={handleGrindValueChange}
                onFocus={(e) => e.target.select()}
                placeholder={
                  isEspresso
                    ? (hasSpecificGrindScale(actualGrinderId)
                        ? `2-4${getGrindScaleUnit(actualGrinderId)}`
                        : "特细")
                    : (hasSpecificGrindScale(actualGrinderId)
                      ? `8${getGrindScaleUnit(actualGrinderId)}`
                      : "中细")
                }
                className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
              />
            </div>
          </div>

          {/* 研磨度参考提示 */}
          {renderGrindSizeHints()}
        </div>

        {/* 只在非意式机模式下显示水温字段 */}
        {!isEspresso && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              水温
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder='例如：92'
                value={params.temp ? params.temp.replace('°C', '') : ''}
                onChange={onTempChange}
                onFocus={(e) => e.target.select()}
                className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
              />
              <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">°C</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ParamsStep; 